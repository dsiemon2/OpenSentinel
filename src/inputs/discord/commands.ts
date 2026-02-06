import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import { chatWithTools, type Message } from "../../core/brain";
import { scheduleReminder } from "../../core/scheduler";

/**
 * Discord slash command definitions
 */
export interface SlashCommand {
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

// Session storage for conversation history
const sessions = new Map<string, Message[]>();
const MAX_HISTORY = 20;

function getSession(userId: string): Message[] {
  if (!sessions.has(userId)) {
    sessions.set(userId, []);
  }
  return sessions.get(userId)!;
}

function addToSession(userId: string, message: Message): void {
  const session = getSession(userId);
  session.push(message);
  if (session.length > MAX_HISTORY) {
    sessions.set(userId, session.slice(-MAX_HISTORY));
  }
}

function clearSession(userId: string): void {
  sessions.set(userId, []);
}

/**
 * /ask - Ask OpenSentinel a question
 */
export const askCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask OpenSentinel a question")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Your question for OpenSentinel")
        .setRequired(true)
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const question = interaction.options.getString("question", true);
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
      addToSession(userId, { role: "user", content: question });

      const response = await chatWithTools(
        getSession(userId),
        `discord:${userId}`
      );

      addToSession(userId, { role: "assistant", content: response.content });

      // Build response with tool usage info
      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `*Used: ${toolList}*\n\n${response.content}`;
      }

      // Discord has a 2000 character limit
      if (finalResponse.length > 2000) {
        const chunks = splitMessage(finalResponse, 2000);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(finalResponse);
      }

      console.log(
        `[Discord] Processed /ask from ${interaction.user.tag}. Tokens: ${response.inputTokens}/${response.outputTokens}`
      );
    } catch (error) {
      console.error("[Discord] Error processing /ask:", error);
      await interaction.editReply(
        "Sorry, I encountered an error processing your question. Please try again."
      );
    }
  },
};

/**
 * /chat - Multi-turn conversation with OpenSentinel
 */
export const chatCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Have a conversation with OpenSentinel")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Your message")
        .setRequired(true)
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const message = interaction.options.getString("message", true);
    const userId = interaction.user.id;

    await interaction.deferReply();

    try {
      addToSession(userId, { role: "user", content: message });

      const response = await chatWithTools(
        getSession(userId),
        `discord:${userId}`
      );

      addToSession(userId, { role: "assistant", content: response.content });

      let finalResponse = response.content;
      if (response.toolsUsed && response.toolsUsed.length > 0) {
        const toolList = [...new Set(response.toolsUsed)].join(", ");
        finalResponse = `*Used: ${toolList}*\n\n${response.content}`;
      }

      if (finalResponse.length > 2000) {
        const chunks = splitMessage(finalResponse, 2000);
        await interaction.editReply(chunks[0]);
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp(chunks[i]);
        }
      } else {
        await interaction.editReply(finalResponse);
      }

      console.log(
        `[Discord] Processed /chat from ${interaction.user.tag}. Tokens: ${response.inputTokens}/${response.outputTokens}`
      );
    } catch (error) {
      console.error("[Discord] Error processing /chat:", error);
      await interaction.editReply(
        "Sorry, I encountered an error processing your message. Please try again."
      );
    }
  },
};

/**
 * /clear - Clear conversation history
 */
export const clearCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Clear your conversation history with OpenSentinel")
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    clearSession(interaction.user.id);
    await interaction.reply({
      content: "Conversation history cleared.",
      ephemeral: true,
    });
    console.log(`[Discord] Cleared history for ${interaction.user.tag}`);
  },
};

/**
 * /remind - Set a reminder
 */
export const remindCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Set a reminder")
    .addIntegerOption((option) =>
      option
        .setName("time")
        .setDescription("Time amount")
        .setRequired(true)
        .setMinValue(1)
    )
    .addStringOption((option) =>
      option
        .setName("unit")
        .setDescription("Time unit")
        .setRequired(true)
        .addChoices(
          { name: "seconds", value: "s" },
          { name: "minutes", value: "m" },
          { name: "hours", value: "h" }
        )
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Reminder message")
        .setRequired(true)
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const time = interaction.options.getInteger("time", true);
    const unit = interaction.options.getString("unit", true);
    const message = interaction.options.getString("message", true);

    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
    };
    const delayMs = time * multipliers[unit];

    try {
      await scheduleReminder(
        message,
        delayMs,
        `discord:${interaction.channelId}:${interaction.user.id}`
      );

      const timeStr =
        unit === "s" ? "seconds" : unit === "m" ? "minutes" : "hours";
      await interaction.reply({
        content: `Reminder set for ${time} ${timeStr}: "${message}"`,
        ephemeral: true,
      });

      console.log(
        `[Discord] Reminder set by ${interaction.user.tag}: ${time}${unit} - "${message}"`
      );
    } catch (error) {
      console.error("[Discord] Error setting reminder:", error);
      await interaction.reply({
        content: "Sorry, I couldn't set the reminder. Please try again.",
        ephemeral: true,
      });
    }
  },
};

/**
 * /status - Check OpenSentinel status
 */
export const statusCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("status")
    .setDescription("Check OpenSentinel status and capabilities")
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const session = getSession(interaction.user.id);
    const historyCount = session.length;

    await interaction.reply({
      content: `**OpenSentinel Status**

Bot: Online
Your conversation history: ${historyCount} messages

**Capabilities:**
- Chat and answer questions using Claude AI
- Execute shell commands
- Read and write files
- Search the web
- Remember important information
- Set reminders
- Voice channel support (join, speak)

Use \`/help\` for available commands.`,
      ephemeral: true,
    });
  },
};

/**
 * /help - Show available commands
 */
export const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available OpenSentinel commands")
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.reply({
      content: `**OpenSentinel Commands**

\`/ask <question>\` - Ask a single question
\`/chat <message>\` - Continue a conversation
\`/clear\` - Clear your conversation history
\`/remind <time> <unit> <message>\` - Set a reminder
\`/status\` - Check bot status
\`/voice join\` - Join your voice channel
\`/voice leave\` - Leave the voice channel
\`/voice speak <text>\` - Speak text in voice channel
\`/help\` - Show this help message

**Tips:**
- Use \`/chat\` for multi-turn conversations with context
- Use \`/ask\` for quick one-off questions
- DM me directly to chat without slash commands`,
      ephemeral: true,
    });
  },
};

/**
 * /voice - Voice channel operations
 */
export const voiceCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Voice channel operations")
    .addSubcommand((subcommand) =>
      subcommand.setName("join").setDescription("Join your current voice channel")
    )
    .addSubcommand((subcommand) =>
      subcommand.setName("leave").setDescription("Leave the voice channel")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("speak")
        .setDescription("Speak text in the voice channel")
        .addStringOption((option) =>
          option
            .setName("text")
            .setDescription("Text to speak")
            .setRequired(true)
        )
    )
    .toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const subcommand = interaction.options.getSubcommand();

    // These will be implemented in the main Discord bot file
    // This is a placeholder that emits events for the bot to handle
    await interaction.reply({
      content: `Voice command received: ${subcommand}. Voice handling is managed by the Discord bot.`,
      ephemeral: true,
    });
  },
};

/**
 * All available slash commands
 */
export const slashCommands: SlashCommand[] = [
  askCommand,
  chatCommand,
  clearCommand,
  remindCommand,
  statusCommand,
  helpCommand,
  voiceCommand,
];

/**
 * Get command data for registration
 */
export function getCommandData(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return slashCommands.map((cmd) => cmd.data);
}

/**
 * Get command by name
 */
export function getCommand(name: string): SlashCommand | undefined {
  return slashCommands.find(
    (cmd) => cmd.data.name === name
  );
}

/**
 * Session management exports for external use
 */
export {
  getSession,
  addToSession,
  clearSession,
  sessions,
};

/**
 * Helper function to split long messages
 */
function splitMessage(text: string, maxLength: number): string[] {
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

export { splitMessage };
