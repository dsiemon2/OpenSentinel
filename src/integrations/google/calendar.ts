/**
 * Google Calendar Service
 *
 * Google Calendar API integration for managing events.
 * Uses the Calendar REST API v3.
 */

import type { GoogleAuth } from "./auth";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  status: string;
  htmlLink: string;
  organizer: string;
  attendees: string[];
  allDay: boolean;
}

export interface CreateEventInput {
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: string[];
  calendarId?: string;
}

export class GoogleCalendarService {
  constructor(private auth: GoogleAuth) {}

  /**
   * List events for a calendar
   */
  async listEvents(
    calendarId = "primary",
    timeMin?: string,
    timeMax?: string,
    maxResults = 20
  ): Promise<CalendarEvent[]> {
    const url = new URL(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("maxResults", String(Math.min(maxResults, 250)));
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");

    if (timeMin) url.searchParams.set("timeMin", timeMin);
    else url.searchParams.set("timeMin", new Date().toISOString());

    if (timeMax) url.searchParams.set("timeMax", timeMax);

    const response = await this.auth.authenticatedFetch(url.toString());
    if (!response.ok) throw new Error(`Calendar list error: ${response.status}`);

    const data = await response.json();
    return (data.items || []).map(parseCalendarEvent);
  }

  /**
   * Create a new event
   */
  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const calendarId = input.calendarId || "primary";
    const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

    const body: any = {
      summary: input.summary,
      description: input.description || "",
      location: input.location || "",
      start: { dateTime: input.start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: { dateTime: input.end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    };

    if (input.attendees?.length) {
      body.attendees = input.attendees.map((email) => ({ email }));
    }

    const response = await this.auth.authenticatedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Calendar create error: ${response.status} ${error}`);
    }

    return parseCalendarEvent(await response.json());
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CreateEventInput>,
    calendarId = "primary"
  ): Promise<CalendarEvent> {
    const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;

    const body: any = {};
    if (updates.summary) body.summary = updates.summary;
    if (updates.description !== undefined) body.description = updates.description;
    if (updates.location !== undefined) body.location = updates.location;
    if (updates.start) body.start = { dateTime: updates.start };
    if (updates.end) body.end = { dateTime: updates.end };
    if (updates.attendees) body.attendees = updates.attendees.map((email) => ({ email }));

    const response = await this.auth.authenticatedFetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Calendar update error: ${response.status}`);
    return parseCalendarEvent(await response.json());
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string, calendarId = "primary"): Promise<void> {
    const url = `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`;
    const response = await this.auth.authenticatedFetch(url, { method: "DELETE" });

    if (!response.ok && response.status !== 410) {
      throw new Error(`Calendar delete error: ${response.status}`);
    }
  }
}

function parseCalendarEvent(item: any): CalendarEvent {
  return {
    id: item.id || "",
    summary: item.summary || "(No title)",
    description: item.description || "",
    location: item.location || "",
    start: item.start?.dateTime || item.start?.date || "",
    end: item.end?.dateTime || item.end?.date || "",
    status: item.status || "confirmed",
    htmlLink: item.htmlLink || "",
    organizer: item.organizer?.email || "",
    attendees: (item.attendees || []).map((a: any) => a.email),
    allDay: !!item.start?.date,
  };
}

export function createGoogleCalendarService(auth: GoogleAuth): GoogleCalendarService {
  return new GoogleCalendarService(auth);
}
