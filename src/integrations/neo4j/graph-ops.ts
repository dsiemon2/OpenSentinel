/**
 * Graph CRUD Operations (Neo4j + Postgres dual-write)
 *
 * Every mutation writes to both Postgres (source of truth) and Neo4j
 * (optimised for traversal queries). Read operations pick the store
 * that best fits the access pattern: Postgres for exact lookups, Neo4j
 * for path / neighbourhood / fulltext queries.
 */

import { eq, ilike } from "drizzle-orm";
import {
  db,
  graphEntities,
  graphRelationships,
  type NewGraphEntity,
  type NewGraphRelationship,
} from "../../db";
import { getNeo4jClient } from "./client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType =
  | "person"
  | "organization"
  | "committee"
  | "contract"
  | "filing"
  | "location"
  | "topic";

export interface GraphEntity {
  id?: string;
  pgId?: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  description?: string;
  attributes?: Record<string, unknown>;
  importance?: number;
  source?: string;
}

export interface GraphRelationship {
  id?: string;
  sourceId: string; // pgId of source entity
  targetId: string; // pgId of target entity
  type: string;
  strength?: number;
  attributes?: Record<string, unknown>;
  context?: string;
  source?: string;
}

export interface NeighborNode {
  pgId: string;
  name: string;
  type: string;
  importance: number;
}

export interface NeighborEdge {
  sourcePgId: string;
  targetPgId: string;
  type: string;
  strength: number;
}

export interface NeighborResult {
  nodes: NeighborNode[];
  edges: NeighborEdge[];
}

export interface PathResult {
  nodes: NeighborNode[];
  edges: NeighborEdge[];
  length: number;
}

export interface Community {
  id: number;
  members: NeighborNode[];
}

// ---------------------------------------------------------------------------
// Entity CRUD
// ---------------------------------------------------------------------------

/**
 * Create an entity in both Postgres and Neo4j.
 * Returns the Postgres UUID (pgId).
 */
export async function createEntity(entity: GraphEntity): Promise<string> {
  // 1. Insert into Postgres
  const [row] = await db
    .insert(graphEntities)
    .values({
      type: entity.type,
      name: entity.name,
      aliases: entity.aliases ?? [],
      description: entity.description ?? null,
      attributes: entity.attributes ?? {},
      importance: entity.importance ?? 50,
      mentionCount: 1,
    } as NewGraphEntity)
    .returning({ id: graphEntities.id });

  const pgId = row.id;

  // 2. Create in Neo4j
  try {
    const client = getNeo4jClient();
    await client.runWrite(
      `
      CREATE (e:Entity {
        pgId:        $pgId,
        type:        $type,
        name:        $name,
        aliases:     $aliases,
        description: $description,
        importance:  $importance,
        source:      $source
      })
      `,
      {
        pgId,
        type: entity.type,
        name: entity.name,
        aliases: entity.aliases ?? [],
        description: entity.description ?? "",
        importance: entity.importance ?? 50,
        source: entity.source ?? "",
      },
    );
  } catch (err) {
    console.log("[Neo4j] Failed to create entity in Neo4j (Postgres row exists):", err);
  }

  return pgId;
}

/**
 * Update an entity in both stores.
 */
export async function updateEntity(
  pgId: string,
  updates: Partial<Omit<GraphEntity, "id" | "pgId">>,
): Promise<void> {
  // 1. Update Postgres
  const pgUpdates: Record<string, unknown> = {};
  if (updates.type !== undefined) pgUpdates.type = updates.type;
  if (updates.name !== undefined) pgUpdates.name = updates.name;
  if (updates.aliases !== undefined) pgUpdates.aliases = updates.aliases;
  if (updates.description !== undefined) pgUpdates.description = updates.description;
  if (updates.attributes !== undefined) pgUpdates.attributes = updates.attributes;
  if (updates.importance !== undefined) pgUpdates.importance = updates.importance;

  if (Object.keys(pgUpdates).length > 0) {
    await db
      .update(graphEntities)
      .set(pgUpdates as any)
      .where(eq(graphEntities.id, pgId));
  }

  // 2. Update Neo4j
  try {
    const client = getNeo4jClient();
    const setClauses: string[] = [];
    const params: Record<string, unknown> = { pgId };

    if (updates.type !== undefined) {
      setClauses.push("e.type = $type");
      params.type = updates.type;
    }
    if (updates.name !== undefined) {
      setClauses.push("e.name = $name");
      params.name = updates.name;
    }
    if (updates.aliases !== undefined) {
      setClauses.push("e.aliases = $aliases");
      params.aliases = updates.aliases;
    }
    if (updates.description !== undefined) {
      setClauses.push("e.description = $description");
      params.description = updates.description;
    }
    if (updates.attributes !== undefined) {
      setClauses.push("e.attributes = $attributes");
      params.attributes = JSON.stringify(updates.attributes);
    }
    if (updates.importance !== undefined) {
      setClauses.push("e.importance = $importance");
      params.importance = updates.importance;
    }

    if (setClauses.length > 0) {
      await client.runWrite(
        `MATCH (e:Entity {pgId: $pgId}) SET ${setClauses.join(", ")}`,
        params,
      );
    }
  } catch (err) {
    console.log("[Neo4j] Failed to update entity in Neo4j:", err);
  }
}

/**
 * Delete an entity from both stores. Uses DETACH DELETE in Neo4j to
 * automatically remove connected relationships.
 */
export async function deleteEntity(pgId: string): Promise<void> {
  // 1. Delete from Postgres (cascade handles relationships via FK)
  await db.delete(graphEntities).where(eq(graphEntities.id, pgId));

  // 2. Detach-delete from Neo4j
  try {
    const client = getNeo4jClient();
    await client.runWrite(
      "MATCH (e:Entity {pgId: $pgId}) DETACH DELETE e",
      { pgId },
    );
  } catch (err) {
    console.log("[Neo4j] Failed to delete entity in Neo4j:", err);
  }
}

/**
 * Find entities by name. When `fuzzy` is true, leverages the Neo4j fulltext
 * index for approximate matching; otherwise performs an exact (case-insensitive)
 * lookup in Postgres.
 */
export async function findEntitiesByName(
  name: string,
  fuzzy = false,
): Promise<GraphEntity[]> {
  if (fuzzy) {
    try {
      const client = getNeo4jClient();
      // Escape special Lucene characters and append ~ for fuzzy
      const safeName = name.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
      const result = await client.runQuery(
        `
        CALL db.index.fulltext.queryNodes("entity_fulltext", $query)
        YIELD node, score
        RETURN node.pgId   AS pgId,
               node.type   AS type,
               node.name   AS name,
               node.aliases      AS aliases,
               node.description  AS description,
               node.importance   AS importance,
               node.source       AS source,
               score
        ORDER BY score DESC
        LIMIT 25
        `,
        { query: `${safeName}~` },
      );

      return result.records.map((r) => ({
        pgId: r.get("pgId") as string,
        type: r.get("type") as EntityType,
        name: r.get("name") as string,
        aliases: r.get("aliases") as string[] | undefined,
        description: r.get("description") as string | undefined,
        importance: typeof r.get("importance") === "number"
          ? (r.get("importance") as number)
          : undefined,
        source: r.get("source") as string | undefined,
      }));
    } catch (err) {
      console.log("[Neo4j] Fulltext search failed, falling back to Postgres:", err);
      // Fall through to Postgres path below
    }
  }

  // Exact / ilike match in Postgres
  const rows = await db
    .select()
    .from(graphEntities)
    .where(ilike(graphEntities.name, `%${name}%`))
    .limit(25);

  return rows.map((r) => ({
    pgId: r.id,
    type: r.type as EntityType,
    name: r.name,
    aliases: (r.aliases as string[]) ?? [],
    description: r.description ?? undefined,
    attributes: (r.attributes as Record<string, unknown>) ?? {},
    importance: r.importance ?? 50,
  }));
}

// ---------------------------------------------------------------------------
// Relationship CRUD
// ---------------------------------------------------------------------------

/**
 * Create a relationship in both Postgres and Neo4j.
 * Returns the Postgres UUID.
 */
export async function createRelationship(
  sourceId: string,
  targetId: string,
  type: string,
  attrs?: {
    strength?: number;
    bidirectional?: boolean;
    context?: string;
    attributes?: Record<string, unknown>;
    source?: string;
  },
): Promise<string> {
  // 1. Insert into Postgres
  const [row] = await db
    .insert(graphRelationships)
    .values({
      sourceEntityId: sourceId,
      targetEntityId: targetId,
      type: type,
      strength: attrs?.strength ?? 50,
      bidirectional: attrs?.bidirectional ?? false,
      context: attrs?.context ?? null,
      attributes: attrs?.attributes ?? {},
    } as NewGraphRelationship)
    .returning({ id: graphRelationships.id });

  const pgId = row.id;

  // 2. Create in Neo4j
  try {
    const client = getNeo4jClient();
    await client.runWrite(
      `
      MATCH (a:Entity {pgId: $sourceId}), (b:Entity {pgId: $targetId})
      CREATE (a)-[r:RELATES_TO {
        pgId:     $pgId,
        type:     $type,
        strength: $strength,
        context:  $context,
        source:   $source
      }]->(b)
      `,
      {
        sourceId,
        targetId,
        pgId,
        type,
        strength: attrs?.strength ?? 50,
        context: attrs?.context ?? "",
        source: attrs?.source ?? "",
      },
    );
  } catch (err) {
    console.log("[Neo4j] Failed to create relationship in Neo4j:", err);
  }

  return pgId;
}

/**
 * Delete a relationship from both stores.
 */
export async function deleteRelationship(pgId: string): Promise<void> {
  // 1. Delete from Postgres
  await db.delete(graphRelationships).where(eq(graphRelationships.id, pgId));

  // 2. Delete from Neo4j
  try {
    const client = getNeo4jClient();
    await client.runWrite(
      "MATCH ()-[r:RELATES_TO {pgId: $pgId}]->() DELETE r",
      { pgId },
    );
  } catch (err) {
    console.log("[Neo4j] Failed to delete relationship in Neo4j:", err);
  }
}

// ---------------------------------------------------------------------------
// Graph traversal (Neo4j-only)
// ---------------------------------------------------------------------------

/**
 * Return the neighbourhood of an entity up to `depth` hops away.
 */
export async function getNeighbors(
  entityPgId: string,
  depth = 2,
): Promise<NeighborResult> {
  const client = getNeo4jClient();

  try {
    const result = await client.runQuery(
      `
      MATCH path = (start:Entity {pgId: $pgId})-[*1..${Math.min(depth, 10)}]-(neighbor:Entity)
      WITH DISTINCT neighbor, relationships(path) AS rels, nodes(path) AS ns
      UNWIND rels AS rel
      WITH COLLECT(DISTINCT {
        pgId:       neighbor.pgId,
        name:       neighbor.name,
        type:       neighbor.type,
        importance: neighbor.importance
      }) AS nodeList,
      COLLECT(DISTINCT {
        sourcePgId: startNode(rel).pgId,
        targetPgId: endNode(rel).pgId,
        type:       rel.type,
        strength:   rel.strength
      }) AS edgeList
      RETURN nodeList, edgeList
      `,
      { pgId: entityPgId },
    );

    if (result.records.length === 0) {
      return { nodes: [], edges: [] };
    }

    const record = result.records[0];
    const nodes = (record.get("nodeList") as NeighborNode[]) ?? [];
    const edges = (record.get("edgeList") as NeighborEdge[]) ?? [];

    return { nodes, edges };
  } catch (err) {
    console.log("[Neo4j] getNeighbors failed:", err);
    return { nodes: [], edges: [] };
  }
}

/**
 * Find the shortest path between two entities.
 */
export async function findShortestPath(
  sourcePgId: string,
  targetPgId: string,
): Promise<PathResult | null> {
  const client = getNeo4jClient();

  try {
    const result = await client.runQuery(
      `
      MATCH (a:Entity {pgId: $sourcePgId}), (b:Entity {pgId: $targetPgId}),
            path = shortestPath((a)-[*..15]-(b))
      WITH nodes(path) AS ns, relationships(path) AS rels, length(path) AS pathLen
      RETURN
        [n IN ns | {pgId: n.pgId, name: n.name, type: n.type, importance: n.importance}] AS nodes,
        [r IN rels | {sourcePgId: startNode(r).pgId, targetPgId: endNode(r).pgId, type: r.type, strength: r.strength}] AS edges,
        pathLen
      `,
      { sourcePgId, targetPgId },
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      nodes: record.get("nodes") as NeighborNode[],
      edges: record.get("edges") as NeighborEdge[],
      length: typeof record.get("pathLen") === "object"
        ? (record.get("pathLen") as any).toNumber()
        : (record.get("pathLen") as number),
    };
  } catch (err) {
    console.log("[Neo4j] findShortestPath failed:", err);
    return null;
  }
}

/**
 * Group entities into connected components (communities).
 * Uses a simple BFS-style approach via Neo4j's connected-component pattern.
 */
export async function getCommunities(): Promise<Community[]> {
  const client = getNeo4jClient();

  try {
    const result = await client.runQuery(
      `
      MATCH (e:Entity)
      WITH collect(e) AS allNodes
      UNWIND allNodes AS node
      MATCH path = (node)-[*0..]-(connected:Entity)
      WITH node, collect(DISTINCT connected) AS component
      WITH component, component[0].pgId AS componentId
      ORDER BY size(component) DESC
      WITH DISTINCT componentId,
           [m IN component | {pgId: m.pgId, name: m.name, type: m.type, importance: m.importance}] AS members
      RETURN componentId, members
      LIMIT 100
      `,
    );

    return result.records.map((r, idx) => ({
      id: idx,
      members: r.get("members") as NeighborNode[],
    }));
  } catch (err) {
    console.log("[Neo4j] getCommunities failed:", err);
    return [];
  }
}

/**
 * Run an arbitrary **read-only** Cypher query. Useful for ad-hoc analytics
 * without having to write a dedicated function.
 */
export async function runCustomCypher(
  cypher: string,
  params?: Record<string, unknown>,
): Promise<Record<string, unknown>[]> {
  const client = getNeo4jClient();

  try {
    const result = await client.runQuery(cypher, params);
    return result.records.map((r) => r.toObject() as Record<string, unknown>);
  } catch (err) {
    console.log("[Neo4j] Custom Cypher failed:", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Bulk sync from Postgres
// ---------------------------------------------------------------------------

/**
 * Bulk-sync all graph entities and relationships for a given user from
 * Postgres into Neo4j. Existing Neo4j nodes/edges are merged (MERGE) so
 * this is safe to re-run.
 */
export async function syncFromPostgres(userId: string): Promise<{
  entitiesSynced: number;
  relationshipsSynced: number;
}> {
  const client = getNeo4jClient();

  // 1. Load all entities for this user from Postgres
  const entities = await db
    .select()
    .from(graphEntities)
    .where(eq(graphEntities.userId, userId));

  let entitiesSynced = 0;

  for (const entity of entities) {
    try {
      await client.runWrite(
        `
        MERGE (e:Entity {pgId: $pgId})
        SET e.type        = $type,
            e.name        = $name,
            e.aliases     = $aliases,
            e.description = $description,
            e.importance  = $importance
        `,
        {
          pgId: entity.id,
          type: entity.type,
          name: entity.name,
          aliases: (entity.aliases as string[]) ?? [],
          description: entity.description ?? "",
          importance: entity.importance ?? 50,
        },
      );
      entitiesSynced++;
    } catch (err) {
      console.log("[Neo4j] Sync entity failed:", entity.id, err);
    }
  }

  // 2. Load all relationships that connect those entities
  const entityIds = entities.map((e) => e.id);
  let relationshipsSynced = 0;

  if (entityIds.length > 0) {
    // Fetch relationships where both ends belong to this user's entity set
    const allRels = await db.select().from(graphRelationships);
    const entityIdSet = new Set(entityIds);
    const userRels = allRels.filter(
      (r) => entityIdSet.has(r.sourceEntityId) && entityIdSet.has(r.targetEntityId),
    );

    for (const rel of userRels) {
      try {
        await client.runWrite(
          `
          MATCH (a:Entity {pgId: $sourceId}), (b:Entity {pgId: $targetId})
          MERGE (a)-[r:RELATES_TO {pgId: $pgId}]->(b)
          SET r.type     = $type,
              r.strength = $strength,
              r.context  = $context
          `,
          {
            sourceId: rel.sourceEntityId,
            targetId: rel.targetEntityId,
            pgId: rel.id,
            type: rel.type,
            strength: rel.strength ?? 50,
            context: rel.context ?? "",
          },
        );
        relationshipsSynced++;
      } catch (err) {
        console.log("[Neo4j] Sync relationship failed:", rel.id, err);
      }
    }
  }

  console.log(
    `[Neo4j] Sync complete for user ${userId}: ${entitiesSynced} entities, ${relationshipsSynced} relationships`,
  );

  return { entitiesSynced, relationshipsSynced };
}
