import { describe, test, expect, beforeEach } from "bun:test";

describe("Customer Support", () => {
  beforeEach(async () => {
    const { clearTickets } = await import("../src/tools/customer-support");
    clearTickets();
  });

  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/customer-support");
      expect(typeof mod.createTicket).toBe("function");
      expect(typeof mod.updateTicket).toBe("function");
      expect(typeof mod.getTicket).toBe("function");
      expect(typeof mod.listTickets).toBe("function");
      expect(typeof mod.getTicketSummary).toBe("function");
      expect(typeof mod.getSuggestedResponse).toBe("function");
      expect(typeof mod.getEscalationQueue).toBe("function");
    });
  });

  describe("createTicket", () => {
    test("should create a ticket with auto-triage", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("John", "Can't login", "I'm locked out of my account and can't reset password");
      expect(ticket.id).toMatch(/^TKT-/);
      expect(ticket.customer).toBe("John");
      expect(ticket.category).toBe("account");
      expect(ticket.priority).toBe("critical");
    });

    test("should detect billing category", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("Jane", "Wrong charge", "I was double charged, payment failed on my subscription");
      expect(ticket.category).toBe("billing");
      expect(ticket.priority).toBe("critical");
    });

    test("should detect bug report", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("Bob", "App crashes", "The app crashes when I click the settings button");
      expect(ticket.category).toBe("bug_report");
      expect(ticket.priority).toBe("high");
    });

    test("should detect feature request as low priority", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("Alice", "Feature request", "Would be nice to have dark mode");
      expect(ticket.category).toBe("feature_request");
      expect(ticket.priority).toBe("low");
    });

    test("should auto-escalate critical tickets", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("Eve", "Account hacked", "Someone unauthorized accessed my account");
      expect(ticket.status).toBe("escalated");
      expect(ticket.escalatedAt).toBeDefined();
    });

    test("should include suggested response", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("Frank", "Billing question", "I need a refund for my subscription");
      expect(ticket.suggestedResponse).toBeDefined();
      expect(ticket.suggestedResponse!.length).toBeGreaterThan(10);
    });

    test("should detect tags", async () => {
      const { createTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("VIP Corp", "API issue", "Our enterprise API integration is broken");
      expect(ticket.tags).toContain("vip");
      expect(ticket.tags).toContain("api");
    });
  });

  describe("updateTicket", () => {
    test("should update status", async () => {
      const { createTicket, updateTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("John", "Issue", "Something is wrong");
      const updated = updateTicket(ticket.id, { status: "in_progress", assignee: "Agent1" });
      expect(updated.status).toBe("in_progress");
      expect(updated.assignee).toBe("Agent1");
    });

    test("should add notes", async () => {
      const { createTicket, updateTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("John", "Issue", "Problem description");
      updateTicket(ticket.id, { note: "First update" });
      const updated = updateTicket(ticket.id, { note: "Second update" });
      expect(updated.notes.length).toBeGreaterThanOrEqual(2);
    });

    test("should set resolvedAt when resolved", async () => {
      const { createTicket, updateTicket } = await import("../src/tools/customer-support");
      const ticket = createTicket("John", "Issue", "Problem");
      const resolved = updateTicket(ticket.id, { status: "resolved" });
      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  describe("getTicketSummary", () => {
    test("should compute summary metrics", async () => {
      const { createTicket, updateTicket, getTicketSummary } = await import("../src/tools/customer-support");
      createTicket("A", "Bug", "App crashes");
      createTicket("B", "Feature", "Want dark mode feature request");
      const t = createTicket("C", "Billing", "Wrong charge on my invoice");
      updateTicket(t.id, { status: "resolved" });

      const summary = getTicketSummary();
      expect(summary.totalTickets).toBe(3);
      expect(summary.openTickets).toBeGreaterThanOrEqual(1);
    });
  });

  describe("listTickets", () => {
    test("should filter by status", async () => {
      const { createTicket, updateTicket, listTickets } = await import("../src/tools/customer-support");
      createTicket("A", "Issue 1", "Desc 1");
      const t2 = createTicket("B", "Issue 2", "Desc 2");
      updateTicket(t2.id, { status: "resolved" });

      const open = listTickets({ status: "new" });
      expect(open.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("getEscalationQueue", () => {
    test("should return escalated tickets", async () => {
      const { createTicket, getEscalationQueue } = await import("../src/tools/customer-support");
      createTicket("A", "Normal issue", "Small problem");
      createTicket("B", "Account hacked", "Unauthorized access to my data");

      const escalated = getEscalationQueue();
      expect(escalated.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Tool Definition", () => {
    test("should include customer_support in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      expect(TOOLS.find((t) => t.name === "customer_support")).toBeTruthy();
    });
  });

  describe("executeTool", () => {
    test("should handle create action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("customer_support", {
        action: "create",
        customer: "Test User",
        subject: "Test Issue",
        description: "This is a test ticket",
      });
      expect(result.success).toBe(true);
      expect((result.result as any).ticket.id).toMatch(/^TKT-/);
    });

    test("should handle summary action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("customer_support", { action: "summary" });
      expect(result.success).toBe(true);
      expect((result.result as any).totalTickets).toBeDefined();
    });
  });
});
