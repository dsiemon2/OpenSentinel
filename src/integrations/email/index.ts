// IMAP Client - Reading emails
export {
  ImapClient,
  createImapClient,
  type EmailConfig,
  type EmailMessage,
  type EmailAddress,
  type EmailAttachment,
  type SearchOptions,
  type FolderInfo,
} from "./imap-client";

// SMTP Client - Sending emails
export {
  SmtpClient,
  createSmtpClient,
  type SmtpConfig,
  type EmailRecipient,
  type EmailAttachment as SmtpEmailAttachment,
  type SendEmailOptions,
  type ReplyOptions,
  type SendResult,
} from "./smtp-client";

// Email Parser - Content parsing and threading
export {
  parseEmail,
  parseAttachment,
  groupIntoThreads,
  cleanSubject,
  parseEmailBody,
  extractEmailAddresses,
  extractUrls,
  extractPhoneNumbers,
  getEmailSummary,
  calculateEmailSize,
  matchesFilter,
  type ParsedEmail,
  type ThreadInfo,
  type ParsedAttachment,
  type EmailMetadata,
  type EmailThread,
  type QuotedSection,
  type EmailBodyParts,
} from "./email-parser";

// Inbox Summarizer - AI-powered analysis
export {
  categorizeEmail,
  extractActionItems,
  summarizeThread,
  summarizeInbox,
  generateDailyDigest,
  suggestReplies,
  analyzeSentiment,
  type InboxSummary,
  type CategorySummary,
  type UrgentItem,
  type ActionItem,
  type EmailCategorization,
  type ThreadSummary,
} from "./inbox-summarizer";

/**
 * Email Integration for Moltbot
 *
 * This module provides comprehensive email functionality:
 *
 * ## Reading Emails (IMAP)
 * ```typescript
 * import { createImapClient } from './integrations/email';
 *
 * const imap = createImapClient('gmail', {
 *   user: 'your@gmail.com',
 *   password: 'your-app-password'
 * });
 *
 * await imap.connect();
 * const emails = await imap.fetchEmails('INBOX', { limit: 20 });
 * const unread = await imap.getUnreadCount();
 * await imap.disconnect();
 * ```
 *
 * ## Sending Emails (SMTP)
 * ```typescript
 * import { createSmtpClient } from './integrations/email';
 *
 * const smtp = createSmtpClient('gmail', {
 *   user: 'your@gmail.com',
 *   password: 'your-app-password'
 * });
 *
 * await smtp.send({
 *   to: 'recipient@example.com',
 *   subject: 'Hello',
 *   text: 'This is a test email'
 * });
 * ```
 *
 * ## Parsing Emails
 * ```typescript
 * import { parseEmail, groupIntoThreads } from './integrations/email';
 *
 * const parsed = parseEmail(rawEmail);
 * const threads = groupIntoThreads(emails);
 * ```
 *
 * ## AI-Powered Features
 * ```typescript
 * import { summarizeInbox, extractActionItems } from './integrations/email';
 *
 * const summary = await summarizeInbox(emails);
 * const actions = await extractActionItems(email);
 * ```
 */

// Convenience class that combines IMAP and SMTP
export class EmailClient {
  private imapClient: InstanceType<typeof import("./imap-client").ImapClient>;
  private smtpClient: InstanceType<typeof import("./smtp-client").SmtpClient>;

  constructor(config: {
    imap: import("./imap-client").EmailConfig;
    smtp: import("./smtp-client").SmtpConfig;
  }) {
    const { ImapClient } = require("./imap-client");
    const { SmtpClient } = require("./smtp-client");

    this.imapClient = new ImapClient(config.imap);
    this.smtpClient = new SmtpClient(config.smtp);
  }

  /**
   * Connect to the email server
   */
  async connect(): Promise<void> {
    await this.imapClient.connect();
    await this.smtpClient.verify();
  }

  /**
   * Disconnect from the email server
   */
  async disconnect(): Promise<void> {
    await this.imapClient.disconnect();
    await this.smtpClient.close();
  }

  /**
   * Get the IMAP client for reading emails
   */
  get imap() {
    return this.imapClient;
  }

  /**
   * Get the SMTP client for sending emails
   */
  get smtp() {
    return this.smtpClient;
  }

  /**
   * Fetch recent emails
   */
  async fetchRecent(limit: number = 20): Promise<import("./imap-client").EmailMessage[]> {
    return this.imapClient.fetchEmails("INBOX", { limit });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    return this.imapClient.getUnreadCount();
  }

  /**
   * Send a simple text email
   */
  async sendText(
    to: string | string[],
    subject: string,
    text: string
  ): Promise<import("./smtp-client").SendResult> {
    return this.smtpClient.sendText(to, subject, text);
  }

  /**
   * Send an HTML email
   */
  async sendHtml(
    to: string | string[],
    subject: string,
    html: string,
    text?: string
  ): Promise<import("./smtp-client").SendResult> {
    return this.smtpClient.sendHtml(to, subject, html, text);
  }

  /**
   * Reply to an email
   */
  async reply(
    originalEmail: import("./imap-client").EmailMessage,
    options: import("./smtp-client").ReplyOptions
  ): Promise<import("./smtp-client").SendResult> {
    return this.smtpClient.reply(originalEmail, options);
  }

  /**
   * Search for emails
   */
  async search(
    options: import("./imap-client").SearchOptions
  ): Promise<import("./imap-client").EmailMessage[]> {
    return this.imapClient.searchEmails(options);
  }

  /**
   * Get inbox summary using AI
   */
  async getInboxSummary(): Promise<import("./inbox-summarizer").InboxSummary> {
    const { summarizeInbox } = await import("./inbox-summarizer");
    const emails = await this.fetchRecent(100);
    return summarizeInbox(emails);
  }

  /**
   * Get action items from recent emails
   */
  async getActionItems(): Promise<import("./inbox-summarizer").ActionItem[]> {
    const { extractActionItems, categorizeEmail } = await import("./inbox-summarizer");
    const emails = await this.fetchRecent(50);

    const allActions: import("./inbox-summarizer").ActionItem[] = [];

    for (const email of emails) {
      const category = await categorizeEmail(email);
      if (category.category === "action_required" || category.category === "urgent") {
        const actions = await extractActionItems(email);
        allActions.push(...actions);
      }
    }

    return allActions;
  }

  /**
   * Generate daily digest
   */
  async generateDigest(): Promise<string> {
    const { generateDailyDigest } = await import("./inbox-summarizer");
    const emails = await this.fetchRecent(100);
    return generateDailyDigest(emails);
  }
}

/**
 * Create an email client with common provider presets
 */
export function createEmailClient(
  provider: "gmail" | "outlook" | "yahoo" | "custom",
  credentials: { user: string; password: string },
  customConfig?: {
    imap?: Partial<import("./imap-client").EmailConfig>;
    smtp?: Partial<import("./smtp-client").SmtpConfig>;
  }
): EmailClient {
  const configs: Record<string, { imap: import("./imap-client").EmailConfig; smtp: import("./smtp-client").SmtpConfig }> = {
    gmail: {
      imap: {
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        user: credentials.user,
        password: credentials.password,
      },
      smtp: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: credentials.user, pass: credentials.password },
      },
    },
    outlook: {
      imap: {
        host: "outlook.office365.com",
        port: 993,
        secure: true,
        user: credentials.user,
        password: credentials.password,
      },
      smtp: {
        host: "smtp-mail.outlook.com",
        port: 587,
        secure: false,
        auth: { user: credentials.user, pass: credentials.password },
      },
    },
    yahoo: {
      imap: {
        host: "imap.mail.yahoo.com",
        port: 993,
        secure: true,
        user: credentials.user,
        password: credentials.password,
      },
      smtp: {
        host: "smtp.mail.yahoo.com",
        port: 465,
        secure: true,
        auth: { user: credentials.user, pass: credentials.password },
      },
    },
    custom: {
      imap: {
        host: customConfig?.imap?.host || "localhost",
        port: customConfig?.imap?.port || 993,
        secure: customConfig?.imap?.secure ?? true,
        user: credentials.user,
        password: credentials.password,
        ...customConfig?.imap,
      },
      smtp: {
        host: customConfig?.smtp?.host || "localhost",
        port: customConfig?.smtp?.port || 587,
        secure: customConfig?.smtp?.secure ?? false,
        auth: { user: credentials.user, pass: credentials.password },
        ...customConfig?.smtp,
      },
    },
  };

  return new EmailClient(configs[provider]);
}

export default {
  EmailClient,
  createEmailClient,
  // Re-export factory functions
  createImapClient: require("./imap-client").createImapClient,
  createSmtpClient: require("./smtp-client").createSmtpClient,
};
