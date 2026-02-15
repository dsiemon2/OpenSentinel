/**
 * Neo4j Graph Database Client
 *
 * Provides a singleton driver for Neo4j, used by the OSINT knowledge-graph
 * pipeline and the general graph-ops layer. Reads connection details from
 * the shared env config (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD, NEO4J_DATABASE).
 */

import neo4j, {
  type Driver,
  type Session,
  type QueryResult,
  type RecordShape,
} from "neo4j-driver";
import { env } from "../../config/env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Neo4jConfig {
  uri?: string;
  user?: string;
  password?: string;
  database?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class Neo4jClient {
  private driver: Driver;
  private database: string;

  constructor(config?: Neo4jConfig) {
    const uri = config?.uri ?? env.NEO4J_URI;
    const user = config?.user ?? env.NEO4J_USER;
    const password = config?.password ?? env.NEO4J_PASSWORD;
    this.database = config?.database ?? env.NEO4J_DATABASE;

    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
      console.log("[Neo4j] Driver created for", uri);
    } catch (err) {
      console.log("[Neo4j] Failed to create driver:", err);
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Public helpers
  // -------------------------------------------------------------------------

  /**
   * Execute a read-only Cypher query and return the result records.
   */
  async runQuery<T extends RecordShape = RecordShape>(
    cypher: string,
    params?: Record<string, unknown>,
  ): Promise<QueryResult<T>> {
    const session = this.getSession("READ");
    try {
      const result = await session.run<T>(cypher, params ?? {});
      return result;
    } catch (err) {
      console.log("[Neo4j] Read query failed:", err);
      throw err;
    } finally {
      await session.close();
    }
  }

  /**
   * Execute a write Cypher query and return the result records.
   */
  async runWrite<T extends RecordShape = RecordShape>(
    cypher: string,
    params?: Record<string, unknown>,
  ): Promise<QueryResult<T>> {
    const session = this.getSession("WRITE");
    try {
      const result = await session.run<T>(cypher, params ?? {});
      return result;
    } catch (err) {
      console.log("[Neo4j] Write query failed:", err);
      throw err;
    } finally {
      await session.close();
    }
  }

  /**
   * Verify that the driver can reach the Neo4j server.
   */
  async verifyConnectivity(): Promise<boolean> {
    try {
      await this.driver.verifyConnectivity();
      console.log("[Neo4j] Connectivity verified");
      return true;
    } catch (err) {
      console.log("[Neo4j] Connectivity check failed:", err);
      return false;
    }
  }

  /**
   * Get a raw session for advanced use-cases (caller is responsible for closing).
   */
  getSession(defaultAccessMode: "READ" | "WRITE" = "READ"): Session {
    return this.driver.session({
      database: this.database,
      defaultAccessMode:
        defaultAccessMode === "READ" ? neo4j.session.READ : neo4j.session.WRITE,
    });
  }

  /**
   * Gracefully close the underlying driver.
   */
  async close(): Promise<void> {
    try {
      await this.driver.close();
      console.log("[Neo4j] Driver closed");
    } catch (err) {
      console.log("[Neo4j] Error closing driver:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: Neo4jClient | null = null;

/**
 * Returns a lazily-initialised Neo4jClient singleton.
 * Optionally pass config to override env defaults (only the first call wins).
 */
export function getNeo4jClient(config?: Neo4jConfig): Neo4jClient {
  if (!_instance) {
    _instance = new Neo4jClient(config);
  }
  return _instance;
}
