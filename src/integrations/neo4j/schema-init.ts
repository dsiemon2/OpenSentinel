/**
 * Neo4j Schema Initialization
 *
 * Creates indexes and constraints that mirror / complement the Postgres
 * graph tables. All statements are idempotent (IF NOT EXISTS) so calling
 * this function multiple times is safe.
 */

import { getNeo4jClient } from "./client";

/**
 * Initialize Neo4j schema: constraints, indexes, and fulltext index.
 *
 * Safe to call on every startup — every statement uses IF NOT EXISTS.
 */
export async function initNeo4jSchema(): Promise<void> {
  const client = getNeo4jClient();

  const statements: { label: string; cypher: string }[] = [
    // ------------------------------------------------------------------
    // Unique constraint on Entity.pgId (the Postgres UUID, our join key)
    // ------------------------------------------------------------------
    {
      label: "Unique constraint on Entity.pgId",
      cypher:
        "CREATE CONSTRAINT entity_pgid_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.pgId IS UNIQUE",
    },

    // ------------------------------------------------------------------
    // Indexes for fast lookups
    // ------------------------------------------------------------------
    {
      label: "Index on Entity.name",
      cypher:
        "CREATE INDEX entity_name_idx IF NOT EXISTS FOR (e:Entity) ON (e.name)",
    },
    {
      label: "Index on Entity.type",
      cypher:
        "CREATE INDEX entity_type_idx IF NOT EXISTS FOR (e:Entity) ON (e.type)",
    },

    // ------------------------------------------------------------------
    // Fulltext index over Entity name + description (for fuzzy search)
    // ------------------------------------------------------------------
    {
      label: "Fulltext index on Entity name + description",
      cypher: `
        CREATE FULLTEXT INDEX entity_fulltext IF NOT EXISTS
        FOR (e:Entity) ON EACH [e.name, e.description]
      `,
    },
  ];

  for (const { label, cypher } of statements) {
    try {
      await client.runWrite(cypher);
      console.log("[Neo4j] Schema:", label, "- OK");
    } catch (err) {
      // Log but do not crash — the database may be read-only or the index
      // syntax unsupported on the current Neo4j edition.
      console.log("[Neo4j] Schema:", label, "- FAILED:", err);
    }
  }

  console.log("[Neo4j] Schema initialization complete");
}
