import { describe, test, expect, beforeEach } from "bun:test";

// ============================================================
// Utility Tools — Comprehensive Tests
// ============================================================
// Tests for: text-transform, json-tool, cron-explain, hash-tool,
//            regex-tool, unit-converter, qr-code, clipboard-manager

// --- Text Transform ---
import {
  countText,
  detectLanguage,
  extractKeywords,
  changeCase,
  truncate,
  deduplicateLines,
  transformText,
} from "../src/tools/text-transform";

// --- JSON Tool ---
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

// --- Cron Explain ---
import {
  explainCron,
  getNextRuns,
  validateCron,
  cronTool,
} from "../src/tools/cron-explain";

// --- Hash Tool ---
import {
  hashString,
  compareHashes,
  generateToken,
  generateUUID,
  hashAll,
  hashTool,
} from "../src/tools/hash-tool";

// --- Regex Tool ---
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

// --- Unit Converter ---
import { convert, listUnits, unitConverter } from "../src/tools/unit-converter";

// --- QR Code ---
import {
  generateQRSvg,
  wifiQRData,
  vcardQRData,
  qrCodeTool,
} from "../src/tools/qr-code";

// --- Clipboard Manager ---
import {
  save,
  get,
  remove,
  list,
  search,
  getHistory,
  clearAll,
  clipboardTool,
} from "../src/tools/clipboard-manager";

// ############################################################
// Text Transform
// ############################################################

describe("Text Transform", () => {
  describe("countText", () => {
    test("counts characters", () => {
      expect(countText("hello").characters).toBe(5);
    });

    test("counts words", () => {
      expect(countText("hello world foo").words).toBe(3);
    });

    test("counts sentences", () => {
      expect(countText("Hello. World! How?").sentences).toBe(3);
    });

    test("counts paragraphs", () => {
      expect(countText("Para 1\n\nPara 2\n\nPara 3").paragraphs).toBe(3);
    });

    test("counts lines", () => {
      expect(countText("a\nb\nc").lines).toBe(3);
    });

    test("handles empty string", () => {
      const result = countText("");
      expect(result.words).toBe(0);
      expect(result.characters).toBe(0);
    });
  });

  describe("detectLanguage", () => {
    test("detects English", () => {
      expect(detectLanguage("the quick brown fox jumps over the lazy dog")).toBe("en");
    });

    test("detects Chinese characters", () => {
      expect(detectLanguage("你好世界")).toBe("zh");
    });

    test("detects Japanese characters", () => {
      expect(detectLanguage("こんにちは")).toBe("ja");
    });

    test("detects Korean characters", () => {
      expect(detectLanguage("안녕하세요")).toBe("ko");
    });

    test("detects Arabic characters", () => {
      expect(detectLanguage("مرحبا بالعالم")).toBe("ar");
    });

    test("detects Russian characters", () => {
      expect(detectLanguage("Привет мир")).toBe("ru");
    });
  });

  describe("extractKeywords", () => {
    test("extracts keywords from text", () => {
      const keywords = extractKeywords("machine learning and deep learning are important");
      expect(keywords).toContain("machine");
      expect(keywords).toContain("learning");
    });

    test("filters out common stop words", () => {
      const keywords = extractKeywords("the quick brown fox jumps over the lazy dog");
      expect(keywords).not.toContain("the");
      expect(keywords).not.toContain("and");
    });

    test("respects count parameter", () => {
      const keywords = extractKeywords("alpha beta gamma delta epsilon zeta eta theta", 3);
      expect(keywords.length).toBe(3);
    });

    test("returns empty for short stop-word-only text", () => {
      const keywords = extractKeywords("the and or a");
      expect(keywords.length).toBe(0);
    });
  });

  describe("changeCase", () => {
    test("converts to uppercase", () => {
      expect(changeCase("hello", "upper")).toBe("HELLO");
    });

    test("converts to lowercase", () => {
      expect(changeCase("HELLO", "lower")).toBe("hello");
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
      expect(truncate("hello world", 8)).toBe("hello...");
    });

    test("does not truncate short text", () => {
      expect(truncate("hi", 10)).toBe("hi");
    });

    test("uses custom suffix", () => {
      expect(truncate("hello world", 9, "…")).toBe("hello wo…");
    });
  });

  describe("deduplicateLines", () => {
    test("removes duplicate lines", () => {
      expect(deduplicateLines("a\nb\na\nc\nb")).toBe("a\nb\nc");
    });

    test("preserves unique lines", () => {
      expect(deduplicateLines("a\nb\nc")).toBe("a\nb\nc");
    });
  });

  describe("transformText (main entry)", () => {
    test("count action works", async () => {
      const result = await transformText("hello world", "count");
      expect(result.success).toBe(true);
    });

    test("detect_language action works", async () => {
      const result = await transformText("hello world", "detect_language");
      expect(result.success).toBe(true);
    });

    test("unknown action returns error", async () => {
      const result = await transformText("hello", "unknown_action");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown action");
    });
  });
});

// ############################################################
// JSON Tool
// ############################################################

describe("JSON Tool", () => {
  describe("validateJson", () => {
    test("valid JSON returns true", () => {
      expect(validateJson('{"a":1}')).toEqual({ valid: true });
    });

    test("invalid JSON returns false with error", () => {
      const result = validateJson("{invalid}");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("formatJson", () => {
    test("pretty-prints JSON string", () => {
      const result = formatJson('{"a":1,"b":2}');
      expect(result).toContain("\n");
    });

    test("formats object directly", () => {
      const result = formatJson({ a: 1 }, 4);
      expect(result).toContain("    ");
    });
  });

  describe("minifyJson", () => {
    test("minifies JSON", () => {
      expect(minifyJson('{ "a": 1 }')).toBe('{"a":1}');
    });
  });

  describe("flattenJson", () => {
    test("flattens nested object", () => {
      const result = flattenJson({ a: { b: { c: 1 } } });
      expect(result["a.b.c"]).toBe(1);
    });

    test("handles flat objects", () => {
      const result = flattenJson({ x: 1, y: 2 });
      expect(result.x).toBe(1);
    });

    test("preserves arrays as values", () => {
      const result = flattenJson({ a: { b: [1, 2] } });
      expect(result["a.b"]).toEqual([1, 2]);
    });
  });

  describe("unflattenJson", () => {
    test("unflattens dotted keys", () => {
      const result = unflattenJson({ "a.b.c": 1 });
      expect((result.a as any).b.c).toBe(1);
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
    test("queries simple path", () => {
      expect(queryJson({ a: { b: 42 } }, "a.b")).toBe(42);
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
      const keys = getKeys({ a: 1, b: { c: 2 } });
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("b.c");
    });
  });

  describe("jsonTool (main entry)", () => {
    test("validate action works", async () => {
      const result = await jsonTool("validate", '{"a":1}');
      expect(result.success).toBe(true);
    });

    test("unknown action returns error", async () => {
      const result = await jsonTool("unknown", "{}");
      expect(result.success).toBe(false);
    });
  });
});

// ############################################################
// Cron Explain
// ############################################################

describe("Cron Explain", () => {
  describe("explainCron", () => {
    test("explains every minute", () => {
      expect(explainCron("* * * * *")).toBe("Every minute");
    });

    test("explains every hour", () => {
      expect(explainCron("0 * * * *")).toBe("Every hour, at minute 0");
    });

    test("explains midnight daily", () => {
      expect(explainCron("0 0 * * *")).toBe("Every day at midnight (00:00)");
    });

    test("explains weekly Sunday", () => {
      expect(explainCron("0 0 * * 0")).toBe("Every Sunday at midnight");
    });

    test("explains monthly", () => {
      expect(explainCron("0 0 1 * *")).toBe("At midnight on the 1st of every month");
    });

    test("explains yearly", () => {
      expect(explainCron("0 0 1 1 *")).toBe("At midnight on January 1st (yearly)");
    });

    test("reports invalid field count", () => {
      const result = explainCron("* * *");
      expect(result).toContain("Invalid");
    });
  });

  describe("getNextRuns", () => {
    test("returns requested number of runs", () => {
      const runs = getNextRuns("* * * * *", 3);
      expect(runs.length).toBe(3);
    });

    test("returns Date objects", () => {
      const runs = getNextRuns("* * * * *", 1);
      expect(runs[0]).toBeInstanceOf(Date);
    });

    test("returns empty for invalid expression", () => {
      expect(getNextRuns("invalid", 5)).toEqual([]);
    });
  });

  describe("validateCron", () => {
    test("validates correct expression", () => {
      expect(validateCron("0 */2 * * *")).toEqual({ valid: true });
    });

    test("rejects wrong field count", () => {
      const result = validateCron("* *");
      expect(result.valid).toBe(false);
    });
  });

  describe("cronTool (main entry)", () => {
    test("explain action works", async () => {
      const result = await cronTool("explain", "* * * * *");
      expect(result.success).toBe(true);
    });

    test("unknown action returns error", async () => {
      const result = await cronTool("unknown", "* * * * *");
      expect(result.success).toBe(false);
    });
  });
});

// ############################################################
// Hash Tool
// ############################################################

describe("Hash Tool", () => {
  describe("hashString", () => {
    test("produces sha256 by default", () => {
      const hash = hashString("hello");
      expect(hash.length).toBe(64); // sha256 hex = 64 chars
    });

    test("produces md5", () => {
      const hash = hashString("hello", "md5");
      expect(hash.length).toBe(32);
    });

    test("produces sha1", () => {
      const hash = hashString("hello", "sha1");
      expect(hash.length).toBe(40);
    });

    test("produces sha512", () => {
      const hash = hashString("hello", "sha512");
      expect(hash.length).toBe(128);
    });

    test("same input produces same output", () => {
      expect(hashString("test")).toBe(hashString("test"));
    });

    test("different input produces different output", () => {
      expect(hashString("a")).not.toBe(hashString("b"));
    });
  });

  describe("compareHashes", () => {
    test("returns true for identical hashes", () => {
      const h = hashString("test");
      expect(compareHashes(h, h)).toBe(true);
    });

    test("returns false for different hashes", () => {
      expect(compareHashes(hashString("a"), hashString("b"))).toBe(false);
    });

    test("returns false for different-length strings", () => {
      expect(compareHashes("abc", "abcdef")).toBe(false);
    });
  });

  describe("generateToken", () => {
    test("generates hex token of specified length", () => {
      const token = generateToken(16, "hex");
      expect(token.length).toBe(16);
    });

    test("generates unique tokens", () => {
      const t1 = generateToken(32);
      const t2 = generateToken(32);
      expect(t1).not.toBe(t2);
    });

    test("supports base64 encoding", () => {
      const token = generateToken(32, "base64");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof token).toBe("string");
    });

    test("supports base64url encoding", () => {
      const token = generateToken(32, "base64url");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof token).toBe("string");
    });
  });

  describe("generateUUID", () => {
    test("returns valid UUID v4 format", () => {
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    test("generates unique UUIDs", () => {
      expect(generateUUID()).not.toBe(generateUUID());
    });
  });

  describe("hashAll", () => {
    test("returns all 4 hash algorithms", () => {
      const result = hashAll("test");
      expect(result.md5).toBeDefined();
      expect(result.sha1).toBeDefined();
      expect(result.sha256).toBeDefined();
      expect(result.sha512).toBeDefined();
    });
  });

  describe("hashTool (main entry)", () => {
    test("hash action works", async () => {
      const result = await hashTool("hash", "test");
      expect(result.success).toBe(true);
    });

    test("generate_uuid action works", async () => {
      const result = await hashTool("generate_uuid", "");
      expect(result.success).toBe(true);
    });

    test("unknown action returns error", async () => {
      const result = await hashTool("unknown", "test");
      expect(result.success).toBe(false);
    });
  });
});

// ############################################################
// Regex Tool
// ############################################################

describe("Regex Tool", () => {
  describe("testRegex", () => {
    test("finds all matches", () => {
      const result = testRegex("\\d+", "abc 123 def 456");
      expect(result.count).toBe(2);
      expect(result.matches[0].match).toBe("123");
    });

    test("returns match indices", () => {
      const result = testRegex("hello", "say hello to hello");
      expect(result.matches[0].index).toBe(4);
    });

    test("supports named capture groups", () => {
      const result = testRegex("(?<year>\\d{4})-(?<month>\\d{2})", "Date: 2024-01", "g");
      expect(result.matches[0].groups?.year).toBe("2024");
    });
  });

  describe("replaceWithRegex", () => {
    test("replaces all matches", () => {
      const result = replaceWithRegex("\\d+", "a1b2c3", "X");
      expect(result.result).toBe("aXbXcX");
      expect(result.replacements).toBe(3);
    });
  });

  describe("extractCaptures", () => {
    test("extracts capture groups", () => {
      const result = extractCaptures("(\\w+)@(\\w+)", "user@host", "g");
      expect(result[0]).toEqual(["user", "host"]);
    });
  });

  describe("validateRegex", () => {
    test("validates correct regex", () => {
      expect(validateRegex("\\d+")).toEqual({ valid: true });
    });

    test("rejects invalid regex", () => {
      const result = validateRegex("[invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("explainRegex", () => {
    test("explains digit pattern", () => {
      const explanation = explainRegex("\\d+");
      expect(explanation).toContain("digit");
    });

    test("explains start/end anchors", () => {
      const explanation = explainRegex("^hello$");
      expect(explanation).toContain("Start");
      expect(explanation).toContain("End");
    });

    test("returns literal match for simple string", () => {
      const explanation = explainRegex("hello");
      expect(explanation).toContain("literal");
    });
  });

  describe("escapeRegex", () => {
    test("escapes special characters", () => {
      expect(escapeRegex("a.b+c*d")).toBe("a\\.b\\+c\\*d");
    });
  });

  describe("splitWithRegex", () => {
    test("splits text by pattern", () => {
      const result = splitWithRegex("[,;]", "a,b;c");
      expect(result).toEqual(["a", "b", "c"]);
    });
  });

  describe("regexTool (main entry)", () => {
    test("test action works", async () => {
      const result = await regexTool("test", "\\d+", "abc 123");
      expect(result.success).toBe(true);
    });

    test("unknown action returns error", async () => {
      const result = await regexTool("unknown", ".", "text");
      expect(result.success).toBe(false);
    });
  });
});

// ############################################################
// Unit Converter
// ############################################################

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
      expect(result.result!.value).toBeCloseTo(212, 1);
    });

    test("converts Fahrenheit to Celsius", () => {
      const result = convert(32, "F", "C");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(0, 1);
    });

    test("converts Celsius to Kelvin", () => {
      const result = convert(0, "C", "K");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(273.15, 1);
    });

    test("converts kg to pounds", () => {
      const result = convert(1, "kg", "lb");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(2.20462, 3);
    });

    test("converts GB to MB", () => {
      const result = convert(1, "gb", "mb");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBeCloseTo(1024, 0);
    });

    test("converts hours to seconds", () => {
      const result = convert(1, "hr", "s");
      expect(result.success).toBe(true);
      expect(result.result!.value).toBe(3600);
    });

    test("returns error for unknown unit", () => {
      const result = convert(1, "unknown_unit", "m");
      expect(result.success).toBe(false);
    });

    test("includes formatted string", () => {
      const result = convert(1, "km", "m");
      expect(result.result!.formatted).toContain("km");
    });
  });

  describe("listUnits", () => {
    test("lists all categories", () => {
      const units = listUnits();
      expect(units.temperature).toBeDefined();
      expect(units.length).toBeDefined();
      expect(units.weight).toBeDefined();
    });

    test("lists specific category", () => {
      const units = listUnits("temperature");
      expect(units.temperature).toEqual(["C", "F", "K"]);
    });

    test("returns empty for unknown category", () => {
      const units = listUnits("nonexistent");
      expect(Object.keys(units).length).toBe(0);
    });
  });
});

// ############################################################
// QR Code
// ############################################################

describe("QR Code", () => {
  describe("generateQRSvg", () => {
    test("returns valid SVG", () => {
      const svg = generateQRSvg("hello");
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
    });

    test("includes xmlns attribute", () => {
      const svg = generateQRSvg("test");
      expect(svg).toContain("xmlns=");
    });

    test("respects custom size", () => {
      const svg = generateQRSvg("test", { size: 512 });
      expect(svg).toContain('width="512"');
    });

    test("respects custom colors", () => {
      const svg = generateQRSvg("test", { darkColor: "#ff0000" });
      expect(svg).toContain("#ff0000");
    });

    test("generates different SVGs for different data", () => {
      const svg1 = generateQRSvg("data1");
      const svg2 = generateQRSvg("data2");
      expect(svg1).not.toBe(svg2);
    });
  });

  describe("wifiQRData", () => {
    test("generates WiFi QR data string", () => {
      const data = wifiQRData("MyNetwork", "password123");
      expect(data).toContain("WIFI:");
      expect(data).toContain("S:MyNetwork");
      expect(data).toContain("P:password123");
      expect(data).toContain("T:WPA");
    });

    test("supports WEP encryption", () => {
      const data = wifiQRData("Net", "pass", "WEP");
      expect(data).toContain("T:WEP");
    });

    test("supports nopass", () => {
      const data = wifiQRData("OpenNet", "", "nopass");
      expect(data).toContain("T:nopass");
    });
  });

  describe("vcardQRData", () => {
    test("generates vCard data", () => {
      const data = vcardQRData("John Doe", "+1234567890", "john@example.com", "Acme");
      expect(data).toContain("BEGIN:VCARD");
      expect(data).toContain("FN:John Doe");
      expect(data).toContain("TEL:+1234567890");
      expect(data).toContain("EMAIL:john@example.com");
      expect(data).toContain("ORG:Acme");
      expect(data).toContain("END:VCARD");
    });

    test("omits optional fields", () => {
      const data = vcardQRData("Jane");
      expect(data).toContain("FN:Jane");
      expect(data).not.toContain("TEL:");
    });
  });

  describe("qrCodeTool (main entry)", () => {
    test("generate action works", async () => {
      const result = await qrCodeTool("generate", "test");
      expect(result.success).toBe(true);
      expect(result.svg).toContain("<svg");
    });

    test("unknown action returns error", async () => {
      const result = await qrCodeTool("unknown", "data");
      expect(result.success).toBe(false);
    });
  });
});

// ############################################################
// Clipboard Manager
// ############################################################

describe("Clipboard Manager", () => {
  beforeEach(() => {
    clearAll();
  });

  describe("save and get", () => {
    test("saves and retrieves content", () => {
      save("test", "hello world");
      const result = get("test");
      expect(result.success).toBe(true);
      expect(result.entry!.content).toBe("hello world");
    });

    test("get returns error for missing entry", () => {
      const result = get("nonexistent");
      expect(result.success).toBe(false);
    });

    test("auto-detects URL type", () => {
      save("link", "https://example.com");
      const result = get("link");
      expect(result.entry!.type).toBe("url");
    });

    test("auto-detects JSON type", () => {
      save("data", '{"key": "value"}');
      const result = get("data");
      expect(result.entry!.type).toBe("json");
    });

    test("auto-detects code type", () => {
      save("code", "function hello() { return 1; }");
      const result = get("code");
      expect(result.entry!.type).toBe("code");
    });

    test("defaults to text type", () => {
      save("plain", "hello world");
      const result = get("plain");
      expect(result.entry!.type).toBe("text");
    });

    test("increments access count on get", () => {
      clearAll();
      save("counter", "data");
      get("counter");
      get("counter");
      const result = get("counter");
      expect(result.entry!.accessCount).toBe(3);
    });
  });

  describe("remove", () => {
    test("removes an entry", () => {
      save("temp", "data");
      const result = remove("temp");
      expect(result.success).toBe(true);
      expect(get("temp").success).toBe(false);
    });

    test("returns error for missing entry", () => {
      expect(remove("nonexistent").success).toBe(false);
    });
  });

  describe("list", () => {
    test("lists all entries", () => {
      save("a", "data1");
      save("b", "data2");
      const result = list();
      expect(result.entries!.length).toBe(2);
    });

    test("returns empty for no entries", () => {
      const result = list();
      expect(result.entries!.length).toBe(0);
    });
  });

  describe("search", () => {
    test("finds by name", () => {
      save("my-snippet", "code here");
      const result = search("snippet");
      expect(result.entries!.length).toBe(1);
    });

    test("finds by content", () => {
      save("note", "important meeting tomorrow");
      const result = search("meeting");
      expect(result.entries!.length).toBe(1);
    });

    test("returns empty for no matches", () => {
      save("a", "b");
      const result = search("zzzzz");
      expect(result.entries!.length).toBe(0);
    });
  });

  describe("getHistory", () => {
    test("returns history entries", () => {
      save("a", "1");
      save("b", "2");
      const result = getHistory();
      expect(result.entries!.length).toBe(2);
    });

    test("respects limit parameter", () => {
      save("a", "1");
      save("b", "2");
      save("c", "3");
      const result = getHistory(2);
      expect(result.entries!.length).toBe(2);
    });
  });

  describe("clearAll", () => {
    test("removes all entries", () => {
      save("a", "1");
      save("b", "2");
      clearAll();
      expect(list().entries!.length).toBe(0);
    });
  });

  describe("clipboardTool (main entry)", () => {
    test("save action works", async () => {
      const result = await clipboardTool("save", "key", "value");
      expect(result.success).toBe(true);
    });

    test("save without content returns error", async () => {
      const result = await clipboardTool("save", "key");
      expect(result.success).toBe(false);
    });

    test("unknown action returns error", async () => {
      const result = await clipboardTool("unknown", "key");
      expect(result.success).toBe(false);
    });
  });
});
