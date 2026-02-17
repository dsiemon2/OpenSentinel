import { db } from "../../db";
import { memories, archivedMemories } from "../../db/schema";
import { eq, and, lt, lte, sql } from "drizzle-orm";

export type ShedReason =
  | "stale"
  | "duplicate"
  | "low_importance"
  | "user_request"
  | "deprecated_workflow";

export interface ShedCandidate {
  memoryId: string;
  content: string;
  type: string;
  reason: ShedReason;
  lastAccessed: Date | null;
  importance: number;
  confidence: number; // How confident we are this should be shed (0-100)
}

export interface ShedResult {
  archivedCount: number;
  archivedIds: string[];
  skippedCount: number;
}

// Configuration for memory shedding
const SHED_CONFIG = {
  staleDays: 90, // Memories not accessed in 90 days
  lowImportanceThreshold: 3, // Memories with importance <= 3
  minConfidence: 70, // Minimum confidence to auto-shed
};

// Find stale memories (not accessed recently)
export async function findStaleMemories(
  userId: string,
  staleDays: number = SHED_CONFIG.staleDays
): Promise<ShedCandidate[]> {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const stale = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        lt(memories.lastAccessed, cutoff)
      )
    );

  return stale.map((m) => ({
    memoryId: m.id,
    content: m.content,
    type: m.type,
    reason: "stale" as ShedReason,
    lastAccessed: m.lastAccessed,
    importance: m.importance || 5,
    confidence: calculateStaleConfidence(m.lastAccessed, m.importance || 5),
  }));
}

function calculateStaleConfidence(
  lastAccessed: Date | null,
  importance: number
): number {
  if (!lastAccessed) return 80;

  const daysSinceAccess = Math.floor(
    (Date.now() - lastAccessed.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Higher confidence for older, less important memories
  let confidence = Math.min(daysSinceAccess / 2, 50); // Max 50 from age
  confidence += (10 - importance) * 5; // Up to 50 from low importance

  return Math.min(confidence, 100);
}

// Find low importance memories
export async function findLowImportanceMemories(
  userId: string,
  threshold: number = SHED_CONFIG.lowImportanceThreshold
): Promise<ShedCandidate[]> {
  const lowImportance = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.userId, userId),
        lte(memories.importance, threshold)
      )
    );

  return lowImportance.map((m) => ({
    memoryId: m.id,
    content: m.content,
    type: m.type,
    reason: "low_importance" as ShedReason,
    lastAccessed: m.lastAccessed,
    importance: m.importance || 5,
    confidence: (SHED_CONFIG.lowImportanceThreshold - (m.importance || 5) + 1) * 25,
  }));
}

// Find potential duplicate memories (simplified - would need better NLP in production)
export async function findDuplicateMemories(
  userId: string
): Promise<ShedCandidate[]> {
  const allMemories = await db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId));

  const candidates: ShedCandidate[] = [];
  const seen = new Map<string, typeof allMemories[0]>();

  for (const memory of allMemories) {
    // Simple duplicate detection: normalize and check for similar content
    const normalized = memory.content.toLowerCase().trim();
    const key = normalized.slice(0, 100); // Use first 100 chars as key

    const existing = seen.get(key);
    if (existing) {
      // Mark the newer one as duplicate (keep older memories)
      const isDuplicate =
        memory.createdAt > existing.createdAt ? memory : existing;

      candidates.push({
        memoryId: isDuplicate.id,
        content: isDuplicate.content,
        type: isDuplicate.type,
        reason: "duplicate",
        lastAccessed: isDuplicate.lastAccessed,
        importance: isDuplicate.importance || 5,
        confidence: 75, // Fairly confident about duplicates
      });
    } else {
      seen.set(key, memory);
    }
  }

  return candidates;
}

// Get all shed candidates for a user
export async function identifyShedCandidates(
  userId: string
): Promise<ShedCandidate[]> {
  const [stale, lowImportance, duplicates] = await Promise.all([
    findStaleMemories(userId),
    findLowImportanceMemories(userId),
    findDuplicateMemories(userId),
  ]);

  // Combine and deduplicate by memoryId
  const candidateMap = new Map<string, ShedCandidate>();

  for (const candidate of [...stale, ...lowImportance, ...duplicates]) {
    const existing = candidateMap.get(candidate.memoryId);
    if (!existing || candidate.confidence > existing.confidence) {
      candidateMap.set(candidate.memoryId, candidate);
    }
  }

  return Array.from(candidateMap.values()).sort(
    (a, b) => b.confidence - a.confidence
  );
}

// Archive a single memory
export async function archiveMemory(
  memoryId: string,
  reason: ShedReason
): Promise<boolean> {
  const [memory] = await db
    .select()
    .from(memories)
    .where(eq(memories.id, memoryId))
    .limit(1);

  if (!memory) return false;

  // Insert into archived memories
  await db.insert(archivedMemories).values({
    originalMemoryId: memory.id,
    userId: memory.userId,
    type: memory.type,
    content: memory.content,
    reason,
    originalCreatedAt: memory.createdAt,
  });

  // Delete from active memories
  await db.delete(memories).where(eq(memories.id, memoryId));

  return true;
}

// Archive multiple memories
export async function archiveMemories(
  memoryIds: string[],
  reason: ShedReason
): Promise<ShedResult> {
  let archivedCount = 0;
  const archivedIds: string[] = [];

  for (const id of memoryIds) {
    const success = await archiveMemory(id, reason);
    if (success) {
      archivedCount++;
      archivedIds.push(id);
    }
  }

  return {
    archivedCount,
    archivedIds,
    skippedCount: memoryIds.length - archivedCount,
  };
}

// Auto-shed memories based on confidence threshold
export async function autoShed(
  userId: string,
  minConfidence: number = SHED_CONFIG.minConfidence
): Promise<ShedResult> {
  const candidates = await identifyShedCandidates(userId);
  const toArchive = candidates.filter((c) => c.confidence >= minConfidence);

  const results: ShedResult = {
    archivedCount: 0,
    archivedIds: [],
    skippedCount: 0,
  };

  for (const candidate of toArchive) {
    const success = await archiveMemory(candidate.memoryId, candidate.reason);
    if (success) {
      results.archivedCount++;
      results.archivedIds.push(candidate.memoryId);
    } else {
      results.skippedCount++;
    }
  }

  return results;
}

// Restore an archived memory
export async function restoreMemory(archivedId: string): Promise<boolean> {
  const [archived] = await db
    .select()
    .from(archivedMemories)
    .where(eq(archivedMemories.id, archivedId))
    .limit(1);

  if (!archived) return false;

  // Re-insert into active memories (without embedding - would need to regenerate)
  await db.insert(memories).values({
    userId: archived.userId,
    type: archived.type as "episodic" | "semantic" | "procedural",
    content: archived.content,
    importance: 5, // Reset to medium importance
    source: "restored",
  });

  // Remove from archive
  await db.delete(archivedMemories).where(eq(archivedMemories.id, archivedId));

  return true;
}

// Get archived memories for a user
export async function getArchivedMemories(
  userId: string,
  limit: number = 50
): Promise<typeof archivedMemories.$inferSelect[]> {
  return db
    .select()
    .from(archivedMemories)
    .where(eq(archivedMemories.userId, userId))
    .limit(limit);
}

// Get shedding statistics
export async function getShedStats(
  userId: string
): Promise<{
  totalArchived: number;
  byReason: Record<ShedReason, number>;
  pendingCandidates: number;
}> {
  const archived = await getArchivedMemories(userId, 1000);
  const candidates = await identifyShedCandidates(userId);

  const byReason: Record<ShedReason, number> = {
    stale: 0,
    duplicate: 0,
    low_importance: 0,
    user_request: 0,
    deprecated_workflow: 0,
  };

  for (const memory of archived) {
    const reason = memory.reason as ShedReason;
    if (reason in byReason) {
      byReason[reason]++;
    }
  }

  return {
    totalArchived: archived.length,
    byReason,
    pendingCandidates: candidates.length,
  };
}

// Cleanup old archives (permanent deletion)
export async function cleanupOldArchives(
  daysToKeep: number = 365
): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  await db
    .delete(archivedMemories)
    .where(lt(archivedMemories.archivedAt, cutoff));

  return 0; // Cleanup completed
}
