/**
 * WhatsApp Integration using Baileys
 * Connects OpenSentinel to WhatsApp Web
 */

import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
// @ts-ignore - no type declarations available
import * as qrcode from "qrcode-terminal";
import { chatWithTools } from "../../core/brain";
import type { Message } from "../../core/brain";

interface WhatsAppConfig {
  authDir?: string;
  allowedNumbers?: string[];
  printQR?: boolean;
}

interface ConversationContext {
  messages: Message[];
  lastActivity: Date;
}

export class WhatsAppBot {
  private sock: WASocket | null = null;
  private config: WhatsAppConfig;
  private conversations: Map<string, ConversationContext> = new Map();
  private isConnected = false;

  constructor(config: WhatsAppConfig = {}) {
    this.config = {
      authDir: config.authDir || "./whatsapp-auth",
      allowedNumbers: config.allowedNumbers || [],
      printQR: config.printQR ?? true,
    };
  }

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      this.config.authDir!
    );

    this.sock = makeWASocket({
      auth: state,
      printQRInTerminal: this.config.printQR,
    });

    // Handle connection updates
    this.sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && this.config.printQR) {
        console.log("[WhatsApp] Scan the QR code below to connect:");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        console.log(
          "[WhatsApp] Connection closed. Reconnecting:",
          shouldReconnect
        );

        if (shouldReconnect) {
          await this.start();
        } else {
          this.isConnected = false;
          console.log("[WhatsApp] Logged out. Please scan QR code again.");
        }
      } else if (connection === "open") {
        this.isConnected = true;
        console.log("[WhatsApp] Connected successfully!");
      }
    });

    // Save credentials on update
    this.sock.ev.on("creds.update", saveCreds);

    // Handle incoming messages
    this.sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        await this.handleMessage(msg);
      }
    });
  }

  private async handleMessage(msg: proto.IWebMessageInfo): Promise<void> {
    if (!this.sock) return;

    // Skip if no message content or if sent by us
    if (!msg.message || !msg.key || msg.key.fromMe) return;

    const remoteJid = msg.key!.remoteJid;
    if (!remoteJid) return;

    // Extract sender number
    const sender = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

    // Check if sender is allowed
    if (
      this.config.allowedNumbers &&
      this.config.allowedNumbers.length > 0 &&
      !this.config.allowedNumbers.includes(sender)
    ) {
      console.log(`[WhatsApp] Ignoring message from unauthorized number: ${sender}`);
      return;
    }

    // Extract message text
    const messageText =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    if (!messageText.trim()) return;

    console.log(`[WhatsApp] Message from ${sender}: ${messageText.slice(0, 50)}...`);

    // Get or create conversation context
    let context = this.conversations.get(remoteJid);
    if (!context) {
      context = { messages: [], lastActivity: new Date() };
      this.conversations.set(remoteJid, context);
    }

    // Add user message to context
    context.messages.push({ role: "user", content: messageText });
    context.lastActivity = new Date();

    // Keep only last 10 messages for context
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }

    try {
      // Show typing indicator
      await this.sock.sendPresenceUpdate("composing", remoteJid);

      // Get AI response
      const response = await chatWithTools(context.messages, sender);

      // Add assistant response to context
      context.messages.push({ role: "assistant", content: response.content });

      // Send response
      await this.sock.sendMessage(remoteJid, { text: response.content });

      // Clear typing indicator
      await this.sock.sendPresenceUpdate("paused", remoteJid);

      console.log(`[WhatsApp] Replied to ${sender}`);
    } catch (error) {
      console.error("[WhatsApp] Error processing message:", error);

      await this.sock.sendMessage(remoteJid, {
        text: "Sorry, I encountered an error processing your request.",
      });
    }
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.sock || !this.isConnected) {
      throw new Error("WhatsApp not connected");
    }

    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text });
  }

  async stop(): Promise<void> {
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
      this.isConnected = false;
      console.log("[WhatsApp] Disconnected");
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

export default WhatsAppBot;
