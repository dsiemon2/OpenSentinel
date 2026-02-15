/**
 * Recursive / Multi-Step RAG
 *
 * After initial retrieval + re-ranking, this module analyses whether the
 * retrieved context fully answers the user's query. When gaps are detected
 * it generates targeted follow-up queries, retrieves additional memories,
 * re-ranks them, and merges them with the existing result set.
 *
 * The loop repeats up to `maxSteps` iterations (default from
 * env.MULTISTEP_MAX_STEPS, itself defaulting to 2).
 *
 * Feature-gated behind env.MULTISTEP_RAG_ENABLED.
 */

import { env } from "../../config/env";
import { providerRegistry } from "../providers";
import { hybridSearch, type HybridSearchResult } from "./hybrid-search";
import { rerank, type RankedResult } from "./reranker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MultiStepOptions {
  maxSteps?: number;
  userId?: string;
  limit?: number;
}

export interface MultiStepResult {
  results: RankedResult[];
  steps: number;
  followUpQueries: string[];
}

export interface CompletenessEvaluation {
  complete: boolean;
  gaps: string[];
  followUpQueries: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPLETENESS_MAX_TOKENS = 300;
const COMPLETENESS_MODEL = "claude-sonnet-4-5-20250929";

// ---------------------------------------------------------------------------
// Completeness evaluation
// ---------------------------------------------------------------------------

/**
 * Uses the LLM to judge whether the retrieved context fully answers the
 * query. Returns a structured evaluation with any identified gaps and
 * suggested follow-up queries.
 */
export async function evaluateCompleteness(
  query: string,
  context: string
): Promise<CompletenessEvaluation> {
  try {
    const provider = providerRegistry.getDefault();

    const response = await provider.createMessage({
      model: COMPLETENESS_MODEL,
      max_tokens: COMPLETENESS_MAX_TOKENS,
      system: "You are a retrieval evaluation assistant. Only output valid JSON.",
      messages: [
        {
          role: "user",
          content:
            `Analyze whether the following context sufficiently answers the query. Return a JSON object with:\n` +
            `- "complete": boolean (true if context fully answers the query)\n` +
            `- "gaps": string[] (list of missing information)\n` +
            `- "followUpQueries": string[] (search queries to fill the gaps, max 2)\n\n` +
            `Query: ${query}\n\n` +
            `Context:\n${context}\n\n` +
            `Return only the JSON object.`,
        },
      ],
    });

    const responseText = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join("");

    const parsed = JSON.parse(responseText.trim());

    return {
      complete: Boolean(parsed.complete),
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
      followUpQueries: Array.isArray(parsed.followUpQueries)
        ? parsed.followUpQueries.slice(0, 2)
        : [],
    };
  } catch (error) {
    // If LLM call or JSON parse fails, assume complete (stop iterating)
    console.warn(
      "[MultiStepRAG] Completeness evaluation failed, assuming complete:",
      error instanceof Error ? error.message : error
    );
    return { complete: true, gaps: [], followUpQueries: [] };
  }
}

// ---------------------------------------------------------------------------
// Main multi-step retrieval
// ---------------------------------------------------------------------------

/**
 * Performs recursive multi-step retrieval-augmented generation.
 *
 * 1. Evaluates whether `initialResults` fully answer the `query`.
 * 2. If gaps are found, generates follow-up queries, retrieves more
 *    context via hybrid search + re-ranking, merges and deduplicates.
 * 3. Repeats up to `maxSteps` times.
 *
 * Returns the merged, deduplicated, and sorted result set together with
 * metadata about how many steps were taken and which follow-up queries
 * were used.
 */
export async function multiStepRetrieve(
  query: string,
  initialResults: RankedResult[],
  opts?: MultiStepOptions
): Promise<MultiStepResult> {
  // If feature is disabled, return initial results unchanged
  if (!env.MULTISTEP_RAG_ENABLED) {
    return {
      results: initialResults,
      steps: 0,
      followUpQueries: [],
    };
  }

  const maxSteps = opts?.maxSteps ?? env.MULTISTEP_MAX_STEPS;
  const userId = opts?.userId;
  const limit = opts?.limit ?? 10;

  // Use a Map keyed by memory id for deduplication
  const resultsById = new Map<string, RankedResult>();
  for (const r of initialResults) {
    resultsById.set(r.id, r);
  }

  const allFollowUpQueries: string[] = [];
  let stepsPerformed = 0;

  for (let step = 0; step < maxSteps; step++) {
    // Build context string from current result set
    const currentResults = Array.from(resultsById.values());
    const contextText = currentResults.map((r) => r.content).join("\n\n");

    // Evaluate completeness
    const evaluation = await evaluateCompleteness(query, contextText);

    if (evaluation.complete || evaluation.followUpQueries.length === 0) {
      break;
    }

    stepsPerformed++;

    // Limit to 2 follow-up queries per step
    const followUps = evaluation.followUpQueries.slice(0, 2);
    allFollowUpQueries.push(...followUps);

    // Retrieve additional results for each follow-up query
    const retrievalPromises = followUps.map(async (followUpQuery) => {
      const searchResults = await hybridSearch(followUpQuery, {
        userId,
        limit,
      });
      const rankedResults = await rerank(followUpQuery, searchResults);
      return rankedResults;
    });

    const additionalResultSets = await Promise.all(retrievalPromises);

    // Merge new results, deduplicating by id
    for (const resultSet of additionalResultSets) {
      for (const r of resultSet) {
        if (!resultsById.has(r.id)) {
          resultsById.set(r.id, r);
        }
      }
    }
  }

  // Sort merged results by rerankScore descending
  const mergedResults = Array.from(resultsById.values()).sort(
    (a, b) => b.rerankScore - a.rerankScore
  );

  return {
    results: mergedResults,
    steps: stepsPerformed,
    followUpQueries: allFollowUpQueries,
  };
}
