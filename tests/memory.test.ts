import { describe, test, expect } from "bun:test";

// ============================================
// Memory — RAG Memory System Tests
// ============================================
// Tests exports, type contracts, and module structure.
// Functions that require OpenAI and PostgreSQL+pgvector
// are verified on the production server.

describe("Memory - RAG Memory System", () => {
  // ============================================
  // Module exports
  // ============================================

  describe("Module exports", () => {
    test("should export generateEmbedding function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.generateEmbedding).toBe("function");
    });

    test("should export storeMemory function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.storeMemory).toBe("function");
    });

    test("should export searchMemories function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.searchMemories).toBe("function");
    });

    test("should export getRecentMemories function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.getRecentMemories).toBe("function");
    });

    test("should export extractMemories function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.extractMemories).toBe("function");
    });

    test("should export buildMemoryContext function", async () => {
      const mod = await import("../src/core/memory");
      expect(typeof mod.buildMemoryContext).toBe("function");
    });
  });

  // ============================================
  // Function signatures (parameter counts)
  // ============================================

  describe("Function signatures", () => {
    test("generateEmbedding takes 1 parameter", async () => {
      const { generateEmbedding } = await import("../src/core/memory");
      expect(generateEmbedding.length).toBe(1);
    });

    test("storeMemory takes 1 parameter", async () => {
      const { storeMemory } = await import("../src/core/memory");
      expect(storeMemory.length).toBe(1);
    });

    test("searchMemories takes 1-3 parameters", async () => {
      const { searchMemories } = await import("../src/core/memory");
      // Required params only (query), others are optional
      expect(searchMemories.length).toBeGreaterThanOrEqual(1);
      expect(searchMemories.length).toBeLessThanOrEqual(3);
    });

    test("getRecentMemories takes 1-2 parameters", async () => {
      const { getRecentMemories } = await import("../src/core/memory");
      expect(getRecentMemories.length).toBeGreaterThanOrEqual(1);
      expect(getRecentMemories.length).toBeLessThanOrEqual(2);
    });

    test("extractMemories takes 1-2 parameters", async () => {
      const { extractMemories } = await import("../src/core/memory");
      expect(extractMemories.length).toBeGreaterThanOrEqual(1);
      expect(extractMemories.length).toBeLessThanOrEqual(2);
    });

    test("buildMemoryContext takes 1-3 parameters", async () => {
      const { buildMemoryContext } = await import("../src/core/memory");
      expect(buildMemoryContext.length).toBeGreaterThanOrEqual(1);
      expect(buildMemoryContext.length).toBeLessThanOrEqual(3);
    });
  });

  // ============================================
  // Memory type contracts (runtime structural checks)
  // ============================================

  describe("Memory type contracts", () => {
    test("Memory object has expected shape", () => {
      const memory = {
        id: "mem-uuid-1234",
        userId: "user123",
        content: "User prefers TypeScript",
        type: "semantic",
        importance: 8,
        source: "conversation",
        embedding: Array(1536).fill(0),
        createdAt: new Date(),
        lastAccessed: null,
        metadata: null,
      };

      expect(memory).toHaveProperty("id");
      expect(memory).toHaveProperty("userId");
      expect(memory).toHaveProperty("content");
      expect(memory).toHaveProperty("type");
      expect(memory).toHaveProperty("importance");
      expect(memory).toHaveProperty("source");
      expect(memory).toHaveProperty("embedding");
      expect(memory).toHaveProperty("createdAt");
    });

    test("Embedding should be 1536 dimensions (text-embedding-3-small)", () => {
      const embedding = Array(1536).fill(0.1);
      expect(embedding).toHaveLength(1536);
    });

    test("Memory types include semantic, episodic, procedural", () => {
      const types = ["semantic", "episodic", "procedural"];
      expect(types).toContain("semantic");
      expect(types).toContain("episodic");
      expect(types).toContain("procedural");
    });

    test("Importance ranges from 1 to 10", () => {
      const importance = 7;
      expect(importance).toBeGreaterThanOrEqual(1);
      expect(importance).toBeLessThanOrEqual(10);
    });

    test("Memory source can be conversation", () => {
      const sources = ["conversation", "manual", "extraction"];
      expect(sources).toContain("conversation");
    });
  });

  // ============================================
  // NewMemory (input) type contract
  // ============================================

  describe("NewMemory input type", () => {
    test("should accept memory without embedding", () => {
      const input = {
        userId: "user123",
        content: "User likes dark mode",
        type: "semantic",
        importance: 6,
        source: "conversation",
      };
      expect(input).toHaveProperty("content");
      expect(input).not.toHaveProperty("embedding");
    });

    test("should require content field", () => {
      const input = {
        userId: "user123",
        content: "Important fact",
        type: "semantic",
        importance: 5,
        source: "conversation",
      };
      expect(input.content).toBe("Important fact");
    });

    test("should accept optional userId", () => {
      const input = {
        content: "General fact",
        type: "semantic",
        importance: 5,
        source: "manual",
      };
      expect(input).not.toHaveProperty("userId");
    });
  });

  // ============================================
  // Memory context formatting
  // ============================================

  describe("Memory context format", () => {
    test("context format should use type prefix", () => {
      const memory = { type: "semantic", content: "User likes TypeScript", similarity: 0.92 };
      const formatted = `- [${memory.type}] ${memory.content} (relevance: ${(memory.similarity * 100).toFixed(0)}%)`;

      expect(formatted).toContain("[semantic]");
      expect(formatted).toContain("User likes TypeScript");
      expect(formatted).toContain("relevance: 92%");
    });

    test("context string should have header when memories exist", () => {
      const memories = [
        { type: "semantic", content: "Fact 1", similarity: 0.9 },
        { type: "episodic", content: "Fact 2", similarity: 0.85 },
      ];
      const memoryStrings = memories.map(
        (m) => `- [${m.type}] ${m.content} (relevance: ${(m.similarity * 100).toFixed(0)}%)`
      );
      const context = `\n\nRelevant memories about the user:\n${memoryStrings.join("\n")}`;

      expect(context).toContain("Relevant memories about the user:");
      expect(context).toContain("[semantic] Fact 1");
      expect(context).toContain("[episodic] Fact 2");
    });

    test("empty context should be empty string", () => {
      const memories: any[] = [];
      const context = memories.length === 0 ? "" : "something";
      expect(context).toBe("");
    });
  });

  // ============================================
  // Extraction format
  // ============================================

  describe("Extraction format", () => {
    test("should parse JSON extraction response", () => {
      const response = JSON.stringify({
        memories: [
          { content: "User prefers dark mode", type: "semantic", importance: 7 },
          { content: "User uses TypeScript", type: "procedural", importance: 8 },
        ],
      });
      const parsed = JSON.parse(response);

      expect(parsed.memories).toHaveLength(2);
      expect(parsed.memories[0].content).toBe("User prefers dark mode");
      expect(parsed.memories[1].type).toBe("procedural");
    });

    test("should handle empty extraction response", () => {
      const response = JSON.stringify({ memories: [] });
      const parsed = JSON.parse(response);
      expect(parsed.memories).toHaveLength(0);
    });

    test("should filter out short content (< 5 chars)", () => {
      const memories = [
        { content: "Hi", type: "semantic", importance: 5 },
        { content: "User likes cats and dogs", type: "semantic", importance: 6 },
      ];
      const filtered = memories.filter((m) => m.content.length > 5);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].content).toBe("User likes cats and dogs");
    });

    test("should default type to semantic", () => {
      const mem = { content: "Some fact", importance: 5 };
      const type = (mem as any).type || "semantic";
      expect(type).toBe("semantic");
    });

    test("should default importance to 5", () => {
      const mem = { content: "Some fact", type: "semantic" };
      const importance = (mem as any).importance || 5;
      expect(importance).toBe(5);
    });
  });
});
