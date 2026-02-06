import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

// Lazy database connection — created on first access
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    _client = postgres(env.DATABASE_URL);
    _db = drizzle(_client, { schema });
  }
  return _db;
}

// Proxy preserves the `db.select()`, `db.insert()`, `db.execute()` access pattern
// so all existing consumer files work unchanged.
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as any,
  {
    get(_target, prop) {
      const instance = getDb();
      const value = (instance as any)[prop];
      if (typeof value === "function") {
        return value.bind(instance);
      }
      return value;
    },
  }
);

export * from "./schema";
