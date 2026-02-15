/**
 * Enhanced Retrieval Pipeline Orchestrator
 *
 * Wires together all 5 RAG enhancement stages into a single composable
 * pipeline that degrades gracefully when individual features are disabled:
 *
 *   1. Contextual query rewrite  (CONTEXTUAL_QUERY_ENABLED)
 *   2. HyDE embedding generation (HYDE_ENABLED)
 *   3. Cache check / store       (RETRIEVAL_CACHE_ENABLED)
 *   4. Hybrid search             (always)
 *   5. Cross-encoder re-ranking  (RERANK_ENABLED)
 *   6. Multi-step gap filling    (MULTISTEP_RAG_ENABLED)
 *
 * If every feature flag is off the pipeline reduces to a plain hybridSearch
 * call with a default rerankScore appended.
 */

import { env } from "../../config/env";
import { hybridSearch, type HybridSearchResult } from "./hybrid-search";
import { buildContextualQuery, type Message } from "./contextual-query";
import { hydeSearch } from "./hyde";
import { getRetrievalCache } from "./retrieval-cache";
import { rerank, type RankedResult } from "./reranker";
import { multiStepRetrieve } from "./multi-step";
import { generateEmbedding } from "../memory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnhancedRetrievalOptions {
  userId?: string;
  limit?: number;
  conversationHistory?: Message[];
}

export interface EnhancedRetrievalResult {
  results: RankedResult[];
  cached: boolean;
  steps: number;
  queryUsed: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert HybridSearchResults to RankedResults by attaching a rerankScore
 * derived from the existing rrfScore.
 */
function toRankedResults(
  results: HybridSearchResult[],
  defaultScore?: number,
): RankedResult[] {
  return results.map((r) => ({
    ...r,
    rerankScore: defaultScore ?? r.rrfScore * 10,
  }));
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full enhanced retrieval pipeline.
 *
 * Each stage is feature-gated and will be skipped when its flag is off.
 * On any unrecoverable error the function falls back to a plain
 * hybridSearch so callers always receive results.
 */
export async function enhancedRetrieve(
  query: string,
  opts?: EnhancedRetrievalOptions,
): Promise<EnhancedRetrievalResult> {
  const userId = opts?.userId;
  const limit = opts?.limit ?? 10;
  const conversationHistory = opts?.conversationHistory;

  let steps = 0;

  try {
    // ------------------------------------------------------------------
    // Step 1 — Contextual Query Rewrite
    // ------------------------------------------------------------------
    let effectiveQuery = query;

    if (
      env.CONTEXTUAL_QUERY_ENABLED &&
      conversationHistory &&
      conversationHistory.length >= 2
    ) {
      console.log("[EnhancedRetrieval] Contextual query rewrite enabled, rewriting query...");
      effectiveQuery = await buildContextualQuery(query, conversationHistory);
      steps++;
      console.log(`[EnhancedRetrieval] Rewritten query: "${effectiveQuery}"`);
    }

    // ------------------------------------------------------------------
    // Step 2a — Cache Check
    // ------------------------------------------------------------------
    let cached = false;
    let queryEmbedding: number[] | null = null;

    if (env.RETRIEVAL_CACHE_ENABLED) {
      console.log("[EnhancedRetrieval] Cache enabled, checking for cached results...");
      queryEmbedding = await generateEmbedding(effectiveQuery);
      const cache = getRetrievalCache();
      const cachedResult = await cache.getCachedResults(queryEmbedding);

      if (cachedResult) {
        console.log("[EnhancedRetrieval] Cache hit, using cached results");
        cached = true;
        steps++;

        let rankedResults = toRankedResults(cachedResult.results, 5);

        // Even on a cache hit we still run re-ranking and multi-step
        // so the caller gets the most relevant ordering.

        // Step 3 — Re-ranking (on cached results)
        if (env.RERANK_ENABLED) {
          console.log("[EnhancedRetrieval] Re-ranking cached results...");
          rankedResults = await rerank(effectiveQuery, cachedResult.results);
          steps++;
        }

        // Step 4 — Multi-step gap filling (on cached + re-ranked results)
        if (env.MULTISTEP_RAG_ENABLED) {
          console.log("[EnhancedRetrieval] Multi-step retrieval on cached results...");
          rankedResults = await multiStepRetrieve(effectiveQuery, rankedResults, { userId });
          steps++;
        }

        return {
          results: rankedResults,
          cached: true,
          steps,
          queryUsed: effectiveQuery,
        };
      }

      console.log("[EnhancedRetrieval] Cache miss, proceeding to search");
    }

    // ------------------------------------------------------------------
    // Step 2 — HyDE Search vs Regular Hybrid Search
    // ------------------------------------------------------------------
    let searchResults: HybridSearchResult[];

    if (env.HYDE_ENABLED) {
      console.log("[EnhancedRetrieval] HyDE enabled, generating hypothetical doc...");
      searchResults = await hydeSearch(effectiveQuery, userId, limit);
      steps++;
    } else {
      console.log("[EnhancedRetrieval] Running hybrid search...");
      searchResults = await hybridSearch(effectiveQuery, { userId, limit });
      steps++;
    }

    // ------------------------------------------------------------------
    // Step 3 — Re-ranking
    // ------------------------------------------------------------------
    let rankedResults: RankedResult[];

    if (env.RERANK_ENABLED) {
      console.log("[EnhancedRetrieval] Re-ranking results...");
      rankedResults = await rerank(effectiveQuery, searchResults);
      steps++;
    } else {
      // Convert to RankedResults with a score derived from RRF
      rankedResults = toRankedResults(searchResults);
    }

    // ------------------------------------------------------------------
    // Step 3a — Cache Store
    // ------------------------------------------------------------------
    if (env.RETRIEVAL_CACHE_ENABLED && !cached) {
      console.log("[EnhancedRetrieval] Storing results in cache...");

      // Reuse the embedding we already computed during the cache check.
      // If it was not computed yet (shouldn't happen given the flow above),
      // generate it now.
      if (!queryEmbedding) {
        queryEmbedding = await generateEmbedding(effectiveQuery);
      }

      const cache = getRetrievalCache();
      await cache.cacheResults(queryEmbedding, searchResults);
    }

    // ------------------------------------------------------------------
    // Step 4 — Multi-Step Gap Filling
    // ------------------------------------------------------------------
    if (env.MULTISTEP_RAG_ENABLED) {
      console.log("[EnhancedRetrieval] Multi-step retrieval enabled, filling gaps...");
      rankedResults = await multiStepRetrieve(effectiveQuery, rankedResults, { userId });
      steps++;
    }

    return {
      results: rankedResults,
      cached,
      steps,
      queryUsed: effectiveQuery,
    };
  } catch (error) {
    // ------------------------------------------------------------------
    // Fallback — plain hybrid search so we never return nothing
    // ------------------------------------------------------------------
    console.error(
      "[EnhancedRetrieval] Pipeline failed, falling back to plain hybrid search:",
      error instanceof Error ? error.message : error,
    );

    try {
      const fallbackResults = await hybridSearch(query, { userId, limit });
      return {
        results: toRankedResults(fallbackResults, 5),
        cached: false,
        steps: 0,
        queryUsed: query,
      };
    } catch (fallbackError) {
      console.error(
        "[EnhancedRetrieval] Fallback hybrid search also failed:",
        fallbackError instanceof Error ? fallbackError.message : fallbackError,
      );
      return {
        results: [],
        cached: false,
        steps: 0,
        queryUsed: query,
      };
    }
  }
}
