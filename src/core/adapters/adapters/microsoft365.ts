import { z } from "zod";
import { BaseAdapter } from "../base-adapter";
import type { AuthResult, ActionDefinition, TriggerDefinition, TriggerConfig } from "../types";

export class Microsoft365Adapter extends BaseAdapter {
  metadata = {
    name: "Microsoft365",
    slug: "microsoft365",
    displayName: "Microsoft 365",
    description: "Send emails, manage calendar, post Teams messages, and access OneDrive files with Microsoft 365",
    category: "productivity",
    authType: "oauth2" as const,
  };

  async authenticate(credentials: Record<string, string>): Promise<AuthResult> {
    return {
      accessToken: credentials.accessToken || "",
      refreshToken: credentials.refreshToken,
      metadata: {
        tenantId: credentials.tenantId,
        email: credentials.email,
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
      description: "Send an email via Microsoft Outlook",
      inputSchema: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
        cc: z.string().email().optional(),
        importance: z.enum(["low", "normal", "high"]).optional().default("normal"),
      }),
      outputSchema: z.object({ id: z.string(), status: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { to, subject, body, cc, importance } = input as {
          to: string; subject: string; body: string; cc?: string; importance: string;
        };
        const message: Record<string, unknown> = {
          message: {
            subject,
            body: { contentType: "HTML", content: body },
            toRecipients: [{ emailAddress: { address: to } }],
            importance,
          },
        };
        if (cc) {
          (message.message as Record<string, unknown>).ccRecipients = [{ emailAddress: { address: cc } }];
        }
        const response = await this.makeRequest(
          "https://graph.microsoft.com/v1.0/me/sendMail",
          { method: "POST", body: JSON.stringify(message), auth }
        );
        return { id: response.headers.get("request-id") || "", status: "sent" };
      },
    },
    createEvent: {
      name: "Create Calendar Event",
      description: "Create a new event in Outlook Calendar",
      inputSchema: z.object({
        subject: z.string(),
        body: z.string().optional(),
        startDateTime: z.string(),
        endDateTime: z.string(),
        timeZone: z.string().optional().default("UTC"),
        location: z.string().optional(),
        attendees: z.array(z.string().email()).optional(),
      }),
      outputSchema: z.object({ id: z.string(), webLink: z.string(), subject: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { subject, body, startDateTime, endDateTime, timeZone, location, attendees } = input as {
          subject: string; body?: string; startDateTime: string; endDateTime: string; timeZone: string; location?: string; attendees?: string[];
        };
        const event: Record<string, unknown> = {
          subject,
          body: body ? { contentType: "HTML", content: body } : undefined,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone },
        };
        if (location) event.location = { displayName: location };
        if (attendees) {
          event.attendees = attendees.map((email) => ({
            emailAddress: { address: email },
            type: "required",
          }));
        }
        const response = await this.makeRequest(
          "https://graph.microsoft.com/v1.0/me/events",
          { method: "POST", body: JSON.stringify(event), auth }
        );
        return response.json();
      },
    },
    createTeamsMessage: {
      name: "Send Teams Message",
      description: "Send a message to a Microsoft Teams channel",
      inputSchema: z.object({
        teamId: z.string(),
        channelId: z.string(),
        content: z.string(),
        contentType: z.enum(["text", "html"]).optional().default("text"),
      }),
      outputSchema: z.object({ id: z.string(), createdDateTime: z.string() }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { teamId, channelId, content, contentType } = input as {
          teamId: string; channelId: string; content: string; contentType: string;
        };
        const response = await this.makeRequest(
          `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ body: { contentType, content } }),
            auth,
          }
        );
        return response.json();
      },
    },
    listOneDriveFiles: {
      name: "List OneDrive Files",
      description: "List files in OneDrive",
      inputSchema: z.object({
        path: z.string().optional().default("/"),
        top: z.number().optional().default(20),
      }),
      outputSchema: z.object({ value: z.array(z.object({ id: z.string(), name: z.string(), size: z.number() })) }),
      execute: async (input: unknown, auth: AuthResult) => {
        const { path, top } = input as { path: string; top: number };
        const endpoint = path === "/"
          ? `https://graph.microsoft.com/v1.0/me/drive/root/children?$top=${top}`
          : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(path)}:/children?$top=${top}`;
        const response = await this.makeRequest(endpoint, { auth });
        return response.json();
      },
    },
  };

  triggers: Record<string, TriggerDefinition> = {
    onNewEmail: {
      name: "New Email Received",
      description: "Triggered when a new email is received in Outlook",
      outputSchema: z.object({ messageId: z.string(), from: z.string(), subject: z.string(), preview: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
    onNewTeamsMessage: {
      name: "New Teams Message",
      description: "Triggered when a new message is posted in a Teams channel",
      outputSchema: z.object({ messageId: z.string(), teamId: z.string(), channelId: z.string(), content: z.string(), from: z.string() }),
      subscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
      unsubscribe: async (_config: TriggerConfig, _auth: AuthResult) => {},
    },
  };
}
