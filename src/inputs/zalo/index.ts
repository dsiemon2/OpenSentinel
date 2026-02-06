/**
 * Zalo Integration for OpenSentinel
 * Connects OpenSentinel to Zalo messaging platform via Zalo OA (Official Account) API
 *
 * Zalo is the most popular messaging platform in Vietnam.
 * Uses Zalo OA API v3.0 for sending/receiving messages.
 *
 * Setup:
 * 1. Create a Zalo Official Account at https://oa.zalo.me
 * 2. Get OA ID and access token from Zalo OA dashboard
 * 3. Set webhook URL in Zalo OA settings
 * 4. Configure allowed user IDs for security
 */

import { chatWithTools } from "../../core/brain";
import type { Message } from "../../core/brain";

export interface ZaloConfig {
  oaId: string;
  accessToken: string;
  secretKey?: string;
  webhookPort?: number;
  allowedUserIds?: string[];
}

interface ConversationContext {
  messages: Message[];
  lastActivity: Date;
}

// Zalo API types
interface ZaloWebhookEvent {
  app_id: string;
  oa_id: string;
  event_name: string;
  timestamp: string;
  sender: {
    id: string;
  };
  recipient: {
    id: string;
  };
  message?: {
    msg_id: string;
    text?: string;
    attachments?: Array<{
      type: string;
      payload: {
        url?: string;
        thumbnail?: string;
      };
    }>;
  };
}

interface ZaloSendMessagePayload {
  recipient: { user_id: string };
  message: {
    text?: string;
    attachment?: {
      type: string;
      payload: {
        template_type?: string;
        elements?: unknown[];
        url?: string;
      };
    };
  };
}

export class ZaloBot {
  private config: ZaloConfig;
  private conversations: Map<string, ConversationContext> = new Map();
  private isRunning = false;

  constructor(config: ZaloConfig) {
    this.config = config;
  }

  /**
   * Start the Zalo bot webhook server
   */
  async start(): Promise<void> {
    const port = this.config.webhookPort ?? 8040;

    // Use Hono for the webhook server (consistent with project)
    const { Hono } = await import("hono");
    const { serve } = await import("@hono/node-server");

    const app = new Hono();

    // Webhook verification endpoint
    app.get("/webhook/zalo", (c) => {
      return c.text("OK");
    });

    // Webhook event handler
    app.post("/webhook/zalo", async (c) => {
      try {
        const body = (await c.req.json()) as ZaloWebhookEvent;

        // Verify webhook (optional secret key check)
        if (this.config.secretKey) {
          const mac = c.req.header("X-ZEvent-Signature");
          if (!mac) {
            return c.json({ error: "Missing signature" }, 401);
          }
          // Verify HMAC signature
          const crypto = await import("crypto");
          const expected = crypto
            .createHmac("sha256", this.config.secretKey)
            .update(JSON.stringify(body))
            .digest("hex");
          if (mac !== expected) {
            return c.json({ error: "Invalid signature" }, 401);
          }
        }

        // Handle the event
        await this.handleWebhookEvent(body);
        return c.json({ success: true });
      } catch (error) {
        console.error("[Zalo] Webhook error:", error);
        return c.json({ error: "Internal error" }, 500);
      }
    });

    serve({ fetch: app.fetch, port });
    this.isRunning = true;
    console.log(`[Zalo] Bot webhook server started on port ${port}`);
  }

  /**
   * Handle incoming webhook events
   */
  private async handleWebhookEvent(event: ZaloWebhookEvent): Promise<void> {
    // Only handle user_send_text events
    if (event.event_name !== "user_send_text") {
      console.log(`[Zalo] Ignoring event: ${event.event_name}`);
      return;
    }

    const senderId = event.sender.id;
    const messageText = event.message?.text;

    if (!messageText?.trim()) return;

    // Check if sender is allowed
    if (
      this.config.allowedUserIds &&
      this.config.allowedUserIds.length > 0 &&
      !this.config.allowedUserIds.includes(senderId)
    ) {
      console.log(`[Zalo] Ignoring message from unauthorized user: ${senderId}`);
      return;
    }

    console.log(`[Zalo] Message from ${senderId}: ${messageText.slice(0, 50)}...`);

    // Get or create conversation context
    let context = this.conversations.get(senderId);
    if (!context) {
      context = { messages: [], lastActivity: new Date() };
      this.conversations.set(senderId, context);
    }

    // Add user message to context
    context.messages.push({ role: "user", content: messageText });
    context.lastActivity = new Date();

    // Keep only last 10 messages
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }

    try {
      // Indicate typing
      await this.sendTypingIndicator(senderId);

      // Get AI response
      const response = await chatWithTools(context.messages, senderId);

      // Add assistant response to context
      context.messages.push({ role: "assistant", content: response.content });

      // Send response (split if needed — Zalo has 2000 char limit)
      await this.sendTextMessage(senderId, response.content);

      console.log(`[Zalo] Replied to ${senderId}`);
    } catch (error) {
      console.error("[Zalo] Error processing message:", error);
      await this.sendTextMessage(
        senderId,
        "Sorry, I encountered an error processing your request."
      );
    }
  }

  /**
   * Send a text message via Zalo OA API
   */
  async sendTextMessage(userId: string, text: string): Promise<boolean> {
    try {
      // Zalo has a 2000 character limit per message
      const chunks = this.splitMessage(text, 2000);

      for (const chunk of chunks) {
        const payload: ZaloSendMessagePayload = {
          recipient: { user_id: userId },
          message: { text: chunk },
        };

        const response = await fetch(
          "https://openapi.zalo.me/v3.0/oa/message/cs",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              access_token: this.config.accessToken,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          console.error("[Zalo] Send message failed:", await response.text());
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error("[Zalo] Error sending message:", error);
      return false;
    }
  }

  /**
   * Send typing indicator
   */
  private async sendTypingIndicator(userId: string): Promise<void> {
    try {
      await fetch("https://openapi.zalo.me/v3.0/oa/message/typing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          access_token: this.config.accessToken,
        },
        body: JSON.stringify({
          recipient: { user_id: userId },
        }),
      });
    } catch {
      // Typing indicator failure is non-critical
    }
  }

  /**
   * Send an image message
   */
  async sendImageMessage(userId: string, imageUrl: string): Promise<boolean> {
    try {
      const payload: ZaloSendMessagePayload = {
        recipient: { user_id: userId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "media",
              elements: [
                {
                  media_type: "image",
                  url: imageUrl,
                },
              ],
            },
          },
        },
      };

      const response = await fetch(
        "https://openapi.zalo.me/v3.0/oa/message/cs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            access_token: this.config.accessToken,
          },
          body: JSON.stringify(payload),
        }
      );

      return response.ok;
    } catch (error) {
      console.error("[Zalo] Error sending image:", error);
      return false;
    }
  }

  /**
   * Split a message into chunks respecting word boundaries
   */
  private splitMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Find a good split point (newline, period, space)
      let splitAt = remaining.lastIndexOf("\n", maxLength);
      if (splitAt < maxLength * 0.5) {
        splitAt = remaining.lastIndexOf(". ", maxLength);
      }
      if (splitAt < maxLength * 0.5) {
        splitAt = remaining.lastIndexOf(" ", maxLength);
      }
      if (splitAt < maxLength * 0.3) {
        splitAt = maxLength;
      }

      chunks.push(remaining.slice(0, splitAt + 1).trimEnd());
      remaining = remaining.slice(splitAt + 1).trimStart();
    }

    return chunks;
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    console.log("[Zalo] Bot stopped");
  }

  /**
   * Get bot status
   */
  get running(): boolean {
    return this.isRunning;
  }
}

export default ZaloBot;
