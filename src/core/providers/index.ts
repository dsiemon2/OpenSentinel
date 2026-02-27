/**
 * Provider initialization and re-exports
 */

import { env } from "../../config/env";
import { AnthropicProvider } from "./anthropic-provider";
import { OpenAICompatibleProvider } from "./openai-compatible-provider";
import { GeminiProvider } from "./gemini";
import { providerRegistry } from "./registry";

/**
 * Initialize all configured LLM providers from environment variables.
 * Called once during application startup.
 */
export async function initializeProviders(): Promise<void> {
  // Always register Anthropic if CLAUDE_API_KEY is set
  if (env.CLAUDE_API_KEY) {
    providerRegistry.register(
      new AnthropicProvider({
        id: "anthropic",
        name: "Anthropic",
        type: "anthropic",
        apiKey: env.CLAUDE_API_KEY,
        enabled: true,
      })
    );
    console.log("[LLM] Registered provider: Anthropic");
  }

  // Register OpenAI if key is set (for LLM use, separate from Whisper STT)
  if ((env as any).OPENAI_LLM_ENABLED && env.OPENAI_API_KEY) {
    providerRegistry.register(
      new OpenAICompatibleProvider({
        id: "openai",
        name: "OpenAI",
        type: "openai",
        apiKey: env.OPENAI_API_KEY,
        baseUrl: "https://api.openai.com/v1",
        defaultModel: "gpt-4o",
        enabled: true,
      })
    );
    console.log("[LLM] Registered provider: OpenAI");
  }

  // Register OpenRouter if configured
  if ((env as any).OPENROUTER_API_KEY) {
    providerRegistry.register(
      new OpenAICompatibleProvider({
        id: "openrouter",
        name: "OpenRouter",
        type: "openai-compatible",
        apiKey: (env as any).OPENROUTER_API_KEY,
        baseUrl: (env as any).OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        defaultModel: "anthropic/claude-sonnet-4-20250514",
        enabled: true,
      })
    );
    console.log("[LLM] Registered provider: OpenRouter");
  }

  // Register Groq if configured
  if ((env as any).GROQ_API_KEY) {
    providerRegistry.register(
      new OpenAICompatibleProvider({
        id: "groq",
        name: "Groq",
        type: "openai-compatible",
        apiKey: (env as any).GROQ_API_KEY,
        baseUrl: "https://api.groq.com/openai/v1",
        defaultModel: "llama-3.1-70b-versatile",
        enabled: true,
      })
    );
    console.log("[LLM] Registered provider: Groq");
  }

  // Register Mistral if configured
  if ((env as any).MISTRAL_API_KEY) {
    providerRegistry.register(
      new OpenAICompatibleProvider({
        id: "mistral",
        name: "Mistral",
        type: "openai-compatible",
        apiKey: (env as any).MISTRAL_API_KEY,
        baseUrl: "https://api.mistral.ai/v1",
        defaultModel: "mistral-large-latest",
        enabled: true,
      })
    );
    console.log("[LLM] Registered provider: Mistral");
  }

  // Register Google Gemini if configured
  if ((env as any).GEMINI_API_KEY) {
    providerRegistry.register(
      new GeminiProvider(
        (env as any).GEMINI_API_KEY,
        (env as any).GEMINI_DEFAULT_MODEL || "gemini-2.0-flash"
      )
    );
    console.log("[LLM] Registered provider: Google Gemini");
  }

  // Register generic OpenAI-compatible endpoint if configured
  if ((env as any).OPENAI_COMPATIBLE_BASE_URL) {
    providerRegistry.register(
      new OpenAICompatibleProvider({
        id: "custom",
        name: "Custom Provider",
        type: "openai-compatible",
        apiKey: (env as any).OPENAI_COMPATIBLE_API_KEY || "not-needed",
        baseUrl: (env as any).OPENAI_COMPATIBLE_BASE_URL,
        defaultModel: (env as any).OPENAI_COMPATIBLE_MODEL || "default",
        enabled: true,
      })
    );
    console.log("[LLM] Registered provider: Custom (" + (env as any).OPENAI_COMPATIBLE_BASE_URL + ")");
  }

  // Register Ollama if enabled (requires async probe)
  if ((env as any).OLLAMA_ENABLED) {
    try {
      const { OllamaProvider } = await import("./ollama");
      const ollamaBaseUrl = (env as any).OLLAMA_BASE_URL || "http://localhost:11434";
      const ollamaModel = (env as any).OLLAMA_DEFAULT_MODEL || "llama3.1";
      const ollama = new OllamaProvider(ollamaBaseUrl, ollamaModel);

      const available = await ollama.isAvailable();
      if (available) {
        providerRegistry.register(ollama);
        const models = await ollama.listModels();
        console.log(`[LLM] Registered provider: Ollama (${models.length} model(s): ${models.slice(0, 5).join(", ")})`);
      } else {
        console.warn(`[LLM] Ollama enabled but not reachable at ${ollamaBaseUrl}`);
      }
    } catch (err: any) {
      console.warn("[LLM] Failed to initialize Ollama:", err.message);
    }
  }

  // Set default provider
  const defaultId = (env as any).LLM_PROVIDER || "anthropic";
  if (providerRegistry.has(defaultId)) {
    providerRegistry.setDefault(defaultId);
  }

  const providers = providerRegistry.listProviders();
  if (providers.length === 0) {
    console.warn("[LLM] No LLM providers configured. Set CLAUDE_API_KEY or another provider key.");
  } else {
    console.log(
      `[LLM] ${providers.length} provider(s) ready. Default: ${providerRegistry.getDefaultId()}`
    );
  }
}

// Re-exports
export { providerRegistry } from "./registry";
export { AnthropicProvider } from "./anthropic-provider";
export { OpenAICompatibleProvider } from "./openai-compatible-provider";
export { OllamaProvider } from "./ollama";
export { GeminiProvider } from "./gemini";
export type { LLMProvider } from "./provider";
export type {
  LLMMessage,
  LLMContentBlock,
  LLMTool,
  LLMRequest,
  LLMResponse,
  LLMStreamEvent,
  LLMStreamResult,
  LLMProviderCapabilities,
  LLMProviderConfig,
} from "./types";
