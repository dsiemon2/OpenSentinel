/**
 * Cross-Encoder Re-ranking — LLM-as-Judge relevance scoring
 *
 * After initial retrieval (vector + keyword + graph), this module sends
 * query-document pairs to an LLM in batches and asks it to score relevance
 * on a 0-10 scale. Results are then re-sorted by true semantic relevance
 * rather than embedding distance alone.
 *
 * Feature-gated behind env.RERANK_ENABLED.
 */

import { env } from "../../config/env";
import { providerRegistry } from "../providers";
import type { HybridSearchResult } from "./hybrid-search";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankedResult extends HybridSearchResult {
  /** Relevance score assigned by the cross-encoder LLM judge (0-10) */
  rerankScore: number;
}

export interface RerankOptions {
  /** Maximum number of results to return after re-ranking */
  topK?: number;
  /** Minimum relevance score to keep a result (0-10). Defaults to env.RERANK_MIN_SCORE */
  minScore?: number;
  /** Override the model used for scoring */
  model?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_MAX_TOKENS = 100;
const DEFAULT_SCORE = 5;
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildScoringPrompt(query: string, documents: string[]): string {
  const docList = documents
    .map((doc, i) => `${i + 1}. ${doc}`)
    .join("\n");

  return (
    `You are a relevance judge. Given a search query and a list of retrieved documents, ` +
    `rate each document's relevance to the query on a scale of 0-10.\n\n` +
    `Query: ${query}\n\n` +
    `Documents:\n${docList}\n\n` +
    `Return a JSON array of scores: [score1, score2, ...]\n` +
    `Only return the JSON array, nothing else.`
  );
}

// ---------------------------------------------------------------------------
// Score parsing
// ---------------------------------------------------------------------------

/**
 * Parse the LLM response into an array of numeric scores.
 * First tries JSON.parse; if that fails, falls back to extracting numbers
 * from the raw text.
 */
function parseScores(text: string, expectedCount: number): number[] {
  // Try strict JSON parse first
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) {
      return parsed.map((s) => {
        const n = Number(s);
        return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : DEFAULT_SCORE;
      });
    }
  } catch {
    // Fall through to regex extraction
  }

  // Fallback: extract all numbers from the text
  const matches = text.match(/\d+(?:\.\d+)?/g);
  if (matches && matches.length > 0) {
    return matches.slice(0, expectedCount).map((m) => {
      const n = Number(m);
      return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : DEFAULT_SCORE;
    });
  }

  // Last resort: return default scores
  return new Array(expectedCount).fill(DEFAULT_SCORE);
}

// ---------------------------------------------------------------------------
// Batch re-ranking
// ---------------------------------------------------------------------------

/**
 * Internal helper: groups results into batches and sends each batch as a
 * single LLM call for efficiency.
 */
export async function batchRerank(
  query: string,
  results: HybridSearchResult[],
  batchSize: number = DEFAULT_BATCH_SIZE,
  model?: string
): Promise<RankedResult[]> {
  const provider = providerRegistry.getDefault();
  const resolvedModel = model || DEFAULT_MODEL;
  const rankedResults: RankedResult[] = [];

  // Split results into batches
  const batches: HybridSearchResult[][] = [];
  for (let i = 0; i < results.length; i += batchSize) {
    batches.push(results.slice(i, i + batchSize));
  }

  // Process each batch
  const batchPromises = batches.map(async (batch) => {
    const documents = batch.map((r) => r.content);
    const prompt = buildScoringPrompt(query, documents);

    try {
      const response = await provider.createMessage({
        model: resolvedModel,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: "You are a relevance scoring assistant. Only output valid JSON.",
        messages: [{ role: "user", content: prompt }],
      });

      // Extract text from response
      const responseText = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text || "")
        .join("");

      const scores = parseScores(responseText, batch.length);

      return batch.map((result, idx) => ({
        ...result,
        rerankScore: idx < scores.length ? scores[idx] : DEFAULT_SCORE,
      }));
    } catch (error) {
      // If LLM call fails, assign default score to all results in this batch
      console.warn(
        `[Reranker] LLM scoring failed for batch, assigning default score of ${DEFAULT_SCORE}:`,
        error instanceof Error ? error.message : error
      );
      return batch.map((result) => ({
        ...result,
        rerankScore: DEFAULT_SCORE,
      }));
    }
  });

  const batchResults = await Promise.all(batchPromises);
  for (const batch of batchResults) {
    rankedResults.push(...batch);
  }

  return rankedResults;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Re-rank search results using an LLM as a cross-encoder relevance judge.
 *
 * Sends query + results to the LLM in batches, gets relevance scores (0-10),
 * filters by minimum score, and returns results sorted by relevance.
 *
 * If RERANK_ENABLED is false, returns results as-is with a default rerankScore.
 */
export async function rerank(
  query: string,
  results: HybridSearchResult[],
  opts?: RerankOptions
): Promise<RankedResult[]> {
  try {
    const minScore = opts?.minScore ?? env.RERANK_MIN_SCORE;

    // If re-ranking is disabled, pass through with default scores
    if (!env.RERANK_ENABLED) {
      return results.map((r) => ({ ...r, rerankScore: DEFAULT_SCORE }));
    }

    // No point re-ranking 0 or 1 results
    if (results.length <= 1) {
      return results.map((r) => ({ ...r, rerankScore: 10 }));
    }

    // Score all results via batched LLM calls
    let ranked = await batchRerank(query, results, DEFAULT_BATCH_SIZE, opts?.model);

    // Filter out results below the minimum score threshold
    ranked = ranked.filter((r) => r.rerankScore >= minScore);

    // Sort by rerankScore descending
    ranked.sort((a, b) => b.rerankScore - a.rerankScore);

    // Apply topK limit if specified
    if (opts?.topK && opts.topK > 0) {
      ranked = ranked.slice(0, opts.topK);
    }

    return ranked;
  } catch (error) {
    // If anything goes wrong, return original results with default scores
    console.error(
      "[Reranker] Re-ranking failed, returning original results:",
      error instanceof Error ? error.message : error
    );
    return results.map((r) => ({ ...r, rerankScore: DEFAULT_SCORE }));
  }
}
