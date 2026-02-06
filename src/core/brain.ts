import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { env } from "../config/env";
import { TOOLS, executeTool, getMCPRegistry } from "../tools";
import { mcpToolsToAnthropicTools } from "./mcp";
import { buildMemoryContext } from "./memory";
import { buildModeContext, suggestMode, activateMode } from "./molt/mode-manager";
import { buildAdaptivePrompt } from "./personality/response-adapter";
import { getActivePersona } from "./personality/persona-manager";
import { detectMood } from "./personality/mood-detector";
import { trackPattern } from "./molt/evolution-tracker";
import { checkAchievements } from "./molt/achievement-system";
import { metric } from "./observability/metrics";
import { audit } from "./security/audit-logger";

const client = new Anthropic({
  apiKey: env.CLAUDE_API_KEY,
});

const SYSTEM_PROMPT = `You are OpenSentinel, a personal AI assistant with a JARVIS-like personality. You are helpful, efficient, and have a subtle sense of humor. You speak in a professional yet friendly manner.

You have access to various tools and capabilities:
- Execute shell commands on the user's system
- Manage files (read, write, search)
- Browse the web and search for information
- Remember important facts about the user and their preferences
- Spawn background agents for complex tasks
- Generate documents, spreadsheets, charts, and diagrams
- Analyze images and extract text with OCR
- Take and analyze screenshots

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

// Get all available tools (native + MCP)
function getAllTools(): Tool[] {
  const registry = getMCPRegistry();
  if (registry) {
    const mcpTools = mcpToolsToAnthropicTools(registry);
    return [...TOOLS, ...mcpTools];
  }
  return TOOLS;
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
  const startTime = Date.now();

  // Build memory context from user's query
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  let memoryContext = "";
  let modeContext = "";
  let personalityContext = "";

  if (lastUserMessage && userId) {
    try {
      memoryContext = await buildMemoryContext(lastUserMessage.content, userId);
    } catch {
      // Memory system not available, continue without it
    }

    // Build mode context
    try {
      modeContext = await buildModeContext(userId);

      // Check if we should suggest a mode change
      const suggestedMode = suggestMode(lastUserMessage.content);
      if (suggestedMode && !modeContext) {
        // Could auto-activate or notify user
      }
    } catch {
      // Mode system not available
    }

    // Build personality context (persona + mood)
    try {
      const adaptiveContext = await buildAdaptivePrompt({
        userId,
        userMessage: lastUserMessage.content,
        conversationHistory: messages.map((m) => m.content),
      });
      personalityContext = adaptiveContext.systemPromptAdditions;
    } catch {
      // Personality system not available
    }

    // Track usage pattern
    try {
      await trackPattern(userId, "topic", "chat", { messageLength: lastUserMessage.content.length });
    } catch {
      // Tracking not available
    }
  }

  const systemWithContext = SYSTEM_PROMPT + memoryContext + modeContext + personalityContext;

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
    system: systemWithContext,
    tools: getAllTools(),
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
        const toolStartTime = Date.now();

        const result = await executeTool(
          toolUse.name,
          toolUse.input as Record<string, unknown>
        );

        // Track tool usage
        if (userId) {
          try {
            await trackPattern(userId, "tool_usage", toolUse.name, { tool: toolUse.name });
            metric.toolDuration(toolUse.name, Date.now() - toolStartTime, result.success);
            await audit.toolUse(userId, toolUse.name, toolUse.input as Record<string, unknown>, result.success);
          } catch {
            // Tracking/audit not available
          }
        }

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
      system: systemWithContext,
      tools: getAllTools(),
      messages: anthropicMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  // Extract final text response
  const textContent = response.content.find((c) => c.type === "text");
  const content = textContent && textContent.type === "text" ? textContent.text : "";

  // Record metrics
  const latency = Date.now() - startTime;
  metric.latency(latency, { type: "chat" });
  metric.tokens(totalInputTokens, totalOutputTokens, { userId: userId || "unknown" });

  // Check for achievements
  if (userId) {
    try {
      await checkAchievements(userId);
    } catch {
      // Achievement system not available
    }
  }

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

// Stream event types for WebSocket streaming
export interface StreamEvent {
  type: "chunk" | "tool_start" | "tool_result" | "complete" | "error";
  data: {
    text?: string;
    toolName?: string;
    toolInput?: unknown;
    toolResult?: unknown;
    content?: string;
    inputTokens?: number;
    outputTokens?: number;
    toolsUsed?: string[];
    error?: string;
  };
}

// Streaming chat with tools - yields events as they occur
export async function* streamChatWithTools(
  messages: Message[],
  userId?: string
): AsyncGenerator<StreamEvent, BrainResponse, undefined> {
  const startTime = Date.now();

  // Build memory context
  const lastUserMessage = messages.filter((m) => m.role === "user").pop();
  let memoryContext = "";

  if (lastUserMessage && userId) {
    try {
      memoryContext = await buildMemoryContext(lastUserMessage.content, userId);
    } catch {
      // Memory system not available
    }
  }

  const systemWithContext = SYSTEM_PROMPT + memoryContext;

  // Convert messages to Anthropic format
  const anthropicMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed: string[] = [];
  let fullContent = "";

  // Initial request with streaming
  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemWithContext,
    tools: getAllTools(),
    messages: anthropicMessages,
  });

  // Process streaming events
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      fullContent += event.delta.text;
      yield {
        type: "chunk",
        data: { text: event.delta.text },
      };
    }
  }

  let response = await stream.finalMessage();
  totalInputTokens += response.usage.input_tokens;
  totalOutputTokens += response.usage.output_tokens;

  // Tool use loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
    const toolResults: ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      if (toolUse.type === "tool_use") {
        toolsUsed.push(toolUse.name);

        // Yield tool start event
        yield {
          type: "tool_start",
          data: { toolName: toolUse.name, toolInput: toolUse.input },
        };

        console.log(`[Tool] Executing: ${toolUse.name}`);
        const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

        // Yield tool result event
        yield {
          type: "tool_result",
          data: { toolName: toolUse.name, toolResult: result },
        };

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Add to messages and continue
    anthropicMessages.push({
      role: "assistant",
      content: response.content as ContentBlockParam[],
    });

    anthropicMessages.push({
      role: "user",
      content: toolResults,
    });

    // Stream the continuation
    const continueStream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemWithContext,
      tools: getAllTools(),
      messages: anthropicMessages,
    });

    for await (const event of continueStream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        fullContent += event.delta.text;
        yield {
          type: "chunk",
          data: { text: event.delta.text },
        };
      }
    }

    response = await continueStream.finalMessage();
    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;
  }

  // Yield complete event
  yield {
    type: "complete",
    data: {
      content: fullContent,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    },
  };

  // Record metrics
  const latency = Date.now() - startTime;
  metric.latency(latency, { type: "chat_stream" });
  metric.tokens(totalInputTokens, totalOutputTokens, { userId: userId || "unknown" });

  return {
    content: fullContent,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
  };
}

export { SYSTEM_PROMPT };
