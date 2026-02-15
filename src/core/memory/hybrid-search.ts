/**
 * Hybrid Search — Vector + Keyword + Graph with Reciprocal Rank Fusion
 *
 * Combines three retrieval strategies:
 * 1. Vector search (pgvector cosine similarity)
 * 2. Keyword search (PostgreSQL tsvector/GIN)
 * 3. Graph-augmented search (entity relationship expansion)
 *
 * Results are fused using Reciprocal Rank Fusion (RRF).
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { generateEmbedding } from "../memory";

export interface HybridSearchResult {
  id: string;
  userId: string | null;
  type: string;
  content: string;
  importance: number;
  source: string | null;
  provenance: string | null;
  similarity: number;      // Vector similarity score
  keywordRank: number;     // Keyword search rank
  rrfScore: number;        // Combined RRF score
  createdAt: Date;
}

export interface HybridSearchOptions {
  userId?: string;
  limit?: number;
  since?: Date;
  until?: Date;
  minImportance?: number;
  includeKeyword?: boolean;
  includeGraph?: boolean;
}

const RRF_K = 60; // RRF constant (standard value)

/**
 * Vector search using pgvector cosine similarity
 */
export async function vectorSearch(
  query: string,
  userId?: string,
  limit = 10
): Promise<Array<{ id: string; content: string; similarity: number; [key: string]: unknown }>> {
  const queryEmbedding = await generateEmbedding(query);

  const results = await db.execute(sql`
    SELECT
      id, user_id, type, content, importance, source, provenance,
      created_at,
      1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
    FROM memories
    ${userId ? sql`WHERE user_id = ${userId}` : sql``}
    ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT ${limit}
  `);

  return results as any[];
}

/**
 * Keyword search using PostgreSQL tsvector full-text search
 */
export async function keywordSearch(
  query: string,
  userId?: string,
  limit = 10
): Promise<Array<{ id: string; content: string; keywordRank: number; [key: string]: unknown }>> {
  const results = await db.execute(sql`
    SELECT
      id, user_id, type, content, importance, source, provenance,
      created_at,
      ts_rank(search_vector, plainto_tsquery('english', ${query})) as keyword_rank
    FROM memories
    WHERE search_vector IS NOT NULL
      AND search_vector @@ plainto_tsquery('english', ${query})
      ${userId ? sql`AND user_id = ${userId}` : sql``}
    ORDER BY keyword_rank DESC
    LIMIT ${limit}
  `);

  return (results as any[]).map((r: any) => ({
    ...r,
    keywordRank: r.keyword_rank,
  }));
}

/**
 * Graph-augmented search: find entities matching query, expand to related memories
 */
export async function graphAugmentedSearch(
  query: string,
  userId?: string,
  limit = 10
): Promise<Array<{ id: string; content: string; graphScore: number; [key: string]: unknown }>> {
  // Find matching graph entities
  const entities = await db.execute(sql`
    SELECT id, name, type
    FROM graph_entities
    WHERE name ILIKE ${'%' + query + '%'}
      ${userId ? sql`AND user_id = ${userId}` : sql``}
    LIMIT 5
  `);

  if ((entities as any[]).length === 0) {
    return [];
  }

  const entityIds = (entities as any[]).map((e: any) => e.id);

  // Find memories related to these entities via relationships
  // We search for entity names in memory content
  const entityNames = (entities as any[]).map((e: any) => e.name);
  const namePattern = entityNames.join("|");

  const results = await db.execute(sql`
    SELECT
      id, user_id, type, content, importance, source, provenance,
      created_at,
      1.0 as graph_score
    FROM memories
    WHERE content ~* ${namePattern}
      ${userId ? sql`AND user_id = ${userId}` : sql``}
    ORDER BY importance DESC, created_at DESC
    LIMIT ${limit}
  `);

  return (results as any[]).map((r: any) => ({
    ...r,
    graphScore: r.graph_score,
  }));
}

/**
 * Reciprocal Rank Fusion: combine ranked lists from multiple sources
 */
function reciprocalRankFusion(
  rankedLists: Array<Array<{ id: string; [key: string]: unknown }>>,
  k = RRF_K
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank].id;
      const rrfScore = 1 / (k + rank + 1);
      scores.set(id, (scores.get(id) || 0) + rrfScore);
    }
  }

  return scores;
}

/**
 * Hybrid search combining vector, keyword, and graph search with RRF
 */
export async function hybridSearch(
  query: string,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const {
    userId,
    limit = 10,
    since,
    until,
    includeKeyword = true,
    includeGraph = true,
  } = options;

  // Run searches in parallel
  const searchPromises: Array<Promise<any[]>> = [
    vectorSearch(query, userId, limit * 2), // Fetch more for better fusion
  ];

  if (includeKeyword) {
    searchPromises.push(keywordSearch(query, userId, limit * 2));
  }

  if (includeGraph) {
    searchPromises.push(graphAugmentedSearch(query, userId, limit));
  }

  const results = await Promise.all(searchPromises);
  const [vectorResults, keywordResults, graphResults] = results;

  // Build a map of all unique results
  const allResults = new Map<string, any>();
  for (const r of vectorResults || []) {
    allResults.set(r.id, r);
  }
  for (const r of keywordResults || []) {
    if (!allResults.has(r.id)) allResults.set(r.id, r);
  }
  for (const r of graphResults || []) {
    if (!allResults.has(r.id)) allResults.set(r.id, r);
  }

  // Compute RRF scores
  const rankedLists = [vectorResults || []];
  if (keywordResults) rankedLists.push(keywordResults);
  if (graphResults) rankedLists.push(graphResults);

  const rrfScores = reciprocalRankFusion(rankedLists);

  // Build final results
  let finalResults: HybridSearchResult[] = [];
  for (const [id, rrfScore] of rrfScores) {
    const data = allResults.get(id);
    if (!data) continue;

    finalResults.push({
      id: data.id,
      userId: data.user_id,
      type: data.type,
      content: data.content,
      importance: data.importance || 5,
      source: data.source,
      provenance: data.provenance,
      similarity: data.similarity || 0,
      keywordRank: data.keywordRank || data.keyword_rank || 0,
      rrfScore,
      createdAt: data.created_at,
    });
  }

  // Apply temporal filtering
  if (since) {
    finalResults = finalResults.filter((r) => new Date(r.createdAt) >= since);
  }
  if (until) {
    finalResults = finalResults.filter((r) => new Date(r.createdAt) <= until);
  }

  // Sort by RRF score descending, take top N
  return finalResults
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit);
}
