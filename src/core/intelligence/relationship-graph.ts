/**
 * Relationship Graph System
 *
 * Tracks and manages relationships between entities:
 * - People (contacts, colleagues, family)
 * - Projects (work, personal)
 * - Topics (interests, knowledge areas)
 * - Events (meetings, deadlines, milestones)
 *
 * Enables the AI to understand context and connections.
 */

import { db } from "../../db";
import { memories, conversations, messages } from "../../db/schema";
import { eq, and, gte, desc, sql, ilike } from "drizzle-orm";
import OpenAI from "openai";
import { env } from "../../config/env";
import { generateEmbedding } from "../memory";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Entity types in the relationship graph
export type EntityType = "person" | "project" | "topic" | "event" | "organization" | "location";

// Relationship types between entities
export type RelationType =
  | "knows"
  | "works_with"
  | "works_on"
  | "family"
  | "friend"
  | "colleague"
  | "manages"
  | "reports_to"
  | "belongs_to"
  | "related_to"
  | "located_in"
  | "interested_in"
  | "expert_in"
  | "mentioned_in"
  | "participates_in";

// Entity in the relationship graph
export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description?: string;
  attributes: Record<string, unknown>;
  importance: number; // 0-100
  lastMentioned?: Date;
  mentionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Relationship between entities
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number; // 0-100
  bidirectional: boolean;
  context?: string;
  attributes: Record<string, unknown>;
  lastUpdated: Date;
  createdAt: Date;
}

// Graph query result
export interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  paths: Array<{
    from: Entity;
    to: Entity;
    path: Array<{ entity: Entity; relationship: Relationship }>;
  }>;
}

// In-memory cache for faster queries (would be replaced with Redis in production)
const entityCache = new Map<string, Entity>();
const relationshipCache = new Map<string, Relationship>();

// Storage for entities and relationships (in production, use dedicated tables)
let entityStore: Map<string, Entity[]> = new Map();
let relationshipStore: Map<string, Relationship[]> = new Map();

/**
 * Initialize or get user's relationship graph
 */
export async function getOrCreateGraph(userId: string): Promise<{
  entities: Entity[];
  relationships: Relationship[];
}> {
  if (!entityStore.has(userId)) {
    entityStore.set(userId, []);
    relationshipStore.set(userId, []);

    // Try to load from memories
    await loadGraphFromMemories(userId);
  }

  return {
    entities: entityStore.get(userId) || [],
    relationships: relationshipStore.get(userId) || [],
  };
}

/**
 * Add or update an entity in the graph
 */
export async function upsertEntity(
  userId: string,
  entity: Omit<Entity, "id" | "createdAt" | "updatedAt" | "mentionCount">
): Promise<Entity> {
  const graph = await getOrCreateGraph(userId);

  // Check for existing entity by name or alias
  const existing = graph.entities.find(
    (e) =>
      e.type === entity.type &&
      (e.name.toLowerCase() === entity.name.toLowerCase() ||
        e.aliases.some((a) => a.toLowerCase() === entity.name.toLowerCase()) ||
        entity.aliases.some((a) => a.toLowerCase() === e.name.toLowerCase()))
  );

  if (existing) {
    // Update existing entity
    const updated: Entity = {
      ...existing,
      description: entity.description || existing.description,
      attributes: { ...existing.attributes, ...entity.attributes },
      aliases: [...new Set([...existing.aliases, ...entity.aliases])],
      importance: Math.max(existing.importance, entity.importance),
      lastMentioned: new Date(),
      mentionCount: existing.mentionCount + 1,
      updatedAt: new Date(),
    };

    const entities = entityStore.get(userId) || [];
    const index = entities.findIndex((e) => e.id === existing.id);
    if (index >= 0) {
      entities[index] = updated;
    }

    entityCache.set(`${userId}:${updated.id}`, updated);
    await persistGraphToMemory(userId, updated, "entity_updated");

    return updated;
  }

  // Create new entity
  const newEntity: Entity = {
    id: generateEntityId(),
    ...entity,
    mentionCount: 1,
    lastMentioned: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const entities = entityStore.get(userId) || [];
  entities.push(newEntity);
  entityStore.set(userId, entities);

  entityCache.set(`${userId}:${newEntity.id}`, newEntity);
  await persistGraphToMemory(userId, newEntity, "entity_created");

  return newEntity;
}

/**
 * Add or update a relationship between entities
 */
export async function upsertRelationship(
  userId: string,
  relationship: Omit<Relationship, "id" | "createdAt" | "lastUpdated">
): Promise<Relationship> {
  const graph = await getOrCreateGraph(userId);

  // Check for existing relationship
  const existing = graph.relationships.find(
    (r) =>
      r.sourceId === relationship.sourceId &&
      r.targetId === relationship.targetId &&
      r.type === relationship.type
  );

  if (existing) {
    // Update existing relationship
    const updated: Relationship = {
      ...existing,
      strength: Math.min(100, existing.strength + 5),
      context: relationship.context || existing.context,
      attributes: { ...existing.attributes, ...relationship.attributes },
      lastUpdated: new Date(),
    };

    const relationships = relationshipStore.get(userId) || [];
    const index = relationships.findIndex((r) => r.id === existing.id);
    if (index >= 0) {
      relationships[index] = updated;
    }

    relationshipCache.set(`${userId}:${updated.id}`, updated);
    return updated;
  }

  // Create new relationship
  const newRelationship: Relationship = {
    id: generateEntityId(),
    ...relationship,
    createdAt: new Date(),
    lastUpdated: new Date(),
  };

  const relationships = relationshipStore.get(userId) || [];
  relationships.push(newRelationship);
  relationshipStore.set(userId, relationships);

  relationshipCache.set(`${userId}:${newRelationship.id}`, newRelationship);

  // If bidirectional, create reverse relationship
  if (relationship.bidirectional) {
    const reverseType = getReverseRelationType(relationship.type);
    const reverse: Relationship = {
      id: generateEntityId(),
      sourceId: relationship.targetId,
      targetId: relationship.sourceId,
      type: reverseType,
      strength: relationship.strength,
      bidirectional: true,
      context: relationship.context,
      attributes: relationship.attributes,
      createdAt: new Date(),
      lastUpdated: new Date(),
    };
    relationships.push(reverse);
    relationshipCache.set(`${userId}:${reverse.id}`, reverse);
  }

  return newRelationship;
}

/**
 * Find entity by name or alias
 */
export async function findEntity(
  userId: string,
  name: string,
  type?: EntityType
): Promise<Entity | null> {
  const graph = await getOrCreateGraph(userId);
  const nameLower = name.toLowerCase();

  return (
    graph.entities.find(
      (e) =>
        (!type || e.type === type) &&
        (e.name.toLowerCase() === nameLower ||
          e.aliases.some((a) => a.toLowerCase() === nameLower))
    ) || null
  );
}

/**
 * Get all entities of a specific type
 */
export async function getEntitiesByType(
  userId: string,
  type: EntityType
): Promise<Entity[]> {
  const graph = await getOrCreateGraph(userId);
  return graph.entities
    .filter((e) => e.type === type)
    .sort((a, b) => b.importance - a.importance);
}

/**
 * Get relationships for an entity
 */
export async function getEntityRelationships(
  userId: string,
  entityId: string
): Promise<{
  outgoing: Array<{ relationship: Relationship; entity: Entity }>;
  incoming: Array<{ relationship: Relationship; entity: Entity }>;
}> {
  const graph = await getOrCreateGraph(userId);

  const outgoing = graph.relationships
    .filter((r) => r.sourceId === entityId)
    .map((r) => ({
      relationship: r,
      entity: graph.entities.find((e) => e.id === r.targetId)!,
    }))
    .filter((r) => r.entity);

  const incoming = graph.relationships
    .filter((r) => r.targetId === entityId)
    .map((r) => ({
      relationship: r,
      entity: graph.entities.find((e) => e.id === r.sourceId)!,
    }))
    .filter((r) => r.entity);

  return { outgoing, incoming };
}

/**
 * Find path between two entities
 */
export async function findPath(
  userId: string,
  fromId: string,
  toId: string,
  maxDepth = 4
): Promise<Array<{ entity: Entity; relationship?: Relationship }>> {
  const graph = await getOrCreateGraph(userId);

  // BFS to find shortest path
  const queue: Array<{
    entityId: string;
    path: Array<{ entity: Entity; relationship?: Relationship }>;
  }> = [
    {
      entityId: fromId,
      path: [{ entity: graph.entities.find((e) => e.id === fromId)! }],
    },
  ];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.entityId === toId) {
      return current.path;
    }

    if (current.path.length > maxDepth) {
      continue;
    }

    // Get outgoing relationships
    const outgoing = graph.relationships.filter(
      (r) => r.sourceId === current.entityId
    );

    for (const rel of outgoing) {
      if (!visited.has(rel.targetId)) {
        visited.add(rel.targetId);
        const targetEntity = graph.entities.find((e) => e.id === rel.targetId);
        if (targetEntity) {
          queue.push({
            entityId: rel.targetId,
            path: [...current.path, { entity: targetEntity, relationship: rel }],
          });
        }
      }
    }
  }

  return []; // No path found
}

/**
 * Extract entities and relationships from text using AI
 */
export async function extractFromText(
  userId: string,
  text: string,
  context?: string
): Promise<{
  entities: Entity[];
  relationships: Relationship[];
}> {
  try {
    const prompt = `Analyze this text and extract entities and relationships.

Text: "${text}"
${context ? `Context: ${context}` : ""}

Extract:
1. People (names, roles, descriptions)
2. Projects (names, descriptions)
3. Organizations (companies, teams)
4. Topics (subjects, areas of interest)
5. Locations (places mentioned)
6. Relationships between entities

Return JSON:
{
  "entities": [
    {
      "type": "person|project|topic|organization|location|event",
      "name": "entity name",
      "aliases": ["other names"],
      "description": "brief description",
      "attributes": { "role": "...", "other": "..." },
      "importance": 0-100
    }
  ],
  "relationships": [
    {
      "source": "entity name",
      "target": "entity name",
      "type": "knows|works_with|works_on|manages|reports_to|belongs_to|related_to|interested_in|expert_in",
      "strength": 0-100,
      "bidirectional": true/false,
      "context": "brief context"
    }
  ]
}

Only return the JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const extractedEntities: Entity[] = [];
    const extractedRelationships: Relationship[] = [];

    // Process entities
    for (const e of result.entities || []) {
      if (e.name && e.type) {
        const entity = await upsertEntity(userId, {
          type: e.type as EntityType,
          name: e.name,
          aliases: e.aliases || [],
          description: e.description,
          attributes: e.attributes || {},
          importance: e.importance || 50,
        });
        extractedEntities.push(entity);
      }
    }

    // Process relationships
    for (const r of result.relationships || []) {
      if (r.source && r.target && r.type) {
        const sourceEntity = await findEntity(userId, r.source);
        const targetEntity = await findEntity(userId, r.target);

        if (sourceEntity && targetEntity) {
          const relationship = await upsertRelationship(userId, {
            sourceId: sourceEntity.id,
            targetId: targetEntity.id,
            type: r.type as RelationType,
            strength: r.strength || 50,
            bidirectional: r.bidirectional || false,
            context: r.context,
            attributes: {},
          });
          extractedRelationships.push(relationship);
        }
      }
    }

    return {
      entities: extractedEntities,
      relationships: extractedRelationships,
    };
  } catch (error) {
    console.error("Error extracting from text:", error);
    return { entities: [], relationships: [] };
  }
}

/**
 * Query the graph with natural language
 */
export async function queryGraph(
  userId: string,
  query: string
): Promise<GraphQueryResult> {
  const graph = await getOrCreateGraph(userId);

  try {
    const prompt = `Given this query and knowledge graph, determine what information is being requested.

Query: "${query}"

Available entity types: person, project, topic, organization, location, event
Available relationship types: knows, works_with, works_on, manages, reports_to, belongs_to, related_to, interested_in, expert_in

Return JSON with search criteria:
{
  "entitySearches": [
    { "type": "person|project|...", "namePattern": "search pattern", "attributes": {} }
  ],
  "relationshipSearches": [
    { "sourceType": "...", "targetType": "...", "relationType": "..." }
  ],
  "pathSearches": [
    { "fromName": "entity name", "toName": "entity name" }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const criteria = JSON.parse(response.choices[0].message.content || "{}");
    const resultEntities: Entity[] = [];
    const resultRelationships: Relationship[] = [];
    const resultPaths: GraphQueryResult["paths"] = [];

    // Execute entity searches
    for (const search of criteria.entitySearches || []) {
      const matches = graph.entities.filter((e) => {
        if (search.type && e.type !== search.type) return false;
        if (search.namePattern) {
          const pattern = search.namePattern.toLowerCase();
          if (
            !e.name.toLowerCase().includes(pattern) &&
            !e.aliases.some((a) => a.toLowerCase().includes(pattern))
          ) {
            return false;
          }
        }
        return true;
      });
      resultEntities.push(...matches);
    }

    // Execute relationship searches
    for (const search of criteria.relationshipSearches || []) {
      const matches = graph.relationships.filter((r) => {
        if (search.relationType && r.type !== search.relationType) return false;
        if (search.sourceType) {
          const source = graph.entities.find((e) => e.id === r.sourceId);
          if (!source || source.type !== search.sourceType) return false;
        }
        if (search.targetType) {
          const target = graph.entities.find((e) => e.id === r.targetId);
          if (!target || target.type !== search.targetType) return false;
        }
        return true;
      });
      resultRelationships.push(...matches);

      // Add related entities
      for (const rel of matches) {
        const source = graph.entities.find((e) => e.id === rel.sourceId);
        const target = graph.entities.find((e) => e.id === rel.targetId);
        if (source && !resultEntities.includes(source)) resultEntities.push(source);
        if (target && !resultEntities.includes(target)) resultEntities.push(target);
      }
    }

    // Execute path searches
    for (const search of criteria.pathSearches || []) {
      const fromEntity = await findEntity(userId, search.fromName);
      const toEntity = await findEntity(userId, search.toName);

      if (fromEntity && toEntity) {
        const path = await findPath(userId, fromEntity.id, toEntity.id);
        if (path.length > 0) {
          resultPaths.push({
            from: fromEntity,
            to: toEntity,
            path: path.slice(1).map((p) => ({
              entity: p.entity,
              relationship: p.relationship!,
            })),
          });
        }
      }
    }

    return {
      entities: [...new Set(resultEntities)],
      relationships: [...new Set(resultRelationships)],
      paths: resultPaths,
    };
  } catch (error) {
    console.error("Error querying graph:", error);
    return { entities: [], relationships: [], paths: [] };
  }
}

/**
 * Generate context string from relevant graph data
 */
export async function buildGraphContext(
  userId: string,
  query: string
): Promise<string> {
  const result = await queryGraph(userId, query);

  if (result.entities.length === 0 && result.relationships.length === 0) {
    return "";
  }

  let context = "\n\nRelevant knowledge from your relationship graph:";

  // Add entity information
  if (result.entities.length > 0) {
    context += "\n\nEntities:";
    for (const entity of result.entities.slice(0, 10)) {
      context += `\n- ${entity.type}: ${entity.name}`;
      if (entity.description) context += ` (${entity.description})`;
    }
  }

  // Add relationship information
  if (result.relationships.length > 0) {
    context += "\n\nRelationships:";
    const graph = await getOrCreateGraph(userId);
    for (const rel of result.relationships.slice(0, 10)) {
      const source = graph.entities.find((e) => e.id === rel.sourceId);
      const target = graph.entities.find((e) => e.id === rel.targetId);
      if (source && target) {
        context += `\n- ${source.name} ${formatRelationType(rel.type)} ${target.name}`;
      }
    }
  }

  // Add path information
  if (result.paths.length > 0) {
    context += "\n\nConnections:";
    for (const path of result.paths) {
      const pathStr = [path.from.name, ...path.path.map((p) => p.entity.name)].join(
        " -> "
      );
      context += `\n- ${pathStr}`;
    }
  }

  return context;
}

/**
 * Get statistics about the graph
 */
export async function getGraphStats(userId: string): Promise<{
  totalEntities: number;
  totalRelationships: number;
  entitiesByType: Record<EntityType, number>;
  relationshipsByType: Record<RelationType, number>;
  mostConnected: Entity[];
  mostMentioned: Entity[];
}> {
  const graph = await getOrCreateGraph(userId);

  const entitiesByType: Record<string, number> = {};
  const relationshipsByType: Record<string, number> = {};

  for (const e of graph.entities) {
    entitiesByType[e.type] = (entitiesByType[e.type] || 0) + 1;
  }

  for (const r of graph.relationships) {
    relationshipsByType[r.type] = (relationshipsByType[r.type] || 0) + 1;
  }

  // Find most connected entities
  const connectionCounts = new Map<string, number>();
  for (const r of graph.relationships) {
    connectionCounts.set(r.sourceId, (connectionCounts.get(r.sourceId) || 0) + 1);
    connectionCounts.set(r.targetId, (connectionCounts.get(r.targetId) || 0) + 1);
  }

  const mostConnected = graph.entities
    .map((e) => ({ entity: e, connections: connectionCounts.get(e.id) || 0 }))
    .sort((a, b) => b.connections - a.connections)
    .slice(0, 5)
    .map((e) => e.entity);

  const mostMentioned = [...graph.entities]
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, 5);

  return {
    totalEntities: graph.entities.length,
    totalRelationships: graph.relationships.length,
    entitiesByType: entitiesByType as Record<EntityType, number>,
    relationshipsByType: relationshipsByType as Record<RelationType, number>,
    mostConnected,
    mostMentioned,
  };
}

// Helper functions

function generateEntityId(): string {
  return `ent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getReverseRelationType(type: RelationType): RelationType {
  const reverseMap: Record<RelationType, RelationType> = {
    knows: "knows",
    works_with: "works_with",
    works_on: "works_on",
    family: "family",
    friend: "friend",
    colleague: "colleague",
    manages: "reports_to",
    reports_to: "manages",
    belongs_to: "belongs_to",
    related_to: "related_to",
    located_in: "located_in",
    interested_in: "interested_in",
    expert_in: "expert_in",
    mentioned_in: "mentioned_in",
    participates_in: "participates_in",
  };
  return reverseMap[type] || type;
}

function formatRelationType(type: RelationType): string {
  return type.replace(/_/g, " ");
}

async function loadGraphFromMemories(userId: string): Promise<void> {
  try {
    const graphMemories = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, userId),
          eq(memories.type, "semantic"),
          ilike(memories.source, "%relationship_graph%")
        )
      );

    for (const mem of graphMemories) {
      try {
        const data = JSON.parse(mem.content);
        if (data.entity) {
          const entities = entityStore.get(userId) || [];
          entities.push(data.entity);
          entityStore.set(userId, entities);
        }
      } catch {
        // Skip malformed memories
      }
    }
  } catch (error) {
    console.error("Error loading graph from memories:", error);
  }
}

async function persistGraphToMemory(
  userId: string,
  entity: Entity,
  action: string
): Promise<void> {
  try {
    const content = JSON.stringify({ entity, action });

    await db.insert(memories).values({
      userId,
      type: "semantic",
      content,
      source: "relationship_graph",
      importance: Math.ceil(entity.importance / 10),
      embedding: await generateEmbedding(`${entity.type}: ${entity.name} - ${entity.description || ""}`),
    });
  } catch (error) {
    console.error("Error persisting graph to memory:", error);
  }
}

export default {
  getOrCreateGraph,
  upsertEntity,
  upsertRelationship,
  findEntity,
  getEntitiesByType,
  getEntityRelationships,
  findPath,
  extractFromText,
  queryGraph,
  buildGraphContext,
  getGraphStats,
};
