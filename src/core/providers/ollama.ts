/**
 * Ollama Provider
 *
 * Extends the OpenAI-compatible provider for local Ollama instances.
 * Ollama exposes an OpenAI-compatible API at /v1 and its own native
 * endpoints (e.g. /api/tags) for model management.
 */

import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import type { LLMProviderCapabilities } from "./types";

export class OllamaProvider extends OpenAICompatibleProvider {
  private baseUrl: string;

  constructor(
    baseUrl: string = "http://localhost:11434",
    defaultModel: string = "llama3.1"
  ) {
    super({
      id: "ollama",
      name: "Ollama",
      type: "openai-compatible",
      apiKey: "ollama", // Ollama doesn't require an API key
      baseUrl: `${baseUrl}/v1`,
      defaultModel,
      enabled: true,
    });

    this.baseUrl = baseUrl;
  }

  /**
   * Return conservative capabilities since not all Ollama models
   * support vision or tool use.
   */
  override getCapabilities(): LLMProviderCapabilities {
    return {
      supportsVision: false,
      supportsToolUse: false,
      supportsStreaming: true,
      supportsExtendedThinking: false,
      supportsSystemPrompt: true,
      maxContextWindow: 8192,
    };
  }

  /**
   * List available models using Ollama's native /api/tags endpoint.
   * Falls back to the parent's OpenAI-compatible listing on error.
   */
  override async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama /api/tags returned ${response.status}`);
      }
      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      if (data.models && data.models.length > 0) {
        return data.models.map((m) => m.name);
      }
      return [this.defaultModel];
    } catch {
      return super.listModels();
    }
  }

  /**
   * Check if the local Ollama server is reachable by hitting
   * the native /api/tags endpoint with a 3-second timeout.
   */
  override async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}
