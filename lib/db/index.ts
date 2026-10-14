import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Disable prefetch — not supported for "Transaction" pool mode on
// Supabase's shared pooler.
const client = postgres(connectionString, { prepare: false });

// Cache the client across dev hot reloads so we don't leak connections.
const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
};

const dbClient = globalForDb.postgresClient ?? client;
if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = dbClient;
}

export const db = drizzle(dbClient, { schema });
