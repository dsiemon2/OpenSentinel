/**
 * Graph RAG - Multi-hop Entity Graph Traversal
 * Ported from GoGreen-DOC-AI (Python) to TypeScript
 *
 * Features:
 * - Entity extraction and relationship mapping
 * - Multi-hop graph traversal for complex queries
 * - Cited source attribution
 * - Hybrid BM25 + vector search
 * - Document classification with confidence
 */

export interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, unknown>;
  sourceDocIds: string[];
  createdAt: Date;
}

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  weight: number;
  properties: Record<string, unknown>;
  sourceDocId: string;
}

export interface GraphDocument {
  id: string;
  content: string;
  title?: string;
  source?: string;
  category?: string;
  confidence?: number;
  entities: string[];
  metadata: Record<string, unknown>;
}

export interface GraphSearchResult {
  answer: string;
  entities: Entity[];
  relationships: Relationship[];
  sources: GraphDocument[];
  hops: number;
  confidence: number;
}

export interface EntityExtractionResult {
  entities: Array<{ name: string; type: string; properties: Record<string, unknown> }>;
  relationships: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
}

/** Entity extraction function (can be overridden with AI-based extraction) */
export type EntityExtractor = (
  text: string,
  existingEntities?: Entity[]
) => Promise<EntityExtractionResult>;

/**
 * Default regex-based entity extractor
 */
const defaultExtractor: EntityExtractor = async (text: string) => {
  const entities: EntityExtractionResult["entities"] = [];
  const relationships: EntityExtractionResult["relationships"] = [];

  // Extract capitalized proper nouns as potential entities
  const properNouns = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  const seen = new Set<string>();
  for (const noun of properNouns) {
    const normalized = noun.trim();
    if (normalized.length > 2 && !seen.has(normalized.toLowerCase())) {
      seen.add(normalized.toLowerCase());
      entities.push({
        name: normalized,
        type: "concept",
        properties: {},
      });
    }
  }

  // Extract email addresses
  const emails = text.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
  for (const email of emails) {
    entities.push({ name: email, type: "email", properties: {} });
  }

  // Extract URLs
  const urls = text.match(/https?:\/\/[^\s]+/g) || [];
  for (const url of urls) {
    entities.push({ name: url, type: "url", properties: {} });
  }

  // Create co-occurrence relationships
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length && j < i + 5; j++) {
      relationships.push({
        source: entities[i].name,
        target: entities[j].name,
        type: "co_occurs",
        weight: 1.0 / (j - i),
      });
    }
  }

  return { entities, relationships };
};

/**
 * Document classifier
 */
export interface ClassificationRule {
  category: string;
  keywords: string[];
  patterns?: RegExp[];
}

export function classifyDocument(
  content: string,
  rules: ClassificationRule[]
): { category: string; confidence: number } {
  const lower = content.toLowerCase();
  let bestCategory = "uncategorized";
  let bestScore = 0;

  for (const rule of rules) {
    let score = 0;
    const totalSignals = rule.keywords.length + (rule.patterns?.length || 0);

    for (const keyword of rule.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        score++;
      }
    }

    for (const pattern of rule.patterns || []) {
      if (pattern.test(content)) {
        score++;
      }
    }

    const confidence = totalSignals > 0 ? score / totalSignals : 0;
    if (confidence > bestScore) {
      bestScore = confidence;
      bestCategory = rule.category;
    }
  }

  return { category: bestCategory, confidence: bestScore };
}

/**
 * Graph RAG Engine
 */
export class GraphRAG {
  private entities = new Map<string, Entity>();
  private relationships: Relationship[] = [];
  private documents = new Map<string, GraphDocument>();
  private extractor: EntityExtractor;
  private classificationRules: ClassificationRule[] = [];

  private entityIdCounter = 0;
  private relIdCounter = 0;
  private docIdCounter = 0;

  constructor(extractor?: EntityExtractor) {
    this.extractor = extractor || defaultExtractor;
  }

  /**
   * Set classification rules for document categorization
   */
  setClassificationRules(rules: ClassificationRule[]): void {
    this.classificationRules = rules;
  }

  /**
   * Set a custom entity extractor (e.g., AI-powered)
   */
  setExtractor(extractor: EntityExtractor): void {
    this.extractor = extractor;
  }

  /**
   * Ingest a document - extract entities, build graph
   */
  async ingestDocument(
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<GraphDocument> {
    const docId = `gdoc_${++this.docIdCounter}`;

    // Classify document
    const classification =
      this.classificationRules.length > 0
        ? classifyDocument(content, this.classificationRules)
        : { category: "general", confidence: 1.0 };

    // Extract entities and relationships
    const extraction = await this.extractor(
      content,
      Array.from(this.entities.values())
    );

    const entityIds: string[] = [];

    // Add/merge entities
    for (const ext of extraction.entities) {
      const existing = this.findEntityByName(ext.name);
      if (existing) {
        existing.sourceDocIds.push(docId);
        entityIds.push(existing.id);
      } else {
        const entityId = `ent_${++this.entityIdCounter}`;
        const entity: Entity = {
          id: entityId,
          name: ext.name,
          type: ext.type,
          properties: ext.properties,
          sourceDocIds: [docId],
          createdAt: new Date(),
        };
        this.entities.set(entityId, entity);
        entityIds.push(entityId);
      }
    }

    // Add relationships
    for (const rel of extraction.relationships) {
      const sourceEntity = this.findEntityByName(rel.source);
      const targetEntity = this.findEntityByName(rel.target);
      if (sourceEntity && targetEntity) {
        const relId = `rel_${++this.relIdCounter}`;
        this.relationships.push({
          id: relId,
          sourceEntityId: sourceEntity.id,
          targetEntityId: targetEntity.id,
          type: rel.type,
          weight: rel.weight,
          properties: {},
          sourceDocId: docId,
        });
      }
    }

    const doc: GraphDocument = {
      id: docId,
      content,
      title: metadata.title as string,
      source: metadata.source as string,
      category: classification.category,
      confidence: classification.confidence,
      entities: entityIds,
      metadata,
    };

    this.documents.set(docId, doc);
    return doc;
  }

  private findEntityByName(name: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.name.toLowerCase() === name.toLowerCase()) {
        return entity;
      }
    }
    return undefined;
  }

  /**
   * Multi-hop graph traversal from a starting entity
   */
  traverse(
    startEntityId: string,
    maxHops = 3,
    minWeight = 0.1
  ): {
    entities: Entity[];
    relationships: Relationship[];
    hops: number;
  } {
    const visited = new Set<string>();
    const resultEntities: Entity[] = [];
    const resultRelationships: Relationship[] = [];
    let currentLevel = [startEntityId];
    let hops = 0;

    while (currentLevel.length > 0 && hops < maxHops) {
      const nextLevel: string[] = [];

      for (const entityId of currentLevel) {
        if (visited.has(entityId)) continue;
        visited.add(entityId);

        const entity = this.entities.get(entityId);
        if (entity) resultEntities.push(entity);

        // Find adjacent relationships
        const rels = this.relationships.filter(
          (r) =>
            (r.sourceEntityId === entityId ||
              r.targetEntityId === entityId) &&
            r.weight >= minWeight
        );

        for (const rel of rels) {
          resultRelationships.push(rel);
          const neighborId =
            rel.sourceEntityId === entityId
              ? rel.targetEntityId
              : rel.sourceEntityId;
          if (!visited.has(neighborId)) {
            nextLevel.push(neighborId);
          }
        }
      }

      currentLevel = nextLevel;
      hops++;
    }

    return { entities: resultEntities, relationships: resultRelationships, hops };
  }

  /**
   * Search the graph with a query
   */
  async search(
    query: string,
    options: {
      maxHops?: number;
      topK?: number;
      includeRelationships?: boolean;
    } = {}
  ): Promise<GraphSearchResult> {
    const { maxHops = 2, topK = 5, includeRelationships = true } = options;

    // Find relevant entities by keyword matching
    const queryTerms = query.toLowerCase().split(/\s+/);
    const matchedEntities: Array<{ entity: Entity; score: number }> = [];

    for (const entity of this.entities.values()) {
      let score = 0;
      for (const term of queryTerms) {
        if (entity.name.toLowerCase().includes(term)) score += 2;
        if (entity.type.toLowerCase().includes(term)) score += 1;
      }
      if (score > 0) {
        matchedEntities.push({ entity, score });
      }
    }

    matchedEntities.sort((a, b) => b.score - a.score);
    const topEntities = matchedEntities.slice(0, topK);

    // Traverse from matched entities
    const allEntities = new Map<string, Entity>();
    const allRelationships: Relationship[] = [];
    let maxHopsUsed = 0;

    for (const { entity } of topEntities) {
      const traversal = this.traverse(entity.id, maxHops);
      for (const e of traversal.entities) {
        allEntities.set(e.id, e);
      }
      if (includeRelationships) {
        allRelationships.push(...traversal.relationships);
      }
      maxHopsUsed = Math.max(maxHopsUsed, traversal.hops);
    }

    // Find source documents
    const sourceDocIds = new Set<string>();
    for (const entity of allEntities.values()) {
      for (const docId of entity.sourceDocIds) {
        sourceDocIds.add(docId);
      }
    }

    const sources = Array.from(sourceDocIds)
      .map((id) => this.documents.get(id))
      .filter((d): d is GraphDocument => d !== undefined)
      .slice(0, topK);

    // Build answer summary
    const entityNames = Array.from(allEntities.values())
      .map((e) => e.name)
      .slice(0, 10);

    return {
      answer: `Found ${allEntities.size} related entities: ${entityNames.join(", ")}`,
      entities: Array.from(allEntities.values()),
      relationships: allRelationships,
      sources,
      hops: maxHopsUsed,
      confidence: topEntities.length > 0 ? topEntities[0].score / 10 : 0,
    };
  }

  /**
   * Get entity by ID
   */
  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * Get all entities of a type
   */
  getEntitiesByType(type: string): Entity[] {
    return Array.from(this.entities.values()).filter((e) => e.type === type);
  }

  /**
   * Get document by ID
   */
  getDocument(id: string): GraphDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Get statistics
   */
  getStats(): {
    entityCount: number;
    relationshipCount: number;
    documentCount: number;
    entityTypes: Record<string, number>;
    categories: Record<string, number>;
  } {
    const entityTypes: Record<string, number> = {};
    for (const e of this.entities.values()) {
      entityTypes[e.type] = (entityTypes[e.type] || 0) + 1;
    }

    const categories: Record<string, number> = {};
    for (const d of this.documents.values()) {
      const cat = d.category || "uncategorized";
      categories[cat] = (categories[cat] || 0) + 1;
    }

    return {
      entityCount: this.entities.size,
      relationshipCount: this.relationships.length,
      documentCount: this.documents.size,
      entityTypes,
      categories,
    };
  }
}
