/**
 * Signal Integration using signal-cli
 * Connects OpenSentinel to Signal Messenger
 *
 * Prerequisites:
 * 1. Install signal-cli: https://github.com/AsamK/signal-cli
 * 2. Register/link your phone number with signal-cli
 * 3. Run signal-cli in JSON-RPC mode: signal-cli -u +1234567890 jsonRpc
 */

import { spawn, type ChildProcess } from "node:child_process";
import { chatWithTools } from "../../core/brain";
import type { Message } from "../../core/brain";

interface SignalConfig {
  phoneNumber: string;
  signalCliPath?: string;
  allowedNumbers?: string[];
  configDir?: string;
}

interface SignalMessage {
  envelope: {
    source: string;
    sourceNumber: string;
    timestamp: number;
    dataMessage?: {
      message: string;
      timestamp: number;
    };
  };
}

interface ConversationContext {
  messages: Message[];
  lastActivity: Date;
}

export class SignalBot {
  private config: SignalConfig;
  private process: ChildProcess | null = null;
  private conversations: Map<string, ConversationContext> = new Map();
  private isRunning = false;

  constructor(config: SignalConfig) {
    this.config = {
      signalCliPath: config.signalCliPath || "signal-cli",
      configDir: config.configDir || "~/.local/share/signal-cli",
      allowedNumbers: config.allowedNumbers || [],
      ...config,
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    console.log(`[Signal] Starting signal-cli for ${this.config.phoneNumber}...`);

    // Start signal-cli in JSON-RPC mode
    this.process = spawn(
      this.config.signalCliPath!,
      ["-u", this.config.phoneNumber, "jsonRpc"],
      { stdio: ["pipe", "pipe", "pipe"] }
    );

    this.isRunning = true;

    // Read stdout for incoming messages
    this.readMessages();

    // Read stderr for logging
    this.readStderr();

    console.log("[Signal] Bot started, listening for messages...");
  }

  private readMessages(): void {
    if (!this.process?.stdout) return;

    let buffer = "";

    this.process.stdout.on("data", async (chunk: Buffer) => {
      buffer += chunk.toString();

      // Process complete JSON lines
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.method === "receive") {
            await this.handleMessage(data.params);
          }
        } catch {
          // Not valid JSON, skip
        }
      }
    });

    this.process.stdout.on("error", (error) => {
      if (this.isRunning) {
        console.error("[Signal] Error reading messages:", error);
      }
    });
  }

  private readStderr(): void {
    if (!this.process?.stderr) return;

    this.process.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.trim()) {
        console.log(`[Signal] stderr: ${text.trim()}`);
      }
    });
  }

  private async handleMessage(message: SignalMessage): Promise<void> {
    const { envelope } = message;
    if (!envelope.dataMessage?.message) return;

    const sender = envelope.sourceNumber || envelope.source;
    const text = envelope.dataMessage.message;

    // Check if sender is allowed
    if (
      this.config.allowedNumbers &&
      this.config.allowedNumbers.length > 0 &&
      !this.config.allowedNumbers.includes(sender)
    ) {
      console.log(`[Signal] Ignoring message from unauthorized number: ${sender}`);
      return;
    }

    console.log(`[Signal] Message from ${sender}: ${text.slice(0, 50)}...`);

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

      console.log(`[Signal] Replied to ${sender}`);
    } catch (error) {
      console.error("[Signal] Error processing message:", error);
      await this.sendMessage(sender, "Sorry, I encountered an error processing your request.");
    }
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error("Signal not connected");
    }

    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "send",
      params: {
        recipient: [to],
        message: text,
      },
    };

    this.process.stdin.write(JSON.stringify(request) + "\n");
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.process) {
      this.process.kill();
      this.process = null;
      console.log("[Signal] Disconnected");
    }
  }

  get running(): boolean {
    return this.isRunning;
  }
}

export default SignalBot;
