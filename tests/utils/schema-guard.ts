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

/**
 * Convention guard (PH-FR-19, PH-AC-35/68, ADR 0012). Same catalog approach as
 * above. Rules, checked for every table in `public`:
 *
 * - `id-uuid-primary-key`: `id uuid default gen_random_uuid()` and the primary
 *   key is exactly `(id)`.
 * - `created-at-timestamptz` / `updated-at-timestamptz`: `timestamptz not null
 *   default now()`.
 * - `set-updated-at-trigger`: a BEFORE UPDATE row trigger executing
 *   `public.set_updated_at()`.
 * - `snake-case-identifiers`: table and column names match `^[a-z][a-z0-9_]*$`.
 * - `fk-explicit-on-delete`: every foreign key has an ON DELETE action other
 *   than NO ACTION. Limit: Postgres stores `a` for an omitted clause and for an
 *   explicit NO ACTION, so the two cannot be told apart (ADR 0012, spike).
 * - `fk-leading-index`: the FK columns are the leading columns of an index.
 *
 * Not checked (not reliably possible from the catalog, ADR 0012 spike): plural
 * table names and `<singular>_id` FK names; those stay review rules.
 */
export const CONVENTION_RULES = [
  "id-uuid-primary-key",
  "created-at-timestamptz",
  "updated-at-timestamptz",
  "set-updated-at-trigger",
  "snake-case-identifiers",
  "fk-explicit-on-delete",
  "fk-leading-index",
] as const;

export type ConventionRule = (typeof CONVENTION_RULES)[number];

export type ConventionViolation = {
  table: string;
  rule: ConventionRule;
  detail: string;
};

/** An exception: one table, one rule, and why it is acceptable. */
export type ConventionException = {
  table: string;
  rule: ConventionRule;
  reason: string;
};

/**
 * Exceptions to the convention rules. Every entry needs a non-empty reason.
 * Empty today: `public` holds no application table yet.
 */
export const CONVENTION_ALLOWLIST: readonly ConventionException[] = [];

/** Message that names table and rule, e.g. for assertions and failure output. */
export function formatConventionViolation(v: ConventionViolation): string {
  return `table ${v.table} violates rule ${v.rule}: ${v.detail}`;
}

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;

async function listTables(
  sql: postgres.Sql,
  schema: string,
): Promise<{ oid: number; name: string }[]> {
  // relkind r = ordinary table, p = partitioned table.
  return sql<{ oid: number; name: string }[]>`
    select c.oid::int as oid, c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = ${schema} and c.relkind in ('r', 'p')
    order by c.relname`;
}

export async function findConventionViolations(
  sql: postgres.Sql,
  allowlist: readonly ConventionException[] = CONVENTION_ALLOWLIST,
  schema = "public",
): Promise<ConventionViolation[]> {
  for (const entry of allowlist) {
    if (entry.reason.trim() === "") {
      throw new Error(
        `convention allowlist entry ${entry.table}/${entry.rule} has no reason`,
      );
    }
  }

  const tables = await listTables(sql, schema);
  const found: ConventionViolation[] = [];
  const add = (table: string, rule: ConventionRule, detail: string) =>
    found.push({ table, rule, detail });

  for (const { oid, name } of tables) {
    const columns = await sql<
      {
        name: string;
        type: string;
        not_null: boolean;
        default_expr: string | null;
        attnum: number;
      }[]
    >`
      select a.attname as name,
             format_type(a.atttypid, a.atttypmod) as type,
             a.attnotnull as not_null,
             pg_get_expr(d.adbin, d.adrelid) as default_expr,
             a.attnum::int as attnum
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = ${oid} and a.attnum > 0 and not a.attisdropped`;

    // snake_case (table and columns)
    if (!SNAKE_CASE.test(name))
      add(name, "snake-case-identifiers", `table name "${name}"`);
    for (const column of columns) {
      if (!SNAKE_CASE.test(column.name)) {
        add(name, "snake-case-identifiers", `column "${column.name}"`);
      }
    }

    // id
    const id = columns.find((c) => c.name === "id");
    const pks = await sql<{ cols: number[] }[]>`
      select conkey::int[] as cols from pg_constraint
      where conrelid = ${oid} and contype = 'p'`;
    if (!id) {
      add(name, "id-uuid-primary-key", "no id column");
    } else {
      if (id.type !== "uuid") {
        add(
          name,
          "id-uuid-primary-key",
          `id type is ${id.type}, expected uuid`,
        );
      }
      if (id.default_expr !== "gen_random_uuid()") {
        add(
          name,
          "id-uuid-primary-key",
          `id default is ${id.default_expr ?? "none"}, expected gen_random_uuid()`,
        );
      }
      const pk = pks[0]?.cols;
      if (pk?.length !== 1 || pk[0] !== id.attnum) {
        add(name, "id-uuid-primary-key", "primary key is not exactly (id)");
      }
    }

    // timestamps
    for (const [column, rule] of [
      ["created_at", "created-at-timestamptz"],
      ["updated_at", "updated-at-timestamptz"],
    ] as const) {
      const c = columns.find((x) => x.name === column);
      if (!c) {
        add(name, rule, `no ${column} column`);
      } else if (
        c.type !== "timestamp with time zone" ||
        !c.not_null ||
        c.default_expr !== "now()"
      ) {
        add(
          name,
          rule,
          `${column} is ${c.type}${c.not_null ? " not null" : " nullable"} default ${c.default_expr ?? "none"}, expected timestamptz not null default now()`,
        );
      }
    }

    // trigger: BEFORE (2) UPDATE (16) ROW (1) executing public.set_updated_at()
    const [trigger] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_trigger
      where tgrelid = ${oid} and not tgisinternal
        and (tgtype & 2) <> 0 and (tgtype & 16) <> 0 and (tgtype & 1) <> 0
        and tgfoid = 'public.set_updated_at()'::regprocedure`;
    if (!trigger || trigger.n === 0) {
      add(
        name,
        "set-updated-at-trigger",
        "no BEFORE UPDATE row trigger executing public.set_updated_at()",
      );
    }

    // foreign keys
    const fks = await sql<
      { name: string; cols: number[]; deltype: string; col_names: string[] }[]
    >`
      select k.conname as name, k.conkey::int[] as cols,
             k.confdeltype::text as deltype,
             array(select a.attname from unnest(k.conkey) with ordinality u(n, o)
                   join pg_attribute a on a.attrelid = k.conrelid and a.attnum = u.n
                   order by u.o)::text[] as col_names
      from pg_constraint k
      where k.conrelid = ${oid} and k.contype = 'f'`;
    const indexes = await sql<{ keys: string }[]>`
      select i.indkey::text as keys from pg_index i where i.indrelid = ${oid}`;
    const indexKeys = indexes.map((i) => i.keys.split(" ").map(Number));
    for (const fk of fks) {
      if (fk.deltype === "a") {
        add(
          name,
          "fk-explicit-on-delete",
          `foreign key ${fk.name} has no explicit ON DELETE (CASCADE, RESTRICT, SET NULL or SET DEFAULT)`,
        );
      }
      const covered = indexKeys.some((keys) =>
        fk.cols.every((col, i) => keys[i] === col),
      );
      if (!covered) {
        add(
          name,
          "fk-leading-index",
          `foreign key ${fk.name} (${fk.col_names.join(", ")}) does not lead any index`,
        );
      }
    }
  }

  return found.filter(
    (v) => !allowlist.some((e) => e.table === v.table && e.rule === v.rule),
  );
}
