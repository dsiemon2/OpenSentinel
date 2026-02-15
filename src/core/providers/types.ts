/**
 * Provider-Agnostic LLM Types
 *
 * Abstracts over Anthropic/OpenAI API differences so the brain
 * module can work with any provider.
 */

// ============================================
// Message types
// ============================================

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string | LLMContentBlock[];
}

export interface LLMContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result";
  // Text
  text?: string;
  // Image
  source?: {
    type: "base64" | "url";
    data?: string;
    url?: string;
    mediaType?: string;
  };
  // Tool use (from assistant)
  id?: string;
  name?: string;
  input?: unknown;
  // Tool result (from user)
  tool_use_id?: string;
  content?: string;
}

// ============================================
// Tool types
// ============================================

export interface LLMTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

// ============================================
// Request / Response
// ============================================

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  system?: string;
  tools?: LLMTool[];
  max_tokens: number;
  thinking?: { type: "enabled"; budget_tokens: number } | false;
  stream?: boolean;
}

export interface LLMResponse {
  content: LLMContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop";
  usage: { input_tokens: number; output_tokens: number };
  model: string;
}

// ============================================
// Streaming
// ============================================

export interface LLMStreamEvent {
  type: "content_block_delta" | "content_block_start" | "message_start" | "message_stop";
  delta?: { type: "text_delta"; text: string };
  index?: number;
}

export interface LLMStreamResult {
  events: AsyncIterable<LLMStreamEvent>;
  finalMessage(): Promise<LLMResponse>;
}

// ============================================
// Provider config
// ============================================

export interface LLMProviderCapabilities {
  supportsVision: boolean;
  supportsToolUse: boolean;
  supportsStreaming: boolean;
  supportsExtendedThinking: boolean;
  supportsSystemPrompt: boolean;
  maxContextWindow: number;
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  type: "anthropic" | "openai" | "openai-compatible";
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  models?: string[];
  enabled: boolean;
}
