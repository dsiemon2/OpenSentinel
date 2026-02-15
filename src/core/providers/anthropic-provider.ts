/**
 * Anthropic Provider — Wraps the Anthropic SDK
 *
 * Converts between provider-agnostic LLM types and Anthropic's SDK types.
 * Handles extended thinking, vision, and tool use natively.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "./provider";
import type {
  LLMProviderCapabilities,
  LLMProviderConfig,
  LLMRequest,
  LLMResponse,
  LLMContentBlock,
  LLMStreamEvent,
  LLMStreamResult,
  LLMMessage,
  LLMTool,
} from "./types";

export class AnthropicProvider implements LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly type = "anthropic";
  private client: Anthropic;

  constructor(config: LLMProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  getCapabilities(): LLMProviderCapabilities {
    return {
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
      supportsExtendedThinking: true,
      supportsSystemPrompt: true,
      maxContextWindow: 200000,
    };
  }

  async createMessage(request: LLMRequest): Promise<LLMResponse> {
    const { system, messages } = this.extractSystem(request);

    const params: any = {
      model: request.model,
      max_tokens: request.max_tokens,
      system,
      messages,
    };

    if (request.tools?.length) {
      params.tools = request.tools.map(toLLMToolToAnthropicTool);
    }

    if (request.thinking) {
      params.thinking = request.thinking;
    }

    const response = await this.client.messages.create(params);

    return {
      content: response.content.map(anthropicBlockToLLM),
      stop_reason: mapStopReason(response.stop_reason),
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  }

  streamMessage(request: LLMRequest): LLMStreamResult {
    const { system, messages } = this.extractSystem(request);

    const params: any = {
      model: request.model,
      max_tokens: request.max_tokens,
      system,
      messages,
    };

    if (request.tools?.length) {
      params.tools = request.tools.map(toLLMToolToAnthropicTool);
    }

    const stream = this.client.messages.stream(params);

    const events: AsyncIterable<LLMStreamEvent> = {
      async *[Symbol.asyncIterator]() {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && (event.delta as any).type === "text_delta") {
            yield {
              type: "content_block_delta" as const,
              delta: { type: "text_delta" as const, text: (event.delta as any).text },
            };
          }
        }
      },
    };

    return {
      events,
      async finalMessage(): Promise<LLMResponse> {
        const msg = await stream.finalMessage();
        return {
          content: msg.content.map(anthropicBlockToLLM),
          stop_reason: mapStopReason(msg.stop_reason),
          usage: {
            input_tokens: msg.usage.input_tokens,
            output_tokens: msg.usage.output_tokens,
          },
          model: msg.model,
        };
      },
    };
  }

  async listModels(): Promise<string[]> {
    return [
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Minimal API call to check connectivity
      await this.client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Get the raw Anthropic client (for specialized use cases like vision) */
  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Extract system messages and convert LLMMessages to Anthropic MessageParam format.
   * Anthropic uses a separate `system` parameter instead of a system role message.
   */
  private extractSystem(request: LLMRequest): {
    system: string;
    messages: any[];
  } {
    let system = request.system || "";

    const messages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => llmMessageToAnthropicMessage(m));

    return { system, messages };
  }
}

// ============================================
// Conversion helpers
// ============================================

function toLLMToolToAnthropicTool(tool: LLMTool): any {
  // Anthropic uses the same format: { name, description, input_schema }
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  };
}

function llmMessageToAnthropicMessage(msg: LLMMessage): any {
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }

  // Convert content blocks
  const anthropicContent = msg.content.map((block) => {
    switch (block.type) {
      case "text":
        return { type: "text", text: block.text };
      case "image":
        return {
          type: "image",
          source: {
            type: block.source?.type || "base64",
            media_type: block.source?.mediaType || "image/jpeg",
            data: block.source?.data,
            ...(block.source?.url ? { url: block.source.url } : {}),
          },
        };
      case "tool_use":
        return {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        };
      case "tool_result":
        return {
          type: "tool_result",
          tool_use_id: block.tool_use_id,
          content: block.content,
        };
      default:
        return { type: "text", text: block.text || "" };
    }
  });

  return { role: msg.role, content: anthropicContent };
}

function anthropicBlockToLLM(block: any): LLMContentBlock {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };
    case "tool_use":
      return {
        type: "tool_use",
        id: block.id,
        name: block.name,
        input: block.input,
      };
    default:
      return { type: "text", text: block.text || "" };
  }
}

function mapStopReason(reason: string | null): LLMResponse["stop_reason"] {
  switch (reason) {
    case "end_turn":
      return "end_turn";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    default:
      return "end_turn";
  }
}
