// Use require-style for CJS/ESM compat
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { App, ExpressReceiver } = require("@slack/bolt") as {
  App: typeof import("@slack/bolt").App;
  ExpressReceiver: typeof import("@slack/bolt").ExpressReceiver;
};
const { WebClient } = require("@slack/web-api") as {
  WebClient: typeof import("@slack/web-api").WebClient;
};
type SlackEventMiddlewareArgs<T extends string> = any;
type AllMiddlewareArgs = any;
type MessageEvent = any;
type AppMentionEvent = any;
type GenericMessageEvent = any;
type FileSharedEvent = any;
type ChatPostMessageResponse = any;
import { chatWithTools, type Message } from "../../core/brain";
import { transcribeAudio } from "../../outputs/stt";
import {
  slashCommands,
  getSession,
  addToSession,
  splitMessage,
  formatAsBlocks,
} from "./commands";

/**
 * Slack bot configuration
 */
export interface SlackBotConfig {
  token: string; // Bot OAuth token (xoxb-...)
  signingSecret: string; // Slack signing secret
  appToken?: string; // App-level token for Socket Mode (xapp-...)
  socketMode?: boolean; // Use Socket Mode instead of HTTP
  port?: number; // Port for HTTP receiver (default: 3000)
  allowedUserIds?: string[]; // Optional: restrict to specific users
  allowedChannelIds?: string[]; // Optional: restrict to specific channels
  allowDMs?: boolean; // Allow direct messages (default: true)
  allowMentions?: boolean; // Allow @mentions (default: true)
  allowThreadReplies?: boolean; // Allow thread replies (default: true)
}

/**
 * Slack bot session data
 */
export interface SlackSessionData {
  messages: Message[];
  lastActivity: Date;
  threadTs?: string; // Track thread timestamp for threaded conversations
}

/**
 * Extended message type for thread support
 */
interface ThreadedMessage extends GenericMessageEvent {
  thread_ts?: string;
  parent_user_id?: string;
}

/**
 * Slack bot class
 */
export class SlackBot {
  private app: InstanceType<typeof App>;
  private config: SlackBotConfig;
  private client: InstanceType<typeof WebClient>;
  private receiver: InstanceType<typeof ExpressReceiver> | undefined;
  private isRunning: boolean = false;

  constructor(config: SlackBotConfig) {
    this.config = {
      allowDMs: true,
      allowMentions: true,
      allowThreadReplies: true,
      ...config,
    };

    // Create receiver for HTTP mode
    if (!config.socketMode) {
      this.receiver = new ExpressReceiver({
        signingSecret: config.signingSecret,
      });
    }

    // Initialize Slack app
    this.app = new App({
      token: config.token,
      signingSecret: config.signingSecret,
      socketMode: config.socketMode,
      appToken: config.appToken,
      receiver: this.receiver,
    });

    this.client = new WebClient(config.token);

    this.setupEventHandlers();
    this.setupSlashCommands();
  }

  /**
   * Set up Slack event handlers
   */
  private setupEventHandlers(): void {
    // App mention handler (when someone @mentions the bot)
    if (this.config.allowMentions) {
      this.app.event("app_mention", async (args: any) => {
        await this.handleAppMention(args);
      });
    }

    // Direct message handler
    if (this.config.allowDMs) {
      this.app.message(async (args: any) => {
        await this.handleMessage(args);
      });
    }

    // File shared event handler
    this.app.event("file_shared", async (args: any) => {
      await this.handleFileShared(args);
    });

    // Error handler
    this.app.error(async (error: any) => {
      console.error("[Slack] App error:", error);
    });
  }

  /**
   * Set up slash command handlers
   */
  private setupSlashCommands(): void {
    for (const cmd of slashCommands) {
      this.app.command(cmd.command, async (args: any) => {
        // Check authorization
        if (!this.isUserAuthorized(args.command.user_id, args.command.channel_id)) {
          await args.ack();
          await args.respond({
            response_type: "ephemeral",
            text: "You are not authorized to use this bot.",
          });
          return;
        }

        await cmd.handler(args);
      });
    }
  }

  /**
   * Handle app mentions
   */
  private async handleAppMention(
    args: SlackEventMiddlewareArgs<"app_mention"> & AllMiddlewareArgs
  ): Promise<void> {
    const { event, say, client } = args;

    // Check authorization
    if (!this.isUserAuthorized(event.user as string, event.channel as string)) {
      return;
    }

    // Remove the bot mention from the text
    const text = (event.text as string).replace(/<@[A-Z0-9]+>/gi, "").trim();
    if (!text) {
      await say({
        text: "Hi! How can I help you? Mention me with a question or use `/sentinel help` for available commands.",
        thread_ts: event.thread_ts || event.ts,
      });
      return;
    }

    const userId = event.user as string;
    const sessionKey = event.thread_ts
      ? `${userId}:thread:${event.thread_ts}`
      : userId;

    try {
      // Show typing indicator
      // Note: Slack doesn't have a native typing indicator API like Discord
      // We use a reaction to show we're processing
      await client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: "hourglass_flowing_sand",
      });

      addToSession(sessionKey, { role: "user", content: text });

      const response = await chatWithTools(
        getSession(sessionKey),
        `slack:${userId}`
      );

      addToSession(sessionKey, { role: "assistant", content: response.content });

      // Build response with tool usage info
      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `_Used: ${toolList}_\n\n${response.content}`;
      }

      // Remove processing indicator
      try {
        await client.reactions.remove({
          channel: event.channel,
          timestamp: event.ts,
          name: "hourglass_flowing_sand",
        });
      } catch {
        // Ignore if reaction was already removed
      }

      // Send response in thread
      if (finalResponse.length > 3000) {
        const chunks = splitMessage(finalResponse, 3000);
        for (const chunk of chunks) {
          await say({
            text: chunk,
            thread_ts: event.thread_ts || event.ts,
            mrkdwn: true,
          });
        }
      } else {
        await say({
          text: finalResponse,
          thread_ts: event.thread_ts || event.ts,
          mrkdwn: true,
        });
      }

      console.log(
        `[Slack] Processed mention from ${userId}. Tokens: ${response.inputTokens}/${response.outputTokens}` +
          (response.toolsUsed ? ` Tools: ${response.toolsUsed.join(", ")}` : "")
      );
    } catch (error) {
      console.error("[Slack] Error processing mention:", error);

      // Remove processing indicator on error
      try {
        await client.reactions.remove({
          channel: event.channel,
          timestamp: event.ts,
          name: "hourglass_flowing_sand",
        });
        await client.reactions.add({
          channel: event.channel,
          timestamp: event.ts,
          name: "x",
        });
      } catch {
        // Ignore reaction errors
      }

      await say({
        text: "Sorry, I encountered an error processing your message. Please try again.",
        thread_ts: event.thread_ts || event.ts,
      });
    }
  }

  /**
   * Handle direct messages
   */
  private async handleMessage(
    args: SlackEventMiddlewareArgs<"message"> & AllMiddlewareArgs
  ): Promise<void> {
    const { event, say, client, message } = args;

    // Skip bot messages and subtypes (edits, deletes, etc.)
    const genericMessage = message as GenericMessageEvent;
    if (genericMessage.subtype) return;
    if ("bot_id" in event) return;

    // Only handle DMs (im) and group DMs (mpim)
    const channelType = (event as any).channel_type;
    if (channelType !== "im" && channelType !== "mpim") return;

    const userId = (message as GenericMessageEvent).user;
    if (!userId) return;

    // Check authorization
    if (!this.isUserAuthorized(userId, event.channel as string)) {
      return;
    }

    const text = (message as GenericMessageEvent).text || "";
    if (!text.trim()) return;

    const threadedMessage = message as ThreadedMessage;
    const sessionKey = threadedMessage.thread_ts
      ? `${userId}:thread:${threadedMessage.thread_ts}`
      : userId;

    try {
      // Show processing reaction
      await client.reactions.add({
        channel: event.channel,
        timestamp: (message as GenericMessageEvent).ts,
        name: "hourglass_flowing_sand",
      });

      addToSession(sessionKey, { role: "user", content: text });

      const response = await chatWithTools(
        getSession(sessionKey),
        `slack:${userId}`
      );

      addToSession(sessionKey, { role: "assistant", content: response.content });

      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `_Used: ${toolList}_\n\n${response.content}`;
      }

      // Remove processing indicator
      try {
        await client.reactions.remove({
          channel: event.channel,
          timestamp: (message as GenericMessageEvent).ts,
          name: "hourglass_flowing_sand",
        });
      } catch {
        // Ignore if reaction was already removed
      }

      // Send response (in thread if it's a threaded message)
      const replyTs =
        this.config.allowThreadReplies && threadedMessage.thread_ts
          ? threadedMessage.thread_ts
          : undefined;

      if (finalResponse.length > 3000) {
        const chunks = splitMessage(finalResponse, 3000);
        for (const chunk of chunks) {
          await say({
            text: chunk,
            thread_ts: replyTs,
            mrkdwn: true,
          });
        }
      } else {
        await say({
          text: finalResponse,
          thread_ts: replyTs,
          mrkdwn: true,
        });
      }

      console.log(
        `[Slack] Processed DM from ${userId}. Tokens: ${response.inputTokens}/${response.outputTokens}` +
          (response.toolsUsed ? ` Tools: ${response.toolsUsed.join(", ")}` : "")
      );
    } catch (error) {
      console.error("[Slack] Error processing message:", error);

      try {
        await client.reactions.remove({
          channel: event.channel,
          timestamp: (message as GenericMessageEvent).ts,
          name: "hourglass_flowing_sand",
        });
        await client.reactions.add({
          channel: event.channel,
          timestamp: (message as GenericMessageEvent).ts,
          name: "x",
        });
      } catch {
        // Ignore reaction errors
      }

      await say({
        text: "Sorry, I encountered an error processing your message. Please try again.",
      });
    }
  }

  /**
   * Handle file shared events
   */
  private async handleFileShared(
    args: SlackEventMiddlewareArgs<"file_shared"> & AllMiddlewareArgs
  ): Promise<void> {
    const { event, client } = args;

    try {
      // Get file info
      const fileInfo = await client.files.info({ file: event.file_id });
      const file = fileInfo.file;

      if (!file) return;

      // Check if it's an audio file
      const mimetype = file.mimetype || "";
      if (mimetype.startsWith("audio/")) {
        // Download and transcribe
        if (file.url_private_download) {
          const response = await fetch(file.url_private_download, {
            headers: {
              Authorization: `Bearer ${this.config.token}`,
            },
          });

          if (response.ok) {
            const audioBuffer = await response.arrayBuffer();
            const transcription = await transcribeAudio(Buffer.from(audioBuffer));

            if (transcription) {
              // Post transcription as a reply
              const channelId = (file.channels && file.channels[0]) || (file.ims && file.ims[0]);
              if (channelId) {
                await client.chat.postMessage({
                  channel: channelId,
                  text: `Audio transcription: "${transcription}"`,
                  mrkdwn: true,
                });

                console.log(
                  `[Slack] Transcribed audio file: ${file.name}`
                );
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[Slack] Error processing file:", error);
    }
  }

  /**
   * Check if a user is authorized to use the bot
   */
  private isUserAuthorized(userId: string, channelId: string): boolean {
    // If no restrictions, allow everyone
    if (
      !this.config.allowedUserIds?.length &&
      !this.config.allowedChannelIds?.length
    ) {
      return true;
    }

    // Check user ID allowlist
    if (this.config.allowedUserIds?.includes(userId)) {
      return true;
    }

    // Check channel ID allowlist
    if (this.config.allowedChannelIds?.includes(channelId)) {
      return true;
    }

    return false;
  }

  /**
   * Start the Slack bot
   */
  async start(): Promise<void> {
    const port = this.config.port || 3000;

    console.log("[Slack] Starting bot...");

    await this.app.start(port);
    this.isRunning = true;

    if (this.config.socketMode) {
      console.log("[Slack] Bot started in Socket Mode");
    } else {
      console.log(`[Slack] Bot started on port ${port}`);
    }
  }

  /**
   * Stop the Slack bot
   */
  async stop(): Promise<void> {
    console.log("[Slack] Stopping bot...");

    await this.app.stop();
    this.isRunning = false;

    console.log("[Slack] Bot stopped");
  }

  /**
   * Get the Slack app instance
   */
  getApp(): InstanceType<typeof App> {
    return this.app;
  }

  /**
   * Get the Slack Web API client
   */
  getClient(): InstanceType<typeof WebClient> {
    return this.client;
  }

  /**
   * Check if bot is running
   */
  running(): boolean {
    return this.isRunning;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(
    channelId: string,
    text: string,
    options?: {
      threadTs?: string;
      mrkdwn?: boolean;
      blocks?: object[];
    }
  ): Promise<ChatPostMessageResponse> {
    return this.client.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: options?.threadTs,
      mrkdwn: options?.mrkdwn ?? true,
      blocks: options?.blocks as any,
    });
  }

  /**
   * Send a message with blocks
   */
  async sendBlocks(
    channelId: string,
    blocks: object[],
    text?: string,
    threadTs?: string
  ): Promise<ChatPostMessageResponse> {
    return this.client.chat.postMessage({
      channel: channelId,
      text: text || "Message",
      blocks: blocks as any,
      thread_ts: threadTs,
    });
  }

  /**
   * Send a file to a channel
   */
  async sendFile(
    channelId: string,
    content: Buffer | string,
    filename: string,
    options?: {
      title?: string;
      initialComment?: string;
      threadTs?: string;
    }
  ): Promise<void> {
    await this.client.files.uploadV2({
      channel_id: channelId,
      file: content,
      filename,
      title: options?.title,
      initial_comment: options?.initialComment,
      thread_ts: options?.threadTs,
    } as any);
  }

  /**
   * Reply to a thread
   */
  async replyToThread(
    channelId: string,
    threadTs: string,
    text: string,
    mrkdwn?: boolean
  ): Promise<ChatPostMessageResponse> {
    return this.client.chat.postMessage({
      channel: channelId,
      text,
      thread_ts: threadTs,
      mrkdwn: mrkdwn ?? true,
    });
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(
    channelId: string,
    timestamp: string,
    emoji: string
  ): Promise<void> {
    await this.client.reactions.add({
      channel: channelId,
      timestamp,
      name: emoji,
    });
  }

  /**
   * Remove a reaction from a message
   */
  async removeReaction(
    channelId: string,
    timestamp: string,
    emoji: string
  ): Promise<void> {
    await this.client.reactions.remove({
      channel: channelId,
      timestamp,
      name: emoji,
    });
  }

  /**
   * Get user info
   */
  async getUserInfo(userId: string): Promise<object | undefined> {
    const result = await this.client.users.info({ user: userId });
    return result.user;
  }

  /**
   * Get channel info
   */
  async getChannelInfo(channelId: string): Promise<object | undefined> {
    const result = await this.client.conversations.info({ channel: channelId });
    return result.channel;
  }

  /**
   * Get the Express receiver (for adding custom routes)
   */
  getReceiver(): InstanceType<typeof ExpressReceiver> | undefined {
    return this.receiver;
  }
}

/**
 * Create and configure Slack bot
 */
export function createSlackBot(config: SlackBotConfig): SlackBot {
  return new SlackBot(config);
}

/**
 * Export commands module
 */
export * from "./commands";

/**
 * Default export
 */
export default {
  createSlackBot,
  SlackBot,
  slashCommands,
};
