/**
 * Task Coordinator - Task delegation and coordination between agents
 *
 * Orchestrates multi-agent workflows, handles task decomposition,
 * dependency management, and result aggregation.
 */

import { EventEmitter } from "events";
import Redis from "ioredis";
import { env } from "../../../config/env";
import { db } from "../../../db";
import { subAgents, agentProgress } from "../../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { AgentType, AgentStatus, AgentResult } from "../agent-types";
import { spawnAgent, getAgent, updateAgentStatus } from "../agent-manager";
import { AgentMessenger, createMessenger } from "./agent-messenger";
import { SharedContext, getOrCreateContext } from "./shared-context";
import { metric } from "../../observability/metrics";
import { audit } from "../../security/audit-logger";

// Task status in the workflow
export type TaskStatus =
  | "pending" // Not yet started
  | "ready" // Dependencies met, ready to run
  | "assigned" // Assigned to an agent
  | "running" // Currently executing
  | "completed" // Successfully completed
  | "failed" // Failed execution
  | "blocked" // Blocked by dependencies
  | "cancelled"; // Cancelled by coordinator

export type TaskPriority = 1 | 2 | 3 | 4 | 5; // 1 = highest

export interface CoordinatedTask {
  id: string;
  name: string;
  description: string;
  objective: string;
  requiredAgentType: AgentType;
  status: TaskStatus;
  priority: TaskPriority;
  dependencies: string[]; // Task IDs that must complete first
  dependents: string[]; // Task IDs that depend on this task
  assignedAgentId?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  result?: AgentResult;
  context: Record<string, unknown>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: TaskMetadata;
}

export interface TaskMetadata {
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
  tokenBudget: number;
  tags: string[];
  estimatedDurationMs?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tasks: TaskDefinition[];
  strategy: WorkflowStrategy;
  onComplete?: (results: Map<string, unknown>) => Promise<void>;
  onError?: (taskId: string, error: Error) => Promise<void>;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  objective: string;
  agentType: AgentType;
  priority?: TaskPriority;
  dependencies?: string[];
  input?: Record<string, unknown>;
  tokenBudget?: number;
  timeoutMs?: number;
  maxRetries?: number;
  tags?: string[];
}

export type WorkflowStrategy =
  | "sequential" // Run tasks one at a time in order
  | "parallel" // Run all independent tasks in parallel
  | "adaptive"; // Dynamically adjust based on results

export interface WorkflowStatus {
  id: string;
  name: string;
  status: TaskStatus;
  progress: number; // 0-100
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRunning: number;
  currentTasks: string[];
  startedAt?: Date;
  completedAt?: Date;
  estimatedTimeRemainingMs?: number;
}

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_TOKEN_BUDGET = 50000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_CONCURRENT_TASKS = 5;

const COORDINATOR_PREFIX = "sentinel:coordinator";

/**
 * TaskCoordinator - Orchestrates multi-agent task execution
 */
export class TaskCoordinator extends EventEmitter {
  private workflowId: string;
  private userId: string;
  private tasks: Map<string, CoordinatedTask>;
  private sharedContext: SharedContext;
  private messengers: Map<string, AgentMessenger>;
  private redis: Redis;
  private status: TaskStatus;
  private strategy: WorkflowStrategy;
  private runningTasks: Set<string>;
  private completedTasks: Set<string>;
  private failedTasks: Set<string>;
  private taskResults: Map<string, unknown>;
  private workflowName: string;
  private workflowDescription: string;

  constructor(workflowId: string, userId: string) {
    super();
    this.workflowId = workflowId;
    this.userId = userId;
    this.tasks = new Map();
    this.messengers = new Map();
    this.status = "pending";
    this.strategy = "parallel";
    this.runningTasks = new Set();
    this.completedTasks = new Set();
    this.failedTasks = new Set();
    this.taskResults = new Map();
    this.workflowName = "";
    this.workflowDescription = "";

    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    this.sharedContext = getOrCreateContext(
      `workflow:${workflowId}`,
      userId
    );
  }

  /**
   * Initialize the coordinator with a workflow definition
   */
  async initialize(workflow: WorkflowDefinition): Promise<void> {
    this.workflowName = workflow.name;
    this.workflowDescription = workflow.description;
    this.strategy = workflow.strategy;

    // Create coordinated tasks from definitions
    for (const taskDef of workflow.tasks) {
      const task = this.createTask(taskDef);
      this.tasks.set(task.id, task);
    }

    // Build dependency graph
    this.buildDependencyGraph();

    // Store workflow state in Redis
    await this.saveState();

    // Initialize shared context with workflow info
    await this.sharedContext.set("workflow_info", {
      id: this.workflowId,
      name: this.workflowName,
      description: this.workflowDescription,
      strategy: this.strategy,
      totalTasks: this.tasks.size,
    }, {
      type: "metadata",
      agentId: "coordinator",
      agentType: "analysis",
      tags: ["workflow", "metadata"],
    });

    this.emit("initialized", { workflowId: this.workflowId });
  }

  /**
   * Start executing the workflow
   */
  async start(): Promise<WorkflowStatus> {
    if (this.status === "running") {
      throw new Error("Workflow is already running");
    }

    this.status = "running";
    this.emit("started", { workflowId: this.workflowId });

    await audit.agentSpawn(this.userId, this.workflowId, "coordinator");

    // Start the execution loop
    await this.executeLoop();

    return this.getStatus();
  }

  /**
   * Main execution loop
   */
  private async executeLoop(): Promise<void> {
    while (this.status === "running") {
      // Check if all tasks are done
      if (this.completedTasks.size + this.failedTasks.size >= this.tasks.size) {
        await this.completeWorkflow();
        return;
      }

      // Get ready tasks
      const readyTasks = this.getReadyTasks();

      // Start tasks up to the concurrency limit
      const tasksToStart = readyTasks.slice(
        0,
        MAX_CONCURRENT_TASKS - this.runningTasks.size
      );

      for (const task of tasksToStart) {
        await this.startTask(task);
      }

      // Wait for some task to complete if we're at capacity
      if (
        this.runningTasks.size >= MAX_CONCURRENT_TASKS ||
        (readyTasks.length === 0 && this.runningTasks.size > 0)
      ) {
        await this.waitForTaskCompletion();
      }

      // Check for deadlock
      if (readyTasks.length === 0 && this.runningTasks.size === 0) {
        const pendingTasks = Array.from(this.tasks.values()).filter(
          (t) => t.status === "pending" || t.status === "blocked"
        );
        if (pendingTasks.length > 0) {
          console.error(
            "[TaskCoordinator] Deadlock detected. Pending tasks:",
            pendingTasks.map((t) => t.id)
          );
          await this.handleDeadlock(pendingTasks);
        }
      }

      // Save state periodically
      await this.saveState();

      // Small delay to prevent tight loop
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  /**
   * Start a specific task
   */
  private async startTask(task: CoordinatedTask): Promise<void> {
    task.status = "running";
    task.startedAt = new Date();
    this.runningTasks.add(task.id);

    this.emit("task:started", { taskId: task.id, task });

    try {
      // Prepare input with dependencies' outputs
      const input = await this.prepareTaskInput(task);

      // Spawn the agent
      const agentId = await spawnAgent({
        userId: this.userId,
        type: task.requiredAgentType,
        objective: task.objective,
        context: {
          ...task.context,
          ...input,
          workflowId: this.workflowId,
          taskId: task.id,
          sharedContextId: this.sharedContext.getId(),
        },
        tokenBudget: task.metadata.tokenBudget,
        timeBudgetMs: task.metadata.timeoutMs,
        name: `${task.name} (${this.workflowName})`,
      });

      task.assignedAgentId = agentId;

      // Create messenger for the agent
      const messenger = createMessenger(
        agentId,
        task.requiredAgentType,
        this.userId
      );
      await messenger.connect();
      this.messengers.set(agentId, messenger);

      // Set up message handlers
      messenger.on("message:status_update", async (msg) => {
        await this.handleAgentStatusUpdate(task.id, msg.payload);
      });

      // Monitor task completion
      this.monitorTask(task);
    } catch (error) {
      await this.handleTaskError(task, error as Error);
    }
  }

  /**
   * Monitor a running task for completion
   */
  private async monitorTask(task: CoordinatedTask): Promise<void> {
    const checkInterval = setInterval(async () => {
      if (!task.assignedAgentId) {
        clearInterval(checkInterval);
        return;
      }

      const agent = await getAgent(task.assignedAgentId);
      if (!agent) {
        clearInterval(checkInterval);
        await this.handleTaskError(task, new Error("Agent not found"));
        return;
      }

      if (agent.status === "completed") {
        clearInterval(checkInterval);
        await this.handleTaskComplete(task, agent.result!);
      } else if (agent.status === "failed") {
        clearInterval(checkInterval);
        await this.handleTaskError(
          task,
          new Error(agent.result?.error || "Agent failed")
        );
      } else if (agent.status === "cancelled") {
        clearInterval(checkInterval);
        await this.handleTaskCancelled(task);
      }
    }, 1000);

    // Set timeout
    setTimeout(async () => {
      clearInterval(checkInterval);
      if (task.status === "running") {
        await this.handleTaskTimeout(task);
      }
    }, task.metadata.timeoutMs);
  }

  /**
   * Handle task completion
   */
  private async handleTaskComplete(
    task: CoordinatedTask,
    result: AgentResult
  ): Promise<void> {
    task.status = "completed";
    task.completedAt = new Date();
    task.result = result;
    task.output = result.output;

    this.runningTasks.delete(task.id);
    this.completedTasks.add(task.id);
    this.taskResults.set(task.id, result.output);

    // Store output in shared context
    await this.sharedContext.set(`task:${task.id}:output`, result.output, {
      type: "artifact",
      agentId: task.assignedAgentId || "coordinator",
      agentType: task.requiredAgentType,
      tags: ["task_output", task.id],
      metadata: {
        taskName: task.name,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
      },
    });

    // Cleanup messenger
    if (task.assignedAgentId) {
      const messenger = this.messengers.get(task.assignedAgentId);
      if (messenger) {
        await messenger.disconnect();
        this.messengers.delete(task.assignedAgentId);
      }
    }

    // Update dependent tasks status
    for (const dependentId of task.dependents) {
      const dependent = this.tasks.get(dependentId);
      if (dependent && dependent.status === "blocked") {
        if (this.areDependenciesMet(dependent)) {
          dependent.status = "ready";
        }
      }
    }

    this.emit("task:completed", { taskId: task.id, result });
    metric.agentOperation("complete", task.requiredAgentType);
  }

  /**
   * Handle task error
   */
  private async handleTaskError(
    task: CoordinatedTask,
    error: Error
  ): Promise<void> {
    task.metadata.retryCount++;

    if (task.metadata.retryCount <= task.metadata.maxRetries) {
      // Retry the task
      console.log(
        `[TaskCoordinator] Retrying task ${task.id} (attempt ${task.metadata.retryCount}/${task.metadata.maxRetries})`
      );
      task.status = "ready";
      this.runningTasks.delete(task.id);
      this.emit("task:retry", { taskId: task.id, error, attempt: task.metadata.retryCount });
    } else {
      // Mark as failed
      task.status = "failed";
      task.completedAt = new Date();
      task.result = {
        success: false,
        error: error.message,
        tokensUsed: 0,
        durationMs: task.startedAt
          ? Date.now() - task.startedAt.getTime()
          : 0,
      };

      this.runningTasks.delete(task.id);
      this.failedTasks.add(task.id);

      // Cleanup messenger
      if (task.assignedAgentId) {
        const messenger = this.messengers.get(task.assignedAgentId);
        if (messenger) {
          await messenger.disconnect();
          this.messengers.delete(task.assignedAgentId);
        }
      }

      // Mark dependent tasks as blocked
      for (const dependentId of task.dependents) {
        const dependent = this.tasks.get(dependentId);
        if (dependent) {
          dependent.status = "blocked";
        }
      }

      this.emit("task:failed", { taskId: task.id, error });
      metric.error("task_coordinator");
    }
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(task: CoordinatedTask): Promise<void> {
    if (task.assignedAgentId) {
      await updateAgentStatus(task.assignedAgentId, "cancelled", {
        success: false,
        error: "Task timed out",
        tokensUsed: 0,
        durationMs: task.metadata.timeoutMs,
      });
    }

    await this.handleTaskError(
      task,
      new Error(`Task timed out after ${task.metadata.timeoutMs}ms`)
    );
  }

  /**
   * Handle task cancellation
   */
  private async handleTaskCancelled(task: CoordinatedTask): Promise<void> {
    task.status = "cancelled";
    task.completedAt = new Date();

    this.runningTasks.delete(task.id);

    // Cleanup messenger
    if (task.assignedAgentId) {
      const messenger = this.messengers.get(task.assignedAgentId);
      if (messenger) {
        await messenger.disconnect();
        this.messengers.delete(task.assignedAgentId);
      }
    }

    this.emit("task:cancelled", { taskId: task.id });
  }

  /**
   * Handle deadlock situation
   */
  private async handleDeadlock(pendingTasks: CoordinatedTask[]): Promise<void> {
    // Find tasks with failed dependencies
    const tasksWithFailedDeps = pendingTasks.filter((task) =>
      task.dependencies.some((depId) => this.failedTasks.has(depId))
    );

    // Mark them as failed due to dependency failure
    for (const task of tasksWithFailedDeps) {
      task.status = "failed";
      task.result = {
        success: false,
        error: "Dependency task failed",
        tokensUsed: 0,
        durationMs: 0,
      };
      this.failedTasks.add(task.id);
    }

    // If still deadlocked, check for circular dependencies (should not happen if graph is built correctly)
    const remainingPending = pendingTasks.filter(
      (t) => !tasksWithFailedDeps.includes(t)
    );
    if (remainingPending.length > 0 && this.runningTasks.size === 0) {
      console.error(
        "[TaskCoordinator] Circular dependency detected or other deadlock condition"
      );
      this.status = "failed";
      this.emit("workflow:deadlock", {
        workflowId: this.workflowId,
        pendingTasks: remainingPending.map((t) => t.id),
      });
    }
  }

  /**
   * Complete the workflow
   */
  private async completeWorkflow(): Promise<void> {
    const hasFailures = this.failedTasks.size > 0;
    this.status = hasFailures ? "failed" : "completed";

    // Aggregate results
    const aggregatedOutput: Record<string, unknown> = {};
    this.taskResults.forEach((output, taskId) => {
      const task = this.tasks.get(taskId);
      if (task) {
        aggregatedOutput[task.name] = output;
      }
    });

    // Store final result in shared context
    await this.sharedContext.set("workflow_result", {
      status: this.status,
      completedTasks: Array.from(this.completedTasks),
      failedTasks: Array.from(this.failedTasks),
      outputs: aggregatedOutput,
    }, {
      type: "artifact",
      agentId: "coordinator",
      agentType: "analysis",
      tags: ["workflow", "result", "final"],
    });

    // Persist important context to long-term memory
    const importantEntries = await this.sharedContext.query({
      type: ["finding", "decision", "artifact"],
    });
    if (importantEntries.length > 0) {
      await this.sharedContext.persistToMemory(importantEntries, {
        memoryType: "episodic",
        importance: 7,
      });
    }

    this.emit(hasFailures ? "workflow:failed" : "workflow:completed", {
      workflowId: this.workflowId,
      status: this.getStatus(),
      results: this.taskResults,
    });

    // Cleanup
    await this.cleanup();
  }

  /**
   * Cancel the workflow
   */
  async cancel(): Promise<void> {
    this.status = "cancelled";

    // Cancel all running tasks
    const runningTaskIds = Array.from(this.runningTasks);
    for (const taskId of runningTaskIds) {
      const task = this.tasks.get(taskId);
      if (task?.assignedAgentId) {
        await updateAgentStatus(task.assignedAgentId, "cancelled", {
          success: false,
          error: "Workflow cancelled",
          tokensUsed: 0,
          durationMs: task.startedAt
            ? Date.now() - task.startedAt.getTime()
            : 0,
        });
      }
    }

    this.emit("workflow:cancelled", { workflowId: this.workflowId });
    await this.cleanup();
  }

  /**
   * Get workflow status
   */
  getStatus(): WorkflowStatus {
    const tasks: CoordinatedTask[] = [];
    this.tasks.forEach((task) => tasks.push(task));
    const completed = tasks.filter((t) => t.status === "completed").length;
    const failed = tasks.filter((t) => t.status === "failed").length;
    const running = tasks.filter((t) => t.status === "running").length;

    const progress =
      tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    return {
      id: this.workflowId,
      name: this.workflowName,
      status: this.status,
      progress,
      tasksTotal: tasks.length,
      tasksCompleted: completed,
      tasksFailed: failed,
      tasksRunning: running,
      currentTasks: Array.from(this.runningTasks),
      startedAt: tasks.find((t) => t.startedAt)?.startedAt,
      completedAt:
        this.status === "completed" || this.status === "failed"
          ? new Date()
          : undefined,
    };
  }

  /**
   * Get a specific task
   */
  getTask(taskId: string): CoordinatedTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): CoordinatedTask[] {
    const tasks: CoordinatedTask[] = [];
    this.tasks.forEach((task) => tasks.push(task));
    return tasks;
  }

  /**
   * Get the shared context
   */
  getSharedContext(): SharedContext {
    return this.sharedContext;
  }

  /**
   * Get task results
   */
  getResults(): Map<string, unknown> {
    return new Map(this.taskResults);
  }

  // Private helper methods

  private createTask(def: TaskDefinition): CoordinatedTask {
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      objective: def.objective,
      requiredAgentType: def.agentType,
      status: "pending",
      priority: def.priority || 3,
      dependencies: def.dependencies || [],
      dependents: [],
      input: def.input,
      context: {},
      createdAt: new Date(),
      metadata: {
        retryCount: 0,
        maxRetries: def.maxRetries ?? DEFAULT_MAX_RETRIES,
        timeoutMs: def.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        tokenBudget: def.tokenBudget ?? DEFAULT_TOKEN_BUDGET,
        tags: def.tags || [],
      },
    };
  }

  private buildDependencyGraph(): void {
    // Build dependents list (reverse of dependencies)
    this.tasks.forEach((task) => {
      for (const depId of task.dependencies) {
        const dependency = this.tasks.get(depId);
        if (dependency) {
          dependency.dependents.push(task.id);
        }
      }
    });

    // Mark tasks with unmet dependencies as blocked
    this.tasks.forEach((task) => {
      if (task.dependencies.length > 0) {
        task.status = "blocked";
      } else {
        task.status = "ready";
      }
    });
  }

  private getReadyTasks(): CoordinatedTask[] {
    const ready = Array.from(this.tasks.values())
      .filter((t) => t.status === "ready" || t.status === "pending")
      .filter((t) => this.areDependenciesMet(t));

    // Sort by priority (lower number = higher priority)
    return ready.sort((a, b) => a.priority - b.priority);
  }

  private areDependenciesMet(task: CoordinatedTask): boolean {
    return task.dependencies.every((depId) => this.completedTasks.has(depId));
  }

  private async prepareTaskInput(
    task: CoordinatedTask
  ): Promise<Record<string, unknown>> {
    const input: Record<string, unknown> = { ...task.input };

    // Add outputs from dependencies
    for (const depId of task.dependencies) {
      const depOutput = this.taskResults.get(depId);
      if (depOutput !== undefined) {
        const depTask = this.tasks.get(depId);
        const key = depTask?.name.toLowerCase().replace(/\s+/g, "_") || depId;
        input[`dependency_${key}`] = depOutput;
      }
    }

    // Add relevant context from shared context
    const sharedData = await this.sharedContext.toAgentContext();
    input.sharedContext = sharedData;

    return input;
  }

  private async handleAgentStatusUpdate(
    taskId: string,
    payload: unknown
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    const data = payload as {
      data?: { progress?: number; currentTask?: string };
    };
    if (data.data?.progress !== undefined) {
      this.emit("task:progress", {
        taskId,
        progress: data.data.progress,
        currentTask: data.data.currentTask,
      });
    }
  }

  private async waitForTaskCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkComplete = () => {
        const initialRunning = this.runningTasks.size;
        setTimeout(() => {
          if (this.runningTasks.size < initialRunning || this.status !== "running") {
            resolve();
          } else {
            checkComplete();
          }
        }, 500);
      };
      checkComplete();
    });
  }

  private async saveState(): Promise<void> {
    const state = {
      workflowId: this.workflowId,
      status: this.status,
      tasks: Array.from(this.tasks.entries()),
      completedTasks: Array.from(this.completedTasks),
      failedTasks: Array.from(this.failedTasks),
      runningTasks: Array.from(this.runningTasks),
    };

    await this.redis.setex(
      `${COORDINATOR_PREFIX}:${this.workflowId}`,
      3600, // 1 hour TTL
      JSON.stringify(state)
    );
  }

  private async cleanup(): Promise<void> {
    // Disconnect all messengers
    const messengerArray = Array.from(this.messengers.values());
    for (const messenger of messengerArray) {
      await messenger.disconnect();
    }
    this.messengers.clear();

    // Disconnect shared context
    await this.sharedContext.disconnect();

    // Close Redis connection
    this.redis.disconnect();
  }
}

/**
 * Create a simple workflow from task definitions
 */
export function createWorkflow(
  name: string,
  description: string,
  tasks: TaskDefinition[],
  options: Partial<{
    strategy: WorkflowStrategy;
    onComplete: (results: Map<string, unknown>) => Promise<void>;
    onError: (taskId: string, error: Error) => Promise<void>;
  }> = {}
): WorkflowDefinition {
  return {
    id: `workflow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    tasks,
    strategy: options.strategy || "parallel",
    onComplete: options.onComplete,
    onError: options.onError,
  };
}

/**
 * Create a coordinator and run a workflow
 */
export async function runWorkflow(
  workflow: WorkflowDefinition,
  userId: string
): Promise<TaskCoordinator> {
  const coordinator = new TaskCoordinator(workflow.id, userId);
  await coordinator.initialize(workflow);

  // Start without waiting for completion (async)
  coordinator.start().catch((error) => {
    console.error("[TaskCoordinator] Workflow error:", error);
  });

  return coordinator;
}

// Common workflow templates
export const WORKFLOW_TEMPLATES = {
  /**
   * Research and report workflow
   */
  researchReport: (topic: string): WorkflowDefinition =>
    createWorkflow(
      "Research Report",
      `Comprehensive research and report on: ${topic}`,
      [
        {
          id: "research",
          name: "Research",
          description: "Gather information on the topic",
          objective: `Research the topic: ${topic}. Gather comprehensive information from multiple sources.`,
          agentType: "research",
          priority: 1,
        },
        {
          id: "analyze",
          name: "Analysis",
          description: "Analyze research findings",
          objective: "Analyze the research findings, identify patterns and insights.",
          agentType: "analysis",
          dependencies: ["research"],
          priority: 2,
        },
        {
          id: "write",
          name: "Write Report",
          description: "Write the final report",
          objective: "Write a comprehensive report based on the research and analysis.",
          agentType: "writing",
          dependencies: ["analyze"],
          priority: 3,
        },
      ]
    ),

  /**
   * Code review and improvement workflow
   */
  codeReview: (codeDescription: string): WorkflowDefinition =>
    createWorkflow(
      "Code Review",
      `Review and improve code: ${codeDescription}`,
      [
        {
          id: "analyze_code",
          name: "Code Analysis",
          description: "Analyze the code structure and quality",
          objective: `Analyze the code for: ${codeDescription}. Identify issues, patterns, and areas for improvement.`,
          agentType: "analysis",
          priority: 1,
        },
        {
          id: "implement_fixes",
          name: "Implement Fixes",
          description: "Implement recommended fixes",
          objective: "Implement the recommended fixes and improvements based on the analysis.",
          agentType: "coding",
          dependencies: ["analyze_code"],
          priority: 2,
        },
        {
          id: "document",
          name: "Documentation",
          description: "Update documentation",
          objective: "Update documentation to reflect the changes made.",
          agentType: "writing",
          dependencies: ["implement_fixes"],
          priority: 3,
        },
      ]
    ),

  /**
   * Parallel research workflow (multiple topics)
   */
  parallelResearch: (topics: string[]): WorkflowDefinition =>
    createWorkflow(
      "Parallel Research",
      `Research multiple topics in parallel: ${topics.join(", ")}`,
      [
        ...topics.map((topic, i) => ({
          id: `research_${i}`,
          name: `Research: ${topic}`,
          description: `Research ${topic}`,
          objective: `Research the topic: ${topic}`,
          agentType: "research" as AgentType,
          priority: 1 as TaskPriority,
        })),
        {
          id: "synthesize",
          name: "Synthesize",
          description: "Synthesize all research findings",
          objective: "Synthesize and compare the research findings from all topics.",
          agentType: "analysis",
          dependencies: topics.map((_, i) => `research_${i}`),
          priority: 2,
        },
      ]
    ),
};

export default {
  TaskCoordinator,
  createWorkflow,
  runWorkflow,
  WORKFLOW_TEMPLATES,
};
