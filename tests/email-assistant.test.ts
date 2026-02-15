import { describe, test, expect } from "bun:test";

describe("Email Assistant", () => {
  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/email-assistant");
      expect(typeof mod.triageEmail).toBe("function");
      expect(typeof mod.extractActions).toBe("function");
      expect(typeof mod.generateDigest).toBe("function");
      expect(typeof mod.draftReply).toBe("function");
    });
  });

  describe("triageEmail", () => {
    test("should detect billing category", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({ from: "billing@company.com", subject: "Your invoice is ready", body: "Please review your invoice" });
      expect(result.category).toBe("billing");
    });

    test("should detect meeting category", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({ from: "calendar@google.com", subject: "Meeting invite: Weekly standup" });
      expect(result.category).toBe("meeting");
    });

    test("should detect newsletter", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({ from: "news@tech.com", subject: "Weekly newsletter digest", body: "Unsubscribe link below" });
      expect(result.category).toBe("newsletter");
      expect(result.priority).toBe("low");
    });

    test("should detect urgent emails", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({ from: "boss@work.com", subject: "URGENT: Need this ASAP" });
      expect(result.category).toBe("urgent");
      expect(result.priority).toBe("critical");
    });

    test("should detect spam", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({ from: "spam@scam.com", subject: "You've won $1 million dollars!", body: "Click here to claim your prize" });
      expect(result.category).toBe("spam");
      expect(result.actionRequired).toBe(false);
    });

    test("should extract action suggestions", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({
        from: "hr@company.com",
        subject: "Please review attached document",
        body: "Please sign the document and submit by Friday",
      });
      expect(result.actionRequired).toBe(true);
      expect(result.suggestedActions.length).toBeGreaterThan(0);
    });

    test("should add tags", async () => {
      const { triageEmail } = await import("../src/tools/email-assistant");
      const result = triageEmail({ from: "boss@work.com", subject: "URGENT review", body: "Please review this attachment" });
      expect(result.tags).toContain("important");
    });
  });

  describe("extractActions", () => {
    test("should extract action items from emails", async () => {
      const { extractActions } = await import("../src/tools/email-assistant");
      const actions = extractActions([
        { from: "alice@co.com", subject: "Please confirm your attendance", body: "RSVP by Friday" },
        { from: "bob@co.com", subject: "Invoice attached", body: "Payment due on March 15" },
      ]);
      expect(actions.length).toBeGreaterThanOrEqual(2);
    });

    test("should sort by priority", async () => {
      const { extractActions } = await import("../src/tools/email-assistant");
      const actions = extractActions([
        { from: "hr@co.com", subject: "Please review attached doc" },
        { from: "ceo@co.com", subject: "URGENT: approve budget immediately" },
      ]);
      if (actions.length >= 2) {
        // Higher priority should come first
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        expect(priorityOrder[actions[0].priority]).toBeLessThanOrEqual(priorityOrder[actions[1].priority]);
      }
    });
  });

  describe("generateDigest", () => {
    test("should generate inbox digest", async () => {
      const { generateDigest } = await import("../src/tools/email-assistant");
      const digest = generateDigest([
        { from: "newsletter@tech.com", subject: "Weekly digest", body: "Unsubscribe" },
        { from: "boss@work.com", subject: "Urgent: Review needed", body: "Please respond ASAP" },
        { from: "billing@service.com", subject: "Invoice #123", body: "Payment due" },
      ]);
      expect(digest.totalAnalyzed).toBe(3);
      expect(digest.urgentCount).toBeGreaterThanOrEqual(1);
      expect(digest.summary).toContain("3 emails analyzed");
    });
  });

  describe("draftReply", () => {
    test("should draft a friendly reply", async () => {
      const { draftReply } = await import("../src/tools/email-assistant");
      const reply = draftReply({ from: "Alice Smith", subject: "Meeting tomorrow" }, "friendly");
      expect(reply).toContain("Hi Alice");
      expect(reply).toContain("Thanks,");
    });

    test("should draft a formal reply", async () => {
      const { draftReply } = await import("../src/tools/email-assistant");
      const reply = draftReply({ from: "CEO John", subject: "Quarterly review" }, "formal");
      expect(reply).toContain("Dear CEO");
      expect(reply).toContain("Best regards,");
    });

    test("should draft a brief reply", async () => {
      const { draftReply } = await import("../src/tools/email-assistant");
      const reply = draftReply({ from: "team@co.com", subject: "Quick update" }, "brief");
      expect(reply).toContain("Hi,");
      expect(reply).toContain("Thanks!");
    });
  });

  describe("Tool Definition", () => {
    test("should include email_assistant in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      expect(TOOLS.find((t) => t.name === "email_assistant")).toBeTruthy();
    });
  });

  describe("executeTool", () => {
    test("should handle triage action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("email_assistant", {
        action: "triage",
        from: "billing@example.com",
        subject: "Your invoice is ready",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).category).toBe("billing");
    });

    test("should handle draft_reply action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("email_assistant", {
        action: "draft_reply",
        from: "John Doe",
        subject: "Meeting tomorrow",
        style: "formal",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).reply).toContain("Dear John");
    });
  });
});
