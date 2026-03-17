import { describe, test, expect, beforeAll, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import * as realEnv from "../src/config/env";
import * as realSchema from "../src/db/schema";

// ============================================
// OSINT Routes — API Tests
// ============================================
// Tests the OSINT API: graph, entity, search, enrich, financial-flow, duplicates, stats.

// ---------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------

const mockEntity1 = {
  id: "aaaa-1111-bbbb-2222",
  name: "Acme Corp",
  type: "organization",
  importance: 0.9,
  description: "A major corporation",
  attributes: { sources: [{ type: "fec" }, { type: "opencorporates" }] },
  aliases: ["ACME", "Acme Corporation"],
  mentionCount: 42,
  createdAt: new Date("2025-01-15"),
};

const mockEntity2 = {
  id: "cccc-3333-dddd-4444",
  name: "John Doe",
  type: "person",
  importance: 0.7,
  description: "A political figure",
  attributes: { sources: [{ type: "fec" }] },
  aliases: ["J. Doe"],
  mentionCount: 15,
  createdAt: new Date("2025-02-01"),
};

const mockRelationship1 = {
  id: "rel-0001",
  source: mockEntity1.id,
  sourceEntityId: mockEntity1.id,
  target: mockEntity2.id,
  targetEntityId: mockEntity2.id,
  type: "donated_to",
  strength: 0.8,
  context: "Campaign donation",
  attributes: { amount: 5000, period: "2024Q1" },
};

// ---------------------------------------------------------------
// Chainable query builder mock
// ---------------------------------------------------------------

let dbSelectResults: any[] = [];
let dbSelectCallCount = 0;
let dbInsertResults: any[] = [];

function createChainableQuery(resolveWith?: any[]) {
  const results = resolveWith !== undefined ? resolveWith : dbSelectResults;
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    groupBy: () => chain,
    innerJoin: () => chain,
    then: (resolve: any) => resolve(results),
  };
  return chain;
}

const mockDb = {
  select: (fields?: any) => {
    dbSelectCallCount++;
    return createChainableQuery();
  },
  insert: () => ({
    values: () => ({
      returning: () => Promise.resolve(dbInsertResults),
    }),
  }),
  update: () => ({
    set: () => ({
      where: () => Promise.resolve(),
    }),
  }),
};

// ---------------------------------------------------------------
// Mocks — must be set up before importing the route module
// ---------------------------------------------------------------

let osintEnabled = true;

mock.module("../src/config/env", () => ({
  ...realEnv,
  env: new Proxy({} as any, {
    get(_target: any, prop: string) {
      if (prop === "OSINT_ENABLED") return osintEnabled;
      return (realEnv.env as any)[prop];
    },
  }),
}));

mock.module("../src/db", () => ({
  db: mockDb,
}));

mock.module("../src/db/schema", () => ({
  ...realSchema,
  graphEntities: {
    id: "graph_entities.id",
    name: "graph_entities.name",
    type: "graph_entities.type",
    importance: "graph_entities.importance",
    description: "graph_entities.description",
    attributes: "graph_entities.attributes",
    aliases: "graph_entities.aliases",
    createdAt: "graph_entities.created_at",
    mentionCount: "graph_entities.mention_count",
  },
  graphRelationships: {
    id: "graph_relationships.id",
    sourceEntityId: "graph_relationships.source_entity_id",
    targetEntityId: "graph_relationships.target_entity_id",
    type: "graph_relationships.type",
    strength: "graph_relationships.strength",
    context: "graph_relationships.context",
    attributes: "graph_relationships.attributes",
  },
}));

mock.module("../src/core/observability/brain-telemetry", () => ({
  brainTelemetry: {
    emitEvent: () => {},
  },
}));

mock.module("../src/core/security/audit-logger", () => ({
  audit: {
    toolUse: () => Promise.resolve(),
  },
}));

mock.module("../src/integrations/public-records", () => ({
  createPublicRecords: () => ({
    fec: {
      searchCandidates: async () => [],
      searchCommittees: async () => [],
    },
    opencorporates: {
      searchCompanies: async () => [],
    },
  }),
}));

mock.module("../src/core/intelligence/entity-resolution", () => ({
  resolveEntity: async (candidate: any) => ({ entityId: "new-entity-id-001" }),
  findDuplicates: async (threshold: number) => [
    {
      entity1: mockEntity1,
      entity2: { ...mockEntity1, id: "dup-id", name: "ACME Corp" },
      similarity: 0.92,
    },
  ],
}));

mock.module("../src/core/intelligence/enrichment-pipeline", () => ({
  enrichEntity: async (entityId: string, sources?: string[], depth?: number) => ({
    newEntitiesCreated: 3,
    newRelationshipsCreated: 5,
  }),
}));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

let app: Hono;

async function createTestApp(): Promise<Hono> {
  const { osintRoutes } = await import("../src/inputs/api/routes/osint");
  const testApp = new Hono();
  testApp.route("/osint", osintRoutes);
  return testApp;
}

async function req(
  app: Hono,
  method: string,
  path: string,
  body?: any,
): Promise<Response> {
  const init: RequestInit = { method, headers: {} };
  if (body) {
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return app.request(path, init);
}

// ---------------------------------------------------------------
// Tests
// ---------------------------------------------------------------

describe("OSINT Routes", () => {
  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    osintEnabled = true;
    dbSelectResults = [];
    dbSelectCallCount = 0;
  });

  // =====================================================
  // OSINT_ENABLED middleware
  // =====================================================

  describe("OSINT_ENABLED middleware", () => {
    test("should return 403 when OSINT is disabled", async () => {
      osintEnabled = false;
      const res = await req(app, "GET", "/osint/graph");
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.error).toBe("OSINT features are disabled");
    });

    test("should allow requests when OSINT is enabled", async () => {
      osintEnabled = true;
      dbSelectResults = [];
      const res = await req(app, "GET", "/osint/graph");
      // Should not be 403 — could be 200 (empty graph)
      expect(res.status).not.toBe(403);
    });

    test("should gate all routes behind OSINT_ENABLED", async () => {
      osintEnabled = false;

      const routes = [
        { method: "GET", path: "/osint/graph" },
        { method: "GET", path: "/osint/entity/some-id" },
        { method: "GET", path: "/osint/search?q=test" },
        { method: "POST", path: "/osint/enrich" },
        { method: "GET", path: "/osint/financial-flow?entityId=abc" },
        { method: "GET", path: "/osint/duplicates" },
        { method: "GET", path: "/osint/stats" },
      ];

      for (const route of routes) {
        const body = route.method === "POST" ? { entityId: "test" } : undefined;
        const res = await req(app, route.method, route.path, body);
        expect(res.status).toBe(403);
      }
    });
  });

  // =====================================================
  // GET /osint/graph
  // =====================================================

  describe("GET /osint/graph", () => {
    test("should return empty graph when no entities exist", async () => {
      dbSelectResults = [];
      const res = await req(app, "GET", "/osint/graph");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.nodes).toEqual([]);
      expect(json.edges).toEqual([]);
    });

    test("should return nodes and edges for a populated graph", async () => {
      // Override mockDb.select to return entities first, then relationships
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          return createChainableQuery([mockEntity1, mockEntity2]);
        }
        return createChainableQuery([mockRelationship1]);
      };

      const res = await req(app, "GET", "/osint/graph");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.nodes).toBeDefined();
      expect(json.edges).toBeDefined();
      expect(json.stats).toBeDefined();
      expect(json.nodes.length).toBe(2);
      expect(json.edges.length).toBe(1);
      expect(json.stats.totalEntities).toBe(2);
      expect(json.stats.totalRelationships).toBe(1);

      mockDb.select = originalSelect;
    });

    test("should use default limit of 200", async () => {
      dbSelectResults = [];
      const res = await req(app, "GET", "/osint/graph");
      expect(res.status).toBe(200);
      // The route parses limit with default 200 — just verify no error
      const json = await res.json();
      expect(json).toBeDefined();
    });

    test("should cap limit at 1000", async () => {
      dbSelectResults = [];
      const res = await req(app, "GET", "/osint/graph?limit=5000");
      expect(res.status).toBe(200);
      // The route caps at 1000 internally; we just verify it doesn't error
      const json = await res.json();
      expect(json).toBeDefined();
    });

    test("should accept temporal filtering with since and until", async () => {
      dbSelectResults = [];
      const res = await req(
        app,
        "GET",
        "/osint/graph?since=2025-01-01&until=2025-12-31",
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toBeDefined();
    });

    test("should handle errors gracefully and return 500", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => {
        throw new Error("Database connection failed");
      };

      const res = await req(app, "GET", "/osint/graph");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to fetch graph data");

      mockDb.select = originalSelect;
    });

    test("should count unique source types in stats", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          return createChainableQuery([mockEntity1, mockEntity2]);
        }
        return createChainableQuery([]);
      };

      const res = await req(app, "GET", "/osint/graph");
      const json = await res.json();
      // mockEntity1 has 2 source types (fec, opencorporates), mockEntity2 has 1 (fec)
      // unique set: fec, opencorporates = 2
      expect(json.stats.totalSources).toBe(2);

      mockDb.select = originalSelect;
    });
  });

  // =====================================================
  // GET /osint/entity/:id
  // =====================================================

  describe("GET /osint/entity/:id", () => {
    test("should return entity with relationships when found", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          // Entity lookup
          return createChainableQuery([mockEntity1]);
        }
        if (callIndex === 2) {
          // Outgoing relationships
          return createChainableQuery([
            { ...mockRelationship1, targetName: "John Doe" },
          ]);
        }
        // Incoming relationships
        return createChainableQuery([]);
      };

      const res = await req(app, "GET", `/osint/entity/${mockEntity1.id}`);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.entity).toBeDefined();
      expect(json.entity.id).toBe(mockEntity1.id);
      expect(json.entity.name).toBe("Acme Corp");
      expect(json.relationships).toBeDefined();
      expect(json.relationships.outgoing).toBeDefined();
      expect(json.relationships.incoming).toBeDefined();
      expect(json.relationships.outgoing.length).toBe(1);
      expect(json.relationships.incoming.length).toBe(0);

      mockDb.select = originalSelect;
    });

    test("should return 404 when entity not found", async () => {
      dbSelectResults = [];
      const res = await req(app, "GET", "/osint/entity/nonexistent-id");
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Entity not found");
    });

    test("should handle errors gracefully and return 500", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => {
        throw new Error("DB error");
      };

      const res = await req(app, "GET", "/osint/entity/some-id");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to fetch entity");

      mockDb.select = originalSelect;
    });
  });

  // =====================================================
  // GET /osint/search
  // =====================================================

  describe("GET /osint/search", () => {
    test("should return 400 when query parameter q is missing", async () => {
      const res = await req(app, "GET", "/osint/search");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Query parameter 'q' is required");
    });

    test("should return local results when found", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          // Local DB search — return enough results to skip external search
          return createChainableQuery([mockEntity1, mockEntity2, {
            ...mockEntity1,
            id: "extra-id",
            name: "Acme Holdings",
          }]);
        }
        // Edges query (entityIds.length > 1)
        return createChainableQuery([mockRelationship1]);
      };

      const res = await req(app, "GET", "/osint/search?q=Acme");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.results).toBeDefined();
      expect(json.results.length).toBe(3);
      expect(json.edges).toBeDefined();
      expect(json.total).toBe(3);
      expect(json.externalSearched).toBe(false);

      mockDb.select = originalSelect;
    });

    test("should trigger external search when local results are sparse", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          // First local search — sparse results (< 3)
          return createChainableQuery([mockEntity1]);
        }
        if (callIndex === 2) {
          // Re-query after external search
          return createChainableQuery([mockEntity1, mockEntity2]);
        }
        // Edges
        return createChainableQuery([]);
      };

      const res = await req(app, "GET", "/osint/search?q=Acme");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.externalSearched).toBe(true);

      mockDb.select = originalSelect;
    });

    test("should support type filtering", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          return createChainableQuery([mockEntity1, mockEntity1, mockEntity1]);
        }
        return createChainableQuery([]);
      };

      const res = await req(
        app,
        "GET",
        "/osint/search?q=Acme&type=organization",
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.results).toBeDefined();

      mockDb.select = originalSelect;
    });

    test("should cap limit at 100", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        // Return enough to skip external search
        if (callIndex === 1) {
          return createChainableQuery([mockEntity1, mockEntity2, mockEntity1]);
        }
        return createChainableQuery([]);
      };

      const res = await req(app, "GET", "/osint/search?q=test&limit=500");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json).toBeDefined();

      mockDb.select = originalSelect;
    });

    test("should handle search errors and return 500", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => {
        throw new Error("Search failed");
      };

      const res = await req(app, "GET", "/osint/search?q=test");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Search failed");

      mockDb.select = originalSelect;
    });

    test("should not search external APIs for single-character queries", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        // Return sparse results, but query is only 1 char so external search should be skipped
        return createChainableQuery([]);
      };

      const res = await req(app, "GET", "/osint/search?q=A");
      expect(res.status).toBe(200);

      const json = await res.json();
      // With single char, external search is NOT triggered (q.length >= 2 check)
      expect(json.externalSearched).toBe(false);

      mockDb.select = originalSelect;
    });

    test("should return edges between matched entities", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          return createChainableQuery([mockEntity1, mockEntity2, {
            ...mockEntity1,
            id: "third-id",
            name: "Another",
          }]);
        }
        // Edges query
        return createChainableQuery([mockRelationship1]);
      };

      const res = await req(app, "GET", "/osint/search?q=test");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.edges.length).toBe(1);

      mockDb.select = originalSelect;
    });
  });

  // =====================================================
  // POST /osint/enrich
  // =====================================================

  describe("POST /osint/enrich", () => {
    test("should return 400 when entityId is missing", async () => {
      const res = await req(app, "POST", "/osint/enrich", {});
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("entityId is required");
    });

    test("should return 404 when entity not found", async () => {
      dbSelectResults = [];
      const res = await req(app, "POST", "/osint/enrich", {
        entityId: "nonexistent-id",
      });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Entity not found");
    });

    test("should successfully enrich an entity", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => createChainableQuery([mockEntity1]);

      const res = await req(app, "POST", "/osint/enrich", {
        entityId: mockEntity1.id,
        sources: ["fec", "opencorporates"],
        depth: 2,
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.result).toBeDefined();
      expect(json.result.newEntitiesCreated).toBe(3);
      expect(json.result.newRelationshipsCreated).toBe(5);

      mockDb.select = originalSelect;
    });

    test("should return 501 when enrichment pipeline is unavailable", async () => {
      // Re-mock the enrichment pipeline to throw MODULE_NOT_FOUND
      const originalSelect = mockDb.select;
      mockDb.select = () => createChainableQuery([mockEntity1]);

      // We need to simulate this at the dynamic import level
      // The route does: const { enrichEntity } = await import(...)
      // Since mock.module is process-wide, we temporarily override it
      mock.module("../src/core/intelligence/enrichment-pipeline", () => {
        throw Object.assign(new Error("Cannot find module"), {
          code: "MODULE_NOT_FOUND",
        });
      });

      const res = await req(app, "POST", "/osint/enrich", {
        entityId: mockEntity1.id,
      });
      expect(res.status).toBe(501);

      const json = await res.json();
      expect(json.error).toBe("Enrichment pipeline is not available");

      // Restore the mock
      mock.module("../src/core/intelligence/enrichment-pipeline", () => ({
        enrichEntity: async (entityId: string, sources?: string[], depth?: number) => ({
          newEntitiesCreated: 3,
          newRelationshipsCreated: 5,
        }),
      }));
      mockDb.select = originalSelect;
    });

    test("should handle enrichment errors and return 500", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => createChainableQuery([mockEntity1]);

      mock.module("../src/core/intelligence/enrichment-pipeline", () => ({
        enrichEntity: async () => {
          throw new Error("Enrichment processing failed");
        },
      }));

      const res = await req(app, "POST", "/osint/enrich", {
        entityId: mockEntity1.id,
      });
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Enrichment failed");

      // Restore the mock
      mock.module("../src/core/intelligence/enrichment-pipeline", () => ({
        enrichEntity: async (entityId: string, sources?: string[], depth?: number) => ({
          newEntitiesCreated: 3,
          newRelationshipsCreated: 5,
        }),
      }));
      mockDb.select = originalSelect;
    });
  });

  // =====================================================
  // GET /osint/financial-flow
  // =====================================================

  describe("GET /osint/financial-flow", () => {
    test("should return 400 when entityId is missing", async () => {
      const res = await req(app, "GET", "/osint/financial-flow");
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Query parameter 'entityId' is required");
    });

    test("should return 404 when entity not found", async () => {
      dbSelectResults = [];
      const res = await req(
        app,
        "GET",
        "/osint/financial-flow?entityId=nonexistent",
      );
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Entity not found");
    });

    test("should return financial flow data with nodes and links", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          // Root entity lookup
          return createChainableQuery([
            { id: mockEntity1.id, name: mockEntity1.name },
          ]);
        }
        if (callIndex === 2) {
          // Outgoing financial relationships
          return createChainableQuery([mockRelationship1]);
        }
        if (callIndex === 3) {
          // Incoming financial relationships
          return createChainableQuery([]);
        }
        // Related entities lookup
        return createChainableQuery([
          { id: mockEntity1.id, name: mockEntity1.name, type: "organization" },
          { id: mockEntity2.id, name: mockEntity2.name, type: "person" },
        ]);
      };

      const res = await req(
        app,
        "GET",
        `/osint/financial-flow?entityId=${mockEntity1.id}`,
      );
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.nodes).toBeDefined();
      expect(json.links).toBeDefined();
      expect(Array.isArray(json.nodes)).toBe(true);
      expect(Array.isArray(json.links)).toBe(true);
      expect(json.nodes.length).toBe(2);
      expect(json.links.length).toBe(1);

      // Verify node structure
      const acmeNode = json.nodes.find((n: any) => n.id === mockEntity1.id);
      expect(acmeNode).toBeDefined();
      expect(acmeNode.name).toBe("Acme Corp");
      expect(acmeNode.value).toBeGreaterThan(0);

      // Verify link structure
      expect(json.links[0].source).toBe(mockEntity1.id);
      expect(json.links[0].target).toBe(mockEntity2.id);
      expect(json.links[0].value).toBe(5000); // from attributes.amount
      expect(json.links[0].description).toContain("donated to");

      mockDb.select = originalSelect;
    });

    test("should handle errors and return 500", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => {
        throw new Error("DB error");
      };

      const res = await req(
        app,
        "GET",
        "/osint/financial-flow?entityId=some-id",
      );
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to fetch financial flow data");

      mockDb.select = originalSelect;
    });
  });

  // =====================================================
  // GET /osint/duplicates
  // =====================================================

  describe("GET /osint/duplicates", () => {
    test("should return duplicates with default threshold", async () => {
      const res = await req(app, "GET", "/osint/duplicates");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.duplicates).toBeDefined();
      expect(Array.isArray(json.duplicates)).toBe(true);
      expect(json.total).toBeDefined();
      expect(json.total).toBe(json.duplicates.length);
    });

    test("should accept a custom threshold parameter", async () => {
      const res = await req(app, "GET", "/osint/duplicates?threshold=0.7");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.duplicates).toBeDefined();
      expect(json.total).toBe(json.duplicates.length);
    });

    test("should return duplicate pairs with similarity scores", async () => {
      const res = await req(app, "GET", "/osint/duplicates");
      expect(res.status).toBe(200);

      const json = await res.json();
      if (json.duplicates.length > 0) {
        const dup = json.duplicates[0];
        expect(dup.entity1).toBeDefined();
        expect(dup.entity2).toBeDefined();
        expect(dup.similarity).toBeDefined();
        expect(dup.similarity).toBeGreaterThanOrEqual(0);
        expect(dup.similarity).toBeLessThanOrEqual(1);
      }
    });

    test("should handle errors and return 500", async () => {
      mock.module("../src/core/intelligence/entity-resolution", () => ({
        resolveEntity: async () => ({ entityId: "id" }),
        findDuplicates: async () => {
          throw new Error("Resolution engine down");
        },
      }));

      const res = await req(app, "GET", "/osint/duplicates");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to find duplicates");

      // Restore mock
      mock.module("../src/core/intelligence/entity-resolution", () => ({
        resolveEntity: async (candidate: any) => ({ entityId: "new-entity-id-001" }),
        findDuplicates: async (threshold: number) => [
          {
            entity1: mockEntity1,
            entity2: { ...mockEntity1, id: "dup-id", name: "ACME Corp" },
            similarity: 0.92,
          },
        ],
      }));
    });
  });

  // =====================================================
  // GET /osint/stats
  // =====================================================

  describe("GET /osint/stats", () => {
    test("should return graph statistics", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex === 1) {
          // Total entities count
          return createChainableQuery([{ count: 150 }]);
        }
        if (callIndex === 2) {
          // Total relationships count
          return createChainableQuery([{ count: 320 }]);
        }
        if (callIndex === 3) {
          // Entities by type
          return createChainableQuery([
            { type: "person", count: 80 },
            { type: "organization", count: 50 },
            { type: "committee", count: 20 },
          ]);
        }
        // Top entities
        return createChainableQuery([
          {
            id: mockEntity1.id,
            name: mockEntity1.name,
            type: mockEntity1.type,
            mentionCount: 42,
            importance: 0.9,
          },
          {
            id: mockEntity2.id,
            name: mockEntity2.name,
            type: mockEntity2.type,
            mentionCount: 15,
            importance: 0.7,
          },
        ]);
      };

      const res = await req(app, "GET", "/osint/stats");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.totalEntities).toBe(150);
      expect(json.totalRelationships).toBe(320);
      expect(json.entitiesByType).toBeDefined();
      expect(Array.isArray(json.entitiesByType)).toBe(true);
      expect(json.entitiesByType.length).toBe(3);
      expect(json.topEntities).toBeDefined();
      expect(Array.isArray(json.topEntities)).toBe(true);
      expect(json.topEntities.length).toBe(2);
      expect(json.topEntities[0].name).toBe("Acme Corp");

      mockDb.select = originalSelect;
    });

    test("should return zero counts for empty graph", async () => {
      let callIndex = 0;
      const originalSelect = mockDb.select;
      mockDb.select = (fields?: any) => {
        callIndex++;
        if (callIndex <= 2) {
          return createChainableQuery([{ count: 0 }]);
        }
        return createChainableQuery([]);
      };

      const res = await req(app, "GET", "/osint/stats");
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.totalEntities).toBe(0);
      expect(json.totalRelationships).toBe(0);
      expect(json.entitiesByType).toEqual([]);
      expect(json.topEntities).toEqual([]);

      mockDb.select = originalSelect;
    });

    test("should handle errors and return 500", async () => {
      const originalSelect = mockDb.select;
      mockDb.select = () => {
        throw new Error("Stats query failed");
      };

      const res = await req(app, "GET", "/osint/stats");
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error).toBe("Failed to fetch statistics");

      mockDb.select = originalSelect;
    });
  });
});
