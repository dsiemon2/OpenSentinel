/**
 * Workflow Conditions - Conditional logic for IFTTT-like automation
 */

import type { ExecutionContext } from "./actions";

// ============================================
// CONDITION TYPES
// ============================================

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equals"
  | "less_than"
  | "less_than_or_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches"
  | "is_null"
  | "is_not_null"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";

export type LogicalOperator = "and" | "or" | "not";

export interface BaseCondition {
  id: string;
  name?: string;
}

// Simple comparison condition
export interface ComparisonCondition extends BaseCondition {
  type: "comparison";
  comparison: {
    // Left side: variable path or literal
    left: string | { literal: unknown };
    // Operator
    operator: ConditionOperator;
    // Right side: variable path or literal
    right?: string | { literal: unknown };
  };
}

// Logical combination of conditions
export interface LogicalCondition extends BaseCondition {
  type: "logical";
  logical: {
    operator: LogicalOperator;
    conditions: Condition[];
  };
}

// Expression-based condition (JavaScript expression)
export interface ExpressionCondition extends BaseCondition {
  type: "expression";
  expression: string;
}

// Always true/false condition (for testing)
export interface ConstantCondition extends BaseCondition {
  type: "constant";
  value: boolean;
}

export type Condition =
  | ComparisonCondition
  | LogicalCondition
  | ExpressionCondition
  | ConstantCondition;

// ============================================
// CONDITIONAL BRANCH
// ============================================

export interface ConditionalBranch<T> {
  id: string;
  name?: string;
  condition: Condition;
  // Action(s) to execute if condition is true
  then: T[];
  // Action(s) to execute if condition is false (optional)
  else?: T[];
}

// ============================================
// CONDITION EVALUATOR
// ============================================

export class ConditionEvaluator {
  /**
   * Evaluate a condition in the given context
   */
  evaluate(condition: Condition, context: ExecutionContext): boolean {
    switch (condition.type) {
      case "comparison":
        return this.evaluateComparison(condition, context);
      case "logical":
        return this.evaluateLogical(condition, context);
      case "expression":
        return this.evaluateExpression(condition, context);
      case "constant":
        return condition.value;
      default:
        throw new Error(`Unknown condition type: ${(condition as Condition).type}`);
    }
  }

  /**
   * Evaluate a conditional branch
   */
  evaluateBranch<T>(branch: ConditionalBranch<T>, context: ExecutionContext): T[] {
    const result = this.evaluate(branch.condition, context);
    return result ? branch.then : branch.else ?? [];
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private evaluateComparison(
    condition: ComparisonCondition,
    context: ExecutionContext
  ): boolean {
    const { comparison } = condition;

    // Resolve left value
    const leftValue = this.resolveValue(comparison.left, context);

    // For unary operators, we don't need a right value
    if (["is_null", "is_not_null", "is_empty", "is_not_empty"].includes(comparison.operator)) {
      return this.applyUnaryOperator(leftValue, comparison.operator);
    }

    // Resolve right value
    const rightValue = comparison.right !== undefined
      ? this.resolveValue(comparison.right, context)
      : undefined;

    return this.applyOperator(leftValue, comparison.operator, rightValue);
  }

  private evaluateLogical(
    condition: LogicalCondition,
    context: ExecutionContext
  ): boolean {
    const { logical } = condition;

    switch (logical.operator) {
      case "and":
        return logical.conditions.every((c) => this.evaluate(c, context));
      case "or":
        return logical.conditions.some((c) => this.evaluate(c, context));
      case "not":
        // For 'not', we expect exactly one condition
        if (logical.conditions.length !== 1) {
          throw new Error("'not' operator requires exactly one condition");
        }
        return !this.evaluate(logical.conditions[0], context);
      default:
        throw new Error(`Unknown logical operator: ${logical.operator}`);
    }
  }

  private evaluateExpression(
    condition: ExpressionCondition,
    context: ExecutionContext
  ): boolean {
    // Create a safe context object for expression evaluation
    const safeContext = {
      trigger: context.triggerContext,
      variables: Object.fromEntries(context.variables),
      workflow: {
        id: context.workflowId,
        executionId: context.executionId,
      },
    };

    try {
      // Basic safe evaluation (in production, use a proper expression parser)
      // This creates a function with the context variables available
      const fn = new Function(
        "ctx",
        `with (ctx) { return Boolean(${condition.expression}); }`
      );
      return fn(safeContext);
    } catch (error) {
      console.error(
        `[ConditionEvaluator] Expression evaluation failed: ${condition.expression}`,
        error
      );
      return false;
    }
  }

  private resolveValue(
    value: string | { literal: unknown },
    context: ExecutionContext
  ): unknown {
    // If it's a literal, return the value directly
    if (typeof value === "object" && "literal" in value) {
      return value.literal;
    }

    // Otherwise, it's a variable path
    return this.resolveVariablePath(value, context);
  }

  private resolveVariablePath(path: string, context: ExecutionContext): unknown {
    const parts = path.split(".");
    const root = parts[0];

    let value: unknown;

    // Check built-in variables
    if (root === "trigger") {
      value = context.triggerContext;
    } else if (root === "workflow") {
      value = { id: context.workflowId, executionId: context.executionId };
    } else {
      // Check user-defined variables
      value = context.variables.get(root);
    }

    // Resolve nested path
    for (let i = 1; i < parts.length && value !== undefined; i++) {
      if (typeof value === "object" && value !== null) {
        value = (value as Record<string, unknown>)[parts[i]];
      } else {
        return undefined;
      }
    }

    return value;
  }

  private applyUnaryOperator(value: unknown, operator: ConditionOperator): boolean {
    switch (operator) {
      case "is_null":
        return value === null || value === undefined;
      case "is_not_null":
        return value !== null && value !== undefined;
      case "is_empty":
        if (value === null || value === undefined) return true;
        if (typeof value === "string") return value.length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "object") return Object.keys(value).length === 0;
        return false;
      case "is_not_empty":
        if (value === null || value === undefined) return false;
        if (typeof value === "string") return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === "object") return Object.keys(value).length > 0;
        return true;
      default:
        return false;
    }
  }

  private applyOperator(
    left: unknown,
    operator: ConditionOperator,
    right: unknown
  ): boolean {
    switch (operator) {
      case "equals":
        return this.deepEquals(left, right);

      case "not_equals":
        return !this.deepEquals(left, right);

      case "greater_than":
        return this.compareNumbers(left, right) > 0;

      case "greater_than_or_equals":
        return this.compareNumbers(left, right) >= 0;

      case "less_than":
        return this.compareNumbers(left, right) < 0;

      case "less_than_or_equals":
        return this.compareNumbers(left, right) <= 0;

      case "contains":
        if (typeof left === "string" && typeof right === "string") {
          return left.includes(right);
        }
        if (Array.isArray(left)) {
          return left.includes(right);
        }
        return false;

      case "not_contains":
        if (typeof left === "string" && typeof right === "string") {
          return !left.includes(right);
        }
        if (Array.isArray(left)) {
          return !left.includes(right);
        }
        return true;

      case "starts_with":
        return typeof left === "string" && typeof right === "string" && left.startsWith(right);

      case "ends_with":
        return typeof left === "string" && typeof right === "string" && left.endsWith(right);

      case "matches":
        if (typeof left === "string" && typeof right === "string") {
          try {
            return new RegExp(right).test(left);
          } catch {
            return false;
          }
        }
        return false;

      case "in":
        if (Array.isArray(right)) {
          return right.includes(left);
        }
        return false;

      case "not_in":
        if (Array.isArray(right)) {
          return !right.includes(left);
        }
        return true;

      default:
        return false;
    }
  }

  private deepEquals(a: unknown, b: unknown): boolean {
    if (a === b) return true;

    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEquals(val, b[i]));
    }

    if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) =>
        this.deepEquals(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    }

    return false;
  }

  private compareNumbers(a: unknown, b: unknown): number {
    const numA = typeof a === "number" ? a : Number(a);
    const numB = typeof b === "number" ? b : Number(b);

    if (isNaN(numA) || isNaN(numB)) {
      // Fall back to string comparison
      return String(a).localeCompare(String(b));
    }

    return numA - numB;
  }
}

// ============================================
// CONDITION BUILDERS
// ============================================

export function comparison(
  left: string | { literal: unknown },
  operator: ConditionOperator,
  right?: string | { literal: unknown },
  options?: { id?: string; name?: string }
): ComparisonCondition {
  return {
    id: options?.id ?? `condition-${Date.now()}`,
    name: options?.name,
    type: "comparison",
    comparison: {
      left,
      operator,
      right,
    },
  };
}

export function and(
  ...conditions: Condition[]
): LogicalCondition {
  return {
    id: `and-${Date.now()}`,
    type: "logical",
    logical: {
      operator: "and",
      conditions,
    },
  };
}

export function or(
  ...conditions: Condition[]
): LogicalCondition {
  return {
    id: `or-${Date.now()}`,
    type: "logical",
    logical: {
      operator: "or",
      conditions,
    },
  };
}

export function not(condition: Condition): LogicalCondition {
  return {
    id: `not-${Date.now()}`,
    type: "logical",
    logical: {
      operator: "not",
      conditions: [condition],
    },
  };
}

export function expression(
  expr: string,
  options?: { id?: string; name?: string }
): ExpressionCondition {
  return {
    id: options?.id ?? `expr-${Date.now()}`,
    name: options?.name,
    type: "expression",
    expression: expr,
  };
}

export function constant(value: boolean): ConstantCondition {
  return {
    id: `const-${Date.now()}`,
    type: "constant",
    value,
  };
}

// Shorthand condition builders
export const eq = (left: string, right: unknown) =>
  comparison(left, "equals", { literal: right });

export const neq = (left: string, right: unknown) =>
  comparison(left, "not_equals", { literal: right });

export const gt = (left: string, right: number) =>
  comparison(left, "greater_than", { literal: right });

export const gte = (left: string, right: number) =>
  comparison(left, "greater_than_or_equals", { literal: right });

export const lt = (left: string, right: number) =>
  comparison(left, "less_than", { literal: right });

export const lte = (left: string, right: number) =>
  comparison(left, "less_than_or_equals", { literal: right });

export const contains = (left: string, right: string) =>
  comparison(left, "contains", { literal: right });

export const startsWith = (left: string, right: string) =>
  comparison(left, "starts_with", { literal: right });

export const endsWith = (left: string, right: string) =>
  comparison(left, "ends_with", { literal: right });

export const matches = (left: string, pattern: string) =>
  comparison(left, "matches", { literal: pattern });

export const isNull = (left: string) =>
  comparison(left, "is_null");

export const isNotNull = (left: string) =>
  comparison(left, "is_not_null");

export const isEmpty = (left: string) =>
  comparison(left, "is_empty");

export const isNotEmpty = (left: string) =>
  comparison(left, "is_not_empty");

export const isIn = (left: string, values: unknown[]) =>
  comparison(left, "in", { literal: values });

export const isNotIn = (left: string, values: unknown[]) =>
  comparison(left, "not_in", { literal: values });

// Create a conditional branch
export function branch<T>(
  condition: Condition,
  thenActions: T[],
  elseActions?: T[],
  options?: { id?: string; name?: string }
): ConditionalBranch<T> {
  return {
    id: options?.id ?? `branch-${Date.now()}`,
    name: options?.name,
    condition,
    then: thenActions,
    else: elseActions,
  };
}

// Singleton evaluator
export const conditionEvaluator = new ConditionEvaluator();
