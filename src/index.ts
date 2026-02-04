import { env } from "./config/env";
import { createBot } from "./inputs/telegram/bot";
import { app } from "./inputs/api/server";
import { startWorker, stopWorker } from "./core/scheduler";
import { DiscordBot } from "./inputs/discord";
import { SlackBot } from "./inputs/slack";

console.log(`
╔══════════════════════════════════════════╗
║            MOLTBOT v1.0.0                ║
║     Your Personal AI Assistant           ║
╚══════════════════════════════════════════╝
`);

async function main() {
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
        console.warn("[Discord]    5. Save and restart Moltbot");
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

  // Start API server
  console.log(`[API] Starting server on port ${env.PORT}...`);
  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(`[API] Server running at http://localhost:${server.port}`);
  console.log(`[Web] Dashboard available at http://localhost:${server.port}`);
  console.log("");
  const channels = ["Telegram", discordBot ? "Discord" : null, slackBot ? "Slack" : null, "API"].filter(Boolean).join(", ");
  console.log(`Moltbot is ready! Send a message via ${channels}.`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    stopWorker();
    await bot.stop();
    if (discordBot) await discordBot.stop();
    if (slackBot) await slackBot.stop();
    server.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
