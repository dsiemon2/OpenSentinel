/**
 * Embedding Registry - Singleton
 *
 * Manages the active embedding provider and dimension adapter.
 */

import type { EmbeddingProvider } from "./provider";
import { DimensionAdapter } from "./adapter";

export interface EmbeddingConfig {
  provider: "openai" | "huggingface" | "tfidf";
  model?: string;
  dimensions: number;
  dbDimensions: number;
}

const MODEL_DIMENSIONS: Record<string, number> = {
  // OpenAI
  "text-embedding-3-small": 1536,
  "text-embedding-3-large": 3072,
  "text-embedding-ada-002": 1536,
  // HuggingFace sentence-transformers
  "sentence-transformers/all-MiniLM-L6-v2": 384,
  "sentence-transformers/all-mpnet-base-v2": 768,
  "sentence-transformers/all-MiniLM-L12-v2": 384,
  "sentence-transformers/paraphrase-MiniLM-L6-v2": 384,
  // BAAI
  "BAAI/bge-small-en-v1.5": 384,
  "BAAI/bge-base-en-v1.5": 768,
  "BAAI/bge-large-en-v1.5": 1024,
};

export class EmbeddingRegistry {
  private provider: EmbeddingProvider | null = null;
  private adapter: DimensionAdapter | null = null;
  private config: EmbeddingConfig | null = null;

  initialize(provider: EmbeddingProvider, config: EmbeddingConfig): void {
    this.provider = provider;
    this.config = config;
    this.adapter = new DimensionAdapter(
      provider.dimensions,
      config.dbDimensions
    );

    if (this.adapter.needsAdaptation()) {
      const action =
        provider.dimensions < config.dbDimensions
          ? "zero-padded"
          : "truncated";
      console.log(
        `[Embeddings] Provider: ${provider.name} (${provider.dimensions} dims, ${action} to ${config.dbDimensions})`
      );
    } else {
      console.log(
        `[Embeddings] Provider: ${provider.name} (${provider.dimensions} dims)`
      );
    }
  }

  isInitialized(): boolean {
    return this.provider !== null;
  }

  getProvider(): EmbeddingProvider {
    if (!this.provider) {
      throw new Error(
        "[Embeddings] Not initialized. Call initializeEmbeddings() first."
      );
    }
    return this.provider;
  }

  getAdapter(): DimensionAdapter {
    if (!this.adapter) {
      throw new Error(
        "[Embeddings] Not initialized. Call initializeEmbeddings() first."
      );
    }
    return this.adapter;
  }

  getConfig(): EmbeddingConfig {
    if (!this.config) {
      throw new Error(
        "[Embeddings] Not initialized. Call initializeEmbeddings() first."
      );
    }
    return this.config;
  }

  getDimensions(): number {
    return this.getProvider().dimensions;
  }

  getDbDimensions(): number {
    return this.getConfig().dbDimensions;
  }

  static resolveModelDimensions(
    model: string,
    explicitDimensions?: number
  ): number {
    return explicitDimensions ?? MODEL_DIMENSIONS[model] ?? 384;
  }
}

export const embeddingRegistry = new EmbeddingRegistry();
