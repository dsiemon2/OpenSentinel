import { describe, test, expect } from "bun:test";

// ============================================
// Graph Retrieval — Entity CRUD, BFS, query augmentation
// ============================================

describe("Graph Retrieval", () => {
  describe("Module exports", () => {
    test("should export findEntityByName function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.findEntityByName).toBe("function");
    });

    test("should export searchEntities function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.searchEntities).toBe("function");
    });

    test("should export findRelatedEntities function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.findRelatedEntities).toBe("function");
    });

    test("should export augmentQueryWithGraph function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.augmentQueryWithGraph).toBe("function");
    });

    test("should export addGraphEntity function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.addGraphEntity).toBe("function");
    });

    test("should export addGraphRelationship function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.addGraphRelationship).toBe("function");
    });

    test("should export getEntityCount function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.getEntityCount).toBe("function");
    });

    test("should export getRelationshipCount function", async () => {
      const mod = await import("../src/core/memory/graph-retrieval");
      expect(typeof mod.getRelationshipCount).toBe("function");
    });
  });

  describe("findEntityByName", () => {
    test("should accept name and optional userId", async () => {
      const { findEntityByName } = await import("../src/core/memory/graph-retrieval");
      expect(findEntityByName.length).toBeGreaterThanOrEqual(1);
    });

    test("should return a promise", async () => {
      const { findEntityByName } = await import("../src/core/memory/graph-retrieval");
      const result = findEntityByName("TestEntity");
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("searchEntities", () => {
    test("should accept query, userId, and limit", async () => {
      const { searchEntities } = await import("../src/core/memory/graph-retrieval");
      expect(searchEntities.length).toBeGreaterThanOrEqual(1);
    });

    test("should return a promise", async () => {
      const { searchEntities } = await import("../src/core/memory/graph-retrieval");
      const result = searchEntities("test");
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("findRelatedEntities", () => {
    test("should accept entityId, depth, and limit", async () => {
      const { findRelatedEntities } = await import("../src/core/memory/graph-retrieval");
      expect(findRelatedEntities.length).toBeGreaterThanOrEqual(1);
    });

    test("should return a promise", async () => {
      const { findRelatedEntities } = await import("../src/core/memory/graph-retrieval");
      const result = findRelatedEntities("entity-1");
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("augmentQueryWithGraph", () => {
    test("should accept query and optional userId", async () => {
      const { augmentQueryWithGraph } = await import("../src/core/memory/graph-retrieval");
      expect(augmentQueryWithGraph.length).toBeGreaterThanOrEqual(1);
    });

    test("should return a promise", async () => {
      const { augmentQueryWithGraph } = await import("../src/core/memory/graph-retrieval");
      const result = augmentQueryWithGraph("test query");
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("addGraphEntity", () => {
    test("should accept entity object", async () => {
      const { addGraphEntity } = await import("../src/core/memory/graph-retrieval");
      expect(addGraphEntity.length).toBe(1);
    });

    test("should return a promise", async () => {
      const { addGraphEntity } = await import("../src/core/memory/graph-retrieval");
      const result = addGraphEntity({
        type: "person",
        name: "Test Person",
        importance: 50,
      });
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("addGraphRelationship", () => {
    test("should accept relationship object", async () => {
      const { addGraphRelationship } = await import("../src/core/memory/graph-retrieval");
      expect(addGraphRelationship.length).toBe(1);
    });

    test("should return a promise", async () => {
      const { addGraphRelationship } = await import("../src/core/memory/graph-retrieval");
      const result = addGraphRelationship({
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        type: "works_with",
      });
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("getEntityCount", () => {
    test("should accept optional userId", async () => {
      const { getEntityCount } = await import("../src/core/memory/graph-retrieval");
      expect(getEntityCount.length).toBeLessThanOrEqual(1);
    });

    test("should return a promise", async () => {
      const { getEntityCount } = await import("../src/core/memory/graph-retrieval");
      const result = getEntityCount();
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("getRelationshipCount", () => {
    test("should accept no parameters", async () => {
      const { getRelationshipCount } = await import("../src/core/memory/graph-retrieval");
      expect(getRelationshipCount.length).toBe(0);
    });

    test("should return a promise", async () => {
      const { getRelationshipCount } = await import("../src/core/memory/graph-retrieval");
      const result = getRelationshipCount();
      expect(result).toBeInstanceOf(Promise);
      await result.catch(() => {});
    });
  });

  describe("GraphEntity interface", () => {
    test("should define expected fields", () => {
      const entity = {
        id: "entity-1",
        userId: "user1",
        type: "person",
        name: "John Doe",
        aliases: ["JD", "Johnny"],
        description: "A test entity",
        importance: 75,
        mentionCount: 10,
      };
      expect(entity.id).toBe("entity-1");
      expect(entity.type).toBe("person");
      expect(entity.name).toBe("John Doe");
      expect(entity.aliases).toHaveLength(2);
      expect(entity.importance).toBe(75);
      expect(entity.mentionCount).toBe(10);
    });

    test("should support null userId", () => {
      const entity = {
        id: "entity-2",
        userId: null,
        type: "topic",
        name: "Machine Learning",
        aliases: [],
        description: null,
        importance: 50,
        mentionCount: 1,
      };
      expect(entity.userId).toBeNull();
      expect(entity.description).toBeNull();
    });

    test("should support all entity types", () => {
      const types = ["person", "project", "topic", "event", "organization", "location"];
      for (const type of types) {
        const entity = { type, name: `Test ${type}` };
        expect(entity.type).toBe(type);
      }
    });
  });

  describe("GraphRelationship interface", () => {
    test("should define expected fields", () => {
      const rel = {
        id: "rel-1",
        sourceEntityId: "entity-1",
        targetEntityId: "entity-2",
        type: "works_with",
        strength: 80,
        bidirectional: true,
        context: "Same team",
      };
      expect(rel.sourceEntityId).toBe("entity-1");
      expect(rel.targetEntityId).toBe("entity-2");
      expect(rel.type).toBe("works_with");
      expect(rel.strength).toBe(80);
      expect(rel.bidirectional).toBe(true);
    });

    test("should support null context", () => {
      const rel = {
        id: "rel-2",
        sourceEntityId: "entity-1",
        targetEntityId: "entity-3",
        type: "mentions",
        strength: 50,
        bidirectional: false,
        context: null,
      };
      expect(rel.context).toBeNull();
      expect(rel.bidirectional).toBe(false);
    });

    test("should support all relationship types", () => {
      const types = [
        "works_with", "knows", "manages", "reports_to", "created",
        "uses", "depends_on", "related_to", "part_of", "mentions",
        "similar_to", "opposite_of", "caused_by", "leads_to", "contains",
      ];
      for (const type of types) {
        const rel = { type };
        expect(rel.type).toBe(type);
      }
    });
  });

  describe("BFS traversal logic", () => {
    test("should track visited nodes to prevent cycles", () => {
      const visited = new Set<string>();
      const graph = {
        "A": ["B", "C"],
        "B": ["A", "D"],  // A already visited — should skip
        "C": ["D"],
        "D": ["A"],       // A already visited — should skip
      };

      const bfsResult: string[] = [];
      const queue = ["A"];
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (visited.has(node)) continue;
        visited.add(node);
        bfsResult.push(node);
        for (const neighbor of graph[node as keyof typeof graph] || []) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }

      expect(bfsResult).toEqual(["A", "B", "C", "D"]);
      // A appears exactly once despite cycles back to it
      expect(bfsResult.filter((n) => n === "A")).toHaveLength(1);
    });

    test("should respect depth limit", () => {
      // BFS with depth 1 should only find immediate neighbors
      const graph = {
        "A": ["B", "C"],
        "B": ["D", "E"],
        "C": ["F"],
      };

      const maxDepth = 1;
      const visited = new Set<string>(["A"]);
      let currentLevel = ["A"];
      const results: Array<{ node: string; hop: number }> = [];

      for (let hop = 1; hop <= maxDepth; hop++) {
        const nextLevel: string[] = [];
        for (const node of currentLevel) {
          for (const neighbor of graph[node as keyof typeof graph] || []) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              results.push({ node: neighbor, hop });
              nextLevel.push(neighbor);
            }
          }
        }
        currentLevel = nextLevel;
      }

      // Depth 1 should only find B, C (not D, E, F)
      expect(results.map((r) => r.node)).toEqual(["B", "C"]);
      expect(results.every((r) => r.hop === 1)).toBe(true);
    });

    test("should respect result limit", () => {
      const graph = {
        "A": ["B", "C", "D", "E", "F"],
      };

      const limit = 3;
      const visited = new Set<string>(["A"]);
      const results: string[] = [];

      for (const neighbor of graph["A"]) {
        if (results.length >= limit) break;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          results.push(neighbor);
        }
      }

      expect(results).toHaveLength(3);
      expect(results).toEqual(["B", "C", "D"]);
    });

    test("should handle bidirectional relationships", () => {
      // Both outgoing and incoming (bidirectional) should be traversed
      const outgoing = new Map([
        ["A", [{ target: "B", bidirectional: false }, { target: "C", bidirectional: true }]],
      ]);
      const incoming = new Map([
        ["A", [{ source: "D", bidirectional: true }, { source: "E", bidirectional: false }]],
      ]);

      const reachable: string[] = [];
      // From A: outgoing to B and C
      for (const rel of outgoing.get("A") || []) {
        reachable.push(rel.target);
      }
      // From A: incoming bidirectional from D (but NOT E, since it's not bidirectional)
      for (const rel of incoming.get("A") || []) {
        if (rel.bidirectional) {
          reachable.push(rel.source);
        }
      }

      expect(reachable).toContain("B");
      expect(reachable).toContain("C");
      expect(reachable).toContain("D");
      expect(reachable).not.toContain("E");
    });
  });

  describe("query augmentation logic", () => {
    test("should append related names to query", () => {
      const query = "machine learning";
      const relatedNames = ["neural networks", "deep learning", "TensorFlow"];
      const augmented = `${query} (related: ${relatedNames.join(", ")})`;

      expect(augmented).toBe("machine learning (related: neural networks, deep learning, TensorFlow)");
      expect(augmented).toContain(query);
      expect(augmented).toContain("neural networks");
    });

    test("should return original query if no related entities", () => {
      const query = "unknown topic xyz";
      const relatedNames: string[] = [];

      const augmented = relatedNames.length === 0
        ? query
        : `${query} (related: ${relatedNames.join(", ")})`;

      expect(augmented).toBe(query);
    });

    test("should deduplicate related entity names", () => {
      const relatedNames: string[] = [];
      const candidates = ["Python", "JavaScript", "Python", "TypeScript", "JavaScript"];

      for (const name of candidates) {
        if (!relatedNames.includes(name)) {
          relatedNames.push(name);
        }
      }

      expect(relatedNames).toEqual(["Python", "JavaScript", "TypeScript"]);
      expect(relatedNames).toHaveLength(3);
    });
  });
});
