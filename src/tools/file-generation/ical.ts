import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { isPathAllowed } from "../../utils/paths";

export interface ICalEvent {
  title: string;
  start: string; // ISO 8601 datetime
  end?: string; // ISO 8601 datetime
  allDay?: boolean;
  description?: string;
  location?: string;
  url?: string;
  organizer?: { name: string; email: string };
  attendees?: Array<{ name?: string; email: string; rsvp?: boolean }>;
  recurrence?: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    count?: number;
    until?: string; // ISO 8601 date
    byDay?: string[]; // ["MO", "WE", "FR"]
  };
  alarm?: {
    trigger: number; // minutes before event (negative = before)
    description?: string;
  };
  status?: "confirmed" | "tentative" | "cancelled";
  categories?: string[];
  priority?: number; // 0-9 (0 = undefined, 1 = high, 9 = low)
}

export interface ICalOptions {
  calendarName?: string;
  timezone?: string;
  productId?: string;
}

export interface ICalResult {
  success: boolean;
  filePath?: string;
  icsContent?: string;
  eventCount?: number;
  error?: string;
}

function getTempPath(): string {
  const id = randomBytes(8).toString("hex");
  return join(tmpdir(), `sentinel-calendar-${id}.ics`);
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatICalDate(isoDate: string, allDay?: boolean): string {
  const date = new Date(isoDate);
  if (allDay) {
    return date.toISOString().replace(/[-:]/g, "").split("T")[0];
  }
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function generateUID(): string {
  return `${randomBytes(16).toString("hex")}@opensentinel`;
}

function foldLine(line: string): string {
  const maxLen = 75;
  if (line.length <= maxLen) return line;
  const parts: string[] = [];
  parts.push(line.slice(0, maxLen));
  let pos = maxLen;
  while (pos < line.length) {
    parts.push(" " + line.slice(pos, pos + maxLen - 1));
    pos += maxLen - 1;
  }
  return parts.join("\r\n");
}

function eventToVEvent(event: ICalEvent): string {
  const lines: string[] = [];
  lines.push("BEGIN:VEVENT");
  lines.push(`UID:${generateUID()}`);
  lines.push(`DTSTAMP:${formatICalDate(new Date().toISOString())}`);

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDate(event.start, true)}`);
    if (event.end) {
      lines.push(`DTEND;VALUE=DATE:${formatICalDate(event.end, true)}`);
    }
  } else {
    lines.push(`DTSTART:${formatICalDate(event.start)}`);
    if (event.end) {
      lines.push(`DTEND:${formatICalDate(event.end)}`);
    } else {
      // Default to 1 hour duration
      const endDate = new Date(new Date(event.start).getTime() + 3600000);
      lines.push(`DTEND:${formatICalDate(endDate.toISOString())}`);
    }
  }

  lines.push(`SUMMARY:${escapeICalText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${event.url}`);
  }
  if (event.status) {
    lines.push(`STATUS:${event.status.toUpperCase()}`);
  }
  if (event.categories && event.categories.length > 0) {
    lines.push(`CATEGORIES:${event.categories.map(escapeICalText).join(",")}`);
  }
  if (event.priority !== undefined) {
    lines.push(`PRIORITY:${event.priority}`);
  }
  if (event.organizer) {
    lines.push(`ORGANIZER;CN=${escapeICalText(event.organizer.name)}:mailto:${event.organizer.email}`);
  }
  if (event.attendees) {
    for (const att of event.attendees) {
      const cn = att.name ? `;CN=${escapeICalText(att.name)}` : "";
      const rsvp = att.rsvp !== false ? ";RSVP=TRUE" : "";
      lines.push(`ATTENDEE${cn}${rsvp}:mailto:${att.email}`);
    }
  }
  if (event.recurrence) {
    const r = event.recurrence;
    let rule = `FREQ=${r.frequency.toUpperCase()}`;
    if (r.interval && r.interval > 1) rule += `;INTERVAL=${r.interval}`;
    if (r.count) rule += `;COUNT=${r.count}`;
    if (r.until) rule += `;UNTIL=${formatICalDate(r.until, true)}`;
    if (r.byDay && r.byDay.length > 0) rule += `;BYDAY=${r.byDay.join(",")}`;
    lines.push(`RRULE:${rule}`);
  }
  if (event.alarm) {
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeICalText(event.alarm.description || event.title)}`);
    const mins = Math.abs(event.alarm.trigger);
    lines.push(`TRIGGER:-PT${mins}M`);
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT");
  return lines.map(foldLine).join("\r\n");
}

/**
 * Generate an iCal (.ics) file from events.
 */
export async function generateICal(
  events: ICalEvent[],
  filename?: string,
  options: ICalOptions = {}
): Promise<ICalResult> {
  const filePath = filename
    ? isPathAllowed(filename) ? filename : join(tmpdir(), filename)
    : getTempPath();

  try {
    await mkdir(dirname(filePath), { recursive: true });

    const calName = options.calendarName || "OpenSentinel";
    const prodId = options.productId || "-//OpenSentinel//Calendar//EN";
    const tz = options.timezone || "UTC";

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      `PRODID:${prodId}`,
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeICalText(calName)}`,
      `X-WR-TIMEZONE:${tz}`,
    ];

    for (const event of events) {
      lines.push(eventToVEvent(event));
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n") + "\r\n";
    await writeFile(filePath, icsContent, "utf-8");

    return {
      success: true,
      filePath,
      icsContent,
      eventCount: events.length,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Quick helper: single event to iCal.
 */
export async function quickEvent(
  title: string,
  start: string,
  end?: string,
  description?: string,
  location?: string,
  filename?: string
): Promise<ICalResult> {
  return generateICal([{ title, start, end, description, location }], filename);
}

export default { generateICal, quickEvent };
