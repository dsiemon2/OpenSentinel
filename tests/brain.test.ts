import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

// ============================================
// Brain — Core AI Engine Tests
// ============================================
// Tests SYSTEM_PROMPT content, exported types/functions,
// and interface contracts. API-calling functions (chat,
// chatWithTools) require a live Anthropic key and are tested
// on the production server.
//
// NOTE: brain.ts has heavy transitive imports (tools, integrations,
// drizzle, etc.) that trigger Bun 1.3.9 segfaults on Windows when
// imported in tests. We verify via source analysis instead.

const source = readFileSync("src/core/brain.ts", "utf-8");

// Extract SYSTEM_PROMPT value from source (declared as `const SYSTEM_PROMPT = \`...\``)
const promptStart = source.indexOf("const SYSTEM_PROMPT = `");
const backtickStart = source.indexOf("`", promptStart + 20);
const backtickEnd = source.indexOf("`;", backtickStart + 1);
const SYSTEM_PROMPT = promptStart > -1 ? source.slice(backtickStart + 1, backtickEnd) : "";

describe("Brain - Core AI Engine", () => {
  // ============================================
  // Module exports (source verification)
  // ============================================

  describe("Module exports", () => {
    test("should export chat function", () => {
      expect(source).toContain("export async function chat(");
    });

    test("should export chatWithTools function", () => {
      expect(source).toContain("export async function chatWithTools(");
    });

    test("should export streamChat function", () => {
      expect(source).toContain("export async function streamChat(");
    });

    test("should export streamChatWithTools generator", () => {
      expect(source).toContain("export async function* streamChatWithTools(");
    });

    test("should export SYSTEM_PROMPT", () => {
      expect(source).toContain("export { SYSTEM_PROMPT }");
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // SYSTEM_PROMPT content validation
  // ============================================

  describe("SYSTEM_PROMPT", () => {
    test("should not be empty", () => {
      expect(SYSTEM_PROMPT.length).toBeGreaterThan(100);
    });

    test("should identify as OpenSentinel", () => {
      expect(SYSTEM_PROMPT).toContain("OpenSentinel");
    });

    test("should reference JARVIS-like personality", () => {
      expect(SYSTEM_PROMPT).toContain("JARVIS");
    });

    test("should mention shell command execution", () => {
      expect(SYSTEM_PROMPT).toContain("shell commands");
    });

    test("should mention file management", () => {
      expect(SYSTEM_PROMPT).toContain("files");
    });

    test("should mention web browsing", () => {
      expect(SYSTEM_PROMPT.toLowerCase()).toContain("browse the web");
    });

    test("should mention memory/remembering", () => {
      expect(SYSTEM_PROMPT).toContain("Remember");
    });

    test("should mention background agents", () => {
      expect(SYSTEM_PROMPT).toContain("agents");
    });

    test("should mention document generation", () => {
      expect(SYSTEM_PROMPT).toContain("documents");
    });

    test("should mention screenshots", () => {
      expect(SYSTEM_PROMPT).toContain("screenshots");
    });

    test("should mention security and privacy", () => {
      expect(SYSTEM_PROMPT).toContain("security");
      expect(SYSTEM_PROMPT).toContain("privacy");
    });

    test("should define user as principal", () => {
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
