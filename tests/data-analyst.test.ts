import { describe, test, expect } from "bun:test";

describe("Data Analyst", () => {
  describe("Module Exports", () => {
    test("should export parseCSV function", async () => {
      const { parseCSV } = await import("../src/tools/data-analyst");
      expect(typeof parseCSV).toBe("function");
    });

    test("should export profileData function", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      expect(typeof profileData).toBe("function");
    });
  });

  describe("parseCSV", () => {
    test("should parse simple CSV", async () => {
      const { parseCSV } = await import("../src/tools/data-analyst");
      const data = parseCSV("name,age,city\nAlice,30,NYC\nBob,25,LA");

      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Alice");
      expect(data[0].age).toBe(30);
      expect(data[0].city).toBe("NYC");
    });

    test("should auto-convert numeric values", async () => {
      const { parseCSV } = await import("../src/tools/data-analyst");
      const data = parseCSV("value,label\n42,test\n3.14,pi");

      expect(data[0].value).toBe(42);
      expect(data[1].value).toBe(3.14);
      expect(data[0].label).toBe("test");
    });

    test("should handle quoted fields with commas", async () => {
      const { parseCSV } = await import("../src/tools/data-analyst");
      const data = parseCSV('name,address\n"Smith, John","123 Main St"');

      expect(data[0].name).toBe("Smith, John");
      expect(data[0].address).toBe("123 Main St");
    });

    test("should handle empty CSV", async () => {
      const { parseCSV } = await import("../src/tools/data-analyst");
      const data = parseCSV("header1,header2");

      expect(data).toHaveLength(0);
    });

    test("should skip empty lines", async () => {
      const { parseCSV } = await import("../src/tools/data-analyst");
      const data = parseCSV("a,b\n1,2\n\n3,4\n");

      expect(data).toHaveLength(2);
    });
  });

  describe("profileData", () => {
    test("should profile numeric columns", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { value: 10 }, { value: 20 }, { value: 30 }, { value: 40 }, { value: 50 },
      ];

      const profile = profileData(data);

      expect(profile.rowCount).toBe(5);
      expect(profile.columnCount).toBe(1);

      const col = profile.columns[0];
      expect(col.type).toBe("number");
      expect(col.min).toBe(10);
      expect(col.max).toBe(50);
      expect(col.mean).toBe(30);
      expect(col.median).toBe(30);
    });

    test("should profile string columns", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { name: "Alice" }, { name: "Bob" }, { name: "Charlie" },
      ];

      const profile = profileData(data);
      const col = profile.columns[0];

      expect(col.type).toBe("string");
      expect(col.uniqueCount).toBe(3);
      expect(col.minLength).toBe(3); // "Bob"
      expect(col.maxLength).toBe(7); // "Charlie"
    });

    test("should detect null values", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { a: 1, b: "x" },
        { a: 2, b: null },
        { a: null, b: "z" },
      ];

      const profile = profileData(data);
      const colA = profile.columns.find((c) => c.name === "a");
      const colB = profile.columns.find((c) => c.name === "b");

      expect(colA!.nullCount).toBe(1);
      expect(colB!.nullCount).toBe(1);
    });

    test("should detect outliers", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { v: 10 }, { v: 11 }, { v: 12 }, { v: 10 },
        { v: 11 }, { v: 12 }, { v: 10 }, { v: 11 },
        { v: 12 }, { v: 10 }, { v: 100 }, // outlier
      ];

      const profile = profileData(data);
      expect(profile.anomalies.length).toBeGreaterThan(0);
      expect(profile.anomalies[0]).toContain("outlier");
    });

    test("should handle empty dataset", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const profile = profileData([]);

      expect(profile.rowCount).toBe(0);
      expect(profile.summary).toContain("Empty");
    });

    test("should generate insights for single-value columns", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { status: "active" }, { status: "active" }, { status: "active" },
      ];

      const profile = profileData(data);
      expect(profile.insights.some((i) => i.includes("one unique value"))).toBe(true);
    });

    test("should identify possible ID columns", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { id: "abc", val: 1 },
        { id: "def", val: 2 },
        { id: "ghi", val: 3 },
      ];

      const profile = profileData(data);
      expect(profile.insights.some((i) => i.includes("unique values") && i.includes("id"))).toBe(true);
    });

    test("should compute top values", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { color: "red" }, { color: "blue" }, { color: "red" },
        { color: "red" }, { color: "green" },
      ];

      const profile = profileData(data);
      const col = profile.columns[0];
      expect(col.topValues[0].value).toBe("red");
      expect(col.topValues[0].count).toBe(3);
    });

    test("should handle mixed-type columns", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { val: 1 }, { val: "text" }, { val: true }, { val: 42 },
      ];

      const profile = profileData(data);
      expect(profile.columns[0].type).toBeDefined();
    });

    test("summary should include row and column counts", async () => {
      const { profileData } = await import("../src/tools/data-analyst");
      const data = [
        { a: 1, b: "x", c: true },
        { a: 2, b: "y", c: false },
      ];

      const profile = profileData(data);
      expect(profile.summary).toContain("2 rows");
      expect(profile.summary).toContain("3 columns");
    });
  });

  describe("Tool Definition", () => {
    test("should include analyze_data in TOOLS array", async () => {
      const { TOOLS } = await import("../src/tools/index");
      const tool = TOOLS.find((t) => t.name === "analyze_data");

      expect(tool).toBeTruthy();
      expect(tool!.description).toContain("dataset");
      expect(tool!.input_schema.required).toContain("data");
    });
  });

  describe("executeTool Integration", () => {
    test("should handle CSV input via executeTool", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("analyze_data", {
        data: "name,score\nAlice,95\nBob,87\nCharlie,92",
      });

      expect(result.success).toBe(true);
      expect((result.result as any).rowCount).toBe(3);
    });

    test("should handle JSON array input", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("analyze_data", {
        data: JSON.stringify([
          { name: "Alice", score: 95 },
          { name: "Bob", score: 87 },
        ]),
      });

      expect(result.success).toBe(true);
      expect((result.result as any).rowCount).toBe(2);
    });

    test("should return error for invalid data", async () => {
      const { executeTool } = await import("../src/tools/index");
      const result = await executeTool("analyze_data", {
        data: "not valid data at all",
        format: "json",
      });

      expect(result.success).toBe(false);
    });
  });
});
