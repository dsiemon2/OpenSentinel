/**
 * Agent Messenger - Inter-agent communication system
 *
 * Provides a publish/subscribe messaging system for agents to communicate
 * with each other, request assistance, and share information.
 */

import { EventEmitter } from "events";
import Redis from "ioredis";
import { env } from "../../../config/env";
import { db } from "../../../db";
import { metric } from "../../observability/metrics";
import { AgentType } from "../agent-types";

// Message types for inter-agent communication
export type MessageType =
  | "request" // Request assistance or information from another agent
  | "response" // Response to a request
  | "broadcast" // Broadcast to all agents
  | "notification" // Non-blocking notification
  | "handoff" // Hand off a task to another agent
  | "status_update" // Status update from an agent
  | "error" // Error notification
  | "heartbeat"; // Agent health check

export type MessagePriority = "low" | "normal" | "high" | "urgent";

export interface AgentMessage {
  id: string;
  type: MessageType;
  fromAgentId: string;
  fromAgentType: AgentType;
  toAgentId?: string; // Undefined for broadcasts
  toAgentType?: AgentType; // Target specific agent type for broadcasts
  correlationId?: string; // For request/response pairing
  priority: MessagePriority;
  payload: MessagePayload;
  metadata: MessageMetadata;
  createdAt: Date;
  expiresAt?: Date;
}

export interface MessagePayload {
  action?: string;
  data?: unknown;
  context?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface MessageMetadata {
  userId: string;
  conversationId?: string;
  parentTaskId?: string;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
}

export interface MessageHandler {
  (message: AgentMessage): Promise<MessagePayload | void>;
}

export interface MessageFilter {
  type?: MessageType | MessageType[];
  fromAgentType?: AgentType | AgentType[];
  toAgentType?: AgentType | AgentType[];
  priority?: MessagePriority | MessagePriority[];
}

interface PendingRequest {
  resolve: (response: MessagePayload) => void;
  reject: (error: Error) => void;
  timeout: Timer;
}

// Redis channels for pub/sub
const CHANNEL_PREFIX = "moltbot:agent:messages";
const BROADCAST_CHANNEL = `${CHANNEL_PREFIX}:broadcast`;
const getAgentChannel = (agentId: string) => `${CHANNEL_PREFIX}:${agentId}`;
const getAgentTypeChannel = (type: AgentType) => `${CHANNEL_PREFIX}:type:${type}`;

/**
 * AgentMessenger - Handles inter-agent communication
 */
export class AgentMessenger extends EventEmitter {
  private agentId: string;
  private agentType: AgentType;
  private userId: string;
  private subscriber: Redis;
  private publisher: Redis;
  private handlers: Map<MessageType, MessageHandler[]>;
  private pendingRequests: Map<string, PendingRequest>;
  private isConnected: boolean;
  private messageCount: number;

  constructor(agentId: string, agentType: AgentType, userId: string) {
    super();
    this.agentId = agentId;
    this.agentType = agentType;
    this.userId = userId;
    this.handlers = new Map();
    this.pendingRequests = new Map();
    this.isConnected = false;
    this.messageCount = 0;

    // Create Redis connections for pub/sub
    this.subscriber = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    this.publisher = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Initialize the messenger and start listening for messages
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    // Subscribe to channels
    await this.subscriber.subscribe(
      getAgentChannel(this.agentId), // Direct messages
      getAgentTypeChannel(this.agentType), // Type-specific messages
      BROADCAST_CHANNEL // Broadcast messages
    );

    // Handle incoming messages
    this.subscriber.on("message", async (channel, messageData) => {
      try {
        const message: AgentMessage = JSON.parse(messageData);

        // Skip messages from self
        if (message.fromAgentId === this.agentId) return;

        // Check if message is expired
        if (message.expiresAt && new Date(message.expiresAt) < new Date()) {
          return;
        }

        // Handle the message
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error("[AgentMessenger] Error processing message:", error);
        this.emit("error", error);
      }
    });

    this.isConnected = true;
    this.emit("connected");

    // Send initial heartbeat
    await this.sendHeartbeat();
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    // Cancel all pending requests
    this.pendingRequests.forEach((pending, id) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Messenger disconnecting"));
    });
    this.pendingRequests.clear();

    // Unsubscribe and close connections
    await this.subscriber.unsubscribe();
    this.subscriber.disconnect();
    this.publisher.disconnect();

    this.isConnected = false;
    this.emit("disconnected");
  }

  /**
   * Register a handler for a specific message type
   */
  registerHandler(type: MessageType, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Remove a handler for a message type
   */
  removeHandler(type: MessageType, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Send a direct message to another agent
   */
  async sendMessage(
    toAgentId: string,
    type: MessageType,
    payload: MessagePayload,
    options: Partial<{
      priority: MessagePriority;
      correlationId: string;
      conversationId: string;
      parentTaskId: string;
      expiresInMs: number;
    }> = {}
  ): Promise<void> {
    const message = this.createMessage(type, payload, {
      toAgentId,
      ...options,
    });

    await this.publisher.publish(
      getAgentChannel(toAgentId),
      JSON.stringify(message)
    );

    this.messageCount++;
    metric.agentOperation("spawn", this.agentType); // Reuse metric for message tracking
  }

  /**
   * Broadcast a message to all agents or a specific type
   */
  async broadcast(
    type: MessageType,
    payload: MessagePayload,
    options: Partial<{
      toAgentType: AgentType;
      priority: MessagePriority;
      conversationId: string;
      expiresInMs: number;
    }> = {}
  ): Promise<void> {
    const message = this.createMessage(type, payload, options);

    const channel = options.toAgentType
      ? getAgentTypeChannel(options.toAgentType)
      : BROADCAST_CHANNEL;

    await this.publisher.publish(channel, JSON.stringify(message));
    this.messageCount++;
  }

  /**
   * Send a request and wait for a response
   */
  async request(
    toAgentId: string,
    action: string,
    data?: unknown,
    options: Partial<{
      timeout: number;
      priority: MessagePriority;
      conversationId: string;
    }> = {}
  ): Promise<MessagePayload> {
    const timeout = options.timeout || 30000; // 30 second default timeout
    const correlationId = this.generateId();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error(`Request to agent ${toAgentId} timed out after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      // Send the request
      this.sendMessage(
        toAgentId,
        "request",
        { action, data },
        {
          correlationId,
          priority: options.priority,
          conversationId: options.conversationId,
        }
      ).catch((error) => {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(correlationId);
        reject(error);
      });
    });
  }

  /**
   * Send a response to a request
   */
  async respond(
    toAgentId: string,
    correlationId: string,
    payload: MessagePayload
  ): Promise<void> {
    await this.sendMessage(toAgentId, "response", payload, {
      correlationId,
      priority: "high",
    });
  }

  /**
   * Hand off a task to another agent
   */
  async handoff(
    toAgentId: string,
    taskData: {
      objective: string;
      context: Record<string, unknown>;
      reason: string;
      parentTaskId?: string;
    }
  ): Promise<void> {
    await this.sendMessage(toAgentId, "handoff", {
      action: "accept_handoff",
      data: taskData,
      context: {
        originalAgent: this.agentId,
        originalAgentType: this.agentType,
      },
    }, {
      priority: "high",
      parentTaskId: taskData.parentTaskId,
    });
  }

  /**
   * Request assistance from another agent type
   */
  async requestAssistance(
    targetType: AgentType,
    request: {
      task: string;
      context: Record<string, unknown>;
      urgency: MessagePriority;
    }
  ): Promise<void> {
    await this.broadcast(
      "request",
      {
        action: "assistance_request",
        data: request,
        context: {
          requestingAgent: this.agentId,
          requestingAgentType: this.agentType,
        },
      },
      {
        toAgentType: targetType,
        priority: request.urgency,
      }
    );
  }

  /**
   * Send a status update
   */
  async sendStatusUpdate(status: {
    state: "idle" | "working" | "blocked" | "completed" | "error";
    progress?: number; // 0-100
    currentTask?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    await this.broadcast("status_update", {
      data: {
        ...status,
        agentId: this.agentId,
        agentType: this.agentType,
        timestamp: new Date().toISOString(),
      },
    }, {
      priority: "low",
    });
  }

  /**
   * Send a heartbeat to indicate the agent is alive
   */
  async sendHeartbeat(): Promise<void> {
    await this.broadcast("heartbeat", {
      data: {
        agentId: this.agentId,
        agentType: this.agentType,
        messageCount: this.messageCount,
        timestamp: new Date().toISOString(),
      },
    }, {
      priority: "low",
      expiresInMs: 10000, // Heartbeats expire quickly
    });
  }

  /**
   * Get the current message count
   */
  getMessageCount(): number {
    return this.messageCount;
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }

  // Private methods

  private createMessage(
    type: MessageType,
    payload: MessagePayload,
    options: Partial<{
      toAgentId: string;
      toAgentType: AgentType;
      correlationId: string;
      priority: MessagePriority;
      conversationId: string;
      parentTaskId: string;
      expiresInMs: number;
    }> = {}
  ): AgentMessage {
    return {
      id: this.generateId(),
      type,
      fromAgentId: this.agentId,
      fromAgentType: this.agentType,
      toAgentId: options.toAgentId,
      toAgentType: options.toAgentType,
      correlationId: options.correlationId,
      priority: options.priority || "normal",
      payload,
      metadata: {
        userId: this.userId,
        conversationId: options.conversationId,
        parentTaskId: options.parentTaskId,
      },
      createdAt: new Date(),
      expiresAt: options.expiresInMs
        ? new Date(Date.now() + options.expiresInMs)
        : undefined,
    };
  }

  private async handleIncomingMessage(message: AgentMessage): Promise<void> {
    // Emit for any listeners
    this.emit("message", message);
    this.emit(`message:${message.type}`, message);

    // Handle response to pending request
    if (message.type === "response" && message.correlationId) {
      const pending = this.pendingRequests.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(message.correlationId);

        if (message.payload.error) {
          pending.reject(new Error(message.payload.error.message));
        } else {
          pending.resolve(message.payload);
        }
        return;
      }
    }

    // Call registered handlers
    const handlers = this.handlers.get(message.type) || [];
    for (const handler of handlers) {
      try {
        const response = await handler(message);

        // If handler returns a response and this was a request, send it back
        if (response && message.type === "request" && message.correlationId) {
          await this.respond(
            message.fromAgentId,
            message.correlationId,
            response
          );
        }
      } catch (error) {
        console.error(
          `[AgentMessenger] Handler error for ${message.type}:`,
          error
        );

        // Send error response for requests
        if (message.type === "request" && message.correlationId) {
          await this.respond(message.fromAgentId, message.correlationId, {
            error: {
              code: "HANDLER_ERROR",
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    }
  }

  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Message queue for offline agents
 * Stores messages that couldn't be delivered immediately
 */
export class MessageQueue {
  private redis: Redis;
  private queuePrefix = "moltbot:agent:queue";

  constructor() {
    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }

  /**
   * Queue a message for an offline agent
   */
  async enqueue(agentId: string, message: AgentMessage): Promise<void> {
    const key = `${this.queuePrefix}:${agentId}`;
    await this.redis.rpush(key, JSON.stringify(message));

    // Set expiry based on message expiry or 24 hours default
    const ttl = message.expiresAt
      ? Math.max(0, new Date(message.expiresAt).getTime() - Date.now())
      : 24 * 60 * 60 * 1000;

    await this.redis.pexpire(key, ttl);
  }

  /**
   * Dequeue all pending messages for an agent
   */
  async dequeue(agentId: string): Promise<AgentMessage[]> {
    const key = `${this.queuePrefix}:${agentId}`;
    const messages: AgentMessage[] = [];

    while (true) {
      const data = await this.redis.lpop(key);
      if (!data) break;

      try {
        const message: AgentMessage = JSON.parse(data);

        // Skip expired messages
        if (message.expiresAt && new Date(message.expiresAt) < new Date()) {
          continue;
        }

        messages.push(message);
      } catch (error) {
        console.error("[MessageQueue] Error parsing message:", error);
      }
    }

    return messages;
  }

  /**
   * Get the number of pending messages for an agent
   */
  async getQueueLength(agentId: string): Promise<number> {
    const key = `${this.queuePrefix}:${agentId}`;
    return await this.redis.llen(key);
  }

  /**
   * Clear all pending messages for an agent
   */
  async clear(agentId: string): Promise<void> {
    const key = `${this.queuePrefix}:${agentId}`;
    await this.redis.del(key);
  }

  async disconnect(): Promise<void> {
    this.redis.disconnect();
  }
}

// Create shared message queue instance
export const messageQueue = new MessageQueue();

// Factory function to create a messenger for an agent
export function createMessenger(
  agentId: string,
  agentType: AgentType,
  userId: string
): AgentMessenger {
  return new AgentMessenger(agentId, agentType, userId);
}

export default {
  AgentMessenger,
  MessageQueue,
  messageQueue,
  createMessenger,
};
