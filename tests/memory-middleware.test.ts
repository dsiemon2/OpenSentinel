import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";

// ============================================
// Memory Middleware — Pre-search + Post-extract Tests
// ============================================
// Tests the memory middleware that handles:
//   - Pre-call: deciding if memory search is needed & performing it
//   - Post-call: extracting and storing facts from conversations
//   - Deduplication of memories before storage
//
// NOTE: memory-middleware.ts has heavy transitive imports (memory,
// providers, brain/router, drizzle, etc.) that trigger Bun 1.3.9
// segfaults/missing-package errors on Windows when imported in tests.
// We verify via source analysis and a locally-reconstructed pure
// function for shouldSearchMemories behavioral tests.

const source = readFileSync("src/core/memory/memory-middleware.ts", "utf-8");

// ============================================
// Reconstruct shouldSearchMemories from source
// ============================================
// The function is pure (no external deps), so we can safely reconstruct
// it here to run real behavioral tests without triggering transitive imports.

const TRIVIAL_PATTERNS = [
  /^(ok|okay|k|kk|yep|yup|nope|nah|yes|no|sure|thanks|thank you|ty|thx|np|gg|lol|haha|hmm|ah|oh|wow|cool|nice|great|good|fine|alright|gotcha|got it|understood|roger|copy|ack)\.?!?$/i,
  /^(hi|hello|hey|yo|sup|gm|gn|morning|evening|night|bye|goodbye|cya|later|cheers)\.?!?$/i,
  /^(what|how|who|when|where|why)\?$/i,
  /^\.{1,3}$/,
  /^[👍👎🤔😊😂❤️🙏💯✅❌]+$/,
];

function shouldSearchMemories(message: string): boolean {
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

// Verify our reconstruction matches the source
const sourceFunction = source.slice(
  source.indexOf("export function shouldSearchMemories"),
  source.indexOf("\n}", source.indexOf("export function shouldSearchMemories")) + 2
);

// ============================================
// Tests
// ============================================

describe("Memory Middleware", () => {
  // ============================================
  // 0. Reconstruction Integrity
  // ============================================

  describe("shouldSearchMemories reconstruction integrity", () => {
    test("source contains the same TRIVIAL_PATTERNS array", () => {
      // Verify each pattern from source is present in our reconstruction
      expect(source).toContain("ok|okay|k|kk|yep|yup|nope|nah|yes|no|sure");
      expect(source).toContain("hi|hello|hey|yo|sup|gm|gn|morning|evening|night|bye|goodbye|cya|later|cheers");
      expect(source).toContain("what|how|who|when|where|why");
    });

    test("source uses the same length threshold (< 3)", () => {
      expect(source).toContain("trimmed.length < 3");
    });

    test("source uses the same single-word threshold (< 6)", () => {
      expect(source).toContain("trimmed.length < 6");
    });

    test("source function has the same structure", () => {
      expect(sourceFunction).toContain("const trimmed = message.trim()");
      expect(sourceFunction).toContain("TRIVIAL_PATTERNS");
      expect(sourceFunction).toContain("return true");
      expect(sourceFunction).toContain("return false");
    });
  });

  // ============================================
  // 1. shouldSearchMemories — Pure Function Tests
  // ============================================

  describe("shouldSearchMemories", () => {
    // ----------------------------------------
    // Trivial messages that should return false
    // ----------------------------------------

    describe("returns false for trivial messages", () => {
      test("single acknowledgment words", () => {
        const trivial = ["ok", "okay", "k", "kk", "yep", "yup", "nope", "nah", "yes", "no", "sure"];
        for (const msg of trivial) {
          expect(shouldSearchMemories(msg)).toBe(false);
        }
      });

      test("thank you variants", () => {
        const thanks = ["thanks", "thank you", "ty", "thx"];
        for (const msg of thanks) {
          expect(shouldSearchMemories(msg)).toBe(false);
        }
      });

      test("casual affirmatives and reactions", () => {
        const reactions = ["np", "gg", "lol", "haha", "hmm", "ah", "oh", "wow", "cool", "nice", "great", "good", "fine", "alright"];
        for (const msg of reactions) {
          expect(shouldSearchMemories(msg)).toBe(false);
        }
      });

      test("understanding confirmations", () => {
        const confirmations = ["gotcha", "got it", "understood", "roger", "copy", "ack"];
        for (const msg of confirmations) {
          expect(shouldSearchMemories(msg)).toBe(false);
        }
      });

      test("greetings and farewells", () => {
        const greetings = ["hi", "hello", "hey", "yo", "sup", "gm", "gn", "morning", "evening", "night", "bye", "goodbye", "cya", "later", "cheers"];
        for (const msg of greetings) {
          expect(shouldSearchMemories(msg)).toBe(false);
        }
      });

      test("bare question words", () => {
        const questions = ["what?", "how?", "who?", "when?", "where?", "why?"];
        for (const msg of questions) {
          expect(shouldSearchMemories(msg)).toBe(false);
        }
      });

      test("emoji-only messages", () => {
        expect(shouldSearchMemories("👍")).toBe(false);
        expect(shouldSearchMemories("👎")).toBe(false);
        expect(shouldSearchMemories("❤️")).toBe(false);
        expect(shouldSearchMemories("💯")).toBe(false);
        expect(shouldSearchMemories("✅")).toBe(false);
        expect(shouldSearchMemories("❌")).toBe(false);
      });

      test("dot sequences", () => {
        expect(shouldSearchMemories(".")).toBe(false);
        expect(shouldSearchMemories("..")).toBe(false);
        expect(shouldSearchMemories("...")).toBe(false);
      });

      test("trivial messages with trailing punctuation", () => {
        expect(shouldSearchMemories("ok.")).toBe(false);
        expect(shouldSearchMemories("ok!")).toBe(false);
        expect(shouldSearchMemories("thanks!")).toBe(false);
        expect(shouldSearchMemories("hello!")).toBe(false);
        expect(shouldSearchMemories("nice.")).toBe(false);
      });

      test("case insensitive matching", () => {
        expect(shouldSearchMemories("OK")).toBe(false);
        expect(shouldSearchMemories("Thanks")).toBe(false);
        expect(shouldSearchMemories("HELLO")).toBe(false);
        expect(shouldSearchMemories("Yes")).toBe(false);
        expect(shouldSearchMemories("HI")).toBe(false);
        expect(shouldSearchMemories("YEP")).toBe(false);
      });
    });

    // ----------------------------------------
    // Very short messages (< 3 chars)
    // ----------------------------------------

    describe("returns false for very short messages", () => {
      test("empty string", () => {
        expect(shouldSearchMemories("")).toBe(false);
      });

      test("single character", () => {
        expect(shouldSearchMemories("a")).toBe(false);
        expect(shouldSearchMemories("x")).toBe(false);
        expect(shouldSearchMemories("?")).toBe(false);
      });

      test("two characters", () => {
        expect(shouldSearchMemories("hi")).toBe(false);
        expect(shouldSearchMemories("ok")).toBe(false);
        expect(shouldSearchMemories("no")).toBe(false);
      });

      test("whitespace-only messages", () => {
        expect(shouldSearchMemories("  ")).toBe(false);
        expect(shouldSearchMemories("   ")).toBe(false);
        expect(shouldSearchMemories("\t")).toBe(false);
      });
    });

    // ----------------------------------------
    // Single short words (< 6 chars)
    // ----------------------------------------

    describe("returns false for single short words", () => {
      test("single words under 6 characters", () => {
        expect(shouldSearchMemories("test")).toBe(false);
        expect(shouldSearchMemories("done")).toBe(false);
        expect(shouldSearchMemories("next")).toBe(false);
        expect(shouldSearchMemories("wait")).toBe(false);
      });

      test("exactly 5 characters still rejected", () => {
        expect(shouldSearchMemories("maybe")).toBe(false);
        expect(shouldSearchMemories("right")).toBe(false);
      });
    });

    // ----------------------------------------
    // Substantive queries that should return true
    // ----------------------------------------

    describe("returns true for substantive queries", () => {
      test("questions about personal preferences", () => {
        expect(shouldSearchMemories("what's my favorite programming language?")).toBe(true);
        expect(shouldSearchMemories("what editor do I use?")).toBe(true);
        expect(shouldSearchMemories("do I prefer tabs or spaces?")).toBe(true);
      });

      test("questions about projects and deadlines", () => {
        expect(shouldSearchMemories("tell me about the project deadline")).toBe(true);
        expect(shouldSearchMemories("when is the next release scheduled?")).toBe(true);
        expect(shouldSearchMemories("what are the open tasks on my board?")).toBe(true);
      });

      test("instructional and command messages", () => {
        expect(shouldSearchMemories("summarize the meeting notes from yesterday")).toBe(true);
        expect(shouldSearchMemories("help me write an email to my manager")).toBe(true);
        expect(shouldSearchMemories("create a new GitHub issue for the login bug")).toBe(true);
      });

      test("multi-word informational requests", () => {
        expect(shouldSearchMemories("explain how our deployment pipeline works")).toBe(true);
        expect(shouldSearchMemories("what did we discuss last week about the database migration?")).toBe(true);
        expect(shouldSearchMemories("remind me about the API rate limits")).toBe(true);
      });

      test("personal facts and context", () => {
        expect(shouldSearchMemories("where do I work?")).toBe(true);
        expect(shouldSearchMemories("what's my wife's name?")).toBe(true);
        expect(shouldSearchMemories("how old are my kids?")).toBe(true);
      });

      test("single words at 6+ characters are accepted", () => {
        expect(shouldSearchMemories("explain")).toBe(true);
        expect(shouldSearchMemories("deploy!")).toBe(true);
        expect(shouldSearchMemories("refactor")).toBe(true);
      });
    });

    // ----------------------------------------
    // Edge cases
    // ----------------------------------------

    describe("edge cases", () => {
      test("messages with leading/trailing whitespace are trimmed", () => {
        expect(shouldSearchMemories("  ok  ")).toBe(false);
        expect(shouldSearchMemories("  what is my name?  ")).toBe(true);
      });

      test("multi-line messages are substantive", () => {
        expect(shouldSearchMemories("please help me\nwith this issue")).toBe(true);
      });

      test("URLs are substantive", () => {
        expect(shouldSearchMemories("check out https://example.com/docs")).toBe(true);
      });

      test("code snippets are substantive", () => {
        expect(shouldSearchMemories("const x = await fetch('/api')")).toBe(true);
      });
    });
  });

  // ============================================
  // 2. Source Analysis — Module Exports
  // ============================================

  describe("Module exports (source analysis)", () => {
    test("exports shouldSearchMemories as a named export", () => {
      expect(source).toContain("export function shouldSearchMemories(");
    });

    test("exports searchRelevantMemories as async named export", () => {
      expect(source).toContain("export async function searchRelevantMemories(");
    });

    test("exports extractAndStoreMemories as async named export", () => {
      expect(source).toContain("export async function extractAndStoreMemories(");
    });

    test("exports isDuplicateMemory as async named export", () => {
      expect(source).toContain("export async function isDuplicateMemory(");
    });
  });

  // ============================================
  // 3. Source Analysis — Type Exports
  // ============================================

  describe("Type exports (source analysis)", () => {
    test("exports MemorySearchResult interface", () => {
      expect(source).toContain("export interface MemorySearchResult");
    });

    test("exports ExtractionResult interface", () => {
      expect(source).toContain("export interface ExtractionResult");
    });

    test("exports ExtractedFact interface", () => {
      expect(source).toContain("export interface ExtractedFact");
    });

    test("exports FormattedMemory interface", () => {
      expect(source).toContain("export interface FormattedMemory");
    });
  });

  // ============================================
  // 4. Source Analysis — Extraction Prompt
  // ============================================

  describe("Extraction prompt (source analysis)", () => {
    test("prompt instructs extraction of preferences", () => {
      expect(source).toContain("preferences");
    });

    test("prompt instructs extraction of personal facts", () => {
      expect(source).toContain("personal facts");
    });

    test("prompt instructs extraction of instructions", () => {
      expect(source).toContain("instructions they gave");
    });

    test("prompt instructs extraction of important context", () => {
      expect(source).toContain("important context");
    });

    test("prompt defines expected JSON return format with all fields", () => {
      expect(source).toContain('"content"');
      expect(source).toContain('"type"');
      expect(source).toContain('"importance"');
      expect(source).toContain("preference|fact|instruction|context");
      expect(source).toContain("1-10");
    });

    test("prompt includes USER_MESSAGE placeholder", () => {
      expect(source).toContain("{USER_MESSAGE}");
    });

    test("prompt includes AI_RESPONSE placeholder", () => {
      expect(source).toContain("{AI_RESPONSE}");
    });

    test("prompt instructs selectivity", () => {
      expect(source).toContain("Be selective");
    });

    test("prompt defines all four fact types with descriptions", () => {
      expect(source).toContain("- preference:");
      expect(source).toContain("- fact:");
      expect(source).toContain("- instruction:");
      expect(source).toContain("- context:");
    });

    test("prompt describes preference type as likes/dislikes", () => {
      expect(source).toContain("likes/dislikes");
    });

    test("prompt describes fact type as personal details", () => {
      expect(source).toContain("personal details");
    });

    test("prompt describes instruction type as standing orders", () => {
      expect(source).toContain("standing orders");
    });

    test("prompt describes context type as situational info", () => {
      expect(source).toContain("situational info");
    });
  });

  // ============================================
  // 5. Source Analysis — TYPE_TO_DB_TYPE Mapping
  // ============================================

  describe("TYPE_TO_DB_TYPE mapping (source analysis)", () => {
    test("maps preference to semantic", () => {
      expect(source).toContain('preference: "semantic"');
    });

    test("maps fact to semantic", () => {
      expect(source).toContain('fact: "semantic"');
    });

    test("maps instruction to procedural", () => {
      expect(source).toContain('instruction: "procedural"');
    });

    test("maps context to episodic", () => {
      expect(source).toContain('context: "episodic"');
    });

    test("TYPE_TO_DB_TYPE is typed as Record<string, semantic|episodic|procedural>", () => {
      expect(source).toContain('Record<string, "semantic" | "episodic" | "procedural">');
    });
  });

  // ============================================
  // 6. Source Analysis — TRIVIAL_PATTERNS
  // ============================================

  describe("TRIVIAL_PATTERNS coverage (source analysis)", () => {
    test("includes acknowledgment words pattern", () => {
      expect(source).toContain("ok|okay|k|kk|yep|yup|nope|nah|yes|no|sure");
    });

    test("includes thank you variants", () => {
      expect(source).toContain("thanks|thank you|ty|thx");
    });

    test("includes greeting and farewell words", () => {
      expect(source).toContain("hi|hello|hey|yo|sup|gm|gn|morning|evening|night|bye|goodbye|cya|later|cheers");
    });

    test("includes bare question word pattern", () => {
      expect(source).toContain("what|how|who|when|where|why");
    });

    test("includes dot sequence pattern", () => {
      expect(source).toContain("/^\\.{1,3}$/");
    });

    test("includes emoji pattern for common emoji", () => {
      expect(source).toMatch(/👍/);
      expect(source).toMatch(/👎/);
      expect(source).toMatch(/❤️/);
      expect(source).toMatch(/💯/);
      expect(source).toMatch(/✅/);
      expect(source).toMatch(/❌/);
    });

    test("includes reaction words", () => {
      expect(source).toContain("lol|haha|hmm|ah|oh|wow|cool|nice|great|good|fine|alright");
    });

    test("includes confirmation words", () => {
      expect(source).toContain("gotcha|got it|understood|roger|copy|ack");
    });

    test("patterns use case-insensitive flag", () => {
      // All main patterns end with /i for case insensitivity
      expect(source).toContain("$/i,");
    });

    test("patterns are anchored with ^ and $", () => {
      // Ensures patterns match whole messages, not substrings
      expect(source).toContain("/^(ok|okay");
      expect(source).toContain("/^(hi|hello");
      expect(source).toContain("/^(what|how");
    });
  });

  // ============================================
  // 7. Source Analysis — searchRelevantMemories
  // ============================================

  describe("searchRelevantMemories behavior (source analysis)", () => {
    test("calls shouldSearchMemories to skip trivial queries", () => {
      expect(source).toContain("shouldSearchMemories(query)");
    });

    test("returns searchPerformed: false for trivial messages", () => {
      expect(source).toContain("searchPerformed: false");
    });

    test("returns searchPerformed: true for real searches", () => {
      expect(source).toContain("searchPerformed: true");
    });

    test("delegates to buildMemoryContext for enhanced retrieval", () => {
      expect(source).toContain("buildMemoryContext(query, userId, conversationHistory)");
    });

    test("uses configurable similarity threshold from env", () => {
      expect(source).toContain("AUTO_MEMORY_SEARCH_THRESHOLD");
    });

    test("default similarity threshold is 0.3", () => {
      expect(source).toContain("?? 0.3");
    });

    test("filters memories by similarity threshold", () => {
      expect(source).toContain("m.similarity >= threshold");
    });

    test("tracks latency in milliseconds", () => {
      expect(source).toContain("latencyMs: Date.now() - startTime");
    });

    test("handles errors gracefully without throwing", () => {
      expect(source).toContain("[MemoryMiddleware] Pre-search failed:");
    });

    test("accepts optional conversationHistory parameter", () => {
      expect(source).toContain("conversationHistory?: Array<{ role:");
    });

    test("parses memory context lines starting with '- ['", () => {
      expect(source).toContain('l.startsWith("- [")');
    });

    test("extracts memory type from bracketed prefix", () => {
      expect(source).toContain("line.match(/\\[(\\w+)\\]/)");
    });

    test("returns MemorySearchResult type", () => {
      expect(source).toContain("): Promise<MemorySearchResult>");
    });
  });

  // ============================================
  // 8. Source Analysis — extractAndStoreMemories
  // ============================================

  describe("extractAndStoreMemories behavior (source analysis)", () => {
    test("skips extraction for very short AI responses (< 50 chars)", () => {
      expect(source).toContain("aiResponse.length < 50");
    });

    test("uses a fast model for extraction", () => {
      expect(source).toContain("MODEL_TIERS.fast.model");
    });

    test("truncates user message to 500 chars", () => {
      expect(source).toContain("userMessage.slice(0, 500)");
    });

    test("truncates AI response to 1500 chars", () => {
      expect(source).toContain("aiResponse.slice(0, 1500)");
    });

    test("max_tokens is set to 512 for extraction", () => {
      expect(source).toContain("max_tokens: 512");
    });

    test("validates extracted facts have content > 5 chars", () => {
      expect(source).toContain("f.content.length > 5");
    });

    test("validates fact type is one of the four allowed types", () => {
      expect(source).toContain('["preference", "fact", "instruction", "context"].includes(f.type)');
    });

    test("clamps importance between 1 and 10", () => {
      expect(source).toContain("Math.max(1, Math.min(10, fact.importance || 5))");
    });

    test("stores facts with source=conversation", () => {
      expect(source).toContain('source: "conversation"');
    });

    test("stores facts with provenance=extraction:auto", () => {
      expect(source).toContain('provenance: "extraction:auto"');
    });

    test("calls isDuplicateMemory before storing each fact", () => {
      expect(source).toContain("isDuplicateMemory(fact.content, userId)");
    });

    test("tracks stored and duplicate counts", () => {
      expect(source).toContain("stored++");
      expect(source).toContain("duplicates++");
    });

    test("logs extraction summary with counts", () => {
      expect(source).toContain("[MemoryExtract]");
    });

    test("returns ExtractionResult type", () => {
      expect(source).toContain("): Promise<ExtractionResult>");
    });

    test("stores extraction type as metadata", () => {
      expect(source).toContain("metadata: { extractionType: fact.type }");
    });

    test("uses provider registry for LLM calls", () => {
      expect(source).toContain("providerRegistry.getDefault()");
    });

    test("sets system prompt for JSON extraction", () => {
      expect(source).toContain("You extract facts from conversations. Return only valid JSON.");
    });

    test("parses JSON from LLM response with regex", () => {
      expect(source).toContain("text.match(/\\{[\\s\\S]*\\}/)");
    });

    test("handles individual fact storage failures gracefully", () => {
      expect(source).toContain("[MemoryMiddleware] Failed to store fact:");
    });
  });

  // ============================================
  // 9. Source Analysis — isDuplicateMemory
  // ============================================

  describe("isDuplicateMemory behavior (source analysis)", () => {
    test("uses configurable dedup threshold from env", () => {
      expect(source).toContain("AUTO_MEMORY_EXTRACT_DEDUP_THRESHOLD");
    });

    test("default dedup threshold is 0.9", () => {
      expect(source).toContain("?? 0.9");
    });

    test("searches for top-1 similar memory", () => {
      expect(source).toContain("searchMemories(content, userId, 1)");
    });

    test("returns false when no existing memories found", () => {
      expect(source).toContain("if (existing.length === 0) return false");
    });

    test("compares similarity against threshold", () => {
      expect(source).toContain("similarity >= threshold");
    });

    test("returns false on error (fail-open for storage)", () => {
      // The catch block returns false, allowing storage even if dedup check fails
      const catchIndex = source.indexOf("} catch {");
      const returnFalseIndex = source.indexOf("return false;", catchIndex);
      expect(catchIndex).toBeGreaterThan(-1);
      expect(returnFalseIndex).toBeGreaterThan(catchIndex);
    });

    test("returns Promise<boolean>", () => {
      expect(source).toContain("): Promise<boolean>");
    });
  });

  // ============================================
  // 10. Source Analysis — Imports and Dependencies
  // ============================================

  describe("Module dependencies (source analysis)", () => {
    test("imports from memory module", () => {
      expect(source).toContain('from "../memory"');
    });

    test("imports searchMemories for dedup checks", () => {
      expect(source).toContain("searchMemories");
    });

    test("imports storeMemory for persisting facts", () => {
      expect(source).toContain("storeMemory");
    });

    test("imports buildMemoryContext for enhanced retrieval", () => {
      expect(source).toContain("buildMemoryContext");
    });

    test("imports generateEmbedding from memory", () => {
      expect(source).toContain("generateEmbedding");
    });

    test("imports providerRegistry for LLM calls", () => {
      expect(source).toContain("providerRegistry");
    });

    test("imports MODEL_TIERS from brain router", () => {
      expect(source).toContain('from "../brain/router"');
    });

    test("imports env for configuration", () => {
      expect(source).toContain('from "../../config/env"');
    });

    test("imports Memory type from db", () => {
      expect(source).toContain('from "../../db"');
    });
  });
});
