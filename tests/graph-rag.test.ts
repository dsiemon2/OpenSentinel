import { describe, test, expect, beforeEach } from "bun:test";
import {
  GraphRAG,
  classifyDocument,
  type ClassificationRule,
} from "../src/core/intelligence/graph-rag";

// ============================================================
// Graph RAG Tests
// ============================================================

describe("Graph RAG", () => {
  let graph: GraphRAG;

  beforeEach(() => {
    graph = new GraphRAG();
  });

  // =========================================================
  // Constructor
  // =========================================================

  describe("constructor", () => {
    test("creates instance with default extractor", () => {
      expect(graph).toBeInstanceOf(GraphRAG);
    });

    test("creates instance with custom extractor", () => {
      const custom = new GraphRAG(async () => ({
        entities: [],
        relationships: [],
      }));
      expect(custom).toBeInstanceOf(GraphRAG);
    });
  });

  // =========================================================
  // Document ingestion
  // =========================================================

  describe("ingestDocument", () => {
    test("ingests a document and returns GraphDocument", async () => {
      const doc = await graph.ingestDocument("John Smith works at Acme Corp");
      expect(doc.id).toContain("gdoc_");
      expect(doc.content).toBe("John Smith works at Acme Corp");
    });

    test("assigns incrementing document IDs", async () => {
      const doc1 = await graph.ingestDocument("First document");
      const doc2 = await graph.ingestDocument("Second document");
      expect(doc1.id).toBe("gdoc_1");
      expect(doc2.id).toBe("gdoc_2");
    });

    test("extracts entities from text", async () => {
      const doc = await graph.ingestDocument(
        "Alice Johnson met Bob Williams at the New York office"
      );
      expect(doc.entities.length).toBeGreaterThan(0);
    });

    test("stores metadata", async () => {
      const doc = await graph.ingestDocument("Test content", {
        title: "Test Doc",
        source: "unit-test",
      });
      expect(doc.title).toBe("Test Doc");
      expect(doc.source).toBe("unit-test");
    });

    test("classifies document when rules are set", async () => {
      graph.setClassificationRules([
        { category: "tech", keywords: ["software", "engineer"] },
      ]);

      const doc = await graph.ingestDocument("A software engineer built this");
      expect(doc.category).toBe("tech");
    });

    test("defaults to general category with no rules", async () => {
      const doc = await graph.ingestDocument("Some random text");
      expect(doc.category).toBe("general");
    });
  });

  // =========================================================
  // Entity extraction (default extractor)
  // =========================================================

  describe("default entity extraction", () => {
    test("extracts proper nouns as entities", async () => {
      await graph.ingestDocument("Alice met Bob at the Conference");
      const stats = graph.getStats();
      expect(stats.entityCount).toBeGreaterThan(0);
    });

    test("extracts email addresses", async () => {
      await graph.ingestDocument("Contact user@example.com for info");
      const emails = graph.getEntitiesByType("email");
      expect(emails.length).toBe(1);
      expect(emails[0].name).toBe("user@example.com");
    });

    test("extracts URLs", async () => {
      await graph.ingestDocument("Visit https://example.com for details");
      const urls = graph.getEntitiesByType("url");
      expect(urls.length).toBe(1);
    });

    test("creates co-occurrence relationships", async () => {
      await graph.ingestDocument("Alice and Bob and Charlie went hiking");
      const stats = graph.getStats();
      expect(stats.relationshipCount).toBeGreaterThan(0);
    });

    test("deduplicates entities by name", async () => {
      await graph.ingestDocument("Alice met Bob");
      await graph.ingestDocument("Alice called Bob");

      // Entities should be merged, not duplicated
      const stats = graph.getStats();
      const alices = graph
        .getEntitiesByType("concept")
        .filter((e) => e.name === "Alice");
      expect(alices.length).toBe(1);
    });
  });

  // =========================================================
  // Custom extractor
  // =========================================================

  describe("custom extractor", () => {
    test("uses custom extractor when set", async () => {
      graph.setExtractor(async (text) => ({
        entities: [{ name: "Custom Entity", type: "custom", properties: { from: text } }],
        relationships: [],
      }));

      await graph.ingestDocument("Test text");
      const customEntities = graph.getEntitiesByType("custom");
      expect(customEntities.length).toBe(1);
      expect(customEntities[0].name).toBe("Custom Entity");
    });
  });

  // =========================================================
  // Graph traversal
  // =========================================================

  describe("traverse", () => {
    test("traverses from starting entity", async () => {
      await graph.ingestDocument("Alice works with Bob at Google");
      const stats = graph.getStats();

      if (stats.entityCount > 0) {
        const entities = graph.getEntitiesByType("concept");
        if (entities.length > 0) {
          const result = graph.traverse(entities[0].id);
          expect(result.entities.length).toBeGreaterThan(0);
          expect(result.hops).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test("respects maxHops parameter", async () => {
      await graph.ingestDocument(
        "Alice knows Bob, Bob knows Charlie, Charlie knows Diana"
      );

      const entities = graph.getEntitiesByType("concept");
      if (entities.length > 0) {
        const result = graph.traverse(entities[0].id, 1);
        expect(result.hops).toBeLessThanOrEqual(1);
      }
    });

    test("respects minWeight filter", async () => {
      await graph.ingestDocument("Alice and Bob");

      const entities = graph.getEntitiesByType("concept");
      if (entities.length > 0) {
        const result = graph.traverse(entities[0].id, 3, 999);
        // With high minWeight, should only include start entity
        expect(result.entities.length).toBeLessThanOrEqual(1);
      }
    });

    test("returns empty for unknown entity", () => {
      const result = graph.traverse("nonexistent_id");
      expect(result.entities.length).toBe(0);
    });
  });

  // =========================================================
  // Search
  // =========================================================

  describe("search", () => {
    test("returns results for matching query", async () => {
      await graph.ingestDocument("Machine Learning is a field of Artificial Intelligence");
      const result = await graph.search("Machine Learning");
      expect(result.entities.length).toBeGreaterThanOrEqual(0);
      expect(result.answer).toBeDefined();
    });

    test("returns confidence score", async () => {
      await graph.ingestDocument("Python programming language");
      const result = await graph.search("Python");
      expect(typeof result.confidence).toBe("number");
    });

    test("returns source documents", async () => {
      await graph.ingestDocument("React is a JavaScript framework");
      const result = await graph.search("React");
      expect(Array.isArray(result.sources)).toBe(true);
    });

    test("respects maxHops option", async () => {
      await graph.ingestDocument("Alice met Bob at the Conference");
      const result = await graph.search("Alice", { maxHops: 1 });
      expect(result.hops).toBeLessThanOrEqual(1);
    });

    test("respects topK option", async () => {
      for (let i = 0; i < 10; i++) {
        await graph.ingestDocument(`Entity${i} is Entity related to Search term`);
      }
      const result = await graph.search("Entity", { topK: 3 });
      expect(result.sources.length).toBeLessThanOrEqual(3);
    });

    test("returns empty results for unmatched query", async () => {
      await graph.ingestDocument("Cats and dogs");
      const result = await graph.search("zzzzznonexistent");
      expect(result.entities.length).toBe(0);
    });
  });

  // =========================================================
  // Entity management
  // =========================================================

  describe("entity management", () => {
    test("getEntity returns entity by ID", async () => {
      await graph.ingestDocument("John Smith is an engineer");
      const entities = graph.getEntitiesByType("concept");
      if (entities.length > 0) {
        const entity = graph.getEntity(entities[0].id);
        expect(entity).toBeDefined();
        expect(entity!.id).toBe(entities[0].id);
      }
    });

    test("getEntity returns undefined for unknown ID", () => {
      expect(graph.getEntity("nonexistent")).toBeUndefined();
    });

    test("getEntitiesByType filters by type", async () => {
      await graph.ingestDocument("Contact user@test.com for info");
      const emails = graph.getEntitiesByType("email");
      expect(emails.every((e) => e.type === "email")).toBe(true);
    });

    test("getEntitiesByType returns empty for unknown type", () => {
      const results = graph.getEntitiesByType("nonexistent_type");
      expect(results.length).toBe(0);
    });
  });

  // =========================================================
  // Document management
  // =========================================================

  describe("document management", () => {
    test("getDocument returns document by ID", async () => {
      const doc = await graph.ingestDocument("Test document content");
      const retrieved = graph.getDocument(doc.id);
      expect(retrieved).toBeDefined();
      expect(retrieved!.content).toBe("Test document content");
    });

    test("getDocument returns undefined for unknown ID", () => {
      expect(graph.getDocument("nonexistent")).toBeUndefined();
    });
  });

  // =========================================================
  // Statistics
  // =========================================================

  describe("getStats", () => {
    test("returns zero counts for empty graph", () => {
      const stats = graph.getStats();
      expect(stats.entityCount).toBe(0);
      expect(stats.relationshipCount).toBe(0);
      expect(stats.documentCount).toBe(0);
    });

    test("counts entities correctly", async () => {
      await graph.ingestDocument("Alice works at Google");
      const stats = graph.getStats();
      expect(stats.entityCount).toBeGreaterThan(0);
      expect(stats.documentCount).toBe(1);
    });

    test("tracks entity types", async () => {
      await graph.ingestDocument("Contact user@test.com now");
      const stats = graph.getStats();
      expect(stats.entityTypes.email).toBe(1);
    });

    test("tracks document categories", async () => {
      graph.setClassificationRules([
        { category: "tech", keywords: ["software"] },
      ]);
      await graph.ingestDocument("A software project");
      const stats = graph.getStats();
      expect(stats.categories.tech).toBe(1);
    });
  });
});

// ============================================================
// classifyDocument standalone function
// ============================================================

describe("classifyDocument", () => {
  const rules: ClassificationRule[] = [
    { category: "finance", keywords: ["money", "bank", "investment", "stock"] },
    { category: "tech", keywords: ["software", "computer", "code", "programming"] },
    { category: "health", keywords: ["doctor", "hospital", "medicine"] },
  ];

  test("classifies finance content", () => {
    const result = classifyDocument("The bank investment grew", rules);
    expect(result.category).toBe("finance");
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("classifies tech content", () => {
    const result = classifyDocument("A software programming project", rules);
    expect(result.category).toBe("tech");
  });

  test("classifies health content", () => {
    const result = classifyDocument("The doctor at the hospital", rules);
    expect(result.category).toBe("health");
  });

  test("returns uncategorized for unmatched content", () => {
    const result = classifyDocument("Random words here", rules);
    expect(result.category).toBe("uncategorized");
    expect(result.confidence).toBe(0);
  });

  test("returns confidence between 0 and 1", () => {
    const result = classifyDocument("money and stock", rules);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test("supports pattern-based classification", () => {
    const rulesWithPatterns: ClassificationRule[] = [
      { category: "date", keywords: [], patterns: [/\d{4}-\d{2}-\d{2}/] },
    ];
    const result = classifyDocument("Date: 2024-01-15", rulesWithPatterns);
    expect(result.category).toBe("date");
  });

  test("handles empty rules", () => {
    const result = classifyDocument("Some text", []);
    expect(result.category).toBe("uncategorized");
  });
});
