import { describe, test, expect } from "bun:test";

// ============================================================
// Regex Tool + Unit Converter Tests
// ============================================================

import {
  testRegex,
  replaceWithRegex,
  extractCaptures,
  validateRegex,
  explainRegex,
  escapeRegex,
  splitWithRegex,
  regexTool,
} from "../src/tools/regex-tool";

import { convert, listUnits, unitConverter } from "../src/tools/unit-converter";

describe("Regex Tool", () => {
  describe("testRegex", () => {
    test("finds all matches", () => {
      const result = testRegex("\\d+", "abc 123 def 456");
      expect(result.count).toBe(2);
      expect(result.matches[0].match).toBe("123");
    });

    test("returns match indices", () => {
      const result = testRegex("world", "hello world");
      expect(result.matches[0].index).toBe(6);
    });

    test("handles no matches", () => {
      const result = testRegex("xyz", "hello world");
      expect(result.count).toBe(0);
    });
  });

  describe("replaceWithRegex", () => {
    test("replaces matches", () => {
      const result = replaceWithRegex("\\d+", "abc 123 def 456", "NUM");
      expect(result.result).toBe("abc NUM def NUM");
      expect(result.replacements).toBe(2);
    });
  });

  describe("extractCaptures", () => {
    test("extracts capture groups", () => {
      const captures = extractCaptures("(\\w+)@(\\w+)", "user@host");
      expect(captures[0]).toEqual(["user", "host"]);
    });
  });

  describe("validateRegex", () => {
    test("validates correct regex", () => {
      expect(validateRegex("\\d+")).toEqual({ valid: true });
    });

    test("rejects invalid regex", () => {
      const result = validateRegex("[invalid");
      expect(result.valid).toBe(false);
    });
  });

  describe("explainRegex", () => {
    test("explains digit pattern", () => {
      const explanation = explainRegex("\\d+");
      expect(explanation).toContain("digit");
    });

    test("explains literal string", () => {
      const explanation = explainRegex("hello");
      expect(explanation).toContain("literal");
    });
  });

  describe("escapeRegex", () => {
    test("escapes special characters", () => {
      const result = escapeRegex("hello.world*");
      expect(result).toBe("hello\\.world\\*");
    });
  });

  describe("splitWithRegex", () => {
    test("splits text by pattern", () => {
      const result = splitWithRegex("[,;]", "a,b;c");
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("regexTool (main entry)", () => {
    test("handles test action", async () => {
      const result = await regexTool("test", "\\d+", "abc 123");
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await regexTool("unknown", ".", "text");
      expect(result.success).toBe(false);
    });
  });
});

describe("Unit Converter", () => {
  describe("convert", () => {
    test("converts km to miles", () => {
      const result = convert(1, "km", "mi");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(0.621371, 3);
    });

    test("converts Celsius to Fahrenheit", () => {
      const result = convert(100, "C", "F");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(212, 0);
    });

    test("converts Fahrenheit to Celsius", () => {
      const result = convert(32, "F", "C");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(0, 0);
    });

    test("converts kg to lb", () => {
      const result = convert(1, "kg", "lb");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(2.20462, 2);
    });

    test("converts GB to MB", () => {
      const result = convert(1, "gb", "mb");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(1024, 0);
    });

    test("converts hours to minutes", () => {
      const result = convert(1, "hr", "min");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBe(60);
    });

    test("returns formatted string", () => {
      const result = convert(100, "km", "mi");
      expect(result.result!.formatted).toContain("km");
      expect(result.result!.formatted).toContain("mi");
    });

    test("returns error for unknown unit", () => {
      const result = convert(1, "xyz", "abc");
      expect(result.success).toBe(false);
    });
  });

  describe("listUnits", () => {
    test("lists all unit categories", () => {
      const units = listUnits();
      expect(units.temperature).toBeDefined();
      expect(units.length).toBeDefined();
      expect(units.weight).toBeDefined();
    });

    test("lists units for specific category", () => {
      const units = listUnits("length");
      expect(units.length).toBeDefined();
    });

    test("includes temperature units", () => {
      const units = listUnits("temperature");
      expect(units.temperature).toContain("C");
      expect(units.temperature).toContain("F");
      expect(units.temperature).toContain("K");
    });
  });

  describe("unitConverter (main entry)", () => {
    test("handles conversion", async () => {
      const result = await unitConverter("convert", 100, "cm", "m");
      expect(result.success).toBe(true);
    });

    test("handles list action", async () => {
      const result = await unitConverter("list", 0, "length", "");
      expect(result.success).toBe(true);
    });
  });
});
