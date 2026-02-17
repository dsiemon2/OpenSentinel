import { db } from "../../db";
import {
  usagePatterns,
  messages,
  toolLogs,
  memories,
  conversations,
} from "../../db/schema";
import { eq, and, gte, lte, desc, sql, count } from "drizzle-orm";

export type PatternType =
  | "tool_usage"
  | "topic"
  | "time_of_day"
  | "complexity"
  | "conversation_length"
  | "response_preference";

export interface UsagePattern {
  type: PatternType;
  key: string;
  data: Record<string, unknown>;
  confidence: number;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
}

export interface EvolutionSnapshot {
  totalConversations: number;
  totalMessages: number;
  totalToolUses: number;
  totalMemories: number;
  favoriteTools: Array<{ tool: string; count: number }>;
  activeHours: Array<{ hour: number; count: number }>;
  topTopics: Array<{ topic: string; count: number }>;
  averageConversationLength: number;
  patterns: UsagePattern[];
}

// Track a usage pattern
export async function trackPattern(
  userId: string,
  type: PatternType,
  key: string,
  data?: Record<string, unknown>
): Promise<void> {
  const existing = await db
    .select()
    .from(usagePatterns)
    .where(
      and(
        eq(usagePatterns.userId, userId),
        eq(usagePatterns.patternType, type),
        eq(usagePatterns.patternKey, key)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing pattern
    await db
      .update(usagePatterns)
      .set({
        occurrences: sql`${usagePatterns.occurrences} + 1`,
        lastSeen: new Date(),
        confidence: sql`LEAST(${usagePatterns.confidence} + 1, 100)`,
        patternData: data ? { ...existing[0].patternData as object, ...data } : existing[0].patternData,
      })
      .where(eq(usagePatterns.id, existing[0].id));
  } else {
    // Create new pattern
    await db.insert(usagePatterns).values({
      userId,
      patternType: type,
      patternKey: key,
      patternData: data || {},
      confidence: 10,
      occurrences: 1,
    });
  }
}

// Get user's patterns
export async function getUserPatterns(
  userId: string,
  type?: PatternType
): Promise<UsagePattern[]> {
  let query = db
    .select()
    .from(usagePatterns)
    .where(eq(usagePatterns.userId, userId));

  if (type) {
    query = db
      .select()
      .from(usagePatterns)
      .where(and(eq(usagePatterns.userId, userId), eq(usagePatterns.patternType, type)));
  }

  const results = await query.orderBy(desc(usagePatterns.confidence));

  return results.map((r) => ({
    type: r.patternType as PatternType,
    key: r.patternKey,
    data: (r.patternData as Record<string, unknown>) || {},
    confidence: r.confidence || 0,
    occurrences: r.occurrences || 1,
    firstSeen: r.firstSeen,
    lastSeen: r.lastSeen || r.firstSeen,
  }));
}

// Analyze tool usage patterns
export async function analyzeToolUsage(userId: string): Promise<void> {
  const recentTools = await db
    .select({
      toolName: toolLogs.toolName,
      count: count(),
    })
    .from(toolLogs)
    .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        gte(toolLogs.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      )
    )
    .groupBy(toolLogs.toolName);

  for (const tool of recentTools) {
    await trackPattern(userId, "tool_usage", tool.toolName, {
      recentCount: tool.count,
    });
  }
}

// Analyze time-of-day patterns
export async function analyzeTimePatterns(userId: string): Promise<void> {
  const recentMessages = await db
    .select()
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      )
    );

  // Count messages by hour
  const hourCounts: Record<number, number> = {};
  for (const msg of recentMessages) {
    const hour = msg.messages.createdAt.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  // Find peak hours
  const sortedHours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  for (const [hour, count] of sortedHours) {
    const timeLabel = getTimeLabel(parseInt(hour));
    await trackPattern(userId, "time_of_day", timeLabel, {
      hour: parseInt(hour),
      messageCount: count,
    });
  }
}

function getTimeLabel(hour: number): string {
  if (hour >= 5 && hour < 9) return "early_morning";
  if (hour >= 9 && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

// Get evolution snapshot for a user
export async function getEvolutionSnapshot(userId: string): Promise<EvolutionSnapshot> {
  // Count conversations
  const [convCount] = await db
    .select({ count: count() })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  // Count messages
  const [msgCount] = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.userId, userId));

  // Count tool uses
  const [toolCount] = await db
    .select({ count: count() })
    .from(toolLogs)
    .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
    .where(eq(conversations.userId, userId));

  // Count memories
  const [memCount] = await db
    .select({ count: count() })
    .from(memories)
    .where(eq(memories.userId, userId));

  // Get favorite tools
  const favoriteTools = await db
    .select({
      tool: toolLogs.toolName,
      count: count(),
    })
    .from(toolLogs)
    .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
    .where(eq(conversations.userId, userId))
    .groupBy(toolLogs.toolName)
    .orderBy(desc(count()))
    .limit(5);

  // Get patterns
  const patterns = await getUserPatterns(userId);

  return {
    totalConversations: convCount.count,
    totalMessages: msgCount.count,
    totalToolUses: toolCount.count,
    totalMemories: memCount.count,
    favoriteTools: favoriteTools.map((t) => ({ tool: t.tool, count: t.count })),
    activeHours: [], // Would need more complex query
    topTopics: [], // Would need NLP analysis
    averageConversationLength: msgCount.count / Math.max(convCount.count, 1),
    patterns,
  };
}

// Generate growth report for a time period
export async function generateGrowthReport(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  period: { start: Date; end: Date };
  metrics: {
    conversations: number;
    messages: number;
    toolUses: number;
    newMemories: number;
  };
  insights: string[];
  patterns: UsagePattern[];
}> {
  // Count conversations in period
  const [convCount] = await db
    .select({ count: count() })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      )
    );

  // Count messages in period
  const [msgCount] = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        gte(messages.createdAt, startDate),
        lte(messages.createdAt, endDate)
      )
    );

  // Count tool uses in period
  const [toolCount] = await db
    .select({ count: count() })
    .from(toolLogs)
    .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        gte(toolLogs.createdAt, startDate),
        lte(toolLogs.createdAt, endDate)
      )
    );

  // Count new memories in period
  const [memCount] = await db
    .select({ count: count() })
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        gte(memories.createdAt, startDate),
        lte(memories.createdAt, endDate)
      )
    );

  // Get patterns that emerged in this period
  const patterns = await db
    .select()
    .from(usagePatterns)
    .where(
      and(
        eq(usagePatterns.userId, userId),
        gte(usagePatterns.firstSeen, startDate)
      )
    );

  // Generate insights
  const insights: string[] = [];

  if (convCount.count > 0) {
    insights.push(`You had ${convCount.count} conversations during this period.`);
  }

  if (toolCount.count > 0) {
    insights.push(`You used tools ${toolCount.count} times to get things done.`);
  }

  if (memCount.count > 0) {
    insights.push(`I learned ${memCount.count} new things about you.`);
  }

  return {
    period: { start: startDate, end: endDate },
    metrics: {
      conversations: convCount.count,
      messages: msgCount.count,
      toolUses: toolCount.count,
      newMemories: memCount.count,
    },
    insights,
    patterns: patterns.map((p) => ({
      type: p.patternType as PatternType,
      key: p.patternKey,
      data: (p.patternData as Record<string, unknown>) || {},
      confidence: p.confidence || 0,
      occurrences: p.occurrences || 1,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen || p.firstSeen,
    })),
  };
}

// Run all analysis for a user (call periodically)
export async function runFullAnalysis(userId: string): Promise<void> {
  await analyzeToolUsage(userId);
  await analyzeTimePatterns(userId);
}
