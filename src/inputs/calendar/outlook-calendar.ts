import { CalendarEvent } from "./ical-parser";

export interface OutlookCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenantId?: string; // 'common' for personal, or specific tenant ID
  refreshToken?: string;
  accessToken?: string;
}

export interface OutlookCalendarTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// Microsoft OAuth endpoints
const MS_AUTH_URL = "https://login.microsoftonline.com";
const MS_GRAPH_API = "https://graph.microsoft.com/v1.0";

// Generate OAuth URL for user authorization
export function getAuthUrl(config: OutlookCalendarConfig): string {
  const tenant = config.tenantId || "common";
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: [
      "offline_access",
      "Calendars.Read",
      "User.Read",
    ].join(" "),
    response_mode: "query",
  });

  return `${MS_AUTH_URL}/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  config: OutlookCalendarConfig,
  code: string
): Promise<OutlookCalendarTokens> {
  const tenant = config.tenantId || "common";
  const tokenUrl = `${MS_AUTH_URL}/${tenant}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      scope: "offline_access Calendars.Read User.Read",
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
  config: OutlookCalendarConfig
): Promise<OutlookCalendarTokens> {
  if (!config.refreshToken) {
    throw new Error("No refresh token available");
  }

  const tenant = config.tenantId || "common";
  const tokenUrl = `${MS_AUTH_URL}/${tenant}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
      scope: "offline_access Calendars.Read User.Read",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || config.refreshToken,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

// Fetch events from Outlook Calendar
export async function fetchOutlookCalendarEvents(
  accessToken: string,
  calendarId?: string,
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 50
): Promise<CalendarEvent[]> {
  const startDateTime = timeMin || new Date();
  const endDateTime = timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    startDateTime: startDateTime.toISOString(),
    endDateTime: endDateTime.toISOString(),
    $top: maxResults.toString(),
    $orderby: "start/dateTime",
    $select: "id,subject,body,start,end,location,isAllDay,recurrence,organizer,attendees,webLink",
  });

  const calendarPath = calendarId
    ? `/me/calendars/${encodeURIComponent(calendarId)}/calendarView`
    : "/me/calendarView";

  const url = `${MS_GRAPH_API}${calendarPath}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch events: ${error}`);
  }

  const data = await response.json();

  return (data.value || []).map((item: any) => convertOutlookEvent(item));
}

// Convert Outlook event to our CalendarEvent format
function convertOutlookEvent(outlookEvent: any): CalendarEvent {
  return {
    uid: outlookEvent.id,
    summary: outlookEvent.subject || "Untitled Event",
    description: outlookEvent.body?.content || "",
    location: outlookEvent.location?.displayName || "",
    start: new Date(outlookEvent.start.dateTime + "Z"),
    end: new Date(outlookEvent.end.dateTime + "Z"),
    allDay: outlookEvent.isAllDay || false,
    recurrenceRule: outlookEvent.recurrence
      ? JSON.stringify(outlookEvent.recurrence)
      : undefined,
    organizer: outlookEvent.organizer?.emailAddress?.address,
    attendees: (outlookEvent.attendees || []).map(
      (a: any) => a.emailAddress?.address
    ),
    status: outlookEvent.responseStatus?.response,
    htmlLink: outlookEvent.webLink,
  };
}

// List available calendars
export async function listCalendars(
  accessToken: string
): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
  const response = await fetch(`${MS_GRAPH_API}/me/calendars`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list calendars: ${error}`);
  }

  const data = await response.json();

  return (data.value || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    isDefault: item.isDefaultCalendar || false,
  }));
}

// Get today's events
export async function getTodaysOutlookEvents(
  accessToken: string,
  calendarId?: string
): Promise<CalendarEvent[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return fetchOutlookCalendarEvents(accessToken, calendarId, startOfDay, endOfDay);
}

// Get upcoming events for the next N days
export async function getUpcomingOutlookEvents(
  accessToken: string,
  days: number = 7,
  calendarId?: string
): Promise<CalendarEvent[]> {
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return fetchOutlookCalendarEvents(accessToken, calendarId, now, endDate);
}

// Outlook Calendar client class
export class OutlookCalendarClient {
  private config: OutlookCalendarConfig;
  private tokens: OutlookCalendarTokens | null = null;

  constructor(config: OutlookCalendarConfig) {
    this.config = config;
    if (config.accessToken && config.refreshToken) {
      this.tokens = {
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        expiresAt: new Date(Date.now() + 3600 * 1000),
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
    return fetchOutlookCalendarEvents(token, calendarId, timeMin, timeMax);
  }

  async getTodaysEvents(calendarId?: string): Promise<CalendarEvent[]> {
    const token = await this.ensureValidToken();
    return getTodaysOutlookEvents(token, calendarId);
  }

  async getUpcomingEvents(days?: number, calendarId?: string): Promise<CalendarEvent[]> {
    const token = await this.ensureValidToken();
    return getUpcomingOutlookEvents(token, days, calendarId);
  }

  async listCalendars(): Promise<Array<{ id: string; name: string; isDefault: boolean }>> {
    const token = await this.ensureValidToken();
    return listCalendars(token);
  }

  getTokens(): OutlookCalendarTokens | null {
    return this.tokens;
  }

  setTokens(tokens: OutlookCalendarTokens): void {
    this.tokens = tokens;
  }
}

export default {
  getAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  fetchOutlookCalendarEvents,
  listCalendars,
  getTodaysOutlookEvents,
  getUpcomingOutlookEvents,
  OutlookCalendarClient,
};
