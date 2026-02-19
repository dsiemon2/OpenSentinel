/**
 * OSINT API Routes
 *
 * Provides REST endpoints for the Graph Explorer frontend component.
 * Queries the Postgres-backed knowledge graph (graphEntities / graphRelationships)
 * and exposes enrichment, entity-resolution, and analytics helpers.
 */

import { Hono } from "hono";
import { db } from "../../../db";
import { graphEntities, graphRelationships } from "../../../db/schema";
import { eq, sql, desc, ilike, and } from "drizzle-orm";
import { env } from "../../../config/env";
import { createPublicRecords } from "../../../integrations/public-records";
import {
  resolveEntity,
  type EntityCandidate,
} from "../../../core/intelligence/entity-resolution";

// Lazy-init the public records facade (avoid startup cost if OSINT is disabled)
let _publicRecords: ReturnType<typeof createPublicRecords> | null = null;
function getPublicRecords() {
  if (!_publicRecords) _publicRecords = createPublicRecords();
  return _publicRecords;
}

const osint = new Hono();

// ---------------------------------------------------------------------------
// Middleware — gate every route behind OSINT_ENABLED
// ---------------------------------------------------------------------------

osint.use("*", async (c, next) => {
  if (!env.OSINT_ENABLED) {
    return c.json({ error: "OSINT features are disabled" }, 403);
  }
  await next();
});

// ---------------------------------------------------------------------------
// GET /graph — graph data for D3 force-directed visualisation
// ---------------------------------------------------------------------------

osint.get("/graph", async (c) => {
  try {
    const userId = c.req.query("userId") || "system";
    const limit = Math.min(parseInt(c.req.query("limit") || "200", 10), 1000);

    // Fetch entities
    const entities = await db
      .select({
        id: graphEntities.id,
        name: graphEntities.name,
        type: graphEntities.type,
        importance: graphEntities.importance,
        description: graphEntities.description,
        attributes: graphEntities.attributes,
        aliases: graphEntities.aliases,
      })
      .from(graphEntities)
      .orderBy(desc(graphEntities.importance))
      .limit(limit);

    const entityIds = entities.map((e) => e.id);

    if (entityIds.length === 0) {
      return c.json({ nodes: [], edges: [] });
    }

    // Fetch relationships where both source and target are in the entity set
    const relationships = await db
      .select({
        id: graphRelationships.id,
        source: graphRelationships.sourceEntityId,
        target: graphRelationships.targetEntityId,
        type: graphRelationships.type,
        strength: graphRelationships.strength,
      })
      .from(graphRelationships)
      .where(
        and(
          sql`${graphRelationships.sourceEntityId} = ANY(${sql`ARRAY[${sql.join(entityIds.map(id => sql`${id}`), sql`, `)}]::uuid[]`})`,
          sql`${graphRelationships.targetEntityId} = ANY(${sql`ARRAY[${sql.join(entityIds.map(id => sql`${id}`), sql`, `)}]::uuid[]`})`
        )
      );

    return c.json({
      nodes: entities,
      edges: relationships,
      stats: {
        totalEntities: entities.length,
        totalRelationships: relationships.length,
        totalSources: new Set(
          entities.flatMap((e) => {
            const srcs = (e.attributes as any)?.sources;
            return Array.isArray(srcs) ? srcs.map((s: any) => s.type || "unknown") : [];
          })
        ).size,
      },
    });
  } catch (error) {
    console.error("[OSINT API] /graph error:", error);
    return c.json({ error: "Failed to fetch graph data" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /entity/:id — single entity with relationships
// ---------------------------------------------------------------------------

osint.get("/entity/:id", async (c) => {
  try {
    const id = c.req.param("id");

    const results = await db
      .select()
      .from(graphEntities)
      .where(eq(graphEntities.id, id))
      .limit(1);

    if (results.length === 0) {
      return c.json({ error: "Entity not found" }, 404);
    }

    const entity = results[0];

    // Relationships where this entity is the source
    const outgoing = await db
      .select({
        id: graphRelationships.id,
        sourceEntityId: graphRelationships.sourceEntityId,
        targetEntityId: graphRelationships.targetEntityId,
        type: graphRelationships.type,
        strength: graphRelationships.strength,
        context: graphRelationships.context,
        attributes: graphRelationships.attributes,
        targetName: graphEntities.name,
      })
      .from(graphRelationships)
      .innerJoin(graphEntities, eq(graphRelationships.targetEntityId, graphEntities.id))
      .where(eq(graphRelationships.sourceEntityId, id));

    // Relationships where this entity is the target
    const incoming = await db
      .select({
        id: graphRelationships.id,
        sourceEntityId: graphRelationships.sourceEntityId,
        targetEntityId: graphRelationships.targetEntityId,
        type: graphRelationships.type,
        strength: graphRelationships.strength,
        context: graphRelationships.context,
        attributes: graphRelationships.attributes,
        sourceName: graphEntities.name,
      })
      .from(graphRelationships)
      .innerJoin(graphEntities, eq(graphRelationships.sourceEntityId, graphEntities.id))
      .where(eq(graphRelationships.targetEntityId, id));

    return c.json({
      entity,
      relationships: {
        outgoing,
        incoming,
      },
    });
  } catch (error) {
    console.error("[OSINT API] /entity/:id error:", error);
    return c.json({ error: "Failed to fetch entity" }, 500);
  }
});

// ---------------------------------------------------------------------------
// External API search helper
// ---------------------------------------------------------------------------

/**
 * Normalize FEC-style names from "LAST, FIRST MIDDLE" to "First Middle Last".
 */
function normalizeFECName(raw: string): string {
  if (!raw.includes(",")) return toTitleCase(raw);
  const [last, ...rest] = raw.split(",").map((s) => s.trim());
  const first = rest.join(" ").trim();
  if (!first) return toTitleCase(last);
  return toTitleCase(`${first} ${last}`);
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Query FEC and OpenCorporates for a search term, resolve results into
 * the local knowledge graph, and return the newly-created entity IDs.
 */
async function searchExternalAPIs(query: string): Promise<string[]> {
  const pr = getPublicRecords();
  const newEntityIds: string[] = [];

  // Run FEC (candidates + committees) and OpenCorporates in parallel.
  // Each call is wrapped so a single API failure doesn't kill the whole search.
  const [fecCandidates, fecCommittees, ocCompanies] = await Promise.all([
    pr.fec
      .searchCandidates(query)
      .then((r) => r.slice(0, 10))
      .catch((err) => {
        console.warn("[OSINT API] FEC candidates search failed:", err.message);
        return [] as any[];
      }),
    pr.fec
      .searchCommittees(query)
      .then((r) => r.slice(0, 10))
      .catch((err) => {
        console.warn("[OSINT API] FEC committees search failed:", err.message);
        return [] as any[];
      }),
    pr.opencorporates
      .searchCompanies(query, "us")
      .then((r) => r.slice(0, 10))
      .catch((err) => {
        console.warn("[OSINT API] OpenCorporates search failed:", err.message);
        return [] as any[];
      }),
  ]);

  // Build entity candidates
  const candidates: EntityCandidate[] = [];

  for (const c of fecCandidates) {
    candidates.push({
      name: normalizeFECName(c.name),
      type: "person",
      source: "fec",
      identifiers: { fecId: c.candidateId },
      attributes: {
        party: c.party,
        office: c.office,
        state: c.state,
        district: c.district,
        cycles: c.cycles,
      },
    });
  }

  for (const c of fecCommittees) {
    candidates.push({
      name: toTitleCase(c.name),
      type: "committee",
      source: "fec",
      identifiers: { fecId: c.committeeId },
      attributes: {
        designation: c.designation,
        committeeType: c.type,
        party: c.party,
        state: c.state,
        treasurerName: c.treasurerName,
      },
    });
  }

  for (const c of ocCompanies) {
    candidates.push({
      name: c.name,
      type: "organization",
      source: "opencorporates",
      attributes: {
        companyNumber: c.companyNumber,
        jurisdiction: c.jurisdictionCode,
        status: c.status,
        companyType: c.companyType,
        incorporationDate: c.incorporationDate,
        registeredAddress: c.registeredAddress,
        openCorporatesUrl: c.openCorporatesUrl,
      },
    });
  }

  // Resolve each candidate (dedup / insert) — run sequentially to avoid
  // DB race conditions on the same entity name
  for (const candidate of candidates) {
    try {
      const resolved = await resolveEntity(candidate);
      newEntityIds.push(resolved.entityId);
    } catch (err: any) {
      console.warn(`[OSINT API] Entity resolution failed for "${candidate.name}":`, err.message);
    }
  }

  return [...new Set(newEntityIds)]; // deduplicate
}

// ---------------------------------------------------------------------------
// GET /search — search entities by name
// ---------------------------------------------------------------------------

osint.get("/search", async (c) => {
  try {
    const q = c.req.query("q");
    const type = c.req.query("type");
    const limit = Math.min(parseInt(c.req.query("limit") || "25", 10), 100);

    if (!q) {
      return c.json({ error: "Query parameter 'q' is required" }, 400);
    }

    // 1. Local DB search
    let query = db
      .select()
      .from(graphEntities)
      .where(
        type
          ? and(ilike(graphEntities.name, `%${q}%`), eq(graphEntities.type, type as any))
          : ilike(graphEntities.name, `%${q}%`)
      )
      .orderBy(desc(graphEntities.importance))
      .limit(limit);

    let results = await query;
    let externalSearched = false;

    // 2. If local results are sparse, search external APIs and re-query
    if (results.length < 3 && q.length >= 2) {
      try {
        console.log(`[OSINT API] Local results (${results.length}) < 3 for "${q}", querying external APIs...`);
        const externalIds = await searchExternalAPIs(q);
        externalSearched = true;

        if (externalIds.length > 0) {
          // Re-run local search: match by name OR by the newly-ingested entity IDs
          // (needed because FEC names like "PELOSI, NANCY" get normalized to "Nancy Pelosi"
          //  but the ILIKE may still not match all variations)
          const nameCondition = type
            ? and(ilike(graphEntities.name, `%${q}%`), eq(graphEntities.type, type as any))
            : ilike(graphEntities.name, `%${q}%`);

          const idCondition = sql`${graphEntities.id} = ANY(${sql`ARRAY[${sql.join(externalIds.map((id: string) => sql`${id}`), sql`, `)}]::uuid[]`})`;

          results = await db
            .select()
            .from(graphEntities)
            .where(sql`(${nameCondition}) OR (${idCondition})`)
            .orderBy(desc(graphEntities.importance))
            .limit(limit);
        }
      } catch (extErr: any) {
        console.warn("[OSINT API] External search failed (graceful):", extErr.message);
      }
    }

    // 3. Fetch relationships between matched entities for graph view
    const entityIds = results.map((e: any) => e.id);
    let edges: any[] = [];
    if (entityIds.length > 1) {
      edges = await db
        .select({
          id: graphRelationships.id,
          source: graphRelationships.sourceEntityId,
          target: graphRelationships.targetEntityId,
          type: graphRelationships.type,
          strength: graphRelationships.strength,
        })
        .from(graphRelationships)
        .where(
          and(
            sql`${graphRelationships.sourceEntityId} = ANY(${sql`ARRAY[${sql.join(entityIds.map((id: string) => sql`${id}`), sql`, `)}]::uuid[]`})`,
            sql`${graphRelationships.targetEntityId} = ANY(${sql`ARRAY[${sql.join(entityIds.map((id: string) => sql`${id}`), sql`, `)}]::uuid[]`})`
          )
        );
    }

    return c.json({ results, edges, total: results.length, externalSearched });
  } catch (error) {
    console.error("[OSINT API] /search error:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /enrich — trigger enrichment for an entity
// ---------------------------------------------------------------------------

osint.post("/enrich", async (c) => {
  try {
    const body = await c.req.json<{
      entityId: string;
      sources?: string[];
      depth?: number;
    }>();

    if (!body.entityId) {
      return c.json({ error: "entityId is required" }, 400);
    }

    // Verify entity exists
    const entity = await db
      .select()
      .from(graphEntities)
      .where(eq(graphEntities.id, body.entityId))
      .limit(1);

    if (entity.length === 0) {
      return c.json({ error: "Entity not found" }, 404);
    }

    // Dynamic import — the enrichment pipeline may not be built yet
    const { enrichEntity } = await import(
      "../../../core/intelligence/enrichment-pipeline"
    );

    const result = await enrichEntity(body.entityId, {
      sources: body.sources,
      depth: body.depth ?? 1,
    });

    return c.json({ success: true, result });
  } catch (error: any) {
    // Distinguish "module not found" from runtime errors
    if (error?.code === "MODULE_NOT_FOUND" || error?.message?.includes("Cannot find module")) {
      return c.json({ error: "Enrichment pipeline is not available" }, 501);
    }
    console.error("[OSINT API] /enrich error:", error);
    return c.json({ error: "Enrichment failed" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /financial-flow — Sankey diagram data
// ---------------------------------------------------------------------------

const FINANCIAL_REL_TYPES = ["donated_to", "funded", "awarded_contract", "grant_to", "paid"];

osint.get("/financial-flow", async (c) => {
  try {
    const entityId = c.req.query("entityId");

    if (!entityId) {
      return c.json({ error: "Query parameter 'entityId' is required" }, 400);
    }

    // Verify entity exists
    const rootEntity = await db
      .select({ id: graphEntities.id, name: graphEntities.name })
      .from(graphEntities)
      .where(eq(graphEntities.id, entityId))
      .limit(1);

    if (rootEntity.length === 0) {
      return c.json({ error: "Entity not found" }, 404);
    }

    // Fetch financial relationships involving this entity (outgoing and incoming)
    const outgoing = await db
      .select({
        id: graphRelationships.id,
        sourceEntityId: graphRelationships.sourceEntityId,
        targetEntityId: graphRelationships.targetEntityId,
        type: graphRelationships.type,
        strength: graphRelationships.strength,
        attributes: graphRelationships.attributes,
      })
      .from(graphRelationships)
      .where(
        and(
          eq(graphRelationships.sourceEntityId, entityId),
          sql`${graphRelationships.type} = ANY(${sql`ARRAY[${sql.join(FINANCIAL_REL_TYPES.map(t => sql`${t}`), sql`, `)}]::text[]`})`
        )
      );

    const incoming = await db
      .select({
        id: graphRelationships.id,
        sourceEntityId: graphRelationships.sourceEntityId,
        targetEntityId: graphRelationships.targetEntityId,
        type: graphRelationships.type,
        strength: graphRelationships.strength,
        attributes: graphRelationships.attributes,
      })
      .from(graphRelationships)
      .where(
        and(
          eq(graphRelationships.targetEntityId, entityId),
          sql`${graphRelationships.type} = ANY(${sql`ARRAY[${sql.join(FINANCIAL_REL_TYPES.map(t => sql`${t}`), sql`, `)}]::text[]`})`
        )
      );

    const allRels = [...outgoing, ...incoming];

    // Collect unique entity IDs referenced in the relationships
    const relatedIds = new Set<string>();
    relatedIds.add(entityId);
    for (const rel of allRels) {
      relatedIds.add(rel.sourceEntityId);
      relatedIds.add(rel.targetEntityId);
    }

    // Fetch details for all involved entities
    const relatedEntities = await db
      .select({
        id: graphEntities.id,
        name: graphEntities.name,
        type: graphEntities.type,
      })
      .from(graphEntities)
      .where(sql`${graphEntities.id} = ANY(${sql`ARRAY[${sql.join([...relatedIds].map(id => sql`${id}`), sql`, `)}]::uuid[]`})`);

    // Build nodes with id, name, type, and aggregated value
    const entityMap = new Map(relatedEntities.map((e) => [e.id, e]));

    // Calculate total value flowing through each node
    const nodeValues = new Map<string, number>();
    for (const rel of allRels) {
      const attrs = (rel.attributes as Record<string, unknown>) || {};
      const amount = (attrs.amount as number) || rel.strength || 1;
      nodeValues.set(rel.sourceEntityId, (nodeValues.get(rel.sourceEntityId) || 0) + amount);
      nodeValues.set(rel.targetEntityId, (nodeValues.get(rel.targetEntityId) || 0) + amount);
    }

    const nodes = relatedEntities.map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      value: nodeValues.get(e.id) || 0,
    }));

    // Build links with string IDs
    const links = allRels
      .filter((rel) => entityMap.has(rel.sourceEntityId) && entityMap.has(rel.targetEntityId))
      .map((rel) => {
        const attrs = (rel.attributes as Record<string, unknown>) || {};
        return {
          source: rel.sourceEntityId,
          target: rel.targetEntityId,
          value: (attrs.amount as number) || rel.strength || 1,
          description: `${rel.type.replace(/_/g, " ")}${attrs.period ? ` (${attrs.period})` : ""}`,
        };
      });

    return c.json({ nodes, links });
  } catch (error) {
    console.error("[OSINT API] /financial-flow error:", error);
    return c.json({ error: "Failed to fetch financial flow data" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /duplicates — find potential duplicate entities
// ---------------------------------------------------------------------------

osint.get("/duplicates", async (c) => {
  try {
    const threshold = parseFloat(c.req.query("threshold") || "0.85");

    const { findDuplicates } = await import(
      "../../../core/intelligence/entity-resolution"
    );

    const duplicates = await findDuplicates(threshold);

    return c.json({ duplicates, total: duplicates.length });
  } catch (error) {
    console.error("[OSINT API] /duplicates error:", error);
    return c.json({ error: "Failed to find duplicates" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /stats — OSINT graph statistics
// ---------------------------------------------------------------------------

osint.get("/stats", async (c) => {
  try {
    // Total entities
    const totalEntitiesResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(graphEntities);
    const totalEntities = totalEntitiesResult[0]?.count ?? 0;

    // Total relationships
    const totalRelsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(graphRelationships);
    const totalRelationships = totalRelsResult[0]?.count ?? 0;

    // Entities by type
    const entitiesByType = await db
      .select({
        type: graphEntities.type,
        count: sql<number>`count(*)::int`,
      })
      .from(graphEntities)
      .groupBy(graphEntities.type)
      .orderBy(desc(sql`count(*)`));

    // Top entities by mention count
    const topEntities = await db
      .select({
        id: graphEntities.id,
        name: graphEntities.name,
        type: graphEntities.type,
        mentionCount: graphEntities.mentionCount,
        importance: graphEntities.importance,
      })
      .from(graphEntities)
      .orderBy(desc(graphEntities.mentionCount))
      .limit(20);

    return c.json({
      totalEntities,
      totalRelationships,
      entitiesByType,
      topEntities,
    });
  } catch (error) {
    console.error("[OSINT API] /stats error:", error);
    return c.json({ error: "Failed to fetch statistics" }, 500);
  }
});

export { osint as osintRoutes };
