/**
 * LLM Provider Interface
 *
 * All providers (Anthropic, OpenAI, Groq, Ollama, etc.) implement this interface.
 */

import type {
  LLMProviderCapabilities,
  LLMRequest,
  LLMResponse,
  LLMStreamResult,
} from "./types";

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  readonly type: string;

  /** Provider capabilities */
  getCapabilities(): LLMProviderCapabilities;

  /** Send a message and get a response */
  createMessage(request: LLMRequest): Promise<LLMResponse>;

  /** Send a message with streaming response */
  streamMessage(request: LLMRequest): LLMStreamResult;

  /** List available models from this provider */
  listModels(): Promise<string[]>;

  /** Check if the provider is reachable */
  isAvailable(): Promise<boolean>;
}
