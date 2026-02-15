/**
 * OpenAI-Compatible Provider
 *
 * Works with OpenAI, OpenRouter, Groq, Mistral, Ollama, and any
 * OpenAI-compatible API endpoint. Converts between provider-agnostic
 * LLM types and OpenAI's chat completions format.
 */

import OpenAI from "openai";
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

export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  protected client: OpenAI;
  protected defaultModel: string;
  protected capabilities: LLMProviderCapabilities;

  constructor(config: LLMProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.defaultModel = config.defaultModel || "gpt-4o";

    this.client = new OpenAI({
      apiKey: config.apiKey || "not-needed",
      baseURL: config.baseUrl,
    });

    this.capabilities = {
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
      supportsExtendedThinking: false,
      supportsSystemPrompt: true,
      maxContextWindow: 128000,
    };
  }

  getCapabilities(): LLMProviderCapabilities {
    return { ...this.capabilities };
  }

  async createMessage(request: LLMRequest): Promise<LLMResponse> {
    const messages = this.convertMessages(request);
    const model = request.model || this.defaultModel;

    const params: any = {
      model,
      messages,
      max_tokens: request.max_tokens,
    };

    if (request.tools?.length) {
      params.tools = request.tools.map(llmToolToOpenAI);
    }

    // Extended thinking not supported — log warning and ignore
    if (request.thinking) {
      console.warn(`[${this.name}] Extended thinking not supported, ignoring`);
    }

    const response = await this.client.chat.completions.create(params);
    return this.convertResponse(response, model);
  }

  streamMessage(request: LLMRequest): LLMStreamResult {
    const messages = this.convertMessages(request);
    const model = request.model || this.defaultModel;

    const params: any = {
      model,
      messages,
      max_tokens: request.max_tokens,
      stream: true,
    };

    if (request.tools?.length) {
      params.tools = request.tools.map(llmToolToOpenAI);
    }

    if (request.thinking) {
      console.warn(`[${this.name}] Extended thinking not supported, ignoring`);
    }

    // Accumulate for finalMessage
    let fullContent = "";
    let toolCalls: any[] = [];
    let finishReason = "stop";
    let inputTokens = 0;
    let outputTokens = 0;

    const streamPromise = this.client.chat.completions.create(params) as Promise<any>;

    const events: AsyncIterable<LLMStreamEvent> = {
      [Symbol.asyncIterator]() {
        return {
          streamDone: false,
          async next(): Promise<IteratorResult<LLMStreamEvent>> {
            // We need a different approach for OpenAI streaming
            // Use the non-streaming call and emit chunks manually
            return { done: true, value: undefined as any };
          },
        };
      },
    };

    // For OpenAI-compatible, we use a simpler approach: create a non-streaming
    // call wrapped as a stream-like result. This avoids complex SSE parsing
    // differences across providers.
    const self = this;

    return {
      events: {
        async *[Symbol.asyncIterator]() {
          try {
            const stream = await self.client.chat.completions.create({
              ...params,
              stream: true,
            });

            for await (const chunk of stream as any) {
              const delta = chunk.choices?.[0]?.delta;
              if (delta?.content) {
                fullContent += delta.content;
                yield {
                  type: "content_block_delta" as const,
                  delta: { type: "text_delta" as const, text: delta.content },
                };
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.index !== undefined) {
                    while (toolCalls.length <= tc.index) {
                      toolCalls.push({ id: "", name: "", arguments: "" });
                    }
                    if (tc.id) toolCalls[tc.index].id = tc.id;
                    if (tc.function?.name) toolCalls[tc.index].name = tc.function.name;
                    if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
                  }
                }
              }
              if (chunk.choices?.[0]?.finish_reason) {
                finishReason = chunk.choices[0].finish_reason;
              }
              if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens || 0;
                outputTokens = chunk.usage.completion_tokens || 0;
              }
            }
          } catch (err) {
            // If streaming fails, fall back to non-streaming
            const response = await self.client.chat.completions.create({
              ...params,
              stream: false,
            });
            const msg = (response as any).choices?.[0]?.message;
            if (msg?.content) {
              fullContent = msg.content;
              yield {
                type: "content_block_delta" as const,
                delta: { type: "text_delta" as const, text: msg.content },
              };
            }
            finishReason = (response as any).choices?.[0]?.finish_reason || "stop";
            inputTokens = (response as any).usage?.prompt_tokens || 0;
            outputTokens = (response as any).usage?.completion_tokens || 0;
          }
        },
      },
      async finalMessage(): Promise<LLMResponse> {
        const contentBlocks: LLMContentBlock[] = [];

        if (fullContent) {
          contentBlocks.push({ type: "text", text: fullContent });
        }

        for (const tc of toolCalls) {
          if (tc.name) {
            let parsedArgs: unknown = {};
            try {
              parsedArgs = JSON.parse(tc.arguments || "{}");
            } catch {
              parsedArgs = {};
            }
            contentBlocks.push({
              type: "tool_use",
              id: tc.id || `call_${Date.now()}`,
              name: tc.name,
              input: parsedArgs,
            });
          }
        }

        return {
          content: contentBlocks,
          stop_reason: finishReason === "tool_calls" ? "tool_use" : mapFinishReason(finishReason),
          usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          model,
        };
      },
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return (models.data || []).map((m: any) => m.id);
    } catch {
      return [this.defaultModel];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // Conversion helpers
  // ============================================

  protected convertMessages(request: LLMRequest): any[] {
    const messages: any[] = [];

    // Add system prompt as a system role message
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }

    for (const msg of request.messages) {
      if (msg.role === "system") continue; // Already handled above

      if (typeof msg.content === "string") {
        messages.push({ role: msg.role, content: msg.content });
        continue;
      }

      // Convert content blocks
      const hasToolResult = msg.content.some((b) => b.type === "tool_result");
      if (hasToolResult) {
        // OpenAI uses separate tool messages
        for (const block of msg.content) {
          if (block.type === "tool_result") {
            messages.push({
              role: "tool",
              tool_call_id: block.tool_use_id,
              content: block.content || "",
            });
          }
        }
        continue;
      }

      const hasToolUse = msg.content.some((b) => b.type === "tool_use");
      if (hasToolUse) {
        // Assistant message with tool calls
        const textParts = msg.content.filter((b) => b.type === "text");
        const toolParts = msg.content.filter((b) => b.type === "tool_use");

        messages.push({
          role: "assistant",
          content: textParts.map((b) => b.text).join("") || null,
          tool_calls: toolParts.map((b) => ({
            id: b.id || `call_${Date.now()}`,
            type: "function",
            function: {
              name: b.name,
              arguments: JSON.stringify(b.input || {}),
            },
          })),
        });
        continue;
      }

      // Mixed content (text + images)
      const parts: any[] = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          if (block.source?.type === "url" && block.source.url) {
            parts.push({
              type: "image_url",
              image_url: { url: block.source.url },
            });
          } else if (block.source?.data) {
            const mediaType = block.source.mediaType || "image/jpeg";
            parts.push({
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${block.source.data}`,
              },
            });
          }
        }
      }

      messages.push({ role: msg.role, content: parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts });
    }

    return messages;
  }

  protected convertResponse(response: any, model: string): LLMResponse {
    const choice = response.choices?.[0];
    const message = choice?.message;
    const contentBlocks: LLMContentBlock[] = [];

    if (message?.content) {
      contentBlocks.push({ type: "text", text: message.content });
    }

    // Convert tool calls
    if (message?.tool_calls) {
      for (const tc of message.tool_calls) {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          parsedArgs = {};
        }
        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function?.name || "",
          input: parsedArgs,
        });
      }
    }

    const finishReason = choice?.finish_reason || "stop";

    return {
      content: contentBlocks,
      stop_reason: finishReason === "tool_calls" ? "tool_use" : mapFinishReason(finishReason),
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
      model,
    };
  }
}

// ============================================
// Tool conversion
// ============================================

function llmToolToOpenAI(tool: LLMTool): any {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  };
}

function mapFinishReason(reason: string): LLMResponse["stop_reason"] {
  switch (reason) {
    case "stop":
      return "end_turn";
    case "tool_calls":
      return "tool_use";
    case "length":
      return "max_tokens";
    default:
      return "end_turn";
  }
}
