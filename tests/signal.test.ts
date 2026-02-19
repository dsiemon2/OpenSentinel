import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// Signal Bot — Tests
// ============================================================
// Validates the Signal integration module: file existence,
// exports, dependencies, JSON-RPC handling, auth,
// message processing, and security features.

const SOURCE_PATH = "src/inputs/signal/index.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("Signal Bot", () => {
  // =========================================================
  // File existence & basic structure
  // =========================================================

  describe("file structure", () => {
    test("source file exists", () => {
      expect(existsSync(SOURCE_PATH)).toBe(true);
    });

    test("file is non-empty", () => {
      expect(source.length).toBeGreaterThan(100);
    });

    test("exports SignalBot class", () => {
      expect(source).toContain("export class SignalBot");
    });

    test("exports default", () => {
      expect(source).toContain("export default SignalBot");
    });
  });

  // =========================================================
  // Dependencies
  // =========================================================

  describe("dependencies", () => {
    test("imports spawn from node:child_process", () => {
      expect(source).toContain("spawn");
      expect(source).toContain("node:child_process");
    });

    test("imports ChildProcess type", () => {
      expect(source).toContain("ChildProcess");
    });

    test("imports chatWithTools from core brain", () => {
      expect(source).toContain("chatWithTools");
      expect(source).toContain("core/brain");
    });

    test("imports Message type from core brain", () => {
      expect(source).toContain("Message");
    });
  });

  // =========================================================
  // Configuration interface
  // =========================================================

  describe("configuration", () => {
    test("defines SignalConfig interface", () => {
      expect(source).toContain("interface SignalConfig");
    });

    test("config requires phoneNumber", () => {
      expect(source).toContain("phoneNumber: string");
    });

    test("config has optional signalCliPath", () => {
      expect(source).toContain("signalCliPath?");
    });

    test("config has optional allowedNumbers", () => {
      expect(source).toContain("allowedNumbers?");
    });

    test("config has optional configDir", () => {
      expect(source).toContain("configDir?");
    });

    test("defaults signalCliPath to signal-cli", () => {
      expect(source).toContain('"signal-cli"');
    });

    test("defaults configDir to ~/.local/share/signal-cli", () => {
      expect(source).toContain("~/.local/share/signal-cli");
    });
  });

  // =========================================================
  // Signal message interface
  // =========================================================

  describe("message interface", () => {
    test("defines SignalMessage interface", () => {
      expect(source).toContain("interface SignalMessage");
    });

    test("message has envelope with source", () => {
      expect(source).toContain("source: string");
    });

    test("message has envelope with sourceNumber", () => {
      expect(source).toContain("sourceNumber: string");
    });

    test("message has envelope with timestamp", () => {
      expect(source).toContain("timestamp: number");
    });

    test("message has optional dataMessage", () => {
      expect(source).toContain("dataMessage?");
    });

    test("dataMessage contains message text", () => {
      expect(source).toContain("message: string");
    });
  });

  // =========================================================
  // Process management
  // =========================================================

  describe("process management", () => {
    test("spawns signal-cli process", () => {
      expect(source).toContain("spawn(");
    });

    test("passes -u flag with phone number", () => {
      expect(source).toContain('"-u"');
      expect(source).toContain("this.config.phoneNumber");
    });

    test("uses jsonRpc mode", () => {
      expect(source).toContain('"jsonRpc"');
    });

    test("configures stdio as pipe", () => {
      expect(source).toContain('stdio: ["pipe", "pipe", "pipe"]');
    });

    test("guards against starting twice", () => {
      expect(source).toContain("if (this.isRunning) return");
    });

    test("kills process on stop", () => {
      expect(source).toContain("this.process.kill()");
    });

    test("nullifies process reference on stop", () => {
      expect(source).toContain("this.process = null");
    });
  });

  // =========================================================
  // JSON-RPC message handling
  // =========================================================

  describe("JSON-RPC handling", () => {
    test("reads from stdout", () => {
      expect(source).toContain("process.stdout");
    });

    test("parses JSON lines from stdout", () => {
      expect(source).toContain("JSON.parse(line)");
    });

    test("implements line buffering for partial JSON", () => {
      expect(source).toContain('buffer += chunk.toString()');
      expect(source).toContain('buffer.split("\\n")');
      expect(source).toContain("lines.pop()");
    });

    test("handles receive method", () => {
      expect(source).toContain('data.method === "receive"');
    });

    test("calls handleMessage for receive events", () => {
      expect(source).toContain("this.handleMessage(data.params)");
    });

    test("skips invalid JSON silently", () => {
      expect(source).toContain("catch {");
    });

    test("handles stdout errors", () => {
      expect(source).toContain('"error"');
      expect(source).toContain("Error reading messages");
    });
  });

  // =========================================================
  // stderr handling
  // =========================================================

  describe("stderr handling", () => {
    test("reads stderr for logging", () => {
      expect(source).toContain("readStderr");
      expect(source).toContain("process.stderr");
    });

    test("logs stderr output", () => {
      expect(source).toContain("[Signal] stderr:");
    });

    test("trims stderr text", () => {
      expect(source).toContain("text.trim()");
    });
  });

  // =========================================================
  // Message processing
  // =========================================================

  describe("message processing", () => {
    test("extracts sender from envelope", () => {
      expect(source).toContain("envelope.sourceNumber || envelope.source");
    });

    test("extracts message text from dataMessage", () => {
      expect(source).toContain("envelope.dataMessage.message");
    });

    test("skips messages without dataMessage content", () => {
      expect(source).toContain("!envelope.dataMessage?.message");
    });
  });

  // =========================================================
  // Allowed numbers filtering
  // =========================================================

  describe("allowed numbers filtering", () => {
    test("checks allowedNumbers config", () => {
      expect(source).toContain("this.config.allowedNumbers");
    });

    test("only filters when allowedNumbers is non-empty", () => {
      expect(source).toContain("this.config.allowedNumbers.length > 0");
    });

    test("uses includes() for number matching", () => {
      expect(source).toContain("allowedNumbers.includes(sender)");
    });

    test("logs unauthorized attempts", () => {
      expect(source).toContain("unauthorized number");
    });
  });

  // =========================================================
  // Conversation context
  // =========================================================

  describe("conversation context", () => {
    test("defines ConversationContext interface", () => {
      expect(source).toContain("interface ConversationContext");
    });

    test("maintains conversations Map", () => {
      expect(source).toContain("conversations: Map<string, ConversationContext>");
    });

    test("stores user messages in context", () => {
      expect(source).toContain('role: "user"');
    });

    test("stores assistant responses in context", () => {
      expect(source).toContain('role: "assistant"');
    });

    test("limits context to last 10 messages", () => {
      expect(source).toContain("context.messages.length > 10");
      expect(source).toContain("context.messages.slice(-10)");
    });

    test("tracks lastActivity timestamp", () => {
      expect(source).toContain("lastActivity: new Date()");
    });
  });

  // =========================================================
  // sendMessage
  // =========================================================

  describe("sendMessage", () => {
    test("has sendMessage method", () => {
      expect(source).toContain("async sendMessage(to: string, text: string)");
    });

    test("throws when not connected (no stdin)", () => {
      expect(source).toContain("Signal not connected");
    });

    test("checks process.stdin before sending", () => {
      expect(source).toContain("!this.process?.stdin");
    });

    test("sends JSON-RPC 2.0 formatted message", () => {
      expect(source).toContain('jsonrpc: "2.0"');
    });

    test("uses send method", () => {
      expect(source).toContain('method: "send"');
    });

    test("includes recipient in params", () => {
      expect(source).toContain("recipient: [to]");
    });

    test("writes JSON + newline to stdin", () => {
      expect(source).toContain("this.process.stdin.write(JSON.stringify(request) +");
    });

    test("uses timestamp-based request id", () => {
      expect(source).toContain("id: Date.now()");
    });
  });

  // =========================================================
  // Error handling
  // =========================================================

  describe("error handling", () => {
    test("catches message processing errors", () => {
      expect(source).toContain("catch (error)");
    });

    test("sends error response on AI failure", () => {
      expect(source).toContain("error processing your request");
    });

    test("logs errors to console", () => {
      expect(source).toContain("console.error");
    });
  });

  // =========================================================
  // State management
  // =========================================================

  describe("state management", () => {
    test("has running getter", () => {
      expect(source).toContain("get running()");
    });

    test("tracks running state with isRunning", () => {
      expect(source).toContain("private isRunning = false");
    });

    test("tracks process reference", () => {
      expect(source).toContain("private process: ChildProcess | null = null");
    });

    test("sets isRunning to false on stop", () => {
      expect(source).toContain("this.isRunning = false");
    });
  });
});
