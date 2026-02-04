/**
 * Workflow Actions - Various action types for IFTTT-like automation
 */

import { executeTool } from "../../tools";
import type { TriggerContext } from "./triggers";

// ============================================
// ACTION TYPES
// ============================================

export type ActionType =
  | "send_message"
  | "http_request"
  | "run_tool"
  | "send_email"
  | "set_variable"
  | "delay"
  | "log"
  | "transform"
  | "parallel"
  | "sequence";

export interface BaseAction {
  id: string;
  type: ActionType;
  name: string;
  description?: string;
  // Continue workflow even if this action fails
  continueOnError?: boolean;
  // Retry configuration
  retry?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier?: number;
  };
}

// Send a message (Telegram, Slack, etc.)
export interface SendMessageAction extends BaseAction {
  type: "send_message";
  message: {
    channel: "telegram" | "slack" | "discord" | "webhook";
    // Target ID (chat ID, channel ID, etc.)
    target: string;
    // Message content (supports variable substitution)
    content: string;
    // Optional formatting
    format?: "text" | "markdown" | "html";
    // Optional attachments
    attachments?: Array<{
      type: "image" | "file" | "audio";
      source: string; // URL or path
    }>;
  };
}

// Make an HTTP request
export interface HttpRequestAction extends BaseAction {
  type: "http_request";
  request: {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    // Timeout in milliseconds
    timeout?: number;
    // How to handle the response
    responseHandling?: {
      // Store response in a variable
      storeIn?: string;
      // Expected status codes
      expectedStatus?: number[];
    };
  };
}

// Run a Moltbot tool
export interface RunToolAction extends BaseAction {
  type: "run_tool";
  tool: {
    name: string;
    input: Record<string, unknown>;
    // Store result in variable
    storeResultIn?: string;
  };
}

// Send an email
export interface SendEmailAction extends BaseAction {
  type: "send_email";
  email: {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    body: string;
    bodyType?: "text" | "html";
    attachments?: Array<{
      filename: string;
      path?: string;
      content?: string;
    }>;
  };
}

// Set a workflow variable
export interface SetVariableAction extends BaseAction {
  type: "set_variable";
  variable: {
    name: string;
    // Value can include variable substitution
    value: unknown;
    // Optional transformation
    transform?: "json_parse" | "json_stringify" | "to_number" | "to_string" | "to_boolean";
  };
}

// Add a delay
export interface DelayAction extends BaseAction {
  type: "delay";
  delay: {
    milliseconds: number;
  };
}

// Log a message (for debugging)
export interface LogAction extends BaseAction {
  type: "log";
  log: {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    // Include variables in log
    includeVariables?: boolean;
  };
}

// Transform data
export interface TransformAction extends BaseAction {
  type: "transform";
  transform: {
    // Input variable name
    input: string;
    // Output variable name
    output: string;
    // Transformation operations
    operations: Array<{
      type: "map" | "filter" | "reduce" | "pick" | "omit" | "template";
      // For template: template string with {{variable}} placeholders
      template?: string;
      // For pick/omit: array of keys
      keys?: string[];
      // For map/filter/reduce: expression
      expression?: string;
    }>;
  };
}

// Run actions in parallel
export interface ParallelAction extends BaseAction {
  type: "parallel";
  parallel: {
    actions: Action[];
    // Wait for all actions to complete before continuing
    waitAll?: boolean;
  };
}

// Run actions in sequence
export interface SequenceAction extends BaseAction {
  type: "sequence";
  sequence: {
    actions: Action[];
  };
}

export type Action =
  | SendMessageAction
  | HttpRequestAction
  | RunToolAction
  | SendEmailAction
  | SetVariableAction
  | DelayAction
  | LogAction
  | TransformAction
  | ParallelAction
  | SequenceAction;

// ============================================
// ACTION RESULT
// ============================================

export interface ActionResult {
  actionId: string;
  actionType: ActionType;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  retryCount?: number;
}

// ============================================
// ACTION EXECUTOR
// ============================================

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  triggerContext: TriggerContext;
  variables: Map<string, unknown>;
  // Callback for sending messages
  sendMessage?: (
    channel: string,
    target: string,
    content: string,
    options?: Record<string, unknown>
  ) => Promise<void>;
  // Callback for sending emails
  sendEmail?: (options: SendEmailAction["email"]) => Promise<void>;
}

export class ActionExecutor {
  /**
   * Execute an action
   */
  async execute(action: Action, context: ExecutionContext): Promise<ActionResult> {
    const startTime = Date.now();
    let retryCount = 0;

    while (true) {
      try {
        const result = await this.executeOnce(action, context);
        return {
          actionId: action.id,
          actionType: action.type,
          success: true,
          result,
          durationMs: Date.now() - startTime,
          retryCount,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if we should retry
        if (action.retry && retryCount < action.retry.maxAttempts) {
          retryCount++;
          const delay = action.retry.delayMs * Math.pow(action.retry.backoffMultiplier ?? 1, retryCount - 1);
          await this.sleep(delay);
          continue;
        }

        // No retry or max attempts reached
        if (action.continueOnError) {
          return {
            actionId: action.id,
            actionType: action.type,
            success: false,
            error: errorMessage,
            durationMs: Date.now() - startTime,
            retryCount,
          };
        }

        throw error;
      }
    }
  }

  /**
   * Execute action once (without retry logic)
   */
  private async executeOnce(action: Action, context: ExecutionContext): Promise<unknown> {
    switch (action.type) {
      case "send_message":
        return this.executeSendMessage(action, context);
      case "http_request":
        return this.executeHttpRequest(action, context);
      case "run_tool":
        return this.executeRunTool(action, context);
      case "send_email":
        return this.executeSendEmail(action, context);
      case "set_variable":
        return this.executeSetVariable(action, context);
      case "delay":
        return this.executeDelay(action);
      case "log":
        return this.executeLog(action, context);
      case "transform":
        return this.executeTransform(action, context);
      case "parallel":
        return this.executeParallel(action, context);
      case "sequence":
        return this.executeSequence(action, context);
      default:
        throw new Error(`Unknown action type: ${(action as Action).type}`);
    }
  }

  private async executeSendMessage(
    action: SendMessageAction,
    context: ExecutionContext
  ): Promise<void> {
    const content = this.substituteVariables(action.message.content, context);

    if (context.sendMessage) {
      await context.sendMessage(
        action.message.channel,
        action.message.target,
        content,
        {
          format: action.message.format,
          attachments: action.message.attachments,
        }
      );
    } else {
      console.log(
        `[ActionExecutor] Send message to ${action.message.channel}/${action.message.target}: ${content}`
      );
    }
  }

  private async executeHttpRequest(
    action: HttpRequestAction,
    context: ExecutionContext
  ): Promise<unknown> {
    const { request } = action;
    const url = this.substituteVariables(request.url, context);
    const headers = request.headers
      ? Object.fromEntries(
          Object.entries(request.headers).map(([k, v]) => [
            k,
            this.substituteVariables(v, context),
          ])
        )
      : {};

    let body: string | undefined;
    if (request.body) {
      if (typeof request.body === "string") {
        body = this.substituteVariables(request.body, context);
      } else {
        body = JSON.stringify(this.substituteObjectVariables(request.body, context));
      }
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    const controller = new AbortController();
    const timeout = request.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: request.method,
        headers,
        body,
        signal: controller.signal,
      });

      // Check expected status
      if (
        request.responseHandling?.expectedStatus &&
        !request.responseHandling.expectedStatus.includes(response.status)
      ) {
        throw new Error(
          `Unexpected status ${response.status}, expected one of: ${request.responseHandling.expectedStatus.join(", ")}`
        );
      }

      let responseData: unknown;
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Store in variable if requested
      if (request.responseHandling?.storeIn) {
        context.variables.set(request.responseHandling.storeIn, responseData);
      }

      return responseData;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async executeRunTool(
    action: RunToolAction,
    context: ExecutionContext
  ): Promise<unknown> {
    const input = this.substituteObjectVariables(action.tool.input, context);

    const result = await executeTool(action.tool.name, input as Record<string, unknown>);

    if (!result.success) {
      throw new Error(result.error || `Tool ${action.tool.name} failed`);
    }

    if (action.tool.storeResultIn) {
      context.variables.set(action.tool.storeResultIn, result.result);
    }

    return result.result;
  }

  private async executeSendEmail(
    action: SendEmailAction,
    context: ExecutionContext
  ): Promise<void> {
    const emailOptions = {
      ...action.email,
      subject: this.substituteVariables(action.email.subject, context),
      body: this.substituteVariables(action.email.body, context),
    };

    if (context.sendEmail) {
      await context.sendEmail(emailOptions);
    } else {
      console.log(`[ActionExecutor] Send email to ${action.email.to}: ${emailOptions.subject}`);
    }
  }

  private executeSetVariable(
    action: SetVariableAction,
    context: ExecutionContext
  ): void {
    let value = action.variable.value;

    // Substitute variables in value if it's a string
    if (typeof value === "string") {
      value = this.substituteVariables(value, context);
    }

    // Apply transformation if specified
    if (action.variable.transform) {
      switch (action.variable.transform) {
        case "json_parse":
          value = JSON.parse(value as string);
          break;
        case "json_stringify":
          value = JSON.stringify(value);
          break;
        case "to_number":
          value = Number(value);
          break;
        case "to_string":
          value = String(value);
          break;
        case "to_boolean":
          value = Boolean(value);
          break;
      }
    }

    context.variables.set(action.variable.name, value);
  }

  private async executeDelay(action: DelayAction): Promise<void> {
    await this.sleep(action.delay.milliseconds);
  }

  private executeLog(action: LogAction, context: ExecutionContext): void {
    const message = this.substituteVariables(action.log.message, context);

    let logData: string = message;
    if (action.log.includeVariables) {
      const vars = Object.fromEntries(context.variables);
      logData = `${message} | Variables: ${JSON.stringify(vars)}`;
    }

    switch (action.log.level) {
      case "debug":
        console.debug(`[Workflow ${context.workflowId}]`, logData);
        break;
      case "info":
        console.info(`[Workflow ${context.workflowId}]`, logData);
        break;
      case "warn":
        console.warn(`[Workflow ${context.workflowId}]`, logData);
        break;
      case "error":
        console.error(`[Workflow ${context.workflowId}]`, logData);
        break;
    }
  }

  private executeTransform(
    action: TransformAction,
    context: ExecutionContext
  ): unknown {
    let value = context.variables.get(action.transform.input);

    for (const op of action.transform.operations) {
      switch (op.type) {
        case "template":
          if (op.template) {
            value = this.substituteVariables(op.template, context);
          }
          break;

        case "pick":
          if (op.keys && typeof value === "object" && value !== null) {
            const picked: Record<string, unknown> = {};
            for (const key of op.keys) {
              if (key in value) {
                picked[key] = (value as Record<string, unknown>)[key];
              }
            }
            value = picked;
          }
          break;

        case "omit":
          if (op.keys && typeof value === "object" && value !== null) {
            const omitted = { ...(value as Record<string, unknown>) };
            for (const key of op.keys) {
              delete omitted[key];
            }
            value = omitted;
          }
          break;

        case "map":
        case "filter":
        case "reduce":
          // These would require safe expression evaluation
          console.warn(`[ActionExecutor] ${op.type} transformation not fully implemented`);
          break;
      }
    }

    context.variables.set(action.transform.output, value);
    return value;
  }

  private async executeParallel(
    action: ParallelAction,
    context: ExecutionContext
  ): Promise<ActionResult[]> {
    const promises = action.parallel.actions.map((a) => this.execute(a, context));

    if (action.parallel.waitAll) {
      return Promise.all(promises);
    }

    // Return results as they complete
    const results: ActionResult[] = [];
    for (const promise of promises) {
      try {
        results.push(await promise);
      } catch (error) {
        results.push({
          actionId: "unknown",
          actionType: "parallel",
          success: false,
          error: error instanceof Error ? error.message : String(error),
          durationMs: 0,
        });
      }
    }
    return results;
  }

  private async executeSequence(
    action: SequenceAction,
    context: ExecutionContext
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];

    for (const a of action.sequence.actions) {
      const result = await this.execute(a, context);
      results.push(result);

      // Stop if action failed and continueOnError is not set
      if (!result.success && !a.continueOnError) {
        break;
      }
    }

    return results;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private substituteVariables(template: string, context: ExecutionContext): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, varPath) => {
      const value = this.resolveVariable(varPath.trim(), context);
      return value !== undefined ? String(value) : match;
    });
  }

  private substituteObjectVariables(
    obj: unknown,
    context: ExecutionContext
  ): unknown {
    if (typeof obj === "string") {
      return this.substituteVariables(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.substituteObjectVariables(item, context));
    }

    if (typeof obj === "object" && obj !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.substituteObjectVariables(value, context);
      }
      return result;
    }

    return obj;
  }

  private resolveVariable(path: string, context: ExecutionContext): unknown {
    const parts = path.split(".");
    const root = parts[0];

    let value: unknown;

    // Check built-in variables
    if (root === "trigger") {
      value = context.triggerContext;
    } else if (root === "workflow") {
      value = { id: context.workflowId, executionId: context.executionId };
    } else if (root === "timestamp") {
      return new Date().toISOString();
    } else if (root === "date") {
      return new Date().toLocaleDateString();
    } else if (root === "time") {
      return new Date().toLocaleTimeString();
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// ACTION BUILDERS
// ============================================

export function createSendMessageAction(
  id: string,
  name: string,
  message: SendMessageAction["message"],
  options?: Partial<BaseAction>
): SendMessageAction {
  return {
    id,
    type: "send_message",
    name,
    message,
    ...options,
  };
}

export function createHttpRequestAction(
  id: string,
  name: string,
  request: HttpRequestAction["request"],
  options?: Partial<BaseAction>
): HttpRequestAction {
  return {
    id,
    type: "http_request",
    name,
    request,
    ...options,
  };
}

export function createRunToolAction(
  id: string,
  name: string,
  tool: RunToolAction["tool"],
  options?: Partial<BaseAction>
): RunToolAction {
  return {
    id,
    type: "run_tool",
    name,
    tool,
    ...options,
  };
}

export function createSendEmailAction(
  id: string,
  name: string,
  email: SendEmailAction["email"],
  options?: Partial<BaseAction>
): SendEmailAction {
  return {
    id,
    type: "send_email",
    name,
    email,
    ...options,
  };
}

export function createSetVariableAction(
  id: string,
  name: string,
  variable: SetVariableAction["variable"],
  options?: Partial<BaseAction>
): SetVariableAction {
  return {
    id,
    type: "set_variable",
    name,
    variable,
    ...options,
  };
}

export function createDelayAction(
  id: string,
  name: string,
  milliseconds: number,
  options?: Partial<BaseAction>
): DelayAction {
  return {
    id,
    type: "delay",
    name,
    delay: { milliseconds },
    ...options,
  };
}

export function createLogAction(
  id: string,
  name: string,
  log: LogAction["log"],
  options?: Partial<BaseAction>
): LogAction {
  return {
    id,
    type: "log",
    name,
    log,
    ...options,
  };
}

export function createTransformAction(
  id: string,
  name: string,
  transform: TransformAction["transform"],
  options?: Partial<BaseAction>
): TransformAction {
  return {
    id,
    type: "transform",
    name,
    transform,
    ...options,
  };
}

export function createParallelAction(
  id: string,
  name: string,
  actions: Action[],
  options?: Partial<BaseAction> & { waitAll?: boolean }
): ParallelAction {
  return {
    id,
    type: "parallel",
    name,
    parallel: {
      actions,
      waitAll: options?.waitAll,
    },
    ...options,
  };
}

export function createSequenceAction(
  id: string,
  name: string,
  actions: Action[],
  options?: Partial<BaseAction>
): SequenceAction {
  return {
    id,
    type: "sequence",
    name,
    sequence: { actions },
    ...options,
  };
}

// Singleton executor
export const actionExecutor = new ActionExecutor();
