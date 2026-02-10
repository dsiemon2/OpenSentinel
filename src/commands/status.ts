/**
 * OpenSentinel Status Command
 *
 * Shows service health, database connectivity, and configuration info.
 */

import { exec, colors, printBanner, getConfigDir, checkPostgres, checkRedis } from "./utils";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export default async function status() {
  printBanner();

  const platform = process.platform;
  const configDir = getConfigDir();

  // ── Service Status ──────────────────────────────────────────────────────

  let serviceStatus = "unknown";
  if (platform === "linux") {
    const result = await exec("systemctl is-active opensentinel 2>/dev/null", { throws: false });
    serviceStatus = result.stdout.trim();
  } else if (platform === "darwin") {
    const result = await exec("launchctl list 2>/dev/null | grep opensentinel", { throws: false });
    serviceStatus = result.exitCode === 0 ? "active" : "inactive";
  }

  const serviceIcon = serviceStatus === "active" ? colors.green : colors.red;
  console.log(`  Service:      ${serviceIcon}${serviceStatus}${colors.reset}`);

  // ── PostgreSQL ──────────────────────────────────────────────────────────

  const pg = await checkPostgres();
  const pgIcon = pg.running ? colors.green : colors.red;
  console.log(`  PostgreSQL:   ${pgIcon}${pg.running ? `running (port ${pg.port})` : "not reachable"}${colors.reset}`);

  // ── Redis ───────────────────────────────────────────────────────────────

  const redis = await checkRedis();
  const redisIcon = redis.running ? colors.green : colors.red;
  console.log(`  Redis:        ${redisIcon}${redis.running ? `running (port ${redis.port})` : "not reachable"}${colors.reset}`);

  // ── API Health ──────────────────────────────────────────────────────────

  try {
    const port = process.env.PORT || "8030";
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json() as any;
    console.log(`  API:          ${colors.green}healthy${colors.reset} (port ${port})`);
  } catch {
    console.log(`  API:          ${colors.red}not reachable${colors.reset}`);
  }

  // ── Config ──────────────────────────────────────────────────────────────

  const envPath = join(configDir, ".env");
  const envExists = existsSync(envPath);
  console.log(`  Config:       ${envExists ? colors.green + envPath : colors.yellow + "not found"}${colors.reset}`);

  // ── Logs Hint ───────────────────────────────────────────────────────────

  console.log("");
  if (platform === "linux") {
    console.log(`  ${colors.dim}Logs: journalctl -u opensentinel -f${colors.reset}`);
  } else if (platform === "darwin") {
    const logPath = join(configDir, "logs", "opensentinel.log");
    console.log(`  ${colors.dim}Logs: tail -f ${logPath}${colors.reset}`);
  }
  console.log("");
}
