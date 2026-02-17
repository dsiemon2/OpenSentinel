/**
 * Risk/Constraint Engine
 * Ported from PolyMarketAI (Python) to TypeScript
 *
 * Non-bypassable safety layer with configurable checks:
 * - Rate limiting per action type
 * - Cost/budget thresholds
 * - Content safety checks
 * - Tool execution constraints
 * - Kill switch and safe mode
 * - Audit trail for all decisions
 */

export interface RiskCheck {
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  /** Return true if the check passes (action is safe) */
  check: (context: RiskContext) => Promise<boolean> | boolean;
  /** Message when check fails */
  failMessage: string;
}

export interface RiskContext {
  action: string;
  userId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  estimatedCost?: number;
  metadata?: Record<string, unknown>;
}

export interface RiskDecision {
  allowed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    severity: string;
    message?: string;
  }>;
  timestamp: Date;
  context: RiskContext;
}

export interface RiskConfig {
  /** Maximum cost per request in USD */
  maxCostPerRequest: number;
  /** Maximum cost per hour in USD */
  maxCostPerHour: number;
  /** Maximum cost per day in USD */
  maxCostPerDay: number;
  /** Maximum tool executions per minute */
  maxToolsPerMinute: number;
  /** Maximum tool executions per hour */
  maxToolsPerHour: number;
  /** Maximum messages per minute */
  maxMessagesPerMinute: number;
  /** Blocked tool names */
  blockedTools: string[];
  /** Blocked action patterns (regex) */
  blockedPatterns: string[];
  /** Whether safe mode is active (restricts to read-only operations) */
  safeMode: boolean;
  /** Kill switch - blocks ALL actions */
  killSwitch: boolean;
  /** Custom risk checks */
  customChecks: RiskCheck[];
}

const DEFAULT_CONFIG: RiskConfig = {
  maxCostPerRequest: 5.0,
  maxCostPerHour: 50.0,
  maxCostPerDay: 200.0,
  maxToolsPerMinute: 30,
  maxToolsPerHour: 500,
  maxMessagesPerMinute: 60,
  blockedTools: [],
  blockedPatterns: [],
  safeMode: false,
  killSwitch: false,
  customChecks: [],
};

// Tracking state
const costTracker = {
  hourly: new Map<string, { total: number; windowStart: number }>(),
  daily: new Map<string, { total: number; windowStart: number }>(),
};

const rateTracker = new Map<
  string,
  { timestamps: number[] }
>();

const auditLog: RiskDecision[] = [];

/**
 * Risk Engine
 */
export class RiskEngine {
  private config: RiskConfig;
  private checks: RiskCheck[] = [];

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeBuiltInChecks();
    this.checks.push(...this.config.customChecks);
  }

  private initializeBuiltInChecks(): void {
    // Kill switch check
    this.checks.push({
      name: "kill_switch",
      description: "Emergency kill switch - blocks all actions",
      severity: "critical",
      check: () => !this.config.killSwitch,
      failMessage: "Kill switch is active. All actions are blocked.",
    });

    // Safe mode check
    this.checks.push({
      name: "safe_mode",
      description: "Safe mode restricts to read-only operations",
      severity: "high",
      check: (ctx) => {
        if (!this.config.safeMode) return true;
        const readOnlyActions = [
          "read",
          "search",
          "list",
          "get",
          "query",
          "analyze",
          "view",
        ];
        return readOnlyActions.some((a) =>
          ctx.action.toLowerCase().includes(a)
        );
      },
      failMessage: "Safe mode is active. Only read-only operations are allowed.",
    });

    // Blocked tools check
    this.checks.push({
      name: "blocked_tools",
      description: "Prevents execution of blocked tools",
      severity: "high",
      check: (ctx) =>
        !ctx.toolName || !this.config.blockedTools.includes(ctx.toolName),
      failMessage: "This tool is blocked by the risk policy.",
    });

    // Blocked patterns check
    this.checks.push({
      name: "blocked_patterns",
      description: "Prevents actions matching blocked patterns",
      severity: "high",
      check: (ctx) => {
        const inputStr = JSON.stringify(ctx.input || {});
        return !this.config.blockedPatterns.some((pattern) =>
          new RegExp(pattern, "i").test(inputStr)
        );
      },
      failMessage: "Input matches a blocked pattern.",
    });

    // Cost per request check
    this.checks.push({
      name: "cost_per_request",
      description: "Limits cost per individual request",
      severity: "medium",
      check: (ctx) =>
        !ctx.estimatedCost ||
        ctx.estimatedCost <= this.config.maxCostPerRequest,
      failMessage: `Request exceeds maximum cost of $${this.config.maxCostPerRequest}.`,
    });

    // Hourly cost check
    this.checks.push({
      name: "hourly_cost_limit",
      description: "Limits total cost per hour",
      severity: "high",
      check: (ctx) => {
        const key = ctx.userId || "global";
        const now = Date.now();
        const hourMs = 3600 * 1000;
        const entry = costTracker.hourly.get(key);

        if (!entry || now - entry.windowStart > hourMs) {
          return true;
        }
        return entry.total + (ctx.estimatedCost || 0) <= this.config.maxCostPerHour;
      },
      failMessage: `Hourly cost limit of $${this.config.maxCostPerHour} exceeded.`,
    });

    // Daily cost check
    this.checks.push({
      name: "daily_cost_limit",
      description: "Limits total cost per day",
      severity: "high",
      check: (ctx) => {
        const key = ctx.userId || "global";
        const now = Date.now();
        const dayMs = 86400 * 1000;
        const entry = costTracker.daily.get(key);

        if (!entry || now - entry.windowStart > dayMs) {
          return true;
        }
        return entry.total + (ctx.estimatedCost || 0) <= this.config.maxCostPerDay;
      },
      failMessage: `Daily cost limit of $${this.config.maxCostPerDay} exceeded.`,
    });

    // Rate limit: tools per minute
    this.checks.push({
      name: "tool_rate_limit_minute",
      description: "Limits tool executions per minute",
      severity: "medium",
      check: (ctx) => {
        if (!ctx.toolName) return true;
        return this.checkRate(
          `tool:${ctx.userId || "global"}`,
          60 * 1000,
          this.config.maxToolsPerMinute
        );
      },
      failMessage: `Tool execution rate limit exceeded (${this.config.maxToolsPerMinute}/min).`,
    });

    // Rate limit: tools per hour
    this.checks.push({
      name: "tool_rate_limit_hour",
      description: "Limits tool executions per hour",
      severity: "medium",
      check: (ctx) => {
        if (!ctx.toolName) return true;
        return this.checkRate(
          `tool_hourly:${ctx.userId || "global"}`,
          3600 * 1000,
          this.config.maxToolsPerHour
        );
      },
      failMessage: `Tool execution hourly limit exceeded (${this.config.maxToolsPerHour}/hr).`,
    });

    // Rate limit: messages per minute
    this.checks.push({
      name: "message_rate_limit",
      description: "Limits messages per minute",
      severity: "medium",
      check: (ctx) => {
        if (ctx.action !== "send_message") return true;
        return this.checkRate(
          `msg:${ctx.userId || "global"}`,
          60 * 1000,
          this.config.maxMessagesPerMinute
        );
      },
      failMessage: `Message rate limit exceeded (${this.config.maxMessagesPerMinute}/min).`,
    });

    // Command injection check
    this.checks.push({
      name: "command_injection",
      description: "Prevents command injection in tool inputs",
      severity: "critical",
      check: (ctx) => {
        if (!ctx.input) return true;
        const dangerousPatterns = [
          /;\s*(rm|del|format|mkfs|dd)\s/i,
          /\|\s*(bash|sh|cmd|powershell)/i,
          /`[^`]*`/,
          /\$\([^)]*\)/,
          />\s*\/dev\//i,
        ];
        const inputStr = JSON.stringify(ctx.input);
        return !dangerousPatterns.some((p) => p.test(inputStr));
      },
      failMessage: "Potential command injection detected in input.",
    });

    // Sensitive data check
    this.checks.push({
      name: "sensitive_data",
      description: "Prevents leaking sensitive data patterns",
      severity: "high",
      check: (ctx) => {
        if (!ctx.input) return true;
        const sensitivePatterns = [
          /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // credit card
          /\b\d{3}-\d{2}-\d{4}\b/, // SSN
          /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, // private key
        ];
        const inputStr = JSON.stringify(ctx.input);
        return !sensitivePatterns.some((p) => p.test(inputStr));
      },
      failMessage: "Sensitive data pattern detected in input.",
    });
  }

  private checkRate(key: string, windowMs: number, maxCount: number): boolean {
    const now = Date.now();
    let entry = rateTracker.get(key);

    if (!entry) {
      entry = { timestamps: [] };
      rateTracker.set(key, entry);
    }

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    return entry.timestamps.length < maxCount;
  }

  private recordRate(key: string): void {
    let entry = rateTracker.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      rateTracker.set(key, entry);
    }
    entry.timestamps.push(Date.now());
  }

  /**
   * Evaluate all risk checks for an action
   * This is the main entry point - NON-BYPASSABLE
   */
  async evaluate(context: RiskContext): Promise<RiskDecision> {
    const results: RiskDecision["checks"] = [];
    let allowed = true;

    for (const check of this.checks) {
      let passed: boolean;
      try {
        passed = await check.check(context);
      } catch {
        passed = false;
      }

      results.push({
        name: check.name,
        passed,
        severity: check.severity,
        message: passed ? undefined : check.failMessage,
      });

      if (!passed && (check.severity === "critical" || check.severity === "high")) {
        allowed = false;
      }
    }

    const decision: RiskDecision = {
      allowed,
      checks: results,
      timestamp: new Date(),
      context,
    };

    // Record in audit log
    auditLog.push(decision);
    if (auditLog.length > 10000) {
      auditLog.splice(0, auditLog.length - 5000);
    }

    // Record rate tracking if allowed
    if (allowed) {
      if (context.toolName) {
        this.recordRate(`tool:${context.userId || "global"}`);
        this.recordRate(`tool_hourly:${context.userId || "global"}`);
      }
      if (context.action === "send_message") {
        this.recordRate(`msg:${context.userId || "global"}`);
      }
      if (context.estimatedCost) {
        this.recordCost(context.userId || "global", context.estimatedCost);
      }
    }

    return decision;
  }

  private recordCost(userId: string, cost: number): void {
    const now = Date.now();
    const hourMs = 3600 * 1000;
    const dayMs = 86400 * 1000;

    // Hourly
    let hourly = costTracker.hourly.get(userId);
    if (!hourly || now - hourly.windowStart > hourMs) {
      hourly = { total: 0, windowStart: now };
      costTracker.hourly.set(userId, hourly);
    }
    hourly.total += cost;

    // Daily
    let daily = costTracker.daily.get(userId);
    if (!daily || now - daily.windowStart > dayMs) {
      daily = { total: 0, windowStart: now };
      costTracker.daily.set(userId, daily);
    }
    daily.total += cost;
  }

  /**
   * Add a custom risk check
   */
  addCheck(check: RiskCheck): void {
    this.checks.push(check);
  }

  /**
   * Activate kill switch
   */
  activateKillSwitch(): void {
    this.config.killSwitch = true;
  }

  /**
   * Deactivate kill switch
   */
  deactivateKillSwitch(): void {
    this.config.killSwitch = false;
  }

  /**
   * Enable safe mode
   */
  enableSafeMode(): void {
    this.config.safeMode = true;
  }

  /**
   * Disable safe mode
   */
  disableSafeMode(): void {
    this.config.safeMode = false;
  }

  /**
   * Block a tool
   */
  blockTool(toolName: string): void {
    if (!this.config.blockedTools.includes(toolName)) {
      this.config.blockedTools.push(toolName);
    }
  }

  /**
   * Unblock a tool
   */
  unblockTool(toolName: string): void {
    this.config.blockedTools = this.config.blockedTools.filter(
      (t) => t !== toolName
    );
  }

  /**
   * Get recent audit log
   */
  getAuditLog(limit = 100): RiskDecision[] {
    return auditLog.slice(-limit);
  }

  /**
   * Get current configuration
   */
  getConfig(): RiskConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RiskConfig>): void {
    Object.assign(this.config, updates);
  }
}

/** Singleton risk engine instance */
export const riskEngine = new RiskEngine();
