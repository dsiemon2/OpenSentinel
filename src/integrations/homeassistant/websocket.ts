/**
 * Home Assistant WebSocket Client
 * Provides real-time state updates via WebSocket connection
 */

import { EventEmitter } from "events";

export interface WebSocketConfig {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
}

export interface HAWebSocketMessage {
  id?: number;
  type: string;
  [key: string]: unknown;
}

export interface HAAuthMessage {
  type: "auth";
  access_token: string;
  [key: string]: unknown;
}

export interface HAStateChangedEvent {
  entity_id: string;
  old_state: HAWebSocketState | null;
  new_state: HAWebSocketState | null;
}

export interface HAWebSocketState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HAServiceCallEvent {
  domain: string;
  service: string;
  service_data: Record<string, unknown>;
}

export interface HAEventData {
  event_type: string;
  data: unknown;
  origin: string;
  time_fired: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export type StateChangeHandler = (event: HAStateChangedEvent) => void;
export type EventHandler = (event: HAEventData) => void;
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: Error) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Home Assistant WebSocket Client
 * Maintains a persistent connection for real-time updates
 */
export class HomeAssistantWebSocket extends EventEmitter {
  private wsUrl: string;
  private token: string;
  private ws: WebSocket | null = null;
  private messageId: number = 1;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: number;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isAuthenticated: boolean = false;
  private isConnecting: boolean = false;
  private subscriptions: Map<number, string> = new Map();
  private stateSubscriptionId: number | null = null;
  private eventSubscriptions: Map<string, number> = new Map();

  constructor(config: WebSocketConfig) {
    super();
    // Convert HTTP URL to WebSocket URL
    this.wsUrl = config.url
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:")
      .replace(/\/$/, "") + "/api/websocket";
    this.token = config.token;
    this.reconnectInterval = config.reconnectInterval ?? 5000;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;
    this.pingInterval = config.pingInterval ?? 30000;
  }

  /**
   * Connect to Home Assistant WebSocket API
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.emit("connecting");
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string, resolve, reject);
        };

        this.ws.onerror = (event) => {
          this.isConnecting = false;
          const error = new Error("WebSocket error");
          this.emit("error", error);
          reject(error);
        };

        this.ws.onclose = () => {
          this.isConnecting = false;
          this.isAuthenticated = false;
          this.stopPing();
          this.emit("disconnected");
          this.handleReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(
    data: string,
    connectResolve?: (value: void) => void,
    connectReject?: (reason: Error) => void
  ): void {
    let message: HAWebSocketMessage;
    try {
      message = JSON.parse(data);
    } catch {
      this.emit("error", new Error("Failed to parse WebSocket message"));
      return;
    }

    switch (message.type) {
      case "auth_required":
        this.sendAuth();
        break;

      case "auth_ok":
        this.isAuthenticated = true;
        this.isConnecting = false;
        this.startPing();
        this.emit("connected");
        if (connectResolve) connectResolve();
        break;

      case "auth_invalid":
        this.isConnecting = false;
        const authError = new Error(
          (message.message as string) ?? "Authentication failed"
        );
        this.emit("error", authError);
        if (connectReject) connectReject(authError);
        break;

      case "result":
        this.handleResult(message);
        break;

      case "event":
        this.handleEvent(message);
        break;

      case "pong":
        // Ping response received
        break;

      default:
        // Unknown message type
        break;
    }
  }

  /**
   * Send authentication message
   */
  private sendAuth(): void {
    this.sendRaw({
      type: "auth",
      access_token: this.token,
    } as HAAuthMessage);
  }

  /**
   * Handle result messages
   */
  private handleResult(message: HAWebSocketMessage): void {
    const id = message.id;
    if (id === undefined) return;

    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(id);

    if (message.success === false) {
      const error = message.error as { code: string; message: string } | undefined;
      pending.reject(
        new Error(error?.message ?? "Unknown error")
      );
    } else {
      pending.resolve(message.result);
    }
  }

  /**
   * Handle event messages
   */
  private handleEvent(message: HAWebSocketMessage): void {
    const eventData = message.event as HAEventData;
    if (!eventData) return;

    // Emit the raw event
    this.emit("event", eventData);

    // Handle state changes
    if (eventData.event_type === "state_changed") {
      const stateChange = eventData.data as HAStateChangedEvent;
      this.emit("state_changed", stateChange);

      // Emit entity-specific event
      if (stateChange.entity_id) {
        this.emit(`state:${stateChange.entity_id}`, stateChange);
      }
    }

    // Emit event-type-specific events
    this.emit(`event:${eventData.event_type}`, eventData);
  }

  /**
   * Send a raw message
   */
  private sendRaw(message: HAWebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a message and wait for response
   */
  async send<T = unknown>(
    type: string,
    data?: Record<string, unknown>,
    timeout: number = 10000
  ): Promise<T> {
    if (!this.isAuthenticated) {
      throw new Error("Not authenticated");
    }

    const id = this.messageId++;
    const message: HAWebSocketMessage = {
      id,
      type,
      ...data,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out after ${timeout}ms`));
      }, timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout: timeoutHandle,
      });

      try {
        this.sendRaw(message);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  /**
   * Start ping timer
   */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.isAuthenticated && this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({ type: "ping", id: this.messageId++ });
      }
    }, this.pingInterval);
  }

  /**
   * Stop ping timer
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Handle reconnection
   */
  private handleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("error", new Error("Max reconnection attempts reached"));
      return;
    }

    this.reconnectAttempts++;
    this.emit("reconnecting", this.reconnectAttempts);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        // Re-subscribe to state changes if we were subscribed
        if (this.stateSubscriptionId !== null) {
          this.stateSubscriptionId = null;
          await this.subscribeToStateChanges();
        }
        // Re-subscribe to events
        const events = Array.from(this.eventSubscriptions.keys());
        this.eventSubscriptions.clear();
        for (const eventType of events) {
          await this.subscribeToEvent(eventType);
        }
      } catch {
        this.handleReconnect();
      }
    }, this.reconnectInterval);
  }

  /**
   * Subscribe to all state changes
   */
  async subscribeToStateChanges(): Promise<number> {
    if (this.stateSubscriptionId !== null) {
      return this.stateSubscriptionId;
    }

    const result = await this.send<{ id: number }>("subscribe_events", {
      event_type: "state_changed",
    });

    this.stateSubscriptionId = result?.id ?? this.messageId - 1;
    return this.stateSubscriptionId;
  }

  /**
   * Subscribe to a specific event type
   */
  async subscribeToEvent(eventType: string): Promise<number> {
    if (this.eventSubscriptions.has(eventType)) {
      return this.eventSubscriptions.get(eventType)!;
    }

    const result = await this.send<{ id: number }>("subscribe_events", {
      event_type: eventType,
    });

    const subscriptionId = result?.id ?? this.messageId - 1;
    this.eventSubscriptions.set(eventType, subscriptionId);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: number): Promise<void> {
    await this.send("unsubscribe_events", { subscription: subscriptionId });
    this.subscriptions.delete(subscriptionId);

    if (this.stateSubscriptionId === subscriptionId) {
      this.stateSubscriptionId = null;
    }

    for (const [eventType, id] of Array.from(this.eventSubscriptions.entries())) {
      if (id === subscriptionId) {
        this.eventSubscriptions.delete(eventType);
        break;
      }
    }
  }

  /**
   * Get all states
   */
  async getStates(): Promise<HAWebSocketState[]> {
    return this.send<HAWebSocketState[]>("get_states");
  }

  /**
   * Get Home Assistant config
   */
  async getConfig(): Promise<Record<string, unknown>> {
    return this.send<Record<string, unknown>>("get_config");
  }

  /**
   * Get available services
   */
  async getServices(): Promise<Record<string, Record<string, unknown>>> {
    return this.send<Record<string, Record<string, unknown>>>("get_services");
  }

  /**
   * Get panels
   */
  async getPanels(): Promise<Record<string, unknown>> {
    return this.send<Record<string, unknown>>("get_panels");
  }

  /**
   * Call a service
   */
  async callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: {
      entity_id?: string | string[];
      device_id?: string | string[];
      area_id?: string | string[];
    }
  ): Promise<unknown> {
    return this.send("call_service", {
      domain,
      service,
      service_data: serviceData,
      target,
    });
  }

  /**
   * Fire an event
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>
  ): Promise<void> {
    await this.send("fire_event", {
      event_type: eventType,
      event_data: eventData,
    });
  }

  /**
   * Render a template
   */
  async renderTemplate(template: string): Promise<string> {
    const result = await this.send<string>("render_template", { template });
    return result;
  }

  /**
   * Get area registry
   */
  async getAreaRegistry(): Promise<
    Array<{ area_id: string; name: string; picture: string | null }>
  > {
    return this.send("config/area_registry/list");
  }

  /**
   * Get device registry
   */
  async getDeviceRegistry(): Promise<
    Array<{
      id: string;
      name: string;
      area_id: string | null;
      manufacturer: string | null;
      model: string | null;
    }>
  > {
    return this.send("config/device_registry/list");
  }

  /**
   * Get entity registry
   */
  async getEntityRegistry(): Promise<
    Array<{
      entity_id: string;
      name: string | null;
      device_id: string | null;
      area_id: string | null;
      disabled_by: string | null;
    }>
  > {
    return this.send("config/entity_registry/list");
  }

  /**
   * Add state change listener for specific entity
   */
  onStateChange(
    entityId: string,
    handler: StateChangeHandler
  ): () => void {
    this.on(`state:${entityId}`, handler);
    return () => this.off(`state:${entityId}`, handler);
  }

  /**
   * Add listener for all state changes
   */
  onAnyStateChange(handler: StateChangeHandler): () => void {
    this.on("state_changed", handler);
    return () => this.off("state_changed", handler);
  }

  /**
   * Add event listener
   */
  onEvent(eventType: string, handler: EventHandler): () => void {
    this.on(`event:${eventType}`, handler);
    return () => this.off(`event:${eventType}`, handler);
  }

  /**
   * Add connection handler
   */
  onConnected(handler: ConnectionHandler): () => void {
    this.on("connected", handler);
    return () => this.off("connected", handler);
  }

  /**
   * Add disconnection handler
   */
  onDisconnected(handler: ConnectionHandler): () => void {
    this.on("disconnected", handler);
    return () => this.off("disconnected", handler);
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.on("error", handler);
    return () => this.off("error", handler);
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return (
      this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated
    );
  }

  /**
   * Disconnect from Home Assistant
   */
  disconnect(): void {
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear all pending requests
    for (const pending of Array.from(this.pendingRequests.values())) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    }
    this.pendingRequests.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isAuthenticated = false;
    this.stateSubscriptionId = null;
    this.subscriptions.clear();
    this.eventSubscriptions.clear();
  }
}

/**
 * Create a WebSocket client instance
 */
export function createWebSocket(config: WebSocketConfig): HomeAssistantWebSocket {
  return new HomeAssistantWebSocket(config);
}

export default HomeAssistantWebSocket;
