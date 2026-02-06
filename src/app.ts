/**
 * OpenSentinel - Programmatic API
 *
 * Usage:
 *   import { OpenSentinel } from 'opensentinel';
 *
 *   const sentinel = new OpenSentinel({
 *     claudeApiKey: 'sk-ant-...',
 *     env: { DATABASE_URL: 'postgresql://...', TELEGRAM_BOT_TOKEN: '...' },
 *     services: { telegram: true, api: true },
 *   });
 *
 *   await sentinel.start();
 */

import { configure, env, type Env } from "./config/env";
import { chat, chatWithTools, type Message, type BrainResponse } from "./core/brain";

export interface OpenSentinelConfig {
  /** Required: your Claude API key */
  claudeApiKey: string;
  /** All other env vars as optional overrides */
  env?: Partial<Env>;
  /** Which services to start (all default to false except api) */
  services?: {
    telegram?: boolean;
    discord?: boolean;
    slack?: boolean;
    whatsapp?: boolean;
    signal?: boolean;
    imessage?: boolean;
    api?: boolean;
    scheduler?: boolean;
    mcp?: boolean;
    websocket?: boolean;
  };
}

export class OpenSentinel {
  private config: OpenSentinelConfig;
  private _running = false;
  private _services: {
    telegramBot?: any;
    discordBot?: any;
    slackBot?: any;
    whatsappBot?: any;
    signalBot?: any;
    imessageBot?: any;
    mcpRegistry?: any;
    server?: any;
  } = {};

  constructor(config: OpenSentinelConfig) {
    this.config = config;

    // Configure the env singleton
    configure({
      CLAUDE_API_KEY: config.claudeApiKey,
      ...(config.env || {}),
    } as Partial<Env> & { CLAUDE_API_KEY: string });
  }

  async start(): Promise<void> {
    if (this._running) return;

    const services = this.config.services || {};

    // Start Telegram bot
    if (services.telegram && env.TELEGRAM_BOT_TOKEN) {
      const { createBot } = await import("./inputs/telegram/bot");
      this._services.telegramBot = createBot();
      this._services.telegramBot.start({
        onStart: (botInfo: any) => {
          console.log(`[Telegram] Bot started as @${botInfo.username}`);
        },
      });
    }

    // Start scheduler
    if (services.scheduler) {
      try {
        const { startWorker } = await import("./core/scheduler");
        startWorker(async (task: any) => {
          console.log(`[Scheduler] Executing task: ${task.type}`);
          if (task.chatId && task.message && this._services.telegramBot) {
            try {
              await this._services.telegramBot.api.sendMessage(
                task.chatId,
                `Reminder: ${task.message}`
              );
            } catch (err) {
              console.error("[Scheduler] Failed to send reminder:", err);
            }
          }
        });
      } catch (err) {
        console.warn("[Scheduler] Could not start worker:", err);
      }
    }

    // Initialize MCP
    if (services.mcp !== false && env.MCP_ENABLED) {
      try {
        const { initMCPRegistry, getMCPToolSummary } = await import("./core/mcp");
        const { setMCPRegistry } = await import("./tools");
        this._services.mcpRegistry = await initMCPRegistry(env.MCP_CONFIG_PATH);
        setMCPRegistry(this._services.mcpRegistry);

        if (this._services.mcpRegistry.connectedCount > 0) {
          console.log(
            `[MCP] Connected to ${this._services.mcpRegistry.connectedCount} server(s), ${this._services.mcpRegistry.totalToolCount} tools available`
          );
          console.log(getMCPToolSummary(this._services.mcpRegistry));
        }
      } catch (err) {
        console.warn("[MCP] Failed to initialize:", err);
        this._services.mcpRegistry = null;
      }
    }

    // Start Discord bot
    if (services.discord && env.DISCORD_BOT_TOKEN) {
      try {
        const { DiscordBot } = await import("./inputs/discord");
        this._services.discordBot = new DiscordBot({
          token: env.DISCORD_BOT_TOKEN,
          clientId: env.DISCORD_CLIENT_ID || "",
          guildId: env.DISCORD_GUILD_ID,
          allowedUserIds: env.DISCORD_ALLOWED_USER_IDS?.split(",") || [],
          allowedRoleIds: env.DISCORD_ALLOWED_ROLE_IDS?.split(",") || [],
        });
        await this._services.discordBot.start();
        console.log("[Discord] Bot started");
      } catch (err: any) {
        console.warn("[Discord] Failed to start bot:", err.message);
        this._services.discordBot = null;
      }
    }

    // Start Slack bot
    if (services.slack && env.SLACK_BOT_TOKEN && env.SLACK_SIGNING_SECRET) {
      try {
        const { SlackBot } = await import("./inputs/slack");
        this._services.slackBot = new SlackBot({
          token: env.SLACK_BOT_TOKEN,
          signingSecret: env.SLACK_SIGNING_SECRET,
          appToken: env.SLACK_APP_TOKEN,
          socketMode: env.SLACK_SOCKET_MODE,
          port: parseInt(String(env.SLACK_PORT) || "3000"),
          allowedUserIds: env.SLACK_ALLOWED_USER_IDS?.split(",") || [],
          allowedChannelIds: env.SLACK_ALLOWED_CHANNEL_IDS?.split(",") || [],
        });
        await this._services.slackBot.start();
        console.log("[Slack] Bot started");
      } catch (err: any) {
        console.warn("[Slack] Failed to start bot:", err.message);
        this._services.slackBot = null;
      }
    }

    // Start WhatsApp bot
    if (services.whatsapp && env.WHATSAPP_ENABLED) {
      try {
        const { WhatsAppBot } = await import("./inputs/whatsapp");
        this._services.whatsappBot = new WhatsAppBot({
          authDir: env.WHATSAPP_AUTH_DIR,
          allowedNumbers:
            env.WHATSAPP_ALLOWED_NUMBERS?.split(",").filter(Boolean) || [],
          printQR: true,
        });
        await this._services.whatsappBot.start();
        console.log("[WhatsApp] Bot started");
      } catch (err: any) {
        console.warn("[WhatsApp] Failed to start bot:", err.message);
        this._services.whatsappBot = null;
      }
    }

    // Start Signal bot
    if (services.signal && env.SIGNAL_ENABLED && env.SIGNAL_PHONE_NUMBER) {
      try {
        const { SignalBot } = await import("./inputs/signal");
        this._services.signalBot = new SignalBot({
          phoneNumber: env.SIGNAL_PHONE_NUMBER,
          signalCliPath: env.SIGNAL_CLI_PATH,
          allowedNumbers:
            env.SIGNAL_ALLOWED_NUMBERS?.split(",").filter(Boolean) || [],
        });
        await this._services.signalBot.start();
        console.log("[Signal] Bot started");
      } catch (err: any) {
        console.warn("[Signal] Failed to start bot:", err.message);
        this._services.signalBot = null;
      }
    }

    // Start iMessage bot
    if (services.imessage && env.IMESSAGE_ENABLED) {
      try {
        const { iMessageBot } = await import("./inputs/imessage");
        this._services.imessageBot = new iMessageBot({
          mode: env.IMESSAGE_MODE as "bluebubbles" | "applescript",
          serverUrl: env.IMESSAGE_BLUEBUBBLES_URL,
          password: env.IMESSAGE_BLUEBUBBLES_PASSWORD,
          allowedNumbers:
            env.IMESSAGE_ALLOWED_NUMBERS?.split(",").filter(Boolean) || [],
        });
        await this._services.imessageBot.start();
        console.log("[iMessage] Bot started");
      } catch (err: any) {
        console.warn("[iMessage] Failed to start bot:", err.message);
        this._services.imessageBot = null;
      }
    }

    this._running = true;
  }

  async stop(): Promise<void> {
    if (!this._running) return;

    console.log("Shutting down OpenSentinel...");

    const { stopWorker } = await import("./core/scheduler");
    stopWorker();

    if (this._services.mcpRegistry) {
      await this._services.mcpRegistry.shutdown();
    }
    if (this._services.telegramBot) {
      await this._services.telegramBot.stop();
    }
    if (this._services.discordBot) {
      await this._services.discordBot.stop();
    }
    if (this._services.slackBot) {
      await this._services.slackBot.stop();
    }
    if (this._services.whatsappBot) {
      await this._services.whatsappBot.stop();
    }
    if (this._services.signalBot) {
      await this._services.signalBot.stop();
    }
    if (this._services.imessageBot) {
      await this._services.imessageBot.stop();
    }
    if (this._services.server) {
      this._services.server.stop();
    }

    this._running = false;
    console.log("OpenSentinel stopped.");
  }

  /** Send a simple chat message (no tools) */
  async chat(
    messages: Message[],
    systemPrompt?: string
  ): Promise<BrainResponse> {
    return chat(messages, systemPrompt);
  }

  /** Send a chat message with tool execution */
  async chatWithTools(
    messages: Message[],
    userId?: string,
    onToolUse?: (toolName: string, input: unknown) => void
  ): Promise<BrainResponse> {
    return chatWithTools(messages, userId, onToolUse);
  }

  get running(): boolean {
    return this._running;
  }

  get services() {
    return { ...this._services };
  }
}
