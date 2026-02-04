/**
 * Workflow Store - Persist workflows and executions in the database
 */

import { db } from "../../db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import type { Workflow, WorkflowExecution, WorkflowStatus } from "./workflow-engine";
import type { Trigger } from "./triggers";
import type { Action } from "./actions";

// ============================================
// DATABASE SCHEMA
// ============================================

export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    userId: uuid("user_id"),
    status: text("status").notNull().$type<WorkflowStatus>(),
    triggers: jsonb("triggers").notNull().$type<Trigger[]>(),
    steps: jsonb("steps").notNull(),
    variables: jsonb("variables").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    onError: jsonb("on_error"),
    rateLimit: jsonb("rate_limit"),
    tags: jsonb("tags").$type<string[]>(),
    lastExecutedAt: timestamp("last_executed_at"),
    lastExecutionId: uuid("last_execution_id"),
    lastExecutionStatus: text("last_execution_status").$type<"success" | "failure" | "partial">(),
    executionCount: integer("execution_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflows_user_idx").on(table.userId),
    index("workflows_status_idx").on(table.status),
  ]
);

export const workflowExecutions = pgTable(
  "workflow_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    workflowName: text("workflow_name").notNull(),
    status: text("status").notNull().$type<WorkflowExecution["status"]>(),
    triggerContext: jsonb("trigger_context").notNull(),
    stepResults: jsonb("step_results").notNull(),
    variables: jsonb("variables").$type<Record<string, unknown>>(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("workflow_executions_workflow_idx").on(table.workflowId),
    index("workflow_executions_status_idx").on(table.status),
    index("workflow_executions_started_idx").on(table.startedAt),
  ]
);

// ============================================
// TYPES
// ============================================

export type DbWorkflow = typeof workflows.$inferSelect;
export type NewDbWorkflow = typeof workflows.$inferInsert;
export type DbWorkflowExecution = typeof workflowExecutions.$inferSelect;
export type NewDbWorkflowExecution = typeof workflowExecutions.$inferInsert;

// ============================================
// WORKFLOW STORE
// ============================================

export class WorkflowStore {
  // ============================================
  // WORKFLOW CRUD
  // ============================================

  /**
   * Create a new workflow
   */
  async createWorkflow(workflow: Workflow): Promise<DbWorkflow> {
    const [created] = await db
      .insert(workflows)
      .values({
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        userId: workflow.userId,
        status: workflow.status,
        triggers: workflow.triggers,
        steps: workflow.steps as unknown as ReturnType<typeof jsonb>,
        variables: workflow.variables,
        metadata: workflow.metadata,
        onError: workflow.onError as unknown as ReturnType<typeof jsonb>,
        rateLimit: workflow.rateLimit as unknown as ReturnType<typeof jsonb>,
        tags: workflow.tags,
        executionCount: workflow.executionCount,
        createdAt: workflow.createdAt,
        updatedAt: workflow.updatedAt,
      })
      .returning();

    return created;
  }

  /**
   * Get a workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<DbWorkflow | null> {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    return workflow ?? null;
  }

  /**
   * Get all workflows
   */
  async getAllWorkflows(): Promise<DbWorkflow[]> {
    return db
      .select()
      .from(workflows)
      .orderBy(desc(workflows.createdAt));
  }

  /**
   * Get workflows by user ID
   */
  async getWorkflowsByUser(userId: string): Promise<DbWorkflow[]> {
    return db
      .select()
      .from(workflows)
      .where(eq(workflows.userId, userId))
      .orderBy(desc(workflows.createdAt));
  }

  /**
   * Get active workflows
   */
  async getActiveWorkflows(): Promise<DbWorkflow[]> {
    return db
      .select()
      .from(workflows)
      .where(eq(workflows.status, "active"))
      .orderBy(desc(workflows.createdAt));
  }

  /**
   * Get workflows by tags
   */
  async getWorkflowsByTags(tags: string[]): Promise<DbWorkflow[]> {
    // Use PostgreSQL's array contains operator
    return db
      .select()
      .from(workflows)
      .where(sql`${workflows.tags} ?| ${tags}`)
      .orderBy(desc(workflows.createdAt));
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<Omit<Workflow, "id" | "createdAt">>
  ): Promise<DbWorkflow | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.userId !== undefined) updateData.userId = updates.userId;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.triggers !== undefined) updateData.triggers = updates.triggers;
    if (updates.steps !== undefined) updateData.steps = updates.steps;
    if (updates.variables !== undefined) updateData.variables = updates.variables;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;
    if (updates.onError !== undefined) updateData.onError = updates.onError;
    if (updates.rateLimit !== undefined) updateData.rateLimit = updates.rateLimit;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.lastExecutedAt !== undefined) updateData.lastExecutedAt = updates.lastExecutedAt;
    if (updates.lastExecutionId !== undefined) updateData.lastExecutionId = updates.lastExecutionId;
    if (updates.lastExecutionStatus !== undefined) updateData.lastExecutionStatus = updates.lastExecutionStatus;
    if (updates.executionCount !== undefined) updateData.executionCount = updates.executionCount;

    const [updated] = await db
      .update(workflows)
      .set(updateData)
      .where(eq(workflows.id, workflowId))
      .returning();

    return updated ?? null;
  }

  /**
   * Update workflow status
   */
  async updateWorkflowStatus(
    workflowId: string,
    status: WorkflowStatus
  ): Promise<DbWorkflow | null> {
    return this.updateWorkflow(workflowId, { status });
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<boolean> {
    const result = await db
      .delete(workflows)
      .where(eq(workflows.id, workflowId));

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Increment execution count
   */
  async incrementExecutionCount(workflowId: string): Promise<void> {
    await db
      .update(workflows)
      .set({
        executionCount: sql`${workflows.executionCount} + 1`,
        lastExecutedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId));
  }

  // ============================================
  // EXECUTION HISTORY
  // ============================================

  /**
   * Save an execution record
   */
  async saveExecution(execution: WorkflowExecution): Promise<DbWorkflowExecution> {
    const [saved] = await db
      .insert(workflowExecutions)
      .values({
        id: execution.id,
        workflowId: execution.workflowId,
        workflowName: execution.workflowName,
        status: execution.status,
        triggerContext: execution.triggerContext as unknown as ReturnType<typeof jsonb>,
        stepResults: execution.stepResults as unknown as ReturnType<typeof jsonb>,
        variables: execution.variables,
        error: execution.error,
        durationMs: execution.durationMs,
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
      })
      .returning();

    return saved;
  }

  /**
   * Update an execution record
   */
  async updateExecution(
    executionId: string,
    updates: Partial<Omit<WorkflowExecution, "id" | "workflowId" | "workflowName" | "startedAt">>
  ): Promise<DbWorkflowExecution | null> {
    const updateData: Record<string, unknown> = {};

    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.stepResults !== undefined) updateData.stepResults = updates.stepResults;
    if (updates.variables !== undefined) updateData.variables = updates.variables;
    if (updates.error !== undefined) updateData.error = updates.error;
    if (updates.durationMs !== undefined) updateData.durationMs = updates.durationMs;
    if (updates.completedAt !== undefined) updateData.completedAt = updates.completedAt;

    const [updated] = await db
      .update(workflowExecutions)
      .set(updateData)
      .where(eq(workflowExecutions.id, executionId))
      .returning();

    return updated ?? null;
  }

  /**
   * Get an execution by ID
   */
  async getExecution(executionId: string): Promise<DbWorkflowExecution | null> {
    const [execution] = await db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, executionId))
      .limit(1);

    return execution ?? null;
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(
    workflowId: string,
    options?: { limit?: number; offset?: number; status?: WorkflowExecution["status"] }
  ): Promise<DbWorkflowExecution[]> {
    let query = db
      .select()
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId))
      .orderBy(desc(workflowExecutions.startedAt));

    if (options?.status) {
      query = db
        .select()
        .from(workflowExecutions)
        .where(
          and(
            eq(workflowExecutions.workflowId, workflowId),
            eq(workflowExecutions.status, options.status)
          )
        )
        .orderBy(desc(workflowExecutions.startedAt));
    }

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }

    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  /**
   * Get recent executions across all workflows
   */
  async getRecentExecutions(limit = 50): Promise<DbWorkflowExecution[]> {
    return db
      .select()
      .from(workflowExecutions)
      .orderBy(desc(workflowExecutions.startedAt))
      .limit(limit);
  }

  /**
   * Get execution stats for a workflow
   */
  async getExecutionStats(workflowId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    avgDurationMs: number | null;
  }> {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${workflowExecutions.status} = 'failed')::int`,
        avgDurationMs: sql<number | null>`avg(${workflowExecutions.durationMs})`,
      })
      .from(workflowExecutions)
      .where(eq(workflowExecutions.workflowId, workflowId));

    return result[0] ?? { total: 0, completed: 0, failed: 0, avgDurationMs: null };
  }

  /**
   * Delete old executions (cleanup)
   */
  async deleteOldExecutions(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await db
      .delete(workflowExecutions)
      .where(sql`${workflowExecutions.startedAt} < ${cutoffDate}`);

    return result.rowCount ?? 0;
  }

  // ============================================
  // CONVERSION HELPERS
  // ============================================

  /**
   * Convert database workflow to domain workflow
   */
  toWorkflow(dbWorkflow: DbWorkflow): Workflow {
    return {
      id: dbWorkflow.id,
      name: dbWorkflow.name,
      description: dbWorkflow.description ?? undefined,
      userId: dbWorkflow.userId ?? undefined,
      status: dbWorkflow.status,
      triggers: dbWorkflow.triggers as Trigger[],
      steps: dbWorkflow.steps as Workflow["steps"],
      variables: dbWorkflow.variables ?? undefined,
      metadata: dbWorkflow.metadata ?? undefined,
      onError: dbWorkflow.onError as Workflow["onError"],
      rateLimit: dbWorkflow.rateLimit as Workflow["rateLimit"],
      tags: dbWorkflow.tags ?? undefined,
      lastExecutedAt: dbWorkflow.lastExecutedAt ?? undefined,
      lastExecutionId: dbWorkflow.lastExecutionId ?? undefined,
      lastExecutionStatus: dbWorkflow.lastExecutionStatus ?? undefined,
      executionCount: dbWorkflow.executionCount ?? 0,
      createdAt: dbWorkflow.createdAt,
      updatedAt: dbWorkflow.updatedAt,
    };
  }

  /**
   * Convert database execution to domain execution
   */
  toExecution(dbExecution: DbWorkflowExecution): WorkflowExecution {
    return {
      id: dbExecution.id,
      workflowId: dbExecution.workflowId,
      workflowName: dbExecution.workflowName,
      status: dbExecution.status,
      triggerContext: dbExecution.triggerContext as WorkflowExecution["triggerContext"],
      stepResults: dbExecution.stepResults as WorkflowExecution["stepResults"],
      variables: dbExecution.variables ?? {},
      error: dbExecution.error ?? undefined,
      durationMs: dbExecution.durationMs ?? undefined,
      startedAt: dbExecution.startedAt,
      completedAt: dbExecution.completedAt ?? undefined,
    };
  }
}

// Singleton store instance
export const workflowStore = new WorkflowStore();
