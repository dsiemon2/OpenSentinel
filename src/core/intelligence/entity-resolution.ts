/**
 * Entity Resolution Pipeline
 *
 * Resolves, deduplicates, and matches entities across multiple public records
 * databases (FEC, IRS 990, USAspending, SEC EDGAR, OpenCorporates).
 *
 * Flow: exact match → identifier match (EIN/CIK/FEC) → fuzzy match → create new
 */

import { db } from "../../db";
import { graphEntities, graphRelationships } from "../../db/schema";
import { eq, ilike, sql } from "drizzle-orm";

// Extended entity type for OSINT sources
export type OSINTEntityType =
  | "person"
  | "organization"
  | "committee"
  | "contract"
  | "filing"
  | "location"
  | "topic";

export interface EntityCandidate {
  name: string;
  type: OSINTEntityType;
  source: string; // "fec" | "irs990" | "usaspending" | "sec" | "opencorporates" | "manual"
  identifiers?: {
    ein?: string;
    cik?: string;
    fecId?: string;
    duns?: string;
    uei?: string;
  };
  attributes?: Record<string, unknown>;
  aliases?: string[];
}

export interface ResolvedEntity {
  isNew: boolean;
  entityId: string; // postgres graphEntities.id
  confidence: number; // 0-1
  matchedBy: "exact" | "fuzzy" | "identifier" | "new";
}

/**
 * Normalize an entity name for comparison.
 * Strips punctuation, extra whitespace, common suffixes.
 */
export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,;:'"!?()\[\]{}]/g, "")
    .replace(/\b(inc|llc|corp|ltd|co|foundation|fund|assoc|association|committee|pac)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaro-Winkler similarity between two strings (0-1).
 */
export function fuzzyMatch(a: string, b: string): number {
  const s1 = normalizeEntityName(a);
  const s2 = normalizeEntityName(b);

  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  const matchWindow = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Winkler bonus for common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Match entity by EIN (Employer Identification Number).
 */
export async function matchByEIN(ein: string): Promise<string | null> {
  try {
    const results = await db
      .select({ id: graphEntities.id })
      .from(graphEntities)
      .where(sql`${graphEntities.attributes}->>'ein' = ${ein}`)
      .limit(1);
    return results.length > 0 ? results[0].id : null;
  } catch (error) {
    console.error("[EntityResolution] EIN match error:", error);
    return null;
  }
}

/**
 * Match entity by CIK (SEC Central Index Key).
 */
export async function matchByCIK(cik: string): Promise<string | null> {
  try {
    const results = await db
      .select({ id: graphEntities.id })
      .from(graphEntities)
      .where(sql`${graphEntities.attributes}->>'cik' = ${cik}`)
      .limit(1);
    return results.length > 0 ? results[0].id : null;
  } catch (error) {
    console.error("[EntityResolution] CIK match error:", error);
    return null;
  }
}

/**
 * Match entity by FEC committee/candidate ID.
 */
export async function matchByFECId(fecId: string): Promise<string | null> {
  try {
    const results = await db
      .select({ id: graphEntities.id })
      .from(graphEntities)
      .where(sql`${graphEntities.attributes}->>'fecId' = ${fecId}`)
      .limit(1);
    return results.length > 0 ? results[0].id : null;
  } catch (error) {
    console.error("[EntityResolution] FEC ID match error:", error);
    return null;
  }
}

/**
 * Core entity resolution function.
 * Resolves a candidate entity against the existing knowledge graph.
 *
 * Resolution order:
 * 1. Exact name match
 * 2. Identifier match (EIN, CIK, FEC ID)
 * 3. Fuzzy name match (Jaro-Winkler > 0.85)
 * 4. Create new entity
 */
export async function resolveEntity(candidate: EntityCandidate): Promise<ResolvedEntity> {
  try {
    // 1. Exact name match
    const exactMatches = await db
      .select({ id: graphEntities.id })
      .from(graphEntities)
      .where(ilike(graphEntities.name, candidate.name))
      .limit(1);

    if (exactMatches.length > 0) {
      // Update with new source attributes
      await mergeAttributes(exactMatches[0].id, candidate);
      return {
        isNew: false,
        entityId: exactMatches[0].id,
        confidence: 1.0,
        matchedBy: "exact",
      };
    }

    // 2. Identifier match
    if (candidate.identifiers) {
      if (candidate.identifiers.ein) {
        const id = await matchByEIN(candidate.identifiers.ein);
        if (id) {
          await mergeAttributes(id, candidate);
          return { isNew: false, entityId: id, confidence: 0.99, matchedBy: "identifier" };
        }
      }
      if (candidate.identifiers.cik) {
        const id = await matchByCIK(candidate.identifiers.cik);
        if (id) {
          await mergeAttributes(id, candidate);
          return { isNew: false, entityId: id, confidence: 0.99, matchedBy: "identifier" };
        }
      }
      if (candidate.identifiers.fecId) {
        const id = await matchByFECId(candidate.identifiers.fecId);
        if (id) {
          await mergeAttributes(id, candidate);
          return { isNew: false, entityId: id, confidence: 0.99, matchedBy: "identifier" };
        }
      }
    }

    // 3. Fuzzy name match against existing entities of the same type
    const typeFilter = ["person", "organization", "committee"].includes(candidate.type)
      ? candidate.type
      : undefined;

    const potentialMatches = await db
      .select({ id: graphEntities.id, name: graphEntities.name, aliases: graphEntities.aliases })
      .from(graphEntities)
      .where(typeFilter ? eq(graphEntities.type, typeFilter as any) : sql`true`)
      .limit(500);

    let bestMatch: { id: string; score: number } | null = null;

    for (const entity of potentialMatches) {
      // Check main name
      const nameScore = fuzzyMatch(candidate.name, entity.name);
      if (nameScore > (bestMatch?.score ?? 0.85)) {
        bestMatch = { id: entity.id, score: nameScore };
      }

      // Check aliases
      const aliases = (entity.aliases as string[]) || [];
      for (const alias of aliases) {
        const aliasScore = fuzzyMatch(candidate.name, alias);
        if (aliasScore > (bestMatch?.score ?? 0.85)) {
          bestMatch = { id: entity.id, score: aliasScore };
        }
      }
    }

    if (bestMatch) {
      await mergeAttributes(bestMatch.id, candidate);
      return {
        isNew: false,
        entityId: bestMatch.id,
        confidence: bestMatch.score,
        matchedBy: "fuzzy",
      };
    }

    // 4. Create new entity
    const newEntity = await db
      .insert(graphEntities)
      .values({
        type: mapOSINTTypeToGraphType(candidate.type) as any,
        name: candidate.name,
        aliases: candidate.aliases || [],
        description: `Discovered from ${candidate.source}`,
        attributes: {
          ...candidate.attributes,
          ...candidate.identifiers,
          sources: [candidate.source],
          discoveredAt: new Date().toISOString(),
        },
        importance: 5,
        mentionCount: 1,
      })
      .returning({ id: graphEntities.id });

    console.log(`[EntityResolution] Created new entity: ${candidate.name} (${candidate.type}) from ${candidate.source}`);

    return {
      isNew: true,
      entityId: newEntity[0].id,
      confidence: 1.0,
      matchedBy: "new",
    };
  } catch (error) {
    console.error("[EntityResolution] Error resolving entity:", error);
    throw error;
  }
}

/**
 * Merge new attributes and aliases into an existing entity.
 */
async function mergeAttributes(entityId: string, candidate: EntityCandidate): Promise<void> {
  try {
    const existing = await db
      .select({ attributes: graphEntities.attributes, aliases: graphEntities.aliases, mentionCount: graphEntities.mentionCount })
      .from(graphEntities)
      .where(eq(graphEntities.id, entityId))
      .limit(1);

    if (existing.length === 0) return;

    const currentAttrs = (existing[0].attributes as Record<string, unknown>) || {};
    const currentAliases = (existing[0].aliases as string[]) || [];
    const currentSources = (currentAttrs.sources as string[]) || [];

    // Merge attributes
    const mergedAttrs = {
      ...currentAttrs,
      ...candidate.attributes,
      ...candidate.identifiers,
      sources: [...new Set([...currentSources, candidate.source])],
      lastUpdated: new Date().toISOString(),
    };

    // Merge aliases
    const newAliases = candidate.aliases || [];
    const mergedAliases = [...new Set([...currentAliases, ...newAliases])];

    await db
      .update(graphEntities)
      .set({
        attributes: mergedAttrs,
        aliases: mergedAliases,
        mentionCount: (existing[0].mentionCount || 0) + 1,
      })
      .where(eq(graphEntities.id, entityId));
  } catch (error) {
    console.error("[EntityResolution] Error merging attributes:", error);
  }
}

/**
 * Map OSINT entity types to the existing graph entity types.
 */
function mapOSINTTypeToGraphType(type: OSINTEntityType): string {
  switch (type) {
    case "person": return "person";
    case "organization": return "organization";
    case "committee": return "organization";
    case "contract": return "event";
    case "filing": return "event";
    case "location": return "location";
    case "topic": return "topic";
    default: return "organization";
  }
}

/**
 * Merge two entities (mark duplicate as alias of primary).
 */
export async function mergeEntities(primaryId: string, duplicateId: string): Promise<void> {
  try {
    const [primary, duplicate] = await Promise.all([
      db.select().from(graphEntities).where(eq(graphEntities.id, primaryId)).limit(1),
      db.select().from(graphEntities).where(eq(graphEntities.id, duplicateId)).limit(1),
    ]);

    if (primary.length === 0 || duplicate.length === 0) return;

    // Add duplicate name as alias
    const aliases = [...new Set([
      ...((primary[0].aliases as string[]) || []),
      duplicate[0].name,
      ...((duplicate[0].aliases as string[]) || []),
    ])];

    // Merge attributes
    const mergedAttrs = {
      ...((duplicate[0].attributes as Record<string, unknown>) || {}),
      ...((primary[0].attributes as Record<string, unknown>) || {}),
    };

    await db
      .update(graphEntities)
      .set({ aliases, attributes: mergedAttrs })
      .where(eq(graphEntities.id, primaryId));

    // Reassign all relationships from duplicate to primary
    await db
      .update(graphRelationships)
      .set({ sourceEntityId: primaryId })
      .where(eq(graphRelationships.sourceEntityId, duplicateId));

    await db
      .update(graphRelationships)
      .set({ targetEntityId: primaryId })
      .where(eq(graphRelationships.targetEntityId, duplicateId));

    // Delete the duplicate
    await db.delete(graphEntities).where(eq(graphEntities.id, duplicateId));

    console.log(`[EntityResolution] Merged entity ${duplicate[0].name} into ${primary[0].name}`);
  } catch (error) {
    console.error("[EntityResolution] Error merging entities:", error);
  }
}

/**
 * Find potential duplicate entities based on fuzzy matching.
 */
export async function findDuplicates(
  threshold: number = 0.85
): Promise<Array<{ entities: [string, string]; names: [string, string]; score: number }>> {
  try {
    const allEntities = await db
      .select({ id: graphEntities.id, name: graphEntities.name })
      .from(graphEntities)
      .limit(1000);

    const duplicates: Array<{ entities: [string, string]; names: [string, string]; score: number }> = [];

    for (let i = 0; i < allEntities.length; i++) {
      for (let j = i + 1; j < allEntities.length; j++) {
        const score = fuzzyMatch(allEntities[i].name, allEntities[j].name);
        if (score >= threshold && score < 1.0) {
          duplicates.push({
            entities: [allEntities[i].id, allEntities[j].id],
            names: [allEntities[i].name, allEntities[j].name],
            score,
          });
        }
      }
    }

    return duplicates.sort((a, b) => b.score - a.score);
  } catch (error) {
    console.error("[EntityResolution] Error finding duplicates:", error);
    return [];
  }
}
