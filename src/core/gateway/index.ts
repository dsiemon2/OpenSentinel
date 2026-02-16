/**
 * Unified Gateway — Normalized message processing pipeline
 *
 * All input channels (Telegram, Discord, Slack, WhatsApp, Web, API)
 * can route messages through this gateway for consistent processing.
 */

import type { IncomingMessage, OutgoingMessage, GatewayStats, Platform } from "./types";
import { intentParser } from "../brain/intent-parser";
import { hookManager } from "../hooks";

export class Gateway {
  private enabled: boolean;
  private stats: GatewayStats = {
    totalMessages: 0,
    messagesByPlatform: {},
    activeSessionCount: 0,
    locallyHandled: 0,
    apiRouted: 0,
  };

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /**
   * Process an incoming message through the unified pipeline
   */
  async processMessage(incoming: IncomingMessage): Promise<OutgoingMessage> {
    this.stats.totalMessages++;
    this.stats.messagesByPlatform[incoming.platform] =
      (this.stats.messagesByPlatform[incoming.platform] || 0) + 1;

    // Step 1: Check intent parser for local handling
    const intent = intentParser.parseIntent(incoming.content);
    if (intent?.handled && intent.response) {
      this.stats.locallyHandled++;
      console.log(`[Gateway] Locally handled: ${intent.intent} (${incoming.platform})`);
      return {
        content: intent.response,
        format: "text",
      };
    }

    // Step 2: Run through hooks (message:process before)
    const hookContext = await hookManager.run("message:process", "before", {
      content: incoming.content,
      platform: incoming.platform,
      userId: incoming.userId,
    }, incoming.userId);

    if (hookContext.cancelled) {
      return {
        content: hookContext.cancelReason || "Message processing was cancelled.",
        format: "text",
      };
    }

    // Step 3: Route to AI (caller handles the actual API call)
    this.stats.apiRouted++;

    return {
      content: "", // Caller fills this via chatWithTools()
      format: "markdown",
      metadata: {
        needsApiCall: true,
        userId: incoming.userId,
        platform: incoming.platform,
      },
    };
  }

  /**
   * Normalize a platform-specific message to IncomingMessage format
   */
  normalize(
    platform: Platform,
    userId: string,
    content: string,
    extra?: Partial<IncomingMessage>
  ): IncomingMessage {
    return {
      platform,
      userId,
      content,
      timestamp: new Date(),
      ...extra,
    };
  }

  /**
   * Get gateway statistics
   */
  getStats(): GatewayStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      messagesByPlatform: {},
      activeSessionCount: 0,
      locallyHandled: 0,
      apiRouted: 0,
    };
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

export const gateway = new Gateway();
export type { IncomingMessage, OutgoingMessage, GatewayStats, Platform, GatewaySession, Attachment } from "./types";
