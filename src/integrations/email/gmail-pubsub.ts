// Gmail PubSub — Real-time Gmail push notifications via Google Cloud PubSub
// Uses Gmail API watch() to receive push notifications when new emails arrive

export interface GmailPubSubConfig {
  projectId: string;
  topicName: string;
  subscriptionName?: string;
  credentials: {
    clientEmail: string;
    privateKey: string;
  };
  gmailUserId?: string; // defaults to "me"
  labelIds?: string[]; // labels to watch (e.g., ["INBOX"])
}

export interface GmailNotification {
  emailAddress: string;
  historyId: string;
  timestamp: Date;
}

export type GmailNotificationHandler = (notification: GmailNotification) => Promise<void>;

// Notification handlers
const handlers: GmailNotificationHandler[] = [];

export class GmailPubSub {
  private config: GmailPubSubConfig;
  private watching = false;
  private watchExpiry: Date | null = null;
  private renewTimer: ReturnType<typeof setInterval> | null = null;
  private lastHistoryId: string | null = null;

  constructor(config: GmailPubSubConfig) {
    this.config = {
      ...config,
      gmailUserId: config.gmailUserId ?? "me",
      labelIds: config.labelIds ?? ["INBOX"],
      subscriptionName: config.subscriptionName ?? `${config.topicName}-sub`,
    };
  }

  /**
   * Register a handler for Gmail notifications
   */
  onNotification(handler: GmailNotificationHandler): void {
    handlers.push(handler);
  }

  /**
   * Start watching Gmail for changes using PubSub
   * Requires: Gmail API watch scope, PubSub topic with Gmail publish permissions
   */
  async startWatching(): Promise<{
    success: boolean;
    historyId?: string;
    expiration?: Date;
    error?: string;
  }> {
    try {
      // Get OAuth2 access token
      const accessToken = await this.getAccessToken();

      // Call Gmail API watch()
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/${this.config.gmailUserId}/watch`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topicName: `projects/${this.config.projectId}/topics/${this.config.topicName}`,
            labelIds: this.config.labelIds,
            labelFilterBehavior: "INCLUDE",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Gmail watch failed: ${error}` };
      }

      const data = (await response.json()) as { historyId: string; expiration: string };
      this.lastHistoryId = data.historyId;
      this.watchExpiry = new Date(parseInt(data.expiration));
      this.watching = true;

      // Auto-renew watch before expiry (Gmail watch expires after 7 days)
      const renewInterval = 6 * 24 * 60 * 60 * 1000; // 6 days
      this.renewTimer = setInterval(() => {
        this.startWatching().catch(console.error);
      }, renewInterval);

      console.log(
        `[Gmail PubSub] Watching started. History ID: ${data.historyId}, Expires: ${this.watchExpiry.toISOString()}`
      );

      return {
        success: true,
        historyId: data.historyId,
        expiration: this.watchExpiry,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop watching Gmail
   */
  async stopWatching(): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();

      await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/${this.config.gmailUserId}/stop`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      this.watching = false;
      if (this.renewTimer) {
        clearInterval(this.renewTimer);
        this.renewTimer = null;
      }

      console.log("[Gmail PubSub] Watching stopped");
      return true;
    } catch (error) {
      console.error("[Gmail PubSub] Error stopping watch:", error);
      return false;
    }
  }

  /**
   * Handle incoming PubSub notification (webhook endpoint handler)
   * This should be called from your HTTP server when Google sends a push notification
   */
  async handlePubSubNotification(body: {
    message: {
      data: string; // base64 encoded
      messageId: string;
      publishTime: string;
    };
    subscription: string;
  }): Promise<void> {
    try {
      // Decode the notification
      const decoded = Buffer.from(body.message.data, "base64").toString("utf-8");
      const data = JSON.parse(decoded) as {
        emailAddress: string;
        historyId: string;
      };

      const notification: GmailNotification = {
        emailAddress: data.emailAddress,
        historyId: data.historyId,
        timestamp: new Date(body.message.publishTime),
      };

      console.log(
        `[Gmail PubSub] Notification: ${notification.emailAddress} (history: ${notification.historyId})`
      );

      // Notify all handlers
      for (const handler of handlers) {
        try {
          await handler(notification);
        } catch (error) {
          console.error("[Gmail PubSub] Handler error:", error);
        }
      }

      // Update last history ID
      this.lastHistoryId = data.historyId;
    } catch (error) {
      console.error("[Gmail PubSub] Error processing notification:", error);
    }
  }

  /**
   * Get Gmail history changes since last notification
   */
  async getHistoryChanges(sinceHistoryId?: string): Promise<{
    messagesAdded: string[];
    messagesDeleted: string[];
    labelsAdded: Array<{ messageId: string; labels: string[] }>;
    labelsRemoved: Array<{ messageId: string; labels: string[] }>;
  }> {
    const historyId = sinceHistoryId ?? this.lastHistoryId;
    if (!historyId) {
      return { messagesAdded: [], messagesDeleted: [], labelsAdded: [], labelsRemoved: [] };
    }

    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/${this.config.gmailUserId}/history?startHistoryId=${historyId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        console.error("[Gmail PubSub] History fetch failed:", await response.text());
        return { messagesAdded: [], messagesDeleted: [], labelsAdded: [], labelsRemoved: [] };
      }

      const data = (await response.json()) as {
        history?: Array<{
          messagesAdded?: Array<{ message: { id: string } }>;
          messagesDeleted?: Array<{ message: { id: string } }>;
          labelsAdded?: Array<{
            message: { id: string };
            labelIds: string[];
          }>;
          labelsRemoved?: Array<{
            message: { id: string };
            labelIds: string[];
          }>;
        }>;
      };

      const changes = {
        messagesAdded: [] as string[],
        messagesDeleted: [] as string[],
        labelsAdded: [] as Array<{ messageId: string; labels: string[] }>,
        labelsRemoved: [] as Array<{ messageId: string; labels: string[] }>,
      };

      for (const entry of data.history ?? []) {
        if (entry.messagesAdded) {
          changes.messagesAdded.push(
            ...entry.messagesAdded.map((m) => m.message.id)
          );
        }
        if (entry.messagesDeleted) {
          changes.messagesDeleted.push(
            ...entry.messagesDeleted.map((m) => m.message.id)
          );
        }
        if (entry.labelsAdded) {
          changes.labelsAdded.push(
            ...entry.labelsAdded.map((m) => ({
              messageId: m.message.id,
              labels: m.labelIds,
            }))
          );
        }
        if (entry.labelsRemoved) {
          changes.labelsRemoved.push(
            ...entry.labelsRemoved.map((m) => ({
              messageId: m.message.id,
              labels: m.labelIds,
            }))
          );
        }
      }

      return changes;
    } catch (error) {
      console.error("[Gmail PubSub] Error fetching history:", error);
      return { messagesAdded: [], messagesDeleted: [], labelsAdded: [], labelsRemoved: [] };
    }
  }

  /**
   * Get an OAuth2 access token using service account credentials
   */
  private async getAccessToken(): Promise<string> {
    // Build JWT for service account auth
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: "RS256", typ: "JWT" })
    ).toString("base64url");

    const payload = Buffer.from(
      JSON.stringify({
        iss: this.config.credentials.clientEmail,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now,
        sub: this.config.gmailUserId === "me" ? this.config.credentials.clientEmail : this.config.gmailUserId,
      })
    ).toString("base64url");

    // Sign with private key
    const crypto = await import("crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(this.config.credentials.privateKey, "base64url");

    const jwt = `${header}.${payload}.${signature}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    return tokenData.access_token;
  }

  /**
   * Get current watch status
   */
  getStatus(): {
    watching: boolean;
    expiry: Date | null;
    lastHistoryId: string | null;
    handlerCount: number;
  } {
    return {
      watching: this.watching,
      expiry: this.watchExpiry,
      lastHistoryId: this.lastHistoryId,
      handlerCount: handlers.length,
    };
  }
}
