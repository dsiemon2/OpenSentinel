import { describe, test, expect, mock, beforeAll } from "bun:test";

// Mock dependencies before importing the module
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => Promise.resolve([]),
    }),
  }),
  insert: () => ({
    values: () => Promise.resolve(),
  }),
};

mock.module("../src/db", () => ({ db: mockDb }));
mock.module("../src/db/schema", () => ({
  memories: { id: "id", userId: "userId", type: "type", source: "source", content: "content", importance: "importance", embedding: "embedding" },
  conversations: { id: "id", userId: "userId", createdAt: "createdAt" },
  messages: { id: "id", conversationId: "conversationId", createdAt: "createdAt", role: "role", content: "content" },
}));
mock.module("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  entities: [],
                  relationships: [],
                  entitySearches: [],
                  relationshipSearches: [],
                  pathSearches: [],
                }),
              },
            },
          ],
        }),
      },
    };
  },
}));
mock.module("../src/config/env", () => ({ env: { OPENAI_API_KEY: "test-key" } }));
mock.module("../src/core/memory", () => ({
  generateEmbedding: async () => new Array(1536).fill(0),
}));

import type {
  EntityType,
  RelationType,
  Entity,
  Relationship,
  GraphQueryResult,
} from "../src/core/intelligence/relationship-graph";

describe("Relationship Graph", () => {
  let mod: typeof import("../src/core/intelligence/relationship-graph");

  beforeAll(async () => {
    mod = await import("../src/core/intelligence/relationship-graph");
  });

  describe("Type: EntityType", () => {
    test("should accept 'person' as valid EntityType", () => {
      const t: EntityType = "person";
      expect(t).toBe("person");
    });

    test("should accept 'project' as valid EntityType", () => {
      const t: EntityType = "project";
      expect(t).toBe("project");
    });

    test("should accept 'topic' as valid EntityType", () => {
      const t: EntityType = "topic";
      expect(t).toBe("topic");
    });

    test("should accept 'event' as valid EntityType", () => {
      const t: EntityType = "event";
      expect(t).toBe("event");
    });

    test("should accept 'organization' as valid EntityType", () => {
      const t: EntityType = "organization";
      expect(t).toBe("organization");
    });

    test("should accept 'location' as valid EntityType", () => {
      const t: EntityType = "location";
      expect(t).toBe("location");
    });
  });

  describe("Type: RelationType", () => {
    test("should accept core relation types", () => {
      const types: RelationType[] = [
        "knows", "works_with", "works_on", "family", "friend",
        "colleague", "manages", "reports_to", "belongs_to",
        "related_to", "located_in", "interested_in", "expert_in",
        "mentioned_in", "participates_in",
      ];
      expect(types.length).toBe(15);
      for (const t of types) {
        expect(typeof t).toBe("string");
      }
    });
  });

  describe("Entity interface", () => {
    test("should have all required fields", () => {
      const entity: Entity = {
        id: "ent_123",
        type: "person",
        name: "Alice",
        aliases: ["Al"],
        description: "A developer",
        attributes: { role: "engineer" },
        importance: 80,
        lastMentioned: new Date(),
        mentionCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(entity.id).toBe("ent_123");
      expect(entity.type).toBe("person");
      expect(entity.name).toBe("Alice");
      expect(Array.isArray(entity.aliases)).toBe(true);
      expect(typeof entity.attributes).toBe("object");
      expect(entity.importance).toBe(80);
      expect(entity.mentionCount).toBe(5);
      expect(entity.createdAt).toBeInstanceOf(Date);
      expect(entity.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("Relationship interface", () => {
    test("should have all required fields", () => {
      const rel: Relationship = {
        id: "rel_456",
        sourceId: "ent_1",
        targetId: "ent_2",
        type: "works_with",
        strength: 75,
        bidirectional: true,
        context: "Same team",
        attributes: {},
        lastUpdated: new Date(),
        createdAt: new Date(),
      };
      expect(rel.id).toBe("rel_456");
      expect(rel.sourceId).toBe("ent_1");
      expect(rel.targetId).toBe("ent_2");
      expect(rel.type).toBe("works_with");
      expect(rel.strength).toBe(75);
      expect(rel.bidirectional).toBe(true);
      expect(typeof rel.attributes).toBe("object");
      expect(rel.lastUpdated).toBeInstanceOf(Date);
      expect(rel.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("GraphQueryResult interface", () => {
    test("should have entities, relationships, and paths arrays", () => {
      const result: GraphQueryResult = {
        entities: [],
        relationships: [],
        paths: [],
      };
      expect(Array.isArray(result.entities)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
      expect(Array.isArray(result.paths)).toBe(true);
    });
  });

  describe("Function exports", () => {
    test("should export upsertEntity function", () => {
      expect(typeof mod.upsertEntity).toBe("function");
    });

    test("should export upsertRelationship function", () => {
      expect(typeof mod.upsertRelationship).toBe("function");
    });

    test("should export findEntity function", () => {
      expect(typeof mod.findEntity).toBe("function");
    });

    test("should export getEntityRelationships function", () => {
      expect(typeof mod.getEntityRelationships).toBe("function");
    });

    test("should export findPath function", () => {
      expect(typeof mod.findPath).toBe("function");
    });

    test("should export getOrCreateGraph function", () => {
      expect(typeof mod.getOrCreateGraph).toBe("function");
    });

    test("should export getEntitiesByType function", () => {
      expect(typeof mod.getEntitiesByType).toBe("function");
    });

    test("should export extractFromText function", () => {
      expect(typeof mod.extractFromText).toBe("function");
    });

    test("should export queryGraph function", () => {
      expect(typeof mod.queryGraph).toBe("function");
    });

    test("should export buildGraphContext function", () => {
      expect(typeof mod.buildGraphContext).toBe("function");
    });

    test("should export getGraphStats function", () => {
      expect(typeof mod.getGraphStats).toBe("function");
    });

    test("should have default export with all main functions", () => {
      const def = mod.default;
      expect(typeof def.getOrCreateGraph).toBe("function");
      expect(typeof def.upsertEntity).toBe("function");
      expect(typeof def.upsertRelationship).toBe("function");
      expect(typeof def.findEntity).toBe("function");
      expect(typeof def.getEntitiesByType).toBe("function");
      expect(typeof def.getEntityRelationships).toBe("function");
      expect(typeof def.findPath).toBe("function");
      expect(typeof def.extractFromText).toBe("function");
      expect(typeof def.queryGraph).toBe("function");
      expect(typeof def.buildGraphContext).toBe("function");
      expect(typeof def.getGraphStats).toBe("function");
    });
  });

  describe("getOrCreateGraph", () => {
    test("should return object with entities and relationships arrays", async () => {
      const graph = await mod.getOrCreateGraph("test-user-rg");
      expect(Array.isArray(graph.entities)).toBe(true);
      expect(Array.isArray(graph.relationships)).toBe(true);
    });
  });

  describe("findEntity", () => {
    test("should return null when entity does not exist", async () => {
      const result = await mod.findEntity("test-user-find", "Nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("getGraphStats", () => {
    test("should return stats object with expected shape", async () => {
      const stats = await mod.getGraphStats("test-user-stats");
      expect(typeof stats.totalEntities).toBe("number");
      expect(typeof stats.totalRelationships).toBe("number");
      expect(typeof stats.entitiesByType).toBe("object");
      expect(typeof stats.relationshipsByType).toBe("object");
      expect(Array.isArray(stats.mostConnected)).toBe(true);
      expect(Array.isArray(stats.mostMentioned)).toBe(true);
    });
  });
});
