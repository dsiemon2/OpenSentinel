/**
 * iMessage Integration
 * Connects OpenSentinel to iMessage (macOS only)
 *
 * Supports two modes:
 * 1. BlueBubbles - Requires BlueBubbles Server running on Mac
 * 2. AppleScript - Direct macOS integration (requires Full Disk Access)
 *
 * BlueBubbles: https://bluebubbles.app/
 */

import { chatWithTools } from "../../core/brain";
import type { Message } from "../../core/brain";

interface iMessageConfig {
  mode: "bluebubbles" | "applescript";
  // BlueBubbles settings
  serverUrl?: string;
  password?: string;
  // Common settings
  allowedNumbers?: string[];
  pollInterval?: number;
}

interface BlueBubblesMessage {
  guid: string;
  text: string;
  handle: {
    address: string;
  };
  isFromMe: boolean;
  dateCreated: number;
}

interface ConversationContext {
  messages: Message[];
  lastActivity: Date;
}

export class iMessageBot {
  private config: iMessageConfig;
  private conversations: Map<string, ConversationContext> = new Map();
  private isRunning = false;
  private pollTimer: Timer | null = null;
  private lastMessageTime: number = Date.now();
  private processedGuids: Set<string> = new Set();

  constructor(config: iMessageConfig) {
    this.config = {
      pollInterval: config.pollInterval || 5000,
      ...config,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    // Check platform
    if (process.platform !== "darwin" && this.config.mode === "applescript") {
      throw new Error("AppleScript mode only works on macOS");
    }

    this.isRunning = true;
    this.lastMessageTime = Date.now();

    console.log(`[iMessage] Starting in ${this.config.mode} mode...`);

    if (this.config.mode === "bluebubbles") {
      await this.startBlueBubbles();
    } else {
      await this.startAppleScript();
    }
  }

  // ============================================
  // BLUEBUBBLES MODE
  // ============================================

  private async startBlueBubbles(): Promise<void> {
    if (!this.config.serverUrl || !this.config.password) {
      throw new Error("BlueBubbles requires serverUrl and password");
    }

    // Verify connection
    const response = await fetch(`${this.config.serverUrl}/api/v1/server/info`, {
      headers: { Authorization: `Bearer ${this.config.password}` },
    });

    if (!response.ok) {
      throw new Error("Failed to connect to BlueBubbles server");
    }

    console.log("[iMessage] Connected to BlueBubbles server");

    // Start polling for new messages
    this.pollTimer = setInterval(
      () => this.pollBlueBubbles(),
      this.config.pollInterval
    );
  }

  private async pollBlueBubbles(): Promise<void> {
    if (!this.config.serverUrl) return;

    try {
      const response = await fetch(
        `${this.config.serverUrl}/api/v1/message?after=${this.lastMessageTime}&limit=50`,
        {
          headers: { Authorization: `Bearer ${this.config.password}` },
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      const messages = data.data as BlueBubblesMessage[];

      for (const msg of messages) {
        // Skip if already processed or from us
        if (this.processedGuids.has(msg.guid) || msg.isFromMe) continue;

        this.processedGuids.add(msg.guid);
        await this.handleMessage(msg.handle.address, msg.text);

        // Update last message time
        if (msg.dateCreated > this.lastMessageTime) {
          this.lastMessageTime = msg.dateCreated;
        }
      }

      // Cleanup old GUIDs (keep last 1000)
      if (this.processedGuids.size > 1000) {
        const arr = Array.from(this.processedGuids);
        this.processedGuids = new Set(arr.slice(-500));
      }
    } catch (error) {
      console.error("[iMessage] Error polling BlueBubbles:", error);
    }
  }

  private async sendBlueBubbles(to: string, text: string): Promise<void> {
    if (!this.config.serverUrl) {
      throw new Error("BlueBubbles not configured");
    }

    const response = await fetch(
      `${this.config.serverUrl}/api/v1/message/text`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.password}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatGuid: `iMessage;-;${to}`,
          message: text,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.status}`);
    }
  }

  // ============================================
  // APPLESCRIPT MODE (macOS only)
  // ============================================

  private async startAppleScript(): Promise<void> {
    console.log("[iMessage] Using AppleScript mode (macOS)");

    // Start polling Messages.app database
    this.pollTimer = setInterval(
      () => this.pollAppleScript(),
      this.config.pollInterval
    );
  }

  private async pollAppleScript(): Promise<void> {
    try {
      // Query Messages database for new messages
      const script = `
        tell application "Messages"
          set recentChats to chats
          set output to ""
          repeat with aChat in recentChats
            set lastMsg to last item of messages of aChat
            if (date sent of lastMsg) > (current date) - ${this.config.pollInterval! / 1000} then
              if sender of lastMsg is not equal to me then
                set senderNum to handle of sender of lastMsg
                set msgText to content of lastMsg
                set output to output & senderNum & "|||" & msgText & "\\n"
              end if
            end if
          end repeat
          return output
        end tell
      `;

      const result = await this.runAppleScript(script);
      if (!result.trim()) return;

      const lines = result.trim().split("\n");
      for (const line of lines) {
        const [sender, text] = line.split("|||");
        if (sender && text) {
          await this.handleMessage(sender, text);
        }
      }
    } catch (error) {
      // AppleScript errors are common, don't spam logs
    }
  }

  private async runAppleScript(script: string): Promise<string> {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);

    const { stdout } = await execFileAsync("osascript", ["-e", script]);
    return stdout;
  }

  private async sendAppleScript(to: string, text: string): Promise<void> {
    const escapedText = text.replace(/"/g, '\\"').replace(/\n/g, "\\n");

    const script = `
      tell application "Messages"
        set targetService to 1st account whose service type = iMessage
        set targetBuddy to participant "${to}" of targetService
        send "${escapedText}" to targetBuddy
      end tell
    `;

    await this.runAppleScript(script);
  }

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  private async handleMessage(sender: string, text: string): Promise<void> {
    if (!text.trim()) return;

    // Check if sender is allowed
    if (
      this.config.allowedNumbers &&
      this.config.allowedNumbers.length > 0 &&
      !this.config.allowedNumbers.includes(sender)
    ) {
      console.log(`[iMessage] Ignoring message from unauthorized: ${sender}`);
      return;
    }

    console.log(`[iMessage] Message from ${sender}: ${text.slice(0, 50)}...`);

    // Get or create conversation context
    let context = this.conversations.get(sender);
    if (!context) {
      context = { messages: [], lastActivity: new Date() };
      this.conversations.set(sender, context);
    }

    // Add user message to context
    context.messages.push({ role: "user", content: text });
    context.lastActivity = new Date();

    // Keep only last 10 messages
    if (context.messages.length > 10) {
      context.messages = context.messages.slice(-10);
    }

    try {
      // Get AI response
      const response = await chatWithTools(context.messages, sender);

      // Add assistant response to context
      context.messages.push({ role: "assistant", content: response.content });

      // Send response
      await this.sendMessage(sender, response.content);

      console.log(`[iMessage] Replied to ${sender}`);
    } catch (error) {
      console.error("[iMessage] Error processing message:", error);
      await this.sendMessage(sender, "Sorry, I encountered an error processing your request.");
    }
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (this.config.mode === "bluebubbles") {
      await this.sendBlueBubbles(to, text);
    } else {
      await this.sendAppleScript(to, text);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log("[iMessage] Disconnected");
  }

  get running(): boolean {
    return this.isRunning;
  }
}

export default iMessageBot;
