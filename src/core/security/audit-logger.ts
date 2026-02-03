import { db } from "../../db";
import { auditLogs, NewAuditLog } from "../../db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export type AuditAction =
  | "login"
  | "logout"
  | "session_create"
  | "session_invalidate"
  | "api_key_create"
  | "api_key_revoke"
  | "tool_use"
  | "chat_message"
  | "memory_create"
  | "memory_delete"
  | "memory_archive"
  | "settings_change"
  | "mode_change"
  | "agent_spawn"
  | "agent_complete"
  | "file_read"
  | "file_write"
  | "shell_execute"
  | "web_browse"
  | "error";

export type AuditResource =
  | "session"
  | "api_key"
  | "tool"
  | "chat"
  | "memory"
  | "settings"
  | "mode"
  | "agent"
  | "file"
  | "shell"
  | "browser";

export interface AuditLogEntry {
  userId?: string;
  sessionId?: string;
  action: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
}

export async function logAudit(entry: AuditLogEntry): Promise<string> {
  const [log] = await db
    .insert(auditLogs)
    .values({
      userId: entry.userId,
      sessionId: entry.sessionId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      details: entry.details,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      success: entry.success ?? true,
    })
    .returning();

  return log.id;
}

export interface AuditQueryOptions {
  userId?: string;
  action?: AuditAction;
  resource?: AuditResource;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export async function queryAuditLogs(options: AuditQueryOptions = {}) {
  const {
    userId,
    action,
    resource,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = options;

  let query = db.select().from(auditLogs);

  const conditions = [];

  if (userId) {
    conditions.push(eq(auditLogs.userId, userId));
  }

  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }

  if (resource) {
    conditions.push(eq(auditLogs.resource, resource));
  }

  if (startDate) {
    conditions.push(gte(auditLogs.createdAt, startDate));
  }

  if (endDate) {
    conditions.push(lte(auditLogs.createdAt, endDate));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  const logs = await query
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return logs;
}

export async function getRecentUserActivity(
  userId: string,
  hours = 24
): Promise<typeof auditLogs.$inferSelect[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.userId, userId), gte(auditLogs.createdAt, since)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
}

export async function countActionsByType(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, number>> {
  const logs = await db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, userId),
        gte(auditLogs.createdAt, startDate),
        lte(auditLogs.createdAt, endDate)
      )
    );

  const counts: Record<string, number> = {};
  for (const log of logs) {
    counts[log.action] = (counts[log.action] || 0) + 1;
  }

  return counts;
}

// Convenience functions for common audit events
export const audit = {
  login: (userId: string, ipAddress?: string, userAgent?: string) =>
    logAudit({
      userId,
      action: "login",
      resource: "session",
      ipAddress,
      userAgent,
    }),

  logout: (userId: string, sessionId: string) =>
    logAudit({
      userId,
      sessionId,
      action: "logout",
      resource: "session",
    }),

  toolUse: (
    userId: string,
    toolName: string,
    input: Record<string, unknown>,
    success: boolean
  ) =>
    logAudit({
      userId,
      action: "tool_use",
      resource: "tool",
      resourceId: toolName,
      details: { input },
      success,
    }),

  shellExecute: (
    userId: string,
    command: string,
    exitCode: number,
    durationMs: number
  ) =>
    logAudit({
      userId,
      action: "shell_execute",
      resource: "shell",
      details: { command, exitCode, durationMs },
      success: exitCode === 0,
    }),

  fileAccess: (
    userId: string,
    action: "file_read" | "file_write",
    filePath: string
  ) =>
    logAudit({
      userId,
      action,
      resource: "file",
      resourceId: filePath,
    }),

  memoryCreate: (userId: string, memoryId: string, memoryType: string) =>
    logAudit({
      userId,
      action: "memory_create",
      resource: "memory",
      resourceId: memoryId,
      details: { type: memoryType },
    }),

  modeChange: (
    userId: string,
    fromMode: string | null,
    toMode: string
  ) =>
    logAudit({
      userId,
      action: "mode_change",
      resource: "mode",
      details: { fromMode, toMode },
    }),

  agentSpawn: (userId: string, agentId: string, agentType: string) =>
    logAudit({
      userId,
      action: "agent_spawn",
      resource: "agent",
      resourceId: agentId,
      details: { type: agentType },
    }),

  error: (
    userId: string | undefined,
    errorType: string,
    message: string,
    context?: Record<string, unknown>
  ) =>
    logAudit({
      userId,
      action: "error",
      details: { errorType, message, ...context },
      success: false,
    }),
};
