import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class GoogleWorkspaceAdapter extends BaseAdapter {
  metadata = {
    name: "GoogleWorkspace",
    slug: "google-workspace",
    displayName: "Google Workspace",
    description: "Send emails, manage calendar events, create documents, and access Drive files with Google Workspace",
    category: "productivity",
    authType: "oauth2" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessToken || "",
      refreshToken: credentials.refreshToken,
      metadata: {
        email: credentials.email,
        domain: credentials.domain,
      },
    };
  }

  async refreshAuth(auth: AuthResult): Promise<AuthResult> {
    return {
      ...auth,
      accessToken: `refreshed_${auth.accessToken}`,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };
  }

  actions: Record<string, ActionDefinition> = {
    sendEmail: {
      name: "Send Email",
      description: "Send an email via Gmail",
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
        cc: z.string().email().optional(),
        bcc: z.string().email().optional(),
      }),
      outputSchema: z.object({ id: z.string(), threadId: z.string(), labelIds: z.array(z.string()) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, subject, body, cc, bcc } = input as { to: string; subject: string; body: string; cc?: string; bcc?: string };
        const headers = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/html; charset=utf-8"];
        if (cc) headers.push(`Cc: ${cc}`);
        if (bcc) headers.push(`Bcc: ${bcc}`);
        const raw = btoa(`${headers.join("\r\n")}\r\n\r\n${body}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const response = await this.makeRequest(
          "https://www.googleapis.com/gmail/v1/users/me/messages/send",
          { method: "POST", body: JSON.stringify({ raw }), auth }
        );
        return response.json();
      },
    },
    createCalendarEvent: {
      name: "Create Calendar Event",
      description: "Create a new event in Google Calendar",
      inputSchema: z.object({
        summary: z.string(),
        description: z.string().optional(),
        location: z.string().optional(),
        startDateTime: z.string(),
        endDateTime: z.string(),
        timeZone: z.string().optional().default("UTC"),
        attendees: z.array(z.string().email()).optional(),
      }),
      outputSchema: z.object({ id: z.string(), htmlLink: z.string(), status: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { summary, description, location, startDateTime, endDateTime, timeZone, attendees } = input as {
          summary: string; description?: string; location?: string; startDateTime: string; endDateTime: string; timeZone: string; attendees?: string[];
        };
        const event: Record<string, unknown> = {
          summary,
          description,
          location,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
        };
        if (attendees) {
          event.attendees = attendees.map((email) => ({ email }));
        }
        const response = await this.makeRequest(
          "https://www.googleapis.com/calendar/v3/calendars/primary/events",
          { method: "POST", body: JSON.stringify(event), auth }
        );
        return response.json();
      },
    },
    createDoc: {
      name: "Create Document",
      description: "Create a new Google Docs document",
      inputSchema: z.object({
        title: z.string(),
        body: z.string().optional(),
      }),
      outputSchema: z.object({ documentId: z.string(), title: z.string(), revisionId: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { title, body } = input as { title: string; body?: string };
        const response = await this.makeRequest(
          "https://docs.googleapis.com/v1/documents",
          { method: "POST", body: JSON.stringify({ title }), auth }
        );
        const doc = await response.json() as { documentId: string; title: string; revisionId: string };
        if (body) {
          await this.makeRequest(
            `https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`,
            {
              method: "POST",
              body: JSON.stringify({
                requests: [{ insertText: { location: { index: 1 }, text: body } }],
              }),
              auth,
            }
          );
        }
        return doc;
      },
    },
    listDriveFiles: {
      name: "List Drive Files",
      description: "List files in Google Drive",
      inputSchema: z.object({
        query: z.string().optional(),
        pageSize: z.number().optional().default(20),
        folderId: z.string().optional(),
      }),
      outputSchema: z.object({ files: z.array(z.object({ id: z.string(), name: z.string(), mimeType: z.string() })), nextPageToken: z.string().optional() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { query, pageSize, folderId } = input as { query?: string; pageSize: number; folderId?: string };
        const params = new URLSearchParams({ pageSize: String(pageSize), fields: "files(id,name,mimeType,modifiedTime,size),nextPageToken" });
        if (query) params.set("q", query);
        if (folderId) params.set("q", `'${folderId}' in parents`);
        const response = await this.makeRequest(
          `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
          { auth }
        );
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewEmail: {
      name: "New Email Received",
      description: "Triggered when a new email is received in Gmail",
      outputSchema: z.object({ messageId: z.string(), from: z.string(), subject: z.string(), snippet: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onCalendarEvent: {
      name: "Calendar Event Starting",
      description: "Triggered when a calendar event is about to start",
      outputSchema: z.object({ eventId: z.string(), summary: z.string(), startTime: z.string(), location: z.string().optional() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
