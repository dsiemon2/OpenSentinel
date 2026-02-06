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
 * /opensentinel ask - Ask OpenSentinel a question
 */
export const askCommand: SlackSlashCommand = {
  command: "/opensentinel-ask",
  description: "Ask OpenSentinel a question",
  usage: "/opensentinel-ask <question>",

  async handler({ command, ack, respond, client }) {
    await ack();

    const question = command.text.trim();
    const userId = command.user_id;

    if (!question) {
      await respond({
        response_type: "ephemeral",
        text: "Please provide a question. Usage: `/opensentinel-ask <question>`",
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
        `[Slack] Processed /opensentinel-ask from ${userId}. Tokens: ${response.inputTokens}/${response.outputTokens}`
      );
    } catch (error) {
      console.error("[Slack] Error processing /opensentinel-ask:", error);
      await respond({
        response_type: "ephemeral",
        text: "Sorry, I encountered an error processing your question. Please try again.",
      });
    }
  },
};

/**
 * /sentinel chat - Continue a conversation
 */
export const chatCommand: SlackSlashCommand = {
  command: "/opensentinel-chat",
  description: "Continue a conversation with OpenSentinel",
  usage: "/opensentinel-chat <message>",

  async handler({ command, ack, respond }) {
    await ack();

    const message = command.text.trim();
    const userId = command.user_id;

    if (!message) {
      await respond({
        response_type: "ephemeral",
        text: "Please provide a message. Usage: `/opensentinel-chat <message>`",
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
        `[Slack] Processed /opensentinel-chat from ${userId}. Tokens: ${response.inputTokens}/${response.outputTokens}`
      );
    } catch (error) {
      console.error("[Slack] Error processing /opensentinel-chat:", error);
      await respond({
        response_type: "ephemeral",
        text: "Sorry, I encountered an error processing your message. Please try again.",
      });
    }
  },
};

/**
 * /sentinel clear - Clear conversation history
 */
export const clearCommand: SlackSlashCommand = {
  command: "/opensentinel-clear",
  description: "Clear your conversation history with OpenSentinel",
  usage: "/opensentinel-clear",

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
 * /sentinel remind - Set a reminder
 */
export const remindCommand: SlackSlashCommand = {
  command: "/opensentinel-remind",
  description: "Set a reminder",
  usage: "/opensentinel-remind <time><s/m/h> <message>",

  async handler({ command, ack, respond }) {
    await ack();

    const text = command.text.trim();
    const match = text.match(/^(\d+)(s|m|h)\s+(.+)$/i);

    if (!match) {
      await respond({
        response_type: "ephemeral",
        text:
          "Invalid format. Use: `/opensentinel-remind <number><s/m/h> <message>`\n\n" +
          "Examples:\n" +
          "• `/opensentinel-remind 5m Check the oven`\n" +
          "• `/opensentinel-remind 1h Call mom`\n" +
          "• `/opensentinel-remind 30s Test reminder`",
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
 * /opensentinel status - Check OpenSentinel status
 */
export const statusCommand: SlackSlashCommand = {
  command: "/opensentinel-status",
  description: "Check OpenSentinel status and capabilities",
  usage: "/opensentinel-status",

  async handler({ command, ack, respond }) {
    await ack();

    const session = getSession(command.user_id);
    const historyCount = session.length;

    await respond({
      response_type: "ephemeral",
      text:
        "*OpenSentinel Status*\n\n" +
        `Bot: Online\n` +
        `Your conversation history: ${historyCount} messages\n\n` +
        "*Capabilities:*\n" +
        "• Chat and answer questions using Claude AI\n" +
        "• Execute shell commands\n" +
        "• Read and write files\n" +
        "• Search the web\n" +
        "• Remember important information\n" +
        "• Set reminders\n\n" +
        "Use `/opensentinel-help` for available commands.",
    });
  },
};

/**
 * /opensentinel help - Show available commands
 */
export const helpCommand: SlackSlashCommand = {
  command: "/opensentinel-help",
  description: "Show available OpenSentinel commands",
  usage: "/opensentinel-help",

  async handler({ ack, respond }) {
    await ack();

    await respond({
      response_type: "ephemeral",
      text:
        "*OpenSentinel Commands*\n\n" +
        "`/opensentinel-ask <question>` - Ask a single question\n" +
        "`/opensentinel-chat <message>` - Continue a conversation\n" +
        "`/opensentinel-clear` - Clear your conversation history\n" +
        "`/opensentinel-remind <time> <message>` - Set a reminder\n" +
        "`/opensentinel-status` - Check bot status\n" +
        "`/opensentinel-help` - Show this help message\n\n" +
        "*Tips:*\n" +
        "• Use `/opensentinel-chat` for multi-turn conversations with context\n" +
        "• Use `/opensentinel-ask` for quick one-off questions\n" +
        "• Mention @OpenSentinel in any channel to chat directly\n" +
        "• DM the bot for private conversations",
    });
  },
};

/**
 * /opensentinel - Main command with subcommands
 */
export const mainCommand: SlackSlashCommand = {
  command: "/opensentinel",
  description: "OpenSentinel AI assistant",
  usage: "/opensentinel <ask|chat|clear|remind|status|help> [args]",

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
            text: "Please provide a question. Usage: `/opensentinel ask <question>`",
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
            text: "Please provide a message. Usage: `/opensentinel chat <message>`",
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
            "*OpenSentinel Commands*\n\n" +
            "`/opensentinel ask <question>` - Ask a single question\n" +
            "`/opensentinel chat <message>` - Continue a conversation\n" +
            "`/opensentinel clear` - Clear your conversation history\n" +
            "`/opensentinel remind <time> <message>` - Set a reminder\n" +
            "`/opensentinel status` - Check bot status\n" +
            "`/opensentinel help` - Show this help message\n\n" +
            "*Or use individual commands:*\n" +
            "`/opensentinel-ask`, `/opensentinel-chat`, `/opensentinel-clear`, `/opensentinel-remind`, `/opensentinel-status`, `/opensentinel-help`",
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
