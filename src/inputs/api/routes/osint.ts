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
        attributes: graphEntities.attributes,
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
          sql`${graphRelationships.sourceEntityId} = ANY(${entityIds})`,
          sql`${graphRelationships.targetEntityId} = ANY(${entityIds})`
        )
      );

    return c.json({
      nodes: entities,
      edges: relationships,
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

    const results = await query;

    return c.json({ results, total: results.length });
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
          sql`${graphRelationships.type} = ANY(${FINANCIAL_REL_TYPES})`
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
          sql`${graphRelationships.type} = ANY(${FINANCIAL_REL_TYPES})`
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

    // Fetch names for all involved entities
    const relatedEntities = await db
      .select({ id: graphEntities.id, name: graphEntities.name })
      .from(graphEntities)
      .where(sql`${graphEntities.id} = ANY(${[...relatedIds]})`);

    // Build node list and index map
    const nodes = relatedEntities.map((e) => ({ name: e.name }));
    const idToIndex = new Map<string, number>();
    relatedEntities.forEach((e, idx) => {
      idToIndex.set(e.id, idx);
    });

    // Build links in D3-Sankey format
    const links = allRels
      .filter((rel) => idToIndex.has(rel.sourceEntityId) && idToIndex.has(rel.targetEntityId))
      .map((rel) => {
        const attrs = (rel.attributes as Record<string, unknown>) || {};
        return {
          source: idToIndex.get(rel.sourceEntityId)!,
          target: idToIndex.get(rel.targetEntityId)!,
          value: (attrs.amount as number) || rel.strength || 1,
          type: rel.type,
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
