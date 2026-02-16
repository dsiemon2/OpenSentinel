/**
 * Unified Gateway Types
 *
 * Common message format for all input channels.
 */

export type Platform = "telegram" | "discord" | "slack" | "whatsapp" | "web" | "api";

export interface IncomingMessage {
  platform: Platform;
  userId: string;
  channelId?: string;
  content: string;
  attachments?: Attachment[];
  replyTo?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface OutgoingMessage {
  content: string;
  format?: "text" | "markdown" | "html";
  attachments?: Attachment[];
  replyToMessageId?: string;
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  type: "image" | "file" | "audio" | "video";
  url?: string;
  data?: Buffer;
  mimeType?: string;
  filename?: string;
}

export interface GatewaySession {
  platform: Platform;
  userId: string;
  conversationId?: string;
  startedAt: Date;
  lastActiveAt: Date;
  metadata?: Record<string, unknown>;
}

export interface GatewayStats {
  totalMessages: number;
  messagesByPlatform: Record<string, number>;
  activeSessionCount: number;
  locallyHandled: number;
  apiRouted: number;
}
