import { describe, test, expect, beforeEach } from "bun:test";

describe("Competitor Tracker", () => {
  beforeEach(async () => {
    const { clearCompetitors } = await import("../src/tools/competitor-tracker");
    clearCompetitors();
  });

  describe("Module Exports", () => {
    test("should export addCompetitor function", async () => {
      const { addCompetitor } = await import("../src/tools/competitor-tracker");
      expect(typeof addCompetitor).toBe("function");
    });

    test("should export removeCompetitor function", async () => {
      const { removeCompetitor } = await import("../src/tools/competitor-tracker");
      expect(typeof removeCompetitor).toBe("function");
    });

    test("should export listCompetitors function", async () => {
      const { listCompetitors } = await import("../src/tools/competitor-tracker");
      expect(typeof listCompetitors).toBe("function");
    });

    test("should export getCompetitor function", async () => {
      const { getCompetitor } = await import("../src/tools/competitor-tracker");
      expect(typeof getCompetitor).toBe("function");
    });

    test("should export compareCompetitors function", async () => {
      const { compareCompetitors } = await import("../src/tools/competitor-tracker");
      expect(typeof compareCompetitors).toBe("function");
    });

    test("should export getCompetitorReport function", async () => {
      const { getCompetitorReport } = await import("../src/tools/competitor-tracker");
      expect(typeof getCompetitorReport).toBe("function");
    });
  });

  describe("addCompetitor", () => {
    test("should add a competitor with required fields", async () => {
      const { addCompetitor } = await import("../src/tools/competitor-tracker");
      const comp = addCompetitor("Acme Corp", "https://acme.com");

      expect(comp.name).toBe("Acme Corp");
      expect(comp.url).toBe("https://acme.com");
      expect(comp.id).toContain("comp_");
      expect(comp.addedAt).toBeInstanceOf(Date);
      expect(comp.snapshots).toHaveLength(0);
    });

    test("should add a competitor with optional fields", async () => {
      const { addCompetitor } = await import("../src/tools/competitor-tracker");
      const comp = addCompetitor("BigCo", "https://bigco.io", {
        category: "direct",
        notes: "Main competitor",
      });

      expect(comp.category).toBe("direct");
      expect(comp.notes).toBe("Main competitor");
    });

    test("should normalize URLs without protocol", async () => {
      const { addCompetitor } = await import("../src/tools/competitor-tracker");
      const comp = addCompetitor("NoProtocol", "example.com");

      expect(comp.url).toBe("https://example.com");
    });
  });

  describe("listCompetitors", () => {
    test("should return empty array initially", async () => {
      const { listCompetitors } = await import("../src/tools/competitor-tracker");
      const list = listCompetitors();
      expect(list).toHaveLength(0);
    });

    test("should return all added competitors", async () => {
      const { addCompetitor, listCompetitors } = await import("../src/tools/competitor-tracker");
      addCompetitor("A", "https://a.com");
      addCompetitor("B", "https://b.com");
      addCompetitor("C", "https://c.com");

      const list = listCompetitors();
      expect(list).toHaveLength(3);
    });
  });

  describe("getCompetitor", () => {
    test("should find by ID", async () => {
      const { addCompetitor, getCompetitor } = await import("../src/tools/competitor-tracker");
      const comp = addCompetitor("FindMe", "https://findme.com");
      const found = getCompetitor(comp.id);

      expect(found).toBeTruthy();
      expect(found!.name).toBe("FindMe");
    });

    test("should find by name (case-insensitive)", async () => {
      const { addCompetitor, getCompetitor } = await import("../src/tools/competitor-tracker");
      addCompetitor("MyCompetitor", "https://mycomp.com");
      const found = getCompetitor("mycompetitor");

      expect(found).toBeTruthy();
      expect(found!.name).toBe("MyCompetitor");
    });

    test("should return undefined for unknown competitor", async () => {
      const { getCompetitor } = await import("../src/tools/competitor-tracker");
      const found = getCompetitor("nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("removeCompetitor", () => {
    test("should remove by name", async () => {
      const { addCompetitor, removeCompetitor, listCompetitors } = await import("../src/tools/competitor-tracker");
      addCompetitor("ToRemove", "https://remove.com");
      expect(listCompetitors()).toHaveLength(1);

      const removed = removeCompetitor("ToRemove");
      expect(removed).toBe(true);
      expect(listCompetitors()).toHaveLength(0);
    });

    test("should return false for unknown competitor", async () => {
      const { removeCompetitor } = await import("../src/tools/competitor-tracker");
      const removed = removeCompetitor("ghost");
      expect(removed).toBe(false);
    });
  });

  describe("compareCompetitors", () => {
    test("should return empty comparison when no competitors", async () => {
      const { compareCompetitors } = await import("../src/tools/competitor-tracker");
      const result = compareCompetitors();

      expect(result.competitors).toHaveLength(0);
      expect(result.summary).toContain("No competitors tracked");
    });

    test("should compare multiple competitors", async () => {
      const { addCompetitor, compareCompetitors } = await import("../src/tools/competitor-tracker");
      addCompetitor("A", "https://a.com");
      addCompetitor("B", "https://b.com");

      const result = compareCompetitors();
      expect(result.competitors).toHaveLength(2);
      expect(result.summary).toContain("2 competitor(s)");
    });
  });

  describe("getCompetitorReport", () => {
    test("should generate report for tracked competitor", async () => {
      const { addCompetitor, getCompetitorReport } = await import("../src/tools/competitor-tracker");
      addCompetitor("ReportCo", "https://reportco.com", { category: "direct" });

      const report = getCompetitorReport("ReportCo");
      expect(report.competitor.name).toBe("ReportCo");
      expect(report.competitor.category).toBe("direct");
      expect(report.changeHistory.totalChecks).toBe(0);
      expect(report.current).toBeNull();
    });

    test("should throw for unknown competitor", async () => {
      const { getCompetitorReport } = await import("../src/tools/competitor-tracker");
      expect(() => getCompetitorReport("ghost")).toThrow("Competitor not found");
    });
  });

  describe("Tool Definition", () => {
    test("should include track_competitor in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "track_competitor");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("competitor");
      expect(tool!.input_schema.required).toContain("action");
    });

    test("should have action enum options", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "track_competitor");
      const actionProp = (tool!.input_schema.properties as any).action;

      expect(actionProp.enum).toContain("add");
      expect(actionProp.enum).toContain("check");
      expect(actionProp.enum).toContain("compare");
      expect(actionProp.enum).toContain("list");
    });
  });

  describe("executeTool Integration", () => {
    test("should handle track_competitor add action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("track_competitor", {
        action: "add",
        name: "TestCorp",
        url: "https://testcorp.com",
      });

      expect(result.success).toBe(true);
      expect((result.result as any).name).toBe("TestCorp");
    });

    test("should handle track_competitor list action", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("track_competitor", { action: "list" });

      expect(result.success).toBe(true);
      expect((result.result as any)).toHaveProperty("count");
    });

    test("should reject add without required fields", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("track_competitor", { action: "add" });

      expect(result.success).toBe(false);
    });
  });
});
