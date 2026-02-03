import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../config/env";

async function runMigrations() {
  console.log("Running migrations...");

  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);

  // Enable pgvector extension
  await client`CREATE EXTENSION IF NOT EXISTS vector`;

  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations complete!");
  await client.end();
}

runMigrations().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
