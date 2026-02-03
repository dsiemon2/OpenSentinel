import { db } from "../../db";
import { errorLogs, NewErrorLog } from "../../db/schema";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
import { metric } from "./metrics";

export type ErrorSource =
  | "brain"
  | "tool"
  | "telegram"
  | "api"
  | "scheduler"
  | "memory"
  | "agent"
  | "security"
  | "unknown";

export interface TrackedError {
  source: ErrorSource;
  errorType: string;
  errorCode?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  conversationId?: string;
}

export async function trackError(error: TrackedError): Promise<string> {
  // Record metric
  metric.error(error.source);

  // Log to console
  console.error(`[${error.source.toUpperCase()}] ${error.errorType}: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }

  // Store in database
  const [logged] = await db
    .insert(errorLogs)
    .values({
      source: error.source,
      errorType: error.errorType,
      errorCode: error.errorCode,
      message: error.message,
      stack: error.stack,
      context: error.context,
      userId: error.userId,
      conversationId: error.conversationId,
    })
    .returning();

  return logged.id;
}

// Convenience function to track errors from catch blocks
export function captureException(
  err: unknown,
  source: ErrorSource,
  context?: Record<string, unknown>,
  userId?: string
): Promise<string> {
  const error = err instanceof Error ? err : new Error(String(err));

  return trackError({
    source,
    errorType: error.constructor.name,
    message: error.message,
    stack: error.stack,
    context,
    userId,
  });
}

// Wrapper to capture errors from async functions
export function withErrorTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  source: ErrorSource,
  getContext?: (...args: Parameters<T>) => Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (err) {
      const context = getContext ? getContext(...args) : undefined;
      await captureException(err, source, context);
      throw err;
    }
  }) as T;
}

export interface ErrorQuery {
  source?: ErrorSource;
  errorType?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  resolved?: boolean;
  limit?: number;
}

export async function queryErrors(query: ErrorQuery = {}) {
  const {
    source,
    errorType,
    startDate,
    endDate,
    userId,
    resolved,
    limit = 100,
  } = query;

  const conditions = [];

  if (source) {
    conditions.push(eq(errorLogs.source, source));
  }

  if (errorType) {
    conditions.push(eq(errorLogs.errorType, errorType));
  }

  if (startDate) {
    conditions.push(gte(errorLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(errorLogs.createdAt, endDate));
  }

  if (userId) {
    conditions.push(eq(errorLogs.userId, userId));
  }

  if (resolved !== undefined) {
    conditions.push(eq(errorLogs.resolved, resolved));
  }

  let q = db.select().from(errorLogs);

  if (conditions.length > 0) {
    q = q.where(and(...conditions)) as typeof q;
  }

  return q.orderBy(desc(errorLogs.createdAt)).limit(limit);
}

export async function getRecentErrors(
  hours: number = 24,
  source?: ErrorSource
): Promise<typeof errorLogs.$inferSelect[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const conditions = [gte(errorLogs.createdAt, since)];

  if (source) {
    conditions.push(eq(errorLogs.source, source));
  }

  return db
    .select()
    .from(errorLogs)
    .where(and(...conditions))
    .orderBy(desc(errorLogs.createdAt))
    .limit(100);
}

export async function getErrorStats(
  startDate: Date,
  endDate: Date
): Promise<Record<string, { count: number; sources: Record<string, number> }>> {
  const errors = await db
    .select()
    .from(errorLogs)
    .where(
      and(
        gte(errorLogs.createdAt, startDate),
        lte(errorLogs.createdAt, endDate)
      )
    );

  const stats: Record<string, { count: number; sources: Record<string, number> }> = {};

  for (const error of errors) {
    if (!stats[error.errorType]) {
      stats[error.errorType] = { count: 0, sources: {} };
    }
    stats[error.errorType].count++;
    stats[error.errorType].sources[error.source] =
      (stats[error.errorType].sources[error.source] || 0) + 1;
  }

  return stats;
}

export async function markErrorResolved(errorId: string): Promise<boolean> {
  const [updated] = await db
    .update(errorLogs)
    .set({ resolved: true })
    .where(eq(errorLogs.id, errorId))
    .returning();

  return !!updated;
}

export async function getUnresolvedErrors(): Promise<typeof errorLogs.$inferSelect[]> {
  return db
    .select()
    .from(errorLogs)
    .where(eq(errorLogs.resolved, false))
    .orderBy(desc(errorLogs.createdAt))
    .limit(100);
}

// Error grouping for similar errors
export async function getSimilarErrors(
  errorType: string,
  message: string,
  limit: number = 10
): Promise<typeof errorLogs.$inferSelect[]> {
  return db
    .select()
    .from(errorLogs)
    .where(eq(errorLogs.errorType, errorType))
    .orderBy(desc(errorLogs.createdAt))
    .limit(limit);
}

// Cleanup old errors
export async function cleanupOldErrors(daysToKeep: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  await db
    .delete(errorLogs)
    .where(and(lte(errorLogs.createdAt, cutoff), eq(errorLogs.resolved, true)));
  return 0;
}

// Error context helpers
export const errorContext = {
  tool: (toolName: string, input: Record<string, unknown>) => ({
    toolName,
    input,
  }),

  api: (endpoint: string, method: string, statusCode?: number) => ({
    endpoint,
    method,
    statusCode,
  }),

  telegram: (chatId: string | number, messageType: string) => ({
    chatId: String(chatId),
    messageType,
  }),

  agent: (agentId: string, agentType: string, step?: number) => ({
    agentId,
    agentType,
    step,
  }),
};
