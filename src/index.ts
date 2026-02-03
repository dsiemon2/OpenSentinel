import { env } from "./config/env";
import { createBot } from "./inputs/telegram/bot";
import { app } from "./inputs/api/server";
import { startWorker, stopWorker } from "./core/scheduler";

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

  // Start API server
  console.log(`[API] Starting server on port ${env.PORT}...`);
  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
  });

  console.log(`[API] Server running at http://localhost:${server.port}`);
  console.log(`[Web] Dashboard available at http://localhost:${server.port}`);
  console.log("");
  console.log("Moltbot is ready! Send a message via Telegram or the API.");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    stopWorker();
    await bot.stop();
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
