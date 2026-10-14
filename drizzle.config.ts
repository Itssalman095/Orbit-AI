import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env.local first (highest precedence), then .env as a fallback.
// dotenv does not override already-set variables, so .env.local wins.
config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});
