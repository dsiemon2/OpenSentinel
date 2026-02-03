// iCal/ICS parser for calendar events

export interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  recurrence?: string;
  organizer?: string;
  attendees?: string[];
}

export interface ParsedCalendar {
  name?: string;
  events: CalendarEvent[];
}

// Parse iCal date string
function parseICalDate(dateStr: string): Date {
  // Handle formats like: 20240115T090000Z or 20240115
  const cleaned = dateStr.replace(/[:-]/g, "");

  if (cleaned.length === 8) {
    // Date only (all-day event)
    const year = parseInt(cleaned.slice(0, 4));
    const month = parseInt(cleaned.slice(4, 6)) - 1;
    const day = parseInt(cleaned.slice(6, 8));
    return new Date(year, month, day);
  }

  if (cleaned.length >= 15) {
    // Date with time
    const year = parseInt(cleaned.slice(0, 4));
    const month = parseInt(cleaned.slice(4, 6)) - 1;
    const day = parseInt(cleaned.slice(6, 8));
    const hour = parseInt(cleaned.slice(9, 11));
    const minute = parseInt(cleaned.slice(11, 13));
    const second = parseInt(cleaned.slice(13, 15));

    if (cleaned.endsWith("Z")) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }

    return new Date(year, month, day, hour, minute, second);
  }

  return new Date(dateStr);
}

// Parse iCal/ICS content
export function parseICalContent(icalContent: string): ParsedCalendar {
  const lines = icalContent
    .replace(/\r\n /g, "") // Unfold lines
    .replace(/\r\n\t/g, "")
    .split(/\r?\n/);

  const events: CalendarEvent[] = [];
  let calendarName: string | undefined;
  let currentEvent: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    const [key, ...valueParts] = line.split(":");
    const value = valueParts.join(":");

    if (key === "X-WR-CALNAME") {
      calendarName = value;
    }

    if (key === "BEGIN" && value === "VEVENT") {
      currentEvent = {};
    }

    if (currentEvent) {
      if (key === "UID") {
        currentEvent.uid = value;
      } else if (key === "SUMMARY") {
        currentEvent.summary = value;
      } else if (key === "DESCRIPTION") {
        currentEvent.description = value.replace(/\\n/g, "\n");
      } else if (key === "LOCATION") {
        currentEvent.location = value;
      } else if (key.startsWith("DTSTART")) {
        currentEvent.startDate = parseICalDate(value);
        // All-day events use VALUE=DATE or have a date-only value (8 chars, no 'T')
        currentEvent.isAllDay = key.includes("VALUE=DATE") || (value.length === 8 && !value.includes("T"));
      } else if (key.startsWith("DTEND")) {
        currentEvent.endDate = parseICalDate(value);
      } else if (key === "RRULE") {
        currentEvent.recurrence = value;
      } else if (key === "ORGANIZER") {
        currentEvent.organizer = value.replace("mailto:", "");
      } else if (key === "ATTENDEE") {
        if (!currentEvent.attendees) {
          currentEvent.attendees = [];
        }
        currentEvent.attendees.push(value.replace("mailto:", ""));
      }

      if (key === "END" && value === "VEVENT") {
        if (currentEvent.uid && currentEvent.summary && currentEvent.startDate) {
          events.push({
            uid: currentEvent.uid,
            summary: currentEvent.summary,
            description: currentEvent.description,
            location: currentEvent.location,
            startDate: currentEvent.startDate,
            endDate: currentEvent.endDate || currentEvent.startDate,
            isAllDay: currentEvent.isAllDay || false,
            recurrence: currentEvent.recurrence,
            organizer: currentEvent.organizer,
            attendees: currentEvent.attendees,
          });
        }
        currentEvent = null;
      }
    }
  }

  return {
    name: calendarName,
    events: events.sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime()
    ),
  };
}

// Fetch and parse iCal from URL
export async function fetchICalFromUrl(url: string): Promise<ParsedCalendar> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch iCal: ${response.status}`);
  }

  const content = await response.text();
  return parseICalContent(content);
}

// Get events within a time range
export function getEventsInRange(
  events: CalendarEvent[],
  start: Date,
  end: Date
): CalendarEvent[] {
  return events.filter(
    (event) =>
      event.startDate >= start &&
      event.startDate <= end
  );
}

// Get upcoming events
export function getUpcomingEvents(
  events: CalendarEvent[],
  count: number = 10
): CalendarEvent[] {
  const now = new Date();
  return events
    .filter((event) => event.startDate >= now)
    .slice(0, count);
}

// Get today's events
export function getTodaysEvents(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getEventsInRange(events, today, tomorrow);
}

// Format event for display
export function formatEvent(event: CalendarEvent): string {
  const timeStr = event.isAllDay
    ? "All day"
    : event.startDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

  let str = `${timeStr}: ${event.summary}`;

  if (event.location) {
    str += ` @ ${event.location}`;
  }

  return str;
}

export default {
  parseICalContent,
  fetchICalFromUrl,
  getEventsInRange,
  getUpcomingEvents,
  getTodaysEvents,
  formatEvent,
};
