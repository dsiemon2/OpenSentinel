/**
 * Temporal Reasoning System
 *
 * Provides sophisticated understanding of time context in conversations:
 * - Relative time expressions ("next week", "last Tuesday")
 * - Date/time extraction and normalization
 * - Time zone handling
 * - Temporal relationship analysis
 * - Schedule conflict detection
 * - Time-based context enhancement
 */

import { db } from "../../db";
import {
  conversations,
  messages,
  scheduledTasks,
  users,
} from "../../db/schema";
import { eq, and, gte, lte, desc, sql, between } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../../config/env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Types for temporal reasoning
export interface TemporalExpression {
  original: string;
  type: TemporalExpressionType;
  resolved: Date | DateRange | null;
  confidence: number;
  timezone?: string;
  isRelative: boolean;
  referencePoint?: Date;
}

export type TemporalExpressionType =
  | "absolute_date"
  | "absolute_time"
  | "absolute_datetime"
  | "relative_date"
  | "relative_time"
  | "duration"
  | "recurring"
  | "fuzzy"
  | "range";

export interface DateRange {
  start: Date;
  end: Date;
  granularity: "minute" | "hour" | "day" | "week" | "month" | "year";
}

export interface TemporalContext {
  currentTime: Date;
  userTimezone: string;
  conversationStart?: Date;
  lastInteraction?: Date;
  recentTemporalReferences: TemporalExpression[];
}

export interface TimelineEvent {
  id: string;
  title: string;
  datetime: Date;
  endDatetime?: Date;
  isAllDay: boolean;
  source: "scheduled_task" | "conversation" | "calendar" | "extracted";
  sourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface ScheduleAnalysis {
  events: TimelineEvent[];
  conflicts: Array<{
    event1: TimelineEvent;
    event2: TimelineEvent;
    overlapMinutes: number;
  }>;
  freeSlots: DateRange[];
  busyPeriods: DateRange[];
  recommendations: string[];
}

// Common relative time patterns
const RELATIVE_PATTERNS: Array<{
  pattern: RegExp;
  resolver: (match: RegExpMatchArray, now: Date) => Date | DateRange;
}> = [
  // "today", "tomorrow", "yesterday"
  {
    pattern: /\b(today)\b/i,
    resolver: (_, now) => startOfDay(now),
  },
  {
    pattern: /\b(tomorrow)\b/i,
    resolver: (_, now) => addDays(startOfDay(now), 1),
  },
  {
    pattern: /\b(yesterday)\b/i,
    resolver: (_, now) => addDays(startOfDay(now), -1),
  },

  // "next/last [day]"
  {
    pattern: /\b(next|this coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    resolver: (match, now) => {
      const dayIndex = getDayIndex(match[2]);
      return getNextDayOfWeek(now, dayIndex);
    },
  },
  {
    pattern: /\b(last|this past)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    resolver: (match, now) => {
      const dayIndex = getDayIndex(match[2]);
      return getPreviousDayOfWeek(now, dayIndex);
    },
  },

  // "in X days/weeks/months"
  {
    pattern: /\bin\s+(\d+)\s+(day|days)\b/i,
    resolver: (match, now) => addDays(now, parseInt(match[1])),
  },
  {
    pattern: /\bin\s+(\d+)\s+(week|weeks)\b/i,
    resolver: (match, now) => addDays(now, parseInt(match[1]) * 7),
  },
  {
    pattern: /\bin\s+(\d+)\s+(month|months)\b/i,
    resolver: (match, now) => addMonths(now, parseInt(match[1])),
  },
  {
    pattern: /\bin\s+(\d+)\s+(hour|hours)\b/i,
    resolver: (match, now) => addHours(now, parseInt(match[1])),
  },
  {
    pattern: /\bin\s+(\d+)\s+(minute|minutes)\b/i,
    resolver: (match, now) => addMinutes(now, parseInt(match[1])),
  },

  // "X days/weeks ago"
  {
    pattern: /\b(\d+)\s+(day|days)\s+ago\b/i,
    resolver: (match, now) => addDays(now, -parseInt(match[1])),
  },
  {
    pattern: /\b(\d+)\s+(week|weeks)\s+ago\b/i,
    resolver: (match, now) => addDays(now, -parseInt(match[1]) * 7),
  },
  {
    pattern: /\b(\d+)\s+(month|months)\s+ago\b/i,
    resolver: (match, now) => addMonths(now, -parseInt(match[1])),
  },

  // "next week", "this week", "last week"
  {
    pattern: /\b(next week)\b/i,
    resolver: (_, now) => ({
      start: getNextWeekStart(now),
      end: addDays(getNextWeekStart(now), 6),
      granularity: "week" as const,
    }),
  },
  {
    pattern: /\b(this week)\b/i,
    resolver: (_, now) => ({
      start: getWeekStart(now),
      end: addDays(getWeekStart(now), 6),
      granularity: "week" as const,
    }),
  },
  {
    pattern: /\b(last week)\b/i,
    resolver: (_, now) => ({
      start: addDays(getWeekStart(now), -7),
      end: addDays(getWeekStart(now), -1),
      granularity: "week" as const,
    }),
  },

  // "end of [month/week]"
  {
    pattern: /\b(end of|eod|eow|eom)\s*(the\s+)?(day|week|month)?\b/i,
    resolver: (match, now) => {
      const unit = match[3]?.toLowerCase() || "day";
      if (unit === "day") return endOfDay(now);
      if (unit === "week") return endOfWeek(now);
      return endOfMonth(now);
    },
  },

  // Time expressions
  {
    pattern: /\b(this morning)\b/i,
    resolver: (_, now) => setHours(startOfDay(now), 9, 0),
  },
  {
    pattern: /\b(this afternoon)\b/i,
    resolver: (_, now) => setHours(startOfDay(now), 14, 0),
  },
  {
    pattern: /\b(this evening)\b/i,
    resolver: (_, now) => setHours(startOfDay(now), 18, 0),
  },
  {
    pattern: /\b(tonight)\b/i,
    resolver: (_, now) => setHours(startOfDay(now), 20, 0),
  },
];

/**
 * Extract temporal expressions from text
 */
export async function extractTemporalExpressions(
  text: string,
  context?: TemporalContext
): Promise<TemporalExpression[]> {
  const expressions: TemporalExpression[] = [];
  const now = context?.currentTime || new Date();

  // First, try pattern matching for common expressions
  for (const { pattern, resolver } of RELATIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const resolved = resolver(match, now);
      expressions.push({
        original: match[0],
        type: isDateRange(resolved) ? "range" : "relative_date",
        resolved,
        confidence: 95,
        isRelative: true,
        referencePoint: now,
      });
    }
  }

  // Try to extract absolute dates (ISO format, common formats)
  const datePatterns = [
    // ISO date: 2024-01-15
    {
      pattern: /\b(\d{4}-\d{2}-\d{2})\b/g,
      type: "absolute_date" as const,
    },
    // US format: 01/15/2024, 1/15/24
    {
      pattern: /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/g,
      type: "absolute_date" as const,
    },
    // Written: January 15, 2024 or Jan 15 2024
    {
      pattern:
        /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4}?)\b/gi,
      type: "absolute_date" as const,
    },
    // Time: 3:30 PM, 15:30
    {
      pattern: /\b(\d{1,2}:\d{2}(?:\s*(?:am|pm))?)\b/gi,
      type: "absolute_time" as const,
    },
    // "at [time]"
    {
      pattern: /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/gi,
      type: "absolute_time" as const,
    },
  ];

  for (const { pattern, type } of datePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const resolved = parseAbsoluteDate(match[1], now);
      if (resolved) {
        expressions.push({
          original: match[0],
          type,
          resolved,
          confidence: 90,
          isRelative: false,
        });
      }
    }
  }

  // Use AI for complex or ambiguous expressions
  if (text.length > 20) {
    const aiExpressions = await extractWithAI(text, now, context);
    // Add AI-extracted expressions that don't overlap with pattern-matched ones
    for (const aiExpr of aiExpressions) {
      const hasOverlap = expressions.some(
        (e) =>
          e.original.toLowerCase().includes(aiExpr.original.toLowerCase()) ||
          aiExpr.original.toLowerCase().includes(e.original.toLowerCase())
      );
      if (!hasOverlap) {
        expressions.push(aiExpr);
      }
    }
  }

  return expressions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Use AI to extract complex temporal expressions
 */
async function extractWithAI(
  text: string,
  now: Date,
  context?: TemporalContext
): Promise<TemporalExpression[]> {
  try {
    const prompt = `Extract all time and date references from this text.

Text: "${text}"
Current time: ${now.toISOString()}
${context?.userTimezone ? `User timezone: ${context.userTimezone}` : ""}

Return JSON array:
[
  {
    "original": "the exact phrase from text",
    "type": "absolute_date|absolute_time|absolute_datetime|relative_date|relative_time|duration|recurring|fuzzy|range",
    "resolved_iso": "ISO datetime string or null",
    "resolved_end_iso": "end ISO datetime for ranges or null",
    "confidence": 0-100,
    "is_relative": true/false,
    "notes": "any clarification needed"
  }
]

Only return the JSON array. If no temporal expressions found, return [].`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const extracted = result.expressions || result || [];

    return extracted
      .filter((e: any) => e.original && e.resolved_iso)
      .map((e: any) => ({
        original: e.original,
        type: e.type || "fuzzy",
        resolved: e.resolved_end_iso
          ? {
              start: new Date(e.resolved_iso),
              end: new Date(e.resolved_end_iso),
              granularity: "day" as const,
            }
          : new Date(e.resolved_iso),
        confidence: e.confidence || 70,
        isRelative: e.is_relative || false,
        referencePoint: now,
      }));
  } catch (error) {
    console.error("Error extracting temporal expressions with AI:", error);
    return [];
  }
}

/**
 * Normalize a date/time to user's timezone
 */
export function normalizeToTimezone(
  date: Date,
  timezone: string
): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || "0";

    return new Date(
      `${getPart("year")}-${getPart("month")}-${getPart("day")}T${getPart("hour")}:${getPart("minute")}:${getPart("second")}`
    );
  } catch {
    return date;
  }
}

/**
 * Get user's timezone from preferences
 */
export async function getUserTimezone(userId: string): Promise<string> {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return (user?.preferences as any)?.timezone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Build temporal context for a conversation
 */
export async function buildTemporalContext(
  userId: string,
  conversationId?: string
): Promise<TemporalContext> {
  const timezone = await getUserTimezone(userId);
  const now = new Date();

  let conversationStart: Date | undefined;
  let lastInteraction: Date | undefined;
  const recentTemporalReferences: TemporalExpression[] = [];

  if (conversationId) {
    // Get conversation start
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conv) {
      conversationStart = conv.createdAt;

      // Get last message time
      const [lastMsg] = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (lastMsg) {
        lastInteraction = lastMsg.createdAt;
      }

      // Extract temporal references from recent messages
      const recentMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(10);

      for (const msg of recentMessages) {
        const expressions = await extractTemporalExpressions(msg.content, {
          currentTime: msg.createdAt,
          userTimezone: timezone,
          recentTemporalReferences: [],
        });
        recentTemporalReferences.push(...expressions);
      }
    }
  }

  return {
    currentTime: now,
    userTimezone: timezone,
    conversationStart,
    lastInteraction,
    recentTemporalReferences: recentTemporalReferences.slice(0, 10),
  };
}

/**
 * Analyze a user's schedule for conflicts and free time
 */
export async function analyzeSchedule(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ScheduleAnalysis> {
  const events: TimelineEvent[] = [];
  const conflicts: ScheduleAnalysis["conflicts"] = [];
  const freeSlots: DateRange[] = [];
  const busyPeriods: DateRange[] = [];
  const recommendations: string[] = [];

  // Get scheduled tasks
  const tasks = await db
    .select()
    .from(scheduledTasks)
    .where(
      and(
        eq(scheduledTasks.userId, userId),
        eq(scheduledTasks.enabled, true),
        gte(scheduledTasks.nextRunAt, startDate),
        lte(scheduledTasks.nextRunAt, endDate)
      )
    );

  for (const task of tasks) {
    if (task.nextRunAt) {
      events.push({
        id: task.id,
        title: task.name,
        datetime: task.nextRunAt,
        isAllDay: false,
        source: "scheduled_task",
        sourceId: task.id,
      });
    }
  }

  // Sort events by datetime
  events.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

  // Detect conflicts (events within 30 minutes of each other)
  for (let i = 0; i < events.length - 1; i++) {
    for (let j = i + 1; j < events.length; j++) {
      const event1End = events[i].endDatetime || addMinutes(events[i].datetime, 60);
      const event2Start = events[j].datetime;

      if (event1End > event2Start) {
        const overlapMinutes = Math.round(
          (event1End.getTime() - event2Start.getTime()) / (1000 * 60)
        );
        conflicts.push({
          event1: events[i],
          event2: events[j],
          overlapMinutes,
        });
      }
    }
  }

  // Calculate free slots (gaps > 1 hour between events)
  let currentTime = startDate;
  for (const event of events) {
    const gapMinutes = (event.datetime.getTime() - currentTime.getTime()) / (1000 * 60);
    if (gapMinutes >= 60) {
      freeSlots.push({
        start: new Date(currentTime),
        end: event.datetime,
        granularity: "hour",
      });
    }
    currentTime = event.endDatetime || addMinutes(event.datetime, 60);
  }

  // Add final free slot if there's time left in the period
  if (currentTime < endDate) {
    freeSlots.push({
      start: currentTime,
      end: endDate,
      granularity: "hour",
    });
  }

  // Calculate busy periods (consecutive events)
  let busyStart: Date | null = null;
  let busyEnd: Date | null = null;

  for (const event of events) {
    const eventEnd = event.endDatetime || addMinutes(event.datetime, 60);

    if (!busyStart || !busyEnd) {
      busyStart = event.datetime;
      busyEnd = eventEnd;
    } else if (event.datetime.getTime() - busyEnd.getTime() <= 30 * 60 * 1000) {
      // Events within 30 minutes are considered continuous busy period
      busyEnd = eventEnd.getTime() > busyEnd.getTime() ? eventEnd : busyEnd;
    } else {
      busyPeriods.push({
        start: busyStart,
        end: busyEnd!,
        granularity: "hour",
      });
      busyStart = event.datetime;
      busyEnd = eventEnd;
    }
  }

  if (busyStart && busyEnd) {
    busyPeriods.push({
      start: busyStart,
      end: busyEnd,
      granularity: "hour",
    });
  }

  // Generate recommendations
  if (conflicts.length > 0) {
    recommendations.push(
      `You have ${conflicts.length} scheduling conflict(s) that need attention.`
    );
  }

  if (freeSlots.length === 0) {
    recommendations.push(
      "Your schedule is very full. Consider blocking time for breaks."
    );
  } else {
    const totalFreeHours = freeSlots.reduce(
      (sum, slot) =>
        sum + (slot.end.getTime() - slot.start.getTime()) / (1000 * 60 * 60),
      0
    );
    recommendations.push(
      `You have approximately ${Math.round(totalFreeHours)} hours of free time in this period.`
    );
  }

  // Check for back-to-back meetings
  const backToBack = events.filter((e, i) => {
    if (i === 0) return false;
    const prevEnd =
      events[i - 1].endDatetime || addMinutes(events[i - 1].datetime, 60);
    return e.datetime.getTime() - prevEnd.getTime() < 15 * 60 * 1000;
  });

  if (backToBack.length > 2) {
    recommendations.push(
      "You have several back-to-back commitments. Consider adding buffer time."
    );
  }

  return {
    events,
    conflicts,
    freeSlots,
    busyPeriods,
    recommendations,
  };
}

/**
 * Generate a human-readable time description
 */
export function formatRelativeTime(date: Date, reference?: Date): string {
  const now = reference || new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const isFuture = diffMs > 0;
  const absDays = Math.abs(diffDays);
  const absHours = Math.abs(diffHours);
  const absMins = Math.abs(diffMins);

  if (absMins < 1) return "just now";
  if (absMins < 60) {
    return isFuture ? `in ${absMins} minutes` : `${absMins} minutes ago`;
  }
  if (absHours < 24) {
    return isFuture ? `in ${absHours} hours` : `${absHours} hours ago`;
  }
  if (absDays === 1) {
    return isFuture ? "tomorrow" : "yesterday";
  }
  if (absDays < 7) {
    return isFuture ? `in ${absDays} days` : `${absDays} days ago`;
  }
  if (absDays < 14) {
    return isFuture ? "next week" : "last week";
  }
  if (absDays < 30) {
    const weeks = Math.round(absDays / 7);
    return isFuture ? `in ${weeks} weeks` : `${weeks} weeks ago`;
  }

  const months = Math.round(absDays / 30);
  return isFuture ? `in ${months} months` : `${months} months ago`;
}

/**
 * Build temporal context string for AI prompts
 */
export async function buildTemporalContextString(
  userId: string,
  query: string
): Promise<string> {
  const context = await buildTemporalContext(userId);
  const expressions = await extractTemporalExpressions(query, context);

  if (expressions.length === 0) {
    return "";
  }

  let contextStr = "\n\nTemporal context:";
  contextStr += `\n- Current time: ${context.currentTime.toISOString()} (${context.userTimezone})`;

  if (expressions.length > 0) {
    contextStr += "\n\nTime references in your message:";
    for (const expr of expressions) {
      if (expr.resolved) {
        const resolvedStr = isDateRange(expr.resolved)
          ? `${expr.resolved.start.toISOString()} to ${expr.resolved.end.toISOString()}`
          : expr.resolved.toISOString();
        contextStr += `\n- "${expr.original}" -> ${resolvedStr}`;
      }
    }
  }

  // Get upcoming events
  const upcomingEnd = addDays(context.currentTime, 7);
  const schedule = await analyzeSchedule(userId, context.currentTime, upcomingEnd);

  if (schedule.events.length > 0) {
    contextStr += "\n\nUpcoming scheduled events:";
    for (const event of schedule.events.slice(0, 5)) {
      contextStr += `\n- ${event.title}: ${formatRelativeTime(event.datetime, context.currentTime)}`;
    }
  }

  if (schedule.conflicts.length > 0) {
    contextStr += `\n\nNote: ${schedule.conflicts.length} scheduling conflict(s) detected.`;
  }

  return contextStr;
}

// Date utility functions

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function endOfWeek(date: Date): Date {
  const dayOfWeek = date.getDay();
  const daysUntilSunday = 7 - dayOfWeek;
  return endOfDay(addDays(date, daysUntilSunday));
}

function endOfMonth(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return endOfDay(result);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setTime(result.getTime() + minutes * 60 * 1000);
  return result;
}

function setHours(date: Date, hours: number, minutes: number): Date {
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function getWeekStart(date: Date): Date {
  const dayOfWeek = date.getDay();
  return startOfDay(addDays(date, -dayOfWeek));
}

function getNextWeekStart(date: Date): Date {
  const weekStart = getWeekStart(date);
  return addDays(weekStart, 7);
}

function getDayIndex(dayName: string): number {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return days[dayName.toLowerCase()] ?? 0;
}

function getNextDayOfWeek(date: Date, dayIndex: number): Date {
  const currentDay = date.getDay();
  let daysToAdd = dayIndex - currentDay;
  if (daysToAdd <= 0) daysToAdd += 7;
  return startOfDay(addDays(date, daysToAdd));
}

function getPreviousDayOfWeek(date: Date, dayIndex: number): Date {
  const currentDay = date.getDay();
  let daysToSubtract = currentDay - dayIndex;
  if (daysToSubtract <= 0) daysToSubtract += 7;
  return startOfDay(addDays(date, -daysToSubtract));
}

function parseAbsoluteDate(str: string, reference: Date): Date | null {
  try {
    // Try ISO format first
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      return new Date(str);
    }

    // Try US format (MM/DD/YYYY)
    const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (usMatch) {
      let year = parseInt(usMatch[3]);
      if (year < 100) year += 2000;
      return new Date(year, parseInt(usMatch[1]) - 1, parseInt(usMatch[2]));
    }

    // Try time format
    const timeMatch = str.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || "0");
      const meridiem = timeMatch[3]?.toLowerCase();

      if (meridiem === "pm" && hours !== 12) hours += 12;
      if (meridiem === "am" && hours === 12) hours = 0;

      const result = new Date(reference);
      result.setHours(hours, minutes, 0, 0);
      return result;
    }

    // Try parsing with Date constructor as fallback
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}

function isDateRange(value: Date | DateRange): value is DateRange {
  return (value as DateRange).start !== undefined;
}

export default {
  extractTemporalExpressions,
  normalizeToTimezone,
  getUserTimezone,
  buildTemporalContext,
  analyzeSchedule,
  formatRelativeTime,
  buildTemporalContextString,
};
