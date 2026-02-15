/**
 * HyDE — Hypothetical Document Embeddings
 *
 * Instead of embedding the raw user query for retrieval, this module
 * asks an LLM to generate a hypothetical "ideal answer" document,
 * embeds *that*, and uses the resulting vector for similarity search.
 *
 * This dramatically improves retrieval quality because the hypothetical
 * document lives in the same semantic space as stored memories/documents,
 * whereas a short question often does not.
 *
 * Pipeline:
 *   1. User query → LLM generates hypothetical document
 *   2. Hypothetical document → embedding via OpenAI
 *   3. Embedding → pgvector cosine similarity search
 *   4. Original query → keyword search (tsvector)
 *   5. Results merged via Reciprocal Rank Fusion (RRF)
 *
 * Gated behind env.HYDE_ENABLED.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { env } from "../../config/env";
import { providerRegistry } from "../providers";
import { generateEmbedding } from "../memory";
import {
  hybridSearch,
  keywordSearch,
  type HybridSearchResult,
} from "./hybrid-search";

// ============================================
// Types
// ============================================

export interface HyDEOptions {
  /** Max tokens for the hypothetical document generation (default: 300) */
  maxTokens?: number;
  /** Override the system prompt used for hypothetical document generation */
  systemPrompt?: string;
}

export interface HyDESearchResult extends HybridSearchResult {
  /** The hypothetical document that was generated and embedded for retrieval */
  hydeDocument: string;
}

// ============================================
// Constants
// ============================================

const RRF_K = 60;

const DEFAULT_SYSTEM_PROMPT =
  "You are a helpful assistant. Generate a detailed document that would perfectly answer the following question. Write as if this document already exists in a knowledge base. Be specific and factual.";

const DEFAULT_MAX_TOKENS = 300;

// ============================================
// Hypothetical Document Generation
// ============================================

/**
 * Generate a hypothetical document that would perfectly answer the given query.
 *
 * Uses the default LLM provider to produce a ~200-word passage written as if
 * it were an existing knowledge-base entry. This passage is later embedded
 * so that the embedding sits closer to relevant stored documents than the
 * raw question would.
 */
export async function generateHypotheticalDocument(
  query: string,
  opts?: HyDEOptions
): Promise<string> {
  const systemPrompt = opts?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const maxTokens = opts?.maxTokens ?? DEFAULT_MAX_TOKENS;

  const provider = providerRegistry.getDefault();

  const response = await provider.createMessage({
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: query,
      },
    ],
  });

  // Extract the text from the response content blocks
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("");

  return text;
}

// ============================================
// Vector Search with Pre-computed Embedding
// ============================================

/**
 * Run pgvector cosine similarity search using a pre-computed embedding
 * rather than generating one from a text query. This is the core of HyDE:
 * we embed the hypothetical document and search with that vector.
 */
async function vectorSearchWithEmbedding(
  embedding: number[],
  userId?: string,
  limit = 10
): Promise<
  Array<{
    id: string;
    user_id: string | null;
    type: string;
    content: string;
    importance: number;
    source: string | null;
    provenance: string | null;
    created_at: Date;
    similarity: number;
  }>
> {
  const embeddingStr = JSON.stringify(embedding);

  const results = await db.execute(sql`
    SELECT
      id, user_id, type, content, importance, source, provenance,
      created_at,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
    FROM memories
    ${userId ? sql`WHERE user_id = ${userId}` : sql``}
    ORDER BY embedding <=> ${embeddingStr}::vector
    LIMIT ${limit}
  `);

  return results as any[];
}

// ============================================
// Reciprocal Rank Fusion
// ============================================

/**
 * Combine ranked lists from multiple retrieval strategies using RRF.
 * Each item receives score = sum over lists of 1/(k + rank + 1).
 */
function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string; [key: string]: unknown }>>,
  k = RRF_K
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank].id;
      const rrfScore = 1 / (k + rank + 1);
      scores.set(id, (scores.get(id) || 0) + rrfScore);
    }
  }

  return scores;
}

// ============================================
// HyDE Search Pipeline
// ============================================

/**
 * Full HyDE search pipeline:
 *
 *   1. Generate a hypothetical document from the query via LLM
 *   2. Embed the hypothetical document
 *   3. Run pgvector cosine similarity with that embedding
 *   4. Run keyword search with the *original* query (keywords matter!)
 *   5. Fuse results with Reciprocal Rank Fusion
 *
 * If HyDE is disabled (env.HYDE_ENABLED === false) or the LLM call fails,
 * this falls back to the standard hybridSearch with the original query.
 */
export async function hydeSearch(
  query: string,
  userId?: string,
  limit = 10
): Promise<HyDESearchResult[]> {
  // Gate check: fall back to regular hybrid search if HyDE is disabled
  if (!env.HYDE_ENABLED) {
    const results = await hybridSearch(query, { userId, limit });
    return results.map((r) => ({ ...r, hydeDocument: "" }));
  }

  // Step 1: Generate hypothetical document
  let hydeDocument: string;
  try {
    hydeDocument = await generateHypotheticalDocument(query);
  } catch (error) {
    console.warn("[HyDE] LLM generation failed, falling back to hybrid search:", error);
    const results = await hybridSearch(query, { userId, limit });
    return results.map((r) => ({ ...r, hydeDocument: "" }));
  }

  if (!hydeDocument || hydeDocument.trim().length === 0) {
    console.warn("[HyDE] Empty hypothetical document, falling back to hybrid search");
    const results = await hybridSearch(query, { userId, limit });
    return results.map((r) => ({ ...r, hydeDocument: "" }));
  }

  // Step 2: Embed the hypothetical document
  let hydeEmbedding: number[];
  try {
    hydeEmbedding = await generateEmbedding(hydeDocument);
  } catch (error) {
    console.warn("[HyDE] Embedding generation failed, falling back to hybrid search:", error);
    const results = await hybridSearch(query, { userId, limit });
    return results.map((r) => ({ ...r, hydeDocument: "" }));
  }

  // Step 3 & 4: Run vector search (with HyDE embedding) and keyword search (with original query) in parallel
  const fetchLimit = limit * 2; // Over-fetch for better fusion

  const [vectorResults, kwResults] = await Promise.all([
    vectorSearchWithEmbedding(hydeEmbedding, userId, fetchLimit),
    keywordSearch(query, userId, fetchLimit),
  ]);

  // Build a map of all unique results keyed by id
  const allResults = new Map<string, any>();
  for (const r of vectorResults) {
    allResults.set(r.id, r);
  }
  for (const r of kwResults) {
    if (!allResults.has(r.id)) {
      allResults.set(r.id, r);
    }
  }

  // Step 5: RRF fusion
  const rrfScores = reciprocalRankFusion([vectorResults, kwResults]);

  // Build final results
  const finalResults: HyDESearchResult[] = [];
  for (const [id, rrfScore] of rrfScores) {
    const data = allResults.get(id);
    if (!data) continue;

    finalResults.push({
      id: data.id,
      userId: data.user_id,
      type: data.type,
      content: data.content,
      importance: data.importance || 5,
      source: data.source,
      provenance: data.provenance,
      similarity: data.similarity || 0,
      keywordRank: data.keywordRank || data.keyword_rank || 0,
      rrfScore,
      createdAt: data.created_at,
      hydeDocument,
    });
  }

  // Sort by RRF score descending and take top N
  return finalResults
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);
}
