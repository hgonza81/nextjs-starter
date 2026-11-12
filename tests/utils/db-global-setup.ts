import postgres from "postgres";

import { THROWAWAY_PREFIX } from "./ids";
import { assertLocalDatabase, resolveLocalTestEnv } from "./local-env.mts";

/**
 * Vitest global setup for the `db` project (runs once, before any test file).
 *
 * 1. Fails fast, with an actionable message, when the local stack is down or
 *    has not been reset (role `app_backend` missing).
 * 2. Sweeps throwaway tables left behind by a crashed earlier run, so a dead
 *    run cannot poison the next one (e.g. the schema guard).
 */
function describe(error: unknown): string {
  const e = error as { code?: string; message?: string; errors?: unknown[] };
  const inner = Array.isArray(e.errors) ? (e.errors[0] as typeof e) : undefined;
  return [e.code ?? inner?.code, e.message || inner?.message]
    .filter(Boolean)
    .join(" ");
}

async function probe(label: string, url: string, hint: string): Promise<void> {
  const sql = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await sql`select 1`;
  } catch (error) {
    throw new Error(
      `\n\nDB tests cannot start: ${label} connection failed (${describe(error)}).\n${hint}\n`,
      { cause: error },
    );
  } finally {
    await sql.end({ timeout: 2 });
  }
}

export default async function setup(): Promise<void> {
  const env = resolveLocalTestEnv();
  assertLocalDatabase("DATABASE_URL", env.DATABASE_URL);
  assertLocalDatabase("DATABASE_MIGRATION_URL", env.DATABASE_MIGRATION_URL);

  await probe(
    "the privileged (postgres)",
    env.DATABASE_MIGRATION_URL,
    "Is the local Supabase stack running? Start it with: pnpm db:start " +
      "(Docker must be running). See tests/README.md.",
  );
  await probe(
    "the app_backend",
    env.DATABASE_URL,
    "The stack is up but role app_backend cannot log in. Apply migrations and " +
      "seed with: pnpm db:reset. See tests/README.md.",
  );

  const admin = postgres(env.DATABASE_MIGRATION_URL, {
    max: 1,
    onnotice: () => {},
  });
  try {
    const leftovers = await admin<{ tablename: string }[]>`
      select tablename from pg_tables
      where schemaname = 'public' and tablename like ${THROWAWAY_PREFIX + "%"}`;
    for (const { tablename } of leftovers) {
      await admin.unsafe(`drop table if exists public."${tablename}" cascade`);
    }
  } finally {
    await admin.end({ timeout: 2 });
  }
}
