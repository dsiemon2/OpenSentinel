/**
 * Contextual Query Rewriting
 *
 * Rewrites user queries by incorporating conversation history to resolve
 * pronouns, references, and implicit context before retrieval. This improves
 * RAG accuracy by ensuring the search query is self-contained.
 *
 * Feature-gated behind env.CONTEXTUAL_QUERY_ENABLED.
 */

import { env } from "../../config/env";
import { providerRegistry } from "../providers";

// ============================================
// Types
// ============================================

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface ContextualQueryOptions {
  /** Maximum number of recent messages to include for context. Default: 4 */
  maxHistoryMessages?: number;
  /** Override the LLM model used for rewriting. */
  model?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_MAX_HISTORY_MESSAGES = 4;
const MAX_TOKENS = 200;

const SYSTEM_PROMPT =
  "Rewrite this query to be self-contained by resolving pronouns, references, " +
  "and implicit context from the conversation. Return ONLY the rewritten query, nothing else.";

// ============================================
// Main function
// ============================================

/**
 * Rewrites a user query to be self-contained by resolving pronouns,
 * references, and implicit context from the recent conversation history.
 *
 * If the feature is disabled, conversation history is too short (< 2 messages),
 * or the LLM call fails, the original query is returned unchanged.
 *
 * @param query - The user's current query
 * @param conversationHistory - Recent conversation messages
 * @param opts - Optional configuration
 * @returns The rewritten self-contained query, or the original on failure
 */
export async function buildContextualQuery(
  query: string,
  conversationHistory: Message[],
  opts?: ContextualQueryOptions
): Promise<string> {
  try {
    // Feature gate: return original query if disabled
    if (!env.CONTEXTUAL_QUERY_ENABLED) {
      return query;
    }

    // Not enough context to resolve references
    if (!conversationHistory || conversationHistory.length < 2) {
      return query;
    }

    const maxHistory = opts?.maxHistoryMessages ?? DEFAULT_MAX_HISTORY_MESSAGES;

    // Take only the last N messages from history
    const recentHistory = conversationHistory.slice(-maxHistory);

    // Build the conversation context for the LLM
    const conversationText = recentHistory
      .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
      .join("\n");

    const userPrompt =
      `Conversation so far:\n${conversationText}\n\nCurrent query to rewrite:\n${query}`;

    const provider = providerRegistry.getDefault();
    const model = opts?.model ?? "claude-sonnet-4-5-20250929";

    const response = await provider.createMessage({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Extract text from the response content blocks
    const rewrittenQuery = response.content
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!)
      .join("")
      .trim();

    // If the LLM returned an empty response, fall back to the original query
    if (!rewrittenQuery) {
      return query;
    }

    return rewrittenQuery;
  } catch {
    // On any failure, return the original query unchanged
    return query;
  }
}
