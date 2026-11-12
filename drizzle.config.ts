import { defineConfig } from "drizzle-kit";

// Tooling-only connection as the migration role (ADR 0003). This file is read
// by `drizzle-kit pull` through `pnpm db:schema` (scripts/db-schema.ts). Only
// `pull` is used: `generate`, `migrate` and `push` are forbidden (ADR 0002),
// and `out` must never point at supabase/migrations.
const migrationUrl = process.env.DATABASE_MIGRATION_URL;
if (migrationUrl === undefined || migrationUrl === "") {
  throw new Error("DATABASE_MIGRATION_URL is required to run drizzle-kit.");
}

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: { url: migrationUrl },
  schemaFilter: ["public"],
  out: "src/db/schema",
});
