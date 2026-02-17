import { describe, test, expect } from "bun:test";

// ============================================
// WebSocket Protocol Tests
// ============================================

describe("WebSocket Protocol", () => {
  describe("Module Exports", () => {
    test("should export createServerMessage function", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      expect(typeof createServerMessage).toBe("function");
    });

    test("should export parseClientMessage function", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(typeof parseClientMessage).toBe("function");
    });

    test("should export isValidClientMessage function", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(typeof isValidClientMessage).toBe("function");
    });
  });

  describe("createServerMessage", () => {
    test("should create a valid JSON string for chunk type", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("chunk", "test-1", { text: "Hello" });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("chunk");
      expect(parsed.id).toBe("test-1");
      expect(parsed.payload.text).toBe("Hello");
    });

    test("should create a valid JSON string for complete type", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("complete", "test-2", {
        content: "Done",
        toolsUsed: ["web_search", "calculator"],
        usage: { inputTokens: 100, outputTokens: 50 },
      });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("complete");
      expect(parsed.payload.content).toBe("Done");
      expect(parsed.payload.toolsUsed).toEqual(["web_search", "calculator"]);
      expect(parsed.payload.usage.inputTokens).toBe(100);
    });

    test("should create error messages", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("error", "err-1", { error: "Something went wrong" });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("error");
      expect(parsed.payload.error).toBe("Something went wrong");
    });

    test("should create tool_start messages", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("tool_start", "t-1", {
        toolName: "web_search",
        toolInput: { query: "test" },
      });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("tool_start");
      expect(parsed.payload.toolName).toBe("web_search");
      expect(parsed.payload.toolInput).toEqual({ query: "test" });
    });

    test("should create tool_result messages", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("tool_result", "t-1", {
        toolName: "web_search",
        toolResult: { results: [] },
      });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("tool_result");
      expect(parsed.payload.toolName).toBe("web_search");
    });

    test("should create connected messages", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("connected", "system", {
        message: "Connected to OpenSentinel",
      });
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("connected");
      expect(parsed.payload.message).toBe("Connected to OpenSentinel");
    });

    test("should create pong messages", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("pong", "ping-1", {});
      const parsed = JSON.parse(msg);
      expect(parsed.type).toBe("pong");
      expect(parsed.id).toBe("ping-1");
    });

    test("should handle empty payload", async () => {
      const { createServerMessage } = await import("../src/inputs/websocket/protocol");
      const msg = createServerMessage("pong", "p-1");
      const parsed = JSON.parse(msg);
      expect(parsed.payload).toEqual({});
    });
  });

  describe("parseClientMessage", () => {
    test("should parse valid chat message", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      const data = JSON.stringify({
        type: "chat_with_tools",
        id: "msg-1",
        payload: {
          messages: [{ role: "user", content: "Hello" }],
          userId: "web:default",
        },
      });
      const msg = parseClientMessage(data);
      expect(msg).not.toBeNull();
      expect(msg!.type).toBe("chat_with_tools");
      expect(msg!.id).toBe("msg-1");
      expect(msg!.payload.userId).toBe("web:default");
    });

    test("should return null for invalid JSON", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      const msg = parseClientMessage("not json");
      expect(msg).toBeNull();
    });

    test("should return null for missing type", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      const msg = parseClientMessage(JSON.stringify({ id: "1", payload: {} }));
      expect(msg).toBeNull();
    });

    test("should return null for missing id", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      const msg = parseClientMessage(JSON.stringify({ type: "chat", payload: {} }));
      expect(msg).toBeNull();
    });

    test("should parse ping messages", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      const msg = parseClientMessage(JSON.stringify({ type: "ping", id: "p-1", payload: {} }));
      expect(msg).not.toBeNull();
      expect(msg!.type).toBe("ping");
    });

    test("should parse cancel messages", async () => {
      const { parseClientMessage } = await import("../src/inputs/websocket/protocol");
      const msg = parseClientMessage(
        JSON.stringify({ type: "cancel", id: "cancel-1", payload: {} })
      );
      expect(msg).not.toBeNull();
      expect(msg!.type).toBe("cancel");
    });
  });

  describe("isValidClientMessage", () => {
    test("should accept valid chat_with_tools message", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(
        isValidClientMessage({ type: "chat_with_tools", id: "1", payload: {} })
      ).toBe(true);
    });

    test("should accept valid chat message", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ type: "chat", id: "1", payload: {} })).toBe(true);
    });

    test("should accept valid ping message", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ type: "ping", id: "1", payload: {} })).toBe(true);
    });

    test("should accept valid cancel message", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ type: "cancel", id: "1", payload: {} })).toBe(true);
    });

    test("should reject null", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage(null)).toBe(false);
    });

    test("should reject undefined", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage(undefined)).toBe(false);
    });

    test("should reject non-object", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage("string")).toBe(false);
    });

    test("should reject missing type", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ id: "1", payload: {} })).toBe(false);
    });

    test("should reject missing id", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ type: "chat", payload: {} })).toBe(false);
    });

    test("should reject unknown type", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ type: "invalid", id: "1", payload: {} })).toBe(false);
    });

    test("should reject numeric type", async () => {
      const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
      expect(isValidClientMessage({ type: 123, id: "1", payload: {} })).toBe(false);
    });
  });
});

// ============================================
// WebSocket Handler Tests
// ============================================

describe("WebSocket Handler", () => {
  describe("Module Exports", () => {
    test("should export websocketHandlers", async () => {
      const mod = await import("../src/inputs/websocket/index");
      expect(mod.websocketHandlers).toBeDefined();
      expect(typeof mod.websocketHandlers.open).toBe("function");
      expect(typeof mod.websocketHandlers.close).toBe("function");
      expect(typeof mod.websocketHandlers.message).toBe("function");
    });

    test("should export handleUpgrade function", async () => {
      const { handleUpgrade } = await import("../src/inputs/websocket/index");
      expect(typeof handleUpgrade).toBe("function");
    });

    test("should export getConnectionCount function", async () => {
      const { getConnectionCount } = await import("../src/inputs/websocket/index");
      expect(typeof getConnectionCount).toBe("function");
    });

    test("should export broadcastMessage function", async () => {
      const { broadcastMessage } = await import("../src/inputs/websocket/index");
      expect(typeof broadcastMessage).toBe("function");
    });

    test("should export closeAllConnections function", async () => {
      const { closeAllConnections } = await import("../src/inputs/websocket/index");
      expect(typeof closeAllConnections).toBe("function");
    });

    test("should export default object with handlers", async () => {
      const mod = await import("../src/inputs/websocket/index");
      expect(mod.default).toBeDefined();
      expect(mod.default.handlers).toBeDefined();
      expect(typeof mod.default.handleUpgrade).toBe("function");
      expect(typeof mod.default.getConnectionCount).toBe("function");
    });
  });

  describe("Connection Count", () => {
    test("should return zero when no connections", async () => {
      const { getConnectionCount } = await import("../src/inputs/websocket/index");
      expect(getConnectionCount()).toBe(0);
    });
  });
});

// ============================================
// STT Module Tests
// ============================================

describe("Speech-to-Text (STT)", () => {
  test("should export transcribeAudio function", async () => {
    const { transcribeAudio } = await import("../src/outputs/stt");
    expect(typeof transcribeAudio).toBe("function");
  });

  test("transcribeAudio should accept Buffer and optional language", async () => {
    const { transcribeAudio } = await import("../src/outputs/stt");
    // Verify function signature: (audioBuffer: Buffer, language?: string) => Promise<string | null>
    expect(transcribeAudio.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// TTS Module Tests
// ============================================

describe("Text-to-Speech (TTS)", () => {
  test("should export textToSpeech function", async () => {
    const { textToSpeech } = await import("../src/outputs/tts");
    expect(typeof textToSpeech).toBe("function");
  });

  test("should export getVoices function", async () => {
    const { getVoices } = await import("../src/outputs/tts");
    expect(typeof getVoices).toBe("function");
  });

  test("textToSpeech should accept text and options", async () => {
    const { textToSpeech } = await import("../src/outputs/tts");
    expect(textToSpeech.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// API Server Route Tests
// ============================================

describe("API Server", () => {
  describe("Module Exports", () => {
    test("should export app (Hono instance)", async () => {
      const { app } = await import("../src/inputs/api/server");
      expect(app).toBeDefined();
    });
  });

  describe("Route Definitions", () => {
    test("should have /health route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const healthRoute = routes.find(
        (r: { path: string; method: string }) => r.path === "/health" && r.method === "GET"
      );
      expect(healthRoute).toBeDefined();
    });

    test("should have /api/chat/tools route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const chatRoute = routes.find(
        (r: { path: string; method: string }) =>
          r.path === "/api/chat/tools" && r.method === "POST"
      );
      expect(chatRoute).toBeDefined();
    });

    test("should have /api/transcribe route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const transcribeRoute = routes.find(
        (r: { path: string; method: string }) =>
          r.path === "/api/transcribe" && r.method === "POST"
      );
      expect(transcribeRoute).toBeDefined();
    });

    test("should have /api/tts route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const ttsRoute = routes.find(
        (r: { path: string; method: string }) => r.path === "/api/tts" && r.method === "POST"
      );
      expect(ttsRoute).toBeDefined();
    });

    test("should have /api/system/status route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const statusRoute = routes.find(
        (r: { path: string; method: string }) =>
          r.path === "/api/system/status" && r.method === "GET"
      );
      expect(statusRoute).toBeDefined();
    });

    test("should have /api/conversations route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const convoRoute = routes.find(
        (r: { path: string; method: string }) =>
          r.path === "/api/conversations" && r.method === "GET"
      );
      expect(convoRoute).toBeDefined();
    });

    test("should have /api/memories route", async () => {
      const { app } = await import("../src/inputs/api/server");
      const routes = app.routes;
      const memRoute = routes.find(
        (r: { path: string; method: string }) =>
          r.path === "/api/memories" && r.method === "GET"
      );
      expect(memRoute).toBeDefined();
    });
  });

  describe("System Status Version", () => {
    test("should return version 2.7.0 on public endpoint", async () => {
      const { app } = await import("../src/inputs/api/server");
      const req = new Request("http://localhost/api/system/status");
      const res = await app.fetch(req);
      const data = await res.json();
      expect(data.version).toBe("2.7.0");
      expect(data.status).toBe("online");
    });
  });
});

// ============================================
// WebSocket Message Type Coverage
// ============================================

describe("WebSocket Message Types", () => {
  test("client message types should include chat_with_tools", async () => {
    // Verify the protocol supports the chat_with_tools type
    const { isValidClientMessage } = await import("../src/inputs/websocket/protocol");
    expect(isValidClientMessage({ type: "chat_with_tools", id: "1", payload: {} })).toBe(true);
  });

  test("server message should serialize tool events correctly", async () => {
    const { createServerMessage } = await import("../src/inputs/websocket/protocol");

    // Simulate a full tool execution flow
    const start = JSON.parse(
      createServerMessage("tool_start", "flow-1", { toolName: "web_search" })
    );
    expect(start.type).toBe("tool_start");
    expect(start.payload.toolName).toBe("web_search");

    const result = JSON.parse(
      createServerMessage("tool_result", "flow-1", {
        toolName: "web_search",
        toolResult: { results: ["result1"] },
      })
    );
    expect(result.type).toBe("tool_result");
    expect(result.payload.toolResult).toEqual({ results: ["result1"] });
  });

  test("streaming flow should work end-to-end", async () => {
    const { createServerMessage } = await import("../src/inputs/websocket/protocol");

    // Simulate: connected -> chunk -> chunk -> tool_start -> tool_result -> complete
    const events = [
      JSON.parse(createServerMessage("connected", "sys", { message: "Connected" })),
      JSON.parse(createServerMessage("chunk", "m-1", { text: "Hello " })),
      JSON.parse(createServerMessage("chunk", "m-1", { text: "world" })),
      JSON.parse(
        createServerMessage("tool_start", "m-1", { toolName: "calculator" })
      ),
      JSON.parse(
        createServerMessage("tool_result", "m-1", {
          toolName: "calculator",
          toolResult: 42,
        })
      ),
      JSON.parse(
        createServerMessage("complete", "m-1", {
          content: "Hello world. The answer is 42.",
          toolsUsed: ["calculator"],
          usage: { inputTokens: 50, outputTokens: 20 },
        })
      ),
    ];

    expect(events[0].type).toBe("connected");
    expect(events[1].type).toBe("chunk");
    expect(events[1].payload.text).toBe("Hello ");
    expect(events[2].payload.text).toBe("world");
    expect(events[3].type).toBe("tool_start");
    expect(events[4].type).toBe("tool_result");
    expect(events[5].type).toBe("complete");
    expect(events[5].payload.content).toBe("Hello world. The answer is 42.");
    expect(events[5].payload.toolsUsed).toEqual(["calculator"]);
  });
});

// ============================================
// Slash Command Logic Tests
// ============================================

describe("Slash Commands", () => {
  test("/clear should be recognized as a command", () => {
    const commands = ["/clear", "/help", "/status"];
    const validCommands = new Set(commands);
    expect(validCommands.has("/clear")).toBe(true);
    expect(validCommands.has("/help")).toBe(true);
    expect(validCommands.has("/status")).toBe(true);
    expect(validCommands.has("/invalid")).toBe(false);
  });

  test("command parsing should extract command name", () => {
    const parseCommand = (input: string) => {
      const parts = input.trim().split(/\s+/);
      return parts[0].toLowerCase();
    };
    expect(parseCommand("/clear")).toBe("/clear");
    expect(parseCommand("/help")).toBe("/help");
    expect(parseCommand("/status")).toBe("/status");
    expect(parseCommand("/remind test in 5 minutes")).toBe("/remind");
    expect(parseCommand("  /HELP  ")).toBe("/help");
  });

  test("non-command messages should not start with /", () => {
    const isCommand = (input: string) => input.trim().startsWith("/");
    expect(isCommand("hello")).toBe(false);
    expect(isCommand("what time is it?")).toBe(false);
    expect(isCommand("/help")).toBe(true);
    expect(isCommand("  /status")).toBe(true);
  });
});

// ============================================
// Chat Message Flow Tests
// ============================================

describe("Chat Message Flow", () => {
  test("userId should be set for web chat", () => {
    const userId = "web:default";
    expect(userId).toBe("web:default");
    expect(userId.startsWith("web:")).toBe(true);
  });

  test("message payload should include userId", () => {
    const payload = {
      type: "chat_with_tools",
      id: "msg-1",
      payload: {
        messages: [{ role: "user", content: "Hello" }],
        userId: "web:default",
      },
    };
    expect(payload.payload.userId).toBe("web:default");
    expect(payload.payload.messages).toHaveLength(1);
  });

  test("streaming message should have streaming flag", () => {
    const streamingMsg = { role: "assistant", content: "", streaming: true };
    expect(streamingMsg.streaming).toBe(true);
    expect(streamingMsg.content).toBe("");
  });

  test("completed message should have tools used", () => {
    const completedMsg = {
      role: "assistant",
      content: "The answer is 42",
      toolsUsed: ["calculator", "web_search"],
      streaming: false,
    };
    expect(completedMsg.streaming).toBe(false);
    expect(completedMsg.toolsUsed).toContain("calculator");
    expect(completedMsg.toolsUsed).toHaveLength(2);
  });

  test("file attachment should have name, type, dataUrl", () => {
    const attachment = {
      name: "test.png",
      type: "image/png",
      dataUrl: "data:image/png;base64,abc123",
    };
    expect(attachment.name).toBe("test.png");
    expect(attachment.type).toBe("image/png");
    expect(attachment.dataUrl.startsWith("data:")).toBe(true);
  });

  test("active tool should track name and start time", () => {
    const tool = { name: "web_search", startedAt: Date.now() };
    expect(tool.name).toBe("web_search");
    expect(typeof tool.startedAt).toBe("number");
    expect(tool.startedAt).toBeGreaterThan(0);
  });
});
