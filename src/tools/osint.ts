/**
 * OSINT Tool Implementations
 *
 * Four tools exposed to the AI agent:
 * - osintSearch: Search across all public records APIs
 * - osintGraphQuery: Query the knowledge graph (Neo4j + Postgres)
 * - osintEnrich: Auto-enrich an entity from public records
 * - osintAnalyze: Analyze financial flows, networks, timelines
 */

import { env } from "../config/env";
import { db } from "../db";
import { graphEntities, graphRelationships } from "../db/schema";
import { eq, sql, ilike, desc } from "drizzle-orm";
import { PublicRecords } from "../integrations/public-records";
import {
  findEntitiesByName,
  getNeighbors,
  findShortestPath,
  getCommunities,
  runCustomCypher,
} from "../integrations/neo4j";
import {
  resolveEntity,
  findDuplicates,
  mergeEntities,
  type EntityCandidate,
} from "../core/intelligence/entity-resolution";
import { enrichEntity, batchEnrich } from "../core/intelligence/enrichment-pipeline";

const LOG_PREFIX = "[OSINT:Tools]";

// Lazy singleton
let _pr: PublicRecords | null = null;
function getPublicRecords(): PublicRecords {
  if (!_pr) _pr = new PublicRecords();
  return _pr;
}

function requireOSINT(): void {
  if (!env.OSINT_ENABLED) {
    throw new Error("OSINT features are disabled. Set OSINT_ENABLED=true in .env");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ValidSource = "fec" | "irs990" | "usaspending" | "sec" | "opencorporates";

const ALL_SOURCES: ValidSource[] = ["fec", "irs990", "usaspending", "sec", "opencorporates"];

/**
 * Determine the entity type from a public-records source record.
 * FEC candidates are persons, committees and organizations are organizations, etc.
 */
function inferEntityType(
  source: ValidSource,
  record: Record<string, unknown>,
): EntityCandidate["type"] {
  if (source === "fec") {
    if (record.candidateId) return "person";
    return "committee";
  }
  if (source === "sec") return "organization";
  if (source === "opencorporates") return "organization";
  if (source === "irs990") return "organization";
  if (source === "usaspending") {
    // Recipients are organizations; awards are contracts
    if (record.recipientId || record.name) return "organization";
    return "organization";
  }
  return "organization";
}

/**
 * Build an EntityCandidate from a raw public-records result.
 */
function toEntityCandidate(
  source: ValidSource,
  record: Record<string, unknown>,
): EntityCandidate | null {
  const name =
    (record.name as string) ??
    (record.recipientName as string) ??
    (record.committeeName as string) ??
    null;

  if (!name) return null;

  const candidate: EntityCandidate = {
    name,
    type: inferEntityType(source, record),
    source,
    identifiers: {},
    attributes: {},
  };

  // Populate known identifiers
  if (record.ein) candidate.identifiers!.ein = String(record.ein);
  if (record.cik) candidate.identifiers!.cik = String(record.cik);
  if (record.candidateId) candidate.identifiers!.fecId = String(record.candidateId);
  if (record.committeeId) candidate.identifiers!.fecId = String(record.committeeId);
  if (record.duns) candidate.identifiers!.duns = String(record.duns);
  if (record.uei || record.recipientUei) {
    candidate.identifiers!.uei = String(record.uei ?? record.recipientUei);
  }

  // Stash the full raw record as attributes for later enrichment
  candidate.attributes = { ...record };

  return candidate;
}

// ---------------------------------------------------------------------------
// 1. osintSearch
// ---------------------------------------------------------------------------

export async function osintSearch(input: {
  query: string;
  sources?: string[];
  entity_type?: string; // "person" | "organization" | "committee"
}): Promise<{ results: any[]; sources_queried: string[]; total: number }> {
  try {
    requireOSINT();

    const { query, entity_type } = input;
    const requestedSources = (input.sources ?? ALL_SOURCES).filter((s) =>
      ALL_SOURCES.includes(s as ValidSource),
    ) as ValidSource[];

    if (requestedSources.length === 0) {
      return { results: [], sources_queried: [], total: 0 };
    }

    const pr = getPublicRecords();
    console.log(`${LOG_PREFIX} Searching "${query}" across [${requestedSources.join(", ")}]`);

    // Build per-source search promises
    const searchTasks: Array<{
      source: ValidSource;
      promise: Promise<any[]>;
    }> = [];

    for (const source of requestedSources) {
      switch (source) {
        case "fec": {
          // Search candidates and committees in parallel
          const p = Promise.all([
            pr.fec.searchCandidates(query).catch(() => []),
            pr.fec.searchCommittees(query).catch(() => []),
          ]).then(([candidates, committees]) => [
            ...candidates.map((c: any) => ({ ...c, _source: "fec", _type: "candidate" })),
            ...committees.map((c: any) => ({ ...c, _source: "fec", _type: "committee" })),
          ]);
          searchTasks.push({ source: "fec", promise: p });
          break;
        }
        case "irs990": {
          const p = pr.irs990
            .searchOrganizations(query)
            .then((orgs) => orgs.map((o: any) => ({ ...o, _source: "irs990", _type: "nonprofit" })))
            .catch(() => []);
          searchTasks.push({ source: "irs990", promise: p });
          break;
        }
        case "usaspending": {
          const p = Promise.all([
            pr.usaspending.searchRecipients(query).catch(() => []),
            pr.usaspending.searchAwards({ keyword: query }).catch(() => []),
          ]).then(([recipients, awards]) => [
            ...recipients.map((r: any) => ({ ...r, _source: "usaspending", _type: "recipient" })),
            ...awards.map((a: any) => ({ ...a, _source: "usaspending", _type: "award" })),
          ]);
          searchTasks.push({ source: "usaspending", promise: p });
          break;
        }
        case "sec": {
          const p = pr.sec
            .searchCompanies(query)
            .then((cos) => cos.map((c: any) => ({ ...c, _source: "sec", _type: "company" })))
            .catch(() => []);
          searchTasks.push({ source: "sec", promise: p });
          break;
        }
        case "opencorporates": {
          const p = pr.opencorporates
            .searchCompanies(query)
            .then((cos) =>
              cos.map((c: any) => ({ ...c, _source: "opencorporates", _type: "corporate" })),
            )
            .catch(() => []);
          searchTasks.push({ source: "opencorporates", promise: p });
          break;
        }
      }
    }

    // Execute all in parallel with allSettled so one failure doesn't kill the rest
    const settled = await Promise.allSettled(searchTasks.map((t) => t.promise));

    const combinedResults: any[] = [];
    const sourcesQueried: string[] = [];

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      const source = searchTasks[i].source;
      sourcesQueried.push(source);

      if (outcome.status === "fulfilled" && Array.isArray(outcome.value)) {
        combinedResults.push(...outcome.value);
      } else if (outcome.status === "rejected") {
        console.error(`${LOG_PREFIX} Search failed for source=${source}:`, outcome.reason);
      }
    }

    // Filter by entity_type if specified
    let filteredResults = combinedResults;
    if (entity_type) {
      filteredResults = combinedResults.filter((r) => {
        if (entity_type === "person") {
          return r._type === "candidate";
        }
        if (entity_type === "committee") {
          return r._type === "committee";
        }
        if (entity_type === "organization") {
          return ["nonprofit", "recipient", "company", "corporate", "committee"].includes(r._type);
        }
        return true;
      });
    }

    // Auto-resolve discovered entities into the knowledge graph (best-effort, non-blocking)
    const resolvePromises: Promise<void>[] = [];
    for (const record of filteredResults) {
      const candidate = toEntityCandidate(record._source as ValidSource, record);
      if (candidate) {
        resolvePromises.push(
          resolveEntity(candidate)
            .then((resolved) => {
              record._entityId = resolved.entityId;
              record._entityIsNew = resolved.isNew;
              record._entityConfidence = resolved.confidence;
            })
            .catch((err) => {
              console.error(`${LOG_PREFIX} Entity resolution failed for "${candidate.name}":`, err);
            }),
        );
      }
    }
    await Promise.allSettled(resolvePromises);

    console.log(
      `${LOG_PREFIX} Search complete: ${filteredResults.length} result(s) from ${sourcesQueried.length} source(s)`,
    );

    return {
      results: filteredResults,
      sources_queried: sourcesQueried,
      total: filteredResults.length,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} osintSearch error:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 2. osintGraphQuery
// ---------------------------------------------------------------------------

export async function osintGraphQuery(input: {
  action: "search" | "neighbors" | "path" | "communities" | "cypher" | "duplicates" | "merge";
  entity_id?: string;
  entity_name?: string;
  target_id?: string;
  depth?: number;
  cypher?: string;
  threshold?: number;
}): Promise<any> {
  try {
    requireOSINT();

    const { action, entity_id, entity_name, target_id, depth, cypher, threshold } = input;
    console.log(`${LOG_PREFIX} Graph query: action=${action}`);

    switch (action) {
      // -----------------------------------------------------------------------
      // Search entities by name (fuzzy via Neo4j, fallback to Postgres ilike)
      // -----------------------------------------------------------------------
      case "search": {
        if (!entity_name) {
          return { error: "entity_name is required for search action" };
        }

        // Attempt Neo4j fuzzy first, then Postgres ilike
        let entities = await findEntitiesByName(entity_name, true);

        // If Neo4j returned nothing, try Postgres directly with broader ilike
        if (entities.length === 0) {
          const pgRows = await db
            .select()
            .from(graphEntities)
            .where(ilike(graphEntities.name, `%${entity_name}%`))
            .limit(25);

          entities = pgRows.map((r) => ({
            pgId: r.id,
            type: r.type as any,
            name: r.name,
            aliases: (r.aliases as string[]) ?? [],
            description: r.description ?? undefined,
            attributes: (r.attributes as Record<string, unknown>) ?? {},
            importance: r.importance ?? 50,
          }));
        }

        return {
          action: "search",
          query: entity_name,
          results: entities,
          total: entities.length,
        };
      }

      // -----------------------------------------------------------------------
      // Get neighborhood of an entity
      // -----------------------------------------------------------------------
      case "neighbors": {
        if (!entity_id) {
          return { error: "entity_id is required for neighbors action" };
        }

        const result = await getNeighbors(entity_id, depth ?? 2);

        return {
          action: "neighbors",
          entity_id,
          depth: depth ?? 2,
          nodes: result.nodes,
          edges: result.edges,
          node_count: result.nodes.length,
          edge_count: result.edges.length,
        };
      }

      // -----------------------------------------------------------------------
      // Find shortest path between two entities
      // -----------------------------------------------------------------------
      case "path": {
        if (!entity_id || !target_id) {
          return { error: "entity_id and target_id are required for path action" };
        }

        const pathResult = await findShortestPath(entity_id, target_id);

        if (!pathResult) {
          return {
            action: "path",
            source_id: entity_id,
            target_id,
            found: false,
            message: "No path found between the two entities",
          };
        }

        return {
          action: "path",
          source_id: entity_id,
          target_id,
          found: true,
          length: pathResult.length,
          nodes: pathResult.nodes,
          edges: pathResult.edges,
        };
      }

      // -----------------------------------------------------------------------
      // Get connected components / communities
      // -----------------------------------------------------------------------
      case "communities": {
        const communities = await getCommunities();

        return {
          action: "communities",
          communities: communities.map((c) => ({
            id: c.id,
            size: c.members.length,
            members: c.members,
          })),
          total: communities.length,
        };
      }

      // -----------------------------------------------------------------------
      // Run a read-only custom Cypher query
      // -----------------------------------------------------------------------
      case "cypher": {
        if (!cypher) {
          return { error: "cypher query string is required for cypher action" };
        }

        // Safety: reject write operations in custom queries
        const upperCypher = cypher.toUpperCase();
        const writeKeywords = ["CREATE", "MERGE", "DELETE", "SET", "REMOVE", "DROP", "DETACH"];
        for (const keyword of writeKeywords) {
          if (upperCypher.includes(keyword)) {
            return {
              error: `Write operations are not allowed in custom Cypher. Found keyword: ${keyword}`,
            };
          }
        }

        const records = await runCustomCypher(cypher);

        return {
          action: "cypher",
          query: cypher,
          records,
          total: records.length,
        };
      }

      // -----------------------------------------------------------------------
      // Find potential duplicate entities
      // -----------------------------------------------------------------------
      case "duplicates": {
        const duplicates = await findDuplicates(threshold ?? 0.85);

        return {
          action: "duplicates",
          threshold: threshold ?? 0.85,
          duplicates,
          total: duplicates.length,
        };
      }

      // -----------------------------------------------------------------------
      // Merge two entities
      // -----------------------------------------------------------------------
      case "merge": {
        if (!entity_id || !target_id) {
          return { error: "entity_id (primary) and target_id (duplicate) are required for merge action" };
        }

        await mergeEntities(entity_id, target_id);

        return {
          action: "merge",
          primary_id: entity_id,
          merged_id: target_id,
          success: true,
          message: `Entity ${target_id} has been merged into ${entity_id}`,
        };
      }

      default:
        return { error: `Unknown graph query action: ${action}` };
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} osintGraphQuery error:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 3. osintEnrich
// ---------------------------------------------------------------------------

export async function osintEnrich(input: {
  entity_id?: string;
  entity_name?: string;
  sources?: string[];
  depth?: number;
}): Promise<any> {
  try {
    requireOSINT();

    let { entity_id, entity_name, sources, depth } = input;

    // If we have a name but no id, resolve the entity first
    if (!entity_id && entity_name) {
      console.log(`${LOG_PREFIX} Resolving entity by name: "${entity_name}"`);

      const candidate: EntityCandidate = {
        name: entity_name,
        type: "organization", // default; resolution will match existing type
        source: "manual",
      };

      const resolved = await resolveEntity(candidate);
      entity_id = resolved.entityId;

      console.log(
        `${LOG_PREFIX} Resolved "${entity_name}" -> ${entity_id} (${resolved.matchedBy}, confidence=${resolved.confidence})`,
      );
    }

    if (!entity_id) {
      return { error: "Either entity_id or entity_name is required" };
    }

    console.log(`${LOG_PREFIX} Enriching entity ${entity_id} from sources=[${(sources ?? ["all"]).join(", ")}]`);

    const result = await enrichEntity(entity_id, sources, depth);

    return {
      entity_id,
      entity_name: entity_name ?? null,
      enrichment: result,
      success: true,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} osintEnrich error:`, error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 4. osintAnalyze
// ---------------------------------------------------------------------------

export async function osintAnalyze(input: {
  action: "financial_flow" | "network_analysis" | "timeline" | "report";
  entity_id?: string;
  options?: Record<string, unknown>;
}): Promise<any> {
  try {
    requireOSINT();

    const { action, entity_id, options } = input;
    console.log(`${LOG_PREFIX} Analyze: action=${action}, entity_id=${entity_id ?? "none"}`);

    switch (action) {
      // -----------------------------------------------------------------------
      // financial_flow — Trace money through the entity graph
      // -----------------------------------------------------------------------
      case "financial_flow": {
        if (!entity_id) {
          return { error: "entity_id is required for financial_flow analysis" };
        }

        // Get the entity itself
        const [entity] = await db
          .select()
          .from(graphEntities)
          .where(eq(graphEntities.id, entity_id))
          .limit(1);

        if (!entity) {
          return { error: `Entity ${entity_id} not found` };
        }

        // Retrieve all relationships touching this entity that have financial attributes
        const outgoing = await db
          .select({
            relId: graphRelationships.id,
            relType: graphRelationships.type,
            relAttributes: graphRelationships.attributes,
            relContext: graphRelationships.context,
            relStrength: graphRelationships.strength,
            targetId: graphRelationships.targetEntityId,
            targetName: graphEntities.name,
            targetType: graphEntities.type,
          })
          .from(graphRelationships)
          .innerJoin(graphEntities, eq(graphRelationships.targetEntityId, graphEntities.id))
          .where(eq(graphRelationships.sourceEntityId, entity_id));

        const incoming = await db
          .select({
            relId: graphRelationships.id,
            relType: graphRelationships.type,
            relAttributes: graphRelationships.attributes,
            relContext: graphRelationships.context,
            relStrength: graphRelationships.strength,
            sourceId: graphRelationships.sourceEntityId,
            sourceName: graphEntities.name,
            sourceType: graphEntities.type,
          })
          .from(graphRelationships)
          .innerJoin(graphEntities, eq(graphRelationships.sourceEntityId, graphEntities.id))
          .where(eq(graphRelationships.targetEntityId, entity_id));

        // Extract financial data from relationship attributes
        const financialFlows: Array<{
          direction: "outgoing" | "incoming";
          counterparty: { id: string; name: string; type: string };
          relationship_type: string;
          amount: number | null;
          date: string | null;
          description: string | null;
        }> = [];

        for (const rel of outgoing) {
          const attrs = (rel.relAttributes as Record<string, unknown>) ?? {};
          const amount =
            typeof attrs.amount === "number"
              ? attrs.amount
              : typeof attrs.totalObligationAmount === "number"
                ? attrs.totalObligationAmount
                : null;

          financialFlows.push({
            direction: "outgoing",
            counterparty: {
              id: rel.targetId,
              name: rel.targetName,
              type: rel.targetType,
            },
            relationship_type: rel.relType,
            amount,
            date: (attrs.date as string) ?? (attrs.dateOfAward as string) ?? null,
            description: rel.relContext ?? (attrs.description as string) ?? null,
          });
        }

        for (const rel of incoming) {
          const attrs = (rel.relAttributes as Record<string, unknown>) ?? {};
          const amount =
            typeof attrs.amount === "number"
              ? attrs.amount
              : typeof attrs.totalObligationAmount === "number"
                ? attrs.totalObligationAmount
                : null;

          financialFlows.push({
            direction: "incoming",
            counterparty: {
              id: rel.sourceId,
              name: rel.sourceName,
              type: rel.sourceType,
            },
            relationship_type: rel.relType,
            amount,
            date: (attrs.date as string) ?? (attrs.dateOfAward as string) ?? null,
            description: rel.relContext ?? (attrs.description as string) ?? null,
          });
        }

        // Compute summary
        const totalIncoming = financialFlows
          .filter((f) => f.direction === "incoming" && f.amount !== null)
          .reduce((sum, f) => sum + (f.amount ?? 0), 0);

        const totalOutgoing = financialFlows
          .filter((f) => f.direction === "outgoing" && f.amount !== null)
          .reduce((sum, f) => sum + (f.amount ?? 0), 0);

        return {
          action: "financial_flow",
          entity: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
          },
          flows: financialFlows.sort((a, b) => {
            // Sort by amount descending, nulls last
            if (a.amount === null && b.amount === null) return 0;
            if (a.amount === null) return 1;
            if (b.amount === null) return -1;
            return Math.abs(b.amount) - Math.abs(a.amount);
          }),
          summary: {
            total_incoming: totalIncoming,
            total_outgoing: totalOutgoing,
            net_flow: totalIncoming - totalOutgoing,
            incoming_count: financialFlows.filter((f) => f.direction === "incoming").length,
            outgoing_count: financialFlows.filter((f) => f.direction === "outgoing").length,
            total_relationships: financialFlows.length,
          },
        };
      }

      // -----------------------------------------------------------------------
      // network_analysis — Centrality and connectivity analysis
      // -----------------------------------------------------------------------
      case "network_analysis": {
        if (!entity_id) {
          return { error: "entity_id is required for network_analysis" };
        }

        const analysisDepth = (options?.depth as number) ?? 3;

        // Get deep neighborhood
        const neighborhood = await getNeighbors(entity_id, analysisDepth);

        // Get the root entity
        const [rootEntity] = await db
          .select()
          .from(graphEntities)
          .where(eq(graphEntities.id, entity_id))
          .limit(1);

        if (!rootEntity) {
          return { error: `Entity ${entity_id} not found` };
        }

        // Count connections per node to approximate degree centrality
        const connectionCounts = new Map<string, number>();
        for (const edge of neighborhood.edges) {
          connectionCounts.set(
            edge.sourcePgId,
            (connectionCounts.get(edge.sourcePgId) ?? 0) + 1,
          );
          connectionCounts.set(
            edge.targetPgId,
            (connectionCounts.get(edge.targetPgId) ?? 0) + 1,
          );
        }

        // Sort nodes by connection count (most connected first)
        const rankedNodes = neighborhood.nodes
          .map((node) => ({
            ...node,
            connections: connectionCounts.get(node.pgId) ?? 0,
          }))
          .sort((a, b) => b.connections - a.connections);

        // Group by type
        const typeDistribution: Record<string, number> = {};
        for (const node of neighborhood.nodes) {
          typeDistribution[node.type] = (typeDistribution[node.type] ?? 0) + 1;
        }

        // Group edges by type
        const edgeTypeDistribution: Record<string, number> = {};
        for (const edge of neighborhood.edges) {
          edgeTypeDistribution[edge.type] = (edgeTypeDistribution[edge.type] ?? 0) + 1;
        }

        // Identify hub nodes (top 10 most connected)
        const hubs = rankedNodes.slice(0, 10);

        return {
          action: "network_analysis",
          entity: {
            id: rootEntity.id,
            name: rootEntity.name,
            type: rootEntity.type,
            connections: connectionCounts.get(entity_id) ?? 0,
          },
          depth: analysisDepth,
          network: {
            total_nodes: neighborhood.nodes.length,
            total_edges: neighborhood.edges.length,
            density:
              neighborhood.nodes.length > 1
                ? (
                    (2 * neighborhood.edges.length) /
                    (neighborhood.nodes.length * (neighborhood.nodes.length - 1))
                  ).toFixed(4)
                : "0",
            node_type_distribution: typeDistribution,
            edge_type_distribution: edgeTypeDistribution,
          },
          hubs,
          all_nodes: rankedNodes,
        };
      }

      // -----------------------------------------------------------------------
      // timeline — Build chronological timeline of events
      // -----------------------------------------------------------------------
      case "timeline": {
        if (!entity_id) {
          return { error: "entity_id is required for timeline analysis" };
        }

        // Get the entity
        const [entity] = await db
          .select()
          .from(graphEntities)
          .where(eq(graphEntities.id, entity_id))
          .limit(1);

        if (!entity) {
          return { error: `Entity ${entity_id} not found` };
        }

        // Gather all relationships involving this entity
        const allRels = await db
          .select({
            relId: graphRelationships.id,
            relType: graphRelationships.type,
            relAttributes: graphRelationships.attributes,
            relContext: graphRelationships.context,
            relCreatedAt: graphRelationships.createdAt,
            sourceId: graphRelationships.sourceEntityId,
            targetId: graphRelationships.targetEntityId,
          })
          .from(graphRelationships)
          .where(
            sql`${graphRelationships.sourceEntityId} = ${entity_id}
                OR ${graphRelationships.targetEntityId} = ${entity_id}`,
          );

        // Extract entity IDs we need names for
        const relatedIds = new Set<string>();
        for (const rel of allRels) {
          relatedIds.add(rel.sourceId);
          relatedIds.add(rel.targetId);
        }
        relatedIds.delete(entity_id);

        // Batch fetch names
        const nameMap = new Map<string, string>();
        nameMap.set(entity_id, entity.name);

        if (relatedIds.size > 0) {
          const idArray = Array.from(relatedIds);
          const related = await db
            .select({ id: graphEntities.id, name: graphEntities.name })
            .from(graphEntities)
            .where(sql`${graphEntities.id} IN ${idArray}`);

          for (const r of related) {
            nameMap.set(r.id, r.name);
          }
        }

        // Build timeline events
        const events: Array<{
          date: string | null;
          type: string;
          description: string;
          counterparty: string;
          attributes: Record<string, unknown>;
        }> = [];

        for (const rel of allRels) {
          const attrs = (rel.relAttributes as Record<string, unknown>) ?? {};
          const counterpartyId =
            rel.sourceId === entity_id ? rel.targetId : rel.sourceId;
          const counterpartyName = nameMap.get(counterpartyId) ?? counterpartyId;
          const direction = rel.sourceId === entity_id ? "to" : "from";

          // Try to extract a date from attributes or context
          const date =
            (attrs.date as string) ??
            (attrs.dateOfAward as string) ??
            (attrs.filingDate as string) ??
            (attrs.transactionDate as string) ??
            (attrs.incorporationDate as string) ??
            (attrs.startDate as string) ??
            null;

          events.push({
            date,
            type: rel.relType,
            description:
              rel.relContext ??
              `${rel.relType} ${direction} ${counterpartyName}`,
            counterparty: counterpartyName,
            attributes: attrs,
          });
        }

        // Also include entity creation and key attributes as events
        const entityAttrs = (entity.attributes as Record<string, unknown>) ?? {};
        if (entityAttrs.discoveredAt) {
          events.push({
            date: entityAttrs.discoveredAt as string,
            type: "entity_discovered",
            description: `Entity "${entity.name}" discovered from ${(entityAttrs.sources as string[])?.join(", ") ?? "unknown source"}`,
            counterparty: "",
            attributes: {},
          });
        }

        // Sort chronologically (null dates go to the end)
        events.sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        });

        return {
          action: "timeline",
          entity: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
          },
          events,
          total_events: events.length,
          date_range: {
            earliest: events.find((e) => e.date)?.date ?? null,
            latest: [...events].reverse().find((e) => e.date)?.date ?? null,
          },
        };
      }

      // -----------------------------------------------------------------------
      // report — Generate a structured OSINT dossier
      // -----------------------------------------------------------------------
      case "report": {
        if (!entity_id) {
          return { error: "entity_id is required for report generation" };
        }

        // Fetch the entity
        const [entity] = await db
          .select()
          .from(graphEntities)
          .where(eq(graphEntities.id, entity_id))
          .limit(1);

        if (!entity) {
          return { error: `Entity ${entity_id} not found` };
        }

        const entityAttrs = (entity.attributes as Record<string, unknown>) ?? {};

        // Get neighborhood (depth 2 for relationships)
        const neighborhood = await getNeighbors(entity_id, 2);

        // Get all direct relationships with full details
        const outgoingRels = await db
          .select({
            relType: graphRelationships.type,
            relAttributes: graphRelationships.attributes,
            relContext: graphRelationships.context,
            relStrength: graphRelationships.strength,
            targetId: graphRelationships.targetEntityId,
            targetName: graphEntities.name,
            targetType: graphEntities.type,
          })
          .from(graphRelationships)
          .innerJoin(graphEntities, eq(graphRelationships.targetEntityId, graphEntities.id))
          .where(eq(graphRelationships.sourceEntityId, entity_id));

        const incomingRels = await db
          .select({
            relType: graphRelationships.type,
            relAttributes: graphRelationships.attributes,
            relContext: graphRelationships.context,
            relStrength: graphRelationships.strength,
            sourceId: graphRelationships.sourceEntityId,
            sourceName: graphEntities.name,
            sourceType: graphEntities.type,
          })
          .from(graphRelationships)
          .innerJoin(graphEntities, eq(graphRelationships.sourceEntityId, graphEntities.id))
          .where(eq(graphRelationships.targetEntityId, entity_id));

        // Compute financial summary from relationships
        let totalFinancialIn = 0;
        let totalFinancialOut = 0;

        for (const rel of incomingRels) {
          const attrs = (rel.relAttributes as Record<string, unknown>) ?? {};
          const amount =
            typeof attrs.amount === "number"
              ? attrs.amount
              : typeof attrs.totalObligationAmount === "number"
                ? attrs.totalObligationAmount
                : 0;
          totalFinancialIn += amount;
        }

        for (const rel of outgoingRels) {
          const attrs = (rel.relAttributes as Record<string, unknown>) ?? {};
          const amount =
            typeof attrs.amount === "number"
              ? attrs.amount
              : typeof attrs.totalObligationAmount === "number"
                ? attrs.totalObligationAmount
                : 0;
          totalFinancialOut += amount;
        }

        // Build the report
        return {
          action: "report",
          generated_at: new Date().toISOString(),
          entity: {
            id: entity.id,
            name: entity.name,
            type: entity.type,
            aliases: (entity.aliases as string[]) ?? [],
            description: entity.description,
            importance: entity.importance,
            mention_count: entity.mentionCount,
            created_at: entity.createdAt,
            updated_at: entity.updatedAt,
          },
          identifiers: {
            ein: entityAttrs.ein ?? null,
            cik: entityAttrs.cik ?? null,
            fec_id: entityAttrs.fecId ?? null,
            duns: entityAttrs.duns ?? null,
            uei: entityAttrs.uei ?? null,
          },
          sources: (entityAttrs.sources as string[]) ?? [],
          attributes: entityAttrs,
          relationships: {
            outgoing: outgoingRels.map((r) => ({
              type: r.relType,
              target: { id: r.targetId, name: r.targetName, type: r.targetType },
              strength: r.relStrength,
              context: r.relContext,
              attributes: r.relAttributes,
            })),
            incoming: incomingRels.map((r) => ({
              type: r.relType,
              source: { id: r.sourceId, name: r.sourceName, type: r.sourceType },
              strength: r.relStrength,
              context: r.relContext,
              attributes: r.relAttributes,
            })),
            total_outgoing: outgoingRels.length,
            total_incoming: incomingRels.length,
          },
          network_summary: {
            total_nodes_at_depth_2: neighborhood.nodes.length,
            total_edges_at_depth_2: neighborhood.edges.length,
          },
          financial_summary: {
            total_incoming: totalFinancialIn,
            total_outgoing: totalFinancialOut,
            net: totalFinancialIn - totalFinancialOut,
          },
        };
      }

      default:
        return { error: `Unknown analysis action: ${action}` };
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} osintAnalyze error:`, error);
    throw error;
  }
}
