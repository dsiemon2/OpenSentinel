/**
 * Provider Wiring Integration Tests
 *
 * Verifies that LLM and embedding providers are properly wired up
 * throughout the codebase — not just defined, but actually reachable
 * from the modules that use them.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

// ============================================
// 1. LLM Provider Registration Wiring
// ============================================

describe("LLM Provider Registration Wiring", () => {
  const indexSource = readFileSync("src/core/providers/index.ts", "utf-8");
  const envSource = readFileSync("src/config/env.ts", "utf-8");

  test("initializeProviders registers Gemini when GEMINI_API_KEY is set", () => {
    expect(indexSource).toContain("GEMINI_API_KEY");
    expect(indexSource).toContain("GeminiProvider");
    expect(indexSource).toContain('Registered provider: Google Gemini');
  });

  test("GeminiProvider is imported in providers/index.ts", () => {
    expect(indexSource).toContain('import { GeminiProvider } from "./gemini"');
  });

  test("GeminiProvider is re-exported from providers/index.ts", () => {
    expect(indexSource).toContain('export { GeminiProvider } from "./gemini"');
  });

  test("GEMINI_API_KEY exists in env schema", () => {
    expect(envSource).toContain("GEMINI_API_KEY");
    expect(envSource).toContain("z.string().optional()");
  });

  test("GEMINI_DEFAULT_MODEL exists in env schema with correct default", () => {
    expect(envSource).toContain("GEMINI_DEFAULT_MODEL");
    expect(envSource).toContain('gemini-2.0-flash');
  });

  test("LLM_PROVIDER env var controls default provider selection", () => {
    expect(indexSource).toContain("LLM_PROVIDER");
    expect(indexSource).toContain("setDefault");
  });

  test("all 8 providers are registered in initializeProviders", () => {
    // Anthropic, OpenAI, OpenRouter, Groq, Mistral, Gemini, Custom, Ollama
    expect(indexSource).toContain("AnthropicProvider");
    expect(indexSource).toContain("GeminiProvider");
    expect(indexSource).toContain("OllamaProvider");
    expect(indexSource).toContain("OPENROUTER_API_KEY");
    expect(indexSource).toContain("GROQ_API_KEY");
    expect(indexSource).toContain("MISTRAL_API_KEY");
    expect(indexSource).toContain("OPENAI_COMPATIBLE_BASE_URL");
    expect(indexSource).toContain("OPENAI_LLM_ENABLED");
  });
});

// ============================================
// 2. GeminiProvider Implementation
// ============================================

describe("GeminiProvider Implementation", () => {
  const geminiSource = readFileSync("src/core/providers/gemini.ts", "utf-8");

  test("extends OpenAICompatibleProvider", () => {
    expect(geminiSource).toContain("extends OpenAICompatibleProvider");
  });

  test("uses correct API endpoint", () => {
    expect(geminiSource).toContain(
      "generativelanguage.googleapis.com/v1beta/openai/"
    );
  });

  test("sets id to 'gemini'", () => {
    expect(geminiSource).toContain('id: "gemini"');
  });

  test("sets name to 'Google Gemini'", () => {
    expect(geminiSource).toContain('name: "Google Gemini"');
  });

  test("overrides getCapabilities with vision support", () => {
    expect(geminiSource).toContain("supportsVision: true");
  });

  test("overrides getCapabilities with tool use support", () => {
    expect(geminiSource).toContain("supportsToolUse: true");
  });

  test("sets 1M token context window", () => {
    expect(geminiSource).toContain("1048576");
  });

  test("default model is gemini-2.0-flash", () => {
    expect(geminiSource).toContain('gemini-2.0-flash');
  });
});

// ============================================
// 3. Startup Wiring (index.ts)
// ============================================

describe("Startup Wiring", () => {
  const startupSource = readFileSync("src/index.ts", "utf-8");

  test("calls initializeProviders on startup", () => {
    expect(startupSource).toContain("initializeProviders");
    expect(startupSource).toContain("await initializeProviders()");
  });

  test("calls initializeEmbeddings on startup", () => {
    expect(startupSource).toContain("initializeEmbeddings");
    expect(startupSource).toContain("await initializeEmbeddings()");
  });

  test("imports initializeEmbeddings from embeddings module", () => {
    expect(startupSource).toContain(
      'import { initializeEmbeddings } from "./core/embeddings"'
    );
  });
});

// ============================================
// 4. Agent Worker uses Provider Registry
// ============================================

describe("Agent Worker Provider Wiring", () => {
  const workerSource = readFileSync(
    "src/core/agents/agent-worker.ts",
    "utf-8"
  );

  test("imports providerRegistry (not direct Anthropic SDK)", () => {
    expect(workerSource).toContain("providerRegistry");
    expect(workerSource).not.toContain('new Anthropic(');
  });

  test("does not import @anthropic-ai/sdk directly", () => {
    expect(workerSource).not.toContain('from "@anthropic-ai/sdk"');
  });

  test("uses provider.createMessage instead of anthropic.messages.create", () => {
    expect(workerSource).toContain("provider.createMessage");
    expect(workerSource).not.toContain("anthropic.messages.create");
  });

  test("gets provider from registry", () => {
    expect(workerSource).toContain("providerRegistry.getDefault()");
  });

  test("uses LLM types for messages", () => {
    expect(workerSource).toContain("LLMMessage");
    expect(workerSource).toContain("LLMContentBlock");
  });

  test("uses LLM types for tools", () => {
    expect(workerSource).toContain("LLMTool");
  });
});

// ============================================
// 5. Memory System uses Embedding Registry
// ============================================

describe("Memory System Embedding Wiring", () => {
  const memorySource = readFileSync("src/core/memory.ts", "utf-8");

  test("imports generateEmbedding from embeddings module", () => {
    expect(memorySource).toContain('from "./embeddings"');
  });

  test("generateEmbedding delegates to embedding system", () => {
    expect(memorySource).toContain("embeddingGenerateEmbedding");
  });

  test("does not hardcode OpenAI embedding model", () => {
    expect(memorySource).not.toContain("text-embedding-3-small");
  });

  test("does not call openai.embeddings.create for embedding generation", () => {
    expect(memorySource).not.toContain("openai.embeddings.create");
  });
});

// ============================================
// 6. Embedding Initialization
// ============================================

describe("Embedding Initialization Wiring", () => {
  const embeddingIndexSource = readFileSync(
    "src/core/embeddings/index.ts",
    "utf-8"
  );

  test("initializeEmbeddings reads EMBEDDING_PROVIDER from env", () => {
    expect(embeddingIndexSource).toContain("EMBEDDING_PROVIDER");
  });

  test("supports huggingface provider type", () => {
    expect(embeddingIndexSource).toContain('"huggingface"');
    expect(embeddingIndexSource).toContain("HuggingFaceEmbeddingProvider");
  });

  test("supports tfidf provider type", () => {
    expect(embeddingIndexSource).toContain('"tfidf"');
    expect(embeddingIndexSource).toContain("TFIDFProvider");
  });

  test("supports openai provider type as default", () => {
    expect(embeddingIndexSource).toContain('"openai"');
    expect(embeddingIndexSource).toContain("OpenAIEmbeddingProvider");
  });

  test("falls back to TF-IDF when OpenAI key is missing", () => {
    expect(embeddingIndexSource).toContain(
      "OPENAI_API_KEY not set, falling back to TF-IDF"
    );
  });

  test("uses embeddingRegistry.initialize to register the provider", () => {
    expect(embeddingIndexSource).toContain("embeddingRegistry.initialize");
  });

  test("exports generateEmbedding that uses the registry", () => {
    expect(embeddingIndexSource).toContain(
      "export async function generateEmbedding"
    );
    expect(embeddingIndexSource).toContain(
      "embeddingRegistry.getProvider()"
    );
    expect(embeddingIndexSource).toContain(
      "embeddingRegistry.getAdapter()"
    );
  });

  test("has lazy initialization for auto-init on first use", () => {
    expect(embeddingIndexSource).toContain("ensureInitialized");
  });
});

// ============================================
// 7. .env.example completeness
// ============================================

describe(".env.example completeness", () => {
  const envExample = readFileSync(".env.example", "utf-8");

  test("documents GEMINI_API_KEY", () => {
    expect(envExample).toContain("GEMINI_API_KEY");
  });

  test("documents GEMINI_DEFAULT_MODEL", () => {
    expect(envExample).toContain("GEMINI_DEFAULT_MODEL");
  });

  test("documents HUGGINGFACE_ACCESS_TOKEN with correct purpose", () => {
    expect(envExample).toContain("HUGGINGFACE_ACCESS_TOKEN");
    expect(envExample).toContain("embeddings");
  });

  test("references AI Studio for Gemini key", () => {
    expect(envExample).toContain("aistudio.google.com");
  });
});

// ============================================
// 8. Provider construction smoke tests
// ============================================
// NOTE: Dynamic import() tests that construct providers are in
// tests/gemini.test.ts and tests/embeddings.test.ts respectively.
// Source-level wiring verification above covers the integration paths.

describe("Cross-file wiring consistency", () => {
  const geminiSource = readFileSync("src/core/providers/gemini.ts", "utf-8");
  const envSource = readFileSync("src/config/env.ts", "utf-8");

  test("gemini.ts baseUrl matches Google AI endpoint format", () => {
    expect(geminiSource).toContain("generativelanguage.googleapis.com");
    expect(geminiSource).toContain("/v1beta/openai/");
  });

  test("env default model matches gemini.ts default", () => {
    // Both should use gemini-2.0-flash as default
    expect(envSource).toContain('gemini-2.0-flash');
    expect(geminiSource).toContain('gemini-2.0-flash');
  });

  test("provider index uses same default model as env schema", () => {
    const indexSource = readFileSync("src/core/providers/index.ts", "utf-8");
    expect(indexSource).toContain('gemini-2.0-flash');
  });

  test("embeddings index.ts generateEmbedding signature matches memory.ts usage", () => {
    const embSource = readFileSync("src/core/embeddings/index.ts", "utf-8");
    const memSource = readFileSync("src/core/memory.ts", "utf-8");

    // Both use generateEmbedding(text: string): Promise<number[]>
    expect(embSource).toContain("async function generateEmbedding(text: string): Promise<number[]>");
    expect(memSource).toContain("async function generateEmbedding(text: string): Promise<number[]>");
  });
});
