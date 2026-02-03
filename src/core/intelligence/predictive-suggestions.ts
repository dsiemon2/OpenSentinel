/**
 * Predictive Suggestions System
 *
 * Anticipates user needs based on historical patterns, time context,
 * and behavioral analysis to proactively suggest relevant actions.
 */

import { db } from "../../db";
import {
  usagePatterns,
  messages,
  conversations,
  toolLogs,
  memories,
  scheduledTasks,
} from "../../db/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../../config/env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Types for predictive suggestions
export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  description: string;
  confidence: number; // 0-100
  relevance: number; // 0-100
  action?: SuggestedAction;
  context?: SuggestionContext;
  expiresAt?: Date;
  createdAt: Date;
}

export type SuggestionType =
  | "task_reminder"
  | "follow_up"
  | "related_topic"
  | "tool_suggestion"
  | "time_based"
  | "pattern_based"
  | "proactive_info"
  | "workflow_optimization";

export interface SuggestedAction {
  type: "message" | "tool" | "query" | "link";
  payload: Record<string, unknown>;
  label: string;
}

export interface SuggestionContext {
  triggerPattern?: string;
  relatedMemories?: string[];
  sourceConversation?: string;
  timeContext?: string;
}

export interface PatternAnalysis {
  frequentTopics: Array<{ topic: string; frequency: number; lastMentioned: Date }>;
  preferredTools: Array<{ tool: string; successRate: number; frequency: number }>;
  activeHours: Array<{ hour: number; activity: number }>;
  conversationPatterns: {
    averageLength: number;
    commonStarters: string[];
    followUpRate: number;
  };
}

// Generate suggestions for a user based on current context
export async function generateSuggestions(
  userId: string,
  currentContext?: string,
  limit = 5
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Get user patterns
  const patterns = await analyzeUserPatterns(userId);

  // Time-based suggestions
  const timeSuggestions = await generateTimeSuggestions(userId, patterns);
  suggestions.push(...timeSuggestions);

  // Pattern-based suggestions
  const patternSuggestions = await generatePatternSuggestions(userId, patterns);
  suggestions.push(...patternSuggestions);

  // Context-based suggestions (if context provided)
  if (currentContext) {
    const contextSuggestions = await generateContextSuggestions(
      userId,
      currentContext,
      patterns
    );
    suggestions.push(...contextSuggestions);
  }

  // Follow-up suggestions from recent conversations
  const followUpSuggestions = await generateFollowUpSuggestions(userId);
  suggestions.push(...followUpSuggestions);

  // Sort by combined score (confidence * relevance)
  suggestions.sort((a, b) => {
    const scoreA = (a.confidence / 100) * (a.relevance / 100);
    const scoreB = (b.confidence / 100) * (b.relevance / 100);
    return scoreB - scoreA;
  });

  // Remove duplicates and limit
  const seen = new Set<string>();
  const uniqueSuggestions = suggestions.filter((s) => {
    const key = `${s.type}-${s.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueSuggestions.slice(0, limit);
}

// Analyze user patterns for prediction
async function analyzeUserPatterns(userId: string): Promise<PatternAnalysis> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get frequent topics from patterns
  const topicPatterns = await db
    .select()
    .from(usagePatterns)
    .where(
      and(
        eq(usagePatterns.userId, userId),
        eq(usagePatterns.patternType, "topic")
      )
    )
    .orderBy(desc(usagePatterns.occurrences))
    .limit(10);

  // Get preferred tools
  const toolStats = await db
    .select({
      tool: toolLogs.toolName,
      total: count(),
      successful: sql<number>`SUM(CASE WHEN ${toolLogs.success} THEN 1 ELSE 0 END)`,
    })
    .from(toolLogs)
    .innerJoin(conversations, eq(toolLogs.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        gte(toolLogs.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(toolLogs.toolName)
    .orderBy(desc(count()));

  // Get active hours
  const hourlyActivity = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${messages.createdAt})`,
      count: count(),
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(sql`EXTRACT(HOUR FROM ${messages.createdAt})`);

  // Get conversation stats
  const conversationStats = await db
    .select({
      conversationId: conversations.id,
      messageCount: count(),
    })
    .from(conversations)
    .innerJoin(messages, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.userId, userId),
        gte(conversations.createdAt, thirtyDaysAgo)
      )
    )
    .groupBy(conversations.id);

  const avgLength =
    conversationStats.length > 0
      ? conversationStats.reduce((sum, c) => sum + c.messageCount, 0) /
        conversationStats.length
      : 0;

  return {
    frequentTopics: topicPatterns.map((p) => ({
      topic: p.patternKey,
      frequency: p.occurrences || 1,
      lastMentioned: p.lastSeen || p.firstSeen,
    })),
    preferredTools: toolStats.map((t) => ({
      tool: t.tool,
      successRate: t.total > 0 ? (Number(t.successful) / t.total) * 100 : 0,
      frequency: t.total,
    })),
    activeHours: hourlyActivity.map((h) => ({
      hour: h.hour,
      activity: h.count,
    })),
    conversationPatterns: {
      averageLength: Math.round(avgLength),
      commonStarters: [], // Would need NLP analysis
      followUpRate: 0.3, // Placeholder - would need analysis
    },
  };
}

// Generate time-based suggestions
async function generateTimeSuggestions(
  userId: string,
  patterns: PatternAnalysis
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  const currentHour = new Date().getHours();
  const currentDay = new Date().getDay();

  // Check if this is typically an active hour
  const hourActivity = patterns.activeHours.find((h) => h.hour === currentHour);
  const isActiveHour = hourActivity && hourActivity.activity > 5;

  // Morning routine suggestions (7-9 AM)
  if (currentHour >= 7 && currentHour <= 9) {
    suggestions.push({
      id: `time-morning-${Date.now()}`,
      type: "time_based",
      title: "Good morning! Ready for your daily briefing?",
      description:
        "I can summarize your scheduled tasks, upcoming events, and recent updates.",
      confidence: 80,
      relevance: isActiveHour ? 90 : 70,
      action: {
        type: "message",
        payload: { prompt: "Give me my daily briefing" },
        label: "Get Briefing",
      },
      context: {
        timeContext: "morning_routine",
      },
      createdAt: new Date(),
    });
  }

  // End of day review (5-7 PM on weekdays)
  if (currentHour >= 17 && currentHour <= 19 && currentDay >= 1 && currentDay <= 5) {
    suggestions.push({
      id: `time-evening-${Date.now()}`,
      type: "time_based",
      title: "End of day review",
      description:
        "Would you like to review what you accomplished today and plan for tomorrow?",
      confidence: 75,
      relevance: isActiveHour ? 85 : 65,
      action: {
        type: "message",
        payload: { prompt: "Review my day and help me plan tomorrow" },
        label: "Review Day",
      },
      context: {
        timeContext: "end_of_day",
      },
      createdAt: new Date(),
    });
  }

  // Weekly review (Sunday or Monday morning)
  if ((currentDay === 0 || currentDay === 1) && currentHour >= 9 && currentHour <= 11) {
    suggestions.push({
      id: `time-weekly-${Date.now()}`,
      type: "time_based",
      title: "Weekly review time",
      description:
        "Start your week by reviewing last week's progress and setting new goals.",
      confidence: 70,
      relevance: 75,
      action: {
        type: "message",
        payload: { prompt: "Give me a weekly review and help me plan this week" },
        label: "Weekly Review",
      },
      context: {
        timeContext: "weekly_review",
      },
      createdAt: new Date(),
    });
  }

  return suggestions;
}

// Generate pattern-based suggestions
async function generatePatternSuggestions(
  userId: string,
  patterns: PatternAnalysis
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Suggest frequently used tools
  const topTool = patterns.preferredTools[0];
  if (topTool && topTool.frequency > 10) {
    suggestions.push({
      id: `pattern-tool-${Date.now()}`,
      type: "tool_suggestion",
      title: `Quick access: ${formatToolName(topTool.tool)}`,
      description: `You frequently use ${formatToolName(topTool.tool)}. Would you like to use it now?`,
      confidence: Math.min(90, 50 + topTool.frequency),
      relevance: 70,
      action: {
        type: "tool",
        payload: { tool: topTool.tool },
        label: `Use ${formatToolName(topTool.tool)}`,
      },
      context: {
        triggerPattern: "frequent_tool_usage",
      },
      createdAt: new Date(),
    });
  }

  // Suggest returning to recent topics
  const recentTopic = patterns.frequentTopics.find((t) => {
    const daysSinceLastMention =
      (Date.now() - t.lastMentioned.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastMention >= 3 && daysSinceLastMention <= 14;
  });

  if (recentTopic) {
    suggestions.push({
      id: `pattern-topic-${Date.now()}`,
      type: "related_topic",
      title: `Continue exploring: ${recentTopic.topic}`,
      description: `You were interested in ${recentTopic.topic} recently. Would you like to continue?`,
      confidence: 60,
      relevance: 65,
      action: {
        type: "message",
        payload: { prompt: `Tell me more about ${recentTopic.topic}` },
        label: "Continue Topic",
      },
      context: {
        triggerPattern: "topic_continuation",
      },
      createdAt: new Date(),
    });
  }

  // Workflow optimization suggestion based on tool patterns
  if (patterns.preferredTools.length >= 3) {
    const toolsWithLowSuccess = patterns.preferredTools.filter(
      (t) => t.successRate < 80 && t.frequency > 5
    );

    if (toolsWithLowSuccess.length > 0) {
      suggestions.push({
        id: `pattern-optimize-${Date.now()}`,
        type: "workflow_optimization",
        title: "Improve your workflow",
        description: `I noticed some tools have lower success rates. Would you like tips to improve?`,
        confidence: 55,
        relevance: 60,
        action: {
          type: "message",
          payload: {
            prompt: `Help me improve my workflow with ${toolsWithLowSuccess.map((t) => t.tool).join(", ")}`,
          },
          label: "Get Tips",
        },
        context: {
          triggerPattern: "workflow_optimization",
        },
        createdAt: new Date(),
      });
    }
  }

  return suggestions;
}

// Generate context-based suggestions using AI
async function generateContextSuggestions(
  userId: string,
  currentContext: string,
  patterns: PatternAnalysis
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  try {
    // Get relevant memories for context
    const relevantMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userId))
      .limit(10);

    const memoryContext = relevantMemories
      .map((m) => m.content)
      .join("\n");

    const prompt = `Given the user's current context and their patterns, suggest 2-3 proactive suggestions.

Current context: "${currentContext}"

User's frequent topics: ${patterns.frequentTopics.map((t) => t.topic).join(", ")}
User's preferred tools: ${patterns.preferredTools.map((t) => t.tool).join(", ")}

Relevant memories about the user:
${memoryContext}

Respond with a JSON array of suggestions:
[
  {
    "title": "brief title",
    "description": "why this is relevant",
    "type": "related_topic|proactive_info|task_reminder|follow_up",
    "confidence": 0-100,
    "relevance": 0-100,
    "action_prompt": "suggested message to send"
  }
]

Only return the JSON array, nothing else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const aiSuggestions = result.suggestions || result || [];

    for (const s of aiSuggestions) {
      if (s.title && s.description) {
        suggestions.push({
          id: `context-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: s.type || "proactive_info",
          title: s.title,
          description: s.description,
          confidence: s.confidence || 60,
          relevance: s.relevance || 70,
          action: s.action_prompt
            ? {
                type: "message",
                payload: { prompt: s.action_prompt },
                label: "Explore",
              }
            : undefined,
          context: {
            triggerPattern: "context_analysis",
          },
          createdAt: new Date(),
        });
      }
    }
  } catch (error) {
    console.error("Error generating context suggestions:", error);
  }

  return suggestions;
}

// Generate follow-up suggestions from recent conversations
async function generateFollowUpSuggestions(userId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  try {
    // Get recent conversations
    const recentConversations = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          gte(conversations.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      )
      .orderBy(desc(conversations.createdAt))
      .limit(5);

    for (const conv of recentConversations) {
      // Get last messages from conversation
      const lastMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(desc(messages.createdAt))
        .limit(3);

      if (lastMessages.length > 0) {
        const lastUserMessage = lastMessages.find((m) => m.role === "user");
        const lastAssistantMessage = lastMessages.find((m) => m.role === "assistant");

        // Check if conversation might benefit from follow-up
        if (lastUserMessage && lastAssistantMessage) {
          const hoursSinceLastMessage =
            (Date.now() - lastMessages[0].createdAt.getTime()) / (1000 * 60 * 60);

          // Suggest follow-up for conversations that are 1-7 days old
          if (hoursSinceLastMessage >= 24 && hoursSinceLastMessage <= 168) {
            const topic = conv.title || extractTopic(lastUserMessage.content);

            suggestions.push({
              id: `followup-${conv.id}`,
              type: "follow_up",
              title: `Follow up: ${topic}`,
              description: `Continue your conversation about ${topic}?`,
              confidence: Math.max(30, 80 - hoursSinceLastMessage / 2),
              relevance: 65,
              action: {
                type: "message",
                payload: {
                  prompt: `Let's continue our discussion about ${topic}`,
                  conversationId: conv.id,
                },
                label: "Continue",
              },
              context: {
                sourceConversation: conv.id,
              },
              createdAt: new Date(),
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error generating follow-up suggestions:", error);
  }

  return suggestions.slice(0, 3); // Limit follow-ups
}

// Check for scheduled task reminders
export async function getTaskReminders(userId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  try {
    const upcomingTasks = await db
      .select()
      .from(scheduledTasks)
      .where(
        and(
          eq(scheduledTasks.userId, userId),
          eq(scheduledTasks.enabled, true),
          gte(scheduledTasks.nextRunAt, new Date()),
          gte(
            scheduledTasks.nextRunAt,
            new Date(Date.now() + 24 * 60 * 60 * 1000)
          ) // Within 24 hours
        )
      )
      .limit(5);

    for (const task of upcomingTasks) {
      const hoursUntil = task.nextRunAt
        ? (task.nextRunAt.getTime() - Date.now()) / (1000 * 60 * 60)
        : 0;

      suggestions.push({
        id: `task-${task.id}`,
        type: "task_reminder",
        title: `Upcoming: ${task.name}`,
        description: task.description || `Scheduled in ${Math.round(hoursUntil)} hours`,
        confidence: 95,
        relevance: Math.min(100, 50 + (24 - hoursUntil) * 2),
        action: {
          type: "message",
          payload: { prompt: `Tell me about my scheduled task: ${task.name}` },
          label: "View Task",
        },
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error("Error getting task reminders:", error);
  }

  return suggestions;
}

// Helper function to format tool names
function formatToolName(toolName: string): string {
  return toolName
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// Helper function to extract topic from message
function extractTopic(message: string): string {
  // Simple extraction - first 50 chars or first sentence
  const firstSentence = message.split(/[.!?]/)[0];
  if (firstSentence.length <= 50) return firstSentence;
  return message.slice(0, 47) + "...";
}

// Export utility functions
export {
  analyzeUserPatterns,
  generateTimeSuggestions,
  generatePatternSuggestions,
  generateContextSuggestions,
  generateFollowUpSuggestions,
};

export default {
  generateSuggestions,
  getTaskReminders,
  analyzeUserPatterns,
};
