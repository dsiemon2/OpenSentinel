/**
 * Neo4j Integration
 *
 * Provides a dual-write graph layer backed by both Postgres (source of truth)
 * and Neo4j (optimised for traversals, shortest-path, and fulltext search).
 * Used by the OSINT pipeline and the general knowledge-graph features.
 */

// Client
export {
  Neo4jClient,
  getNeo4jClient,
  type Neo4jConfig,
} from "./client";

// Schema initialisation
export { initNeo4jSchema } from "./schema-init";

// Graph operations
export {
  createEntity,
  updateEntity,
  deleteEntity,
  findEntitiesByName,
  createRelationship,
  deleteRelationship,
  getNeighbors,
  findShortestPath,
  getCommunities,
  runCustomCypher,
  syncFromPostgres,
  type EntityType,
  type GraphEntity,
  type GraphRelationship,
  type NeighborNode,
  type NeighborEdge,
  type NeighborResult,
  type PathResult,
  type Community,
} from "./graph-ops";
