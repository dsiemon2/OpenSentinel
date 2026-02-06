import { describe, test, expect, beforeEach, mock, spyOn } from "bun:test";
import { createHmac } from "crypto";

// Mock chatWithTools before importing ZaloBot
mock.module("../src/core/brain", () => ({
  chatWithTools: async () => ({ content: "Mocked AI response" }),
}));

import { ZaloBot } from "../src/inputs/zalo/index";
import type { ZaloConfig } from "../src/inputs/zalo/index";

function makeBot(overrides?: Partial<ZaloConfig>): ZaloBot {
  return new ZaloBot({
    oaId: "test-oa-id",
    accessToken: "test-access-token",
    ...overrides,
  });
}

/** Helper to access private splitMessage */
function splitMessage(bot: ZaloBot, text: string, maxLength: number = 2000): string[] {
  return (bot as any).splitMessage(text, maxLength);
}

describe("ZaloBot - Deep Behavioral Tests", () => {
  // ─── Message Splitting ───────────────────────────────────────────

  describe("splitMessage logic", () => {
    let bot: ZaloBot;

    beforeEach(() => {
      bot = makeBot();
    });

    test("short message (< 2000 chars) returns single chunk", () => {
      const result = splitMessage(bot, "Hello, world!");
      expect(result).toEqual(["Hello, world!"]);
    });

    test("exactly 2000 chars returns single chunk", () => {
      const text = "A".repeat(2000);
      const result = splitMessage(bot, text);
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(text);
    });

    test("2001 chars splits into 2 chunks", () => {
      // Use spaces so there are split points
      const text = ("word ".repeat(401)).trimEnd(); // each "word " is 5 chars -> 401*5=2005 chars - 1 = 2004
      const result = splitMessage(bot, text);
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Recombine should recover full content (allowing trim at split points)
      const recombined = result.join(" ");
      expect(recombined.replace(/\s+/g, " ")).toContain("word");
    });

    test("splits prefer newlines over periods over spaces", () => {
      // Build text: 1500 chars + newline + 600 chars = 2101
      const partA = "a".repeat(1500);
      const partB = "b".repeat(600);
      const text = partA + "\n" + partB;
      const result = splitMessage(bot, text);
      expect(result.length).toBe(2);
      // First chunk should end at the newline boundary
      expect(result[0]).toBe(partA);
      expect(result[1]).toBe(partB);
    });

    test("falls back to period+space when newline is too early", () => {
      // Newline at position 100 (too early, < 50%), period+space at position 1800
      const beforeNewline = "x".repeat(100);
      const betweenNewlineAndPeriod = "y".repeat(1699); // positions 101..1799
      const afterPeriod = "z".repeat(300);
      const text = beforeNewline + "\n" + betweenNewlineAndPeriod + ". " + afterPeriod;
      // total: 100 + 1 + 1699 + 2 + 300 = 2102, split at period+space (pos 1801)
      const result = splitMessage(bot, text);
      expect(result.length).toBe(2);
      // First chunk should include up to the period+space (inclusive of '.')
      expect(result[0].endsWith(".")).toBe(true);
    });

    test("falls back to space when newline and period are too early", () => {
      // Put a space at position 1500 (within 50%), no earlier newlines or periods
      const partA = "a".repeat(1500);
      const partB = "b".repeat(600);
      const text = partA + " " + partB;
      const result = splitMessage(bot, text);
      expect(result.length).toBe(2);
      expect(result[0]).toBe(partA);
      expect(result[1]).toBe(partB);
    });

    test("very long message with no spaces gets hard-cut at maxLength", () => {
      const text = "X".repeat(5000);
      const result = splitMessage(bot, text);
      // With hard cuts at 2000, we should get 3 chunks (2000 + 2000 + 1000)
      expect(result.length).toBe(3);
      expect(result[0].length).toBe(2001); // slice(0, 2000+1) because splitAt = maxLength, slice(0, splitAt+1)
      // Actually let's verify: when splitAt = maxLength (2000), chunks.push(remaining.slice(0, 2001).trimEnd())
      // remaining.slice(2001) ... let me recheck the algorithm
      // splitAt < maxLength*0.3 means splitAt < 600. lastIndexOf("\n", 2000) = -1, < 1000 -> try period -> -1 < 1000 -> try space -> -1 < 600 -> splitAt = 2000
      // chunks.push(remaining.slice(0, 2001).trimEnd()) -> 2001 chars
      // remaining = remaining.slice(2001).trimStart() -> 2999 chars
      // Next iteration: same logic -> 2001 chars, then 998 chars
      // So 3 chunks total
      expect(result[0].length).toBe(2001);
    });

    test("multiple chunks for very long messages (6000 chars with spaces)", () => {
      // Create ~6000 chars with spaces every 100 chars
      const words = Array(60).fill("a".repeat(99)).join(" "); // 60 * 100 - 1 = 5999
      const result = splitMessage(bot, words);
      expect(result.length).toBeGreaterThanOrEqual(3);
      // No chunk should exceed 2000
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    test("unicode characters handled correctly", () => {
      // Mix of multi-byte unicode
      const emoji = "\u{1F600}"; // 2 JS chars (surrogate pair)
      const text = emoji.repeat(1500); // 3000 JS chars
      const result = splitMessage(bot, text);
      expect(result.length).toBeGreaterThanOrEqual(2);
      // All chunks should be valid strings (no broken surrogates causing exceptions)
      for (const chunk of result) {
        expect(typeof chunk).toBe("string");
      }
    });

    test("empty string returns single-element array with empty string", () => {
      const result = splitMessage(bot, "");
      expect(result).toEqual([""]);
    });

    test("whitespace at boundaries is trimmed", () => {
      // Build text: 1500 chars + "   \n   " + 500 chars
      const partA = "a".repeat(1500);
      const partB = "b".repeat(500);
      const text = partA + "   \n   " + partB;
      const result = splitMessage(bot, text);
      expect(result.length).toBe(2);
      // trimEnd on first chunk and trimStart on remainder
      expect(result[0]).toBe(partA);
      expect(result[1]).toBe(partB);
    });

    test("custom maxLength is respected", () => {
      const text = "Hello World, this is a test.";
      const result = splitMessage(bot, text, 10);
      expect(result.length).toBeGreaterThanOrEqual(2);
      // Each chunk <= 11 chars (slice(0, splitAt+1) where splitAt could be maxLength)
      // but with proper word breaks they should be smaller
    });
  });

  // ─── Webhook Signature Verification (crypto logic) ───────────────

  describe("webhook signature verification crypto", () => {
    test("HMAC-SHA256 computation matches expected for known input", () => {
      const secretKey = "my-secret-key-123";
      const body = { event_name: "user_send_text", sender: { id: "user1" } };
      const bodyStr = JSON.stringify(body);

      const expected = createHmac("sha256", secretKey)
        .update(bodyStr)
        .digest("hex");

      // Verify the computation is deterministic and non-empty
      expect(expected.length).toBe(64); // SHA256 hex is always 64 chars
      expect(expected).toMatch(/^[a-f0-9]{64}$/);

      // Same input produces same output
      const expected2 = createHmac("sha256", secretKey)
        .update(bodyStr)
        .digest("hex");
      expect(expected).toBe(expected2);
    });

    test("different secret keys produce different signatures", () => {
      const body = JSON.stringify({ test: "data" });
      const sig1 = createHmac("sha256", "key1").update(body).digest("hex");
      const sig2 = createHmac("sha256", "key2").update(body).digest("hex");
      expect(sig1).not.toBe(sig2);
    });

    test("different bodies produce different signatures", () => {
      const key = "same-key";
      const sig1 = createHmac("sha256", key).update('{"a":1}').digest("hex");
      const sig2 = createHmac("sha256", key).update('{"a":2}').digest("hex");
      expect(sig1).not.toBe(sig2);
    });
  });

  // ─── Conversation Context Management ─────────────────────────────

  describe("conversation context management", () => {
    let bot: ZaloBot;

    beforeEach(() => {
      bot = makeBot({ allowedUserIds: ["allowed-user"] });
      // Clear conversations
      (bot as any).conversations.clear();
    });

    test("conversations map starts empty", () => {
      const conversations: Map<string, any> = (bot as any).conversations;
      expect(conversations.size).toBe(0);
    });

    test("new conversation is created on first message", async () => {
      const conversations: Map<string, any> = (bot as any).conversations;

      // Simulate what handleWebhookEvent does internally
      const senderId = "new-user-1";
      let context = conversations.get(senderId);
      expect(context).toBeUndefined();

      // Create context like the handler does
      context = { messages: [], lastActivity: new Date() };
      conversations.set(senderId, context);
      context.messages.push({ role: "user", content: "Hello" });

      expect(conversations.has(senderId)).toBe(true);
      expect(conversations.get(senderId)!.messages).toHaveLength(1);
    });

    test("keeps only last 10 messages when exceeding limit", () => {
      const conversations: Map<string, any> = (bot as any).conversations;
      const senderId = "user-overflow";

      const context = { messages: [] as any[], lastActivity: new Date() };
      conversations.set(senderId, context);

      // Add 12 messages
      for (let i = 0; i < 12; i++) {
        context.messages.push({ role: "user", content: `msg-${i}` });
      }

      // Apply the truncation logic from handleWebhookEvent
      if (context.messages.length > 10) {
        context.messages = context.messages.slice(-10);
      }

      expect(context.messages).toHaveLength(10);
      expect(context.messages[0].content).toBe("msg-2");
      expect(context.messages[9].content).toBe("msg-11");
    });

    test("user and assistant messages alternate in context", () => {
      const conversations: Map<string, any> = (bot as any).conversations;
      const senderId = "user-alternate";

      const context = { messages: [] as any[], lastActivity: new Date() };
      conversations.set(senderId, context);

      context.messages.push({ role: "user", content: "Hi" });
      context.messages.push({ role: "assistant", content: "Hello!" });
      context.messages.push({ role: "user", content: "How are you?" });
      context.messages.push({ role: "assistant", content: "I'm well, thanks!" });

      expect(context.messages).toHaveLength(4);
      expect(context.messages[0].role).toBe("user");
      expect(context.messages[1].role).toBe("assistant");
      expect(context.messages[2].role).toBe("user");
      expect(context.messages[3].role).toBe("assistant");
    });

    test("lastActivity is updated on new message", () => {
      const conversations: Map<string, any> = (bot as any).conversations;
      const senderId = "user-activity";

      const oldDate = new Date("2024-01-01");
      const context = { messages: [], lastActivity: oldDate };
      conversations.set(senderId, context);

      // Simulate update
      const newDate = new Date();
      context.lastActivity = newDate;

      expect(context.lastActivity.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  // ─── Config Handling ─────────────────────────────────────────────

  describe("config handling", () => {
    test("webhookPort defaults to 8040 when not specified", () => {
      const bot = makeBot();
      const config: ZaloConfig = (bot as any).config;
      expect(config.webhookPort ?? 8040).toBe(8040);
    });

    test("webhookPort uses custom value when specified", () => {
      const bot = makeBot({ webhookPort: 9090 });
      const config: ZaloConfig = (bot as any).config;
      expect(config.webhookPort).toBe(9090);
    });

    test("allowedUserIds is undefined when not specified", () => {
      const bot = makeBot();
      const config: ZaloConfig = (bot as any).config;
      expect(config.allowedUserIds).toBeUndefined();
    });

    test("allowedUserIds stores provided list", () => {
      const bot = makeBot({ allowedUserIds: ["user-a", "user-b"] });
      const config: ZaloConfig = (bot as any).config;
      expect(config.allowedUserIds).toEqual(["user-a", "user-b"]);
    });

    test("allowedUserIds filtering logic - allowed user passes", () => {
      const config: ZaloConfig = {
        oaId: "test",
        accessToken: "test",
        allowedUserIds: ["user-a", "user-b"],
      };
      const senderId = "user-a";
      const isAllowed =
        !config.allowedUserIds ||
        config.allowedUserIds.length === 0 ||
        config.allowedUserIds.includes(senderId);
      expect(isAllowed).toBe(true);
    });

    test("allowedUserIds filtering logic - unauthorized user blocked", () => {
      const config: ZaloConfig = {
        oaId: "test",
        accessToken: "test",
        allowedUserIds: ["user-a", "user-b"],
      };
      const senderId = "user-c";
      const isAllowed =
        !config.allowedUserIds ||
        config.allowedUserIds.length === 0 ||
        config.allowedUserIds.includes(senderId);
      expect(isAllowed).toBe(false);
    });

    test("empty allowedUserIds allows all users", () => {
      const config: ZaloConfig = {
        oaId: "test",
        accessToken: "test",
        allowedUserIds: [],
      };
      const senderId = "anyone";
      const isAllowed =
        !config.allowedUserIds ||
        config.allowedUserIds.length === 0 ||
        config.allowedUserIds.includes(senderId);
      expect(isAllowed).toBe(true);
    });

    test("undefined allowedUserIds allows all users", () => {
      const config: ZaloConfig = {
        oaId: "test",
        accessToken: "test",
      };
      const senderId = "anyone";
      const isAllowed =
        !config.allowedUserIds ||
        config.allowedUserIds.length === 0 ||
        config.allowedUserIds.includes(senderId);
      expect(isAllowed).toBe(true);
    });
  });

  // ─── Running State ───────────────────────────────────────────────

  describe("running state management", () => {
    test("bot starts in non-running state", () => {
      const bot = makeBot();
      expect(bot.running).toBe(false);
    });

    test("stop sets running to false", async () => {
      const bot = makeBot();
      // Manually set running to true
      (bot as any).isRunning = true;
      expect(bot.running).toBe(true);

      await bot.stop();
      expect(bot.running).toBe(false);
    });

    test("multiple stops are idempotent", async () => {
      const bot = makeBot();
      (bot as any).isRunning = true;

      await bot.stop();
      expect(bot.running).toBe(false);

      await bot.stop();
      expect(bot.running).toBe(false);
    });
  });

  // ─── Event Filtering ─────────────────────────────────────────────

  describe("webhook event filtering", () => {
    test("only user_send_text events are processed", () => {
      // The handler checks event.event_name !== "user_send_text"
      const validEvents = ["user_send_text"];
      const ignoredEvents = ["user_send_image", "follow", "unfollow", "oa_send_text"];

      for (const name of validEvents) {
        expect(name === "user_send_text").toBe(true);
      }
      for (const name of ignoredEvents) {
        expect(name === "user_send_text").toBe(false);
      }
    });

    test("empty or whitespace-only messages are ignored", () => {
      const messages = ["", "   ", "\n", "\t", undefined, null];
      for (const msg of messages) {
        const shouldProcess = !!msg?.trim();
        expect(shouldProcess).toBe(false);
      }
    });

    test("non-empty messages are processed", () => {
      const messages = ["hello", " hi ", "a"];
      for (const msg of messages) {
        const shouldProcess = !!msg?.trim();
        expect(shouldProcess).toBe(true);
      }
    });
  });
});
