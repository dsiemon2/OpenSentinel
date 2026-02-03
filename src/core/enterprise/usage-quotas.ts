import { db } from "../../db";
import { usageQuotas, users, organizations, organizationMembers } from "../../db/schema";
import { eq, and, sql, lt, gt } from "drizzle-orm";
import Redis from "ioredis";
import { env } from "../../config/env";

// Redis for real-time quota tracking
const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
});

// ============================================
// TYPES
// ============================================

export type QuotaType =
  | "tokens_daily"
  | "tokens_monthly"
  | "agents_concurrent"
  | "agents_daily"
  | "api_calls_daily"
  | "api_calls_monthly"
  | "storage_bytes"
  | "memories_count"
  | "conversations_daily"
  | "tool_executions_daily";

export type QuotaTier = "free" | "starter" | "professional" | "enterprise" | "unlimited";

export interface QuotaLimit {
  quotaType: QuotaType;
  limitValue: number;
  currentValue: number;
  resetAt?: Date;
  isHardLimit: boolean; // Hard limits block, soft limits warn
}

export interface QuotaConfig {
  userId?: string;
  organizationId?: string;
  tier: QuotaTier;
  limits: Partial<Record<QuotaType, number>>;
  customLimits?: Partial<Record<QuotaType, number>>;
  overageAllowed: boolean;
  overageMultiplier: number; // Price multiplier for overage
}

export interface QuotaCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  current: number;
  resetAt?: Date;
  isOverage: boolean;
  warningThreshold: boolean; // True if at 80%+ usage
}

export interface QuotaUsageReport {
  period: "daily" | "monthly";
  startDate: Date;
  endDate: Date;
  usage: Record<QuotaType, { current: number; limit: number; percentage: number }>;
  costEstimate?: number;
  overageCharges?: number;
}

// ============================================
// DEFAULT TIER LIMITS
// ============================================

export const TIER_LIMITS: Record<QuotaTier, Partial<Record<QuotaType, number>>> = {
  free: {
    tokens_daily: 10000,
    tokens_monthly: 100000,
    agents_concurrent: 1,
    agents_daily: 5,
    api_calls_daily: 100,
    api_calls_monthly: 1000,
    storage_bytes: 104857600, // 100MB
    memories_count: 100,
    conversations_daily: 20,
    tool_executions_daily: 50,
  },
  starter: {
    tokens_daily: 50000,
    tokens_monthly: 1000000,
    agents_concurrent: 2,
    agents_daily: 20,
    api_calls_daily: 500,
    api_calls_monthly: 10000,
    storage_bytes: 1073741824, // 1GB
    memories_count: 1000,
    conversations_daily: 100,
    tool_executions_daily: 200,
  },
  professional: {
    tokens_daily: 200000,
    tokens_monthly: 5000000,
    agents_concurrent: 5,
    agents_daily: 100,
    api_calls_daily: 2000,
    api_calls_monthly: 50000,
    storage_bytes: 10737418240, // 10GB
    memories_count: 10000,
    conversations_daily: 500,
    tool_executions_daily: 1000,
  },
  enterprise: {
    tokens_daily: 1000000,
    tokens_monthly: 25000000,
    agents_concurrent: 20,
    agents_daily: 500,
    api_calls_daily: 10000,
    api_calls_monthly: 250000,
    storage_bytes: 107374182400, // 100GB
    memories_count: 100000,
    conversations_daily: 2000,
    tool_executions_daily: 5000,
  },
  unlimited: {
    tokens_daily: Number.MAX_SAFE_INTEGER,
    tokens_monthly: Number.MAX_SAFE_INTEGER,
    agents_concurrent: Number.MAX_SAFE_INTEGER,
    agents_daily: Number.MAX_SAFE_INTEGER,
    api_calls_daily: Number.MAX_SAFE_INTEGER,
    api_calls_monthly: Number.MAX_SAFE_INTEGER,
    storage_bytes: Number.MAX_SAFE_INTEGER,
    memories_count: Number.MAX_SAFE_INTEGER,
    conversations_daily: Number.MAX_SAFE_INTEGER,
    tool_executions_daily: Number.MAX_SAFE_INTEGER,
  },
};

// ============================================
// QUOTA MANAGEMENT
// ============================================

/**
 * Initialize quota for a user
 */
export async function initializeUserQuota(
  userId: string,
  tier: QuotaTier = "free",
  organizationId?: string
): Promise<void> {
  const limits = TIER_LIMITS[tier];

  // Create quota entries for each type
  const quotaEntries = Object.entries(limits).map(([quotaType, limitValue]) => ({
    userId,
    organizationId,
    quotaType,
    limitValue: limitValue as number,
    currentValue: 0,
    resetAt: getResetDate(quotaType as QuotaType),
  }));

  // Insert all quota entries
  for (const entry of quotaEntries) {
    await db
      .insert(usageQuotas)
      .values(entry)
      .onConflictDoUpdate({
        target: [usageQuotas.userId, usageQuotas.quotaType],
        set: { limitValue: entry.limitValue },
      });
  }
}

/**
 * Get user's quota configuration
 */
export async function getUserQuotaConfig(
  userId: string,
  organizationId?: string
): Promise<QuotaConfig> {
  const quotas = await db
    .select()
    .from(usageQuotas)
    .where(
      organizationId
        ? and(eq(usageQuotas.userId, userId), eq(usageQuotas.organizationId, organizationId))
        : eq(usageQuotas.userId, userId)
    );

  const limits: Partial<Record<QuotaType, number>> = {};
  for (const quota of quotas) {
    limits[quota.quotaType as QuotaType] = quota.limitValue;
  }

  // Determine tier based on limits
  let tier: QuotaTier = "free";
  const tokenLimit = limits.tokens_monthly || 0;
  if (tokenLimit >= 25000000) tier = "enterprise";
  else if (tokenLimit >= 5000000) tier = "professional";
  else if (tokenLimit >= 1000000) tier = "starter";

  return {
    userId,
    organizationId,
    tier,
    limits,
    overageAllowed: tier === "enterprise" || (tier as string) === "unlimited",
    overageMultiplier: tier === "enterprise" ? 1.5 : 2.0,
  };
}

/**
 * Check if operation is within quota
 */
export async function checkQuota(
  userId: string,
  quotaType: QuotaType,
  amount = 1,
  organizationId?: string
): Promise<QuotaCheckResult> {
  // Try Redis first for real-time tracking
  const redisKey = getRedisKey(userId, quotaType, organizationId);
  const redisValue = await redis.get(redisKey);

  let current = 0;
  let limit = 0;
  let resetAt: Date | undefined;

  if (redisValue) {
    const cached = JSON.parse(redisValue);
    current = cached.current;
    limit = cached.limit;
    resetAt = cached.resetAt ? new Date(cached.resetAt) : undefined;
  } else {
    // Fall back to database
    const [quota] = await db
      .select()
      .from(usageQuotas)
      .where(
        and(
          eq(usageQuotas.userId, userId),
          eq(usageQuotas.quotaType, quotaType),
          organizationId ? eq(usageQuotas.organizationId, organizationId) : sql`1=1`
        )
      )
      .limit(1);

    if (!quota) {
      // No quota set, use default free tier
      limit = TIER_LIMITS.free[quotaType] || 0;
      current = 0;
    } else {
      limit = quota.limitValue;
      current = quota.currentValue || 0;
      resetAt = quota.resetAt || undefined;
    }

    // Cache in Redis
    await redis.setex(
      redisKey,
      300, // 5 minute cache
      JSON.stringify({ current, limit, resetAt: resetAt?.toISOString() })
    );
  }

  const remaining = Math.max(0, limit - current);
  const allowed = current + amount <= limit;
  const isOverage = current + amount > limit;
  const warningThreshold = current / limit >= 0.8;

  return {
    allowed,
    remaining,
    limit,
    current,
    resetAt,
    isOverage,
    warningThreshold,
  };
}

/**
 * Increment quota usage
 */
export async function incrementQuota(
  userId: string,
  quotaType: QuotaType,
  amount = 1,
  organizationId?: string
): Promise<QuotaCheckResult> {
  // Check quota first
  const check = await checkQuota(userId, quotaType, amount, organizationId);

  if (!check.allowed) {
    return check;
  }

  // Update database
  await db
    .update(usageQuotas)
    .set({
      currentValue: sql`COALESCE(${usageQuotas.currentValue}, 0) + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageQuotas.userId, userId),
        eq(usageQuotas.quotaType, quotaType),
        organizationId ? eq(usageQuotas.organizationId, organizationId) : sql`1=1`
      )
    );

  // Update Redis cache
  const redisKey = getRedisKey(userId, quotaType, organizationId);
  await redis.del(redisKey);

  // Record usage event for analytics
  await recordUsageEvent(userId, quotaType, amount, organizationId);

  return {
    ...check,
    current: check.current + amount,
    remaining: Math.max(0, check.remaining - amount),
  };
}

/**
 * Decrement quota usage (for refunds/cancellations)
 */
export async function decrementQuota(
  userId: string,
  quotaType: QuotaType,
  amount = 1,
  organizationId?: string
): Promise<void> {
  await db
    .update(usageQuotas)
    .set({
      currentValue: sql`GREATEST(0, COALESCE(${usageQuotas.currentValue}, 0) - ${amount})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageQuotas.userId, userId),
        eq(usageQuotas.quotaType, quotaType),
        organizationId ? eq(usageQuotas.organizationId, organizationId) : sql`1=1`
      )
    );

  // Invalidate Redis cache
  const redisKey = getRedisKey(userId, quotaType, organizationId);
  await redis.del(redisKey);
}

/**
 * Set quota limit
 */
export async function setQuotaLimit(
  userId: string,
  quotaType: QuotaType,
  limitValue: number,
  organizationId?: string
): Promise<void> {
  const [existing] = await db
    .select()
    .from(usageQuotas)
    .where(
      and(
        eq(usageQuotas.userId, userId),
        eq(usageQuotas.quotaType, quotaType),
        organizationId ? eq(usageQuotas.organizationId, organizationId) : sql`1=1`
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(usageQuotas)
      .set({ limitValue, updatedAt: new Date() })
      .where(eq(usageQuotas.id, existing.id));
  } else {
    await db.insert(usageQuotas).values({
      userId,
      organizationId,
      quotaType,
      limitValue,
      currentValue: 0,
      resetAt: getResetDate(quotaType),
    });
  }

  // Invalidate Redis cache
  const redisKey = getRedisKey(userId, quotaType, organizationId);
  await redis.del(redisKey);
}

/**
 * Reset quotas (called by scheduler)
 */
export async function resetQuotas(period: "daily" | "monthly"): Promise<number> {
  const quotaTypes: QuotaType[] =
    period === "daily"
      ? ["tokens_daily", "agents_daily", "api_calls_daily", "conversations_daily", "tool_executions_daily"]
      : ["tokens_monthly", "api_calls_monthly"];

  const result = await db
    .update(usageQuotas)
    .set({
      currentValue: 0,
      resetAt: getResetDate(quotaTypes[0]),
      updatedAt: new Date(),
    })
    .where(sql`${usageQuotas.quotaType} = ANY(${quotaTypes}::text[])`);

  // Clear all Redis quota caches
  const keys = await redis.keys("quota:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  return 0; // Would need count from result
}

// ============================================
// USAGE REPORTING
// ============================================

/**
 * Get usage report for user
 */
export async function getUsageReport(
  userId: string,
  period: "daily" | "monthly" = "monthly",
  organizationId?: string
): Promise<QuotaUsageReport> {
  const quotas = await db
    .select()
    .from(usageQuotas)
    .where(
      and(
        eq(usageQuotas.userId, userId),
        organizationId ? eq(usageQuotas.organizationId, organizationId) : sql`1=1`
      )
    );

  const now = new Date();
  const startDate =
    period === "daily"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate =
    period === "daily"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const usage: Record<QuotaType, { current: number; limit: number; percentage: number }> =
    {} as any;

  const relevantTypes: QuotaType[] =
    period === "daily"
      ? ["tokens_daily", "agents_daily", "api_calls_daily", "conversations_daily", "tool_executions_daily"]
      : ["tokens_monthly", "api_calls_monthly", "storage_bytes", "memories_count"];

  for (const quota of quotas) {
    const quotaType = quota.quotaType as QuotaType;
    if (relevantTypes.includes(quotaType)) {
      usage[quotaType] = {
        current: quota.currentValue || 0,
        limit: quota.limitValue,
        percentage: quota.limitValue > 0 ? ((quota.currentValue || 0) / quota.limitValue) * 100 : 0,
      };
    }
  }

  // Calculate cost estimate (simplified)
  const tokenUsage = usage.tokens_monthly?.current || usage.tokens_daily?.current || 0;
  const costEstimate = (tokenUsage / 1000000) * 0.015; // $0.015 per 1M tokens (simplified)

  return {
    period,
    startDate,
    endDate,
    usage,
    costEstimate,
    overageCharges: 0, // Would need overage tracking
  };
}

/**
 * Get organization usage report
 */
export async function getOrganizationUsageReport(
  organizationId: string,
  period: "daily" | "monthly" = "monthly"
): Promise<{
  organizationTotal: QuotaUsageReport;
  byUser: Array<{ userId: string; userName: string; usage: QuotaUsageReport }>;
}> {
  // Get all organization members
  const members = await db
    .select({
      userId: organizationMembers.userId,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  const userReports: Array<{ userId: string; userName: string; usage: QuotaUsageReport }> = [];

  for (const member of members) {
    const report = await getUsageReport(member.userId, period, organizationId);
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, member.userId))
      .limit(1);

    userReports.push({
      userId: member.userId,
      userName: user?.name || "Unknown",
      usage: report,
    });
  }

  // Aggregate organization total
  const orgTotal = await getUsageReport("", period, organizationId);

  return {
    organizationTotal: orgTotal,
    byUser: userReports,
  };
}

/**
 * Get usage trends
 */
export async function getUsageTrends(
  userId: string,
  quotaType: QuotaType,
  days = 30
): Promise<Array<{ date: string; usage: number }>> {
  const redisKey = `usage_history:${userId}:${quotaType}`;
  const historyStr = await redis.lrange(redisKey, 0, days - 1);

  return historyStr.map((entry) => {
    const parsed = JSON.parse(entry);
    return {
      date: parsed.date,
      usage: parsed.amount,
    };
  });
}

// ============================================
// ALERTS & NOTIFICATIONS
// ============================================

/**
 * Check quota warnings and send alerts
 */
export async function checkQuotaWarnings(
  userId: string,
  organizationId?: string
): Promise<Array<{ quotaType: QuotaType; percentage: number; message: string }>> {
  const warnings: Array<{ quotaType: QuotaType; percentage: number; message: string }> = [];

  const quotas = await db
    .select()
    .from(usageQuotas)
    .where(
      and(
        eq(usageQuotas.userId, userId),
        organizationId ? eq(usageQuotas.organizationId, organizationId) : sql`1=1`
      )
    );

  for (const quota of quotas) {
    const percentage = quota.limitValue > 0 ? ((quota.currentValue || 0) / quota.limitValue) * 100 : 0;

    if (percentage >= 100) {
      warnings.push({
        quotaType: quota.quotaType as QuotaType,
        percentage,
        message: `You have exceeded your ${formatQuotaType(quota.quotaType as QuotaType)} limit.`,
      });
    } else if (percentage >= 90) {
      warnings.push({
        quotaType: quota.quotaType as QuotaType,
        percentage,
        message: `You are at ${percentage.toFixed(0)}% of your ${formatQuotaType(quota.quotaType as QuotaType)} limit.`,
      });
    } else if (percentage >= 80) {
      warnings.push({
        quotaType: quota.quotaType as QuotaType,
        percentage,
        message: `You are approaching your ${formatQuotaType(quota.quotaType as QuotaType)} limit (${percentage.toFixed(0)}% used).`,
      });
    }
  }

  return warnings;
}

/**
 * Subscribe to quota alerts
 */
export async function subscribeToQuotaAlerts(
  userId: string,
  threshold: number = 80,
  webhookUrl?: string
): Promise<void> {
  const key = `quota_alert_config:${userId}`;
  await redis.set(
    key,
    JSON.stringify({
      threshold,
      webhookUrl,
      createdAt: new Date().toISOString(),
    })
  );
}

// ============================================
// HELPERS
// ============================================

function getRedisKey(userId: string, quotaType: QuotaType, organizationId?: string): string {
  return organizationId
    ? `quota:${organizationId}:${userId}:${quotaType}`
    : `quota:${userId}:${quotaType}`;
}

function getResetDate(quotaType: QuotaType): Date {
  const now = new Date();

  if (quotaType.includes("daily")) {
    // Reset at midnight UTC
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }

  if (quotaType.includes("monthly")) {
    // Reset at start of next month
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  }

  // No reset for storage/count quotas
  return new Date(Date.UTC(now.getUTCFullYear() + 100, 0, 1));
}

function formatQuotaType(quotaType: QuotaType): string {
  const labels: Record<QuotaType, string> = {
    tokens_daily: "daily tokens",
    tokens_monthly: "monthly tokens",
    agents_concurrent: "concurrent agents",
    agents_daily: "daily agents",
    api_calls_daily: "daily API calls",
    api_calls_monthly: "monthly API calls",
    storage_bytes: "storage",
    memories_count: "memories",
    conversations_daily: "daily conversations",
    tool_executions_daily: "daily tool executions",
  };
  return labels[quotaType] || quotaType;
}

async function recordUsageEvent(
  userId: string,
  quotaType: QuotaType,
  amount: number,
  organizationId?: string
): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  const key = `usage_history:${userId}:${quotaType}`;

  // Add to history list
  await redis.lpush(key, JSON.stringify({ date, amount, organizationId }));

  // Keep only last 90 days
  await redis.ltrim(key, 0, 89);
}

/**
 * Close Redis connection
 */
export async function closeQuotaManager(): Promise<void> {
  await redis.quit();
}

export default {
  initializeUserQuota,
  getUserQuotaConfig,
  checkQuota,
  incrementQuota,
  decrementQuota,
  setQuotaLimit,
  resetQuotas,
  getUsageReport,
  getOrganizationUsageReport,
  getUsageTrends,
  checkQuotaWarnings,
  subscribeToQuotaAlerts,
  closeQuotaManager,
  TIER_LIMITS,
};
