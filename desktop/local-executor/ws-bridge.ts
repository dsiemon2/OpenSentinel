/**
 * WebSocket Bridge Client
 *
 * Runs in the Electron main process. Connects to the VPS WebSocket,
 * registers local capabilities, and handles bidirectional tool execution:
 * - Forwards chat messages to VPS brain
 * - Receives tool_execute_local requests from VPS, executes locally, returns results
 * - Streams chunk/tool_start/tool_result/complete events to renderer via EventEmitter
 */

import { EventEmitter } from "events";
import WebSocket from "ws";
import { nanoid } from "nanoid";
import type {
  ILocalExecutor,
  ClientMessage,
  ServerMessage,
  LocalToolResponse,
} from "./types";

// ─── Types ───────────────────────────────────────────────

export interface BridgeConfig {
  /** WebSocket URL, e.g. "ws://74.208.129.33:8030/ws" or "wss://app.opensentinel.ai/ws" */
  url: string;
  /** Local executor instance */
  executor: ILocalExecutor;
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Max reconnect attempts (default: 10) */
  maxReconnectAttempts?: number;
  /** Ping interval in ms (default: 30000) */
  pingInterval?: number;
}

export type BridgeStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface BridgeEvents {
  /** Connection status changed */
  status: (status: BridgeStatus) => void;
  /** Text chunk from Claude */
  chunk: (text: string, conversationId?: string) => void;
  /** Tool execution started on server */
  tool_start: (toolName: string, toolInput: Record<string, unknown>) => void;
  /** Tool execution completed on server */
  tool_result: (toolName: string, result: unknown) => void;
  /** Local tool execution requested by server */
  local_tool_start: (toolName: string, input: Record<string, unknown>) => void;
  /** Local tool execution completed */
  local_tool_result: (toolName: string, response: LocalToolResponse) => void;
  /** Complete response from Claude */
  complete: (fullText: string, conversationId?: string) => void;
  /** Error from server */
  error: (message: string) => void;
  /** Raw message for debugging */
  raw: (message: ServerMessage) => void;
}

// ─── Bridge Class ────────────────────────────────────────

export class WSBridge extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<BridgeConfig>;
  private status: BridgeStatus = "disconnected";
  private sessionId: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (err: Error) => void; timeout: ReturnType<typeof setTimeout> }
  >();

  constructor(config: BridgeConfig) {
    super();
    this.config = {
      autoReconnect: true,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      ...config,
    };
  }

  // ─── Public API ──────────────────────────────────────

  /** Connect to the VPS WebSocket */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus("connecting");
    console.log(`[Bridge] Connecting to ${this.config.url}...`);

    this.ws = new WebSocket(this.config.url);

    this.ws.on("open", () => this.onOpen());
    this.ws.on("message", (data) => this.onMessage(data.toString()));
    this.ws.on("close", (code, reason) => this.onClose(code, reason.toString()));
    this.ws.on("error", (err) => this.onError(err));
  }

  /** Disconnect from the VPS */
  disconnect(): void {
    this.config.autoReconnect = false;
    this.cleanup();
    this.setStatus("disconnected");
    console.log("[Bridge] Disconnected");
  }

  /** Get current connection status */
  getStatus(): BridgeStatus {
    return this.status;
  }

  /** Get session ID assigned by server */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Send a chat message to the VPS brain.
   * Responses will arrive as events (chunk, tool_start, tool_result, complete).
   */
  sendChat(message: string, conversationId?: string): string {
    const msgId = nanoid();
    this.send({
      type: "chat",
      message,
      conversationId,
    } as ClientMessage);
    return msgId;
  }

  /**
   * Send a chat_with_tools message (uses the server's existing protocol).
   * This sends in the WSClientMessage format the server expects.
   */
  sendChatWithTools(
    messages: Array<{ role: string; content: string }>,
    userId?: string
  ): string {
    const msgId = nanoid();
    // Send in the server's expected format
    const msg = {
      type: "chat_with_tools",
      id: msgId,
      payload: { messages, userId },
    };
    this.sendRaw(JSON.stringify(msg));
    return msgId;
  }

  /** Cancel an active request */
  cancel(requestId: string): void {
    const msg = {
      type: "cancel",
      id: requestId,
      payload: {},
    };
    this.sendRaw(JSON.stringify(msg));
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.status === "connected" && this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── WebSocket Event Handlers ────────────────────────

  private onOpen(): void {
    console.log("[Bridge] Connected, registering capabilities...");
    this.reconnectAttempts = 0;
    this.setStatus("connected");

    // Register client capabilities
    const capabilities = this.config.executor.getCapabilities();
    this.send({ type: "register_client", capabilities });

    console.log(
      `[Bridge] Registered ${capabilities.tools.length} local tools (${capabilities.clientId}, ${capabilities.platform})`
    );

    // Start ping keepalive
    this.startPing();
  }

  private onMessage(data: string): void {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      console.warn("[Bridge] Invalid JSON from server:", data.slice(0, 200));
      return;
    }

    this.emit("raw", msg);

    switch (msg.type) {
      case "registered":
        this.sessionId = msg.sessionId;
        console.log(`[Bridge] Session: ${this.sessionId}`);
        break;

      case "tool_execute_local":
        this.handleLocalToolRequest(msg);
        break;

      case "chunk":
        this.emit("chunk", msg.text, msg.conversationId);
        break;

      case "tool_start":
        this.emit("tool_start", msg.toolName, msg.toolInput);
        break;

      case "tool_result":
        this.emit("tool_result", msg.toolName, msg.result);
        break;

      case "complete":
        this.emit("complete", msg.fullText, msg.conversationId);
        break;

      case "error":
        this.emit("error", msg.message);
        break;

      case "pong":
        // Keepalive acknowledged
        break;

      default:
        // Handle server messages in WSServerMessage format (backward compatibility)
        this.handleLegacyMessage(msg as any);
    }
  }

  private onClose(code: number, reason: string): void {
    console.log(`[Bridge] Connection closed (${code}: ${reason})`);
    this.cleanup();

    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      this.setStatus("disconnected");
    }
  }

  private onError(err: Error): void {
    console.error("[Bridge] WebSocket error:", err.message);
    this.emit("error", err.message);
  }

  // ─── Local Tool Execution ────────────────────────────

  private async handleLocalToolRequest(msg: any): Promise<void> {
    const request = msg.request;
    if (!request) {
      console.warn("[Bridge] tool_execute_local missing request payload");
      return;
    }

    console.log(`[Bridge] Local tool request: ${request.toolName} (${request.requestId})`);
    this.emit("local_tool_start", request.toolName, request.input);

    const response = await this.config.executor.execute(request);

    console.log(
      `[Bridge] Local tool result: ${request.toolName} ${response.success ? "OK" : "FAIL"} (${response.durationMs}ms)`
    );
    this.emit("local_tool_result", request.toolName, response);

    // Send result back to server
    this.send({ type: "tool_result_local", response });
  }

  // ─── Legacy Message Handling ─────────────────────────

  private handleLegacyMessage(msg: any): void {
    // Handle WSServerMessage format from the existing protocol
    if (msg.payload) {
      switch (msg.type) {
        case "chunk":
          this.emit("chunk", msg.payload.text);
          break;
        case "tool_start":
          this.emit("tool_start", msg.payload.toolName, msg.payload.toolInput);
          break;
        case "tool_result":
          this.emit("tool_result", msg.payload.toolName, msg.payload.toolResult);
          break;
        case "complete":
          this.emit("complete", msg.payload.content);
          break;
        case "error":
          this.emit("error", msg.payload.error);
          break;
        case "connected":
          console.log(`[Bridge] Server: ${msg.payload.message}`);
          break;
      }
    }
  }

  // ─── Reconnection ────────────────────────────────────

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`[Bridge] Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  // ─── Helpers ─────────────────────────────────────────

  private send(msg: ClientMessage): void {
    this.sendRaw(JSON.stringify(msg));
  }

  private sendRaw(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      console.warn("[Bridge] Cannot send, WebSocket not open");
    }
  }

  private setStatus(status: BridgeStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit("status", status);
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, this.config.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanup(): void {
    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Reject pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Bridge disconnected"));
    }
    this.pendingRequests.clear();

    if (this.ws) {
      this.ws.removeAllListeners();
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, "Client disconnect");
      }
      this.ws = null;
    }

    this.sessionId = null;
  }
}
