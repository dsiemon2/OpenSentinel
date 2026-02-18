/**
 * Shared CLI utilities for OpenSentinel commands.
 */

import { createInterface } from "node:readline";
import { exec as execCb } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

// ── Colors (ANSI escape codes) ───────────────────────────────────────────────

export const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

// ── Interactive prompts ──────────────────────────────────────────────────────

export async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "[Y/n]" : "[y/N]";
  const answer = await prompt(`${question} ${hint} `);
  if (answer === "") return defaultYes;
  return answer.toLowerCase().startsWith("y");
}

export async function promptSecret(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Disable echo for secret input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode?.(false);
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Shell execution ──────────────────────────────────────────────────────────

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function exec(cmd: string, opts?: { throws?: boolean; input?: string }): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = execCb(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      const exitCode = error?.code ?? 0;
      const result = { stdout: stdout.toString(), stderr: stderr.toString(), exitCode: typeof exitCode === "number" ? exitCode : 1 };
      if (error && opts?.throws !== false) {
        reject(Object.assign(error, result));
      } else {
        resolve(result);
      }
    });
    if (opts?.input) {
      child.stdin?.write(opts.input);
      child.stdin?.end();
    }
  });
}

export async function which(binary: string): Promise<string | null> {
  try {
    const result = await exec(`which ${binary}`, { throws: false });
    return result.stdout.trim() || null;
  } catch {
    return null;
  }
}

// ── Platform detection ───────────────────────────────────────────────────────

export interface Platform {
  os: "linux" | "darwin" | "other";
  distro: string;
  packageManager: "apt" | "brew" | "dnf" | "pacman" | "unknown";
}

export function detectPlatform(): Platform {
  const os = process.platform === "linux" ? "linux"
    : process.platform === "darwin" ? "darwin"
    : "other" as const;

  let distro = "unknown";
  let packageManager: Platform["packageManager"] = "unknown";

  if (os === "linux") {
    try {
      const osRelease = readFileSync("/etc/os-release", "utf-8");
      const idMatch = osRelease.match(/^ID=(.+)$/m);
      const idLikeMatch = osRelease.match(/^ID_LIKE=(.+)$/m);
      distro = idMatch?.[1]?.replace(/"/g, "") || "unknown";
      const idLike = idLikeMatch?.[1]?.replace(/"/g, "") || "";

      if (distro === "ubuntu" || distro === "debian" || idLike.includes("debian")) {
        packageManager = "apt";
      } else if (distro === "fedora" || idLike.includes("fedora") || idLike.includes("rhel")) {
        packageManager = "dnf";
      } else if (distro === "arch" || idLike.includes("arch")) {
        packageManager = "pacman";
      }
    } catch {}
  } else if (os === "darwin") {
    packageManager = "brew";
    distro = "macos";
  }

  return { os, distro, packageManager };
}

// ── Config directory ─────────────────────────────────────────────────────────

export function getConfigDir(): string {
  const dir = process.env.OPENSENTINEL_HOME || join(homedir(), ".opensentinel");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getPackageRoot(): string {
  // When running from source: import.meta.dirname is src/commands/
  // When installed globally: import.meta.dirname is dist/commands/ or dist/
  // Go up to find package.json
  let dir = import.meta.dirname || __dirname;
  for (let i = 0; i < 5; i++) {
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = join(dir, "..");
  }
  return process.cwd();
}

export function getMigrationsDir(): string {
  return join(getPackageRoot(), "drizzle");
}

// ── Port and service checks ──────────────────────────────────────────────────

export async function checkPort(port: number): Promise<boolean> {
  try {
    const result = await exec(`ss -tlnp 2>/dev/null | grep :${port} || netstat -tlnp 2>/dev/null | grep :${port}`, { throws: false });
    return result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

export async function checkPostgres(): Promise<{ installed: boolean; running: boolean; port: number }> {
  const installed = !!(await which("psql"));
  let running = false;
  let port = 5432;

  if (installed) {
    const result = await exec("pg_isready -q 2>/dev/null", { throws: false });
    running = result.exitCode === 0;
  }

  // Also check if running on non-standard port
  if (!running) {
    const port5445 = await checkPort(5445);
    if (port5445) {
      running = true;
      port = 5445;
    }
  }

  return { installed, running, port };
}

export async function checkRedis(): Promise<{ installed: boolean; running: boolean; port: number }> {
  const installed = !!(await which("redis-cli"));
  let running = false;
  let port = 6379;

  if (installed) {
    const result = await exec("redis-cli ping 2>/dev/null", { throws: false });
    running = result.stdout.trim() === "PONG";
  }

  // Check alternate ports
  if (!running) {
    for (const p of [6384, 6380]) {
      const result = await exec(`redis-cli -p ${p} ping 2>/dev/null`, { throws: false });
      if (result.stdout.trim() === "PONG") {
        running = true;
        port = p;
        break;
      }
    }
  }

  return { installed, running, port };
}

// ── Banner ───────────────────────────────────────────────────────────────────

export function printBanner() {
  console.log(`
${colors.cyan}${colors.bold}╔══════════════════════════════════════════╗
║           OPENSENTINEL v3.0.0            ║
║       Your Personal AI Assistant         ║
╚══════════════════════════════════════════╝${colors.reset}
`);
}

// ── .env file loading ────────────────────────────────────────────────────────

export function loadEnvFile(): string | null {
  const candidates = [
    process.env.OPENSENTINEL_HOME && join(process.env.OPENSENTINEL_HOME, ".env"),
    join(homedir(), ".opensentinel", ".env"),
    join(process.cwd(), ".env"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const content = readFileSync(candidate, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        // Don't override existing env vars
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return candidate;
    }
  }
  return null;
}
