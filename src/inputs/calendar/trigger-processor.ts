import { db } from "../../db";
import { calendarTriggers, users } from "../../db/schema";
import { eq, and, lte, gte, isNull } from "drizzle-orm";
import { scheduleTask } from "../../core/scheduler";
import {
  fetchICalFromUrl,
  CalendarEvent,
  getUpcomingEvents,
  getTodaysEvents,
} from "./ical-parser";

export type TriggerType = "event_start" | "event_end" | "daily_briefing";
export type CalendarSource = "google" | "outlook" | "ical";

export interface CalendarTriggerConfig {
  id: string;
  userId: string;
  name: string;
  calendarSource: CalendarSource;
  calendarId?: string;
  triggerType: TriggerType;
  offsetMinutes: number;
  action: {
    type: "message" | "tool" | "webhook";
    payload: Record<string, unknown>;
  };
  enabled: boolean;
}

export interface TriggerResult {
  triggerId: string;
  event?: CalendarEvent;
  scheduledJobId?: string;
  error?: string;
}

// Create a calendar trigger
export async function createCalendarTrigger(
  config: Omit<CalendarTriggerConfig, "id">
): Promise<string> {
  const [trigger] = await db
    .insert(calendarTriggers)
    .values({
      userId: config.userId,
      name: config.name,
      calendarSource: config.calendarSource,
      calendarId: config.calendarId,
      triggerType: config.triggerType,
      offsetMinutes: config.offsetMinutes,
      action: config.action,
      enabled: config.enabled,
    })
    .returning();

  return trigger.id;
}

// Get user's calendar triggers
export async function getUserTriggers(
  userId: string
): Promise<CalendarTriggerConfig[]> {
  const triggers = await db
    .select()
    .from(calendarTriggers)
    .where(eq(calendarTriggers.userId, userId));

  return triggers.map((t) => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    calendarSource: t.calendarSource as CalendarSource,
    calendarId: t.calendarId || undefined,
    triggerType: t.triggerType as TriggerType,
    offsetMinutes: t.offsetMinutes || 0,
    action: t.action as CalendarTriggerConfig["action"],
    enabled: t.enabled ?? true,
  }));
}

// Enable/disable a trigger
export async function setTriggerEnabled(
  triggerId: string,
  enabled: boolean
): Promise<boolean> {
  const [updated] = await db
    .update(calendarTriggers)
    .set({ enabled })
    .where(eq(calendarTriggers.id, triggerId))
    .returning();

  return !!updated;
}

// Delete a trigger
export async function deleteTrigger(triggerId: string): Promise<boolean> {
  await db.delete(calendarTriggers).where(eq(calendarTriggers.id, triggerId));
  return true;
}

// Process triggers for upcoming events
export async function processCalendarTriggers(
  userId: string,
  events: CalendarEvent[],
  chatId?: string
): Promise<TriggerResult[]> {
  const triggers = await getUserTriggers(userId);
  const enabledTriggers = triggers.filter((t) => t.enabled);
  const results: TriggerResult[] = [];
  const now = Date.now();

  for (const trigger of enabledTriggers) {
    try {
      if (trigger.triggerType === "daily_briefing") {
        // Handle daily briefing separately
        continue;
      }

      for (const event of events) {
        const eventTime =
          trigger.triggerType === "event_start"
            ? event.startDate.getTime()
            : event.endDate.getTime();

        const triggerTime = eventTime - trigger.offsetMinutes * 60 * 1000;

        // Only schedule if trigger time is in the future
        if (triggerTime > now) {
          const delay = triggerTime - now;

          const jobId = await scheduleTask(
            {
              type: "custom",
              message: formatTriggerMessage(trigger, event),
              userId,
              chatId,
            },
            delay
          );

          results.push({
            triggerId: trigger.id,
            event,
            scheduledJobId: jobId,
          });

          // Update last triggered
          await db
            .update(calendarTriggers)
            .set({ lastTriggered: new Date() })
            .where(eq(calendarTriggers.id, trigger.id));
        }
      }
    } catch (error) {
      results.push({
        triggerId: trigger.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

function formatTriggerMessage(
  trigger: CalendarTriggerConfig,
  event: CalendarEvent
): string {
  const timeStr = event.startDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (trigger.triggerType === "event_start") {
    if (trigger.offsetMinutes > 0) {
      return `⏰ Reminder: "${event.summary}" starts in ${trigger.offsetMinutes} minutes at ${timeStr}`;
    }
    return `🔔 "${event.summary}" is starting now!`;
  }

  if (trigger.triggerType === "event_end") {
    return `✅ "${event.summary}" has ended`;
  }

  return `📅 Calendar event: ${event.summary}`;
}

// Generate daily briefing from calendar
export async function generateDailyBriefing(
  userId: string,
  events: CalendarEvent[]
): Promise<string> {
  const todayEvents = getTodaysEvents(events);
  const upcomingEvents = getUpcomingEvents(events, 5);

  let briefing = "📅 **Your Daily Calendar Briefing**\n\n";

  if (todayEvents.length === 0) {
    briefing += "No events scheduled for today.\n\n";
  } else {
    briefing += `**Today's Events (${todayEvents.length}):**\n`;
    for (const event of todayEvents) {
      const timeStr = event.isAllDay
        ? "All day"
        : event.startDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
      briefing += `• ${timeStr}: ${event.summary}`;
      if (event.location) {
        briefing += ` @ ${event.location}`;
      }
      briefing += "\n";
    }
    briefing += "\n";
  }

  const futureEvents = upcomingEvents.filter(
    (e) => !todayEvents.some((t) => t.uid === e.uid)
  );

  if (futureEvents.length > 0) {
    briefing += "**Upcoming:**\n";
    for (const event of futureEvents.slice(0, 3)) {
      const dateStr = event.startDate.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      briefing += `• ${dateStr}: ${event.summary}\n`;
    }
  }

  return briefing;
}

// Sync calendar and process triggers
export async function syncCalendarAndTriggers(
  userId: string,
  icalUrl: string,
  chatId?: string
): Promise<{
  eventsFound: number;
  triggersScheduled: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let eventsFound = 0;
  let triggersScheduled = 0;

  try {
    const calendar = await fetchICalFromUrl(icalUrl);
    eventsFound = calendar.events.length;

    // Get events for next 24 hours
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const upcomingEvents = calendar.events.filter(
      (e) => e.startDate >= now && e.startDate <= tomorrow
    );

    const results = await processCalendarTriggers(userId, upcomingEvents, chatId);
    triggersScheduled = results.filter((r) => r.scheduledJobId).length;
    errors.push(...results.filter((r) => r.error).map((r) => r.error!));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  return { eventsFound, triggersScheduled, errors };
}

export default {
  createCalendarTrigger,
  getUserTriggers,
  setTriggerEnabled,
  deleteTrigger,
  processCalendarTriggers,
  generateDailyBriefing,
  syncCalendarAndTriggers,
};
