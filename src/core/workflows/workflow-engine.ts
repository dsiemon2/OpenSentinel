/**
 * Workflow Engine - Execute workflows
 */

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type { Trigger, TriggerContext } from "./triggers";
import type { Action, ActionResult, ExecutionContext } from "./actions";
import type { Condition, ConditionalBranch } from "./conditions";
import { triggerManager } from "./triggers";
import { actionExecutor } from "./actions";
import { conditionEvaluator } from "./conditions";

// ============================================
// WORKFLOW TYPES
// ============================================

export type WorkflowStatus = "active" | "paused" | "disabled" | "error";

export interface WorkflowStep {
  id: string;
  // Step can be an action or a conditional branch
  type: "action" | "condition";
  // For action type
  action?: Action;
  // For condition type
  branch?: ConditionalBranch<WorkflowStep>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  // User who owns this workflow
  userId?: string;
  // Workflow status
  status: WorkflowStatus;
  // Trigger(s) that start this workflow
  triggers: Trigger[];
  // Steps to execute (in order)
  steps: WorkflowStep[];
  // Default variables available to the workflow
  variables?: Record<string, unknown>;
  // Metadata
  metadata?: Record<string, unknown>;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Last execution info
  lastExecutedAt?: Date;
  lastExecutionId?: string;
  lastExecutionStatus?: "success" | "failure" | "partial";
  // Execution count
  executionCount: number;
  // Error handling
  onError?: {
    // What to do when an error occurs
    action: "stop" | "continue" | "retry";
    // Notify on error
    notify?: {
      channel: string;
      target: string;
    };
    // Max retries if action is 'retry'
    maxRetries?: number;
  };
  // Rate limiting
  rateLimit?: {
    maxExecutions: number;
    windowMs: number;
  };
  // Tags for organization
  tags?: string[];
}

// ============================================
// EXECUTION TYPES
// ============================================

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  triggerContext: TriggerContext;
  stepResults: StepResult[];
  variables: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
}

export interface StepResult {
  stepId: string;
  stepType: "action" | "condition";
  conditionResult?: boolean;
  actionResults?: ActionResult[];
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  error?: string;
}

// ============================================
// WORKFLOW ENGINE
// ============================================

export class WorkflowEngine extends EventEmitter {
  private workflows = new Map<string, Workflow>();
  private executions = new Map<string, WorkflowExecution>();
  private executionHistory: WorkflowExecution[] = [];
  private rateLimitTracking = new Map<string, { count: number; windowStart: number }>();

  // Callbacks for external integrations
  private sendMessageCallback?: (
    channel: string,
    target: string,
    content: string,
    options?: Record<string, unknown>
  ) => Promise<void>;

  private sendEmailCallback?: (
    options: {
      to: string | string[];
      subject: string;
      body: string;
      bodyType?: "text" | "html";
    }
  ) => Promise<void>;

  constructor() {
    super();
    this.setupTriggerListener();
  }

  /**
   * Set the message sending callback
   */
  setSendMessageCallback(
    callback: (
      channel: string,
      target: string,
      content: string,
      options?: Record<string, unknown>
    ) => Promise<void>
  ): void {
    this.sendMessageCallback = callback;
  }

  /**
   * Set the email sending callback
   */
  setSendEmailCallback(
    callback: (options: {
      to: string | string[];
      subject: string;
      body: string;
      bodyType?: "text" | "html";
    }) => Promise<void>
  ): void {
    this.sendEmailCallback = callback;
  }

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);

    // Register triggers
    if (workflow.status === "active") {
      for (const trigger of workflow.triggers) {
        triggerManager.registerTrigger(trigger);
      }
    }

    this.emit("workflow:registered", workflow);
  }

  /**
   * Unregister a workflow
   */
  unregisterWorkflow(workflowId: string): void {
    const workflow = this.workflows.get(workflowId);
    if (workflow) {
      // Unregister triggers
      for (const trigger of workflow.triggers) {
        triggerManager.unregisterTrigger(trigger.id);
      }
      this.workflows.delete(workflowId);
      this.emit("workflow:unregistered", workflowId);
    }
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get all workflows
   */
  getAllWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Get workflows by user ID
   */
  getWorkflowsByUser(userId: string): Workflow[] {
    return Array.from(this.workflows.values()).filter((w) => w.userId === userId);
  }

  /**
   * Update workflow status
   */
  updateWorkflowStatus(workflowId: string, status: WorkflowStatus): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;

    const previousStatus = workflow.status;
    workflow.status = status;
    workflow.updatedAt = new Date();

    // Handle trigger registration based on status
    if (status === "active" && previousStatus !== "active") {
      for (const trigger of workflow.triggers) {
        triggerManager.registerTrigger(trigger);
      }
    } else if (status !== "active" && previousStatus === "active") {
      for (const trigger of workflow.triggers) {
        triggerManager.unregisterTrigger(trigger.id);
      }
    }

    this.emit("workflow:statusChanged", { workflowId, status, previousStatus });
  }

  /**
   * Execute a workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    data: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const triggerContext: TriggerContext = {
      triggerId: "manual",
      triggerType: "manual",
      triggerName: "Manual Execution",
      timestamp: new Date(),
      data,
    };

    return this.runWorkflow(workflow, triggerContext);
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get execution history for a workflow
   */
  getExecutionHistory(
    workflowId: string,
    limit = 10
  ): WorkflowExecution[] {
    return this.executionHistory
      .filter((e) => e.workflowId === workflowId)
      .slice(-limit);
  }

  /**
   * Cancel a running execution
   */
  cancelExecution(executionId: string): boolean {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === "running") {
      execution.status = "cancelled";
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();
      this.emit("execution:cancelled", execution);
      return true;
    }
    return false;
  }

  /**
   * Shutdown the workflow engine
   */
  shutdown(): void {
    // Cancel all running executions
    for (const execution of this.executions.values()) {
      if (execution.status === "running") {
        execution.status = "cancelled";
      }
    }

    triggerManager.shutdown();
    this.removeAllListeners();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private setupTriggerListener(): void {
    triggerManager.on("trigger", (context: TriggerContext) => {
      this.handleTrigger(context);
    });
  }

  private handleTrigger(context: TriggerContext): void {
    // Find workflows with this trigger
    for (const workflow of this.workflows.values()) {
      if (workflow.status !== "active") continue;

      const matchingTrigger = workflow.triggers.find(
        (t) => t.id === context.triggerId
      );

      if (matchingTrigger) {
        this.runWorkflow(workflow, context).catch((error) => {
          console.error(
            `[WorkflowEngine] Error executing workflow ${workflow.id}:`,
            error
          );
        });
      }
    }
  }

  private async runWorkflow(
    workflow: Workflow,
    triggerContext: TriggerContext
  ): Promise<WorkflowExecution> {
    // Check rate limiting
    if (!this.checkRateLimit(workflow)) {
      throw new Error(`Workflow ${workflow.id} rate limit exceeded`);
    }

    const executionId = uuidv4();
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: "running",
      triggerContext,
      stepResults: [],
      variables: { ...workflow.variables },
      startedAt: new Date(),
    };

    this.executions.set(executionId, execution);
    this.emit("execution:started", execution);

    // Create execution context
    const context: ExecutionContext = {
      workflowId: workflow.id,
      executionId,
      triggerContext,
      variables: new Map(Object.entries(execution.variables)),
      sendMessage: this.sendMessageCallback,
      sendEmail: this.sendEmailCallback,
    };

    try {
      // Execute steps
      for (const step of workflow.steps) {
        // Check if execution was cancelled
        if (execution.status === "cancelled") {
          break;
        }

        const stepResult = await this.executeStep(step, context);
        execution.stepResults.push(stepResult);

        // Check for errors
        if (stepResult.error && workflow.onError?.action === "stop") {
          throw new Error(stepResult.error);
        }
      }

      // Update execution status
      execution.status = execution.stepResults.some((r) => r.error)
        ? "completed" // with partial errors
        : "completed";
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Update workflow stats
      workflow.lastExecutedAt = new Date();
      workflow.lastExecutionId = executionId;
      workflow.lastExecutionStatus = execution.stepResults.some((r) => r.error)
        ? "partial"
        : "success";
      workflow.executionCount++;
      workflow.updatedAt = new Date();

      // Copy final variables back
      execution.variables = Object.fromEntries(context.variables);

      this.emit("execution:completed", execution);
    } catch (error) {
      execution.status = "failed";
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

      // Update workflow stats
      workflow.lastExecutedAt = new Date();
      workflow.lastExecutionId = executionId;
      workflow.lastExecutionStatus = "failure";
      workflow.executionCount++;
      workflow.updatedAt = new Date();

      // Handle error notification
      if (workflow.onError?.notify) {
        this.notifyError(workflow, execution, error);
      }

      this.emit("execution:failed", execution);
    }

    // Add to history and cleanup
    this.executionHistory.push(execution);
    this.cleanupExecutions();

    return execution;
  }

  private async executeStep(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<StepResult> {
    const startedAt = new Date();

    try {
      if (step.type === "action" && step.action) {
        const actionResult = await actionExecutor.execute(step.action, context);

        return {
          stepId: step.id,
          stepType: "action",
          actionResults: [actionResult],
          startedAt,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          error: actionResult.error,
        };
      }

      if (step.type === "condition" && step.branch) {
        const conditionResult = conditionEvaluator.evaluate(
          step.branch.condition,
          context
        );
        const stepsToExecute = conditionResult
          ? step.branch.then
          : step.branch.else ?? [];

        const actionResults: ActionResult[] = [];
        let error: string | undefined;

        for (const subStep of stepsToExecute) {
          const subResult = await this.executeStep(subStep, context);
          if (subResult.actionResults) {
            actionResults.push(...subResult.actionResults);
          }
          if (subResult.error) {
            error = subResult.error;
          }
        }

        return {
          stepId: step.id,
          stepType: "condition",
          conditionResult,
          actionResults,
          startedAt,
          completedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
          error,
        };
      }

      throw new Error(`Invalid step configuration: ${step.id}`);
    } catch (error) {
      return {
        stepId: step.id,
        stepType: step.type,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private checkRateLimit(workflow: Workflow): boolean {
    if (!workflow.rateLimit) return true;

    const now = Date.now();
    const tracking = this.rateLimitTracking.get(workflow.id);

    if (!tracking || now - tracking.windowStart > workflow.rateLimit.windowMs) {
      // Start new window
      this.rateLimitTracking.set(workflow.id, { count: 1, windowStart: now });
      return true;
    }

    if (tracking.count >= workflow.rateLimit.maxExecutions) {
      return false;
    }

    tracking.count++;
    return true;
  }

  private notifyError(
    workflow: Workflow,
    execution: WorkflowExecution,
    error: unknown
  ): void {
    if (!workflow.onError?.notify || !this.sendMessageCallback) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const content = `Workflow "${workflow.name}" (${workflow.id}) failed:\n\n` +
      `Execution ID: ${execution.id}\n` +
      `Error: ${errorMessage}\n` +
      `Trigger: ${execution.triggerContext.triggerName}`;

    this.sendMessageCallback(
      workflow.onError.notify.channel,
      workflow.onError.notify.target,
      content
    ).catch((err) => {
      console.error("[WorkflowEngine] Failed to send error notification:", err);
    });
  }

  private cleanupExecutions(): void {
    // Keep only the last 1000 executions in history
    const maxHistory = 1000;
    if (this.executionHistory.length > maxHistory) {
      this.executionHistory = this.executionHistory.slice(-maxHistory);
    }

    // Remove completed executions from active map after 1 hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, execution] of this.executions) {
      if (
        execution.completedAt &&
        execution.completedAt.getTime() < oneHourAgo
      ) {
        this.executions.delete(id);
      }
    }
  }
}

// ============================================
// WORKFLOW BUILDER
// ============================================

export class WorkflowBuilder {
  private workflow: Partial<Workflow>;
  private steps: WorkflowStep[] = [];

  constructor(id: string, name: string) {
    this.workflow = {
      id,
      name,
      status: "active",
      triggers: [],
      steps: [],
      executionCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  description(description: string): this {
    this.workflow.description = description;
    return this;
  }

  userId(userId: string): this {
    this.workflow.userId = userId;
    return this;
  }

  trigger(trigger: Trigger): this {
    this.workflow.triggers!.push(trigger);
    return this;
  }

  triggers(...triggers: Trigger[]): this {
    this.workflow.triggers!.push(...triggers);
    return this;
  }

  action(action: Action): this {
    this.steps.push({
      id: `step-${this.steps.length + 1}`,
      type: "action",
      action,
    });
    return this;
  }

  condition(branch: ConditionalBranch<WorkflowStep>): this {
    this.steps.push({
      id: `step-${this.steps.length + 1}`,
      type: "condition",
      branch,
    });
    return this;
  }

  variables(variables: Record<string, unknown>): this {
    this.workflow.variables = variables;
    return this;
  }

  onError(config: Workflow["onError"]): this {
    this.workflow.onError = config;
    return this;
  }

  rateLimit(maxExecutions: number, windowMs: number): this {
    this.workflow.rateLimit = { maxExecutions, windowMs };
    return this;
  }

  tags(...tags: string[]): this {
    this.workflow.tags = tags;
    return this;
  }

  metadata(metadata: Record<string, unknown>): this {
    this.workflow.metadata = metadata;
    return this;
  }

  status(status: WorkflowStatus): this {
    this.workflow.status = status;
    return this;
  }

  build(): Workflow {
    this.workflow.steps = this.steps;
    return this.workflow as Workflow;
  }
}

// Helper to create a workflow builder
export function createWorkflow(id: string, name: string): WorkflowBuilder {
  return new WorkflowBuilder(id, name);
}

// Singleton engine instance
export const workflowEngine = new WorkflowEngine();
