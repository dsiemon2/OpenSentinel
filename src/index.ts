import { env } from "./config/env";
import { createBot } from "./inputs/telegram/bot";
import { app } from "./inputs/api/server";
import { startWorker, stopWorker } from "./core/scheduler";
import { DiscordBot } from "./inputs/discord";
import { SlackBot } from "./inputs/slack";
import { WhatsAppBot } from "./inputs/whatsapp";
import { SignalBot } from "./inputs/signal";
import { iMessageBot } from "./inputs/imessage";
import wsHandler from "./inputs/websocket";
import { initMCPRegistry, type MCPRegistry, getMCPToolSummary } from "./core/mcp";
import { setMCPRegistry } from "./tools";

export async function main() {
  console.log(`
╔══════════════════════════════════════════╗
║           OPENSENTINEL v2.0.0            ║
║     Your Personal AI Assistant           ║
╚══════════════════════════════════════════╝
`);

  // Start Telegram bot
  console.log("[Telegram] Starting bot...");
  const bot = createBot();

  // Start scheduler worker
  try {
    startWorker(async (task) => {
      console.log(`[Scheduler] Executing task: ${task.type}`);
      if (task.chatId && task.message) {
        try {
          await bot.api.sendMessage(task.chatId, `⏰ Reminder: ${task.message}`);
        } catch (err) {
          console.error("[Scheduler] Failed to send reminder:", err);
        }
      }
    });
  } catch (err) {
    console.warn("[Scheduler] Could not start worker (Redis may be unavailable):", err);
  }

  bot.start({
    onStart: (botInfo) => {
      console.log(`[Telegram] Bot started as @${botInfo.username}`);
    },
  });

  // Initialize MCP (Model Context Protocol) servers
  let mcpRegistry: MCPRegistry | null = null;
  if (env.MCP_ENABLED) {
    try {
      console.log("[MCP] Initializing MCP servers...");
      mcpRegistry = await initMCPRegistry(env.MCP_CONFIG_PATH);
      setMCPRegistry(mcpRegistry);

      if (mcpRegistry.connectedCount > 0) {
        console.log(`[MCP] Connected to ${mcpRegistry.connectedCount} server(s), ${mcpRegistry.totalToolCount} tools available`);
        console.log(getMCPToolSummary(mcpRegistry));
      } else {
        console.log("[MCP] No servers configured (add servers to mcp.json)");
      }
    } catch (err) {
      console.warn("[MCP] Failed to initialize:", err);
      mcpRegistry = null;
    }
  }

  // Start Discord bot if configured
  let discordBot: DiscordBot | null = null;
  if (env.DISCORD_BOT_TOKEN) {
    console.log("[Discord] Starting bot...");
    try {
      discordBot = new DiscordBot({
        token: env.DISCORD_BOT_TOKEN,
        clientId: env.DISCORD_CLIENT_ID || "",
        guildId: env.DISCORD_GUILD_ID,
        allowedUserIds: env.DISCORD_ALLOWED_USER_IDS?.split(",") || [],
        allowedRoleIds: env.DISCORD_ALLOWED_ROLE_IDS?.split(",") || [],
      });
      await discordBot.start();
      console.log("[Discord] Bot started");
    } catch (err: any) {
      console.warn("[Discord] Failed to start bot:", err.message);
      if (err.message?.includes("disallowed intents") || err.message?.includes("Disallowed")) {
        console.warn("[Discord] ⚠️  Enable Privileged Gateway Intents in Discord Developer Portal:");
        console.warn("[Discord]    1. Go to https://discord.com/developers/applications");
        console.warn("[Discord]    2. Select your bot application");
        console.warn("[Discord]    3. Go to Bot → Privileged Gateway Intents");
        console.warn("[Discord]    4. Enable: Presence Intent, Server Members Intent, Message Content Intent");
        console.warn("[Discord]    5. Save and restart OpenSentinel");
      }
      discordBot = null;
    }
  }

  // Start Slack bot if configured
  let slackBot: SlackBot | null = null;
  if (env.SLACK_BOT_TOKEN && env.SLACK_SIGNING_SECRET) {
    console.log("[Slack] Starting bot...");
    slackBot = new SlackBot({
      token: env.SLACK_BOT_TOKEN,
      signingSecret: env.SLACK_SIGNING_SECRET,
      appToken: env.SLACK_APP_TOKEN,
      socketMode: env.SLACK_SOCKET_MODE === "true",
      port: parseInt(env.SLACK_PORT || "3000"),
      allowedUserIds: env.SLACK_ALLOWED_USER_IDS?.split(",") || [],
      allowedChannelIds: env.SLACK_ALLOWED_CHANNEL_IDS?.split(",") || [],
    });
    await slackBot.start();
    console.log("[Slack] Bot started");
  }

  // Start WhatsApp bot if configured
  let whatsappBot: WhatsAppBot | null = null;
  if (env.WHATSAPP_ENABLED) {
    console.log("[WhatsApp] Starting bot...");
    try {
      whatsappBot = new WhatsAppBot({
        authDir: env.WHATSAPP_AUTH_DIR,
        allowedNumbers: env.WHATSAPP_ALLOWED_NUMBERS?.split(",").filter(Boolean) || [],
        printQR: true,
      });
      await whatsappBot.start();
      console.log("[WhatsApp] Bot started (scan QR code if prompted)");
    } catch (err: any) {
      console.warn("[WhatsApp] Failed to start bot:", err.message);
      whatsappBot = null;
    }
  }

  // Start Signal bot if configured
  let signalBot: SignalBot | null = null;
  if (env.SIGNAL_ENABLED && env.SIGNAL_PHONE_NUMBER) {
    console.log("[Signal] Starting bot...");
    try {
      signalBot = new SignalBot({
        phoneNumber: env.SIGNAL_PHONE_NUMBER,
        signalCliPath: env.SIGNAL_CLI_PATH,
        allowedNumbers: env.SIGNAL_ALLOWED_NUMBERS?.split(",").filter(Boolean) || [],
      });
      await signalBot.start();
      console.log("[Signal] Bot started");
    } catch (err: any) {
      console.warn("[Signal] Failed to start bot:", err.message);
      console.warn("[Signal] Make sure signal-cli is installed and configured");
      signalBot = null;
    }
  }

  // Start iMessage bot if configured (macOS only)
  let imessageBot: iMessageBot | null = null;
  if (env.IMESSAGE_ENABLED) {
    console.log("[iMessage] Starting bot...");
    try {
      imessageBot = new iMessageBot({
        mode: env.IMESSAGE_MODE as "bluebubbles" | "applescript",
        serverUrl: env.IMESSAGE_BLUEBUBBLES_URL,
        password: env.IMESSAGE_BLUEBUBBLES_PASSWORD,
        allowedNumbers: env.IMESSAGE_ALLOWED_NUMBERS?.split(",").filter(Boolean) || [],
      });
      await imessageBot.start();
      console.log("[iMessage] Bot started");
    } catch (err: any) {
      console.warn("[iMessage] Failed to start bot:", err.message);
      if (process.platform !== "darwin") {
        console.warn("[iMessage] iMessage is only available on macOS");
      }
      imessageBot = null;
    }
  }

  // Start API server with WebSocket support
  console.log(`[API] Starting server on port ${env.PORT}...`);
  const server = Bun.serve({
    port: env.PORT,
    fetch: (req, server) => {
      // Handle WebSocket upgrade requests
      if (req.headers.get("upgrade") === "websocket") {
        const result = wsHandler.handleUpgrade(req, server);
        if (result) return result;
        // If handleUpgrade returns undefined, the upgrade was successful
        return undefined as unknown as Response;
      }
      // Handle regular HTTP requests
      return app.fetch(req);
    },
    websocket: wsHandler.handlers,
  });

  console.log(`[API] Server running at http://localhost:${server.port}`);
  console.log(`[WebSocket] Available at ws://localhost:${server.port}/ws`);
  console.log(`[Web] Dashboard available at http://localhost:${server.port}`);
  console.log("");
  const channels = [
    "Telegram",
    discordBot ? "Discord" : null,
    slackBot ? "Slack" : null,
    whatsappBot ? "WhatsApp" : null,
    signalBot ? "Signal" : null,
    imessageBot ? "iMessage" : null,
    "API",
    "WebSocket",
  ].filter(Boolean).join(", ");
  console.log(`OpenSentinel is ready! Send a message via ${channels}.`);

  // Return shutdown function for CLI to wire up
  return async function shutdown() {
    console.log("\nShutting down...");
    stopWorker();
    wsHandler.closeAllConnections();
    if (mcpRegistry) await mcpRegistry.shutdown();
    await bot.stop();
    if (discordBot) await discordBot.stop();
    if (slackBot) await slackBot.stop();
    if (whatsappBot) await whatsappBot.stop();
    if (signalBot) await signalBot.stop();
    if (imessageBot) await imessageBot.stop();
    server.stop();
  };
}
