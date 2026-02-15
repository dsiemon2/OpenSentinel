import { describe, test, expect, beforeEach } from "bun:test";

describe("Sales Tracker", () => {
  beforeEach(async () => {
    const { clearLeads } = await import("../src/tools/sales-tracker");
    clearLeads();
  });

  describe("Module Exports", () => {
    test("should export core functions", async () => {
      const mod = await import("../src/tools/sales-tracker");
      expect(typeof mod.addLead).toBe("function");
      expect(typeof mod.updateLead).toBe("function");
      expect(typeof mod.removeLead).toBe("function");
      expect(typeof mod.listLeads).toBe("function");
      expect(typeof mod.getPipelineSummary).toBe("function");
      expect(typeof mod.getFollowUps).toBe("function");
    });
  });

  describe("addLead", () => {
    test("should add a lead", async () => {
      const { addLead } = await import("../src/tools/sales-tracker");
      const lead = addLead("John Doe", { company: "Acme", value: 5000 });
      expect(lead.name).toBe("John Doe");
      expect(lead.company).toBe("Acme");
      expect(lead.value).toBe(5000);
      expect(lead.status).toBe("new");
    });
  });

  describe("updateLead", () => {
    test("should update status", async () => {
      const { addLead, updateLead } = await import("../src/tools/sales-tracker");
      addLead("Jane", { value: 1000 });
      const updated = updateLead("Jane", { status: "qualified" });
      expect(updated.status).toBe("qualified");
    });

    test("should add notes", async () => {
      const { addLead, updateLead } = await import("../src/tools/sales-tracker");
      addLead("Bob");
      updateLead("Bob", { notes: "Called today" });
      const lead = updateLead("Bob", { notes: "Sent proposal" });
      expect(lead.notes).toHaveLength(2);
    });
  });

  describe("getPipelineSummary", () => {
    test("should compute pipeline metrics", async () => {
      const { addLead, updateLead, getPipelineSummary } = await import("../src/tools/sales-tracker");
      addLead("A", { value: 1000 });
      addLead("B", { value: 2000 });
      addLead("C", { value: 3000 });
      updateLead("A", { status: "won" });
      updateLead("B", { status: "lost" });

      const summary = getPipelineSummary();
      expect(summary.totalLeads).toBe(3);
      expect(summary.wonValue).toBe(1000);
      expect(summary.lostValue).toBe(2000);
      expect(summary.conversionRate).toBe("50.0%");
    });
  });

  describe("Tool Definition", () => {
    test("should include sales_pipeline in TOOLS", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "sales_pipeline");
      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("pipeline");
    });
  });

  describe("executeTool", () => {
    test("should handle add action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("sales_pipeline", { action: "add", name: "Test Lead", value: 5000 });
      expect(result.success).toBe(true);
    });

    test("should handle pipeline action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("sales_pipeline", { action: "pipeline" });
      expect(result.success).toBe(true);
      expect((result.result as any).totalLeads).toBeDefined();
    });
  });
});
