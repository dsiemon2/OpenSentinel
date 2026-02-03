import { db } from "../../db";
import {
  memories,
  sharedMemories,
  organizations,
  organizationMembers,
  users,
} from "../../db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { generateEmbedding } from "../memory";
import OpenAI from "openai";
import { env } from "../../config/env";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// ============================================
// TYPES
// ============================================

export type MemoryVisibility = "private" | "team" | "organization" | "public";
export type MemoryCategory =
  | "knowledge"
  | "procedure"
  | "decision"
  | "policy"
  | "faq"
  | "template"
  | "best_practice";

export interface TeamMemory {
  id: string;
  organizationId: string;
  createdBy: string;
  title: string;
  content: string;
  category: MemoryCategory;
  visibility: MemoryVisibility;
  tags: string[];
  metadata: TeamMemoryMetadata;
  embedding?: number[];
  relevanceScore?: number;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  version: number;
}

export interface TeamMemoryMetadata {
  source?: string;
  department?: string;
  project?: string;
  expiresAt?: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  confidence?: number;
  relatedMemoryIds?: string[];
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

export interface CreateTeamMemoryOptions {
  organizationId: string;
  createdBy: string;
  title: string;
  content: string;
  category?: MemoryCategory;
  visibility?: MemoryVisibility;
  tags?: string[];
  metadata?: TeamMemoryMetadata;
}

export interface TeamMemorySearchOptions {
  organizationId: string;
  userId: string;
  query?: string;
  category?: MemoryCategory;
  visibility?: MemoryVisibility;
  tags?: string[];
  department?: string;
  limit?: number;
  offset?: number;
  includePrivate?: boolean;
}

export interface KnowledgeBaseStats {
  totalMemories: number;
  byCategory: Record<MemoryCategory, number>;
  byVisibility: Record<MemoryVisibility, number>;
  topContributors: Array<{ userId: string; count: number }>;
  recentlyAdded: number;
  recentlyAccessed: number;
}

// ============================================
// TEAM MEMORY CRUD
// ============================================

/**
 * Create a new team memory
 */
export async function createTeamMemory(
  options: CreateTeamMemoryOptions
): Promise<TeamMemory> {
  const {
    organizationId,
    createdBy,
    title,
    content,
    category = "knowledge",
    visibility = "team",
    tags = [],
    metadata = {},
  } = options;

  // Generate embedding for semantic search
  const embedding = await generateEmbedding(`${title}\n\n${content}`);

  // Store in memories table with team context
  const [memory] = await db
    .insert(memories)
    .values({
      userId: createdBy,
      type: "semantic",
      content: JSON.stringify({
        title,
        content,
        category,
        visibility,
        tags,
        organizationId,
        ...metadata,
        version: 1,
        accessCount: 0,
      }),
      embedding,
      importance: 7,
      source: "team_knowledge",
      metadata: {
        organizationId,
        category,
        visibility,
        tags,
        version: 1,
        accessCount: 0,
      },
    })
    .returning();

  // Create shared memory entry for organization access
  await db.insert(sharedMemories).values({
    organizationId,
    memoryId: memory.id,
    sharedBy: createdBy,
  });

  return mapToTeamMemory(memory, organizationId);
}

/**
 * Get team memory by ID
 */
export async function getTeamMemory(
  memoryId: string,
  userId: string
): Promise<TeamMemory | null> {
  const [memory] = await db
    .select()
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);

  if (!memory) return null;

  const metadata = memory.metadata as any;
  const organizationId = metadata?.organizationId;

  // Check access
  if (organizationId && !(await canAccessTeamMemory(userId, memoryId, organizationId))) {
    return null;
  }

  // Update access stats
  await updateAccessStats(memoryId);

  return mapToTeamMemory(memory, organizationId);
}

/**
 * Update team memory
 */
export async function updateTeamMemory(
  memoryId: string,
  userId: string,
  updates: Partial<CreateTeamMemoryOptions>
): Promise<TeamMemory> {
  const existing = await getTeamMemory(memoryId, userId);
  if (!existing) {
    throw new Error("Team memory not found or access denied");
  }

  const newContent = {
    title: updates.title || existing.title,
    content: updates.content || existing.content,
    category: updates.category || existing.category,
    visibility: updates.visibility || existing.visibility,
    tags: updates.tags || existing.tags,
    ...existing.metadata,
    ...(updates.metadata || {}),
    organizationId: existing.organizationId,
    version: existing.version + 1,
    accessCount: existing.accessCount,
    lastEditedBy: userId,
    lastEditedAt: new Date().toISOString(),
  };

  // Regenerate embedding if content changed
  let embedding = undefined;
  if (updates.title || updates.content) {
    embedding = await generateEmbedding(`${newContent.title}\n\n${newContent.content}`);
  }

  const updateData: any = {
    content: JSON.stringify(newContent),
    metadata: {
      organizationId: existing.organizationId,
      category: newContent.category,
      visibility: newContent.visibility,
      tags: newContent.tags,
      version: newContent.version,
      accessCount: newContent.accessCount,
    },
  };

  if (embedding) {
    updateData.embedding = embedding;
  }

  const [updated] = await db
    .update(memories)
    .set(updateData)
    .where(eq(memories.id, memoryId))
    .returning();

  return mapToTeamMemory(updated, existing.organizationId);
}

/**
 * Delete team memory
 */
export async function deleteTeamMemory(
  memoryId: string,
  userId: string
): Promise<void> {
  const existing = await getTeamMemory(memoryId, userId);
  if (!existing) {
    throw new Error("Team memory not found or access denied");
  }

  // Remove shared memory entry
  await db.delete(sharedMemories).where(eq(sharedMemories.memoryId, memoryId));

  // Delete the memory
  await db.delete(memories).where(eq(memories.id, memoryId));
}

// ============================================
// SEARCH & DISCOVERY
// ============================================

/**
 * Search team memories with semantic search
 */
export async function searchTeamMemories(
  options: TeamMemorySearchOptions
): Promise<{ memories: TeamMemory[]; total: number }> {
  const {
    organizationId,
    userId,
    query,
    category,
    visibility,
    tags,
    department,
    limit = 20,
    offset = 0,
    includePrivate = false,
  } = options;

  // Get user's accessible memories
  const sharedIds = await db
    .select({ memoryId: sharedMemories.memoryId })
    .from(sharedMemories)
    .where(eq(sharedMemories.organizationId, organizationId));

  const memoryIds = sharedIds.map((s) => s.memoryId);

  if (memoryIds.length === 0) {
    return { memories: [], total: 0 };
  }

  // Build query with semantic search if query provided
  if (query) {
    const queryEmbedding = await generateEmbedding(query);

    const results = await db.execute(sql`
      SELECT
        m.*,
        1 - (m.embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as similarity
      FROM memories m
      WHERE m.id = ANY(${memoryIds}::uuid[])
        AND m.source = 'team_knowledge'
        ${category ? sql`AND m.metadata->>'category' = ${category}` : sql``}
        ${visibility ? sql`AND m.metadata->>'visibility' = ${visibility}` : sql``}
        ${!includePrivate ? sql`AND m.metadata->>'visibility' != 'private'` : sql``}
      ORDER BY similarity DESC
      LIMIT ${limit} OFFSET ${offset}
    `) as unknown as { rows: any[] };

    const countResult = await db.execute(sql`
      SELECT COUNT(*) as total
      FROM memories m
      WHERE m.id = ANY(${memoryIds}::uuid[])
        AND m.source = 'team_knowledge'
        ${category ? sql`AND m.metadata->>'category' = ${category}` : sql``}
        ${visibility ? sql`AND m.metadata->>'visibility' = ${visibility}` : sql``}
        ${!includePrivate ? sql`AND m.metadata->>'visibility' != 'private'` : sql``}
    `) as unknown as { rows: any[] };

    return {
      memories: results.rows.map((r: any) => ({
        ...mapToTeamMemory(r, organizationId),
        relevanceScore: r.similarity,
      })),
      total: parseInt((countResult.rows[0] as any).total, 10),
    };
  }

  // Non-semantic search
  const results = await db
    .select()
    .from(memories)
    .where(
      and(
        inArray(memories.id, memoryIds),
        eq(memories.source, "team_knowledge")
      )
    )
    .orderBy(desc(memories.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    memories: results.map((r) => mapToTeamMemory(r, organizationId)),
    total: results.length, // Would need separate count query for accuracy
  };
}

/**
 * Get related memories
 */
export async function getRelatedMemories(
  memoryId: string,
  organizationId: string,
  limit = 5
): Promise<TeamMemory[]> {
  const [memory] = await db
    .select()
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);

  if (!memory || !memory.embedding) return [];

  const sharedIds = await db
    .select({ memoryId: sharedMemories.memoryId })
    .from(sharedMemories)
    .where(eq(sharedMemories.organizationId, organizationId));

  const memoryIds = sharedIds.map((s) => s.memoryId).filter((id) => id !== memoryId);

  if (memoryIds.length === 0) return [];

  const results = await db.execute(sql`
    SELECT
      m.*,
      1 - (m.embedding <=> ${JSON.stringify(memory.embedding)}::vector) as similarity
    FROM memories m
    WHERE m.id = ANY(${memoryIds}::uuid[])
      AND m.source = 'team_knowledge'
    ORDER BY similarity DESC
    LIMIT ${limit}
  `) as unknown as { rows: any[] };

  return results.rows.map((r: any) => ({
    ...mapToTeamMemory(r, organizationId),
    relevanceScore: r.similarity,
  }));
}

/**
 * Get trending/popular memories
 */
export async function getTrendingMemories(
  organizationId: string,
  days = 7,
  limit = 10
): Promise<TeamMemory[]> {
  const sharedIds = await db
    .select({ memoryId: sharedMemories.memoryId })
    .from(sharedMemories)
    .where(eq(sharedMemories.organizationId, organizationId));

  const memoryIds = sharedIds.map((s) => s.memoryId);

  if (memoryIds.length === 0) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const results = await db.execute(sql`
    SELECT m.*
    FROM memories m
    WHERE m.id = ANY(${memoryIds}::uuid[])
      AND m.source = 'team_knowledge'
      AND m.last_accessed >= ${since}
    ORDER BY (m.metadata->>'accessCount')::int DESC
    LIMIT ${limit}
  `) as unknown as { rows: any[] };

  return results.rows.map((r: any) => mapToTeamMemory(r, organizationId));
}

// ============================================
// KNOWLEDGE BASE MANAGEMENT
// ============================================

/**
 * Get knowledge base statistics
 */
export async function getKnowledgeBaseStats(
  organizationId: string
): Promise<KnowledgeBaseStats> {
  const sharedIds = await db
    .select({ memoryId: sharedMemories.memoryId, sharedBy: sharedMemories.sharedBy })
    .from(sharedMemories)
    .where(eq(sharedMemories.organizationId, organizationId));

  const memoryIds = sharedIds.map((s) => s.memoryId);

  if (memoryIds.length === 0) {
    return {
      totalMemories: 0,
      byCategory: {} as Record<MemoryCategory, number>,
      byVisibility: {} as Record<MemoryVisibility, number>,
      topContributors: [],
      recentlyAdded: 0,
      recentlyAccessed: 0,
    };
  }

  const allMemories = await db
    .select()
    .from(memories)
    .where(inArray(memories.id, memoryIds));

  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const stats: KnowledgeBaseStats = {
    totalMemories: allMemories.length,
    byCategory: {} as Record<MemoryCategory, number>,
    byVisibility: {} as Record<MemoryVisibility, number>,
    topContributors: [],
    recentlyAdded: 0,
    recentlyAccessed: 0,
  };

  const contributorCounts: Record<string, number> = {};

  for (const memory of allMemories) {
    const metadata = memory.metadata as any;

    // Category counts
    const category = metadata?.category || "knowledge";
    stats.byCategory[category as MemoryCategory] =
      (stats.byCategory[category as MemoryCategory] || 0) + 1;

    // Visibility counts
    const visibility = metadata?.visibility || "team";
    stats.byVisibility[visibility as MemoryVisibility] =
      (stats.byVisibility[visibility as MemoryVisibility] || 0) + 1;

    // Recently added
    if (memory.createdAt >= week) {
      stats.recentlyAdded++;
    }

    // Recently accessed
    if (memory.lastAccessed && memory.lastAccessed >= week) {
      stats.recentlyAccessed++;
    }

    // Contributor counts
    if (memory.userId) {
      contributorCounts[memory.userId] = (contributorCounts[memory.userId] || 0) + 1;
    }
  }

  // Top contributors
  stats.topContributors = Object.entries(contributorCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return stats;
}

/**
 * Export knowledge base
 */
export async function exportKnowledgeBase(
  organizationId: string,
  format: "json" | "csv" = "json"
): Promise<string> {
  const { memories: allMemories } = await searchTeamMemories({
    organizationId,
    userId: "", // Admin export
    limit: 10000,
    includePrivate: true,
  });

  if (format === "csv") {
    const headers = ["id", "title", "category", "visibility", "tags", "content", "createdAt"];
    const rows = allMemories.map((m) => [
      m.id,
      `"${m.title.replace(/"/g, '""')}"`,
      m.category,
      m.visibility,
      `"${m.tags.join(", ")}"`,
      `"${m.content.replace(/"/g, '""').substring(0, 500)}"`,
      m.createdAt.toISOString(),
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  return JSON.stringify(allMemories, null, 2);
}

/**
 * Import knowledge base from JSON
 */
export async function importKnowledgeBase(
  organizationId: string,
  userId: string,
  data: Array<Partial<CreateTeamMemoryOptions>>
): Promise<{ success: number; failed: number; errors: string[] }> {
  const result = { success: 0, failed: 0, errors: [] as string[] };

  for (const item of data) {
    try {
      await createTeamMemory({
        organizationId,
        createdBy: userId,
        title: item.title || "Imported Memory",
        content: item.content || "",
        category: item.category,
        visibility: item.visibility,
        tags: item.tags,
        metadata: item.metadata,
      });
      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  return result;
}

// ============================================
// AI-POWERED FEATURES
// ============================================

/**
 * Auto-categorize memory content
 */
export async function autoCategorizeMemory(
  content: string
): Promise<{ category: MemoryCategory; tags: string[]; confidence: number }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a knowledge categorization assistant. Analyze the content and return a JSON object with:
- category: one of 'knowledge', 'procedure', 'decision', 'policy', 'faq', 'template', 'best_practice'
- tags: array of relevant tags (3-5 tags)
- confidence: number 0-100 indicating confidence in categorization

Return only valid JSON.`,
        },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      category: result.category || "knowledge",
      tags: result.tags || [],
      confidence: result.confidence || 50,
    };
  } catch {
    return { category: "knowledge", tags: [], confidence: 0 };
  }
}

/**
 * Generate summary for memory
 */
export async function generateMemorySummary(content: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Generate a concise 2-3 sentence summary of the following content.",
        },
        { role: "user", content },
      ],
      max_tokens: 150,
    });

    return response.choices[0].message.content || "";
  } catch {
    return content.substring(0, 200) + "...";
  }
}

/**
 * Find duplicate or similar memories
 */
export async function findDuplicates(
  organizationId: string,
  content: string,
  threshold = 0.9
): Promise<TeamMemory[]> {
  const embedding = await generateEmbedding(content);

  const sharedIds = await db
    .select({ memoryId: sharedMemories.memoryId })
    .from(sharedMemories)
    .where(eq(sharedMemories.organizationId, organizationId));

  const memoryIds = sharedIds.map((s) => s.memoryId);

  if (memoryIds.length === 0) return [];

  const results = await db.execute(sql`
    SELECT
      m.*,
      1 - (m.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM memories m
    WHERE m.id = ANY(${memoryIds}::uuid[])
      AND m.source = 'team_knowledge'
      AND 1 - (m.embedding <=> ${JSON.stringify(embedding)}::vector) >= ${threshold}
    ORDER BY similarity DESC
    LIMIT 5
  `) as unknown as { rows: any[] };

  return results.rows.map((r: any) => ({
    ...mapToTeamMemory(r, organizationId),
    relevanceScore: r.similarity,
  }));
}

// ============================================
// HELPERS
// ============================================

function mapToTeamMemory(dbMemory: any, organizationId: string): TeamMemory {
  let parsedContent: any = {};
  try {
    parsedContent = JSON.parse(dbMemory.content);
  } catch {
    parsedContent = { content: dbMemory.content };
  }

  const metadata = dbMemory.metadata as any;

  return {
    id: dbMemory.id,
    organizationId,
    createdBy: dbMemory.user_id || dbMemory.userId || "",
    title: parsedContent.title || "Untitled",
    content: parsedContent.content || dbMemory.content,
    category: metadata?.category || parsedContent.category || "knowledge",
    visibility: metadata?.visibility || parsedContent.visibility || "team",
    tags: metadata?.tags || parsedContent.tags || [],
    metadata: {
      source: parsedContent.source,
      department: parsedContent.department,
      project: parsedContent.project,
      expiresAt: parsedContent.expiresAt ? new Date(parsedContent.expiresAt) : undefined,
      reviewedBy: parsedContent.reviewedBy,
      reviewedAt: parsedContent.reviewedAt ? new Date(parsedContent.reviewedAt) : undefined,
      confidence: parsedContent.confidence,
      relatedMemoryIds: parsedContent.relatedMemoryIds,
      attachments: parsedContent.attachments,
    },
    embedding: dbMemory.embedding,
    createdAt: new Date(dbMemory.created_at || dbMemory.createdAt),
    updatedAt: new Date(dbMemory.created_at || dbMemory.createdAt),
    lastAccessedAt: dbMemory.last_accessed
      ? new Date(dbMemory.last_accessed)
      : undefined,
    accessCount: metadata?.accessCount || parsedContent.accessCount || 0,
    version: metadata?.version || parsedContent.version || 1,
  };
}

async function canAccessTeamMemory(
  userId: string,
  memoryId: string,
  organizationId: string
): Promise<boolean> {
  // Check if user is member of the organization
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId)
      )
    )
    .limit(1);

  return !!membership;
}

async function updateAccessStats(memoryId: string): Promise<void> {
  await db.execute(sql`
    UPDATE memories
    SET
      last_accessed = NOW(),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{accessCount}',
        (COALESCE((metadata->>'accessCount')::int, 0) + 1)::text::jsonb
      )
    WHERE id = ${memoryId}
  `);
}

export default {
  createTeamMemory,
  getTeamMemory,
  updateTeamMemory,
  deleteTeamMemory,
  searchTeamMemories,
  getRelatedMemories,
  getTrendingMemories,
  getKnowledgeBaseStats,
  exportKnowledgeBase,
  importKnowledgeBase,
  autoCategorizeMemory,
  generateMemorySummary,
  findDuplicates,
};
