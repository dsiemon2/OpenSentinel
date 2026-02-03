import { CalendarEvent } from "./ical-parser";

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken?: string;
  accessToken?: string;
}

export interface GoogleCalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Google Calendar API endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Generate OAuth URL for user authorization
export function getAuthUrl(config: GoogleCalendarConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events.readonly",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  config: GoogleCalendarConfig,
  code: string
): Promise<GoogleCalendarTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// Refresh access token
export async function refreshAccessToken(
  config: GoogleCalendarConfig
): Promise<GoogleCalendarTokens> {
  if (!config.refreshToken) {
    throw new Error("No refresh token available");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: config.refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// Fetch events from Google Calendar
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  calendarId: string = "primary",
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 50
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
    singleEvents: "true",
    orderBy: "startTime",
  });

  if (timeMin) {
    params.set("timeMin", timeMin.toISOString());
  } else {
    params.set("timeMin", new Date().toISOString());
  }

  if (timeMax) {
    params.set("timeMax", timeMax.toISOString());
  }

  const url = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch events: ${error}`);
  }

  const data = await response.json();

  return (data.items || []).map((item: any) => convertGoogleEvent(item));
}

// Convert Google Calendar event to our CalendarEvent format
function convertGoogleEvent(googleEvent: any): CalendarEvent {
  const isAllDay = !googleEvent.start.dateTime;

  return {
    uid: googleEvent.id,
    summary: googleEvent.summary || "Untitled Event",
    description: googleEvent.description || "",
    location: googleEvent.location || "",
    start: new Date(googleEvent.start.dateTime || googleEvent.start.date),
    end: new Date(googleEvent.end.dateTime || googleEvent.end.date),
    allDay: isAllDay,
    recurrenceRule: googleEvent.recurrence?.[0] || undefined,
    organizer: googleEvent.organizer?.email,
    attendees: (googleEvent.attendees || []).map((a: any) => a.email),
    status: googleEvent.status,
    htmlLink: googleEvent.htmlLink,
  };
}

// List available calendars
export async function listCalendars(
  accessToken: string
): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
  const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendars: ${error}`);
  }

  const data = await response.json();

  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary,
    primary: item.primary || false,
  }));
}

// Get today's events
export async function getTodaysGoogleEvents(
  accessToken: string,
  calendarId: string = "primary"
): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return fetchGoogleCalendarEvents(accessToken, calendarId, startOfDay, endOfDay);
}

// Get upcoming events for the next N days
export async function getUpcomingGoogleEvents(
  accessToken: string,
  days: number = 7,
  calendarId: string = "primary"
): Promise<CalendarEvent[]> {
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return fetchGoogleCalendarEvents(accessToken, calendarId, now, endDate);
}

// Google Calendar client class
export class GoogleCalendarClient {
  private config: GoogleCalendarConfig;
  private tokens: GoogleCalendarTokens | null = null;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
    if (config.accessToken && config.refreshToken) {
      this.tokens = {
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000), // Assume 1 hour
      };
    }
  }

  getAuthUrl(): string {
    return getAuthUrl(this.config);
  }

  async authenticate(code: string): Promise<void> {
    this.tokens = await exchangeCodeForTokens(this.config, code);
  }

  async ensureValidToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error("Not authenticated");
    }

    // Refresh if expired or about to expire (5 min buffer)
    if (this.tokens.expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      this.tokens = await refreshAccessToken({
        ...this.config,
        refreshToken: this.tokens.refreshToken,
      });
    }

    return this.tokens.accessToken;
  }

  async getEvents(
    calendarId?: string,
    timeMin?: Date,
    timeMax?: Date
  ): Promise<CalendarEvent[]> {
    const token = await this.ensureValidToken();
    return fetchGoogleCalendarEvents(token, calendarId, timeMin, timeMax);
  }

  async getTodaysEvents(calendarId?: string): Promise<CalendarEvent[]> {
    const token = await this.ensureValidToken();
    return getTodaysGoogleEvents(token, calendarId);
  }

  async getUpcomingEvents(days?: number, calendarId?: string): Promise<CalendarEvent[]> {
    const token = await this.ensureValidToken();
    return getUpcomingGoogleEvents(token, days, calendarId);
  }

  async listCalendars(): Promise<Array<{ id: string; summary: string; primary: boolean }>> {
    const token = await this.ensureValidToken();
    return listCalendars(token);
  }

  getTokens(): GoogleCalendarTokens | null {
    return this.tokens;
  }

  setTokens(tokens: GoogleCalendarTokens): void {
    this.tokens = tokens;
  }
}

export default {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchGoogleCalendarEvents,
  listCalendars,
  getTodaysGoogleEvents,
  getUpcomingGoogleEvents,
  GoogleCalendarClient,
};
