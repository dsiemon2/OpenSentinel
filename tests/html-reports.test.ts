import { describe, test, expect } from "bun:test";
import { generateReport, quickReport } from "../src/tools/file-generation/html-reports";
import { unlink } from "fs/promises";

describe("HTML Report Generation", () => {
  describe("module exports", () => {
    test("should export generateReport function", async () => {
      const mod = await import("../src/tools/file-generation/html-reports");
      expect(typeof mod.generateReport).toBe("function");
    });

    test("should export quickReport function", async () => {
      const mod = await import("../src/tools/file-generation/html-reports");
      expect(typeof mod.quickReport).toBe("function");
    });
  });

  describe("generateReport", () => {
    test("should generate basic report with text section", async () => {
      const result = await generateReport(
        [{ title: "Overview", type: "text", content: "<p>Hello world</p>" }],
        undefined,
        { title: "Test Report" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("Test Report");
      expect(result.html).toContain("Hello world");
      expect(result.html).toContain("<!DOCTYPE html>");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should render metrics cards", async () => {
      const result = await generateReport(
        [{
          title: "KPIs",
          type: "metrics",
          data: [
            { label: "Revenue", value: "$1.2M", change: 12.5 },
            { label: "Users", value: 5420, unit: "active", change: -3.2 },
          ],
        }],
        undefined,
        { title: "Dashboard" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("Revenue");
      expect(result.html).toContain("$1.2M");
      expect(result.html).toContain("+12.5%");
      expect(result.html).toContain("5420");
      expect(result.html).toContain("-3.2%");
      expect(result.html).toContain("metric-change positive");
      expect(result.html).toContain("metric-change negative");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should render progress bars", async () => {
      const result = await generateReport(
        [{
          title: "Progress",
          type: "progress",
          data: [
            { label: "Task A", value: 85, target: 90 },
            { label: "Task B", value: 30 },
          ],
        }],
        undefined,
        { title: "Progress Report" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("Task A");
      expect(result.html).toContain("85%");
      expect(result.html).toContain("width: 85%");
      expect(result.html).toContain("Task B");
      expect(result.html).toContain("30%");
      expect(result.html).toContain("progress-target");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should render table", async () => {
      const result = await generateReport(
        [{
          title: "Data",
          type: "table",
          data: [
            { Name: "Alice", Score: 95, Grade: "A" },
            { Name: "Bob", Score: 82, Grade: "B" },
          ],
        }],
        undefined,
        { title: "Grades" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("<table>");
      expect(result.html).toContain("<th>Name</th>");
      expect(result.html).toContain("<td>Alice</td>");
      expect(result.html).toContain("<td>95</td>");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should render timeline", async () => {
      const result = await generateReport(
        [{
          title: "History",
          type: "timeline",
          data: [
            { date: "2026-01-01", title: "Project Started", status: "completed" },
            { date: "2026-02-01", title: "Phase 2", description: "In progress", status: "active" },
          ],
        }],
        undefined,
        { title: "Timeline Report" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("Project Started");
      expect(result.html).toContain("Phase 2");
      expect(result.html).toContain("timeline-dot");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should render key-value data", async () => {
      const result = await generateReport(
        [{
          title: "Details",
          type: "kv",
          data: [
            { key: "Version", value: "2.1.0" },
            { key: "Status", value: "Active" },
          ],
        }],
        undefined,
        { title: "System Info" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("Version");
      expect(result.html).toContain("2.1.0");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should apply different themes", async () => {
      for (const theme of ["light", "dark", "corporate", "minimal"] as const) {
        const result = await generateReport(
          [{ title: "Test", type: "text", content: "Hello" }],
          undefined,
          { title: "Theme Test", theme }
        );
        expect(result.success).toBe(true);
        expect(result.html).toContain("--bg:");
        if (result.filePath) await unlink(result.filePath).catch(() => {});
      }
    });

    test("should include author and footer", async () => {
      const result = await generateReport(
        [{ title: "Section", type: "text", content: "Body" }],
        undefined,
        { title: "Report", author: "John Doe", footer: "Confidential" }
      );

      expect(result.success).toBe(true);
      expect(result.html).toContain("John Doe");
      expect(result.html).toContain("Confidential");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });

    test("should handle multiple sections", async () => {
      const result = await generateReport(
        [
          { title: "Section 1", type: "text", content: "First" },
          { title: "Section 2", type: "text", content: "Second" },
          { title: "Section 3", type: "text", content: "Third" },
        ],
        undefined,
        { title: "Multi-Section" }
      );

      expect(result.success).toBe(true);
      const sectionCount = (result.html!.match(/report-section/g) || []).length;
      expect(sectionCount).toBeGreaterThanOrEqual(3);

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });
  });

  describe("quickReport", () => {
    test("should create report from simple key-value data", async () => {
      const result = await quickReport("Quick Summary", {
        "Total Users": 1500,
        "Active Today": 320,
        "Revenue": "$45,000",
      });

      expect(result.success).toBe(true);
      expect(result.html).toContain("Quick Summary");
      expect(result.html).toContain("Total Users");
      expect(result.html).toContain("1500");

      if (result.filePath) await unlink(result.filePath).catch(() => {});
    });
  });
});
