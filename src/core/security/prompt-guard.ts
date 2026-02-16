/**
 * Prompt Injection Guard — OWASP ASI01 Defense
 *
 * Scans incoming messages for prompt injection attempts using
 * pattern-based detection. Registers as a hook on message:process.
 */

import { hookManager } from "../hooks";
import { env } from "../../config/env";
import { audit } from "./audit-logger";

// Injection patterns with associated risk weights
const INJECTION_PATTERNS: Array<{ pattern: RegExp; weight: number; name: string }> = [
  { pattern: /ignore\s+(all\s+)?previous\s+(instructions|prompts|rules)/i, weight: 0.9, name: "ignore_instructions" },
  { pattern: /you\s+are\s+now\s+(a|an|the)\s+/i, weight: 0.8, name: "role_override" },
  { pattern: /system\s*prompt\s*[:=]/i, weight: 0.85, name: "system_prompt_inject" },
  { pattern: /jailbreak/i, weight: 0.7, name: "jailbreak_keyword" },
  { pattern: /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/i, weight: 0.9, name: "special_tokens" },
  { pattern: /do\s+not\s+follow\s+(any|your)\s+(previous|original)/i, weight: 0.85, name: "instruction_override" },
  { pattern: /pretend\s+(you|that|to\s+be)/i, weight: 0.6, name: "pretend_prompt" },
  { pattern: /forget\s+(everything|all|your)\s+(you|instructions|rules)/i, weight: 0.85, name: "forget_instructions" },
  { pattern: /\bDAN\b.*\bmode\b/i, weight: 0.8, name: "dan_mode" },
  { pattern: /act\s+as\s+(if\s+you\s+are|a)\s+(unrestricted|unfiltered|uncensored)/i, weight: 0.9, name: "unrestricted_mode" },
  { pattern: /reveal\s+(your|the)\s+(system|hidden|secret)\s*(prompt|instructions)/i, weight: 0.85, name: "reveal_prompt" },
  { pattern: /\bbase64\s*[:=]\s*[A-Za-z0-9+\/=]{20,}/i, weight: 0.7, name: "base64_injection" },
  { pattern: /<script[^>]*>|javascript\s*:/i, weight: 0.8, name: "script_injection" },
  { pattern: /\{\{.*\}\}|<%.*%>|\$\{.*\}/s, weight: 0.5, name: "template_injection" },
  { pattern: /override\s+(safety|content)\s*(filters?|policies|guidelines)/i, weight: 0.9, name: "safety_override" },
];

export class PromptGuard {
  private enabled: boolean;
  private threshold: number;
  private hookId: string | null = null;

  constructor(enabled = true, threshold = 0.7) {
    this.enabled = enabled;
    this.threshold = threshold;
  }

  /**
   * Score a text for injection risk (0 = safe, 1 = definite injection)
   */
  score(text: string): { score: number; matches: Array<{ name: string; weight: number }> } {
    if (!text || text.length === 0) {
      return { score: 0, matches: [] };
    }

    const matches: Array<{ name: string; weight: number }> = [];

    for (const { pattern, weight, name } of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        matches.push({ name, weight });
      }
    }

    if (matches.length === 0) {
      return { score: 0, matches: [] };
    }

    // Use the highest weight match as the base, add diminishing returns for additional matches
    const sorted = matches.sort((a, b) => b.weight - a.weight);
    let totalScore = sorted[0].weight;
    for (let i = 1; i < sorted.length; i++) {
      totalScore += sorted[i].weight * (0.1 / i); // Diminishing additional weight
    }

    return { score: Math.min(1, totalScore), matches };
  }

  /**
   * Scan text for injection — returns true if injection detected
   */
  scanForInjection(text: string): boolean {
    if (!this.enabled) return false;
    const { score } = this.score(text);
    return score >= this.threshold;
  }

  /**
   * Register as a hook on message:process (before phase)
   */
  registerAsHook(): void {
    this.hookId = hookManager.register({
      event: "message:process",
      phase: "before",
      name: "prompt-guard",
      priority: 1, // Run first
      handler: async (context) => {
        if (!this.enabled) return context;

        const message = context.data.content as string || context.data.message as string || "";
        const { score, matches } = this.score(message);

        if (score >= this.threshold) {
          context.cancelled = true;
          context.cancelReason = `Potential prompt injection detected (score: ${score.toFixed(2)})`;

          // Audit log the blocked attempt
          try {
            await audit.securityEvent(context.userId, {
              type: "prompt_injection_blocked",
              score,
              patterns: matches.map((m) => m.name),
              messagePreview: message.substring(0, 100),
            });
          } catch {
            // Don't fail on audit logging errors
          }

          console.log(`[PromptGuard] Blocked injection attempt (score: ${score.toFixed(2)}, patterns: ${matches.map((m) => m.name).join(", ")})`);
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

  setThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold));
  }

  getThreshold(): number {
    return this.threshold;
  }

  getPatternCount(): number {
    return INJECTION_PATTERNS.length;
  }
}

export const promptGuard = new PromptGuard(
  env.PROMPT_GUARD_ENABLED !== false,
  env.PROMPT_GUARD_THRESHOLD || 0.7
);
