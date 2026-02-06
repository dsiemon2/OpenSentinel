import { Bot, Context, session } from "grammy";
import { env } from "../../config/env";
import { handleMessage, handleVoice } from "./handlers";
import { scheduleReminder } from "../../core/scheduler";

export interface SessionData {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

export type OpenSentinelContext = Context & { session: SessionData };

export function createBot() {
  const bot = new Bot<OpenSentinelContext>(env.TELEGRAM_BOT_TOKEN);

  // Session middleware for conversation history
  bot.use(
    session({
      initial: (): SessionData => ({
        messages: [],
      }),
    })
  );

  // Only allow configured chat ID
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id?.toString();
    if (chatId !== env.TELEGRAM_CHAT_ID) {
      console.log(`Unauthorized access attempt from chat ID: ${chatId}`);
      return;
    }
    await next();
  });

  // Command handlers
  bot.command("start", async (ctx) => {
    await ctx.reply(
      `Hello! I'm OpenSentinel, your personal AI assistant with JARVIS-like capabilities.

I can:
• Chat and answer questions using Claude AI
• Execute shell commands on your system
• Read and write files
• Search the web
• Remember important information
• Set reminders

Send me a message or voice note to get started!`
    );
  });

  bot.command("clear", async (ctx) => {
    ctx.session.messages = [];
    await ctx.reply("✓ Conversation history cleared.");
  });

  bot.command("remind", async (ctx) => {
    const text = ctx.message?.text?.replace("/remind", "").trim();

    if (!text) {
      await ctx.reply(
        "Usage: /remind <time> <message>\n\nExamples:\n• /remind 5m Check the oven\n• /remind 1h Call mom\n• /remind 30s Test reminder"
      );
      return;
    }

    // Parse time and message
    const match = text.match(/^(\d+)(s|m|h)\s+(.+)$/i);
    if (!match) {
      await ctx.reply(
        "Invalid format. Use: /remind <number><s/m/h> <message>\n\nExample: /remind 5m Check the oven"
      );
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
      await scheduleReminder(message, delayMs, ctx.chat?.id?.toString());
      const timeStr = unit === "s" ? "seconds" : unit === "m" ? "minutes" : "hours";
      await ctx.reply(`✓ Reminder set for ${amount} ${timeStr}: "${message}"`);
    } catch (error) {
      await ctx.reply("Sorry, I couldn't set the reminder. Please try again.");
    }
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      `*OpenSentinel Commands*

/start - Welcome message
/clear - Clear conversation history
/remind <time> <message> - Set a reminder
/help - Show this help

*Features*
• Send text messages for AI chat
• Send voice messages for voice interaction
• Ask me to run commands, search the web, or manage files

*Examples*
• "What's the weather like?"
• "List files in my Downloads folder"
• "Search for the latest news about AI"
• /remind 5m Take a break`,
      { parse_mode: "Markdown" }
    );
  });

  // Message handlers
  bot.on("message:text", handleMessage);
  bot.on("message:voice", handleVoice);

  // Error handling
  bot.catch((err) => {
    console.error("Bot error:", err);
  });

  return bot;
}
