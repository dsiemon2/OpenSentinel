import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import * as realEnvModule from "../src/config/env";

// ============================================
// Email Routes — API Tests
// ============================================
// Tests the email API: folders, inbox, send, reply, search, flag.

// ---------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------

const mockFolders = [
  { name: "INBOX", path: "INBOX", specialUse: "\\Inbox" },
  { name: "Sent", path: "Sent", specialUse: "\\Sent" },
  { name: "Drafts", path: "Drafts", specialUse: "\\Drafts" },
  { name: "Trash", path: "Trash", specialUse: "\\Trash" },
];

const mockEmails = [
  {
    id: "1",
    uid: 101,
    messageId: "<msg-001@example.com>",
    subject: "Test Email 1",
    from: "sender@example.com",
    to: "user@example.com",
    cc: "",
    bcc: "",
    date: new Date("2026-03-01T10:00:00Z"),
    text: "Hello, this is test email 1",
    html: "<p>Hello, this is test email 1</p>",
    snippet: "Hello, this is test...",
    attachments: [],
    flags: ["\\Seen"],
    labels: [],
    threadId: null,
    inReplyTo: null,
    references: [],
    headers: new Map(),
  },
  {
    id: "2",
    uid: 102,
    messageId: "<msg-002@example.com>",
    subject: "Test Email 2",
    from: "other@example.com",
    to: "user@example.com",
    cc: "",
    bcc: "",
    date: new Date("2026-03-02T14:00:00Z"),
    text: "Second test email body",
    html: "<p>Second test email body</p>",
    snippet: "Second test email...",
    attachments: [],
    flags: [],
    labels: [],
    threadId: null,
    inReplyTo: null,
    references: [],
    headers: new Map(),
  },
];

let imapActions: string[] = [];
let smtpActions: string[] = [];

mock.module("../src/config/env", () => ({
  ...realEnvModule,
  env: {
    ...realEnvModule.env,
    EMAIL_MASTER_USER: "masteruser",
    EMAIL_MASTER_PASSWORD: "masterpass",
    EMAIL_LOCAL_IMAP_HOST: "127.0.0.1",
    EMAIL_LOCAL_IMAP_PORT: 11993,
    EMAIL_LOCAL_SMTP_HOST: "127.0.0.1",
    EMAIL_LOCAL_SMTP_PORT: 25,
    EMAIL_IMAP_HOST: "mail.example.com",
    EMAIL_IMAP_PORT: 993,
    EMAIL_USER: "",
    EMAIL_PASSWORD: "",
  },
}));

mock.module("../src/integrations/email/imap-client", () => ({
  ImapClient: class {
    constructor(_config: any) {}
    async connect() {}
    async disconnect() {}
    async listFolders() {
      return mockFolders;
    }
    async fetchEmails(_folder: string, _opts?: any) {
      return mockEmails;
    }
    async searchEmails(_opts: any) {
      return [mockEmails[0]];
    }
    async fetchEmail(uid: number, _folder: string) {
      return mockEmails.find((e) => e.uid === uid) || null;
    }
    async markAsRead(uid: number, folder: string) {
      imapActions.push(`read:${uid}:${folder}`);
    }
    async markAsUnread(uid: number, folder: string) {
      imapActions.push(`unread:${uid}:${folder}`);
    }
    async flagEmail(uid: number, folder: string) {
      imapActions.push(`flag:${uid}:${folder}`);
    }
    async unflagEmail(uid: number, folder: string) {
      imapActions.push(`unflag:${uid}:${folder}`);
    }
    async deleteEmail(uid: number, folder: string) {
      imapActions.push(`delete:${uid}:${folder}`);
    }
  },
}));

mock.module("../src/integrations/email/smtp-client", () => ({
  SmtpClient: class {
    constructor(_config: any, _from: string) {}
    async send(opts: any) {
      smtpActions.push(`send:${opts.to}:${opts.subject}`);
      return { messageId: "<sent-001@example.com>", success: true };
    }
    async reply(original: any, opts: any) {
      smtpActions.push(`reply:${original.uid}`);
      return { messageId: "<reply-001@example.com>", success: true };
    }
    async replyAll(original: any, opts: any, _from: string) {
      smtpActions.push(`replyAll:${original.uid}`);
      return { messageId: "<replyall-001@example.com>", success: true };
    }
  },
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const { emailRoutes } = await import("../src/inputs/api/routes/email");
  const testApp = new Hono();
  testApp.route("/api/email", emailRoutes);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("Email Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    imapActions = [];
    smtpActions = [];
  });

  describe("GET /api/email/folders", () => {
    test("should return 400 without email_address query param", async () => {
      const res = await req(app, "GET", "/api/email/folders");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("email_address");
    });

    test("should return folder list with email_address", async () => {
      const res = await req(app, "GET", "/api/email/folders?email_address=user@example.com");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBe(4);
      expect(json[0].name).toBe("INBOX");
    });
  });

  describe("GET /api/email/inbox", () => {
    test("should return 400 without email_address query param", async () => {
      const res = await req(app, "GET", "/api/email/inbox");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("email_address");
    });

    test("should return emails array with email_address", async () => {
      const res = await req(app, "GET", "/api/email/inbox?email_address=user@example.com");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("emails");
      expect(Array.isArray(json.emails)).toBe(true);
      expect(json.emails.length).toBe(2);
    });

    test("should include folder in response", async () => {
      const res = await req(app, "GET", "/api/email/inbox?email_address=user@example.com");
      const json = await res.json();

      expect(json.folder).toBe("INBOX");
    });
  });

  describe("POST /api/email/send", () => {
    test("should return 400 without required fields", async () => {
      const res = await req(app, "POST", "/api/email/send", {
        from: "user@example.com",
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 without from field", async () => {
      const res = await req(app, "POST", "/api/email/send", {
        to: "recipient@example.com",
        subject: "Hello",
      });
      expect(res.status).toBe(400);
    });

    test("should call smtp.send() and return result", async () => {
      const res = await req(app, "POST", "/api/email/send", {
        from: "user@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        text: "Hello World",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.messageId).toBeDefined();

      expect(smtpActions.length).toBe(1);
      expect(smtpActions[0]).toContain("send:");
      expect(smtpActions[0]).toContain("Test Subject");
    });
  });

  describe("POST /api/email/reply", () => {
    test("should return 400 without required fields", async () => {
      const res = await req(app, "POST", "/api/email/reply", {
        email_address: "user@example.com",
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 without email_address", async () => {
      const res = await req(app, "POST", "/api/email/reply", {
        email_uid: 101,
        body: "Reply text",
      });
      expect(res.status).toBe(400);
    });

    test("should return 400 without body", async () => {
      const res = await req(app, "POST", "/api/email/reply", {
        email_address: "user@example.com",
        email_uid: 101,
      });
      expect(res.status).toBe(400);
    });

    test("should call smtp.reply() for single reply", async () => {
      const res = await req(app, "POST", "/api/email/reply", {
        email_address: "user@example.com",
        email_uid: 101,
        body: "Thanks for your email!",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(smtpActions.length).toBe(1);
      expect(smtpActions[0]).toBe("reply:101");
    });
  });

  describe("POST /api/email/search", () => {
    test("should return 400 without email_address", async () => {
      const res = await req(app, "POST", "/api/email/search", {
        subject: "test",
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("email_address");
    });

    test("should return search results with email_address", async () => {
      const res = await req(app, "POST", "/api/email/search", {
        email_address: "user@example.com",
        subject: "Test",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toHaveProperty("emails");
      expect(Array.isArray(json.emails)).toBe(true);
    });
  });

  describe("POST /api/email/flag", () => {
    test("should return 400 without required fields", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
      });
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 without action", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
        uid: 101,
      });
      expect(res.status).toBe(400);
    });

    test("should perform read action", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
        uid: 101,
        action: "read",
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(imapActions).toContain("read:101:INBOX");
    });

    test("should perform unread action", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
        uid: 102,
        action: "unread",
      });
      expect(res.status).toBe(200);
      expect(imapActions).toContain("unread:102:INBOX");
    });

    test("should perform flag action", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
        uid: 101,
        action: "flag",
      });
      expect(res.status).toBe(200);
      expect(imapActions).toContain("flag:101:INBOX");
    });

    test("should perform unflag action", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
        uid: 101,
        action: "unflag",
      });
      expect(res.status).toBe(200);
      expect(imapActions).toContain("unflag:101:INBOX");
    });

    test("should perform delete action", async () => {
      const res = await req(app, "POST", "/api/email/flag", {
        email_address: "user@example.com",
        uid: 101,
        action: "delete",
      });
      expect(res.status).toBe(200);
      expect(imapActions).toContain("delete:101:INBOX");
    });
  });
});
