import * as nodemailer from "nodemailer";
import type { Transporter, SendMailOptions } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Readable } from "stream";

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
  tls?: {
    rejectUnauthorized?: boolean;
  };
}

export interface EmailRecipient {
  name?: string;
  address: string;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string | Readable;
  contentType?: string;
  encoding?: string;
  cid?: string; // Content-ID for inline attachments
}

export interface SendEmailOptions {
  from?: string | EmailRecipient;
  to: string | EmailRecipient | (string | EmailRecipient)[];
  cc?: string | EmailRecipient | (string | EmailRecipient)[];
  bcc?: string | EmailRecipient | (string | EmailRecipient)[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string | EmailRecipient;
  inReplyTo?: string;
  references?: string | string[];
  headers?: Record<string, string>;
  priority?: "high" | "normal" | "low";
}

export interface ReplyOptions extends Omit<SendEmailOptions, "to" | "subject"> {
  subject?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  accepted: string[];
  rejected: string[];
  error?: string;
}

export class SmtpClient {
  private transporter: Transporter | null = null;
  private config: SmtpConfig;
  private defaultFrom: string;
  private verified: boolean = false;

  constructor(config: SmtpConfig, defaultFrom?: string) {
    this.config = config;
    this.defaultFrom = defaultFrom || config.auth.user;
  }

  /**
   * Initialize the SMTP transporter
   */
  private getTransporter(): Transporter {
    if (!this.transporter) {
      // Only include auth if credentials are actually provided
      const hasAuth = this.config.auth?.user && this.config.auth?.pass;

      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure ?? (this.config.port === 465),
        ...(hasAuth ? { auth: this.config.auth } : {}),
        tls: this.config.tls ?? {
          rejectUnauthorized: true,
        },
      } as SMTPTransport.Options);
    }
    return this.transporter;
  }

  /**
   * Verify SMTP connection
   */
  async verify(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      this.verified = true;
      return true;
    } catch (err) {
      console.error("SMTP verification failed:", err);
      this.verified = false;
      return false;
    }
  }

  /**
   * Format a recipient for nodemailer
   */
  private formatRecipient(recipient: string | EmailRecipient): string {
    if (typeof recipient === "string") {
      return recipient;
    }
    if (recipient.name) {
      return `"${recipient.name}" <${recipient.address}>`;
    }
    return recipient.address;
  }

  /**
   * Format recipients array
   */
  private formatRecipients(
    recipients: string | EmailRecipient | (string | EmailRecipient)[]
  ): string {
    if (Array.isArray(recipients)) {
      return recipients.map(r => this.formatRecipient(r)).join(", ");
    }
    return this.formatRecipient(recipients);
  }

  /**
   * Send an email
   */
  async send(options: SendEmailOptions): Promise<SendResult> {
    try {
      const transporter = this.getTransporter();

      // Build mail options
      const mailOptions: SendMailOptions = {
        from: options.from
          ? this.formatRecipient(options.from)
          : this.defaultFrom,
        to: this.formatRecipients(options.to),
        subject: options.subject,
      };

      // Add optional recipients
      if (options.cc) {
        mailOptions.cc = this.formatRecipients(options.cc);
      }
      if (options.bcc) {
        mailOptions.bcc = this.formatRecipients(options.bcc);
      }

      // Add content
      if (options.text) {
        mailOptions.text = options.text;
      }
      if (options.html) {
        mailOptions.html = options.html;
      }

      // If neither text nor html provided, use a default
      if (!options.text && !options.html) {
        mailOptions.text = "";
      }

      // Add reply headers for threading
      if (options.replyTo) {
        mailOptions.replyTo = this.formatRecipient(options.replyTo);
      }
      if (options.inReplyTo) {
        mailOptions.inReplyTo = options.inReplyTo;
      }
      if (options.references) {
        mailOptions.references = Array.isArray(options.references)
          ? options.references.join(" ")
          : options.references;
      }

      // Add custom headers
      if (options.headers) {
        mailOptions.headers = options.headers;
      }

      // Add priority
      if (options.priority) {
        const priorityMap = {
          high: "high",
          normal: "normal",
          low: "low",
        };
        mailOptions.priority = priorityMap[options.priority];
      }

      // Add attachments
      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          encoding: att.encoding as BufferEncoding | undefined,
          cid: att.cid,
        }));
      }

      // Send the email
      const result = await transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
        accepted: (result.accepted || []).map(a => String(a)),
        rejected: (result.rejected || []).map(r => String(r)),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        accepted: [],
        rejected: [],
        error,
      };
    }
  }

  /**
   * Send a simple text email
   */
  async sendText(
    to: string | string[],
    subject: string,
    text: string
  ): Promise<SendResult> {
    return this.send({
      to,
      subject,
      text,
    });
  }

  /**
   * Send an HTML email
   */
  async sendHtml(
    to: string | string[],
    subject: string,
    html: string,
    text?: string
  ): Promise<SendResult> {
    return this.send({
      to,
      subject,
      html,
      text: text || this.htmlToText(html),
    });
  }

  /**
   * Reply to an email (maintains threading)
   */
  async reply(
    originalEmail: {
      from: { address: string; name?: string }[];
      messageId: string;
      subject: string;
      references?: string[];
    },
    options: ReplyOptions
  ): Promise<SendResult> {
    // Build references chain
    const references: string[] = [];
    if (originalEmail.references) {
      references.push(...originalEmail.references);
    }
    if (originalEmail.messageId) {
      references.push(originalEmail.messageId);
    }

    // Build reply subject
    let subject = options.subject || originalEmail.subject;
    if (!subject.toLowerCase().startsWith("re:")) {
      subject = `Re: ${subject}`;
    }

    return this.send({
      ...options,
      to: originalEmail.from.map(f => ({
        name: f.name,
        address: f.address,
      })),
      subject,
      inReplyTo: originalEmail.messageId,
      references: references.length > 0 ? references : undefined,
    });
  }

  /**
   * Reply to all recipients
   */
  async replyAll(
    originalEmail: {
      from: { address: string; name?: string }[];
      to: { address: string; name?: string }[];
      cc?: { address: string; name?: string }[];
      messageId: string;
      subject: string;
      references?: string[];
    },
    options: ReplyOptions,
    excludeAddress?: string
  ): Promise<SendResult> {
    // Collect all recipients
    const allRecipients: EmailRecipient[] = [];
    const seenAddresses = new Set<string>();

    // Exclude sender's own address
    if (excludeAddress) {
      seenAddresses.add(excludeAddress.toLowerCase());
    }

    // Add original sender
    for (const addr of originalEmail.from) {
      const lower = addr.address.toLowerCase();
      if (!seenAddresses.has(lower)) {
        seenAddresses.add(lower);
        allRecipients.push({ name: addr.name, address: addr.address });
      }
    }

    // Collect CC recipients (original To minus self, and original CC)
    const ccRecipients: EmailRecipient[] = [];

    for (const addr of originalEmail.to) {
      const lower = addr.address.toLowerCase();
      if (!seenAddresses.has(lower)) {
        seenAddresses.add(lower);
        ccRecipients.push({ name: addr.name, address: addr.address });
      }
    }

    if (originalEmail.cc) {
      for (const addr of originalEmail.cc) {
        const lower = addr.address.toLowerCase();
        if (!seenAddresses.has(lower)) {
          seenAddresses.add(lower);
          ccRecipients.push({ name: addr.name, address: addr.address });
        }
      }
    }

    // Build references chain
    const references: string[] = [];
    if (originalEmail.references) {
      references.push(...originalEmail.references);
    }
    if (originalEmail.messageId) {
      references.push(originalEmail.messageId);
    }

    // Build reply subject
    let subject = options.subject || originalEmail.subject;
    if (!subject.toLowerCase().startsWith("re:")) {
      subject = `Re: ${subject}`;
    }

    return this.send({
      ...options,
      to: allRecipients,
      cc: ccRecipients.length > 0 ? ccRecipients : undefined,
      subject,
      inReplyTo: originalEmail.messageId,
      references: references.length > 0 ? references : undefined,
    });
  }

  /**
   * Forward an email
   */
  async forward(
    originalEmail: {
      from: { address: string; name?: string }[];
      subject: string;
      text?: string;
      html?: string;
      attachments?: EmailAttachment[];
    },
    to: string | EmailRecipient | (string | EmailRecipient)[],
    additionalText?: string
  ): Promise<SendResult> {
    // Build forward subject
    let subject = originalEmail.subject;
    if (!subject.toLowerCase().startsWith("fwd:")) {
      subject = `Fwd: ${subject}`;
    }

    // Build forwarded content
    const forwardHeader = `---------- Forwarded message ----------\nFrom: ${
      originalEmail.from.map(f => f.name ? `${f.name} <${f.address}>` : f.address).join(", ")
    }\nSubject: ${originalEmail.subject}\n\n`;

    let text = additionalText ? `${additionalText}\n\n` : "";
    text += forwardHeader;
    text += originalEmail.text || "";

    let html: string | undefined;
    if (originalEmail.html) {
      html = additionalText ? `<p>${additionalText}</p><hr>` : "<hr>";
      html += `<p><strong>---------- Forwarded message ----------</strong><br>`;
      html += `From: ${originalEmail.from.map(f => f.name ? `${f.name} &lt;${f.address}&gt;` : f.address).join(", ")}<br>`;
      html += `Subject: ${originalEmail.subject}</p>`;
      html += originalEmail.html;
    }

    return this.send({
      to,
      subject,
      text,
      html,
      attachments: originalEmail.attachments,
    });
  }

  /**
   * Send email with a template
   */
  async sendTemplate(
    to: string | EmailRecipient | (string | EmailRecipient)[],
    subject: string,
    template: string,
    variables: Record<string, string>
  ): Promise<SendResult> {
    // Simple variable replacement
    let html = template;
    let text = this.htmlToText(template);

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      html = html.replace(placeholder, value);
      text = text.replace(placeholder, value);
    }

    return this.send({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Close the transporter connection
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.verified = false;
    }
  }

  /**
   * Check if connection is verified
   */
  isVerified(): boolean {
    return this.verified;
  }

  /**
   * Simple HTML to text conversion
   */
  private htmlToText(html: string): string {
    return html
      // Remove style and script tags with their contents
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // Convert line breaks
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      // Convert links
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
      // Remove all remaining tags
      .replace(/<[^>]+>/g, "")
      // Decode HTML entities
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      // Clean up whitespace
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();
  }
}

// Factory function for common email providers
export function createSmtpClient(
  provider: "gmail" | "outlook" | "yahoo" | "custom",
  credentials: { user: string; password: string },
  customConfig?: Partial<SmtpConfig>
): SmtpClient {
  const configs: Record<string, SmtpConfig> = {
    gmail: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: credentials.user,
        pass: credentials.password,
      },
    },
    outlook: {
      host: "smtp-mail.outlook.com",
      port: 587,
      secure: false,
      auth: {
        user: credentials.user,
        pass: credentials.password,
      },
    },
    yahoo: {
      host: "smtp.mail.yahoo.com",
      port: 465,
      secure: true,
      auth: {
        user: credentials.user,
        pass: credentials.password,
      },
    },
    custom: {
      host: customConfig?.host || "localhost",
      port: customConfig?.port || 587,
      secure: customConfig?.secure ?? false,
      auth: {
        user: credentials.user,
        pass: credentials.password,
      },
      ...customConfig,
    },
  };

  return new SmtpClient(configs[provider], credentials.user);
}

export default SmtpClient;
