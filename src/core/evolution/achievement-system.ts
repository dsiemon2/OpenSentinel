import { db } from "../../db";
import {
  achievements,
  userAchievements,
  messages,
  toolLogs,
  memories,
  conversations,
  evolutionModes,
} from "../../db/schema";
import { eq, and, count, gte, sql } from "drizzle-orm";

export interface AchievementDefinition {
  code: string;
  name: string;
  description: string;
  iconEmoji: string;
  category: "exploration" | "productivity" | "mastery" | "social" | "special";
  criteria: {
    type: "count" | "streak" | "threshold" | "milestone";
    metric: string;
    threshold: number;
    conditions?: Record<string, unknown>;
  };
  points: number;
}

// Default achievement definitions
export const DEFAULT_ACHIEVEMENTS: AchievementDefinition[] = [
  // Exploration achievements
  {
    code: "first_conversation",
    name: "Hello, World!",
    description: "Started your first conversation",
    iconEmoji: "👋",
    category: "exploration",
    criteria: { type: "count", metric: "conversations", threshold: 1 },
    points: 10,
  },
  {
    code: "first_tool",
    name: "Tool Time",
    description: "Used a tool for the first time",
    iconEmoji: "🔧",
    category: "exploration",
    criteria: { type: "count", metric: "tool_uses", threshold: 1 },
    points: 10,
  },
  {
    code: "first_memory",
    name: "Never Forget",
    description: "Created your first memory",
    iconEmoji: "🧠",
    category: "exploration",
    criteria: { type: "count", metric: "memories", threshold: 1 },
    points: 10,
  },
  {
    code: "mode_explorer",
    name: "Mode Explorer",
    description: "Tried all four transformation modes",
    iconEmoji: "🔄",
    category: "exploration",
    criteria: { type: "threshold", metric: "unique_modes", threshold: 4 },
    points: 25,
  },

  // Productivity achievements
  {
    code: "power_user",
    name: "Power User",
    description: "Had 100 conversations",
    iconEmoji: "⚡",
    category: "productivity",
    criteria: { type: "count", metric: "conversations", threshold: 100 },
    points: 50,
  },
  {
    code: "tool_master",
    name: "Tool Master",
    description: "Used tools 500 times",
    iconEmoji: "🛠️",
    category: "productivity",
    criteria: { type: "count", metric: "tool_uses", threshold: 500 },
    points: 75,
  },
  {
    code: "shell_wizard",
    name: "Shell Wizard",
    description: "Executed 100 shell commands",
    iconEmoji: "🧙",
    category: "productivity",
    criteria: {
      type: "count",
      metric: "tool_uses",
      threshold: 100,
      conditions: { tool: "execute_command" },
    },
    points: 50,
  },

  // Mastery achievements
  {
    code: "memory_bank",
    name: "Memory Bank",
    description: "Stored 50 memories",
    iconEmoji: "🏦",
    category: "mastery",
    criteria: { type: "count", metric: "memories", threshold: 50 },
    points: 50,
  },
  {
    code: "week_streak",
    name: "Weekly Regular",
    description: "Used OpenSentinel 7 days in a row",
    iconEmoji: "📅",
    category: "mastery",
    criteria: { type: "streak", metric: "daily_usage", threshold: 7 },
    points: 30,
  },
  {
    code: "month_streak",
    name: "Monthly Champion",
    description: "Used OpenSentinel 30 days in a row",
    iconEmoji: "🏆",
    category: "mastery",
    criteria: { type: "streak", metric: "daily_usage", threshold: 30 },
    points: 100,
  },

  // Special achievements
  {
    code: "night_owl",
    name: "Night Owl",
    description: "Had 10 conversations after midnight",
    iconEmoji: "🦉",
    category: "special",
    criteria: {
      type: "count",
      metric: "conversations",
      threshold: 10,
      conditions: { hour_range: [0, 5] },
    },
    points: 20,
  },
  {
    code: "early_bird",
    name: "Early Bird",
    description: "Had 10 conversations before 7am",
    iconEmoji: "🐦",
    category: "special",
    criteria: {
      type: "count",
      metric: "conversations",
      threshold: 10,
      conditions: { hour_range: [5, 7] },
    },
    points: 20,
  },
];

// Initialize default achievements in database
export async function initializeAchievements(): Promise<void> {
  for (const achievement of DEFAULT_ACHIEVEMENTS) {
    const existing = await db
      .select()
      .from(achievements)
      .where(eq(achievements.code, achievement.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(achievements).values({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        iconEmoji: achievement.iconEmoji,
        category: achievement.category,
        criteria: achievement.criteria,
        points: achievement.points,
      });
    }
  }
}

// Check if user has achievement
export async function hasAchievement(
  userId: string,
  achievementCode: string
): Promise<boolean> {
  const [achievement] = await db
    .select()
    .from(achievements)
    .where(eq(achievements.code, achievementCode))
    .limit(1);

  if (!achievement) return false;

  const [unlocked] = await db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievement.id)
      )
    )
    .limit(1);

  return !!unlocked;
}

// Unlock achievement for user
export async function unlockAchievement(
  userId: string,
  achievementCode: string
): Promise<{ unlocked: boolean; achievement?: AchievementDefinition }> {
  // Check if already unlocked
  if (await hasAchievement(userId, achievementCode)) {
    return { unlocked: false };
  }

  const [achievement] = await db
    .select()
    .from(achievements)
    .where(eq(achievements.code, achievementCode))
    .limit(1);

  if (!achievement) {
    return { unlocked: false };
  }

  await db.insert(userAchievements).values({
    userId,
    achievementId: achievement.id,
  });

  return {
    unlocked: true,
    achievement: {
      code: achievement.code,
      name: achievement.name,
      description: achievement.description || "",
      iconEmoji: achievement.iconEmoji || "🏆",
      category: achievement.category as AchievementDefinition["category"],
      criteria: achievement.criteria as AchievementDefinition["criteria"],
      points: achievement.points || 10,
    },
  };
}

// Get user's unlocked achievements
export async function getUserAchievements(
  userId: string
): Promise<Array<{ achievement: AchievementDefinition; unlockedAt: Date }>> {
  const unlocked = await db
    .select()
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId));

  return unlocked.map((u) => ({
    achievement: {
      code: u.achievements.code,
      name: u.achievements.name,
      description: u.achievements.description || "",
      iconEmoji: u.achievements.iconEmoji || "🏆",
      category: u.achievements.category as AchievementDefinition["category"],
      criteria: u.achievements.criteria as AchievementDefinition["criteria"],
      points: u.achievements.points || 10,
    },
    unlockedAt: u.user_achievements.unlockedAt,
  }));
}

// Get user's total points
export async function getUserPoints(userId: string): Promise<number> {
  const unlocked = await getUserAchievements(userId);
  return unlocked.reduce((sum, u) => sum + u.achievement.points, 0);
}

// Check and unlock achievements based on current stats
export async function checkAchievements(
  userId: string
): Promise<AchievementDefinition[]> {
  const newlyUnlocked: AchievementDefinition[] = [];

  // Get all achievements
  const allAchievements = await db.select().from(achievements);

  for (const achievement of allAchievements) {
    // Skip if already unlocked
    if (await hasAchievement(userId, achievement.code)) {
      continue;
    }

    const criteria = achievement.criteria as AchievementDefinition["criteria"];
    let shouldUnlock = false;

    switch (criteria.metric) {
      case "conversations":
        const [convCount] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.userId, userId));
        shouldUnlock = convCount.count >= criteria.threshold;
        break;

      case "tool_uses":
        if (criteria.conditions?.tool) {
          const [toolCount] = await db
            .select({ count: count() })
            .from(toolLogs)
            .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
            .where(
              and(
                eq(conversations.userId, userId),
                eq(toolLogs.toolName, criteria.conditions.tool as string)
              )
            );
          shouldUnlock = toolCount.count >= criteria.threshold;
        } else {
          const [toolCount] = await db
            .select({ count: count() })
            .from(toolLogs)
            .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
            .where(eq(conversations.userId, userId));
          shouldUnlock = toolCount.count >= criteria.threshold;
        }
        break;

      case "memories":
        const [memCount] = await db
          .select({ count: count() })
          .from(memories)
          .where(eq(memories.userId, userId));
        shouldUnlock = memCount.count >= criteria.threshold;
        break;

      case "unique_modes":
        const modes = await db
          .select({ mode: evolutionModes.mode })
          .from(evolutionModes)
          .where(eq(evolutionModes.userId, userId))
          .groupBy(evolutionModes.mode);
        shouldUnlock = modes.length >= criteria.threshold;
        break;
    }

    if (shouldUnlock) {
      const result = await unlockAchievement(userId, achievement.code);
      if (result.unlocked && result.achievement) {
        newlyUnlocked.push(result.achievement);
      }
    }
  }

  return newlyUnlocked;
}

// Get progress toward next achievements
export async function getAchievementProgress(
  userId: string
): Promise<Array<{ achievement: AchievementDefinition; progress: number; target: number }>> {
  const progress: Array<{
    achievement: AchievementDefinition;
    progress: number;
    target: number;
  }> = [];

  const allAchievements = await db.select().from(achievements);

  for (const achievement of allAchievements) {
    // Skip if already unlocked
    if (await hasAchievement(userId, achievement.code)) {
      continue;
    }

    const criteria = achievement.criteria as AchievementDefinition["criteria"];
    let currentProgress = 0;

    switch (criteria.metric) {
      case "conversations":
        const [convCount] = await db
          .select({ count: count() })
          .from(conversations)
          .where(eq(conversations.userId, userId));
        currentProgress = convCount.count;
        break;

      case "tool_uses":
        const [toolCount] = await db
          .select({ count: count() })
          .from(toolLogs)
          .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
          .where(eq(conversations.userId, userId));
        currentProgress = toolCount.count;
        break;

      case "memories":
        const [memCount] = await db
          .select({ count: count() })
          .from(memories)
          .where(eq(memories.userId, userId));
        currentProgress = memCount.count;
        break;
    }

    progress.push({
      achievement: {
        code: achievement.code,
        name: achievement.name,
        description: achievement.description || "",
        iconEmoji: achievement.iconEmoji || "🏆",
        category: achievement.category as AchievementDefinition["category"],
        criteria,
        points: achievement.points || 10,
      },
      progress: currentProgress,
      target: criteria.threshold,
    });
  }

  // Sort by closest to completion
  return progress.sort(
    (a, b) => b.progress / b.target - a.progress / a.target
  );
}

// Get achievement leaderboard (for multi-user scenarios)
export async function getLeaderboard(
  limit: number = 10
): Promise<Array<{ userId: string; points: number; achievementCount: number }>> {
  const results = await db
    .select({
      userId: userAchievements.userId,
      achievementCount: count(),
    })
    .from(userAchievements)
    .groupBy(userAchievements.userId)
    .orderBy(sql`count(*) DESC`)
    .limit(limit);

  // Calculate points for each user
  const leaderboard = await Promise.all(
    results.map(async (r) => ({
      userId: r.userId,
      points: await getUserPoints(r.userId),
      achievementCount: r.achievementCount,
    }))
  );

  return leaderboard.sort((a, b) => b.points - a.points);
}
