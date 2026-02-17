/**
 * Auto-Responder
 * Ported from Ecom-Sales to OpenSentinel
 *
 * Rule-based automation with AI escalation:
 * - Pattern matching for incoming messages
 * - Configurable response templates
 * - AI fallback for unmatched patterns
 * - Business hours awareness
 * - Response throttling
 */

export interface AutoResponseRule {
  id: string;
  name: string;
  /** Patterns to match against (regex or keyword) */
  patterns: string[];
  /** Response template (supports {{variable}} placeholders) */
  response: string;
  /** Channel restriction (undefined = all channels) */
  channels?: string[];
  /** Only active during business hours */
  businessHoursOnly: boolean;
  /** Priority (higher = checked first) */
  priority: number;
  /** Whether this rule is active */
  isActive: boolean;
  /** Maximum times this rule can fire per user per hour */
  maxPerUserPerHour: number;
  /** Tags for categorization */
  tags: string[];
}

export interface AutoResponseContext {
  message: string;
  channel: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface AutoResponseResult {
  matched: boolean;
  ruleId?: string;
  response?: string;
  escalateToAI: boolean;
}

interface RateEntry {
  count: number;
  windowStart: number;
}

/**
 * Auto-Responder Engine
 */
export class AutoResponder {
  private rules: AutoResponseRule[] = [];
  private rateLimits = new Map<string, RateEntry>();
  private ruleIdCounter = 0;

  /** Business hours configuration */
  private businessHours = {
    start: 9, // 9 AM
    end: 17, // 5 PM
    timezone: "UTC",
    workDays: [1, 2, 3, 4, 5], // Monday-Friday
  };

  /** AI escalation callback */
  private aiHandler?: (context: AutoResponseContext) => Promise<string>;

  /**
   * Set AI escalation handler
   */
  setAIHandler(
    handler: (context: AutoResponseContext) => Promise<string>
  ): void {
    this.aiHandler = handler;
  }

  /**
   * Configure business hours
   */
  setBusinessHours(config: Partial<typeof this.businessHours>): void {
    Object.assign(this.businessHours, config);
  }

  /**
   * Add a response rule
   */
  addRule(
    rule: Omit<AutoResponseRule, "id">
  ): AutoResponseRule {
    const id = `ar_${++this.ruleIdCounter}`;
    const created = { ...rule, id };
    this.rules.push(created);
    this.rules.sort((a, b) => b.priority - a.priority);
    return created;
  }

  /**
   * Remove a rule
   */
  removeRule(id: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    return true;
  }

  /**
   * Update a rule
   */
  updateRule(
    id: string,
    updates: Partial<Omit<AutoResponseRule, "id">>
  ): AutoResponseRule | undefined {
    const rule = this.rules.find((r) => r.id === id);
    if (!rule) return undefined;
    Object.assign(rule, updates);
    this.rules.sort((a, b) => b.priority - a.priority);
    return rule;
  }

  /**
   * List all rules
   */
  listRules(): AutoResponseRule[] {
    return [...this.rules];
  }

  /**
   * Check if currently within business hours
   */
  private isBusinessHours(): boolean {
    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDay();

    return (
      this.businessHours.workDays.includes(day) &&
      hour >= this.businessHours.start &&
      hour < this.businessHours.end
    );
  }

  /**
   * Check rate limit for a rule + user combination
   */
  private checkRateLimit(
    ruleId: string,
    userId: string,
    maxPerHour: number
  ): boolean {
    if (maxPerHour <= 0) return true;

    const key = `${ruleId}:${userId}`;
    const now = Date.now();
    const hourMs = 3600 * 1000;
    const entry = this.rateLimits.get(key);

    if (!entry || now - entry.windowStart > hourMs) {
      this.rateLimits.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= maxPerHour) return false;
    entry.count++;
    return true;
  }

  /**
   * Apply template variables to response
   */
  private applyTemplate(
    template: string,
    context: AutoResponseContext
  ): string {
    return template
      .replace(/\{\{message\}\}/g, context.message)
      .replace(/\{\{channel\}\}/g, context.channel)
      .replace(/\{\{userId\}\}/g, context.userId)
      .replace(/\{\{time\}\}/g, new Date().toISOString())
      .replace(/\{\{(\w+)\}\}/g, (_, key) =>
        String(context.metadata?.[key] ?? `{{${key}}}`)
      );
  }

  /**
   * Process an incoming message and generate auto-response
   */
  async processMessage(
    context: AutoResponseContext
  ): Promise<AutoResponseResult> {
    for (const rule of this.rules) {
      if (!rule.isActive) continue;

      // Channel filter
      if (rule.channels?.length && !rule.channels.includes(context.channel)) {
        continue;
      }

      // Business hours filter
      if (rule.businessHoursOnly && !this.isBusinessHours()) continue;

      // Rate limit check
      if (
        !this.checkRateLimit(
          rule.id,
          context.userId,
          rule.maxPerUserPerHour
        )
      ) {
        continue;
      }

      // Pattern matching
      const matched = rule.patterns.some((pattern) => {
        try {
          const regex = new RegExp(pattern, "i");
          return regex.test(context.message);
        } catch {
          return context.message.toLowerCase().includes(pattern.toLowerCase());
        }
      });

      if (matched) {
        const response = this.applyTemplate(rule.response, context);
        return {
          matched: true,
          ruleId: rule.id,
          response,
          escalateToAI: false,
        };
      }
    }

    // No rules matched - escalate to AI if available
    if (this.aiHandler) {
      try {
        const aiResponse = await this.aiHandler(context);
        return {
          matched: false,
          response: aiResponse,
          escalateToAI: true,
        };
      } catch {
        return { matched: false, escalateToAI: true };
      }
    }

    return { matched: false, escalateToAI: true };
  }
}

export const autoResponder = new AutoResponder();
