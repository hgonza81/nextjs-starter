import postgres from "postgres";

import { assertLocalDatabase, resolveLocalTestEnv } from "./local-env.mts";

/**
 * Privileged `postgres` connection. ONLY for test setup and teardown (creating
 * and dropping throwaway tables, seeding rows, reading catalogs). It bypasses
 * RLS, so never use it to prove behavior of the app: that goes through
 * `asUser` / `asAnon` (production `withRls`).
 *
 * One lazily created connection per test file (module instance); close it in
 * `afterAll(closeAdmin)`.
 */
let admin: postgres.Sql | undefined;

export function adminSql(): postgres.Sql {
  if (admin === undefined) {
    const { DATABASE_MIGRATION_URL } = resolveLocalTestEnv();
    assertLocalDatabase("DATABASE_MIGRATION_URL", DATABASE_MIGRATION_URL);
    admin = postgres(DATABASE_MIGRATION_URL, {
      max: 2,
      onnotice: () => {},
    });
  }
  return admin;
}

export async function closeAdmin(): Promise<void> {
  const current = admin;
  admin = undefined;
  await current?.end({ timeout: 5 });
}
