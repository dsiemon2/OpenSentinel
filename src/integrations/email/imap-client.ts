import { ImapFlow, FetchMessageObject, MessageStructureObject } from "imapflow";
import { simpleParser, ParsedMail, AddressObject } from "mailparser";

export interface EmailConfig {
  host: string;
  port: number;
  secure?: boolean;
  user: string;
  password: string;
  tls?: {
    rejectUnauthorized?: boolean;
  };
}

export interface EmailMessage {
  id: string;
  uid: number;
  messageId: string;
  subject: string;
  from: EmailAddress[];
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  date: Date;
  text: string;
  html: string;
  snippet: string;
  attachments: EmailAttachment[];
  labels: string[];
  flags: string[];
  threadId?: string;
  inReplyTo?: string;
  references: string[];
  headers: Map<string, string>;
}

export interface EmailAddress {
  name: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
  contentId?: string;
}

export interface SearchOptions {
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  since?: Date;
  before?: Date;
  seen?: boolean;
  flagged?: boolean;
  limit?: number;
  offset?: number;
}

export interface FolderInfo {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
  messages: {
    total: number;
    unread: number;
  };
}

export class ImapClient {
  private client: ImapFlow | null = null;
  private config: EmailConfig;
  private connected: boolean = false;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  /**
   * Connect to the IMAP server
   */
  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? true,
      auth: {
        user: this.config.user,
        pass: this.config.password,
      },
      tls: this.config.tls ?? {
        rejectUnauthorized: true,
      },
      logger: false,
    });

    await this.client.connect();
    this.connected = true;
  }

  /**
   * Disconnect from the IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.logout();
      this.connected = false;
      this.client = null;
    }
  }

  /**
   * Ensure the client is connected
   */
  private async ensureConnected(): Promise<ImapFlow> {
    if (!this.client || !this.connected) {
      await this.connect();
    }
    return this.client!;
  }

  /**
   * List all folders/mailboxes
   */
  async listFolders(): Promise<FolderInfo[]> {
    const client = await this.ensureConnected();
    const folders: FolderInfo[] = [];

    const mailboxes = await client.list();

    for (const mailbox of mailboxes) {
      try {
        const status = await client.status(mailbox.path, {
          messages: true,
          unseen: true,
        });

        folders.push({
          name: mailbox.name,
          path: mailbox.path,
          delimiter: mailbox.delimiter,
          flags: mailbox.flags ? Array.from(mailbox.flags) : [],
          specialUse: mailbox.specialUse,
          messages: {
            total: status.messages || 0,
            unread: status.unseen || 0,
          },
        });
      } catch {
        // Some folders might not support status
        folders.push({
          name: mailbox.name,
          path: mailbox.path,
          delimiter: mailbox.delimiter,
          flags: mailbox.flags ? Array.from(mailbox.flags) : [],
          specialUse: mailbox.specialUse,
          messages: {
            total: 0,
            unread: 0,
          },
        });
      }
    }

    return folders;
  }

  /**
   * Get unread email count for a folder
   */
  async getUnreadCount(folder: string = "INBOX"): Promise<number> {
    const client = await this.ensureConnected();
    const status = await client.status(folder, { unseen: true });
    return status.unseen || 0;
  }

  /**
   * Get total email count for a folder
   */
  async getTotalCount(folder: string = "INBOX"): Promise<number> {
    const client = await this.ensureConnected();
    const status = await client.status(folder, { messages: true });
    return status.messages || 0;
  }

  /**
   * Fetch emails from a folder
   */
  async fetchEmails(
    folder: string = "INBOX",
    options: { limit?: number; offset?: number; fetchBody?: boolean } = {}
  ): Promise<EmailMessage[]> {
    const client = await this.ensureConnected();
    const { limit = 50, offset = 0, fetchBody = true } = options;
    const messages: EmailMessage[] = [];

    const lock = await client.getMailboxLock(folder);

    try {
      const total = client.mailbox?.exists || 0;
      if (total === 0) {
        return messages;
      }

      // Calculate range (IMAP uses 1-based, newest first)
      const start = Math.max(1, total - offset - limit + 1);
      const end = Math.max(1, total - offset);

      if (start > end) {
        return messages;
      }

      const range = `${start}:${end}`;

      for await (const msg of client.fetch(range, {
        envelope: true,
        flags: true,
        uid: true,
        bodyStructure: true,
        source: fetchBody,
      })) {
        try {
          const parsed = await this.parseMessage(msg, fetchBody);
          messages.push(parsed);
        } catch (err) {
          console.error(`Failed to parse message ${msg.uid}:`, err);
        }
      }

      // Sort by date, newest first
      messages.sort((a, b) => b.date.getTime() - a.date.getTime());
    } finally {
      lock.release();
    }

    return messages;
  }

  /**
   * Fetch a single email by UID
   */
  async fetchEmail(
    uid: number,
    folder: string = "INBOX"
  ): Promise<EmailMessage | null> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(folder);

    try {
      const msg = await client.fetchOne(String(uid), {
        envelope: true,
        flags: true,
        uid: true,
        bodyStructure: true,
        source: true,
      }, { uid: true });

      if (!msg) {
        return null;
      }

      return await this.parseMessage(msg, true);
    } finally {
      lock.release();
    }
  }

  /**
   * Search for emails
   */
  async searchEmails(options: SearchOptions): Promise<EmailMessage[]> {
    const client = await this.ensureConnected();
    const folder = options.folder || "INBOX";
    const messages: EmailMessage[] = [];

    const lock = await client.getMailboxLock(folder);

    try {
      // Build search query
      const searchQuery: Record<string, unknown> = {};

      if (options.from) {
        searchQuery.from = options.from;
      }
      if (options.to) {
        searchQuery.to = options.to;
      }
      if (options.subject) {
        searchQuery.subject = options.subject;
      }
      if (options.body) {
        searchQuery.body = options.body;
      }
      if (options.since) {
        searchQuery.since = options.since;
      }
      if (options.before) {
        searchQuery.before = options.before;
      }
      if (options.seen !== undefined) {
        searchQuery.seen = options.seen;
      }
      if (options.flagged !== undefined) {
        searchQuery.flagged = options.flagged;
      }

      // Perform search
      const uids = await client.search(searchQuery, { uid: true });

      if (uids.length === 0) {
        return messages;
      }

      // Apply pagination
      const offset = options.offset || 0;
      const limit = options.limit || 50;
      const paginatedUids = uids.slice(offset, offset + limit);

      if (paginatedUids.length === 0) {
        return messages;
      }

      // Fetch messages
      const uidRange = paginatedUids.join(",");

      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        flags: true,
        uid: true,
        bodyStructure: true,
        source: true,
      }, { uid: true })) {
        try {
          const parsed = await this.parseMessage(msg, true);
          messages.push(parsed);
        } catch (err) {
          console.error(`Failed to parse message ${msg.uid}:`, err);
        }
      }

      // Sort by date, newest first
      messages.sort((a, b) => b.date.getTime() - a.date.getTime());
    } finally {
      lock.release();
    }

    return messages;
  }

  /**
   * Mark email as read
   */
  async markAsRead(uid: number, folder: string = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(folder);

    try {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(uid: number, folder: string = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(folder);

    try {
      await client.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Flag/star an email
   */
  async flagEmail(uid: number, folder: string = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(folder);

    try {
      await client.messageFlagsAdd(String(uid), ["\\Flagged"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Unflag/unstar an email
   */
  async unflagEmail(uid: number, folder: string = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(folder);

    try {
      await client.messageFlagsRemove(String(uid), ["\\Flagged"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Move email to a folder
   */
  async moveEmail(
    uid: number,
    sourceFolder: string,
    targetFolder: string
  ): Promise<void> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(sourceFolder);

    try {
      await client.messageMove(String(uid), targetFolder, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Delete an email (move to trash)
   */
  async deleteEmail(uid: number, folder: string = "INBOX"): Promise<void> {
    const client = await this.ensureConnected();
    const lock = await client.getMailboxLock(folder);

    try {
      await client.messageFlagsAdd(String(uid), ["\\Deleted"], { uid: true });
      await client.messageDelete(String(uid), { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Get emails in a thread
   */
  async getThread(messageId: string, folder: string = "INBOX"): Promise<EmailMessage[]> {
    const client = await this.ensureConnected();
    const messages: EmailMessage[] = [];
    const lock = await client.getMailboxLock(folder);

    try {
      // Search for messages referencing this message ID
      const uids = await client.search({
        or: [
          { header: { "Message-ID": messageId } },
          { header: { "In-Reply-To": messageId } },
          { header: { References: messageId } },
        ],
      }, { uid: true });

      if (uids.length === 0) {
        return messages;
      }

      const uidRange = uids.join(",");

      for await (const msg of client.fetch(uidRange, {
        envelope: true,
        flags: true,
        uid: true,
        bodyStructure: true,
        source: true,
      }, { uid: true })) {
        try {
          const parsed = await this.parseMessage(msg, true);
          messages.push(parsed);
        } catch (err) {
          console.error(`Failed to parse message ${msg.uid}:`, err);
        }
      }

      // Sort by date, oldest first (chronological order for threads)
      messages.sort((a, b) => a.date.getTime() - b.date.getTime());
    } finally {
      lock.release();
    }

    return messages;
  }

  /**
   * Parse a raw IMAP message into our EmailMessage format
   */
  private async parseMessage(
    msg: FetchMessageObject,
    includeBody: boolean
  ): Promise<EmailMessage> {
    const envelope = msg.envelope;

    // Parse full message if source is available
    let parsedMail: ParsedMail | null = null;
    if (includeBody && msg.source) {
      parsedMail = await simpleParser(msg.source);
    }

    // Extract addresses
    const extractAddresses = (addrs: AddressObject | AddressObject[] | undefined): EmailAddress[] => {
      if (!addrs) return [];
      const arr = Array.isArray(addrs) ? addrs : [addrs];
      return arr.flatMap(a =>
        a.value?.map(v => ({
          name: v.name || "",
          address: v.address || "",
        })) || []
      );
    };

    // Extract attachments
    const attachments: EmailAttachment[] = [];
    if (parsedMail?.attachments) {
      for (const att of parsedMail.attachments) {
        attachments.push({
          filename: att.filename || "attachment",
          contentType: att.contentType,
          size: att.size,
          content: att.content,
          contentId: att.cid,
        });
      }
    }

    // Build text snippet
    const text = parsedMail?.text || "";
    const snippet = text.substring(0, 200).replace(/\s+/g, " ").trim();

    return {
      id: `${msg.uid}`,
      uid: msg.uid,
      messageId: envelope.messageId || "",
      subject: envelope.subject || "(No Subject)",
      from: envelope.from?.map(a => ({
        name: a.name || "",
        address: a.address || "",
      })) || [],
      to: envelope.to?.map(a => ({
        name: a.name || "",
        address: a.address || "",
      })) || [],
      cc: envelope.cc?.map(a => ({
        name: a.name || "",
        address: a.address || "",
      })) || [],
      bcc: [],
      date: envelope.date || new Date(),
      text: parsedMail?.text || "",
      html: parsedMail?.html || "",
      snippet,
      attachments,
      labels: [],
      flags: msg.flags ? Array.from(msg.flags) : [],
      threadId: envelope.messageId,
      inReplyTo: envelope.inReplyTo,
      references: Array.isArray(parsedMail?.references)
        ? parsedMail.references
        : parsedMail?.references
          ? [parsedMail.references]
          : [],
      headers: parsedMail?.headers
        ? new Map(parsedMail.headers)
        : new Map(),
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Watch for new emails (using IDLE)
   */
  async watchForNew(
    folder: string,
    callback: (email: EmailMessage) => void,
    options: { timeout?: number } = {}
  ): Promise<() => void> {
    const client = await this.ensureConnected();
    const { timeout = 30 * 60 * 1000 } = options; // 30 minutes default

    let watching = true;
    let lock: Awaited<ReturnType<typeof client.getMailboxLock>> | null = null;

    const watch = async () => {
      while (watching) {
        try {
          lock = await client.getMailboxLock(folder);
          const lastKnownUid = client.mailbox?.uidNext
            ? client.mailbox.uidNext - 1
            : 0;

          // Wait for updates using IDLE
          await client.idle();

          // Check for new messages
          if (client.mailbox?.uidNext && client.mailbox.uidNext > lastKnownUid + 1) {
            const newUids: number[] = [];
            for (let uid = lastKnownUid + 1; uid < client.mailbox.uidNext; uid++) {
              newUids.push(uid);
            }

            for (const uid of newUids) {
              try {
                const email = await this.fetchEmail(uid, folder);
                if (email) {
                  callback(email);
                }
              } catch (err) {
                console.error(`Failed to fetch new email ${uid}:`, err);
              }
            }
          }
        } catch (err) {
          console.error("Watch error:", err);
          await new Promise(resolve => setTimeout(resolve, 5000));
        } finally {
          if (lock) {
            lock.release();
            lock = null;
          }
        }
      }
    };

    // Start watching
    watch();

    // Return stop function
    return () => {
      watching = false;
      if (lock) {
        lock.release();
      }
    };
  }
}

// Factory function for common email providers
export function createImapClient(
  provider: "gmail" | "outlook" | "yahoo" | "custom",
  credentials: { user: string; password: string },
  customConfig?: Partial<EmailConfig>
): ImapClient {
  const configs: Record<string, EmailConfig> = {
    gmail: {
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      user: credentials.user,
      password: credentials.password,
    },
    outlook: {
      host: "outlook.office365.com",
      port: 993,
      secure: true,
      user: credentials.user,
      password: credentials.password,
    },
    yahoo: {
      host: "imap.mail.yahoo.com",
      port: 993,
      secure: true,
      user: credentials.user,
      password: credentials.password,
    },
    custom: {
      host: customConfig?.host || "localhost",
      port: customConfig?.port || 993,
      secure: customConfig?.secure ?? true,
      user: credentials.user,
      password: credentials.password,
      ...customConfig,
    },
  };

  return new ImapClient(configs[provider]);
}

export default ImapClient;
