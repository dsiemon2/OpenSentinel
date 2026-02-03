import { db } from "../../db";
import {
  memories,
  messages,
  conversations,
  toolLogs,
  auditLogs,
  archivedMemories,
  sessions,
  errorLogs,
  metrics,
  agentMessages,
  agentProgress,
  subAgents,
} from "../../db/schema";
import { eq, lt, and, sql, inArray } from "drizzle-orm";
import { logAudit } from "./audit-logger";

export type RetentionPolicyType =
  | "messages"
  | "memories"
  | "audit_logs"
  | "tool_logs"
  | "sessions"
  | "error_logs"
  | "metrics"
  | "agent_data"
  | "archived_memories";

export interface RetentionPolicy {
  type: RetentionPolicyType;
  enabled: boolean;
  retentionDays: number;
  archiveFirst: boolean;
  minimumRecords?: number; // Keep at least this many records
  excludeHighImportance?: boolean; // For memories
}

export interface RetentionConfig {
  userId: string;
  policies: RetentionPolicy[];
  globalEnabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runIntervalHours: number;
}

export interface CleanupResult {
  type: RetentionPolicyType;
  deletedCount: number;
  archivedCount: number;
  keptCount: number;
  duration: number;
}

export interface CleanupSummary {
  userId: string;
  runAt: Date;
  results: CleanupResult[];
  totalDeleted: number;
  totalArchived: number;
  errors: string[];
}

// Default retention policies
const DEFAULT_POLICIES: RetentionPolicy[] = [
  {
    type: "messages",
    enabled: true,
    retentionDays: 90,
    archiveFirst: false,
    minimumRecords: 100,
  },
  {
    type: "memories",
    enabled: true,
    retentionDays: 365,
    archiveFirst: true,
    minimumRecords: 50,
    excludeHighImportance: true,
  },
  {
    type: "audit_logs",
    enabled: true,
    retentionDays: 180,
    archiveFirst: false,
  },
  {
    type: "tool_logs",
    enabled: true,
    retentionDays: 30,
    archiveFirst: false,
  },
  {
    type: "sessions",
    enabled: true,
    retentionDays: 7,
    archiveFirst: false,
  },
  {
    type: "error_logs",
    enabled: true,
    retentionDays: 90,
    archiveFirst: false,
  },
  {
    type: "metrics",
    enabled: true,
    retentionDays: 30,
    archiveFirst: false,
  },
  {
    type: "agent_data",
    enabled: true,
    retentionDays: 60,
    archiveFirst: false,
  },
  {
    type: "archived_memories",
    enabled: true,
    retentionDays: 730, // 2 years
    archiveFirst: false,
  },
];

// Per-user retention configs
const retentionConfigs = new Map<string, RetentionConfig>();

/**
 * Get retention config for a user (or create default)
 */
export function getRetentionConfig(userId: string): RetentionConfig {
  let config = retentionConfigs.get(userId);

  if (!config) {
    config = {
      userId,
      policies: [...DEFAULT_POLICIES],
      globalEnabled: true,
      runIntervalHours: 24,
    };
    retentionConfigs.set(userId, config);
  }

  return config;
}

/**
 * Update retention config for a user
 */
export async function updateRetentionConfig(
  userId: string,
  updates: Partial<Omit<RetentionConfig, "userId">>
): Promise<RetentionConfig> {
  const config = getRetentionConfig(userId);

  if (updates.policies !== undefined) {
    config.policies = updates.policies;
  }
  if (updates.globalEnabled !== undefined) {
    config.globalEnabled = updates.globalEnabled;
  }
  if (updates.runIntervalHours !== undefined) {
    config.runIntervalHours = updates.runIntervalHours;
  }

  retentionConfigs.set(userId, config);

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: { event: "retention_config_updated", ...updates },
  });

  return config;
}

/**
 * Update a specific retention policy
 */
export async function updateRetentionPolicy(
  userId: string,
  type: RetentionPolicyType,
  updates: Partial<Omit<RetentionPolicy, "type">>
): Promise<RetentionPolicy | null> {
  const config = getRetentionConfig(userId);
  const policy = config.policies.find((p) => p.type === type);

  if (!policy) {
    return null;
  }

  Object.assign(policy, updates);

  await logAudit({
    userId,
    action: "settings_change",
    resource: "settings",
    details: { event: "retention_policy_updated", type, ...updates },
  });

  return policy;
}

/**
 * Calculate cutoff date for a policy
 */
function getCutoffDate(retentionDays: number): Date {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
}

/**
 * Clean up messages based on retention policy
 */
async function cleanupMessages(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Get user's conversations
  const userConversations = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const conversationIds = userConversations.map((c) => c.id);

  if (conversationIds.length === 0) {
    return {
      type: "messages",
      deletedCount: 0,
      archivedCount: 0,
      keptCount: 0,
      duration: Date.now() - startTime,
    };
  }

  // Count total messages
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(inArray(messages.conversationId, conversationIds));

  const totalCount = Number(totalResult[0]?.count || 0);

  // Count old messages
  const oldResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, conversationIds),
        lt(messages.createdAt, cutoffDate)
      )
    );

  const oldCount = Number(oldResult[0]?.count || 0);

  // Respect minimum records
  const minRecords = policy.minimumRecords || 0;
  const toDelete = Math.max(0, oldCount - Math.max(0, minRecords - (totalCount - oldCount)));

  if (toDelete > 0) {
    // Delete oldest messages
    await db.execute(sql`
      DELETE FROM messages
      WHERE id IN (
        SELECT id FROM messages
        WHERE conversation_id = ANY(${conversationIds}::uuid[])
        AND created_at < ${cutoffDate}
        ORDER BY created_at ASC
        LIMIT ${toDelete}
      )
    `);
  }

  return {
    type: "messages",
    deletedCount: toDelete,
    archivedCount: 0,
    keptCount: totalCount - toDelete,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up memories based on retention policy
 */
async function cleanupMemories(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);
  let archivedCount = 0;

  // Build conditions
  const conditions = [
    eq(memories.userId, userId),
    lt(memories.lastAccessed, cutoffDate),
  ];

  // Exclude high importance if configured
  if (policy.excludeHighImportance) {
    conditions.push(sql`${memories.importance} < 8`);
  }

  // Get memories to clean up
  const memoriesToCleanup = await db
    .select()
    .from(memories)
    .where(and(...conditions));

  // Archive if configured
  if (policy.archiveFirst && memoriesToCleanup.length > 0) {
    for (const memory of memoriesToCleanup) {
      await db.insert(archivedMemories).values({
        originalMemoryId: memory.id,
        userId: memory.userId,
        type: memory.type,
        content: memory.content,
        reason: "retention_policy",
        originalCreatedAt: memory.createdAt,
      } as any);
      archivedCount++;
    }
  }

  // Delete memories
  const memoryIds = memoriesToCleanup.map((m) => m.id);
  if (memoryIds.length > 0) {
    await db.delete(memories).where(inArray(memories.id, memoryIds));
  }

  // Count remaining
  const remainingResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(memories)
    .where(eq(memories.userId, userId));

  return {
    type: "memories",
    deletedCount: memoriesToCleanup.length,
    archivedCount,
    keptCount: Number(remainingResult[0]?.count || 0),
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up audit logs based on retention policy
 */
async function cleanupAuditLogs(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Count before
  const beforeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId));

  const beforeCount = Number(beforeResult[0]?.count || 0);

  // Delete old logs
  await db
    .delete(auditLogs)
    .where(and(eq(auditLogs.userId, userId), lt(auditLogs.createdAt, cutoffDate)));

  // Count after
  const afterResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId));

  const afterCount = Number(afterResult[0]?.count || 0);

  return {
    type: "audit_logs",
    deletedCount: beforeCount - afterCount,
    archivedCount: 0,
    keptCount: afterCount,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up tool logs based on retention policy
 */
async function cleanupToolLogs(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Get user's conversations
  const userConversations = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const conversationIds = userConversations.map((c) => c.id);

  if (conversationIds.length === 0) {
    return {
      type: "tool_logs",
      deletedCount: 0,
      archivedCount: 0,
      keptCount: 0,
      duration: Date.now() - startTime,
    };
  }

  // Count before
  const beforeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(toolLogs)
    .where(inArray(toolLogs.conversationId, conversationIds));

  const beforeCount = Number(beforeResult[0]?.count || 0);

  // Delete old logs
  await db
    .delete(toolLogs)
    .where(
      and(
        inArray(toolLogs.conversationId, conversationIds),
        lt(toolLogs.createdAt, cutoffDate)
      )
    );

  // Count after
  const afterResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(toolLogs)
    .where(inArray(toolLogs.conversationId, conversationIds));

  const afterCount = Number(afterResult[0]?.count || 0);

  return {
    type: "tool_logs",
    deletedCount: beforeCount - afterCount,
    archivedCount: 0,
    keptCount: afterCount,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up expired sessions
 */
async function cleanupSessions(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Count before
  const beforeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  const beforeCount = Number(beforeResult[0]?.count || 0);

  // Delete expired and old sessions
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        lt(sessions.expiresAt, cutoffDate)
      )
    );

  // Count after
  const afterResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  const afterCount = Number(afterResult[0]?.count || 0);

  return {
    type: "sessions",
    deletedCount: beforeCount - afterCount,
    archivedCount: 0,
    keptCount: afterCount,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up error logs based on retention policy
 */
async function cleanupErrorLogs(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Count before
  const beforeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(errorLogs)
    .where(eq(errorLogs.userId, userId));

  const beforeCount = Number(beforeResult[0]?.count || 0);

  // Delete old error logs (keep unresolved ones)
  await db
    .delete(errorLogs)
    .where(
      and(
        eq(errorLogs.userId, userId),
        lt(errorLogs.createdAt, cutoffDate),
        eq(errorLogs.resolved, true)
      )
    );

  // Count after
  const afterResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(errorLogs)
    .where(eq(errorLogs.userId, userId));

  const afterCount = Number(afterResult[0]?.count || 0);

  return {
    type: "error_logs",
    deletedCount: beforeCount - afterCount,
    archivedCount: 0,
    keptCount: afterCount,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up metrics based on retention policy
 */
async function cleanupMetrics(
  _userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Count before (metrics don't have userId, so cleanup globally)
  const beforeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(metrics);

  const beforeCount = Number(beforeResult[0]?.count || 0);

  // Delete old metrics
  await db.delete(metrics).where(lt(metrics.timestamp, cutoffDate));

  // Count after
  const afterResult = await db.select({ count: sql<number>`count(*)` }).from(metrics);

  const afterCount = Number(afterResult[0]?.count || 0);

  return {
    type: "metrics",
    deletedCount: beforeCount - afterCount,
    archivedCount: 0,
    keptCount: afterCount,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up agent data based on retention policy
 */
async function cleanupAgentData(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Get old completed/failed agents
  const oldAgents = await db
    .select({ id: subAgents.id })
    .from(subAgents)
    .where(
      and(
        eq(subAgents.userId, userId),
        lt(subAgents.createdAt, cutoffDate),
        inArray(subAgents.status, ["completed", "failed", "cancelled"])
      )
    );

  const agentIds = oldAgents.map((a) => a.id);

  if (agentIds.length === 0) {
    return {
      type: "agent_data",
      deletedCount: 0,
      archivedCount: 0,
      keptCount: 0,
      duration: Date.now() - startTime,
    };
  }

  // Delete agent messages
  await db.delete(agentMessages).where(inArray(agentMessages.agentId, agentIds));

  // Delete agent progress
  await db.delete(agentProgress).where(inArray(agentProgress.agentId, agentIds));

  // Delete agents
  await db.delete(subAgents).where(inArray(subAgents.id, agentIds));

  return {
    type: "agent_data",
    deletedCount: agentIds.length,
    archivedCount: 0,
    keptCount: 0,
    duration: Date.now() - startTime,
  };
}

/**
 * Clean up archived memories based on retention policy
 */
async function cleanupArchivedMemories(
  userId: string,
  policy: RetentionPolicy
): Promise<CleanupResult> {
  const startTime = Date.now();
  const cutoffDate = getCutoffDate(policy.retentionDays);

  // Count before
  const beforeResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(archivedMemories)
    .where(eq(archivedMemories.userId, userId));

  const beforeCount = Number(beforeResult[0]?.count || 0);

  // Delete old archived memories
  await db
    .delete(archivedMemories)
    .where(
      and(
        eq(archivedMemories.userId, userId),
        lt(archivedMemories.archivedAt, cutoffDate)
      )
    );

  // Count after
  const afterResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(archivedMemories)
    .where(eq(archivedMemories.userId, userId));

  const afterCount = Number(afterResult[0]?.count || 0);

  return {
    type: "archived_memories",
    deletedCount: beforeCount - afterCount,
    archivedCount: 0,
    keptCount: afterCount,
    duration: Date.now() - startTime,
  };
}

/**
 * Run data retention cleanup for a user
 */
export async function runRetentionCleanup(
  userId: string,
  policyTypes?: RetentionPolicyType[]
): Promise<CleanupSummary> {
  const config = getRetentionConfig(userId);

  if (!config.globalEnabled) {
    return {
      userId,
      runAt: new Date(),
      results: [],
      totalDeleted: 0,
      totalArchived: 0,
      errors: ["Data retention is disabled for this user"],
    };
  }

  const results: CleanupResult[] = [];
  const errors: string[] = [];

  // Filter policies if specific types requested
  const policiesToRun = policyTypes
    ? config.policies.filter((p) => policyTypes.includes(p.type))
    : config.policies;

  for (const policy of policiesToRun) {
    if (!policy.enabled) continue;

    try {
      let result: CleanupResult;

      switch (policy.type) {
        case "messages":
          result = await cleanupMessages(userId, policy);
          break;
        case "memories":
          result = await cleanupMemories(userId, policy);
          break;
        case "audit_logs":
          result = await cleanupAuditLogs(userId, policy);
          break;
        case "tool_logs":
          result = await cleanupToolLogs(userId, policy);
          break;
        case "sessions":
          result = await cleanupSessions(userId, policy);
          break;
        case "error_logs":
          result = await cleanupErrorLogs(userId, policy);
          break;
        case "metrics":
          result = await cleanupMetrics(userId, policy);
          break;
        case "agent_data":
          result = await cleanupAgentData(userId, policy);
          break;
        case "archived_memories":
          result = await cleanupArchivedMemories(userId, policy);
          break;
        default:
          continue;
      }

      results.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${policy.type}: ${message}`);
    }
  }

  // Update last run time
  config.lastRun = new Date();
  config.nextRun = new Date(
    Date.now() + config.runIntervalHours * 60 * 60 * 1000
  );

  const summary: CleanupSummary = {
    userId,
    runAt: config.lastRun,
    results,
    totalDeleted: results.reduce((sum, r) => sum + r.deletedCount, 0),
    totalArchived: results.reduce((sum, r) => sum + r.archivedCount, 0),
    errors,
  };

  await logAudit({
    userId,
    action: "memory_archive",
    resource: "memory",
    details: {
      event: "retention_cleanup_completed",
      totalDeleted: summary.totalDeleted,
      totalArchived: summary.totalArchived,
      policies: results.map((r) => r.type),
    },
  });

  return summary;
}

/**
 * Preview what would be deleted without actually deleting
 */
export async function previewRetentionCleanup(
  userId: string
): Promise<Record<RetentionPolicyType, { toDelete: number; toArchive: number }>> {
  const config = getRetentionConfig(userId);
  const preview: Record<RetentionPolicyType, { toDelete: number; toArchive: number }> =
    {} as Record<RetentionPolicyType, { toDelete: number; toArchive: number }>;

  for (const policy of config.policies) {
    if (!policy.enabled) continue;

    const cutoffDate = getCutoffDate(policy.retentionDays);

    switch (policy.type) {
      case "messages": {
        const userConversations = await db
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.userId, userId));

        const conversationIds = userConversations.map((c) => c.id);

        if (conversationIds.length > 0) {
          const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(messages)
            .where(
              and(
                inArray(messages.conversationId, conversationIds),
                lt(messages.createdAt, cutoffDate)
              )
            );
          preview.messages = {
            toDelete: Number(result[0]?.count || 0),
            toArchive: 0,
          };
        } else {
          preview.messages = { toDelete: 0, toArchive: 0 };
        }
        break;
      }
      case "memories": {
        const conditions = [
          eq(memories.userId, userId),
          lt(memories.lastAccessed, cutoffDate),
        ];
        if (policy.excludeHighImportance) {
          conditions.push(sql`${memories.importance} < 8`);
        }
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(memories)
          .where(and(...conditions));
        const count = Number(result[0]?.count || 0);
        preview.memories = {
          toDelete: count,
          toArchive: policy.archiveFirst ? count : 0,
        };
        break;
      }
      case "audit_logs": {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(auditLogs)
          .where(
            and(eq(auditLogs.userId, userId), lt(auditLogs.createdAt, cutoffDate))
          );
        preview.audit_logs = {
          toDelete: Number(result[0]?.count || 0),
          toArchive: 0,
        };
        break;
      }
      // Add other types as needed...
      default:
        preview[policy.type] = { toDelete: 0, toArchive: 0 };
    }
  }

  return preview;
}

/**
 * Get storage usage statistics
 */
export async function getStorageStats(userId: string): Promise<{
  messages: number;
  memories: number;
  archivedMemories: number;
  auditLogs: number;
  toolLogs: number;
  sessions: number;
  errorLogs: number;
  agents: number;
  total: number;
}> {
  const userConversations = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const conversationIds = userConversations.map((c) => c.id);

  const [
    messagesResult,
    memoriesResult,
    archivedResult,
    auditResult,
    toolResult,
    sessionsResult,
    errorResult,
    agentsResult,
  ] = await Promise.all([
    conversationIds.length > 0
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(messages)
          .where(inArray(messages.conversationId, conversationIds))
      : [{ count: 0 }],
    db
      .select({ count: sql<number>`count(*)` })
      .from(memories)
      .where(eq(memories.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(archivedMemories)
      .where(eq(archivedMemories.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId)),
    conversationIds.length > 0
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(toolLogs)
          .where(inArray(toolLogs.conversationId, conversationIds))
      : [{ count: 0 }],
    db
      .select({ count: sql<number>`count(*)` })
      .from(sessions)
      .where(eq(sessions.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(errorLogs)
      .where(eq(errorLogs.userId, userId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(subAgents)
      .where(eq(subAgents.userId, userId)),
  ]);

  const stats = {
    messages: Number(messagesResult[0]?.count || 0),
    memories: Number(memoriesResult[0]?.count || 0),
    archivedMemories: Number(archivedResult[0]?.count || 0),
    auditLogs: Number(auditResult[0]?.count || 0),
    toolLogs: Number(toolResult[0]?.count || 0),
    sessions: Number(sessionsResult[0]?.count || 0),
    errorLogs: Number(errorResult[0]?.count || 0),
    agents: Number(agentsResult[0]?.count || 0),
    total: 0,
  };

  stats.total =
    stats.messages +
    stats.memories +
    stats.archivedMemories +
    stats.auditLogs +
    stats.toolLogs +
    stats.sessions +
    stats.errorLogs +
    stats.agents;

  return stats;
}

/**
 * Schedule automatic retention cleanup
 */
const scheduledCleanups = new Map<string, NodeJS.Timeout>();

export function scheduleRetentionCleanup(userId: string): void {
  // Clear existing schedule
  const existing = scheduledCleanups.get(userId);
  if (existing) {
    clearInterval(existing);
  }

  const config = getRetentionConfig(userId);

  if (!config.globalEnabled) {
    return;
  }

  const intervalMs = config.runIntervalHours * 60 * 60 * 1000;

  const timeout = setInterval(async () => {
    try {
      await runRetentionCleanup(userId);
    } catch (error) {
      console.error(`[DataRetention] Scheduled cleanup failed for ${userId}:`, error);
    }
  }, intervalMs);

  scheduledCleanups.set(userId, timeout);
}

/**
 * Cancel scheduled cleanup
 */
export function cancelScheduledCleanup(userId: string): void {
  const existing = scheduledCleanups.get(userId);
  if (existing) {
    clearInterval(existing);
    scheduledCleanups.delete(userId);
  }
}

/**
 * Cleanup all scheduled intervals on shutdown
 */
export function shutdownRetentionScheduler(): void {
  const entries = Array.from(scheduledCleanups.entries());
  for (let i = 0; i < entries.length; i++) {
    const [userId, timeout] = entries[i];
    clearInterval(timeout);
    scheduledCleanups.delete(userId);
  }
}
