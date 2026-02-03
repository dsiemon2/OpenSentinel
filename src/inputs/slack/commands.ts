import type {
  SlashCommand as BoltSlashCommand,
  AllMiddlewareArgs,
  SlackCommandMiddlewareArgs,
} from "@slack/bolt";
import { chatWithTools, type Message } from "../../core/brain";
import { scheduleReminder } from "../../core/scheduler";

/**
 * Slack slash command definition
 */
export interface SlackSlashCommand {
  command: string;
  description: string;
  usage: string;
  handler: (
    args: SlackCommandMiddlewareArgs & AllMiddlewareArgs
  ) => Promise<void>;
}

// Session storage for conversation history
const sessions = new Map<string, Message[]>();
const MAX_HISTORY = 20;

/**
 * Get session for a user
 */
export function getSession(userId: string): Message[] {
  if (!sessions.has(userId)) {
    sessions.set(userId, []);
  }
  return sessions.get(userId)!;
}

/**
 * Add message to session
 */
export function addToSession(userId: string, message: Message): void {
  const session = getSession(userId);
  session.push(message);
  if (session.length > MAX_HISTORY) {
    sessions.set(userId, session.slice(-MAX_HISTORY));
  }
}

/**
 * Clear session for a user
 */
export function clearSession(userId: string): void {
  sessions.set(userId, []);
}

/**
 * Export sessions map for external use
 */
export { sessions };

/**
 * /moltbot ask - Ask Moltbot a question
 */
export const askCommand: SlackSlashCommand = {
  command: "/moltbot-ask",
  description: "Ask Moltbot a question",
  usage: "/moltbot-ask <question>",

  async handler({ command, ack, respond, client }) {
    await ack();

    const question = command.text.trim();
    const userId = command.user_id;

    if (!question) {
      await respond({
        response_type: "ephemeral",
        text: "Please provide a question. Usage: `/moltbot-ask <question>`",
      });
      return;
    }

    try {
      addToSession(userId, { role: "user", content: question });

      const response = await chatWithTools(
        getSession(userId),
        `slack:${userId}`
      );

      addToSession(userId, { role: "assistant", content: response.content });

      // Build response with tool usage info
      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `_Used: ${toolList}_\n\n${response.content}`;
      }

      await respond({
        response_type: "in_channel",
        text: finalResponse,
        mrkdwn: true,
      });

      console.log(
        `[Slack] Processed /moltbot-ask from ${userId}. Tokens: ${response.inputTokens}/${response.outputTokens}`
      );
    } catch (error) {
      console.error("[Slack] Error processing /moltbot-ask:", error);
      await respond({
        response_type: "ephemeral",
        text: "Sorry, I encountered an error processing your question. Please try again.",
      });
    }
  },
};

/**
 * /moltbot chat - Continue a conversation
 */
export const chatCommand: SlackSlashCommand = {
  command: "/moltbot-chat",
  description: "Continue a conversation with Moltbot",
  usage: "/moltbot-chat <message>",

  async handler({ command, ack, respond }) {
    await ack();

    const message = command.text.trim();
    const userId = command.user_id;

    if (!message) {
      await respond({
        response_type: "ephemeral",
        text: "Please provide a message. Usage: `/moltbot-chat <message>`",
      });
      return;
    }

    try {
      addToSession(userId, { role: "user", content: message });

      const response = await chatWithTools(
        getSession(userId),
        `slack:${userId}`
      );

      addToSession(userId, { role: "assistant", content: response.content });

      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `_Used: ${toolList}_\n\n${response.content}`;
      }

      await respond({
        response_type: "in_channel",
        text: finalResponse,
        mrkdwn: true,
      });

      console.log(
        `[Slack] Processed /moltbot-chat from ${userId}. Tokens: ${response.inputTokens}/${response.outputTokens}`
      );
    } catch (error) {
      console.error("[Slack] Error processing /moltbot-chat:", error);
      await respond({
        response_type: "ephemeral",
        text: "Sorry, I encountered an error processing your message. Please try again.",
      });
    }
  },
};

/**
 * /moltbot clear - Clear conversation history
 */
export const clearCommand: SlackSlashCommand = {
  command: "/moltbot-clear",
  description: "Clear your conversation history with Moltbot",
  usage: "/moltbot-clear",

  async handler({ command, ack, respond }) {
    await ack();

    clearSession(command.user_id);

    await respond({
      response_type: "ephemeral",
      text: "Conversation history cleared.",
    });

    console.log(`[Slack] Cleared history for ${command.user_id}`);
  },
};

/**
 * /moltbot remind - Set a reminder
 */
export const remindCommand: SlackSlashCommand = {
  command: "/moltbot-remind",
  description: "Set a reminder",
  usage: "/moltbot-remind <time><s/m/h> <message>",

  async handler({ command, ack, respond }) {
    await ack();

    const text = command.text.trim();
    const match = text.match(/^(\d+)(s|m|h)\s+(.+)$/i);

    if (!match) {
      await respond({
        response_type: "ephemeral",
        text:
          "Invalid format. Use: `/moltbot-remind <number><s/m/h> <message>`\n\n" +
          "Examples:\n" +
          "• `/moltbot-remind 5m Check the oven`\n" +
          "• `/moltbot-remind 1h Call mom`\n" +
          "• `/moltbot-remind 30s Test reminder`",
      });
      return;
    }

    const [, amount, unit, message] = match;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
    };
    const delayMs = parseInt(amount) * multipliers[unit.toLowerCase()];

    try {
      await scheduleReminder(
        message,
        delayMs,
        `slack:${command.channel_id}:${command.user_id}`
      );

      const timeStr =
        unit === "s" ? "seconds" : unit === "m" ? "minutes" : "hours";

      await respond({
        response_type: "ephemeral",
        text: `Reminder set for ${amount} ${timeStr}: "${message}"`,
      });

      console.log(
        `[Slack] Reminder set by ${command.user_id}: ${amount}${unit} - "${message}"`
      );
    } catch (error) {
      console.error("[Slack] Error setting reminder:", error);
      await respond({
        response_type: "ephemeral",
        text: "Sorry, I couldn't set the reminder. Please try again.",
      });
    }
  },
};

/**
 * /moltbot status - Check Moltbot status
 */
export const statusCommand: SlackSlashCommand = {
  command: "/moltbot-status",
  description: "Check Moltbot status and capabilities",
  usage: "/moltbot-status",

  async handler({ command, ack, respond }) {
    await ack();

    const session = getSession(command.user_id);
    const historyCount = session.length;

    await respond({
      response_type: "ephemeral",
      text:
        "*Moltbot Status*\n\n" +
        `Bot: Online\n` +
        `Your conversation history: ${historyCount} messages\n\n` +
        "*Capabilities:*\n" +
        "• Chat and answer questions using Claude AI\n" +
        "• Execute shell commands\n" +
        "• Read and write files\n" +
        "• Search the web\n" +
        "• Remember important information\n" +
        "• Set reminders\n\n" +
        "Use `/moltbot-help` for available commands.",
    });
  },
};

/**
 * /moltbot help - Show available commands
 */
export const helpCommand: SlackSlashCommand = {
  command: "/moltbot-help",
  description: "Show available Moltbot commands",
  usage: "/moltbot-help",

  async handler({ ack, respond }) {
    await ack();

    await respond({
      response_type: "ephemeral",
      text:
        "*Moltbot Commands*\n\n" +
        "`/moltbot-ask <question>` - Ask a single question\n" +
        "`/moltbot-chat <message>` - Continue a conversation\n" +
        "`/moltbot-clear` - Clear your conversation history\n" +
        "`/moltbot-remind <time> <message>` - Set a reminder\n" +
        "`/moltbot-status` - Check bot status\n" +
        "`/moltbot-help` - Show this help message\n\n" +
        "*Tips:*\n" +
        "• Use `/moltbot-chat` for multi-turn conversations with context\n" +
        "• Use `/moltbot-ask` for quick one-off questions\n" +
        "• Mention @Moltbot in any channel to chat directly\n" +
        "• DM the bot for private conversations",
    });
  },
};

/**
 * /moltbot - Main command with subcommands
 */
export const mainCommand: SlackSlashCommand = {
  command: "/moltbot",
  description: "Moltbot AI assistant",
  usage: "/moltbot <ask|chat|clear|remind|status|help> [args]",

  async handler({ command, ack, respond }) {
    await ack();

    const [subcommand, ...args] = command.text.trim().split(/\s+/);
    const argsText = args.join(" ");

    // Route to appropriate handler
    switch (subcommand?.toLowerCase()) {
      case "ask":
        if (!argsText) {
          await respond({
            response_type: "ephemeral",
            text: "Please provide a question. Usage: `/moltbot ask <question>`",
          });
          return;
        }
        command.text = argsText;
        await askCommand.handler({ command, ack, respond } as any);
        break;

      case "chat":
        if (!argsText) {
          await respond({
            response_type: "ephemeral",
            text: "Please provide a message. Usage: `/moltbot chat <message>`",
          });
          return;
        }
        command.text = argsText;
        await chatCommand.handler({ command, ack, respond } as any);
        break;

      case "clear":
        await clearCommand.handler({ command, ack, respond } as any);
        break;

      case "remind":
        command.text = argsText;
        await remindCommand.handler({ command, ack, respond } as any);
        break;

      case "status":
        await statusCommand.handler({ command, ack, respond } as any);
        break;

      case "help":
      default:
        await respond({
          response_type: "ephemeral",
          text:
            "*Moltbot Commands*\n\n" +
            "`/moltbot ask <question>` - Ask a single question\n" +
            "`/moltbot chat <message>` - Continue a conversation\n" +
            "`/moltbot clear` - Clear your conversation history\n" +
            "`/moltbot remind <time> <message>` - Set a reminder\n" +
            "`/moltbot status` - Check bot status\n" +
            "`/moltbot help` - Show this help message\n\n" +
            "*Or use individual commands:*\n" +
            "`/moltbot-ask`, `/moltbot-chat`, `/moltbot-clear`, `/moltbot-remind`, `/moltbot-status`, `/moltbot-help`",
        });
        break;
    }
  },
};

/**
 * All available slash commands
 */
export const slashCommands: SlackSlashCommand[] = [
  mainCommand,
  askCommand,
  chatCommand,
  clearCommand,
  remindCommand,
  statusCommand,
  helpCommand,
];

/**
 * Get command by name
 */
export function getCommand(name: string): SlackSlashCommand | undefined {
  return slashCommands.find((cmd) => cmd.command === name);
}

/**
 * Get all command names
 */
export function getCommandNames(): string[] {
  return slashCommands.map((cmd) => cmd.command);
}

/**
 * Helper function to split long messages for Slack
 */
export function splitMessage(text: string, maxLength: number = 3000): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (newline or space)
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}

/**
 * Format a message as a Slack Block Kit message
 */
export function formatAsBlocks(text: string): object[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text,
      },
    },
  ];
}

/**
 * Create an error block message
 */
export function createErrorBlocks(message: string): object[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:warning: *Error*\n${message}`,
      },
    },
  ];
}

/**
 * Create a success block message
 */
export function createSuccessBlocks(message: string): object[] {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:white_check_mark: ${message}`,
      },
    },
  ];
}
