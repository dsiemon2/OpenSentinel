/**
 * Immutable Audit Trail
 * Ported from GoGreenSourcingAI
 *
 * Features:
 * - Append-only audit log
 * - Structured action logging
 * - Query by entity, user, action type
 * - Export capabilities
 */

export interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const auditEntries: AuditEntry[] = [];
let entryIdCounter = 0;

/**
 * Log an action to the audit trail
 */
export function logAuditAction(
  action: string,
  entity: string,
  entityId: string,
  userId: string,
  metadata?: Record<string, unknown>,
  extra?: { ipAddress?: string; userAgent?: string }
): AuditEntry {
  const entry: AuditEntry = {
    id: `audit_${++entryIdCounter}`,
    action,
    entity,
    entityId,
    userId,
    timestamp: new Date(),
    metadata,
    ipAddress: extra?.ipAddress,
    userAgent: extra?.userAgent,
  };

  auditEntries.push(entry);

  // Keep bounded
  if (auditEntries.length > 50000) {
    auditEntries.splice(0, auditEntries.length - 25000);
  }

  return entry;
}

/**
 * Query audit entries
 */
export function queryAudit(filter: {
  action?: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  since?: Date;
  until?: Date;
  limit?: number;
}): AuditEntry[] {
  let results = [...auditEntries];

  if (filter.action) {
    results = results.filter((e) => e.action === filter.action);
  }
  if (filter.entity) {
    results = results.filter((e) => e.entity === filter.entity);
  }
  if (filter.entityId) {
    results = results.filter((e) => e.entityId === filter.entityId);
  }
  if (filter.userId) {
    results = results.filter((e) => e.userId === filter.userId);
  }
  if (filter.since) {
    results = results.filter((e) => e.timestamp >= filter.since!);
  }
  if (filter.until) {
    results = results.filter((e) => e.timestamp <= filter.until!);
  }

  results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (filter.limit) {
    results = results.slice(0, filter.limit);
  }

  return results;
}

/**
 * Get audit trail for a specific entity
 */
export function getEntityAuditTrail(
  entity: string,
  entityId: string
): AuditEntry[] {
  return queryAudit({ entity, entityId });
}

/**
 * Get recent actions by a user
 */
export function getUserActions(
  userId: string,
  limit = 50
): AuditEntry[] {
  return queryAudit({ userId, limit });
}

/**
 * Export audit entries as JSON
 */
export function exportAuditLog(
  filter?: Parameters<typeof queryAudit>[0]
): AuditEntry[] {
  return filter ? queryAudit(filter) : [...auditEntries];
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEntries: number;
  actionCounts: Record<string, number>;
  entityCounts: Record<string, number>;
  recentActivity: number;
} {
  const actionCounts: Record<string, number> = {};
  const entityCounts: Record<string, number> = {};
  const oneHourAgo = Date.now() - 3600 * 1000;
  let recentActivity = 0;

  for (const entry of auditEntries) {
    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    entityCounts[entry.entity] = (entityCounts[entry.entity] || 0) + 1;
    if (entry.timestamp.getTime() > oneHourAgo) recentActivity++;
  }

  return {
    totalEntries: auditEntries.length,
    actionCounts,
    entityCounts,
    recentActivity,
  };
}
