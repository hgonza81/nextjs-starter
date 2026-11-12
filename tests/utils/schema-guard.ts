import type postgres from "postgres";

/**
 * Schema guard (FND-FR-22, ADR 0003 test 9). Reads the CATALOG, never the
 * generated TypeScript schema: `drizzle-kit pull` emits policies but not the
 * RLS-enabled flag, so only `pg_class.relrowsecurity` and `pg_policies` are
 * authoritative.
 *
 * A table is unguarded when it lives in `public` (the `schema` parameter exists
 * only so the guard can be tested on an empty scratch schema) and either has row level
 * security disabled or has no policy at all. Tables listed in `allowlist`
 * (bare names) are exempt; the real allowlist is empty and every entry must be
 * justified in a code review.
 */
export type UnguardedTable = {
  table: string;
  rlsEnabled: boolean;
  policyCount: number;
};

/** Tables that may exist in `public` without RLS and policies. Keep empty. */
export const SCHEMA_GUARD_ALLOWLIST: readonly string[] = [];

export async function findUnguardedPublicTables(
  sql: postgres.Sql,
  allowlist: readonly string[] = SCHEMA_GUARD_ALLOWLIST,
  schema = "public",
): Promise<UnguardedTable[]> {
  // relkind r = ordinary table, p = partitioned table.
  const rows = await sql<
    { table: string; rls_enabled: boolean; policy_count: number }[]
  >`
    select
      c.relname as "table",
      c.relrowsecurity as rls_enabled,
      (select count(*)::int from pg_policies p
        where p.schemaname = n.nspname and p.tablename = c.relname) as policy_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema}
      and c.relkind in ('r', 'p')
      and c.relname <> all(${[...allowlist]}::text[])
    order by c.relname`;
  return rows
    .filter((row) => !row.rls_enabled || row.policy_count === 0)
    .map((row) => ({
      table: row.table,
      rlsEnabled: row.rls_enabled,
      policyCount: row.policy_count,
    }));
}
