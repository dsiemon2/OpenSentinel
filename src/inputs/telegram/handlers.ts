import { InputFile } from "grammy";
import type { SentinelContext } from "./bot";
import { chatWithTools, type Message } from "../../core/brain";
import { transcribeAudio } from "../../outputs/stt";
import { textToSpeech } from "../../outputs/tts";

const MAX_HISTORY = 20; // Keep last 20 messages for context

export async function handleMessage(ctx: SentinelContext) {
  const text = ctx.message?.text;
  if (!text) return;

  // Add user message to history
  ctx.session.messages.push({ role: "user", content: text });

  // Trim history if too long
  if (ctx.session.messages.length > MAX_HISTORY) {
    ctx.session.messages = ctx.session.messages.slice(-MAX_HISTORY);
  }

  // Show typing indicator
  await ctx.replyWithChatAction("typing");

  try {
    // Use chatWithTools for full capability
    const response = await chatWithTools(
      ctx.session.messages as Message[],
      ctx.chat?.id?.toString(),
      async () => {
        // Keep typing indicator alive during tool use
        await ctx.replyWithChatAction("typing");
      }
    );

    // Add assistant response to history
    ctx.session.messages.push({ role: "assistant", content: response.content });

    // Build response with tool usage info
    let finalResponse = response.content;
    if (response.toolsUsed && response.toolsUsed.length > 0) {
      const toolList = [...new Set(response.toolsUsed)].join(", ");
      finalResponse = `🔧 _Used: ${toolList}_\n\n${response.content}`;
    }

    // Send response (split if too long for Telegram)
    await sendResponse(ctx, finalResponse);

    console.log(
      `[Telegram] Processed message. Tokens: ${response.inputTokens}/${response.outputTokens}` +
        (response.toolsUsed ? ` Tools: ${response.toolsUsed.join(", ")}` : "")
    );
  } catch (error) {
    console.error("Error processing message:", error);
    await ctx.reply(
      "Sorry, I encountered an error processing your message. Please try again."
    );
  }
}

export async function handleVoice(ctx: SentinelContext) {
  const voice = ctx.message?.voice;
  if (!voice) return;

  await ctx.replyWithChatAction("typing");

  try {
    // Get voice file
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    // Download and transcribe
    const response = await fetch(fileUrl);
    const audioBuffer = await response.arrayBuffer();

    const transcription = await transcribeAudio(Buffer.from(audioBuffer));

    if (!transcription) {
      await ctx.reply("Sorry, I couldn't transcribe that voice message.");
      return;
    }

    // Show what was transcribed
    await ctx.reply(`🎤 _"${transcription}"_`, { parse_mode: "Markdown" });

    // Process as text message
    ctx.session.messages.push({ role: "user", content: transcription });

    if (ctx.session.messages.length > MAX_HISTORY) {
      ctx.session.messages = ctx.session.messages.slice(-MAX_HISTORY);
    }

    await ctx.replyWithChatAction("typing");

    const aiResponse = await chatWithTools(
      ctx.session.messages as Message[],
      ctx.chat?.id?.toString()
    );
    ctx.session.messages.push({
      role: "assistant",
      content: aiResponse.content,
    });

    // Send text response first
    await sendResponse(ctx, aiResponse.content);

    // Also send voice response if text is short enough
    if (aiResponse.content.length < 1000 && aiResponse.content.length > 10) {
      try {
        await ctx.replyWithChatAction("record_voice");
        const audioBuffer = await textToSpeech(aiResponse.content);
        if (audioBuffer) {
          await ctx.replyWithVoice(new InputFile(audioBuffer, "response.ogg"));
        }
      } catch (ttsError) {
        console.error("TTS error:", ttsError);
        // Don't fail if TTS fails, text was already sent
      }
    }

    console.log(
      `[Telegram] Processed voice message. Tokens: ${aiResponse.inputTokens}/${aiResponse.outputTokens}`
    );
  } catch (error) {
    console.error("Error processing voice message:", error);
    await ctx.reply(
      "Sorry, I encountered an error processing your voice message. Please try again."
    );
  }
}

// Helper to send response, handling Markdown errors
async function sendResponse(ctx: SentinelContext, text: string) {
  const maxLength = 4096;

  // Try with Markdown first
  try {
    if (text.length <= maxLength) {
      await ctx.reply(text, { parse_mode: "Markdown" });
    } else {
      const chunks = splitMessage(text, maxLength);
      for (const chunk of chunks) {
        await ctx.reply(chunk, { parse_mode: "Markdown" });
      }
    }
  } catch {
    // If Markdown fails, send as plain text
    if (text.length <= maxLength) {
      await ctx.reply(text);
    } else {
      const chunks = splitMessage(text, maxLength);
      for (const chunk of chunks) {
        await ctx.reply(chunk);
      }
    }
  }
}

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
