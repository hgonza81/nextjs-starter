import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireDatabaseUrl } from "@/lib/env.server";

/**
 * Private raw Drizzle client (ADR 0003). It is NOT exported from `src/db/index.ts`:
 * all queries go through `withRls` (FND-T-12) so they run in the caller's
 * security context. Importing this file outside `src/db` is forbidden (lint
 * rule in FND-T-37).
 *
 * `prepare: false` because the cloud URL goes through Supabase's transaction
 * pooler, which does not support prepared statements. `max: 1` because each
 * serverless instance should hold a single connection. The client is created
 * once at module scope. `requireDatabaseUrl()` throws a clear error the first
 * time this module is loaded without `DATABASE_URL` (the variable is optional
 * at startup in production).
 */
export const db = drizzle(
  postgres(requireDatabaseUrl(), { prepare: false, max: 1 }),
);
