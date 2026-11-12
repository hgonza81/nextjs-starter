import { afterAll, afterEach } from "vitest";

import { adminSql } from "./admin";
import { THROWAWAY_PREFIX, uniqueName } from "./ids";

/**
 * Throwaway tables: created by test setup through the privileged connection,
 * never in `supabase/migrations/`. Every table gets a unique name, so tests are
 * parallel-safe, and is dropped after the test.
 *
 * The T-11 migration removes the default privileges of `anon` and
 * `authenticated`, so a new table is DENIED to them until `grants` says
 * otherwise. Make that explicit in each test.
 */
export type Grant = {
  /** e.g. "select, insert, update, delete" */
  privileges: string;
  /** e.g. "authenticated" */
  to: "authenticated" | "anon";
};

export type ThrowawayTableSpec = {
  /** Column definitions, SQL text, e.g. "id uuid primary key, owner_id uuid". */
  columns: string;
  /** Enable row level security (default true). Pass false to model a bad table. */
  rls?: boolean;
  /** Policy statements built from the quoted table name. */
  policies?: (table: string) => string[];
  grants?: Grant[];
};

export type ThrowawayTable = {
  /** Bare table name (unique). */
  name: string;
  /** Quoted, schema-qualified name, ready to embed in SQL text. */
  qualified: string;
  drop: () => Promise<void>;
};

const created: ThrowawayTable[] = [];

export async function createThrowawayTable(
  spec: ThrowawayTableSpec,
): Promise<ThrowawayTable> {
  const name = uniqueName(THROWAWAY_PREFIX.slice(0, -1));
  const qualified = `public."${name}"`;
  const sql = adminSql();

  await sql.unsafe(`create table ${qualified} (${spec.columns})`);
  const table: ThrowawayTable = {
    name,
    qualified,
    drop: async () => {
      await sql.unsafe(`drop table if exists ${qualified} cascade`);
    },
  };
  created.push(table);

  if (spec.rls ?? true) {
    await sql.unsafe(`alter table ${qualified} enable row level security`);
  }
  for (const statement of spec.policies?.(qualified) ?? []) {
    await sql.unsafe(statement);
  }
  for (const grant of spec.grants ?? []) {
    await sql.unsafe(
      `grant ${grant.privileges} on ${qualified} to ${grant.to}`,
    );
  }
  return table;
}

/**
 * Call once at the top of a test file that creates throwaway tables. Every
 * table is dropped afterwards, even when a test failed.
 * - "test" (default): after each test, for tables created inside a test.
 * - "file": after the last test, for tables shared by a `describe` (create
 *   them in `beforeAll`).
 */
export function dropThrowawayTablesAfter(
  scope: "test" | "file" = "test",
): void {
  const hook = scope === "test" ? afterEach : afterAll;
  hook(async () => {
    const pending = created.splice(0);
    for (const table of pending) await table.drop();
  });
}
