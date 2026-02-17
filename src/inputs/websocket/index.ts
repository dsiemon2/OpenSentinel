/**
 * WebSocket Handler - Real-time streaming for OpenSentinel
 */

// Generic WebSocket interface compatible with Bun's ServerWebSocket
interface ServerWebSocket<T = unknown> {
  send(data: string | Buffer): void;
  close(code?: number, reason?: string): void;
  data: T;
}
import { nanoid } from "nanoid";
import { getGatewayToken, timingSafeEqual } from "../../core/security/gateway-utils";
import {
  type WSClientMessage,
  type ConnectionState,
  createServerMessage,
  parseClientMessage,
  isValidClientMessage,
} from "./protocol";
import { chat, streamChat, chatWithTools, streamChatWithTools } from "../../core/brain";
import type { Message } from "../../core/brain";

// ============================================
// CONNECTION MANAGEMENT
// ============================================

const connections = new Map<ServerWebSocket<ConnectionState>, ConnectionState>();

function createConnectionState(): ConnectionState {
  return {
    id: nanoid(),
    connectedAt: new Date(),
    lastActivity: new Date(),
    activeRequests: new Map(),
  };
}

// ============================================
// MESSAGE HANDLERS
// ============================================

async function handleChat(
  ws: ServerWebSocket<ConnectionState>,
  msg: WSClientMessage
): Promise<void> {
  const { id, payload } = msg;
  const messages = payload.messages || [];

  if (messages.length === 0) {
    ws.send(createServerMessage("error", id, { error: "No messages provided" }));
    return;
  }

  try {
    // Use streaming for real-time response
    let fullContent = "";

    await streamChat(
      messages,
      payload.systemPrompt,
      (chunk) => {
        fullContent += chunk;
        ws.send(createServerMessage("chunk", id, { text: chunk }));
      }
    );

    ws.send(createServerMessage("complete", id, { content: fullContent }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    ws.send(createServerMessage("error", id, { error: errorMessage }));
  }
}

async function handleChatWithTools(
  ws: ServerWebSocket<ConnectionState>,
  msg: WSClientMessage
): Promise<void> {
  const { id, payload } = msg;
  const messages = payload.messages || [];

  if (messages.length === 0) {
    ws.send(createServerMessage("error", id, { error: "No messages provided" }));
    return;
  }

  try {
    // Use streaming generator for real-time events
    const stream = streamChatWithTools(messages, payload.userId);

    for await (const event of stream) {
      switch (event.type) {
        case "chunk":
          ws.send(createServerMessage("chunk", id, { text: event.data.text }));
          break;
        case "tool_start":
          ws.send(createServerMessage("tool_start", id, {
            toolName: event.data.toolName,
            toolInput: event.data.toolInput,
          }));
          break;
        case "tool_result":
          ws.send(createServerMessage("tool_result", id, {
            toolName: event.data.toolName,
            toolResult: event.data.toolResult,
          }));
          break;
        case "complete":
          ws.send(createServerMessage("complete", id, {
            content: event.data.content,
            usage: {
              inputTokens: event.data.inputTokens || 0,
              outputTokens: event.data.outputTokens || 0,
            },
            toolsUsed: event.data.toolsUsed,
          }));
          break;
        case "error":
          ws.send(createServerMessage("error", id, { error: event.data.error }));
          break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    ws.send(createServerMessage("error", id, { error: errorMessage }));
  }
}

function handlePing(ws: ServerWebSocket<ConnectionState>, msg: WSClientMessage): void {
  ws.send(createServerMessage("pong", msg.id, {}));
}

function handleCancel(ws: ServerWebSocket<ConnectionState>, msg: WSClientMessage): void {
  const state = connections.get(ws);
  if (state) {
    const controller = state.activeRequests.get(msg.id);
    if (controller) {
      controller.abort();
      state.activeRequests.delete(msg.id);
      ws.send(createServerMessage("complete", msg.id, { content: "Request cancelled" }));
    }
  }
}

// ============================================
// WEBSOCKET HANDLERS
// ============================================

export const websocketHandlers = {
  open(ws: ServerWebSocket<ConnectionState>) {
    const state = createConnectionState();
    connections.set(ws, state);
    console.log(`[WebSocket] Client connected: ${state.id}`);
    ws.send(createServerMessage("connected", "system", { message: "Connected to OpenSentinel" }));
  },

  close(ws: ServerWebSocket<ConnectionState>, code: number, reason: string) {
    const state = connections.get(ws);
    if (state) {
      // Cancel any active requests
      for (const controller of state.activeRequests.values()) {
        controller.abort();
      }
      console.log(`[WebSocket] Client disconnected: ${state.id} (${code}: ${reason})`);
    }
    connections.delete(ws);
  },

  async message(ws: ServerWebSocket<ConnectionState>, message: string | Buffer) {
    const state = connections.get(ws);
    if (state) {
      state.lastActivity = new Date();
    }

    const data = typeof message === "string" ? message : message.toString();
    const msg = parseClientMessage(data);

    if (!msg || !isValidClientMessage(msg)) {
      ws.send(createServerMessage("error", "unknown", { error: "Invalid message format" }));
      return;
    }

    console.log(`[WebSocket] Received: ${msg.type} (${msg.id})`);

    switch (msg.type) {
      case "chat":
        await handleChat(ws, msg);
        break;
      case "chat_with_tools":
        await handleChatWithTools(ws, msg);
        break;
      case "ping":
        handlePing(ws, msg);
        break;
      case "cancel":
        handleCancel(ws, msg);
        break;
      default:
        ws.send(createServerMessage("error", msg.id, { error: `Unknown message type: ${msg.type}` }));
    }
  },

  drain(ws: ServerWebSocket<ConnectionState>) {
    // Called when the socket is ready to receive more data after backpressure
    console.log("[WebSocket] Socket drained, ready for more data");
  },
};

// ============================================
// UPGRADE HANDLER
// ============================================

export function handleUpgrade(
  req: Request,
  server: { upgrade: (req: Request, options?: { data?: ConnectionState }) => boolean }
): Response | undefined {
  const url = new URL(req.url);

  // Only handle /ws path
  if (url.pathname !== "/ws") {
    return undefined;
  }

  // Gateway token auth for WebSocket connections
  const gwToken = getGatewayToken();
  if (gwToken) {
    const tokenParam = url.searchParams.get("token");
    const authHeader = req.headers.get("Authorization");
    const headerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const providedToken = tokenParam || headerToken;

    if (!providedToken || !timingSafeEqual(providedToken, gwToken)) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const state = createConnectionState();
  const success = server.upgrade(req, { data: state });

  if (success) {
    return undefined; // Upgrade successful, Bun handles the response
  }

  return new Response("WebSocket upgrade failed", { status: 500 });
}

// ============================================
// UTILITIES
// ============================================

export function getConnectionCount(): number {
  return connections.size;
}

export function broadcastMessage(message: string): void {
  for (const ws of connections.keys()) {
    ws.send(message);
  }
}

export function closeAllConnections(): void {
  for (const ws of connections.keys()) {
    ws.close(1000, "Server shutting down");
  }
  connections.clear();
}

export default {
  handlers: websocketHandlers,
  handleUpgrade,
  getConnectionCount,
  broadcastMessage,
  closeAllConnections,
};
