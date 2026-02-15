import { describe, test, expect } from "bun:test";

// ============================================
// Intent Parser — Local command handling
// ============================================

describe("Intent Parser", () => {
  describe("Module exports", () => {
    test("should export IntentParser class", async () => {
      const mod = await import("../src/core/brain/intent-parser");
      expect(typeof mod.IntentParser).toBe("function");
    });

    test("should export intentParser singleton", async () => {
      const mod = await import("../src/core/brain/intent-parser");
      expect(mod.intentParser).toBeDefined();
    });
  });

  describe("parseIntent - time", () => {
    test("should handle 'what time is it'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("what time is it?");
      expect(result).not.toBeNull();
      expect(result!.intent).toBe("time");
      expect(result!.handled).toBe(true);
      expect(result!.response).toContain(":");
    });

    test("should handle 'current time'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("current time");
      expect(result?.intent).toBe("time");
    });

    test("should handle 'time'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("time");
      expect(result?.intent).toBe("time");
    });
  });

  describe("parseIntent - date", () => {
    test("should handle 'what date is today'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("what date is today?");
      expect(result?.intent).toBe("date");
      expect(result?.response).toBeTruthy();
    });

    test("should handle 'today's date'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("today's date");
      expect(result?.intent).toBe("date");
    });
  });

  describe("parseIntent - greeting", () => {
    test("should handle 'hello'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("hello");
      expect(result?.intent).toBe("greeting");
      expect(result?.response).toBeTruthy();
    });

    test("should handle 'hi'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("hi");
      expect(result?.intent).toBe("greeting");
    });

    test("should handle 'hey!'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("hey!");
      expect(result?.intent).toBe("greeting");
    });

    test("should handle 'good morning'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("good morning");
      expect(result?.intent).toBe("greeting");
    });
  });

  describe("parseIntent - status", () => {
    test("should handle 'status'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("status");
      expect(result?.intent).toBe("status");
      expect(result?.response).toContain("operational");
    });

    test("should handle 'how are you'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("how are you?");
      expect(result?.intent).toBe("status");
    });
  });

  describe("parseIntent - help", () => {
    test("should handle 'help'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("help");
      expect(result?.intent).toBe("help");
      expect(result?.response).toContain("can help");
    });

    test("should handle 'what can you do'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("what can you do?");
      expect(result?.intent).toBe("help");
    });
  });

  describe("parseIntent - thanks", () => {
    test("should handle 'thanks'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("thanks");
      expect(result?.intent).toBe("thanks");
    });

    test("should handle 'thank you!'", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("thank you!");
      expect(result?.intent).toBe("thanks");
    });
  });

  describe("parseIntent - no match", () => {
    test("should return null for complex queries", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const result = parser.parseIntent("Can you help me write a sorting algorithm in Python?");
      expect(result).toBeNull();
    });

    test("should return null for empty string", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      expect(parser.parseIntent("")).toBeNull();
    });

    test("should return null for long messages", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const longMsg = "Please help me " + "with a very complex task ".repeat(10);
      expect(parser.parseIntent(longMsg)).toBeNull();
    });

    test("should return null when disabled", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser(false);
      expect(parser.parseIntent("hello")).toBeNull();
    });
  });

  describe("configuration", () => {
    test("should list supported intents", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      const intents = parser.getSupportedIntents();
      expect(intents).toContain("time");
      expect(intents).toContain("date");
      expect(intents).toContain("greeting");
      expect(intents).toContain("status");
      expect(intents).toContain("help");
      expect(intents).toContain("thanks");
    });

    test("should report pattern count", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      expect(parser.getPatternCount()).toBeGreaterThan(15);
    });

    test("should toggle enabled", async () => {
      const { IntentParser } = await import("../src/core/brain/intent-parser");
      const parser = new IntentParser();
      parser.setEnabled(false);
      expect(parser.isEnabled()).toBe(false);
    });
  });
});
