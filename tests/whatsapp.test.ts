import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";

// ============================================================
// WhatsApp Bot — Tests
// ============================================================
// Validates the WhatsApp integration module: file existence,
// exports, dependencies, message handling, auth flow,
// reconnection logic, and security features.
// The module cannot be directly imported because it pulls
// in @whiskeysockets/baileys and core/brain which require
// live services. We validate via source analysis.

const SOURCE_PATH = "src/inputs/whatsapp/index.ts";
const source = readFileSync(SOURCE_PATH, "utf-8");

describe("WhatsApp Bot", () => {
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

    test("exports WhatsAppBot class", () => {
      expect(source).toContain("export class WhatsAppBot");
    });

    test("exports default", () => {
      expect(source).toContain("export default WhatsAppBot");
    });
  });

  // =========================================================
  // Dependencies
  // =========================================================

  describe("dependencies", () => {
    test("imports from @whiskeysockets/baileys", () => {
      expect(source).toContain('@whiskeysockets/baileys"');
    });

    test("imports makeWASocket", () => {
      expect(source).toContain("makeWASocket");
    });

    test("imports useMultiFileAuthState", () => {
      expect(source).toContain("useMultiFileAuthState");
    });

    test("imports DisconnectReason", () => {
      expect(source).toContain("DisconnectReason");
    });

    test("imports proto for message types", () => {
      expect(source).toContain("proto");
    });

    test("imports downloadMediaMessage", () => {
      expect(source).toContain("downloadMediaMessage");
    });

    test("imports Boom from @hapi/boom", () => {
      expect(source).toContain("@hapi/boom");
      expect(source).toContain("Boom");
    });

    test("imports qrcode-terminal for QR display", () => {
      expect(source).toContain("qrcode-terminal");
    });

    test("imports chatWithTools from core brain", () => {
      expect(source).toContain("chatWithTools");
      expect(source).toContain("core/brain");
    });
  });

  // =========================================================
  // Configuration interface
  // =========================================================

  describe("configuration", () => {
    test("defines WhatsAppConfig interface", () => {
      expect(source).toContain("interface WhatsAppConfig");
    });

    test("config has authDir option", () => {
      expect(source).toContain("authDir");
    });

    test("config has allowedNumbers option", () => {
      expect(source).toContain("allowedNumbers");
    });

    test("config has printQR option", () => {
      expect(source).toContain("printQR");
    });

    test("defaults authDir to ./whatsapp-auth", () => {
      expect(source).toContain("./whatsapp-auth");
    });

    test("defaults printQR to true via nullish coalescing", () => {
      expect(source).toContain("printQR ?? true");
    });

    test("defaults allowedNumbers to empty array", () => {
      expect(source).toContain("allowedNumbers: config.allowedNumbers || []");
    });
  });

  // =========================================================
  // Connection handling
  // =========================================================

  describe("connection handling", () => {
    test("listens for connection.update events", () => {
      expect(source).toContain('"connection.update"');
    });

    test("handles open connection state", () => {
      expect(source).toContain('connection === "open"');
    });

    test("handles close connection state", () => {
      expect(source).toContain('connection === "close"');
    });

    test("sets isConnected to true on open", () => {
      expect(source).toContain("this.isConnected = true");
    });

    test("checks DisconnectReason.loggedOut for reconnect decision", () => {
      expect(source).toContain("DisconnectReason.loggedOut");
    });

    test("implements shouldReconnect logic", () => {
      expect(source).toContain("shouldReconnect");
    });

    test("calls start() again to reconnect", () => {
      // After close with non-logout reason, it calls this.start()
      expect(source).toContain("await this.start()");
    });

    test("displays QR code when available", () => {
      expect(source).toContain("qrcode.generate");
      expect(source).toContain("small: true");
    });
  });

  // =========================================================
  // Credential management
  // =========================================================

  describe("credentials", () => {
    test("uses multi-file auth state", () => {
      expect(source).toContain("useMultiFileAuthState");
    });

    test("saves credentials on update", () => {
      expect(source).toContain('"creds.update"');
      expect(source).toContain("saveCreds");
    });
  });

  // =========================================================
  // Message handling
  // =========================================================

  describe("message handling", () => {
    test("listens for messages.upsert events", () => {
      expect(source).toContain('"messages.upsert"');
    });

    test("has handleMessage method", () => {
      expect(source).toContain("handleMessage");
    });

    test("skips messages sent by self", () => {
      expect(source).toContain("msg.key.fromMe");
    });

    test("skips messages without content", () => {
      expect(source).toContain("!msg.message");
    });

    test("extracts conversation text", () => {
      expect(source).toContain("msg.message.conversation");
    });

    test("extracts extendedTextMessage text", () => {
      expect(source).toContain("msg.message.extendedTextMessage?.text");
    });

    test("skips empty text messages", () => {
      expect(source).toContain("!messageText.trim()");
    });

    test("extracts sender number from JID", () => {
      expect(source).toContain('@s.whatsapp.net", ""');
      expect(source).toContain('@g.us", ""');
    });
  });

  // =========================================================
  // Allowed numbers filtering
  // =========================================================

  describe("allowed numbers filtering", () => {
    test("checks if sender is in allowedNumbers", () => {
      expect(source).toContain("this.config.allowedNumbers");
    });

    test("only filters when allowedNumbers is non-empty", () => {
      expect(source).toContain("this.config.allowedNumbers.length > 0");
    });

    test("uses includes() for number matching", () => {
      expect(source).toContain("allowedNumbers.includes(sender)");
    });

    test("logs unauthorized message attempts", () => {
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
      expect(source).toContain("lastActivity");
    });
  });

  // =========================================================
  // Typing indicators
  // =========================================================

  describe("typing indicators", () => {
    test("sends composing presence before AI response", () => {
      expect(source).toContain('sendPresenceUpdate("composing"');
    });

    test("sends paused presence after AI response", () => {
      expect(source).toContain('sendPresenceUpdate("paused"');
    });
  });

  // =========================================================
  // sendMessage
  // =========================================================

  describe("sendMessage", () => {
    test("has sendMessage method signature", () => {
      expect(source).toContain("async sendMessage(to: string, text: string)");
    });

    test("throws when not connected", () => {
      expect(source).toContain("WhatsApp not connected");
    });

    test("checks both sock and isConnected", () => {
      expect(source).toContain("!this.sock || !this.isConnected");
    });

    test("appends @s.whatsapp.net for bare numbers", () => {
      expect(source).toContain("@s.whatsapp.net");
      expect(source).toContain('to.includes("@")');
    });

    test("sends text message via socket", () => {
      expect(source).toContain("this.sock.sendMessage(jid, { text })");
    });
  });

  // =========================================================
  // stop
  // =========================================================

  describe("stop", () => {
    test("has stop method", () => {
      expect(source).toContain("async stop()");
    });

    test("ends socket connection", () => {
      expect(source).toContain("this.sock.end(");
    });

    test("nullifies socket reference", () => {
      expect(source).toContain("this.sock = null");
    });

    test("sets isConnected to false", () => {
      expect(source).toContain("this.isConnected = false");
    });
  });

  // =========================================================
  // Error handling
  // =========================================================

  describe("error handling", () => {
    test("catches message processing errors", () => {
      expect(source).toContain("catch (error)");
    });

    test("sends error response to user on failure", () => {
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
    test("has connected getter", () => {
      expect(source).toContain("get connected()");
    });

    test("tracks connection state with isConnected", () => {
      expect(source).toContain("private isConnected = false");
    });

    test("tracks socket reference", () => {
      expect(source).toContain("private sock: WASocket | null = null");
    });
  });
});
