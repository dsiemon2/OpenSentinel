/**
 * Terminal Agent CLI Tool
 *
 * Executes terminal commands via the desktop WebSocket bridge (when connected)
 * or falls back to server-side shell execution.
 * Tests the WebSocket bridge + Local Action Executor subsystem.
 */

import { executeCommand } from "./shell";

export interface TerminalOptions {
  command: string;
  shell?: string;
  cwd?: string;
  timeout?: number;
  preferLocal?: boolean;
}

export interface TerminalResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  platform: string;
  executedOn: "local" | "server";
  durationMs: number;
}

// Desktop client registry — populated by WebSocket handler when desktop app connects
const connectedDesktopClients: Map<string, DesktopClient> = new Map();

interface DesktopClient {
  id: string;
  capabilities: string[];
  executeLocal: (toolName: string, input: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Register a connected desktop client for local execution
 */
export function registerDesktopClient(client: DesktopClient): void {
  connectedDesktopClients.set(client.id, client);
}

/**
 * Unregister a disconnected desktop client
 */
export function unregisterDesktopClient(clientId: string): void {
  connectedDesktopClients.delete(clientId);
}

/**
 * Check if any desktop client is connected with execute_command capability
 */
export function hasDesktopClient(): boolean {
  for (const client of connectedDesktopClients.values()) {
    if (client.capabilities.includes("execute_command")) {
      return true;
    }
  }
  return false;
}

/**
 * Get the first available desktop client with execute_command capability
 */
function getDesktopClient(): DesktopClient | null {
  for (const client of connectedDesktopClients.values()) {
    if (client.capabilities.includes("execute_command")) {
      return client;
    }
  }
  return null;
}

/**
 * Execute a terminal command, routing to desktop client or server
 */
export async function executeTerminalCommand(options: TerminalOptions): Promise<TerminalResult> {
  const { command, shell, cwd, timeout = 30000, preferLocal = true } = options;

  if (!command || command.trim().length === 0) {
    return {
      success: false,
      stdout: "",
      stderr: "No command provided",
      exitCode: 1,
      platform: process.platform,
      executedOn: "server",
      durationMs: 0,
    };
  }

  // Security: block obviously dangerous commands
  const blocked = isDangerousCommand(command);
  if (blocked) {
    return {
      success: false,
      stdout: "",
      stderr: `Blocked: ${blocked}`,
      exitCode: 1,
      platform: process.platform,
      executedOn: "server",
      durationMs: 0,
    };
  }

  const startTime = Date.now();

  // Try local execution first if preferred and available
  if (preferLocal) {
    const client = getDesktopClient();
    if (client) {
      try {
        const result = await Promise.race([
          client.executeLocal("execute_command", { command, shell, cwd }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Local execution timeout")), timeout)
          ),
        ]) as any;

        return {
          success: result?.success ?? true,
          stdout: result?.stdout || result?.output || "",
          stderr: result?.stderr || "",
          exitCode: result?.exitCode ?? 0,
          platform: result?.platform || "unknown",
          executedOn: "local",
          durationMs: Date.now() - startTime,
        };
      } catch {
        // Fall through to server execution
      }
    }
  }

  // Server-side fallback
  try {
    const result = await executeCommand(command, cwd);
    return {
      success: result.success,
      stdout: result.output || "",
      stderr: result.error || "",
      exitCode: result.exitCode ?? (result.success ? 0 : 1),
      platform: process.platform,
      executedOn: "server",
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1,
      platform: process.platform,
      executedOn: "server",
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Check for dangerous commands that should be blocked
 */
function isDangerousCommand(command: string): string | null {
  const lower = command.toLowerCase().trim();

  const patterns: Array<[RegExp, string]> = [
    [/rm\s+(-rf?\s+)?\/($|\s)/, "Recursive delete of root filesystem"],
    [/rm\s+(-rf?\s+)?~\/?\*/, "Recursive delete of home directory"],
    [/format\s+[a-z]:/i, "Disk format command"],
    [/mkfs\s/, "Filesystem creation on existing device"],
    [/dd\s+.*of=\/dev\/[sh]d/, "Direct disk write"],
    [/>\s*\/dev\/[sh]d/, "Redirect to disk device"],
    [/:\(\)\s*\{.*:\|:.*\}/, "Fork bomb"],
    [/\bshutdown\b/, "System shutdown"],
    [/\breboot\b/, "System reboot"],
    [/\binit\s+0\b/, "System halt"],
  ];

  for (const [pattern, reason] of patterns) {
    if (pattern.test(lower)) return reason;
  }

  return null;
}

export default executeTerminalCommand;
