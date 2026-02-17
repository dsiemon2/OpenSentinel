/**
 * Local Executor Security Guardrails
 *
 * Prevents dangerous operations from being executed locally.
 * All destructive commands require user confirmation via Electron dialog.
 */

import type { LocalToolRequest } from "./types";

// ─── Blocked Patterns ────────────────────────────────────

const BLOCKED_COMMANDS: RegExp[] = [
  // Recursive delete / format
  /rm\s+(-rf|-fr)\s+\//i,
  /rm\s+(-rf|-fr)\s+~\//i,
  /rm\s+(-rf|-fr)\s+\\\\/i,
  /del\s+\/s\s+\/q\s+c:\\/i,
  /format\s+[a-z]:/i,
  /mkfs/i,

  // Registry destruction
  /reg\s+delete\s+hk/i,

  // Disk overwrite
  /dd\s+if=.*of=\/dev\//i,

  // Fork bombs
  /:\(\)\{.*:\|:.*\}/,
  /%0\|%0/,

  // Credential theft
  /mimikatz/i,
  /sekurlsa/i,
  /lsadump/i,

  // Disable security
  /netsh\s+advfirewall\s+set.*state\s+off/i,
  /set-mppreference.*-disablerealtimemonitoring/i,

  // Crypto mining
  /xmrig/i,
  /cryptonight/i,

  // PowerShell download cradles (common malware pattern)
  /powershell.*-e\s+[A-Za-z0-9+\/=]{50,}/i,
  /iex\s*\(\s*\(new-object.*downloadstring/i,
];

const BLOCKED_PATHS: RegExp[] = [
  // Windows system
  /^c:\\windows\\system32/i,
  /^c:\\windows\\syswow64/i,

  // Linux system
  /^\/etc\/shadow/,
  /^\/etc\/passwd/,
  /^\/boot\//,
  /^\/proc\//,
  /^\/sys\//,

  // macOS system
  /^\/system\//i,
  /^\/private\/var/i,
];

/** Commands that need user confirmation before executing */
const CONFIRM_PATTERNS: RegExp[] = [
  // Delete operations
  /\brm\b/i,
  /\bdel\b/i,
  /\brmdir\b/i,
  /\bremove-item\b/i,

  // System power
  /\bshutdown\b/i,
  /\brestart\b/i,
  /\breboot\b/i,

  // Disk operations
  /\bdiskpart\b/i,
  /\bformat\b/i,

  // Service control
  /\bnet\s+stop\b/i,
  /\bsc\s+delete\b/i,
  /\bsystemctl\s+(stop|disable)\b/i,

  // Kill processes
  /\btaskkill\b/i,
  /\bkill\s+-9\b/i,
  /\bpkill\b/i,
];

// ─── Validation ──────────────────────────────────────────

export interface SecurityCheckResult {
  allowed: boolean;
  requiresConfirmation: boolean;
  reason?: string;
}

/**
 * Check if a local tool request is safe to execute.
 */
export function checkSecurity(request: LocalToolRequest): SecurityCheckResult {
  const { toolName, input } = request;

  // Destructive tools always need confirmation
  if (
    toolName === "local_system_shutdown" ||
    toolName === "local_system_restart" ||
    toolName === "local_system_lock"
  ) {
    return {
      allowed: true,
      requiresConfirmation: true,
      reason: `${toolName} requires user confirmation`,
    };
  }

  // Check command execution
  if (toolName === "execute_command") {
    const command = (input.command as string) || "";

    for (const pattern of BLOCKED_COMMANDS) {
      if (pattern.test(command)) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: `Command blocked by security policy: matches ${pattern}`,
        };
      }
    }

    for (const pattern of CONFIRM_PATTERNS) {
      if (pattern.test(command)) {
        return {
          allowed: true,
          requiresConfirmation: true,
          reason: `Command requires confirmation: ${command.slice(0, 80)}`,
        };
      }
    }
  }

  // Check file path access
  if (
    toolName === "read_file" ||
    toolName === "write_file" ||
    toolName === "local_open_file"
  ) {
    const filePath = (input.path as string) || "";
    for (const pattern of BLOCKED_PATHS) {
      if (pattern.test(filePath)) {
        return {
          allowed: false,
          requiresConfirmation: false,
          reason: `Access to ${filePath} is blocked by security policy`,
        };
      }
    }

    // Writing to system directories needs confirmation
    if (toolName === "write_file") {
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: `File write requires confirmation: ${filePath}`,
      };
    }
  }

  // Delete in search/list is fine (read-only)
  // All other tools pass
  return { allowed: true, requiresConfirmation: false };
}

/**
 * Sanitize command output to remove sensitive data
 */
export function sanitizeOutput(output: string): string {
  // Remove potential API keys / tokens in output
  return output.replace(
    /(?:api[_-]?key|token|secret|password|credential)[\s=:]+\S+/gi,
    "[REDACTED]"
  );
}
