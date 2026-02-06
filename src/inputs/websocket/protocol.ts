/**
 * WebSocket Protocol - Message types for real-time streaming
 * OpenSentinel WebSocket API
 */

import type { Message } from "../../core/brain";

// ============================================
// CLIENT → SERVER MESSAGES
// ============================================

export type WSClientMessageType = "chat" | "chat_with_tools" | "ping" | "cancel";

export interface WSClientMessage {
  type: WSClientMessageType;
  id: string;
  payload: WSClientPayload;
}

export interface WSClientPayload {
  messages?: Message[];
  userId?: string;
  systemPrompt?: string;
}

// ============================================
// SERVER → CLIENT MESSAGES
// ============================================

export type WSServerMessageType =
  | "chunk"
  | "tool_start"
  | "tool_result"
  | "complete"
  | "error"
  | "pong"
  | "connected";

export interface WSServerMessage {
  type: WSServerMessageType;
  id: string;
  payload: WSServerPayload;
}

export interface WSServerPayload {
  // For chunk events
  text?: string;

  // For tool events
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;

  // For complete events
  content?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  toolsUsed?: string[];

  // For error events
  error?: string;
  code?: string;

  // For connected events
  message?: string;
}

// ============================================
// STREAM EVENTS (internal)
// ============================================

export type StreamEventType = "chunk" | "tool_start" | "tool_result" | "complete" | "error";

export interface StreamEvent {
  type: StreamEventType;
  data: {
    text?: string;
    toolName?: string;
    toolInput?: unknown;
    toolResult?: unknown;
    content?: string;
    inputTokens?: number;
    outputTokens?: number;
    toolsUsed?: string[];
    error?: string;
  };
}

// ============================================
// CONNECTION STATE
// ============================================

export interface ConnectionState {
  id: string;
  userId?: string;
  connectedAt: Date;
  lastActivity: Date;
  activeRequests: Map<string, AbortController>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function createServerMessage(
  type: WSServerMessageType,
  id: string,
  payload: Partial<WSServerPayload> = {}
): string {
  const message: WSServerMessage = { type, id, payload };
  return JSON.stringify(message);
}

export function parseClientMessage(data: string): WSClientMessage | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed.type || !parsed.id) {
      return null;
    }
    return parsed as WSClientMessage;
  } catch {
    return null;
  }
}

export function isValidClientMessage(msg: unknown): msg is WSClientMessage {
  if (!msg || typeof msg !== "object") return false;
  const m = msg as Record<string, unknown>;
  return (
    typeof m.type === "string" &&
    typeof m.id === "string" &&
    ["chat", "chat_with_tools", "ping", "cancel"].includes(m.type)
  );
}
