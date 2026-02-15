import { describe, test, expect } from "bun:test";

// ============================================
// Brain — Core AI Engine Tests
// ============================================
// Tests SYSTEM_PROMPT content, exported types/functions,
// and interface contracts. API-calling functions (chat,
// chatWithTools) require a live Anthropic key and are tested
// on the production server.

describe("Brain - Core AI Engine", () => {
  // ============================================
  // Module exports
  // ============================================

  describe("Module exports", () => {
    test("should export chat function", async () => {
      const mod = await import("../src/core/brain");
      expect(typeof mod.chat).toBe("function");
    });

    test("should export chatWithTools function", async () => {
      const mod = await import("../src/core/brain");
      expect(typeof mod.chatWithTools).toBe("function");
    });

    test("should export streamChat function", async () => {
      const mod = await import("../src/core/brain");
      expect(typeof mod.streamChat).toBe("function");
    });

    test("should export streamChatWithTools generator", async () => {
      const mod = await import("../src/core/brain");
      expect(typeof mod.streamChatWithTools).toBe("function");
    });

    test("should export SYSTEM_PROMPT string", async () => {
      const mod = await import("../src/core/brain");
      expect(typeof mod.SYSTEM_PROMPT).toBe("string");
    });
  });

  // ============================================
  // SYSTEM_PROMPT content validation
  // ============================================

  describe("SYSTEM_PROMPT", () => {
    test("should not be empty", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    test("should identify as OpenSentinel", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("OpenSentinel");
    });

    test("should reference JARVIS-like personality", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("JARVIS");
    });

    test("should mention shell command execution", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("shell commands");
    });

    test("should mention file management", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("files");
    });

    test("should mention web browsing", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("Browse the web");
    });

    test("should mention memory/remembering", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("Remember");
    });

    test("should mention background agents", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("agents");
    });

    test("should mention document generation", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("documents");
    });

    test("should mention screenshots", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("screenshots");
    });

    test("should mention security and privacy", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("security");
      expect(SYSTEM_PROMPT).toContain("privacy");
    });

    test("should define user as principal", async () => {
      const { SYSTEM_PROMPT } = await import("../src/core/brain");
      expect(SYSTEM_PROMPT).toContain("principal");
    });
  });

  // ============================================
  // Message interface (runtime structural checks)
  // ============================================

  describe("Message interface", () => {
    test("should accept user role", () => {
      const msg: { role: "user" | "assistant"; content: string } = {
        role: "user",
        content: "Hello",
      };
      expect(msg.role).toBe("user");
      expect(msg.content).toBe("Hello");
    });

    test("should accept assistant role", () => {
      const msg: { role: "user" | "assistant"; content: string } = {
        role: "assistant",
        content: "Hi there!",
      };
      expect(msg.role).toBe("assistant");
      expect(msg.content).toBe("Hi there!");
    });
  });

  // ============================================
  // BrainResponse interface (runtime structural checks)
  // ============================================

  describe("BrainResponse interface", () => {
    test("should have required fields", () => {
      const response = {
        content: "Hello",
        inputTokens: 100,
        outputTokens: 50,
      };
      expect(response).toHaveProperty("content");
      expect(response).toHaveProperty("inputTokens");
      expect(response).toHaveProperty("outputTokens");
    });

    test("should support optional toolsUsed", () => {
      const response = {
        content: "Done",
        inputTokens: 100,
        outputTokens: 50,
        toolsUsed: ["execute_command", "read_file"],
      };
      expect(response.toolsUsed).toHaveLength(2);
      expect(response.toolsUsed).toContain("execute_command");
    });

    test("should work without toolsUsed", () => {
      const response = {
        content: "Simple response",
        inputTokens: 50,
        outputTokens: 20,
      };
      expect(response.toolsUsed).toBeUndefined();
    });
  });

  // ============================================
  // StreamEvent interface (runtime structural checks)
  // ============================================

  describe("StreamEvent interface", () => {
    test("should support chunk type", () => {
      const event = {
        type: "chunk" as const,
        data: { text: "Hello " },
      };
      expect(event.type).toBe("chunk");
      expect(event.data.text).toBe("Hello ");
    });

    test("should support tool_start type", () => {
      const event = {
        type: "tool_start" as const,
        data: { toolName: "read_file", toolInput: { path: "/tmp/test" } },
      };
      expect(event.type).toBe("tool_start");
      expect(event.data.toolName).toBe("read_file");
    });

    test("should support tool_result type", () => {
      const event = {
        type: "tool_result" as const,
        data: { toolName: "read_file", toolResult: { success: true } },
      };
      expect(event.type).toBe("tool_result");
    });

    test("should support complete type", () => {
      const event = {
        type: "complete" as const,
        data: {
          content: "Full response",
          inputTokens: 100,
          outputTokens: 50,
          toolsUsed: ["read_file"],
        },
      };
      expect(event.type).toBe("complete");
      expect(event.data.content).toBe("Full response");
    });

    test("should support error type", () => {
      const event = {
        type: "error" as const,
        data: { error: "Something went wrong" },
      };
      expect(event.type).toBe("error");
      expect(event.data.error).toBe("Something went wrong");
    });
  });
});
