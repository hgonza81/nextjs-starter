// FND-FR-11 (database readiness): proves the app reaches the database through
// `withRls`, the only data path (ADR 0003). Unlike `/api/health` it needs
// DATABASE_URL, so it is meant for local development and CI; the deployed app
// has no database until a cloud project exists (ADR 0004).
// This route is the single allowed exception to "app code must not import
// `@/db`" (enforced by the lint rule in FND-T-37).
import { sql } from "drizzle-orm";

import { withAnonymousRls } from "@/db";
import { logger } from "@/lib/logger";

// Evaluated per request: a prerendered answer would hide a database outage.
export const dynamic = "force-dynamic";

/**
 * Readiness probe. 200 `{ "status": "ok", "role": "anon" }` when a query ran
 * as `anon`; 503 `{ "status": "unavailable" }` otherwise. The body and the
 * logs never contain connection details: the logger reduces the caught error
 * to its name and code.
 */
export async function GET(): Promise<Response> {
  try {
    const rows = await withAnonymousRls((tx) =>
      tx.execute<{ current_user: string }>(sql`select current_user`),
    );
    return Response.json({ status: "ok", role: rows[0]?.current_user });
  } catch (error) {
    // `exception` records only the error name and code, never the message.
    await logger.exception("health.db.failed", error);
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
