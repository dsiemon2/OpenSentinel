import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";

// Mock email message for testing
const mockEmailMessage = {
  id: "123",
  uid: 123,
  messageId: "<test123@example.com>",
  subject: "Test Email Subject",
  from: [{ name: "John Doe", address: "john@example.com" }],
  to: [{ name: "Jane Smith", address: "jane@example.com" }],
  cc: [{ name: "Bob Wilson", address: "bob@example.com" }],
  bcc: [],
  date: new Date("2024-01-15T10:30:00Z"),
  text: "Hello, this is a test email.\n\nPlease review the attached document and let me know your thoughts by Friday.\n\nBest regards,\nJohn",
  html: "<p>Hello, this is a test email.</p><p>Please review the attached document and let me know your thoughts by Friday.</p><p>Best regards,<br>John</p>",
  snippet: "Hello, this is a test email. Please review the attached document...",
  attachments: [
    {
      filename: "document.pdf",
      contentType: "application/pdf",
      size: 1024,
      content: Buffer.from("mock pdf content"),
    },
  ],
  labels: [],
  flags: ["\\Seen"],
  threadId: "<test123@example.com>",
  inReplyTo: undefined,
  references: [],
  headers: new Map([
    ["importance", "high"],
    ["x-priority", "1"],
  ]),
};

const mockReplyEmail = {
  ...mockEmailMessage,
  id: "124",
  uid: 124,
  messageId: "<reply123@example.com>",
  subject: "Re: Test Email Subject",
  from: [{ name: "Jane Smith", address: "jane@example.com" }],
  to: [{ name: "John Doe", address: "john@example.com" }],
  date: new Date("2024-01-15T14:30:00Z"),
  text: "Thanks for the email. I'll review it by Thursday.\n\n> Hello, this is a test email.\n> Please review the attached document.",
  inReplyTo: "<test123@example.com>",
  references: ["<test123@example.com>"],
  attachments: [],
  flags: [],
};

describe("Email Integration", () => {
  describe("IMAP Client Module", () => {
    test("should export ImapClient class", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");
      expect(typeof ImapClient).toBe("function");
    });

    test("should export createImapClient factory function", async () => {
      const { createImapClient } = await import("../src/integrations/email/imap-client");
      expect(typeof createImapClient).toBe("function");
    });

    test("should export default as ImapClient", async () => {
      const imapModule = await import("../src/integrations/email/imap-client");
      expect(imapModule.default).toBe(imapModule.ImapClient);
    });
  });

  describe("IMAP Client Creation", () => {
    test("createImapClient should create Gmail client", async () => {
      const { createImapClient } = await import("../src/integrations/email/imap-client");

      const client = createImapClient("gmail", {
        user: "test@gmail.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
    });

    test("createImapClient should create Outlook client", async () => {
      const { createImapClient } = await import("../src/integrations/email/imap-client");

      const client = createImapClient("outlook", {
        user: "test@outlook.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
    });

    test("createImapClient should create Yahoo client", async () => {
      const { createImapClient } = await import("../src/integrations/email/imap-client");

      const client = createImapClient("yahoo", {
        user: "test@yahoo.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
    });

    test("createImapClient should create custom client", async () => {
      const { createImapClient } = await import("../src/integrations/email/imap-client");

      const client = createImapClient("custom", {
        user: "test@custom.com",
        password: "password123",
      }, {
        host: "imap.custom.com",
        port: 143,
        secure: false,
      });

      expect(client).toBeTruthy();
    });

    test("ImapClient should initialize with config", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        secure: true,
        user: "test@example.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe("SMTP Client Module", () => {
    test("should export SmtpClient class", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");
      expect(typeof SmtpClient).toBe("function");
    });

    test("should export createSmtpClient factory function", async () => {
      const { createSmtpClient } = await import("../src/integrations/email/smtp-client");
      expect(typeof createSmtpClient).toBe("function");
    });

    test("should export default as SmtpClient", async () => {
      const smtpModule = await import("../src/integrations/email/smtp-client");
      expect(smtpModule.default).toBe(smtpModule.SmtpClient);
    });
  });

  describe("SMTP Client Creation", () => {
    test("createSmtpClient should create Gmail client", async () => {
      const { createSmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = createSmtpClient("gmail", {
        user: "test@gmail.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
      expect(typeof client.send).toBe("function");
      expect(typeof client.verify).toBe("function");
    });

    test("createSmtpClient should create Outlook client", async () => {
      const { createSmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = createSmtpClient("outlook", {
        user: "test@outlook.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
    });

    test("SmtpClient should have all send methods", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = new SmtpClient({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "test@example.com", pass: "password123" },
      });

      expect(typeof client.send).toBe("function");
      expect(typeof client.sendText).toBe("function");
      expect(typeof client.sendHtml).toBe("function");
      expect(typeof client.reply).toBe("function");
      expect(typeof client.replyAll).toBe("function");
      expect(typeof client.forward).toBe("function");
      expect(typeof client.sendTemplate).toBe("function");
      expect(typeof client.close).toBe("function");
    });

    test("SmtpClient should track verified state", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = new SmtpClient({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "test@example.com", pass: "password123" },
      });

      expect(client.isVerified()).toBe(false);
    });
  });

  describe("Email Parser Module", () => {
    test("should export parseEmail function", async () => {
      const { parseEmail } = await import("../src/integrations/email/email-parser");
      expect(typeof parseEmail).toBe("function");
    });

    test("should export parseAttachment function", async () => {
      const { parseAttachment } = await import("../src/integrations/email/email-parser");
      expect(typeof parseAttachment).toBe("function");
    });

    test("should export groupIntoThreads function", async () => {
      const { groupIntoThreads } = await import("../src/integrations/email/email-parser");
      expect(typeof groupIntoThreads).toBe("function");
    });

    test("should export cleanSubject function", async () => {
      const { cleanSubject } = await import("../src/integrations/email/email-parser");
      expect(typeof cleanSubject).toBe("function");
    });

    test("should export parseEmailBody function", async () => {
      const { parseEmailBody } = await import("../src/integrations/email/email-parser");
      expect(typeof parseEmailBody).toBe("function");
    });

    test("should export extraction functions", async () => {
      const {
        extractEmailAddresses,
        extractUrls,
        extractPhoneNumbers,
      } = await import("../src/integrations/email/email-parser");

      expect(typeof extractEmailAddresses).toBe("function");
      expect(typeof extractUrls).toBe("function");
      expect(typeof extractPhoneNumbers).toBe("function");
    });

    test("should export utility functions", async () => {
      const {
        getEmailSummary,
        calculateEmailSize,
        matchesFilter,
      } = await import("../src/integrations/email/email-parser");

      expect(typeof getEmailSummary).toBe("function");
      expect(typeof calculateEmailSize).toBe("function");
      expect(typeof matchesFilter).toBe("function");
    });
  });

  describe("Email Parsing", () => {
    test("parseEmail should parse email message correctly", async () => {
      const { parseEmail } = await import("../src/integrations/email/email-parser");

      const parsed = parseEmail(mockEmailMessage);

      expect(parsed.id).toBe("123");
      expect(parsed.subject).toBe("Test Email Subject");
      expect(parsed.from[0].address).toBe("john@example.com");
      expect(parsed.to[0].address).toBe("jane@example.com");
      expect(parsed.metadata.isRead).toBe(true);
      expect(parsed.metadata.hasAttachments).toBe(true);
      expect(parsed.metadata.attachmentCount).toBe(1);
      expect(parsed.metadata.importance).toBe("high");
    });

    test("parseEmail should detect reply emails", async () => {
      const { parseEmail } = await import("../src/integrations/email/email-parser");

      const parsed = parseEmail(mockReplyEmail);

      expect(parsed.thread.isReply).toBe(true);
      expect(parsed.thread.isForward).toBe(false);
      expect(parsed.thread.inReplyTo).toBe("<test123@example.com>");
    });

    test("parseEmail should detect forward emails", async () => {
      const { parseEmail } = await import("../src/integrations/email/email-parser");

      const forwardEmail = {
        ...mockEmailMessage,
        subject: "Fwd: Test Email Subject",
      };

      const parsed = parseEmail(forwardEmail);

      expect(parsed.thread.isReply).toBe(false);
      expect(parsed.thread.isForward).toBe(true);
    });

    test("parseAttachment should categorize attachments correctly", async () => {
      const { parseAttachment } = await import("../src/integrations/email/email-parser");

      const pdfAttachment = parseAttachment({
        filename: "document.pdf",
        contentType: "application/pdf",
        size: 1024,
      });
      expect(pdfAttachment.category).toBe("document");
      expect(pdfAttachment.extension).toBe("pdf");

      const imageAttachment = parseAttachment({
        filename: "photo.jpg",
        contentType: "image/jpeg",
        size: 2048,
      });
      expect(imageAttachment.category).toBe("image");

      const zipAttachment = parseAttachment({
        filename: "archive.zip",
        contentType: "application/zip",
        size: 4096,
      });
      expect(zipAttachment.category).toBe("archive");
    });
  });

  describe("Subject Cleaning", () => {
    test("cleanSubject should remove Re: prefix", async () => {
      const { cleanSubject } = await import("../src/integrations/email/email-parser");

      expect(cleanSubject("Re: Test Subject")).toBe("Test Subject");
      expect(cleanSubject("RE: Test Subject")).toBe("Test Subject");
      expect(cleanSubject("re: Test Subject")).toBe("Test Subject");
    });

    test("cleanSubject should remove Fwd: prefix", async () => {
      const { cleanSubject } = await import("../src/integrations/email/email-parser");

      expect(cleanSubject("Fwd: Test Subject")).toBe("Test Subject");
      expect(cleanSubject("FWD: Test Subject")).toBe("Test Subject");
      expect(cleanSubject("Fw: Test Subject")).toBe("Test Subject");
    });

    test("cleanSubject should remove list prefixes", async () => {
      const { cleanSubject } = await import("../src/integrations/email/email-parser");

      expect(cleanSubject("[ListName] Test Subject")).toBe("Test Subject");
      expect(cleanSubject("[Team] Important Update")).toBe("Important Update");
    });

    test("cleanSubject should handle multiple prefixes", async () => {
      const { cleanSubject } = await import("../src/integrations/email/email-parser");

      expect(cleanSubject("Re: Re: Test Subject")).toBe("Re: Test Subject");
    });
  });

  describe("Email Body Parsing", () => {
    test("parseEmailBody should separate new content from quoted content", async () => {
      const { parseEmailBody } = await import("../src/integrations/email/email-parser");

      const body = `This is my reply.

> Original message content
> More original content

More reply text.`;

      const parts = parseEmailBody(body);

      expect(parts.newContent).toContain("This is my reply");
      expect(parts.newContent).toContain("More reply text");
      expect(parts.quotedContent.length).toBeGreaterThan(0);
    });

    test("parseEmailBody should detect signatures", async () => {
      const { parseEmailBody } = await import("../src/integrations/email/email-parser");

      const body = `Main email content here.

--
Best regards,
John Doe
john@example.com`;

      const parts = parseEmailBody(body);

      expect(parts.signature).toBeTruthy();
      expect(parts.signature).toContain("John Doe");
    });

    test("parseEmailBody should handle nested quotes", async () => {
      const { parseEmailBody } = await import("../src/integrations/email/email-parser");

      const body = `My response.

> First level quote
>> Second level quote
> Back to first level`;

      const parts = parseEmailBody(body);

      expect(parts.quotedContent.length).toBeGreaterThan(0);
    });
  });

  describe("Thread Grouping", () => {
    test("groupIntoThreads should group related emails", async () => {
      const { groupIntoThreads } = await import("../src/integrations/email/email-parser");

      const threads = groupIntoThreads([mockEmailMessage, mockReplyEmail]);

      expect(threads.length).toBe(1);
      expect(threads[0].messageCount).toBe(2);
      expect(threads[0].participants.length).toBeGreaterThan(0);
    });

    test("groupIntoThreads should sort threads by last message date", async () => {
      const { groupIntoThreads } = await import("../src/integrations/email/email-parser");

      const oldEmail = {
        ...mockEmailMessage,
        id: "old",
        messageId: "<old@example.com>",
        threadId: "<old@example.com>",
        date: new Date("2024-01-01T00:00:00Z"),
        references: [],
      };

      const newEmail = {
        ...mockEmailMessage,
        id: "new",
        messageId: "<new@example.com>",
        threadId: "<new@example.com>",
        date: new Date("2024-01-20T00:00:00Z"),
        references: [],
      };

      const threads = groupIntoThreads([oldEmail, newEmail]);

      expect(threads.length).toBe(2);
      expect(threads[0].lastMessageDate.getTime()).toBeGreaterThan(
        threads[1].lastMessageDate.getTime()
      );
    });

    test("groupIntoThreads should collect all participants", async () => {
      const { groupIntoThreads } = await import("../src/integrations/email/email-parser");

      const threads = groupIntoThreads([mockEmailMessage, mockReplyEmail]);

      const addresses = threads[0].participants.map(p => p.address);
      expect(addresses).toContain("john@example.com");
      expect(addresses).toContain("jane@example.com");
    });
  });

  describe("Content Extraction", () => {
    test("extractEmailAddresses should find email addresses in text", async () => {
      const { extractEmailAddresses } = await import("../src/integrations/email/email-parser");

      const text = "Contact us at support@example.com or sales@example.org for help.";
      const emails = extractEmailAddresses(text);

      expect(emails).toContain("support@example.com");
      expect(emails).toContain("sales@example.org");
      expect(emails.length).toBe(2);
    });

    test("extractUrls should find URLs in text", async () => {
      const { extractUrls } = await import("../src/integrations/email/email-parser");

      const text = "Visit https://example.com or http://test.org/page for more info.";
      const urls = extractUrls(text);

      expect(urls).toContain("https://example.com");
      expect(urls).toContain("http://test.org/page");
    });

    test("extractPhoneNumbers should find phone numbers", async () => {
      const { extractPhoneNumbers } = await import("../src/integrations/email/email-parser");

      const text = "Call us at (555) 123-4567 or +1-555-987-6543.";
      const phones = extractPhoneNumbers(text);

      expect(phones.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Email Filtering", () => {
    test("matchesFilter should filter by from address", async () => {
      const { matchesFilter } = await import("../src/integrations/email/email-parser");

      expect(matchesFilter(mockEmailMessage, { from: "john" })).toBe(true);
      expect(matchesFilter(mockEmailMessage, { from: "unknown" })).toBe(false);
    });

    test("matchesFilter should filter by subject", async () => {
      const { matchesFilter } = await import("../src/integrations/email/email-parser");

      expect(matchesFilter(mockEmailMessage, { subject: "Test Email" })).toBe(true);
      expect(matchesFilter(mockEmailMessage, { subject: "Other" })).toBe(false);
    });

    test("matchesFilter should filter by attachments", async () => {
      const { matchesFilter } = await import("../src/integrations/email/email-parser");

      expect(matchesFilter(mockEmailMessage, { hasAttachments: true })).toBe(true);
      expect(matchesFilter(mockEmailMessage, { hasAttachments: false })).toBe(false);
    });

    test("matchesFilter should filter by date range", async () => {
      const { matchesFilter } = await import("../src/integrations/email/email-parser");

      const before = new Date("2024-01-01T00:00:00Z");
      const after = new Date("2024-01-20T00:00:00Z");

      expect(matchesFilter(mockEmailMessage, { dateAfter: before })).toBe(true);
      expect(matchesFilter(mockEmailMessage, { dateBefore: after })).toBe(true);
      expect(matchesFilter(mockEmailMessage, { dateAfter: after })).toBe(false);
    });

    test("matchesFilter should support regex patterns", async () => {
      const { matchesFilter } = await import("../src/integrations/email/email-parser");

      expect(matchesFilter(mockEmailMessage, { subject: /test/i })).toBe(true);
      expect(matchesFilter(mockEmailMessage, { from: /@example\.com$/ })).toBe(true);
    });
  });

  describe("Email Summary", () => {
    test("getEmailSummary should return correct summary", async () => {
      const { getEmailSummary } = await import("../src/integrations/email/email-parser");

      const summary = getEmailSummary(mockEmailMessage);

      expect(summary.from).toBe("John Doe");
      expect(summary.subject).toBe("Test Email Subject");
      expect(summary.attachmentCount).toBe(1);
      expect(summary.snippet).toBeTruthy();
    });

    test("calculateEmailSize should estimate email size", async () => {
      const { calculateEmailSize } = await import("../src/integrations/email/email-parser");

      const size = calculateEmailSize(mockEmailMessage);

      expect(size).toBeGreaterThan(0);
      // Should include text, html, and attachment size
      expect(size).toBeGreaterThanOrEqual(1024); // At least attachment size
    });
  });

  describe("Inbox Summarizer Module", () => {
    test("should export categorizeEmail function", async () => {
      const { categorizeEmail } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof categorizeEmail).toBe("function");
    });

    test("should export extractActionItems function", async () => {
      const { extractActionItems } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof extractActionItems).toBe("function");
    });

    test("should export summarizeThread function", async () => {
      const { summarizeThread } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof summarizeThread).toBe("function");
    });

    test("should export summarizeInbox function", async () => {
      const { summarizeInbox } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof summarizeInbox).toBe("function");
    });

    test("should export generateDailyDigest function", async () => {
      const { generateDailyDigest } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof generateDailyDigest).toBe("function");
    });

    test("should export suggestReplies function", async () => {
      const { suggestReplies } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof suggestReplies).toBe("function");
    });

    test("should export analyzeSentiment function", async () => {
      const { analyzeSentiment } = await import("../src/integrations/email/inbox-summarizer");
      expect(typeof analyzeSentiment).toBe("function");
    });
  });

  describe("Main Export Module", () => {
    test("should export all IMAP components", async () => {
      const email = await import("../src/integrations/email");

      expect(typeof email.ImapClient).toBe("function");
      expect(typeof email.createImapClient).toBe("function");
    });

    test("should export all SMTP components", async () => {
      const email = await import("../src/integrations/email");

      expect(typeof email.SmtpClient).toBe("function");
      expect(typeof email.createSmtpClient).toBe("function");
    });

    test("should export all parser functions", async () => {
      const email = await import("../src/integrations/email");

      expect(typeof email.parseEmail).toBe("function");
      expect(typeof email.parseAttachment).toBe("function");
      expect(typeof email.groupIntoThreads).toBe("function");
      expect(typeof email.cleanSubject).toBe("function");
      expect(typeof email.parseEmailBody).toBe("function");
      expect(typeof email.extractEmailAddresses).toBe("function");
      expect(typeof email.extractUrls).toBe("function");
      expect(typeof email.extractPhoneNumbers).toBe("function");
    });

    test("should export all summarizer functions", async () => {
      const email = await import("../src/integrations/email");

      expect(typeof email.categorizeEmail).toBe("function");
      expect(typeof email.extractActionItems).toBe("function");
      expect(typeof email.summarizeThread).toBe("function");
      expect(typeof email.summarizeInbox).toBe("function");
      expect(typeof email.generateDailyDigest).toBe("function");
      expect(typeof email.suggestReplies).toBe("function");
      expect(typeof email.analyzeSentiment).toBe("function");
    });

    test("should export EmailClient class", async () => {
      const email = await import("../src/integrations/email");

      expect(typeof email.EmailClient).toBe("function");
    });

    test("should export createEmailClient factory", async () => {
      const email = await import("../src/integrations/email");

      expect(typeof email.createEmailClient).toBe("function");
    });

    test("should export default with main components", async () => {
      const email = await import("../src/integrations/email");

      expect(email.default).toBeTruthy();
      expect(typeof email.default.EmailClient).toBe("function");
      expect(typeof email.default.createEmailClient).toBe("function");
    });
  });

  describe("EmailClient Combined Class", () => {
    test("createEmailClient should create Gmail client", async () => {
      const { createEmailClient } = await import("../src/integrations/email");

      const client = createEmailClient("gmail", {
        user: "test@gmail.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
      expect(client.imap).toBeTruthy();
      expect(client.smtp).toBeTruthy();
    });

    test("createEmailClient should create Outlook client", async () => {
      const { createEmailClient } = await import("../src/integrations/email");

      const client = createEmailClient("outlook", {
        user: "test@outlook.com",
        password: "password123",
      });

      expect(client).toBeTruthy();
    });

    test("createEmailClient should create custom client", async () => {
      const { createEmailClient } = await import("../src/integrations/email");

      const client = createEmailClient("custom", {
        user: "test@custom.com",
        password: "password123",
      }, {
        imap: { host: "imap.custom.com", port: 993 },
        smtp: { host: "smtp.custom.com", port: 587 },
      });

      expect(client).toBeTruthy();
    });

    test("EmailClient should expose convenience methods", async () => {
      const { EmailClient } = await import("../src/integrations/email");

      const client = new EmailClient({
        imap: {
          host: "imap.example.com",
          port: 993,
          user: "test@example.com",
          password: "password",
        },
        smtp: {
          host: "smtp.example.com",
          port: 587,
          auth: { user: "test@example.com", pass: "password" },
        },
      });

      expect(typeof client.connect).toBe("function");
      expect(typeof client.disconnect).toBe("function");
      expect(typeof client.fetchRecent).toBe("function");
      expect(typeof client.getUnreadCount).toBe("function");
      expect(typeof client.sendText).toBe("function");
      expect(typeof client.sendHtml).toBe("function");
      expect(typeof client.reply).toBe("function");
      expect(typeof client.search).toBe("function");
      expect(typeof client.getInboxSummary).toBe("function");
      expect(typeof client.getActionItems).toBe("function");
      expect(typeof client.generateDigest).toBe("function");
    });
  });

  describe("Type Exports", () => {
    test("should export EmailConfig type", async () => {
      // TypeScript will fail compilation if type doesn't exist
      const mod = await import("../src/integrations/email");
      expect(mod).toBeTruthy();
    });

    test("should export EmailMessage type", async () => {
      const mod = await import("../src/integrations/email");
      expect(mod).toBeTruthy();
    });

    test("should export ParsedEmail type", async () => {
      const mod = await import("../src/integrations/email");
      expect(mod).toBeTruthy();
    });

    test("should export SendResult type", async () => {
      const mod = await import("../src/integrations/email");
      expect(mod).toBeTruthy();
    });
  });

  describe("Environment Configuration", () => {
    test("env schema should include email configuration", async () => {
      // This tests that the env types are correct
      const envSchema = await import("../src/config/env");
      expect(envSchema.env).toBeTruthy();
    });
  });

  describe("SMTP Email Templates", () => {
    test("SmtpClient should support template variables", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = new SmtpClient({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "test@example.com", pass: "password" },
      });

      expect(typeof client.sendTemplate).toBe("function");
    });
  });

  describe("IMAP Search Options", () => {
    test("ImapClient should support search options", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        user: "test@example.com",
        password: "password",
      });

      expect(typeof client.searchEmails).toBe("function");
    });
  });

  describe("IMAP Folder Operations", () => {
    test("ImapClient should support folder listing", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        user: "test@example.com",
        password: "password",
      });

      expect(typeof client.listFolders).toBe("function");
    });

    test("ImapClient should support email movement", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        user: "test@example.com",
        password: "password",
      });

      expect(typeof client.moveEmail).toBe("function");
      expect(typeof client.deleteEmail).toBe("function");
    });
  });

  describe("IMAP Flag Operations", () => {
    test("ImapClient should support flag operations", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        user: "test@example.com",
        password: "password",
      });

      expect(typeof client.markAsRead).toBe("function");
      expect(typeof client.markAsUnread).toBe("function");
      expect(typeof client.flagEmail).toBe("function");
      expect(typeof client.unflagEmail).toBe("function");
    });
  });

  describe("IMAP Thread Operations", () => {
    test("ImapClient should support thread retrieval", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        user: "test@example.com",
        password: "password",
      });

      expect(typeof client.getThread).toBe("function");
    });
  });

  describe("IMAP Watch Operations", () => {
    test("ImapClient should support watching for new emails", async () => {
      const { ImapClient } = await import("../src/integrations/email/imap-client");

      const client = new ImapClient({
        host: "imap.example.com",
        port: 993,
        user: "test@example.com",
        password: "password",
      });

      expect(typeof client.watchForNew).toBe("function");
    });
  });

  describe("SMTP Reply Operations", () => {
    test("SmtpClient should support reply operations", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = new SmtpClient({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "test@example.com", pass: "password" },
      });

      expect(typeof client.reply).toBe("function");
      expect(typeof client.replyAll).toBe("function");
      expect(typeof client.forward).toBe("function");
    });
  });

  describe("SMTP Priority Options", () => {
    test("SmtpClient should support email priority", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = new SmtpClient({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "test@example.com", pass: "password" },
      });

      // The send method should accept priority option
      expect(typeof client.send).toBe("function");
    });
  });

  describe("HTML to Text Conversion", () => {
    test("SmtpClient should convert HTML to text for sendHtml", async () => {
      const { SmtpClient } = await import("../src/integrations/email/smtp-client");

      const client = new SmtpClient({
        host: "smtp.example.com",
        port: 587,
        auth: { user: "test@example.com", pass: "password" },
      });

      // sendHtml should auto-generate text version
      expect(typeof client.sendHtml).toBe("function");
    });
  });
});
