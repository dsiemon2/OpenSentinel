/**
 * Logic Rule Automation Engine
 * Ported from Recruiting_AI - generalized for OpenSentinel
 *
 * Provides trigger-condition-action automation:
 * - Define rules with triggers, conditions, and actions
 * - Evaluate conditions against runtime context
 * - Execute actions when conditions match
 * - Priority-based rule ordering
 */

export enum RuleTrigger {
  MESSAGE_RECEIVED = "message.received",
  MESSAGE_SENT = "message.sent",
  TOOL_EXECUTED = "tool.executed",
  TOOL_FAILED = "tool.failed",
  WORKFLOW_COMPLETED = "workflow.completed",
  WORKFLOW_FAILED = "workflow.failed",
  SCHEDULE_DAILY = "schedule.daily",
  SCHEDULE_WEEKLY = "schedule.weekly",
  SCHEDULE_HOURLY = "schedule.hourly",
  WEBHOOK_RECEIVED = "webhook.received",
  MEMORY_STORED = "memory.stored",
  USER_JOINED = "user.joined",
  INTEGRATION_EVENT = "integration.event",
  APPROVAL_REQUIRED = "approval.required",
  APPROVAL_DECIDED = "approval.decided",
  THRESHOLD_EXCEEDED = "threshold.exceeded",
  ERROR_OCCURRED = "error.occurred",
  CUSTOM = "custom",
}

export enum RuleAction {
  SEND_MESSAGE = "send_message",
  SEND_EMAIL = "send_email",
  SEND_SMS = "send_sms",
  TRIGGER_WEBHOOK = "trigger_webhook",
  EXECUTE_TOOL = "execute_tool",
  STORE_MEMORY = "store_memory",
  UPDATE_CONTEXT = "update_context",
  CREATE_TASK = "create_task",
  NOTIFY_USER = "notify_user",
  RUN_WORKFLOW = "run_workflow",
  LOG_EVENT = "log_event",
  CALL_INTEGRATION = "call_integration",
  SPAWN_AGENT = "spawn_agent",
}

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches"
  | "in"
  | "not_in"
  | "is_null"
  | "is_not_null"
  | "between";

export interface RuleCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
  /** Logical grouping: 'and' (default) or 'or' with other conditions */
  logic?: "and" | "or";
}

export interface RuleActionConfig {
  type: RuleAction;
  config: Record<string, unknown>;
  /** Delay in ms before executing this action */
  delay?: number;
  /** Continue to next action even if this one fails */
  continueOnError?: boolean;
}

export interface LogicRule {
  id: string;
  name: string;
  description?: string;
  trigger: RuleTrigger;
  /** Custom trigger name when trigger is CUSTOM */
  customTrigger?: string;
  conditions: RuleCondition[];
  actions: RuleActionConfig[];
  priority: number;
  isActive: boolean;
  userId?: string;
  /** Max executions per hour (0 = unlimited) */
  rateLimit: number;
  /** Tags for filtering */
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// In-memory rule store (can be backed by database)
const rules = new Map<string, LogicRule>();
const executionCounts = new Map<string, { count: number; windowStart: number }>();

let idCounter = 0;
function generateId(): string {
  return `rule_${Date.now()}_${++idCounter}`;
}

/**
 * Create a new logic rule
 */
export function createRule(
  config: Omit<LogicRule, "id" | "createdAt" | "updatedAt">
): LogicRule {
  const rule: LogicRule = {
    ...config,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  rules.set(rule.id, rule);
  return rule;
}

/**
 * Get a rule by ID
 */
export function getRule(id: string): LogicRule | undefined {
  return rules.get(id);
}

/**
 * Update a rule
 */
export function updateRule(
  id: string,
  updates: Partial<Omit<LogicRule, "id" | "createdAt">>
): LogicRule | undefined {
  const rule = rules.get(id);
  if (!rule) return undefined;

  const updated = { ...rule, ...updates, updatedAt: new Date() };
  rules.set(id, updated);
  return updated;
}

/**
 * Delete a rule
 */
export function deleteRule(id: string): boolean {
  return rules.delete(id);
}

/**
 * List rules with optional filters
 */
export function listRules(options: {
  trigger?: RuleTrigger;
  isActive?: boolean;
  userId?: string;
  tags?: string[];
} = {}): LogicRule[] {
  let result = Array.from(rules.values());

  if (options.trigger) {
    result = result.filter((r) => r.trigger === options.trigger);
  }
  if (options.isActive !== undefined) {
    result = result.filter((r) => r.isActive === options.isActive);
  }
  if (options.userId) {
    result = result.filter((r) => !r.userId || r.userId === options.userId);
  }
  if (options.tags?.length) {
    result = result.filter((r) =>
      options.tags!.some((t) => r.tags.includes(t))
    );
  }

  return result.sort((a, b) => b.priority - a.priority);
}

/**
 * Get nested field value from context using dot notation
 */
function getFieldValue(context: Record<string, unknown>, field: string): unknown {
  const parts = field.split(".");
  let current: unknown = context;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * Evaluate a single condition against context
 */
export function evaluateCondition(
  condition: RuleCondition,
  context: Record<string, unknown>
): boolean {
  const value = getFieldValue(context, condition.field);

  switch (condition.operator) {
    case "equals":
      return value === condition.value;
    case "not_equals":
      return value !== condition.value;
    case "greater_than":
      return typeof value === "number" && value > (condition.value as number);
    case "less_than":
      return typeof value === "number" && value < (condition.value as number);
    case "greater_or_equal":
      return typeof value === "number" && value >= (condition.value as number);
    case "less_or_equal":
      return typeof value === "number" && value <= (condition.value as number);
    case "contains":
      if (typeof value === "string") return value.includes(condition.value as string);
      if (Array.isArray(value)) return value.includes(condition.value);
      return false;
    case "not_contains":
      if (typeof value === "string") return !value.includes(condition.value as string);
      if (Array.isArray(value)) return !value.includes(condition.value);
      return true;
    case "starts_with":
      return typeof value === "string" && value.startsWith(condition.value as string);
    case "ends_with":
      return typeof value === "string" && value.endsWith(condition.value as string);
    case "matches":
      return typeof value === "string" && new RegExp(condition.value as string).test(value);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(value);
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(value);
    case "is_null":
      return value === null || value === undefined;
    case "is_not_null":
      return value !== null && value !== undefined;
    case "between": {
      const [min, max] = condition.value as [number, number];
      return typeof value === "number" && value >= min && value <= max;
    }
    default:
      return false;
  }
}

/**
 * Evaluate all conditions for a rule
 */
export function evaluateConditions(
  conditions: RuleCondition[],
  context: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;

  // Group by logic type
  const andConditions = conditions.filter((c) => c.logic !== "or");
  const orConditions = conditions.filter((c) => c.logic === "or");

  const andResult =
    andConditions.length === 0 ||
    andConditions.every((c) => evaluateCondition(c, context));

  const orResult =
    orConditions.length === 0 ||
    orConditions.some((c) => evaluateCondition(c, context));

  return andResult && orResult;
}

/**
 * Check rate limit for a rule
 */
function checkRateLimit(rule: LogicRule): boolean {
  if (rule.rateLimit <= 0) return true;

  const now = Date.now();
  const hourMs = 3600 * 1000;
  const key = rule.id;
  const entry = executionCounts.get(key);

  if (!entry || now - entry.windowStart > hourMs) {
    executionCounts.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= rule.rateLimit) return false;
  entry.count++;
  return true;
}

/**
 * Action executor - integrates with OpenSentinel's tool system
 */
export type ActionExecutor = (
  action: RuleActionConfig,
  context: Record<string, unknown>
) => Promise<void>;

let actionExecutor: ActionExecutor | null = null;

/**
 * Register a custom action executor
 */
export function setActionExecutor(executor: ActionExecutor): void {
  actionExecutor = executor;
}

/**
 * Execute actions for a matched rule
 */
export async function executeRuleActions(
  rule: LogicRule,
  context: Record<string, unknown>
): Promise<{ executed: number; errors: string[] }> {
  let executed = 0;
  const errors: string[] = [];

  for (const action of rule.actions) {
    try {
      if (action.delay) {
        await new Promise((resolve) => setTimeout(resolve, action.delay));
      }

      if (actionExecutor) {
        await actionExecutor(action, context);
      }
      executed++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${action.type}: ${msg}`);
      if (!action.continueOnError) break;
    }
  }

  return { executed, errors };
}

/**
 * Find and execute matching rules for a trigger
 */
export async function processTrigger(
  trigger: RuleTrigger,
  context: Record<string, unknown>,
  customTrigger?: string
): Promise<{
  rulesMatched: number;
  actionsExecuted: number;
  errors: string[];
}> {
  let matchingRules = listRules({ trigger, isActive: true });

  if (trigger === RuleTrigger.CUSTOM && customTrigger) {
    matchingRules = matchingRules.filter(
      (r) => r.customTrigger === customTrigger
    );
  }

  const matched = matchingRules.filter(
    (rule) =>
      evaluateConditions(rule.conditions, context) && checkRateLimit(rule)
  );

  let totalActions = 0;
  const allErrors: string[] = [];

  for (const rule of matched) {
    const result = await executeRuleActions(rule, context);
    totalActions += result.executed;
    allErrors.push(...result.errors);
  }

  return {
    rulesMatched: matched.length,
    actionsExecuted: totalActions,
    errors: allErrors,
  };
}

/**
 * Import rules from JSON
 */
export function importRules(ruleConfigs: Array<Omit<LogicRule, "id" | "createdAt" | "updatedAt">>): LogicRule[] {
  return ruleConfigs.map((config) => createRule(config));
}

/**
 * Export all rules as JSON
 */
export function exportRules(): LogicRule[] {
  return Array.from(rules.values());
}
