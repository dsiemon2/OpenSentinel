/**
 * Tool Sandbox — OWASP ASI02/ASI05 Defense
 *
 * Wraps tool execution with safety checks:
 * - Input validation (path traversal, command injection)
 * - Per-user tool permission enforcement
 * - Execution timeout protection
 * - Registers as a hook on tool:execute
 */

import { hookManager } from "../hooks";
import { env } from "../../config/env";
import { audit } from "./audit-logger";

// Dangerous command patterns
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; name: string; severity: "block" | "warn" }> = [
  { pattern: /rm\s+(-rf?|--force)\s+[\/~]/, name: "destructive_rm", severity: "block" },
  { pattern: /rm\s+-rf?\s+\//, name: "rm_root", severity: "block" },
  { pattern: /mkfs\s/, name: "format_disk", severity: "block" },
  { pattern: /dd\s+.*of=\/dev\//, name: "dd_device", severity: "block" },
  { pattern: /:\(\)\{.+\}/, name: "fork_bomb", severity: "block" },
  { pattern: />\s*\/dev\/sd[a-z]/, name: "device_write", severity: "block" },
  { pattern: /chmod\s+(-R\s+)?777\s+\//, name: "chmod_root", severity: "block" },
  { pattern: /curl\s+.*\|\s*(ba)?sh/, name: "pipe_to_shell", severity: "warn" },
  { pattern: /wget\s+.*-O\s*-\s*\|\s*(ba)?sh/, name: "wget_pipe", severity: "warn" },
  { pattern: /\.\.\/(\.\.\/){2,}/, name: "deep_traversal", severity: "block" },
  { pattern: /;\s*(rm|mkfs|dd|shutdown|reboot|halt|poweroff)/, name: "chain_dangerous", severity: "block" },
  { pattern: /\$\(.*rm\s/, name: "subshell_rm", severity: "block" },
  { pattern: /`.*rm\s/, name: "backtick_rm", severity: "block" },
];

// Path traversal patterns
const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e\//i,
  /\.\.%2f/i,
  /%252e%252e%252f/i, // double encoded
];

export interface SandboxValidationResult {
  safe: boolean;
  blocked: boolean;
  warnings: string[];
  blockedReason?: string;
}

export class ToolSandbox {
  private enabled: boolean;
  private hookId: string | null = null;
  private toolDenyList: Set<string> = new Set();
  private toolAllowList: Set<string> | null = null; // null = all allowed
  private defaultTimeoutMs = 30000;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Validate tool input for dangerous patterns
   */
  validateToolInput(toolName: string, input: Record<string, unknown>): SandboxValidationResult {
    if (!this.enabled) {
      return { safe: true, blocked: false, warnings: [] };
    }

    const warnings: string[] = [];
    const inputStr = JSON.stringify(input);

    // Check for denied tools
    if (this.toolDenyList.has(toolName)) {
      return {
        safe: false,
        blocked: true,
        warnings: [],
        blockedReason: `Tool '${toolName}' is denied`,
      };
    }

    // Check allow list if configured
    if (this.toolAllowList && !this.toolAllowList.has(toolName)) {
      return {
        safe: false,
        blocked: true,
        warnings: [],
        blockedReason: `Tool '${toolName}' is not in the allow list`,
      };
    }

    // Check for dangerous patterns in input
    for (const { pattern, name, severity } of DANGEROUS_PATTERNS) {
      if (pattern.test(inputStr)) {
        if (severity === "block") {
          return {
            safe: false,
            blocked: true,
            warnings: [],
            blockedReason: `Dangerous pattern detected: ${name}`,
          };
        }
        warnings.push(`Warning: ${name} pattern detected`);
      }
    }

    // Check for path traversal
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(inputStr)) {
        return {
          safe: false,
          blocked: true,
          warnings: [],
          blockedReason: "Path traversal attempt detected",
        };
      }
    }

    return {
      safe: warnings.length === 0,
      blocked: false,
      warnings,
    };
  }

  /**
   * Execute a function with a timeout
   */
  async timeoutExecution<T>(fn: () => Promise<T>, maxMs?: number): Promise<T> {
    const timeout = maxMs || this.defaultTimeoutMs;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Register as a hook on tool:execute (before phase)
   */
  registerAsHook(): void {
    this.hookId = hookManager.register({
      event: "tool:execute",
      phase: "before",
      name: "tool-sandbox",
      priority: 5,
      handler: async (context) => {
        if (!this.enabled) return context;

        const toolName = context.data.toolName as string || "";
        const input = (context.data.input as Record<string, unknown>) || {};

        const result = this.validateToolInput(toolName, input);

        if (result.blocked) {
          context.cancelled = true;
          context.cancelReason = result.blockedReason || "Tool execution blocked by sandbox";

          try {
            await audit.securityEvent(context.userId, {
              type: "tool_sandbox_blocked",
              toolName,
              reason: result.blockedReason,
              inputPreview: JSON.stringify(input).substring(0, 200),
            });
          } catch {
            // Don't fail on audit logging errors
          }

          console.log(`[ToolSandbox] Blocked ${toolName}: ${result.blockedReason}`);
        } else if (result.warnings.length > 0) {
          console.log(`[ToolSandbox] Warnings for ${toolName}: ${result.warnings.join(", ")}`);
        }

        return context;
      },
    });
  }

  /**
   * Unregister the hook
   */
  unregisterHook(): void {
    if (this.hookId) {
      hookManager.unregister(this.hookId);
      this.hookId = null;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  denyTool(toolName: string): void {
    this.toolDenyList.add(toolName);
  }

  allowTool(toolName: string): void {
    if (!this.toolAllowList) {
      this.toolAllowList = new Set();
    }
    this.toolAllowList.add(toolName);
  }

  clearDenyList(): void {
    this.toolDenyList.clear();
  }

  clearAllowList(): void {
    this.toolAllowList = null;
  }

  getDeniedTools(): string[] {
    return Array.from(this.toolDenyList);
  }

  setDefaultTimeout(ms: number): void {
    this.defaultTimeoutMs = ms;
  }

  getDefaultTimeout(): number {
    return this.defaultTimeoutMs;
  }
}

export const toolSandbox = new ToolSandbox(env.TOOL_SANDBOX_ENABLED !== false);
