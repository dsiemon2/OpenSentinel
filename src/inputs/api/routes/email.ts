/**
 * Email API Routes
 *
 * Provides REST endpoints for reading, sending, searching, and managing emails
 * via IMAP and SMTP. Supports Dovecot master-user auth and direct credential auth.
 */

import { Hono } from "hono";
import { env } from "../../../config/env";
import {
  ImapClient,
  type EmailMessage,
  type EmailAttachment,
} from "../../../integrations/email/imap-client";
import { SmtpClient } from "../../../integrations/email/smtp-client";

const email = new Hono();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createImapClient(emailAddress: string): ImapClient {
  if (env.EMAIL_MASTER_USER && env.EMAIL_MASTER_PASSWORD) {
    return new ImapClient({
      host: env.EMAIL_LOCAL_IMAP_HOST || "127.0.0.1",
      port: env.EMAIL_LOCAL_IMAP_PORT || 993,
      secure: true,
      user: `${emailAddress}*${env.EMAIL_MASTER_USER}`,
      password: env.EMAIL_MASTER_PASSWORD,
      tls: { rejectUnauthorized: false },
    });
  } else if (env.EMAIL_USER && env.EMAIL_PASSWORD) {
    return new ImapClient({
      host: env.EMAIL_IMAP_HOST || "imap.gmail.com",
      port: env.EMAIL_IMAP_PORT || 993,
      secure: env.EMAIL_IMAP_SECURE !== false,
      user: env.EMAIL_USER,
      password: env.EMAIL_PASSWORD,
    });
  }
  throw new Error("Email not configured");
}

function createSmtpClient(fromAddress: string): SmtpClient {
  if (env.EMAIL_MASTER_USER) {
    return new SmtpClient(
      {
        host: env.EMAIL_LOCAL_SMTP_HOST || "127.0.0.1",
        port: env.EMAIL_LOCAL_SMTP_PORT || 25,
        secure: false,
        auth: { user: "", pass: "" },
        tls: { rejectUnauthorized: false },
      },
      fromAddress
    );
  } else if (env.EMAIL_USER && env.EMAIL_PASSWORD) {
    return new SmtpClient(
      {
        host: env.EMAIL_SMTP_HOST || "smtp.gmail.com",
        port: env.EMAIL_SMTP_PORT || 587,
        secure: env.EMAIL_SMTP_SECURE === true,
        auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD },
      },
      fromAddress
    );
  }
  throw new Error("Email not configured");
}

function serializeEmail(email: EmailMessage, includeBody: boolean): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    id: email.id,
    uid: email.uid,
    messageId: email.messageId,
    subject: email.subject,
    from: email.from,
    to: email.to,
    cc: email.cc,
    bcc: email.bcc,
    date: email.date.toISOString(),
    text: includeBody ? email.text : email.snippet,
    html: includeBody ? email.html : "",
    snippet: email.snippet,
    attachments: email.attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: a.size,
      contentId: a.contentId,
      hasContent: !!a.content,
    })),
    flags: email.flags,
    labels: email.labels,
    threadId: email.threadId,
    inReplyTo: email.inReplyTo,
    references: email.references,
    headers: Object.fromEntries(email.headers),
  };

  return serialized;
}

// ---------------------------------------------------------------------------
// Middleware — gate every route behind email config check
// ---------------------------------------------------------------------------

email.use("*", async (c, next) => {
  if (!env.EMAIL_MASTER_USER && !env.EMAIL_USER) {
    return c.json(
      { error: "Email not configured. Set EMAIL_MASTER_USER or EMAIL_USER in .env" },
      503
    );
  }
  await next();
});

// ---------------------------------------------------------------------------
// GET /folders — list all mail folders
// ---------------------------------------------------------------------------

email.get("/folders", async (c) => {
  const emailAddress = c.req.query("email_address");
  if (!emailAddress) {
    return c.json({ error: "Query parameter 'email_address' is required" }, 400);
  }

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(emailAddress);
    await imap.connect();
    const folders = await imap.listFolders();
    return c.json(folders);
  } catch (error) {
    console.error("[Email API] /folders error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to list folders" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// GET /inbox — list emails in a folder
// ---------------------------------------------------------------------------

email.get("/inbox", async (c) => {
  const emailAddress = c.req.query("email_address");
  if (!emailAddress) {
    return c.json({ error: "Query parameter 'email_address' is required" }, 400);
  }

  const folder = c.req.query("folder") || "INBOX";
  const limit = c.req.query("limit") || "20";
  const offset = c.req.query("offset") || "0";
  const unreadOnly = c.req.query("unread_only") === "true";

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(emailAddress);
    await imap.connect();

    let emails: EmailMessage[];
    if (unreadOnly) {
      emails = await imap.searchEmails({
        folder,
        seen: false,
        limit: parseInt(limit),
      });
    } else {
      emails = await imap.fetchEmails(folder, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });
    }

    return c.json({
      emails: emails.map((e) => serializeEmail(e, false)),
      folder,
    });
  } catch (error) {
    console.error("[Email API] /inbox error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to fetch emails" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// GET /message/:uid — fetch a single email by UID
// ---------------------------------------------------------------------------

email.get("/message/:uid", async (c) => {
  const emailAddress = c.req.query("email_address");
  if (!emailAddress) {
    return c.json({ error: "Query parameter 'email_address' is required" }, 400);
  }

  const uid = parseInt(c.req.param("uid"));
  const folder = c.req.query("folder") || "INBOX";

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(emailAddress);
    await imap.connect();

    const emailMsg = await imap.fetchEmail(uid, folder);
    if (!emailMsg) {
      return c.json({ error: "Email not found" }, 404);
    }

    await imap.markAsRead(uid, folder);

    return c.json(serializeEmail(emailMsg, true));
  } catch (error) {
    console.error("[Email API] /message/:uid error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to fetch email" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// GET /attachment/:uid/:index — download an attachment
// ---------------------------------------------------------------------------

email.get("/attachment/:uid/:index", async (c) => {
  const emailAddress = c.req.query("email_address");
  if (!emailAddress) {
    return c.json({ error: "Query parameter 'email_address' is required" }, 400);
  }

  const uid = parseInt(c.req.param("uid"));
  const index = parseInt(c.req.param("index"));
  const folder = c.req.query("folder") || "INBOX";

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(emailAddress);
    await imap.connect();

    const emailMsg = await imap.fetchEmail(uid, folder);
    if (!emailMsg) {
      return c.json({ error: "Email not found" }, 404);
    }

    const attachment = emailMsg.attachments[index];
    if (!attachment) {
      return c.json({ error: "Attachment not found" }, 404);
    }

    if (!attachment.content) {
      return c.json({ error: "Attachment content not available" }, 404);
    }

    return new Response(attachment.content, {
      headers: {
        "Content-Type": attachment.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${attachment.filename}"`,
        "Content-Length": String(attachment.size || attachment.content.length),
      },
    });
  } catch (error) {
    console.error("[Email API] /attachment/:uid/:index error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to fetch attachment" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// POST /send — send a new email
// ---------------------------------------------------------------------------

email.post("/send", async (c) => {
  try {
    const body = await c.req.json<{
      from: string;
      to: string | string[];
      cc?: string | string[];
      bcc?: string | string[];
      subject: string;
      text?: string;
      html?: string;
      attachments?: { filename: string; content: string; contentType: string }[];
    }>();

    if (!body.from || !body.to || !body.subject) {
      return c.json({ error: "Fields 'from', 'to', and 'subject' are required" }, 400);
    }

    const smtp = createSmtpClient(body.from);

    const convertedAttachments = body.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: Buffer.from(a.content, "base64").length,
      content: Buffer.from(a.content, "base64"),
    }));

    const result = await smtp.send({
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      text: body.text,
      html: body.html,
      attachments: convertedAttachments,
    });

    return c.json(result);
  } catch (error) {
    console.error("[Email API] /send error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to send email" },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /reply — reply to an existing email
// ---------------------------------------------------------------------------

email.post("/reply", async (c) => {
  const body = await c.req.json<{
    email_address: string;
    email_uid: number;
    folder?: string;
    body: string;
    html?: string;
    reply_all?: boolean;
    attachments?: { filename: string; content: string; contentType: string }[];
  }>();

  if (!body.email_address || !body.email_uid || !body.body) {
    return c.json(
      { error: "Fields 'email_address', 'email_uid', and 'body' are required" },
      400
    );
  }

  const folder = body.folder || "INBOX";

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(body.email_address);
    await imap.connect();

    const originalEmail = await imap.fetchEmail(body.email_uid, folder);
    if (!originalEmail) {
      return c.json({ error: "Original email not found" }, 404);
    }

    const smtp = createSmtpClient(body.email_address);

    const convertedAttachments = body.attachments?.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      size: Buffer.from(a.content, "base64").length,
      content: Buffer.from(a.content, "base64"),
    }));

    let result;
    if (body.reply_all) {
      result = await smtp.replyAll(
        originalEmail,
        { text: body.body, html: body.html, attachments: convertedAttachments },
        body.email_address
      );
    } else {
      result = await smtp.reply(originalEmail, {
        text: body.body,
        html: body.html,
        attachments: convertedAttachments,
      });
    }

    return c.json(result);
  } catch (error) {
    console.error("[Email API] /reply error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to send reply" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// POST /search — search emails
// ---------------------------------------------------------------------------

email.post("/search", async (c) => {
  const body = await c.req.json<{
    email_address: string;
    from?: string;
    to?: string;
    subject?: string;
    body?: string;
    since?: string;
    before?: string;
    unread_only?: boolean;
    folder?: string;
    limit?: number;
  }>();

  if (!body.email_address) {
    return c.json({ error: "Field 'email_address' is required" }, 400);
  }

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(body.email_address);
    await imap.connect();

    const searchOptions = {
      folder: body.folder || "INBOX",
      from: body.from,
      to: body.to,
      subject: body.subject,
      body: body.body,
      since: body.since ? new Date(body.since) : undefined,
      before: body.before ? new Date(body.before) : undefined,
      seen: body.unread_only ? false : undefined,
      limit: body.limit,
    };

    const emails = await imap.searchEmails(searchOptions);

    return c.json({
      emails: emails.map((e) => serializeEmail(e, false)),
    });
  } catch (error) {
    console.error("[Email API] /search error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

// ---------------------------------------------------------------------------
// POST /flag — flag/unflag/read/unread/delete an email
// ---------------------------------------------------------------------------

email.post("/flag", async (c) => {
  const body = await c.req.json<{
    email_address: string;
    uid: number;
    folder?: string;
    action: "read" | "unread" | "flag" | "unflag" | "delete";
  }>();

  if (!body.email_address || !body.uid || !body.action) {
    return c.json(
      { error: "Fields 'email_address', 'uid', and 'action' are required" },
      400
    );
  }

  const folder = body.folder || "INBOX";

  let imap: ImapClient | null = null;
  try {
    imap = createImapClient(body.email_address);
    await imap.connect();

    switch (body.action) {
      case "read":
        await imap.markAsRead(body.uid, folder);
        break;
      case "unread":
        await imap.markAsUnread(body.uid, folder);
        break;
      case "flag":
        await imap.flagEmail(body.uid, folder);
        break;
      case "unflag":
        await imap.unflagEmail(body.uid, folder);
        break;
      case "delete":
        await imap.deleteEmail(body.uid, folder);
        break;
      default:
        return c.json({ error: `Unknown action: ${body.action}` }, 400);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("[Email API] /flag error:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to perform action" },
      500
    );
  } finally {
    if (imap) {
      await imap.disconnect().catch(() => {});
    }
  }
});

export { email as emailRoutes };
