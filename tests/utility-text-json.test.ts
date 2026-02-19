import { describe, test, expect } from "bun:test";

// ============================================================
// Text Transform + JSON Tool Tests
// ============================================================

import {
  countText,
  detectLanguage,
  extractKeywords,
  changeCase,
  truncate,
  deduplicateLines,
  transformText,
} from "../src/tools/text-transform";

import {
  validateJson,
  formatJson,
  minifyJson,
  flattenJson,
  unflattenJson,
  diffJson,
  queryJson,
  getKeys,
  jsonTool,
} from "../src/tools/json-tool";

describe("Text Transform", () => {
  describe("countText", () => {
    test("counts words in a sentence", () => {
      const result = countText("Hello world foo bar");
      expect(result.words).toBe(4);
    });

    test("counts characters", () => {
      const result = countText("Hello");
      expect(result.characters).toBe(5);
    });

    test("counts sentences", () => {
      const result = countText("First sentence. Second sentence! Third?");
      expect(result.sentences).toBe(3);
    });

    test("counts paragraphs", () => {
      const result = countText("Paragraph 1\n\nParagraph 2\n\nParagraph 3");
      expect(result.paragraphs).toBe(3);
    });

    test("counts lines", () => {
      const result = countText("Line 1\nLine 2\nLine 3");
      expect(result.lines).toBe(3);
    });

    test("handles empty string", () => {
      const result = countText("");
      expect(result.words).toBe(0);
      expect(result.characters).toBe(0);
    });
  });

  describe("detectLanguage", () => {
    test("detects English", () => {
      expect(detectLanguage("the cat is in the house and the dog")).toBe("en");
    });

    test("detects Chinese characters", () => {
      expect(detectLanguage("这是中文文本")).toBe("zh");
    });

    test("detects Japanese characters", () => {
      expect(detectLanguage("これはテストです")).toBe("ja");
    });

    test("detects Korean characters", () => {
      expect(detectLanguage("안녕하세요")).toBe("ko");
    });

    test("detects Arabic characters", () => {
      expect(detectLanguage("مرحبا بالعالم")).toBe("ar");
    });

    test("detects Russian/Cyrillic characters", () => {
      expect(detectLanguage("Привет мир")).toBe("ru");
    });
  });

  describe("extractKeywords", () => {
    test("extracts top keywords from text", () => {
      const keywords = extractKeywords(
        "machine learning uses algorithms for machine intelligence in machine applications",
        5
      );
      expect(keywords.length).toBeLessThanOrEqual(5);
      expect(keywords).toContain("machine");
    });

    test("filters out stop words", () => {
      const keywords = extractKeywords("the quick brown fox jumps over the lazy dog");
      expect(keywords).not.toContain("the");
      expect(keywords).not.toContain("a");
    });

    test("respects count parameter", () => {
      const keywords = extractKeywords("one two three four five six seven", 3);
      expect(keywords.length).toBeLessThanOrEqual(3);
    });
  });

  describe("changeCase", () => {
    test("converts to upper case", () => {
      expect(changeCase("hello world", "upper")).toBe("HELLO WORLD");
    });

    test("converts to lower case", () => {
      expect(changeCase("HELLO WORLD", "lower")).toBe("hello world");
    });

    test("converts to title case", () => {
      expect(changeCase("hello world", "title")).toBe("Hello World");
    });

    test("converts to sentence case", () => {
      expect(changeCase("HELLO WORLD", "sentence")).toBe("Hello world");
    });

    test("converts to camelCase", () => {
      expect(changeCase("hello world", "camel")).toBe("helloWorld");
    });

    test("converts to snake_case", () => {
      expect(changeCase("hello world", "snake")).toBe("hello_world");
    });

    test("converts to kebab-case", () => {
      expect(changeCase("hello world", "kebab")).toBe("hello-world");
    });
  });

  describe("truncate", () => {
    test("truncates long text", () => {
      const result = truncate("This is a very long text", 10);
      expect(result.length).toBeLessThanOrEqual(10);
      expect(result).toContain("...");
    });

    test("returns text as-is if short enough", () => {
      expect(truncate("short", 10)).toBe("short");
    });

    test("uses custom suffix", () => {
      const result = truncate("This is a long text", 10, "…");
      expect(result.endsWith("…")).toBe(true);
    });
  });

  describe("deduplicateLines", () => {
    test("removes duplicate lines", () => {
      const result = deduplicateLines("line1\nline2\nline1\nline3");
      expect(result).toBe("line1\nline2\nline3");
    });

    test("preserves order", () => {
      const result = deduplicateLines("c\nb\na\nb");
      expect(result).toBe("c\nb\na");
    });
  });

  describe("transformText (main entry)", () => {
    test("handles count action", async () => {
      const result = await transformText("hello world", "count");
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await transformText("text", "unknown_action");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown action");
    });
  });
});

describe("JSON Tool", () => {
  describe("validateJson", () => {
    test("validates valid JSON", () => {
      expect(validateJson('{"key": "value"}')).toEqual({ valid: true });
    });

    test("rejects invalid JSON", () => {
      const result = validateJson("{invalid}");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("formatJson", () => {
    test("formats JSON string with indentation", () => {
      const result = formatJson('{"a":1,"b":2}');
      expect(result).toContain("\n");
      expect(result).toContain("  ");
    });

    test("accepts object input", () => {
      const result = formatJson({ a: 1 });
      expect(result).toContain('"a"');
    });

    test("respects custom indent", () => {
      const result = formatJson('{"a":1}', 4);
      expect(result).toContain("    ");
    });
  });

  describe("minifyJson", () => {
    test("minifies JSON", () => {
      const result = minifyJson('{\n  "a": 1,\n  "b": 2\n}');
      expect(result).toBe('{"a":1,"b":2}');
    });
  });

  describe("flattenJson", () => {
    test("flattens nested object", () => {
      const result = flattenJson({ a: { b: { c: 1 } } });
      expect(result["a.b.c"]).toBe(1);
    });

    test("handles arrays without flattening", () => {
      const result = flattenJson({ a: [1, 2, 3] });
      expect(result["a"]).toEqual([1, 2, 3]);
    });

    test("handles flat object", () => {
      const result = flattenJson({ a: 1, b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe("unflattenJson", () => {
    test("unflattens dot-notation keys", () => {
      const result = unflattenJson({ "a.b.c": 1 });
      expect((result as any).a.b.c).toBe(1);
    });

    test("roundtrips with flattenJson", () => {
      const original = { a: { b: 1 }, c: { d: 2 } };
      const flattened = flattenJson(original);
      const unflattened = unflattenJson(flattened);
      expect(unflattened).toEqual(original);
    });
  });

  describe("diffJson", () => {
    test("returns empty for identical objects", () => {
      expect(diffJson({ a: 1 }, { a: 1 })).toEqual([]);
    });

    test("detects added keys", () => {
      const diffs = diffJson({ a: 1 }, { a: 1, b: 2 });
      expect(diffs.some((d) => d.type === "added" && d.path === "b")).toBe(true);
    });

    test("detects removed keys", () => {
      const diffs = diffJson({ a: 1, b: 2 }, { a: 1 });
      expect(diffs.some((d) => d.type === "removed" && d.path === "b")).toBe(true);
    });

    test("detects changed values", () => {
      const diffs = diffJson({ a: 1 }, { a: 2 });
      expect(diffs.some((d) => d.type === "changed")).toBe(true);
    });
  });

  describe("queryJson", () => {
    test("queries nested path", () => {
      expect(queryJson({ a: { b: { c: 42 } } }, "a.b.c")).toBe(42);
    });

    test("queries array index", () => {
      expect(queryJson({ items: [10, 20, 30] }, "items[1]")).toBe(20);
    });

    test("returns undefined for missing path", () => {
      expect(queryJson({ a: 1 }, "b.c")).toBeUndefined();
    });
  });

  describe("getKeys", () => {
    test("returns all keys recursively", () => {
      const keys = getKeys({ a: 1, b: { c: 2, d: { e: 3 } } });
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("b.c");
      expect(keys).toContain("b.d");
      expect(keys).toContain("b.d.e");
    });

    test("returns empty for non-object", () => {
      expect(getKeys(null)).toEqual([]);
      expect(getKeys(42)).toEqual([]);
    });
  });

  describe("jsonTool (main entry)", () => {
    test("handles validate action", async () => {
      const result = await jsonTool("validate", '{"a":1}');
      expect(result.success).toBe(true);
    });

    test("handles unknown action", async () => {
      const result = await jsonTool("unknown", "{}");
      expect(result.success).toBe(false);
    });
  });
});
