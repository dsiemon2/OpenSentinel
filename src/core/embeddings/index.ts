/**
 * Embedding System - Public API
 *
 * Unified entry point for all embedding operations.
 * Supports OpenAI, HuggingFace, and TF-IDF backends.
 */

import { env } from "../../config/env";
import {
  OpenAIEmbeddingProvider,
  HuggingFaceEmbeddingProvider,
  TFIDFProvider,
} from "./provider";
import { embeddingRegistry } from "./registry";
import { EmbeddingRegistry } from "./registry";
import type { EmbeddingProvider } from "./provider";

export type { EmbeddingProvider } from "./provider";
export {
  OpenAIEmbeddingProvider,
  HuggingFaceEmbeddingProvider,
  TFIDFProvider,
} from "./provider";
export { embeddingRegistry } from "./registry";
export { DimensionAdapter } from "./adapter";

let _initPromise: Promise<void> | null = null;

/**
 * Initialize the embedding subsystem from environment config.
 * Called at startup; also auto-called lazily on first use.
 */
export async function initializeEmbeddings(): Promise<void> {
  if (embeddingRegistry.isInitialized()) return;

  const providerType = ((env as any).EMBEDDING_PROVIDER || "openai") as
    | "openai"
    | "huggingface"
    | "tfidf";
  const model = (env as any).EMBEDDING_MODEL as string | undefined;
  const explicitDimensions = (env as any).EMBEDDING_DIMENSIONS as
    | number
    | undefined;
  const dbDimensions =
    ((env as any).EMBEDDING_DB_DIMENSIONS as number | undefined) ?? 1536;

  let provider: EmbeddingProvider;

  switch (providerType) {
    case "huggingface": {
      const token = env.HUGGINGFACE_ACCESS_TOKEN;
      if (!token) {
        throw new Error(
          "[Embeddings] HUGGINGFACE_ACCESS_TOKEN required for huggingface provider"
        );
      }
      const hfModel = model || "sentence-transformers/all-MiniLM-L6-v2";
      const dims = EmbeddingRegistry.resolveModelDimensions(
        hfModel,
        explicitDimensions
      );
      const batchSize =
        ((env as any).EMBEDDING_BATCH_SIZE as number | undefined) ?? 32;
      provider = new HuggingFaceEmbeddingProvider(
        token,
        hfModel,
        dims,
        batchSize
      );
      break;
    }
    case "tfidf": {
      provider = new TFIDFProvider();
      console.log("[Embeddings] Using TF-IDF fallback (no API required)");
      break;
    }
    case "openai":
    default: {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        console.warn(
          "[Embeddings] OPENAI_API_KEY not set, falling back to TF-IDF"
        );
        provider = new TFIDFProvider();
        break;
      }
      const oaiModel = model || "text-embedding-3-small";
      provider = new OpenAIEmbeddingProvider(apiKey, oaiModel);
      break;
    }
  }

  embeddingRegistry.initialize(provider, {
    provider: providerType,
    model,
    dimensions: provider.dimensions,
    dbDimensions,
  });
}

/**
 * Ensure embeddings are initialized (lazy fallback).
 */
async function ensureInitialized(): Promise<void> {
  if (embeddingRegistry.isInitialized()) return;
  if (!_initPromise) {
    _initPromise = initializeEmbeddings();
  }
  await _initPromise;
}

/**
 * Generate an embedding for a single text.
 * Returns a vector adapted to the database column dimensions.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  await ensureInitialized();
  const provider = embeddingRegistry.getProvider();
  const adapter = embeddingRegistry.getAdapter();
  const raw = await provider.embedSingle(text);
  return adapter.adapt(raw);
}

/**
 * Generate embeddings for multiple texts in batch.
 * Returns vectors adapted to the database column dimensions.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];
  await ensureInitialized();
  const provider = embeddingRegistry.getProvider();
  const adapter = embeddingRegistry.getAdapter();
  const raw = await provider.embed(texts);
  return adapter.adaptBatch(raw);
}

/**
 * Get the native provider dimensions (before adaptation).
 */
export function getEmbeddingDimensions(): number {
  return embeddingRegistry.getDimensions();
}

/**
 * Get the database column dimensions (after adaptation).
 */
export function getEmbeddingDbDimensions(): number {
  return embeddingRegistry.getDbDimensions();
}

/**
 * Get the active embedding provider name.
 */
export function getEmbeddingProviderName(): string {
  return embeddingRegistry.getProvider().name;
}
