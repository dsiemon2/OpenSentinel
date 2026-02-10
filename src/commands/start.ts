/**
 * OpenSentinel Start Command
 *
 * Loads environment, starts all services, and handles graceful shutdown.
 */

import { loadEnvFile } from "./utils";

export default async function start() {
  // Load .env from config directory chain
  const envFile = loadEnvFile();
  if (envFile) {
    console.log(`[Config] Loaded ${envFile}`);
  }

  // Mark as CLI so env validation throws on missing required vars
  process.env.__OPENSENTINEL_CLI__ = "1";

  const { main } = await import("../index");

  const shutdown = await main();

  // Wire up graceful shutdown
  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
}
