/**
 * Workflow Triggers - Various trigger types for IFTTT-like automation
 */

import { EventEmitter } from "events";
import cron from "node-cron";

// ============================================
// TRIGGER TYPES
// ============================================

export type TriggerType =
  | "time"
  | "webhook"
  | "event"
  | "condition"
  | "manual";

export interface BaseTrigger {
  id: string;
  type: TriggerType;
  name: string;
  description?: string;
  enabled: boolean;
}

// Time-based trigger (cron, interval, specific time)
export interface TimeTrigger extends BaseTrigger {
  type: "time";
  schedule: {
    type: "cron" | "interval" | "specific";
    // For cron: cron expression (e.g., "0 9 * * *" for 9 AM daily)
    cronExpression?: string;
    // For interval: milliseconds
    intervalMs?: number;
    // For specific: ISO timestamp or time string
    specificTime?: string;
    // Timezone for time-based triggers
    timezone?: string;
  };
}

// Webhook trigger
export interface WebhookTrigger extends BaseTrigger {
  type: "webhook";
  webhook: {
    // Unique path for the webhook endpoint
    path: string;
    // HTTP method(s) to accept
    methods: ("GET" | "POST" | "PUT" | "DELETE")[];
    // Optional secret for validation
    secret?: string;
    // Filter incoming data with JSONPath or simple key match
    filter?: {
      type: "jsonpath" | "key_match";
      expression: string;
      expectedValue?: unknown;
    };
  };
}

// Event trigger (internal events like message received, email received, etc.)
export interface EventTrigger extends BaseTrigger {
  type: "event";
  event: {
    // Event source (telegram, email, calendar, etc.)
    source: string;
    // Event name
    eventName: string;
    // Filter criteria
    filter?: Record<string, unknown>;
  };
}

// Condition trigger (monitors a condition and triggers when true)
export interface ConditionTrigger extends BaseTrigger {
  type: "condition";
  condition: {
    // Check type
    checkType: "api_response" | "variable" | "expression";
    // For API response checks
    apiEndpoint?: string;
    // Variable name to check
    variableName?: string;
    // Expression to evaluate (JavaScript expression)
    expression?: string;
    // Expected condition
    operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "matches";
    value: unknown;
    // How often to check (ms)
    pollInterval: number;
  };
}

// Manual trigger (triggered explicitly by user)
export interface ManualTrigger extends BaseTrigger {
  type: "manual";
  manual: {
    // Optional input schema for manual trigger
    inputSchema?: Record<string, unknown>;
  };
}

export type Trigger =
  | TimeTrigger
  | WebhookTrigger
  | EventTrigger
  | ConditionTrigger
  | ManualTrigger;

// ============================================
// TRIGGER CONTEXT
// ============================================

export interface TriggerContext {
  triggerId: string;
  triggerType: TriggerType;
  triggerName: string;
  timestamp: Date;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ============================================
// TRIGGER MANAGER
// ============================================

export class TriggerManager extends EventEmitter {
  private triggers = new Map<string, Trigger>();
  private cronJobs = new Map<string, cron.ScheduledTask>();
  private intervals = new Map<string, NodeJS.Timer>();
  private conditionPollers = new Map<string, NodeJS.Timer>();
  private webhookHandlers = new Map<string, WebhookTrigger>();

  constructor() {
    super();
  }

  /**
   * Register a trigger
   */
  registerTrigger(trigger: Trigger): void {
    this.triggers.set(trigger.id, trigger);

    if (trigger.enabled) {
      this.activateTrigger(trigger);
    }
  }

  /**
   * Unregister a trigger
   */
  unregisterTrigger(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      this.deactivateTrigger(trigger);
      this.triggers.delete(triggerId);
    }
  }

  /**
   * Enable a trigger
   */
  enableTrigger(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = true;
      this.activateTrigger(trigger);
    }
  }

  /**
   * Disable a trigger
   */
  disableTrigger(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = false;
      this.deactivateTrigger(trigger);
    }
  }

  /**
   * Get a trigger by ID
   */
  getTrigger(triggerId: string): Trigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all triggers
   */
  getAllTriggers(): Trigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Handle webhook request
   */
  handleWebhook(
    path: string,
    method: string,
    data: Record<string, unknown>,
    headers: Record<string, string>
  ): boolean {
    const webhook = this.webhookHandlers.get(path);
    if (!webhook || !webhook.enabled) {
      return false;
    }

    // Validate method
    if (!webhook.webhook.methods.includes(method as typeof webhook.webhook.methods[number])) {
      return false;
    }

    // Validate secret if configured
    if (webhook.webhook.secret) {
      const providedSecret = headers["x-webhook-secret"] || headers["authorization"];
      if (providedSecret !== webhook.webhook.secret && providedSecret !== `Bearer ${webhook.webhook.secret}`) {
        return false;
      }
    }

    // Apply filter if configured
    if (webhook.webhook.filter) {
      if (!this.evaluateFilter(webhook.webhook.filter, data)) {
        return false;
      }
    }

    // Emit trigger event
    this.emitTrigger(webhook, data);
    return true;
  }

  /**
   * Manually fire a trigger
   */
  fireTrigger(triggerId: string, data: Record<string, unknown> = {}): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger || !trigger.enabled) {
      return false;
    }

    if (trigger.type !== "manual") {
      console.warn(`[TriggerManager] Trigger ${triggerId} is not a manual trigger`);
    }

    this.emitTrigger(trigger, data);
    return true;
  }

  /**
   * Emit event for internal event triggers
   */
  emitEvent(source: string, eventName: string, data: Record<string, unknown>): void {
    for (const trigger of this.triggers.values()) {
      if (
        trigger.type === "event" &&
        trigger.enabled &&
        trigger.event.source === source &&
        trigger.event.eventName === eventName
      ) {
        // Check filter if configured
        if (trigger.event.filter) {
          if (!this.matchesFilter(data, trigger.event.filter)) {
            continue;
          }
        }

        this.emitTrigger(trigger, data);
      }
    }
  }

  /**
   * Shutdown all triggers
   */
  shutdown(): void {
    // Stop all cron jobs
    for (const job of this.cronJobs.values()) {
      job.stop();
    }
    this.cronJobs.clear();

    // Clear all intervals
    for (const interval of this.intervals.values()) {
      clearInterval(interval);
    }
    this.intervals.clear();

    // Clear all condition pollers
    for (const poller of this.conditionPollers.values()) {
      clearInterval(poller);
    }
    this.conditionPollers.clear();

    // Clear webhook handlers
    this.webhookHandlers.clear();

    this.removeAllListeners();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private activateTrigger(trigger: Trigger): void {
    switch (trigger.type) {
      case "time":
        this.activateTimeTrigger(trigger);
        break;
      case "webhook":
        this.activateWebhookTrigger(trigger);
        break;
      case "condition":
        this.activateConditionTrigger(trigger);
        break;
      // Event and Manual triggers don't need activation
    }
  }

  private deactivateTrigger(trigger: Trigger): void {
    switch (trigger.type) {
      case "time":
        this.deactivateTimeTrigger(trigger);
        break;
      case "webhook":
        this.deactivateWebhookTrigger(trigger);
        break;
      case "condition":
        this.deactivateConditionTrigger(trigger);
        break;
    }
  }

  private activateTimeTrigger(trigger: TimeTrigger): void {
    const { schedule } = trigger;

    switch (schedule.type) {
      case "cron":
        if (schedule.cronExpression) {
          const job = cron.schedule(
            schedule.cronExpression,
            () => this.emitTrigger(trigger, { scheduledAt: new Date().toISOString() }),
            { timezone: schedule.timezone }
          );
          this.cronJobs.set(trigger.id, job);
        }
        break;

      case "interval":
        if (schedule.intervalMs) {
          const interval = setInterval(
            () => this.emitTrigger(trigger, { triggeredAt: new Date().toISOString() }),
            schedule.intervalMs
          );
          this.intervals.set(trigger.id, interval);
        }
        break;

      case "specific":
        if (schedule.specificTime) {
          const targetTime = new Date(schedule.specificTime).getTime();
          const now = Date.now();
          const delay = targetTime - now;

          if (delay > 0) {
            const timeout = setTimeout(() => {
              this.emitTrigger(trigger, { scheduledTime: schedule.specificTime });
              this.intervals.delete(trigger.id);
            }, delay);
            this.intervals.set(trigger.id, timeout);
          }
        }
        break;
    }
  }

  private deactivateTimeTrigger(trigger: TimeTrigger): void {
    const cronJob = this.cronJobs.get(trigger.id);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(trigger.id);
    }

    const interval = this.intervals.get(trigger.id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(trigger.id);
    }
  }

  private activateWebhookTrigger(trigger: WebhookTrigger): void {
    this.webhookHandlers.set(trigger.webhook.path, trigger);
  }

  private deactivateWebhookTrigger(trigger: WebhookTrigger): void {
    this.webhookHandlers.delete(trigger.webhook.path);
  }

  private activateConditionTrigger(trigger: ConditionTrigger): void {
    const { condition } = trigger;

    const poller = setInterval(async () => {
      try {
        const result = await this.evaluateCondition(condition);
        if (result) {
          this.emitTrigger(trigger, { conditionMet: true, checkedAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error(`[TriggerManager] Error evaluating condition for ${trigger.id}:`, error);
      }
    }, condition.pollInterval);

    this.conditionPollers.set(trigger.id, poller);
  }

  private deactivateConditionTrigger(trigger: ConditionTrigger): void {
    const poller = this.conditionPollers.get(trigger.id);
    if (poller) {
      clearInterval(poller);
      this.conditionPollers.delete(trigger.id);
    }
  }

  private async evaluateCondition(condition: ConditionTrigger["condition"]): Promise<boolean> {
    let value: unknown;

    switch (condition.checkType) {
      case "api_response":
        if (condition.apiEndpoint) {
          try {
            const response = await fetch(condition.apiEndpoint);
            value = await response.json();
          } catch {
            return false;
          }
        }
        break;

      case "expression":
        if (condition.expression) {
          try {
            // Safe expression evaluation (basic)
            value = this.safeEvaluate(condition.expression);
          } catch {
            return false;
          }
        }
        break;

      case "variable":
        // Variable checks would be implemented with a variable store
        value = undefined;
        break;
    }

    return this.compareValues(value, condition.operator, condition.value);
  }

  private compareValues(
    actual: unknown,
    operator: ConditionTrigger["condition"]["operator"],
    expected: unknown
  ): boolean {
    switch (operator) {
      case "equals":
        return actual === expected;
      case "not_equals":
        return actual !== expected;
      case "greater_than":
        return (actual as number) > (expected as number);
      case "less_than":
        return (actual as number) < (expected as number);
      case "contains":
        if (typeof actual === "string") {
          return actual.includes(expected as string);
        }
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return false;
      case "matches":
        if (typeof actual === "string" && typeof expected === "string") {
          return new RegExp(expected).test(actual);
        }
        return false;
      default:
        return false;
    }
  }

  private evaluateFilter(
    filter: WebhookTrigger["webhook"]["filter"],
    data: Record<string, unknown>
  ): boolean {
    if (!filter) return true;

    switch (filter.type) {
      case "key_match":
        const keys = filter.expression.split(".");
        let value: unknown = data;
        for (const key of keys) {
          if (value && typeof value === "object" && key in value) {
            value = (value as Record<string, unknown>)[key];
          } else {
            return false;
          }
        }
        if (filter.expectedValue !== undefined) {
          return value === filter.expectedValue;
        }
        return value !== undefined && value !== null;

      case "jsonpath":
        // Basic JSONPath support
        try {
          const keys = filter.expression.replace(/^\$\.?/, "").split(".");
          let current: unknown = data;
          for (const key of keys) {
            if (current && typeof current === "object" && key in current) {
              current = (current as Record<string, unknown>)[key];
            } else {
              return false;
            }
          }
          if (filter.expectedValue !== undefined) {
            return current === filter.expectedValue;
          }
          return current !== undefined;
        } catch {
          return false;
        }

      default:
        return true;
    }
  }

  private matchesFilter(data: Record<string, unknown>, filter: Record<string, unknown>): boolean {
    for (const [key, expectedValue] of Object.entries(filter)) {
      const actualValue = data[key];
      if (actualValue !== expectedValue) {
        return false;
      }
    }
    return true;
  }

  private safeEvaluate(expression: string): unknown {
    // Very basic safe evaluation - in production, use a proper expression parser
    // This only supports simple math and comparisons
    const sanitized = expression.replace(/[^0-9+\-*/%().<>=!&|]/g, "");
    if (sanitized !== expression) {
      throw new Error("Invalid expression");
    }
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${sanitized})`)();
  }

  private emitTrigger(trigger: Trigger, data: Record<string, unknown>): void {
    const context: TriggerContext = {
      triggerId: trigger.id,
      triggerType: trigger.type,
      triggerName: trigger.name,
      timestamp: new Date(),
      data,
    };

    this.emit("trigger", context);
    this.emit(`trigger:${trigger.id}`, context);
  }
}

// ============================================
// TRIGGER BUILDERS
// ============================================

export function createTimeTrigger(
  id: string,
  name: string,
  schedule: TimeTrigger["schedule"],
  options?: { description?: string; enabled?: boolean }
): TimeTrigger {
  return {
    id,
    type: "time",
    name,
    description: options?.description,
    enabled: options?.enabled ?? true,
    schedule,
  };
}

export function createWebhookTrigger(
  id: string,
  name: string,
  webhook: WebhookTrigger["webhook"],
  options?: { description?: string; enabled?: boolean }
): WebhookTrigger {
  return {
    id,
    type: "webhook",
    name,
    description: options?.description,
    enabled: options?.enabled ?? true,
    webhook,
  };
}

export function createEventTrigger(
  id: string,
  name: string,
  event: EventTrigger["event"],
  options?: { description?: string; enabled?: boolean }
): EventTrigger {
  return {
    id,
    type: "event",
    name,
    description: options?.description,
    enabled: options?.enabled ?? true,
    event,
  };
}

export function createConditionTrigger(
  id: string,
  name: string,
  condition: ConditionTrigger["condition"],
  options?: { description?: string; enabled?: boolean }
): ConditionTrigger {
  return {
    id,
    type: "condition",
    name,
    description: options?.description,
    enabled: options?.enabled ?? true,
    condition,
  };
}

export function createManualTrigger(
  id: string,
  name: string,
  manual?: ManualTrigger["manual"],
  options?: { description?: string; enabled?: boolean }
): ManualTrigger {
  return {
    id,
    type: "manual",
    name,
    description: options?.description,
    enabled: options?.enabled ?? true,
    manual: manual ?? {},
  };
}

// Singleton instance
export const triggerManager = new TriggerManager();
