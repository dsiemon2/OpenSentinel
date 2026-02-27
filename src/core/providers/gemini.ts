/**
 * Google Gemini Provider
 *
 * Extends the OpenAI-compatible provider for Google's Gemini API.
 * Gemini exposes an OpenAI-compatible endpoint at
 * https://generativelanguage.googleapis.com/v1beta/openai/
 */

import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import type { LLMProviderCapabilities } from "./types";

export class GeminiProvider extends OpenAICompatibleProvider {
  constructor(
    apiKey: string,
    defaultModel: string = "gemini-2.0-flash"
  ) {
    super({
      id: "gemini",
      name: "Google Gemini",
      type: "openai-compatible",
      apiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      defaultModel,
      enabled: true,
    });
  }

  /**
   * Gemini 2.0 Flash supports vision, tool use, and streaming
   * with a 1M token context window.
   */
  override getCapabilities(): LLMProviderCapabilities {
    return {
      supportsVision: true,
      supportsToolUse: true,
      supportsStreaming: true,
      supportsExtendedThinking: false,
      supportsSystemPrompt: true,
      maxContextWindow: 1048576, // 1M tokens
    };
  }
}
