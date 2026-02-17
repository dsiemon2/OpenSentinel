/**
 * Gmail Service
 *
 * Gmail API integration for reading, sending, and searching emails.
 * Uses the Gmail REST API v1.
 */

import type { GoogleAuth } from "./auth";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  body: string;
  labels: string[];
}

export interface GmailLabel {
  id: string;
  name: string;
  type: string;
  messagesTotal: number;
  messagesUnread: number;
}

export class GmailService {
  constructor(private auth: GoogleAuth) {}

  /**
   * List recent emails
   */
  async listEmails(query?: string, maxResults = 20): Promise<GmailMessage[]> {
    const url = new URL(`${GMAIL_BASE}/messages`);
    url.searchParams.set("maxResults", String(Math.min(maxResults, 100)));
    if (query) url.searchParams.set("q", query);

    const response = await this.auth.authenticatedFetch(url.toString());
    if (!response.ok) throw new Error(`Gmail list error: ${response.status}`);

    const data = await response.json();
    const messages: GmailMessage[] = [];

    for (const msg of (data.messages || []).slice(0, maxResults)) {
      try {
        const full = await this.readEmail(msg.id);
        if (full) messages.push(full);
      } catch {
        // Skip individual message errors
      }
    }

    return messages;
  }

  /**
   * Read a single email by ID
   */
  async readEmail(messageId: string): Promise<GmailMessage | null> {
    const url = `${GMAIL_BASE}/messages/${messageId}?format=full`;
    const response = await this.auth.authenticatedFetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return parseGmailMessage(data);
  }

  /**
   * Send an email
   */
  async sendEmail(to: string, subject: string, body: string): Promise<{ id: string; threadId: string }> {
    const mimeMessage = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    const encoded = Buffer.from(mimeMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await this.auth.authenticatedFetch(`${GMAIL_BASE}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: encoded }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail send error: ${response.status} ${error}`);
    }

    return response.json();
  }

  /**
   * Search emails
   */
  async searchEmails(query: string, maxResults = 20): Promise<GmailMessage[]> {
    return this.listEmails(query, maxResults);
  }

  /**
   * Reply to an email
   */
  async replyToEmail(messageId: string, body: string): Promise<{ id: string; threadId: string }> {
    const original = await this.readEmail(messageId);
    if (!original) throw new Error(`Message ${messageId} not found`);

    const mimeMessage = [
      `To: ${original.from}`,
      `Subject: Re: ${original.subject}`,
      `In-Reply-To: ${messageId}`,
      `References: ${messageId}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    const encoded = Buffer.from(mimeMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await this.auth.authenticatedFetch(`${GMAIL_BASE}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw: encoded,
        threadId: original.threadId,
      }),
    });

    if (!response.ok) throw new Error(`Gmail reply error: ${response.status}`);
    return response.json();
  }

  /**
   * Get labels
   */
  async getLabels(): Promise<GmailLabel[]> {
    const response = await this.auth.authenticatedFetch(`${GMAIL_BASE}/labels`);
    if (!response.ok) throw new Error(`Gmail labels error: ${response.status}`);

    const data = await response.json();
    return (data.labels || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type || "user",
      messagesTotal: l.messagesTotal || 0,
      messagesUnread: l.messagesUnread || 0,
    }));
  }
}

/**
 * Parse Gmail API message into our format
 */
function parseGmailMessage(data: any): GmailMessage {
  const headers = data.payload?.headers || [];
  const getHeader = (name: string): string => {
    const h = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return h?.value || "";
  };

  // Extract body from parts
  let body = "";
  if (data.payload?.body?.data) {
    body = Buffer.from(data.payload.body.data, "base64").toString("utf-8");
  } else if (data.payload?.parts) {
    for (const part of data.payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        body = Buffer.from(part.body.data, "base64").toString("utf-8");
        break;
      }
    }
  }

  return {
    id: data.id,
    threadId: data.threadId,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    to: getHeader("To"),
    date: getHeader("Date"),
    snippet: data.snippet || "",
    body: body.slice(0, 5000),
    labels: data.labelIds || [],
  };
}

export function createGmailService(auth: GoogleAuth): GmailService {
  return new GmailService(auth);
}
