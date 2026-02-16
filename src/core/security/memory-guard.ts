/**
 * Memory Poisoning Guard — OWASP ASI06 Defense
 *
 * Validates memory content before storage to prevent adversarial
 * users from planting false memories or injection payloads.
 * Registers as a hook on memory:store.
 */

import { hookManager } from "../hooks";

// Patterns that indicate injection attempts embedded in "facts"
const MEMORY_INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /ignore\s+(all\s+)?previous/i, name: "ignore_previous" },
  { pattern: /system\s*prompt/i, name: "system_prompt" },
  { pattern: /you\s+(must|should|will)\s+always/i, name: "override_behavior" },
  { pattern: /from\s+now\s+on,?\s+(you|always)/i, name: "persistent_override" },
  { pattern: /the\s+user('s)?\s+(real\s+)?password\s+is/i, name: "credential_injection" },
  { pattern: /secret\s+key\s*(is|=|:)/i, name: "secret_injection" },
  { pattern: /\bAPI[_\s]KEY\s*(is|=|:)/i, name: "api_key_injection" },
  { pattern: /when\s+asked\s+about\s+.+,?\s+(always\s+)?(say|respond|reply)/i, name: "response_override" },
];

export interface MemoryValidationResult {
  valid: boolean;
  reason?: string;
  riskScore: number; // 0-1
  flaggedPatterns: string[];
}

export class MemoryGuard {
  private enabled: boolean;
  private hookId: string | null = null;
  private maxMemoryLength = 5000;
  private minMemoryLength = 3;
  private ingestionRates: Map<string, { count: number; windowStart: number }> = new Map();
  private maxIngestionPerMinute = 20;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  /**
   * Validate memory content for injection or poisoning
   */
  validateMemoryContent(content: string): MemoryValidationResult {
    if (!this.enabled) {
      return { valid: true, riskScore: 0, flaggedPatterns: [] };
    }

    const flaggedPatterns: string[] = [];

    // Check length bounds
    if (content.length < this.minMemoryLength) {
      return { valid: false, reason: "Memory content too short", riskScore: 0, flaggedPatterns: [] };
    }

    if (content.length > this.maxMemoryLength) {
      return { valid: false, reason: "Memory content too long", riskScore: 0.3, flaggedPatterns: [] };
    }

    // Scan for injection patterns
    for (const { pattern, name } of MEMORY_INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        flaggedPatterns.push(name);
      }
    }

    const riskScore = flaggedPatterns.length > 0
      ? Math.min(1, 0.3 + flaggedPatterns.length * 0.2)
      : 0;

    return {
      valid: flaggedPatterns.length === 0,
      reason: flaggedPatterns.length > 0
        ? `Suspicious patterns: ${flaggedPatterns.join(", ")}`
        : undefined,
      riskScore,
      flaggedPatterns,
    };
  }

  /**
   * Validate memory source with rate limiting
   */
  validateMemorySource(source: string): { allowed: boolean; reason?: string } {
    if (!this.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    const rateInfo = this.ingestionRates.get(source);
    if (rateInfo) {
      if (now - rateInfo.windowStart < windowMs) {
        if (rateInfo.count >= this.maxIngestionPerMinute) {
          return {
            allowed: false,
            reason: `Rate limit exceeded for source '${source}': ${this.maxIngestionPerMinute}/min`,
          };
        }
        rateInfo.count++;
      } else {
        // New window
        rateInfo.count = 1;
        rateInfo.windowStart = now;
      }
    } else {
      this.ingestionRates.set(source, { count: 1, windowStart: now });
    }

    return { allowed: true };
  }

  /**
   * Register as a hook on memory:store (before phase)
   */
  registerAsHook(): void {
    this.hookId = hookManager.register({
      event: "memory:store",
      phase: "before",
      name: "memory-guard",
      priority: 5,
      handler: async (context) => {
        if (!this.enabled) return context;

        const content = context.data.content as string || "";
        const source = context.data.source as string || "unknown";

        // Validate content
        const contentResult = this.validateMemoryContent(content);
        if (!contentResult.valid) {
          context.cancelled = true;
          context.cancelReason = contentResult.reason || "Memory content validation failed";
          console.log(`[MemoryGuard] Blocked memory: ${contentResult.reason}`);
          return context;
        }

        // Validate rate limit
        const sourceResult = this.validateMemorySource(source);
        if (!sourceResult.allowed) {
          context.cancelled = true;
          context.cancelReason = sourceResult.reason || "Memory rate limit exceeded";
          console.log(`[MemoryGuard] Rate limited: ${sourceResult.reason}`);
          return context;
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

  setMaxMemoryLength(length: number): void {
    this.maxMemoryLength = length;
  }

  getMaxMemoryLength(): number {
    return this.maxMemoryLength;
  }

  setMaxIngestionRate(rate: number): void {
    this.maxIngestionPerMinute = rate;
  }

  getMaxIngestionRate(): number {
    return this.maxIngestionPerMinute;
  }

  getPatternCount(): number {
    return MEMORY_INJECTION_PATTERNS.length;
  }

  clearRateLimits(): void {
    this.ingestionRates.clear();
  }
}

export const memoryGuard = new MemoryGuard();
