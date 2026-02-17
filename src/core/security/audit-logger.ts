import { createHmac, randomUUID } from "crypto";
import { db } from "../../db";
import { auditLogs, NewAuditLog } from "../../db/schema";
import { eq, and, gte, lte, desc, count, min, max, asc } from "drizzle-orm";
import { env } from "../../config/env";

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

// --- Tamper-proof chain hashing helpers (SOC 2 compliance) ---

let _cachedSigningKey: string | null = null;

function getAuditSigningKey(): string {
  if (_cachedSigningKey) return _cachedSigningKey;
  if (env.AUDIT_SIGNING_KEY) {
    _cachedSigningKey = env.AUDIT_SIGNING_KEY;
    return _cachedSigningKey;
  }
  _cachedSigningKey = randomUUID();
  console.warn(
    "[audit-logger] AUDIT_SIGNING_KEY not set — using a random ephemeral key. " +
      "Set AUDIT_SIGNING_KEY in .env for persistent tamper-proof audit chains."
  );
  return _cachedSigningKey;
}

function signAuditEntry(
  sequenceNumber: number,
  action: string,
  userId: string | undefined,
  resource: string | undefined,
  detailsJson: string,
  timestamp: string,
  previousHash: string | null
): string {
  const key = getAuditSigningKey();
  const data = [
    String(sequenceNumber),
    action,
    userId ?? "",
    resource ?? "",
    detailsJson,
    timestamp,
    previousHash ?? "",
  ].join("|");
  return createHmac("sha256", key).update(data).digest("hex");
}

async function getLastAuditEntry(): Promise<{
  sequenceNumber: number;
  entryHash: string;
} | null> {
  const [last] = await db
    .select({
      sequenceNumber: auditLogs.sequenceNumber,
      entryHash: auditLogs.entryHash,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.sequenceNumber))
    .limit(1);

  if (!last || last.sequenceNumber == null || last.entryHash == null) {
    return null;
  }

  return {
    sequenceNumber: last.sequenceNumber,
    entryHash: last.entryHash,
  };
}

export async function logAudit(entry: AuditLogEntry): Promise<string> {
  // Fetch previous chain entry for tamper-proof linking
  const last = await getLastAuditEntry();
  const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
  const previousHash = last?.entryHash ?? null;

  const timestamp = new Date().toISOString();
  const detailsJson = entry.details ? JSON.stringify(entry.details) : "{}";

  const entryHash = signAuditEntry(
    sequenceNumber,
    entry.action,
    entry.userId,
    entry.resource,
    detailsJson,
    timestamp,
    previousHash
  );

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
      createdAt: new Date(timestamp),
      sequenceNumber,
      entryHash,
      previousHash,
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

// --- Audit chain verification (SOC 2 compliance) ---

export async function verifyAuditChain(
  options?: { fromSequence?: number; limit?: number }
): Promise<{
  valid: boolean;
  totalChecked: number;
  firstInvalid?: number;
  errors: Array<{ sequenceNumber: number; error: string }>;
}> {
  const fromSequence = options?.fromSequence ?? 1;
  const batchLimit = options?.limit ?? 10000;

  // Fetch the entry just before fromSequence to get its hash for linkage check
  let expectedPreviousHash: string | null = null;
  let expectedSequence = fromSequence;

  if (fromSequence > 1) {
    const [prev] = await db
      .select({
        sequenceNumber: auditLogs.sequenceNumber,
        entryHash: auditLogs.entryHash,
      })
      .from(auditLogs)
      .where(eq(auditLogs.sequenceNumber, fromSequence - 1))
      .limit(1);

    expectedPreviousHash = prev?.entryHash ?? null;
  }

  const entries = await db
    .select()
    .from(auditLogs)
    .where(gte(auditLogs.sequenceNumber, fromSequence))
    .orderBy(asc(auditLogs.sequenceNumber))
    .limit(batchLimit);

  const errors: Array<{ sequenceNumber: number; error: string }> = [];

  for (const entry of entries) {
    const seq = entry.sequenceNumber;

    if (seq == null) {
      errors.push({
        sequenceNumber: expectedSequence,
        error: "Missing sequence number",
      });
      expectedSequence++;
      continue;
    }

    // Check sequence continuity
    if (seq !== expectedSequence) {
      errors.push({
        sequenceNumber: expectedSequence,
        error: `Sequence gap: expected ${expectedSequence}, got ${seq}`,
      });
      expectedSequence = seq; // re-sync
    }

    // Check previousHash linkage
    if ((entry.previousHash ?? null) !== expectedPreviousHash) {
      errors.push({
        sequenceNumber: seq,
        error: `Previous hash mismatch: expected ${expectedPreviousHash ?? "(null)"}, got ${entry.previousHash ?? "(null)"}`,
      });
    }

    // Recompute and verify entryHash
    const detailsJson = entry.details ? JSON.stringify(entry.details) : "{}";
    const timestamp = entry.createdAt.toISOString();

    const recomputed = signAuditEntry(
      seq,
      entry.action,
      entry.userId ?? undefined,
      entry.resource ?? undefined,
      detailsJson,
      timestamp,
      entry.previousHash
    );

    if (recomputed !== entry.entryHash) {
      errors.push({
        sequenceNumber: seq,
        error: "Entry hash mismatch — record may have been tampered with",
      });
    }

    // Advance expectations
    expectedPreviousHash = entry.entryHash;
    expectedSequence = seq + 1;
  }

  return {
    valid: errors.length === 0,
    totalChecked: entries.length,
    firstInvalid: errors.length > 0 ? errors[0].sequenceNumber : undefined,
    errors,
  };
}

export async function getAuditChainIntegrity(): Promise<{
  totalEntries: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  lastVerified: number;
  chainValid: boolean;
  lastSequence: number;
}> {
  const [stats] = await db
    .select({
      totalEntries: count(auditLogs.id),
      oldestEntry: min(auditLogs.createdAt),
      newestEntry: max(auditLogs.createdAt),
      lastSequence: max(auditLogs.sequenceNumber),
    })
    .from(auditLogs);

  const totalEntries = Number(stats.totalEntries ?? 0);
  const lastSequence = stats.lastSequence ?? 0;

  // Verify the last 1000 entries
  const verifyFrom = Math.max(1, lastSequence - 999);
  const verification = await verifyAuditChain({
    fromSequence: verifyFrom,
    limit: 1000,
  });

  return {
    totalEntries,
    oldestEntry: stats.oldestEntry ? new Date(stats.oldestEntry) : null,
    newestEntry: stats.newestEntry ? new Date(stats.newestEntry) : null,
    lastVerified: verification.totalChecked,
    chainValid: verification.valid,
    lastSequence,
  };
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
