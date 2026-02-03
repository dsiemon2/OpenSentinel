import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { env } from "../config/env";
import { TOOLS, executeTool } from "../tools";
import { buildMemoryContext } from "./memory";

const client = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

const SYSTEM_PROMPT = `You are Moltbot, a personal AI assistant with a JARVIS-like personality. You are helpful, efficient, and have a subtle sense of humor. You speak in a professional yet friendly manner.

You have access to various tools and capabilities:
- Execute shell commands on the user's system
- Manage files (read, write, search)
- Browse the web and search for information
- Remember important facts about the user and their preferences

Always be concise but thorough. When executing tasks, explain what you're doing briefly. If you encounter errors, suggest solutions.

The user is your principal. Assist them with whatever they need while being mindful of security and privacy.`;

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface BrainResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed?: string[];
}

// Simple chat without tools
export async function chat(
  messages: Message[],
  systemPrompt?: string
): Promise<BrainResponse> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt || SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const textContent = response.content.find((c) => c.type === "text");
  const content = textContent ? textContent.text : "";

  return {
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Chat with tool use capability
export async function chatWithTools(
  messages: Message[],
  userId?: string,
  onToolUse?: (toolName: string, input: unknown) => void
): Promise<BrainResponse> {
  // Build memory context from user's query
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  let memoryContext = "";
  if (lastUserMessage && userId) {
    try {
      memoryContext = await buildMemoryContext(lastUserMessage.content, userId);
    } catch {
      // Memory system not available, continue without it
    }
  }

  const systemWithMemory = SYSTEM_PROMPT + memoryContext;

  // Convert messages to Anthropic format
  const anthropicMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];

  // Tool use loop
  let response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemWithMemory,
    tools: TOOLS,
    messages: anthropicMessages,
  });

  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  // Keep processing while Claude wants to use tools
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );

    const toolResults: ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type === "tool_use") {
        onToolUse?.(toolUse.name, toolUse.input);
        toolsUsed.push(toolUse.name);

        console.log(`[Tool] Executing: ${toolUse.name}`);
        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Add assistant response and tool results to messages
    anthropicMessages.push({
      role: "assistant",
      content: response.content as ContentBlockParam[],
    });

    anthropicMessages.push({
      role: "user",
      content: toolResults,
    });

    // Continue conversation
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemWithMemory,
      tools: TOOLS,
      messages: anthropicMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  // Extract final text response
  const textContent = response.content.find((c) => c.type === "text");
  const content = textContent && textContent.type === "text" ? textContent.text : "";

  return {
    content,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };
}

export async function streamChat(
  messages: Message[],
  systemPrompt?: string,
  onChunk?: (text: string) => void
): Promise<BrainResponse> {
  const stream = await client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt || SYSTEM_PROMPT,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  let fullContent = "";

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullContent += event.delta.text;
      onChunk?.(event.delta.text);
    }
  }

  const finalMessage = await stream.finalMessage();

  return {
    content: fullContent,
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
  };
}

export { SYSTEM_PROMPT };
