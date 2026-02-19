import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// iMessage Bot — Tests
// ============================================================
// Validates the iMessage integration module: file existence,
// exports, dual-mode support (BlueBubbles + AppleScript),
// message handling, GUID dedup, and security features.

const SOURCE_PATH = "src/inputs/imessage/index.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("iMessage Bot", () => {
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

    test("exports iMessageBot class", () => {
      expect(source).toContain("export class iMessageBot");
    });

    test("exports default", () => {
      expect(source).toContain("export default iMessageBot");
    });
  });

  // =========================================================
  // Dependencies
  // =========================================================

  describe("dependencies", () => {
    test("imports chatWithTools from core brain", () => {
      expect(source).toContain("chatWithTools");
      expect(source).toContain("core/brain");
    });

    test("imports Message type from core brain", () => {
      expect(source).toContain("Message");
    });

    test("uses node:child_process for AppleScript", () => {
      expect(source).toContain("node:child_process");
    });

    test("uses node:util for promisify", () => {
      expect(source).toContain("node:util");
    });
  });

  // =========================================================
  // Configuration interface
  // =========================================================

  describe("configuration", () => {
    test("defines iMessageConfig interface", () => {
      expect(source).toContain("interface iMessageConfig");
    });

    test("requires mode selection", () => {
      expect(source).toContain('mode: "bluebubbles" | "applescript"');
    });

    test("has optional serverUrl for BlueBubbles", () => {
      expect(source).toContain("serverUrl?");
    });

    test("has optional password for BlueBubbles", () => {
      expect(source).toContain("password?");
    });

    test("has optional allowedNumbers", () => {
      expect(source).toContain("allowedNumbers?");
    });

    test("has optional pollInterval", () => {
      expect(source).toContain("pollInterval?");
    });

    test("defaults pollInterval to 5000", () => {
      expect(source).toContain("pollInterval || 5000");
    });
  });

  // =========================================================
  // BlueBubbles message interface
  // =========================================================

  describe("BlueBubbles message interface", () => {
    test("defines BlueBubblesMessage interface", () => {
      expect(source).toContain("interface BlueBubblesMessage");
    });

    test("message has guid field", () => {
      expect(source).toContain("guid: string");
    });

    test("message has text field", () => {
      expect(source).toContain("text: string");
    });

    test("message has handle with address", () => {
      expect(source).toContain("handle:");
      expect(source).toContain("address: string");
    });

    test("message has isFromMe flag", () => {
      expect(source).toContain("isFromMe: boolean");
    });

    test("message has dateCreated", () => {
      expect(source).toContain("dateCreated: number");
    });
  });

  // =========================================================
  // Mode selection
  // =========================================================

  describe("mode selection", () => {
    test("supports bluebubbles mode", () => {
      expect(source).toContain("startBlueBubbles");
    });

    test("supports applescript mode", () => {
      expect(source).toContain("startAppleScript");
    });

    test("routes to correct start method based on mode", () => {
      expect(source).toContain('this.config.mode === "bluebubbles"');
    });

    test("routes sendMessage based on mode", () => {
      expect(source).toContain("sendBlueBubbles");
      expect(source).toContain("sendAppleScript");
    });
  });

  // =========================================================
  // Platform check
  // =========================================================

  describe("platform check", () => {
    test("checks for macOS in applescript mode", () => {
      expect(source).toContain('process.platform !== "darwin"');
    });

    test("throws error on non-macOS for applescript", () => {
      expect(source).toContain("AppleScript mode only works on macOS");
    });
  });

  // =========================================================
  // BlueBubbles start
  // =========================================================

  describe("BlueBubbles start", () => {
    test("validates serverUrl is present", () => {
      expect(source).toContain("!this.config.serverUrl || !this.config.password");
    });

    test("throws when serverUrl or password missing", () => {
      expect(source).toContain("BlueBubbles requires serverUrl and password");
    });

    test("verifies connection to server", () => {
      expect(source).toContain("/api/v1/server/info");
    });

    test("checks response status", () => {
      expect(source).toContain("!response.ok");
    });

    test("throws on failed connection", () => {
      expect(source).toContain("Failed to connect to BlueBubbles server");
    });

    test("starts polling with setInterval", () => {
      expect(source).toContain("setInterval");
      expect(source).toContain("this.pollBlueBubbles");
    });

    test("sends Authorization header", () => {
      expect(source).toContain("Authorization");
      expect(source).toContain("Bearer");
    });
  });

  // =========================================================
  // BlueBubbles polling
  // =========================================================

  describe("BlueBubbles polling", () => {
    test("polls for messages after lastMessageTime", () => {
      expect(source).toContain("after=${this.lastMessageTime}");
    });

    test("limits poll results", () => {
      expect(source).toContain("limit=50");
    });

    test("skips already-processed messages via GUID", () => {
      expect(source).toContain("this.processedGuids.has(msg.guid)");
    });

    test("skips messages from self", () => {
      expect(source).toContain("msg.isFromMe");
    });

    test("adds processed GUID to set", () => {
      expect(source).toContain("this.processedGuids.add(msg.guid)");
    });

    test("updates lastMessageTime", () => {
      expect(source).toContain("this.lastMessageTime = msg.dateCreated");
    });

    test("handles poll errors without crashing", () => {
      expect(source).toContain("Error polling BlueBubbles");
    });
  });

  // =========================================================
  // GUID deduplication
  // =========================================================

  describe("GUID deduplication", () => {
    test("maintains processedGuids Set", () => {
      expect(source).toContain("processedGuids: Set<string>");
    });

    test("checks set before processing", () => {
      expect(source).toContain("this.processedGuids.has(msg.guid)");
    });

    test("cleans up old GUIDs to prevent memory leak", () => {
      expect(source).toContain("this.processedGuids.size > 1000");
    });

    test("keeps last 500 GUIDs after cleanup", () => {
      expect(source).toContain("arr.slice(-500)");
    });
  });

  // =========================================================
  // BlueBubbles sending
  // =========================================================

  describe("BlueBubbles sending", () => {
    test("sends to /api/v1/message/text endpoint", () => {
      expect(source).toContain("/api/v1/message/text");
    });

    test("uses POST method", () => {
      expect(source).toContain('method: "POST"');
    });

    test("includes chatGuid with iMessage format", () => {
      expect(source).toContain("chatGuid");
      expect(source).toContain("iMessage;-;");
    });

    test("sends message in JSON body", () => {
      expect(source).toContain("JSON.stringify");
      expect(source).toContain("message: text");
    });

    test("checks response status on send", () => {
      expect(source).toContain("Failed to send message");
    });

    test("throws when serverUrl not configured", () => {
      expect(source).toContain("BlueBubbles not configured");
    });
  });

  // =========================================================
  // AppleScript mode
  // =========================================================

  describe("AppleScript mode", () => {
    test("uses osascript for execution", () => {
      expect(source).toContain("osascript");
    });

    test("uses execFile for AppleScript execution", () => {
      expect(source).toContain("execFile");
    });

    test("uses promisify for async execution", () => {
      expect(source).toContain("promisify(execFile)");
    });

    test("polls Messages app via AppleScript", () => {
      expect(source).toContain("pollAppleScript");
    });

    test("queries Messages application", () => {
      expect(source).toContain('tell application "Messages"');
    });

    test("parses sender and text from poll result", () => {
      expect(source).toContain('split("|||")');
    });

    test("sends via AppleScript Messages app", () => {
      expect(source).toContain("sendAppleScript");
    });

    test("escapes double quotes in AppleScript text", () => {
      expect(source).toContain("escapedText");
      expect(source).toContain('replace(/"/g');
    });

    test("escapes newlines in AppleScript text", () => {
      expect(source).toContain('replace(/\\n/g');
    });

    test("uses iMessage service type", () => {
      expect(source).toContain("service type = iMessage");
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
      expect(source).toContain("unauthorized");
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

    test("stores user messages", () => {
      expect(source).toContain('role: "user"');
    });

    test("stores assistant responses", () => {
      expect(source).toContain('role: "assistant"');
    });

    test("limits context to last 10 messages", () => {
      expect(source).toContain("context.messages.length > 10");
      expect(source).toContain("context.messages.slice(-10)");
    });

    test("tracks lastActivity timestamp", () => {
      expect(source).toContain("lastActivity");
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
  // Stop / cleanup
  // =========================================================

  describe("stop", () => {
    test("has stop method", () => {
      expect(source).toContain("async stop()");
    });

    test("sets isRunning to false", () => {
      expect(source).toContain("this.isRunning = false");
    });

    test("clears interval timer", () => {
      expect(source).toContain("clearInterval(this.pollTimer)");
    });

    test("nullifies poll timer", () => {
      expect(source).toContain("this.pollTimer = null");
    });

    test("guards against duplicate start", () => {
      expect(source).toContain("if (this.isRunning) return");
    });
  });

  // =========================================================
  // State management
  // =========================================================

  describe("state management", () => {
    test("has running getter", () => {
      expect(source).toContain("get running()");
    });

    test("tracks running state", () => {
      expect(source).toContain("private isRunning = false");
    });

    test("tracks poll timer", () => {
      expect(source).toContain("private pollTimer");
    });

    test("tracks last message time", () => {
      expect(source).toContain("private lastMessageTime");
    });
  });
});
