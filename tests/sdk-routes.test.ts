import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";

// ============================================
// SDK Routes — Comprehensive API Tests
// ============================================
// Tests the SDK API surface: registration, authentication,
// chat, notifications, memory, tools, agents, and status.
// External dependencies (brain, memory, tools, messaging)
// are mocked so tests run without live services.

// ---------------------------------------------------------------
// Mocks — stub out core modules that require external services
// ---------------------------------------------------------------

mock.module("../src/core/brain", () => ({
  chatWithTools: async (
    messages: any[],
    userId: string,
    onTool?: (tool: string) => void
  ) => {
    if (onTool) {
      onTool("mock_tool");
    }
    return {
      content: "Mock AI response for: " + messages[messages.length - 1].content,
      inputTokens: 100,
      outputTokens: 50,
    };
  },
  chat: async (messages: any[], systemPrompt?: string) => ({
    content: "Mock simple chat response",
    inputTokens: 80,
    outputTokens: 40,
  }),
}));

const mockStoredMemory = {
  id: "mem-001",
  content: "test memory content",
  type: "semantic",
  importance: 5,
  userId: "sdk:test-app-id",
  source: "sdk:TestApp",
  provenance: "sdk:cli",
  createdAt: new Date(),
};

const mockSearchResults = [
  {
    id: "mem-002",
    content: "found memory",
    type: "episodic",
    importance: 7,
    similarity: 0.92,
  },
];

mock.module("../src/core/memory", () => ({
  storeMemory: async (data: any) => ({ ...mockStoredMemory, ...data }),
  searchMemories: async (query: string, userId?: string, limit?: number) =>
    mockSearchResults,
}));

// Mock messaging channels — these are dynamically imported inside notify
mock.module("../src/inputs/telegram", () => ({
  sendTelegramMessage: async (msg: string) => {},
}));

mock.module("../src/inputs/discord", () => ({
  sendDiscordMessage: async (msg: string) => {},
}));

mock.module("../src/inputs/slack", () => ({
  sendSlackMessage: async (msg: string) => {},
}));

mock.module("../src/integrations/email", () => ({
  sendEmail: async (opts: any) => {},
}));

// Mock tools — provide a small set for testing
mock.module("../src/tools", () => ({
  TOOLS: [
    { name: "get_time", description: "Get the current time" },
    { name: "read_file", description: "Read a file from disk" },
    { name: "execute_command", description: "Run a shell command" },
  ],
  executeTool: async (tool: string, input: Record<string, any>) => ({
    success: true,
    result: `Executed ${tool} with input ${JSON.stringify(input)}`,
  }),
}));

// ---------------------------------------------------------------
// Helper — build a Hono app that mounts sdkRoutes at /api/sdk
// ---------------------------------------------------------------

let app: Hono;
let registeredApiKey: string;
let registeredAppId: string;

async function createTestApp(): Promise<Hono> {
  // Dynamic import after mocks are in place
  const { sdkRoutes } = await import("../src/inputs/api/routes/sdk");
  const testApp = new Hono();
  testApp.route("/api/sdk", sdkRoutes);
  return testApp;
}

// Helper to make requests against the Hono app
async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<Response> {
  const init: RequestInit = { method, headers: { ...headers } };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------

describe("SDK Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  // ==========================================================
  // POST /api/sdk/register
  // ==========================================================

  describe("POST /api/sdk/register", () => {
    test("should register a new app and return apiKey and id", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {
        name: "TestApp",
        type: "cli",
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBeDefined();
      expect(typeof json.id).toBe("string");
      expect(json.apiKey).toBeDefined();
      expect(typeof json.apiKey).toBe("string");
      expect(json.apiKey.startsWith("osk_")).toBe(true);
      expect(json.message).toContain("registered successfully");
      expect(json.endpoints).toBeDefined();
      expect(json.endpoints.chat).toBe("POST /api/sdk/chat");
      expect(json.endpoints.notify).toBe("POST /api/sdk/notify");
      expect(json.endpoints.memory_store).toBe("POST /api/sdk/memory");
      expect(json.endpoints.memory_search).toBe("POST /api/sdk/memory/search");
      expect(json.endpoints.tools_list).toBe("GET /api/sdk/tools");
      expect(json.endpoints.tools_execute).toBe("POST /api/sdk/tools/execute");
      expect(json.endpoints.agent_spawn).toBe("POST /api/sdk/agent/spawn");
      expect(json.endpoints.status).toBe("GET /api/sdk/status");

      // Save for use in authenticated tests
      registeredApiKey = json.apiKey;
      registeredAppId = json.id;
    });

    test("should return existing app when registering same name and type", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {
        name: "TestApp",
        type: "cli",
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBe(registeredAppId);
      expect(json.apiKey).toBe(registeredApiKey);
      expect(json.message).toContain("already registered");
    });

    test("should register a different app with different name", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {
        name: "AnotherApp",
        type: "web",
        callbackUrl: "https://example.com/callback",
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBeDefined();
      expect(json.id).not.toBe(registeredAppId);
      expect(json.apiKey).toBeDefined();
      expect(json.apiKey).not.toBe(registeredApiKey);
      expect(json.message).toContain("registered successfully");
    });

    test("should return 400 when name is missing", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {
        type: "cli",
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("name");
      expect(json.error).toContain("type");
      expect(json.error).toContain("required");
    });

    test("should return 400 when type is missing", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {
        name: "NoTypeApp",
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 when both name and type are missing", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {});

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 500 when body is not valid JSON", async () => {
      const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      };
      const res = await app.request("/api/sdk/register", init);

      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toContain("Registration failed");
    });

    test("should generate API keys with correct format", async () => {
      const res = await req(app, "POST", "/api/sdk/register", {
        name: "FormatCheck",
        type: "test",
      });

      const json = await res.json();
      const apiKey = json.apiKey as string;

      expect(apiKey.startsWith("osk_")).toBe(true);
      // osk_ prefix + segments joined by hyphens: 8-4-4-4-12
      const parts = apiKey.slice(4).split("-");
      expect(parts.length).toBe(5);
      expect(parts[0].length).toBe(8);
      expect(parts[1].length).toBe(4);
      expect(parts[2].length).toBe(4);
      expect(parts[3].length).toBe(4);
      expect(parts[4].length).toBe(12);
    });
  });

  // ==========================================================
  // Authentication middleware
  // ==========================================================

  describe("SDK Auth Middleware", () => {
    test("should return 401 when no Authorization header is provided", async () => {
      const res = await req(app, "POST", "/api/sdk/chat", {
        message: "Hello",
      });

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("Invalid or missing API key");
    });

    test("should return 401 when Authorization header has wrong prefix", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "Hello" },
        { Authorization: "Bearer wrong_prefix_key" }
      );

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("Invalid or missing API key");
    });

    test("should return 401 when Authorization header uses Basic auth", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "Hello" },
        { Authorization: "Basic dXNlcjpwYXNz" }
      );

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("Invalid or missing API key");
    });

    test("should return 401 when API key is valid format but not registered", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "Hello" },
        { Authorization: "Bearer osk_notareal-key0-0000-0000-000000000000" }
      );

      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("Unknown API key");
    });

    test("should pass authentication with valid registered API key", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/tools",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);
    });

    test("should return 401 for all protected endpoints without auth", async () => {
      const protectedEndpoints: [string, string, any?][] = [
        ["POST", "/api/sdk/chat", { message: "test" }],
        ["POST", "/api/sdk/notify", { channel: "telegram", message: "test" }],
        ["POST", "/api/sdk/memory", { content: "test" }],
        ["POST", "/api/sdk/memory/search", { query: "test" }],
        ["GET", "/api/sdk/tools", undefined],
        ["POST", "/api/sdk/tools/execute", { tool: "get_time", input: {} }],
        ["POST", "/api/sdk/agent/spawn", { type: "research", task: "test" }],
        ["GET", "/api/sdk/status", undefined],
      ];

      for (const [method, path, body] of protectedEndpoints) {
        const res = await req(app, method, path, body);
        expect(res.status).toBe(401);
      }
    });
  });

  // ==========================================================
  // POST /api/sdk/chat
  // ==========================================================

  describe("POST /api/sdk/chat", () => {
    test("should return AI response for valid message", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "Hello, how are you?" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.content).toBeDefined();
      expect(typeof json.content).toBe("string");
      expect(json.content).toContain("Mock AI response");
      expect(json.toolsUsed).toBeDefined();
      expect(Array.isArray(json.toolsUsed)).toBe(true);
      expect(json.toolsUsed).toContain("mock_tool");
      expect(json.usage).toBeDefined();
      expect(json.usage.inputTokens).toBe(100);
      expect(json.usage.outputTokens).toBe(50);
      expect(json.app).toBe("TestApp");
    });

    test("should return 400 when message is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { context: "some context" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("message is required");
    });

    test("should return 400 when message is empty string", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("message is required");
    });

    test("should accept optional context parameter", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        {
          message: "What should I do next?",
          context: "User is working on a coding project",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.content).toBeDefined();
    });

    test("should accept useTools parameter set to false", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        {
          message: "Just chat without tools",
          useTools: false,
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.content).toBe("Mock simple chat response");
    });

    test("should accept optional systemPrompt parameter", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        {
          message: "Summarize this",
          useTools: false,
          systemPrompt: "You are a helpful summarizer.",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.content).toBeDefined();
    });

    test("should include app name in response", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "Test" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();
      expect(json.app).toBe("TestApp");
    });
  });

  // ==========================================================
  // POST /api/sdk/notify
  // ==========================================================

  describe("POST /api/sdk/notify", () => {
    test("should send notification to telegram", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {
          channel: "telegram",
          message: "Test notification",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sent).toBeDefined();
      expect(Array.isArray(json.sent)).toBe(true);
      expect(json.sent).toContain("telegram");
      expect(json.message).toContain("telegram");
    });

    test("should send notification to discord", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {
          channel: "discord",
          message: "Discord notification",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sent).toContain("discord");
    });

    test("should send notification to slack", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {
          channel: "slack",
          message: "Slack notification",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sent).toContain("slack");
    });

    test("should send notification to email with recipient", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {
          channel: "email",
          message: "Email notification",
          recipient: "user@example.com",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sent).toContain("email");
    });

    test("should send to all channels when channel is 'all'", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {
          channel: "all",
          message: "Broadcast notification",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sent).toBeDefined();
      // "all" sends to telegram, discord, slack
      expect(json.sent).toContain("telegram");
      expect(json.sent).toContain("discord");
      expect(json.sent).toContain("slack");
    });

    test("should return 400 when channel is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        { message: "Missing channel" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("channel");
      expect(json.error).toContain("message");
      expect(json.error).toContain("required");
    });

    test("should return 400 when message is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        { channel: "telegram" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 when both channel and message are missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {},
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should accept optional priority parameter", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/notify",
        {
          channel: "telegram",
          message: "Urgent notification",
          priority: "urgent",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.sent).toBeDefined();
    });
  });

  // ==========================================================
  // POST /api/sdk/memory
  // ==========================================================

  describe("POST /api/sdk/memory", () => {
    test("should store memory with content", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory",
        { content: "Remember that the user prefers dark mode" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
      expect(json.content).toBeDefined();
    });

    test("should store memory with optional type", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory",
        {
          content: "User learned how to deploy apps",
          type: "procedural",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
    });

    test("should store memory with optional importance", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory",
        {
          content: "Critical: user's API key was rotated",
          importance: 9,
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
    });

    test("should store memory with optional metadata", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory",
        {
          content: "User set timezone to America/New_York",
          metadata: { timezone: "America/New_York" },
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();
    });

    test("should return 400 when content is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory",
        { type: "semantic" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("content is required");
    });

    test("should return 400 when content is empty string", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory",
        { content: "" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("content is required");
    });
  });

  // ==========================================================
  // POST /api/sdk/memory/search
  // ==========================================================

  describe("POST /api/sdk/memory/search", () => {
    test("should search memories with a query", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory/search",
        { query: "dark mode preference" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json.length).toBeGreaterThan(0);
      expect(json[0].id).toBeDefined();
      expect(json[0].content).toBeDefined();
    });

    test("should accept optional limit parameter", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory/search",
        { query: "test query", limit: 10 },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    test("should accept crossApp parameter for cross-app search", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory/search",
        { query: "cross app data", crossApp: true },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
    });

    test("should return 400 when query is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory/search",
        { limit: 5 },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("query is required");
    });

    test("should return 400 when query is empty string", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/memory/search",
        { query: "" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("query is required");
    });
  });

  // ==========================================================
  // GET /api/sdk/tools
  // ==========================================================

  describe("GET /api/sdk/tools", () => {
    test("should list available tools", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/tools",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.tools).toBeDefined();
      expect(Array.isArray(json.tools)).toBe(true);
      expect(json.count).toBeDefined();
      expect(typeof json.count).toBe("number");
      expect(json.count).toBe(json.tools.length);
    });

    test("should return tool objects with name and description", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/tools",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();

      for (const tool of json.tools) {
        expect(tool.name).toBeDefined();
        expect(typeof tool.name).toBe("string");
        expect(tool.description).toBeDefined();
        expect(typeof tool.description).toBe("string");
      }
    });

    test("should include mock tools in the list", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/tools",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();
      const toolNames = json.tools.map((t: any) => t.name);

      expect(toolNames).toContain("get_time");
      expect(toolNames).toContain("read_file");
      expect(toolNames).toContain("execute_command");
    });

    test("should have correct count matching mock tools", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/tools",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();
      expect(json.count).toBe(3);
    });
  });

  // ==========================================================
  // POST /api/sdk/tools/execute
  // ==========================================================

  describe("POST /api/sdk/tools/execute", () => {
    test("should execute a tool with valid input", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/tools/execute",
        {
          tool: "get_time",
          input: { timezone: "UTC" },
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.tool).toBe("get_time");
      expect(json.result).toBeDefined();
      expect(json.result.success).toBe(true);
    });

    test("should return the tool name in the response", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/tools/execute",
        {
          tool: "read_file",
          input: { path: "/tmp/test.txt" },
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.tool).toBe("read_file");
    });

    test("should return 400 when tool is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/tools/execute",
        { input: { path: "/tmp/test.txt" } },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("tool");
      expect(json.error).toContain("input");
      expect(json.error).toContain("required");
    });

    test("should return 400 when input is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/tools/execute",
        { tool: "get_time" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 when both tool and input are missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/tools/execute",
        {},
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });
  });

  // ==========================================================
  // POST /api/sdk/agent/spawn
  // ==========================================================

  describe("POST /api/sdk/agent/spawn", () => {
    test("should spawn a research agent", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        {
          type: "research",
          task: "Find the latest trends in AI",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.agent).toBe("research");
      expect(json.result).toBeDefined();
      expect(typeof json.result).toBe("string");
      expect(json.toolsUsed).toBeDefined();
      expect(Array.isArray(json.toolsUsed)).toBe(true);
      expect(json.usage).toBeDefined();
      expect(json.usage.inputTokens).toBeDefined();
      expect(json.usage.outputTokens).toBeDefined();
    });

    test("should spawn a coding agent", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        {
          type: "coding",
          task: "Write a sorting algorithm in TypeScript",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.agent).toBe("coding");
      expect(json.result).toBeDefined();
    });

    test("should spawn a writing agent", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        {
          type: "writing",
          task: "Draft a blog post about AI assistants",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.agent).toBe("writing");
    });

    test("should spawn an analysis agent", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        {
          type: "analysis",
          task: "Analyze the performance metrics",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.agent).toBe("analysis");
    });

    test("should accept optional context parameter", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        {
          type: "research",
          task: "Analyze competitors",
          context: "We are in the SaaS market targeting enterprise customers",
        },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.result).toBeDefined();
    });

    test("should return 400 when type is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        { task: "Do something" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("type");
      expect(json.error).toContain("task");
      expect(json.error).toContain("required");
    });

    test("should return 400 when task is missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        { type: "research" },
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });

    test("should return 400 when both type and task are missing", async () => {
      const res = await req(
        app,
        "POST",
        "/api/sdk/agent/spawn",
        {},
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toContain("required");
    });
  });

  // ==========================================================
  // GET /api/sdk/status
  // ==========================================================

  describe("GET /api/sdk/status", () => {
    test("should return status information", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      expect(res.status).toBe(200);

      const json = await res.json();

      // OpenSentinel status
      expect(json.opensentinel).toBeDefined();
      expect(json.opensentinel.status).toBe("online");
      expect(json.opensentinel.version).toBe("2.2.1");
      expect(typeof json.opensentinel.uptime).toBe("number");
      expect(json.opensentinel.uptime).toBeGreaterThan(0);
    });

    test("should return current app information", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();

      expect(json.currentApp).toBeDefined();
      expect(json.currentApp.id).toBe(registeredAppId);
      expect(json.currentApp.name).toBe("TestApp");
      expect(json.currentApp.type).toBe("cli");
    });

    test("should return list of registered apps", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();

      expect(json.registeredApps).toBeDefined();
      expect(Array.isArray(json.registeredApps)).toBe(true);
      // We registered at least TestApp, AnotherApp, and FormatCheck
      expect(json.registeredApps.length).toBeGreaterThanOrEqual(3);

      // Each registered app should have expected fields
      for (const app of json.registeredApps) {
        expect(app.id).toBeDefined();
        expect(app.name).toBeDefined();
        expect(app.type).toBeDefined();
        expect(app.registeredAt).toBeDefined();
        expect(app.lastSeen).toBeDefined();
      }
    });

    test("should not expose apiKey in registeredApps list", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();

      for (const app of json.registeredApps) {
        expect(app.apiKey).toBeUndefined();
      }
    });

    test("should return tools count", async () => {
      const res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${registeredApiKey}` }
      );

      const json = await res.json();

      expect(json.tools).toBeDefined();
      expect(typeof json.tools).toBe("number");
      expect(json.tools).toBe(3); // Our mock has 3 tools
    });
  });

  // ==========================================================
  // Edge cases and integration scenarios
  // ==========================================================

  describe("Edge cases", () => {
    test("register endpoint should not require auth", async () => {
      // /register is before the sdkAuth middleware, so it should work without auth
      const res = await req(app, "POST", "/api/sdk/register", {
        name: "NoAuthNeeded",
        type: "edge-test",
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.apiKey).toBeDefined();
    });

    test("should handle registration and immediate authenticated request", async () => {
      // Register
      const regRes = await req(app, "POST", "/api/sdk/register", {
        name: "FullFlowApp",
        type: "integration",
      });
      const regJson = await regRes.json();
      const key = regJson.apiKey;

      // Immediately use the key to get status
      const statusRes = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${key}` }
      );

      expect(statusRes.status).toBe(200);

      const statusJson = await statusRes.json();
      expect(statusJson.currentApp.name).toBe("FullFlowApp");
      expect(statusJson.currentApp.type).toBe("integration");
    });

    test("should handle registration then chat flow", async () => {
      // Register a new app
      const regRes = await req(app, "POST", "/api/sdk/register", {
        name: "ChatFlowApp",
        type: "chatbot",
      });
      const regJson = await regRes.json();
      const key = regJson.apiKey;

      // Send a chat message
      const chatRes = await req(
        app,
        "POST",
        "/api/sdk/chat",
        { message: "Hello from ChatFlowApp" },
        { Authorization: `Bearer ${key}` }
      );

      expect(chatRes.status).toBe(200);

      const chatJson = await chatRes.json();
      expect(chatJson.app).toBe("ChatFlowApp");
      expect(chatJson.content).toContain("Hello from ChatFlowApp");
    });

    test("should handle concurrent registrations without conflict", async () => {
      const registrations = await Promise.all([
        req(app, "POST", "/api/sdk/register", {
          name: "ConcurrentApp1",
          type: "test",
        }),
        req(app, "POST", "/api/sdk/register", {
          name: "ConcurrentApp2",
          type: "test",
        }),
        req(app, "POST", "/api/sdk/register", {
          name: "ConcurrentApp3",
          type: "test",
        }),
      ]);

      const results = await Promise.all(registrations.map((r) => r.json()));

      // All should succeed
      for (const result of results) {
        expect(result.id).toBeDefined();
        expect(result.apiKey).toBeDefined();
      }

      // All IDs should be unique
      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(3);

      // All API keys should be unique
      const keys = new Set(results.map((r) => r.apiKey));
      expect(keys.size).toBe(3);
    });

    test("should update lastSeen on authenticated requests", async () => {
      // Register a new app
      const regRes = await req(app, "POST", "/api/sdk/register", {
        name: "LastSeenApp",
        type: "monitor",
      });
      const regJson = await regRes.json();
      const key = regJson.apiKey;

      // Get initial status (which triggers lastSeen update)
      const status1Res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${key}` }
      );
      const status1Json = await status1Res.json();
      const lastSeen1 = new Date(status1Json.currentApp.lastSeen || status1Json.registeredApps.find((a: any) => a.name === "LastSeenApp")?.lastSeen);

      // Small delay then make another request
      await new Promise((resolve) => setTimeout(resolve, 10));

      const status2Res = await req(
        app,
        "GET",
        "/api/sdk/status",
        undefined,
        { Authorization: `Bearer ${key}` }
      );
      expect(status2Res.status).toBe(200);

      // The lastSeen should be updated (at least not before the first one)
      const status2Json = await status2Res.json();
      const lastSeen2 = new Date(status2Json.registeredApps.find((a: any) => a.name === "LastSeenApp")?.lastSeen);
      expect(lastSeen2.getTime()).toBeGreaterThanOrEqual(lastSeen1.getTime());
    });
  });
});
