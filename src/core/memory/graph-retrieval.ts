/**
 * Graph-Augmented Retrieval — Entity extraction, BFS traversal, query augmentation
 *
 * Uses the graphEntities and graphRelationships tables for
 * knowledge graph-based memory retrieval.
 */

import { db } from "../../db";
import { graphEntities, graphRelationships } from "../../db/schema";
import { eq, ilike, sql } from "drizzle-orm";
import type { EntityType, RelationType } from "../intelligence/relationship-graph";

export interface GraphEntity {
  id: string;
  userId: string | null;
  type: string;
  name: string;
  aliases: string[];
  description: string | null;
  importance: number;
  mentionCount: number;
}

export interface GraphRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  strength: number;
  bidirectional: boolean;
  context: string | null;
}

/**
 * Find an entity by name (case-insensitive)
 */
export async function findEntityByName(
  name: string,
  userId?: string
): Promise<GraphEntity | null> {
  const results = await db
    .select()
    .from(graphEntities)
    .where(
      userId
        ? sql`LOWER(name) = LOWER(${name}) AND user_id = ${userId}`
        : sql`LOWER(name) = LOWER(${name})`
    )
    .limit(1);

  return (results[0] as any) || null;
}

/**
 * Search entities by partial name match
 */
export async function searchEntities(
  query: string,
  userId?: string,
  limit = 10
): Promise<GraphEntity[]> {
  const results = await db
    .select()
    .from(graphEntities)
    .where(
      userId
        ? sql`name ILIKE ${'%' + query + '%'} AND user_id = ${userId}`
        : sql`name ILIKE ${'%' + query + '%'}`
    )
    .orderBy(sql`importance DESC`)
    .limit(limit);

  return results as any[];
}

/**
 * Find related entities using BFS traversal
 */
export async function findRelatedEntities(
  entityId: string,
  depth = 2,
  limit = 20
): Promise<Array<{ entity: GraphEntity; relationship: GraphRelationship; hops: number }>> {
  const visited = new Set<string>();
  const results: Array<{ entity: GraphEntity; relationship: GraphRelationship; hops: number }> = [];
  let currentLevel = [entityId];

  for (let hop = 1; hop <= depth && results.length < limit; hop++) {
    if (currentLevel.length === 0) break;

    const nextLevel: string[] = [];

    for (const sourceId of currentLevel) {
      if (visited.has(sourceId)) continue;
      visited.add(sourceId);

      // Find outgoing relationships
      const outgoing = await db.execute(sql`
        SELECT r.*, e.id as entity_id, e.name, e.type as entity_type,
               e.aliases, e.description, e.importance, e.mention_count
        FROM graph_relationships r
        JOIN graph_entities e ON r.target_entity_id = e.id
        WHERE r.source_entity_id = ${sourceId}
        LIMIT ${limit - results.length}
      `);

      // Find incoming bidirectional relationships
      const incoming = await db.execute(sql`
        SELECT r.*, e.id as entity_id, e.name, e.type as entity_type,
               e.aliases, e.description, e.importance, e.mention_count
        FROM graph_relationships r
        JOIN graph_entities e ON r.source_entity_id = e.id
        WHERE r.target_entity_id = ${sourceId}
          AND r.bidirectional = true
        LIMIT ${limit - results.length}
      `);

      for (const row of [...(outgoing as any[]), ...(incoming as any[])]) {
        const targetId = row.entity_id;
        if (visited.has(targetId)) continue;

        results.push({
          entity: {
            id: row.entity_id,
            userId: row.user_id,
            type: row.entity_type,
            name: row.name,
            aliases: row.aliases || [],
            description: row.description,
            importance: row.importance || 50,
            mentionCount: row.mention_count || 1,
          },
          relationship: {
            id: row.id,
            sourceEntityId: row.source_entity_id,
            targetEntityId: row.target_entity_id,
            type: row.type,
            strength: row.strength || 50,
            bidirectional: row.bidirectional || false,
            context: row.context,
          },
          hops: hop,
        });

        nextLevel.push(targetId);
      }
    }

    currentLevel = nextLevel;
  }

  return results.slice(0, limit);
}

/**
 * Augment a query with related entity names for better recall
 */
export async function augmentQueryWithGraph(
  query: string,
  userId?: string
): Promise<string> {
  // Find entities mentioned in the query
  const entities = await searchEntities(query, userId, 3);

  if (entities.length === 0) return query;

  // Get related entities for each found entity
  const relatedNames: string[] = [];
  for (const entity of entities) {
    const related = await findRelatedEntities(entity.id, 1, 5);
    for (const r of related) {
      if (!relatedNames.includes(r.entity.name)) {
        relatedNames.push(r.entity.name);
      }
    }
  }

  if (relatedNames.length === 0) return query;

  // Append related entity names to the query
  return `${query} (related: ${relatedNames.join(", ")})`;
}

/**
 * Add an entity to the graph (database-backed)
 */
export async function addGraphEntity(
  entity: {
    userId?: string;
    type: string;
    name: string;
    aliases?: string[];
    description?: string;
    attributes?: Record<string, unknown>;
    importance?: number;
  }
): Promise<GraphEntity> {
  const [result] = await db
    .insert(graphEntities)
    .values({
      userId: entity.userId,
      type: entity.type as any,
      name: entity.name,
      aliases: entity.aliases || [],
      description: entity.description,
      attributes: entity.attributes || {},
      importance: entity.importance || 50,
      mentionCount: 1,
    })
    .returning();

  return result as any;
}

/**
 * Add a relationship to the graph (database-backed)
 */
export async function addGraphRelationship(
  relationship: {
    sourceEntityId: string;
    targetEntityId: string;
    type: string;
    strength?: number;
    bidirectional?: boolean;
    context?: string;
    attributes?: Record<string, unknown>;
  }
): Promise<GraphRelationship> {
  const [result] = await db
    .insert(graphRelationships)
    .values({
      sourceEntityId: relationship.sourceEntityId,
      targetEntityId: relationship.targetEntityId,
      type: relationship.type as any,
      strength: relationship.strength || 50,
      bidirectional: relationship.bidirectional || false,
      context: relationship.context,
      attributes: relationship.attributes || {},
    })
    .returning();

  return result as any;
}

/**
 * Get entity count for a user
 */
export async function getEntityCount(userId?: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM graph_entities
    ${userId ? sql`WHERE user_id = ${userId}` : sql``}
  `);
  return Number((result as any[])[0]?.count || 0);
}

/**
 * Get relationship count
 */
export async function getRelationshipCount(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM graph_relationships
  `);
  return Number((result as any[])[0]?.count || 0);
}
