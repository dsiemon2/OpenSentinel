import { describe, test, expect, beforeEach, mock } from "bun:test";

// ============================================================
// Mock chatWithTools BEFORE importing handlers.
// The handlers.ts file imports from "../../core/brain".
// We mock at the resolved module level.
// ============================================================

let mockChatWithTools: (...args: any[]) => Promise<any>;

mock.module("../src/core/brain", () => ({
  chatWithTools: async (...args: any[]) => mockChatWithTools(...args),
  chat: async () => ({ content: "mock", inputTokens: 0, outputTokens: 0 }),
  SYSTEM_PROMPT: "test",
}));

mock.module("../src/outputs/stt", () => ({
  transcribeAudio: async () => "transcribed voice text",
}));

mock.module("../src/outputs/tts", () => ({
  textToSpeech: async () => Buffer.from("fake-audio-data"),
}));

// Now import handlers — they will receive the mocked brain
import { handleMessage, handleVoice } from "../src/inputs/telegram/handlers";

// ============================================================
// Helper to create a mock Telegram context
// ============================================================

interface MockSession {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

function createMockCtx(text?: string) {
  const replies: Array<{ text: string; opts?: any }> = [];
  const actions: string[] = [];

  const ctx: any = {
    message: text !== undefined ? { text, message_id: 1, voice: undefined } : { message_id: 1 },
    chat: { id: 12345 },
    session: { messages: [] } as MockSession,
    reply: async (msg: string, opts?: any) => {
      replies.push({ text: msg, opts });
    },
    replyWithChatAction: async (action: string) => {
      actions.push(action);
    },
    replyWithVoice: async (_file: any) => {},
    getFile: async () => ({ file_path: "voice/file_0.ogg" }),
    api: { getFile: async (id: string) => ({ file_path: "voice/file_0.ogg" }) },
    _replies: replies,
    _actions: actions,
  };

  return ctx;
}

// ============================================================
// Deep Behavioral Tests — Telegram Handlers
// ============================================================

describe("Telegram Handlers — Deep Behavioral Tests", () => {
  beforeEach(() => {
    // Reset mock to default behavior
    mockChatWithTools = async (messages: any[], _userId?: string, _onToolUse?: Function) => ({
      content: `Mock response for: ${messages[messages.length - 1]?.content || "empty"}`,
      inputTokens: 100,
      outputTokens: 50,
      toolsUsed: undefined,
    });
  });

  // =========================================================
  // handleMessage tests
  // =========================================================

  describe("handleMessage", () => {
    test("adds user message to session.messages", async () => {
      const ctx = createMockCtx("hello world");

      await handleMessage(ctx);

      const userMessages = ctx.session.messages.filter(
        (m: any) => m.role === "user"
      );
      expect(userMessages.length).toBeGreaterThanOrEqual(1);
      expect(userMessages[0].content).toBe("hello world");
    });

    test("adds assistant response to session.messages", async () => {
      const ctx = createMockCtx("hello");

      await handleMessage(ctx);

      const assistantMessages = ctx.session.messages.filter(
        (m: any) => m.role === "assistant"
      );
      expect(assistantMessages.length).toBe(1);
      expect(assistantMessages[0].content).toContain("Mock response for: hello");
    });

    test("sends reply to the user", async () => {
      const ctx = createMockCtx("test message");

      await handleMessage(ctx);

      expect(ctx._replies.length).toBeGreaterThanOrEqual(1);
      // The reply text should contain the mock response
      const replyTexts = ctx._replies.map((r: any) => r.text);
      const combined = replyTexts.join(" ");
      expect(combined).toContain("Mock response for: test message");
    });

    test("shows typing indicator before processing", async () => {
      const ctx = createMockCtx("ping");

      await handleMessage(ctx);

      expect(ctx._actions).toContain("typing");
    });

    test("returns early for undefined text (no message text)", async () => {
      const ctx = createMockCtx(undefined);
      // When text is undefined, ctx.message.text is undefined
      ctx.message = { message_id: 1 }; // no .text property

      await handleMessage(ctx);

      expect(ctx._replies.length).toBe(0);
      expect(ctx._actions.length).toBe(0);
      expect(ctx.session.messages.length).toBe(0);
    });

    test("trims history to MAX_HISTORY (20 messages)", async () => {
      const ctx = createMockCtx("new message");

      // Pre-fill session with 25 messages
      for (let i = 0; i < 25; i++) {
        ctx.session.messages.push({ role: "user", content: `msg-${i}` });
      }

      await handleMessage(ctx);

      // After: 25 old + 1 new user msg = 26, trimmed to 20, then +1 assistant = 21
      // But the code pushes user msg first (26), then trims to 20, then pushes assistant (21)
      expect(ctx.session.messages.length).toBeLessThanOrEqual(21);
      // The oldest messages should have been trimmed
      const contents = ctx.session.messages.map((m: any) => m.content);
      // msg-0 through msg-5 should be gone (first 6 trimmed from 26 -> 20)
      expect(contents).not.toContain("msg-0");
      expect(contents).not.toContain("msg-1");
      expect(contents).not.toContain("msg-2");
      expect(contents).not.toContain("msg-3");
      expect(contents).not.toContain("msg-4");
      expect(contents).not.toContain("msg-5");
    });

    test("includes tool usage info in reply when tools are used", async () => {
      mockChatWithTools = async () => ({
        content: "Here is the search result.",
        inputTokens: 200,
        outputTokens: 100,
        toolsUsed: ["web_search"],
      });

      const ctx = createMockCtx("search for cats");

      await handleMessage(ctx);

      const allReplyText = ctx._replies.map((r: any) => r.text).join(" ");
      expect(allReplyText).toContain("Used: web_search");
      expect(allReplyText).toContain("Here is the search result.");
    });

    test("deduplicates tool names in usage display", async () => {
      mockChatWithTools = async () => ({
        content: "Multiple searches done.",
        inputTokens: 300,
        outputTokens: 150,
        toolsUsed: ["web_search", "web_search", "read_file"],
      });

      const ctx = createMockCtx("research topic");

      await handleMessage(ctx);

      const allReplyText = ctx._replies.map((r: any) => r.text).join(" ");
      // The code uses [...new Set(response.toolsUsed)].join(", ")
      expect(allReplyText).toContain("web_search, read_file");
      // Should not repeat web_search
      const toolLine = allReplyText.split("\n").find((l: string) => l.includes("Used:"));
      expect(toolLine).toBeDefined();
      const matches = toolLine!.match(/web_search/g);
      expect(matches?.length).toBe(1);
    });

    test("handles chatWithTools error gracefully", async () => {
      mockChatWithTools = async () => {
        throw new Error("API key invalid");
      };

      const ctx = createMockCtx("hello");

      await handleMessage(ctx);

      const replyTexts = ctx._replies.map((r: any) => r.text);
      expect(replyTexts.some((t: string) => t.includes("error"))).toBe(true);
    });

    test("session accumulates across multiple calls", async () => {
      const ctx = createMockCtx("first");

      await handleMessage(ctx);

      // Change text for second call
      ctx.message = { text: "second", message_id: 2 };
      await handleMessage(ctx);

      // Change text for third call
      ctx.message = { text: "third", message_id: 3 };
      await handleMessage(ctx);

      // Should have 6 messages: 3 user + 3 assistant
      expect(ctx.session.messages.length).toBe(6);

      const roles = ctx.session.messages.map((m: any) => m.role);
      expect(roles).toEqual([
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
        "assistant",
      ]);

      // Content check
      expect(ctx.session.messages[0].content).toBe("first");
      expect(ctx.session.messages[2].content).toBe("second");
      expect(ctx.session.messages[4].content).toBe("third");
    });

    test("passes chat ID as userId to chatWithTools", async () => {
      let capturedUserId: string | undefined;

      mockChatWithTools = async (_messages: any[], userId?: string) => {
        capturedUserId = userId;
        return {
          content: "response",
          inputTokens: 10,
          outputTokens: 5,
          toolsUsed: undefined,
        };
      };

      const ctx = createMockCtx("test");
      ctx.chat = { id: 98765 };

      await handleMessage(ctx);

      expect(capturedUserId).toBe("98765");
    });

    test("onToolUse callback sends typing action", async () => {
      let capturedOnToolUse: Function | undefined;

      mockChatWithTools = async (
        _messages: any[],
        _userId?: string,
        onToolUse?: Function
      ) => {
        capturedOnToolUse = onToolUse;
        // Simulate tool use callback
        if (onToolUse) await onToolUse("web_search", {});
        return {
          content: "done",
          inputTokens: 10,
          outputTokens: 5,
          toolsUsed: ["web_search"],
        };
      };

      const ctx = createMockCtx("search");

      await handleMessage(ctx);

      // First typing action is from handleMessage itself,
      // the second one is from the onToolUse callback
      const typingCount = ctx._actions.filter(
        (a: string) => a === "typing"
      ).length;
      expect(typingCount).toBeGreaterThanOrEqual(2);
    });

    test("passes full message history to chatWithTools", async () => {
      let capturedMessages: any[] = [];

      mockChatWithTools = async (messages: any[]) => {
        // Clone messages at the time of the call to avoid reference mutation
        capturedMessages = messages.map((m: any) => ({ ...m }));
        return {
          content: "response",
          inputTokens: 10,
          outputTokens: 5,
          toolsUsed: undefined,
        };
      };

      const ctx = createMockCtx("hello");
      // Pre-fill with some history
      ctx.session.messages.push({ role: "user", content: "previous" });
      ctx.session.messages.push({
        role: "assistant",
        content: "previous reply",
      });

      await handleMessage(ctx);

      // Should have: previous, previous reply, hello (captured before assistant is appended)
      expect(capturedMessages.length).toBe(3);
      expect(capturedMessages[0].content).toBe("previous");
      expect(capturedMessages[1].content).toBe("previous reply");
      expect(capturedMessages[2].content).toBe("hello");
    });

    test("reply uses Markdown parse_mode by default", async () => {
      const ctx = createMockCtx("hello");

      await handleMessage(ctx);

      // sendResponse tries Markdown first
      expect(ctx._replies.length).toBeGreaterThanOrEqual(1);
      expect(ctx._replies[0].opts?.parse_mode).toBe("Markdown");
    });

    test("no tool usage line when toolsUsed is undefined", async () => {
      mockChatWithTools = async () => ({
        content: "plain response",
        inputTokens: 10,
        outputTokens: 5,
        toolsUsed: undefined,
      });

      const ctx = createMockCtx("hello");

      await handleMessage(ctx);

      const allReplyText = ctx._replies.map((r: any) => r.text).join(" ");
      expect(allReplyText).not.toContain("Used:");
      expect(allReplyText).toContain("plain response");
    });

    test("no tool usage line when toolsUsed is empty array", async () => {
      mockChatWithTools = async () => ({
        content: "no tools used",
        inputTokens: 10,
        outputTokens: 5,
        toolsUsed: [],
      });

      const ctx = createMockCtx("hello");

      await handleMessage(ctx);

      const allReplyText = ctx._replies.map((r: any) => r.text).join(" ");
      expect(allReplyText).not.toContain("Used:");
    });

    test("error reply does not add assistant message to session", async () => {
      mockChatWithTools = async () => {
        throw new Error("Boom");
      };

      const ctx = createMockCtx("hello");

      await handleMessage(ctx);

      // Only user message should be in session; no assistant message from the error path
      const assistantMessages = ctx.session.messages.filter(
        (m: any) => m.role === "assistant"
      );
      expect(assistantMessages.length).toBe(0);
      // But user message was added before the try block
      const userMessages = ctx.session.messages.filter(
        (m: any) => m.role === "user"
      );
      expect(userMessages.length).toBe(1);
    });
  });

  // =========================================================
  // handleVoice tests — limited since we can't easily mock fetch
  // =========================================================

  describe("handleVoice", () => {
    test("returns early when no voice in message", async () => {
      const ctx = createMockCtx("text only");
      ctx.message = { message_id: 1 }; // no voice property

      await handleVoice(ctx);

      expect(ctx._replies.length).toBe(0);
      expect(ctx._actions.length).toBe(0);
    });

    test("shows typing indicator for voice messages", async () => {
      const ctx = createMockCtx(undefined);
      ctx.message = {
        message_id: 1,
        voice: { file_id: "voice123", duration: 5 },
      };

      // handleVoice will try to fetch the file URL which won't work in test
      // so we expect it to hit the error handler
      await handleVoice(ctx);

      // Typing should still have been called before the error
      expect(ctx._actions).toContain("typing");
    });

    test("voice processing produces at least one reply (success or error)", async () => {
      const ctx = createMockCtx(undefined);
      ctx.message = {
        message_id: 1,
        voice: { file_id: "voice123", duration: 5 },
      };

      await handleVoice(ctx);

      // Whether the fetch succeeds or fails, the handler should
      // always produce at least one reply to the user
      expect(ctx._replies.length).toBeGreaterThanOrEqual(1);
    });

    test("voice handler with no voice property in message returns early", async () => {
      const ctx = createMockCtx(undefined);
      ctx.message = { message_id: 1 }; // no voice

      await handleVoice(ctx);

      expect(ctx._replies.length).toBe(0);
      expect(ctx.session.messages.length).toBe(0);
    });
  });
});
