// ============================================
// Memory Middleware — Pre-search + Post-extract for AI Memory paradigm
// ============================================
// Pre-call: Smart memory search that runs before every AI call
// Post-call: Fire-and-forget fact extraction after every AI response
// Implements the "AI Memory" column from the RAG evolution diagram:
//   Query → LLM Agent → Search Memory + Tools + Store Memory → Context → LLM → Response

import { env } from "../../config/env";
import { searchMemories, storeMemory, generateEmbedding, buildMemoryContext } from "../memory";
import { providerRegistry } from "../providers";
import { MODEL_TIERS } from "../brain/router";
import { brainTelemetry } from "../observability/brain-telemetry";
import type { Memory } from "../../db";

// ============================================
// Types
// ============================================

export interface FormattedMemory {
  id: string;
  type: string;
  content: string;
  similarity: number;
  provenance: string | null;
}

export interface MemorySearchResult {
  memories: FormattedMemory[];
  contextString: string;
  searchPerformed: boolean;
  latencyMs: number;
}

export interface ExtractedFact {
  content: string;
  type: "preference" | "fact" | "instruction" | "context";
  importance: number;
  category?: string;
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  stored: number;
  duplicates: number;
  latencyMs: number;
}

// ============================================
// Trivial Message Detection
// ============================================

const TRIVIAL_PATTERNS = [
  /^(ok|okay|k|kk|yep|yup|nope|nah|yes|no|sure|thanks|thank you|ty|thx|np|gg|lol|haha|hmm|ah|oh|wow|cool|nice|great|good|fine|alright|gotcha|got it|understood|roger|copy|ack)\.?!?$/i,
  /^(hi|hello|hey|yo|sup|gm|gn|morning|evening|night|bye|goodbye|cya|later|cheers)\.?!?$/i,
  /^(what|how|who|when|where|why)\?$/i,
  /^\.{1,3}$/,
  /^[👍👎🤔😊😂❤️🙏💯✅❌]+$/,
];

/**
 * Decide if a message warrants memory search.
 * Short greetings, acknowledgments, and emoji-only messages don't need memory context.
 */
export function shouldSearchMemories(message: string): boolean {
  const trimmed = message.trim();

  // Too short to be meaningful
  if (trimmed.length < 3) return false;

  // Check against trivial patterns
  for (const pattern of TRIVIAL_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  // Single word under 6 chars is probably trivial
  if (trimmed.split(/\s+/).length === 1 && trimmed.length < 6) return false;

  return true;
}

// ============================================
// Pre-call: Smart Memory Search
// ============================================

/**
 * Pre-call: Search for relevant memories before the main AI call.
 * Performs semantic search with configurable similarity threshold.
 * Returns top-5 memories formatted for system prompt injection.
 *
 * Uses the existing enhanced retrieval pipeline when advanced RAG is enabled,
 * falling back to basic searchMemories().
 */
export async function searchRelevantMemories(
  query: string,
  userId: string,
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
): Promise<MemorySearchResult> {
  const startTime = Date.now();

  // Skip search for trivial messages
  if (!shouldSearchMemories(query)) {
    return {
      memories: [],
      contextString: "",
      searchPerformed: false,
      latencyMs: Date.now() - startTime,
    };
  }

  try {
    // Delegate to existing buildMemoryContext which already handles
    // enhanced retrieval (HyDE, re-ranking, multi-step) when enabled
    const contextString = await buildMemoryContext(query, userId, conversationHistory);

    // Parse the context back into structured form for the orchestrator
    const memories: FormattedMemory[] = [];
    if (contextString) {
      const lines = contextString.split("\n").filter((l) => l.startsWith("- ["));
      for (const line of lines) {
        const typeMatch = line.match(/\[(\w+)\]/);
        const simMatch = line.match(/(?:relevance|rerank): ([\d.]+)/);
        const provMatch = line.match(/\[([^\]]+)\]$/);
        memories.push({
          id: "",
          type: typeMatch?.[1] || "semantic",
          content: line.replace(/^- \[\w+\] /, "").replace(/\s*\(.*\)$/, ""),
          similarity: simMatch ? parseFloat(simMatch[1]) / (simMatch[0].includes("rerank") ? 10 : 100) : 0,
          provenance: provMatch?.[1] || null,
        });
      }
    }

    // Filter by similarity threshold
    const threshold = env.AUTO_MEMORY_SEARCH_THRESHOLD ?? 0.3;
    const filtered = memories.filter((m) => m.similarity >= threshold);

    return {
      memories: filtered,
      contextString,
      searchPerformed: true,
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error("[MemoryMiddleware] Pre-search failed:", error);
    return {
      memories: [],
      contextString: "",
      searchPerformed: false,
      latencyMs: Date.now() - startTime,
    };
  }
}

// ============================================
// Post-call: Fire-and-Forget Fact Extraction
// ============================================

const EXTRACTION_PROMPT = `Extract important facts from this conversation that should be remembered about the user.
Focus on: preferences, personal facts, instructions they gave, and important context.
Be selective — only extract truly memorable information, not generic statements.

User said: "{USER_MESSAGE}"
AI responded: "{AI_RESPONSE}"

Return JSON: {"facts": [{"content": "...", "type": "preference|fact|instruction|context", "importance": 1-10}]}
Return {"facts": []} if nothing worth remembering.
Types:
- preference: things the user likes/dislikes, preferred tools, workflows
- fact: personal details (name, job, location, relationships, projects)
- instruction: standing orders ("always use TypeScript", "call me Dave")
- context: situational info that adds to understanding (current project, deadline)`;

// Map extraction types to DB memory types
const TYPE_TO_DB_TYPE: Record<string, "semantic" | "episodic" | "procedural"> = {
  preference: "semantic",
  fact: "semantic",
  instruction: "procedural",
  context: "episodic",
};

/**
 * Post-call: Extract and store facts from an AI response.
 * Fire-and-forget — designed to run asynchronously without blocking.
 * Uses Haiku for cheap extraction, deduplicates at 0.9 similarity.
 */
export async function extractAndStoreMemories(
  userMessage: string,
  aiResponse: string,
  userId: string
): Promise<ExtractionResult> {
  const startTime = Date.now();

  // Skip extraction for very short responses
  if (aiResponse.length < 50) {
    return { facts: [], stored: 0, duplicates: 0, latencyMs: Date.now() - startTime };
  }

  try {
    const provider = providerRegistry.getDefault();
    const fastModel = MODEL_TIERS.fast.model;

    // Build the extraction prompt
    const prompt = EXTRACTION_PROMPT
      .replace("{USER_MESSAGE}", userMessage.slice(0, 500))
      .replace("{AI_RESPONSE}", aiResponse.slice(0, 1500));

    const response = await provider.createMessage({
      model: fastModel,
      max_tokens: 512,
      system: "You extract facts from conversations. Return only valid JSON.",
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    const text = textContent?.text || '{"facts":[]}';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { facts: [], stored: 0, duplicates: 0, latencyMs: Date.now() - startTime };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const facts: ExtractedFact[] = (parsed.facts || []).filter(
      (f: any) =>
        f &&
        typeof f.content === "string" &&
        f.content.length > 5 &&
        ["preference", "fact", "instruction", "context"].includes(f.type)
    );

    if (facts.length === 0) {
      return { facts: [], stored: 0, duplicates: 0, latencyMs: Date.now() - startTime };
    }

    // Deduplicate and store
    let stored = 0;
    let duplicates = 0;

    for (const fact of facts) {
      const isDuplicate = await isDuplicateMemory(fact.content, userId);
      if (isDuplicate) {
        duplicates++;
        continue;
      }

      try {
        await storeMemory({
          userId,
          content: fact.content,
          type: TYPE_TO_DB_TYPE[fact.type] || "semantic",
          importance: Math.max(1, Math.min(10, fact.importance || 5)),
          source: "conversation",
          provenance: "extraction:auto",
          metadata: { extractionType: fact.type },
        });
        stored++;
      } catch (err) {
        console.error("[MemoryMiddleware] Failed to store fact:", err);
      }
    }

    console.log(`[MemoryExtract] Extracted ${facts.length} facts, stored ${stored}, deduped ${duplicates}`);

    const result = {
      facts,
      stored,
      duplicates,
      latencyMs: Date.now() - startTime,
    };

    brainTelemetry.emitEvent({
      type: "memory_extract_complete", timestamp: Date.now(), requestId: `memex-${startTime}`,
      userId, data: { factsExtracted: facts.length, stored, duplicates, latencyMs: result.latencyMs },
    });

    return result;
  } catch (error) {
    console.error("[MemoryMiddleware] Extraction failed:", error);
    return { facts: [], stored: 0, duplicates: 0, latencyMs: Date.now() - startTime };
  }
}

// ============================================
// Deduplication
// ============================================

/**
 * Check if a fact is a duplicate of existing memories.
 * Uses cosine similarity at configurable threshold (default 0.9).
 */
export async function isDuplicateMemory(
  content: string,
  userId: string
): Promise<boolean> {
  const threshold = env.AUTO_MEMORY_EXTRACT_DEDUP_THRESHOLD ?? 0.9;

  try {
    // Search for similar existing memories
    const existing = await searchMemories(content, userId, 1);

    if (existing.length === 0) return false;

    // Check if similarity exceeds threshold
    const topResult = existing[0] as any;
    const similarity = topResult.similarity ?? 0;

    return similarity >= threshold;
  } catch {
    // If dedup check fails, allow storage (better to have a duplicate than miss a fact)
    return false;
  }
}
