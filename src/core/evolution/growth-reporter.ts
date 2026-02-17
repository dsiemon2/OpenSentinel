import { generateGrowthReport, getEvolutionSnapshot } from "./evolution-tracker";
import { getUserAchievements, checkAchievements, getUserPoints, getAchievementProgress } from "./achievement-system";
import { getModeStats, getCurrentMode } from "./mode-manager";
import { getShedStats } from "./memory-shedder";

export interface GrowthReport {
  period: {
    type: "weekly" | "monthly";
    start: Date;
    end: Date;
  };
  summary: string;
  metrics: {
    conversations: number;
    messages: number;
    toolUses: number;
    newMemories: number;
    archivedMemories: number;
  };
  achievements: {
    newlyUnlocked: Array<{ name: string; emoji: string; points: number }>;
    totalPoints: number;
    pointsGained: number;
  };
  modeUsage: Record<string, { sessions: number; minutes: number }>;
  highlights: string[];
  suggestions: string[];
}

// Generate a weekly growth report
export async function generateWeeklyReport(userId: string): Promise<GrowthReport> {
  const endDate = new Date();
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return generateReport(userId, startDate, endDate, "weekly");
}

// Generate a monthly growth report
export async function generateMonthlyReport(userId: string): Promise<GrowthReport> {
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return generateReport(userId, startDate, endDate, "monthly");
}

async function generateReport(
  userId: string,
  startDate: Date,
  endDate: Date,
  type: "weekly" | "monthly"
): Promise<GrowthReport> {
  // Get growth data
  const growthData = await generateGrowthReport(userId, startDate, endDate);

  // Check for new achievements
  const newAchievements = await checkAchievements(userId);
  const totalPoints = await getUserPoints(userId);

  // Get mode stats
  const modeStats = await getModeStats(userId);

  // Get shed stats
  const shedStats = await getShedStats(userId);

  // Generate highlights
  const highlights = generateHighlights(growthData, newAchievements);

  // Generate suggestions
  const suggestions = await generateSuggestions(userId, growthData);

  // Generate summary
  const summary = generateSummary(growthData, newAchievements, type);

  return {
    period: {
      type,
      start: startDate,
      end: endDate,
    },
    summary,
    metrics: {
      conversations: growthData.metrics.conversations,
      messages: growthData.metrics.messages,
      toolUses: growthData.metrics.toolUses,
      newMemories: growthData.metrics.newMemories,
      archivedMemories: shedStats.totalArchived,
    },
    achievements: {
      newlyUnlocked: newAchievements.map((a) => ({
        name: a.name,
        emoji: a.iconEmoji,
        points: a.points,
      })),
      totalPoints,
      pointsGained: newAchievements.reduce((sum, a) => sum + a.points, 0),
    },
    modeUsage: {
      productivity: modeStats.productivity,
      creative: modeStats.creative,
      research: modeStats.research,
      learning: modeStats.learning,
    },
    highlights,
    suggestions,
  };
}

function generateHighlights(
  growthData: Awaited<ReturnType<typeof generateGrowthReport>>,
  newAchievements: Array<{ name: string; iconEmoji: string }>
): string[] {
  const highlights: string[] = [];

  if (growthData.metrics.conversations > 0) {
    highlights.push(
      `You had ${growthData.metrics.conversations} conversations this period!`
    );
  }

  if (growthData.metrics.toolUses > 10) {
    highlights.push(
      `Power user alert! You used tools ${growthData.metrics.toolUses} times.`
    );
  }

  if (growthData.metrics.newMemories > 5) {
    highlights.push(
      `I learned ${growthData.metrics.newMemories} new things about you.`
    );
  }

  for (const achievement of newAchievements) {
    highlights.push(
      `${achievement.iconEmoji} Achievement unlocked: ${achievement.name}!`
    );
  }

  if (growthData.patterns.length > 0) {
    const topPattern = growthData.patterns[0];
    highlights.push(
      `New pattern detected: You frequently use ${topPattern.key}.`
    );
  }

  return highlights;
}

async function generateSuggestions(
  userId: string,
  growthData: Awaited<ReturnType<typeof generateGrowthReport>>
): Promise<string[]> {
  const suggestions: string[] = [];

  // Check achievement progress
  const progress = await getAchievementProgress(userId);
  const almostUnlocked = progress.filter(
    (p) => p.progress / p.target >= 0.7 && p.progress / p.target < 1
  );

  for (const achievement of almostUnlocked.slice(0, 2)) {
    const remaining = achievement.target - achievement.progress;
    suggestions.push(
      `You're close to unlocking "${achievement.achievement.name}"! Just ${remaining} more ${achievement.achievement.criteria.metric}.`
    );
  }

  // Suggest mode if not used
  const currentMode = await getCurrentMode(userId);
  if (!currentMode) {
    suggestions.push(
      "Try activating a transformation mode! Say 'switch to productivity mode' to get started."
    );
  }

  // Suggest based on low activity
  if (growthData.metrics.toolUses < 5) {
    suggestions.push(
      "You haven't used many tools this period. Try asking me to search the web, browse a page, or run a command!"
    );
  }

  return suggestions;
}

function generateSummary(
  growthData: Awaited<ReturnType<typeof generateGrowthReport>>,
  newAchievements: Array<{ name: string }>,
  type: "weekly" | "monthly"
): string {
  const period = type === "weekly" ? "this week" : "this month";

  let summary = `Here's your ${type} growth report! `;

  if (growthData.metrics.conversations > 0) {
    summary += `You've been active with ${growthData.metrics.conversations} conversations ${period}. `;
  } else {
    summary += `I missed you ${period}! Let's catch up. `;
  }

  if (newAchievements.length > 0) {
    summary += `You unlocked ${newAchievements.length} new achievement${newAchievements.length > 1 ? "s" : ""}! `;
  }

  if (growthData.metrics.newMemories > 0) {
    summary += `I've been learning about you - ${growthData.metrics.newMemories} new memories stored. `;
  }

  return summary.trim();
}

// Format report as text for Telegram/display
export function formatReportAsText(report: GrowthReport): string {
  let text = `📊 **${report.period.type === "weekly" ? "Weekly" : "Monthly"} Growth Report**\n\n`;

  text += `${report.summary}\n\n`;

  text += `**📈 Activity**\n`;
  text += `• Conversations: ${report.metrics.conversations}\n`;
  text += `• Messages: ${report.metrics.messages}\n`;
  text += `• Tool uses: ${report.metrics.toolUses}\n`;
  text += `• New memories: ${report.metrics.newMemories}\n\n`;

  if (report.achievements.newlyUnlocked.length > 0) {
    text += `**🏆 New Achievements**\n`;
    for (const achievement of report.achievements.newlyUnlocked) {
      text += `${achievement.emoji} ${achievement.name} (+${achievement.points} pts)\n`;
    }
    text += `\nTotal points: ${report.achievements.totalPoints}\n\n`;
  }

  if (report.highlights.length > 0) {
    text += `**✨ Highlights**\n`;
    for (const highlight of report.highlights) {
      text += `• ${highlight}\n`;
    }
    text += `\n`;
  }

  if (report.suggestions.length > 0) {
    text += `**💡 Suggestions**\n`;
    for (const suggestion of report.suggestions) {
      text += `• ${suggestion}\n`;
    }
  }

  return text;
}

// Schedule report generation (to be called from scheduler)
export async function scheduleReportGeneration(
  userId: string,
  type: "weekly" | "monthly",
  chatId: string
): Promise<{ report: GrowthReport; formattedText: string }> {
  const report =
    type === "weekly"
      ? await generateWeeklyReport(userId)
      : await generateMonthlyReport(userId);

  const formattedText = formatReportAsText(report);

  return { report, formattedText };
}
