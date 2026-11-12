import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import { randomSuffix, THROWAWAY_PREFIX } from "../utils/ids";
import {
  assertLocalDatabase,
  resolveLocalTestEnv,
} from "../utils/local-env.mts";
import {
  asAnon,
  asAppBackendWithoutRls,
  asUser,
  closeAppConnection,
} from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * FND-T-51: locks the hardening of migration
 * 20261112130000_app_backend_timeouts_function_privileges.sql and of the
 * default-privilege revokes of 20261112120000_app_backend_role.sql, from the
 * Postgres catalog and over the real app connection.
 *
 *   1. FND-FR-08 / FND-NFR-05: query timeouts of `app_backend` reach `withRls`.
 *   2. FND-FR-08: a new function is not executable by anon/authenticated/PUBLIC.
 *   3. FND-FR-08 / FND-FR-10 / FND-FR-22: anon holds nothing on `public`
 *      tables and sequences (the schema guard checks RLS and policies, not
 *      grants).
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

/** Public, non-secret demo key shipped with every local Supabase stack. */
const LOCAL_DEMO_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const FUNCTION_PREFIX = `${THROWAWAY_PREFIX}fn_`;

describe("FND-NFR-05: app_backend query timeouts", () => {
  it("FND-NFR-05: the role-level settings of app_backend hold statement and idle-in-transaction timeouts", async () => {
    const [row] = await adminSql()<{ rolconfig: string[] | null }[]>`
      select rolconfig from pg_roles where rolname = 'app_backend'`;

    expect([...(row?.rolconfig ?? [])].sort()).toEqual([
      "idle_in_transaction_session_timeout=10s",
      "statement_timeout=8s",
    ]);
  });

  it("FND-NFR-05: inside withRls (authenticated) the effective timeouts are 8s and 10s", async () => {
    const rows = await asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql`select current_setting('statement_timeout') as statement,
        current_setting('idle_in_transaction_session_timeout') as idle`),
    );

    expect(rows[0]).toEqual({ statement: "8s", idle: "10s" });
  });

  it("FND-NFR-05: inside withAnonymousRls the effective timeouts are 8s and 10s too (not the role-level 3s of anon, which SET ROLE never applies)", async () => {
    const rows = await asAnon().run((tx) =>
      tx.execute(sql`select current_setting('statement_timeout') as statement,
        current_setting('idle_in_transaction_session_timeout') as idle`),
    );

    expect(rows[0]).toEqual({ statement: "8s", idle: "10s" });
  });

  it("FND-NFR-05: a statement running past the limit is cancelled with 57014 and the connection stays usable", async () => {
    const attempt = asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql`select pg_sleep(9)`),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "57014" } });
    const rows = await asAppBackendWithoutRls().execute(sql`select 1 as ok`);
    expect(rows[0]).toEqual({ ok: 1 });
  }, 20_000);

  it("FND-NFR-05: a short statement is not affected by the timeout (control for the cancellation test)", async () => {
    const rows = await asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql`select pg_sleep(0.05), 1 as ok`),
    );

    expect(rows[0]).toMatchObject({ ok: 1 });
  });
});

describe("FND-FR-08: new functions are not executable by anon, authenticated or PUBLIC", () => {
  const created: string[] = [];
  afterEach(async () => {
    for (const qualified of created.splice(0)) {
      await adminSql().unsafe(`drop function if exists ${qualified}`);
    }
  });

  /** Creates `<schema>.tmp_test_fn_*()` as the migration owner. */
  async function createFunction(schema: string): Promise<string> {
    const qualified = `"${schema}"."${FUNCTION_PREFIX}${randomSuffix()}"`;
    await adminSql().unsafe(
      `create function ${qualified}() returns int language sql as 'select 1'`,
    );
    created.push(`${qualified}()`);
    return qualified;
  }

  async function executeGrantees(qualified: string) {
    const rows = await adminSql()<{ grantee: string }[]>`
      select case when a.grantee = 0 then 'PUBLIC'
                  else a.grantee::regrole::text end as grantee
      from pg_proc p, aclexplode(coalesce(p.proacl,
             acldefault('f', p.proowner))) a
      where p.oid = ${`${qualified}()`}::regprocedure
        and a.privilege_type = 'EXECUTE'
      order by 1`;
    return rows.map((r) => r.grantee);
  }

  it("FND-FR-08: a function created by postgres in public is executable only by its owner and service_role (no PUBLIC, anon or authenticated)", async () => {
    const fn = await createFunction("public");

    expect(await executeGrantees(fn)).toEqual(["postgres", "service_role"]);
  });

  it("FND-FR-08: has_function_privilege is false for anon and authenticated on a new function in public", async () => {
    const fn = await createFunction("public");

    const [row] = await adminSql()<{ anon: boolean; authenticated: boolean }[]>`
      select has_function_privilege('anon', ${`${fn}()`}, 'execute') as anon,
             has_function_privilege('authenticated', ${`${fn}()`}, 'execute') as authenticated`;

    expect(row).toEqual({ anon: false, authenticated: false });
  });

  it("FND-FR-08: a function created in a new schema is not executable by PUBLIC either (the PUBLIC revoke is not schema-scoped)", async () => {
    const schema = `${THROWAWAY_PREFIX}schema_${randomSuffix()}`;
    await adminSql().unsafe(`create schema "${schema}"`);
    try {
      const fn = await createFunction(schema);

      expect(await executeGrantees(fn)).toEqual(["postgres"]);
    } finally {
      await adminSql().unsafe(`drop schema "${schema}" cascade`);
      created.length = 0;
    }
  });

  it("FND-FR-08: calling a new function as anon is refused with 42501", async () => {
    const fn = await createFunction("public");

    const attempt = asAnon().run((tx) => tx.execute(sql.raw(`select ${fn}()`)));

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  it("FND-FR-08: calling a new function as an authenticated user is refused with 42501 until it is granted explicitly", async () => {
    const fn = await createFunction("public");
    const user = createTestUser();

    const denied = asUser(user.claims).run((tx) =>
      tx.execute(sql.raw(`select ${fn}()`)),
    );
    await expect(denied).rejects.toMatchObject({ cause: { code: "42501" } });

    await adminSql().unsafe(
      `grant execute on function ${fn}() to authenticated`,
    );
    const rows = await asUser(user.claims).run((tx) =>
      tx.execute(sql.raw(`select ${fn}() as value`)),
    );
    expect(rows[0]).toEqual({ value: 1 });
  });

  it("FND-FR-08: no function owned by postgres in public (outside extensions) is executable by anon", async () => {
    const rows = await adminSql()<{ fn: string }[]>`
      select p.oid::regprocedure::text as fn
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and not exists (select 1 from pg_depend d
                        where d.objid = p.oid and d.deptype = 'e')
        and has_function_privilege('anon', p.oid, 'execute')`;

    expect([...rows]).toEqual([]);
  });
});

describe("FND-FR-08: anon has no privilege on public tables and sequences", () => {
  /** Relations in public (excluding throwaway tables) where `role` holds any privilege. */
  async function exposedRelations(role: "anon" | "authenticated") {
    const rows = await adminSql()<{ relation: string }[]>`
      select c.relname as relation
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname not like ${`${THROWAWAY_PREFIX}%`}
        and (
          (c.relkind in ('r', 'p', 'v', 'm', 'f') and has_any_column_privilege(
            ${role}, c.oid, 'select, insert, update, references'))
          or has_table_privilege(${role}, c.oid, 'delete, truncate, trigger')
          or (c.relkind = 'S' and has_sequence_privilege(
            ${role}, c.oid, 'usage, select, update'))
        )
      order by 1`;
    return rows.map((r) => r.relation);
  }

  it("FND-FR-08: on the real schema anon holds no table, column or sequence privilege in public", async () => {
    expect(await exposedRelations("anon")).toEqual([]);
  });

  it("FND-FR-08: the check is not vacuous, it reports a table that is granted to anon", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid",
      grants: [{ privileges: "select", to: "anon" }],
    });
    const [row] = await adminSql()<{ granted: boolean }[]>`
      select has_table_privilege('anon', ${table.qualified}, 'select') as granted`;

    expect(row?.granted).toBe(true);
  });

  it("FND-FR-08: a table created without grants is closed to anon and authenticated (select, insert, update, delete, truncate, references, trigger)", async () => {
    const table = await createThrowawayTable({ columns: "id uuid" });

    const [row] = await adminSql()<{ anon: boolean; authenticated: boolean }[]>`
      select
        has_table_privilege('anon', ${table.qualified},
          'select, insert, update, delete, truncate, references, trigger') as anon,
        has_table_privilege('authenticated', ${table.qualified},
          'select, insert, update, delete, truncate, references, trigger') as authenticated`;

    expect(row).toEqual({ anon: false, authenticated: false });
  });

  it("FND-FR-08: a sequence created with an identity column is closed to anon and authenticated", async () => {
    const table = await createThrowawayTable({
      columns: "id bigint generated always as identity primary key",
    });
    const [seq] = await adminSql()<{ name: string }[]>`
      select pg_get_serial_sequence(${table.qualified}, 'id') as name`;

    const [row] = await adminSql()<{ anon: boolean; authenticated: boolean }[]>`
      select has_sequence_privilege('anon', ${seq?.name ?? ""}, 'usage, select, update') as anon,
             has_sequence_privilege('authenticated', ${seq?.name ?? ""}, 'usage, select, update') as authenticated`;

    expect(row).toEqual({ anon: false, authenticated: false });
  });

  it("FND-FR-10: anon cannot read a table that has no grant for it, even with RLS off (permission denied, 42501)", async () => {
    const table = await createThrowawayTable({
      columns: "id int primary key",
      rls: false,
    });
    await adminSql().unsafe(`insert into ${table.qualified} values (1)`);

    const attempt = asAnon().run((tx) =>
      tx.execute(sql.raw(`select * from ${table.qualified}`)),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  /**
   * KNOWN RESIDUAL CASE (ADR 0003, Residual risks): `postgres` cannot alter the
   * default privileges of `supabase_admin`, so a table created as
   * `supabase_admin` is still auto-granted to anon and authenticated. Migrations,
   * Studio SQL and the CLI run as `postgres`, so this does not happen in
   * practice. This test pins the CURRENT behavior so the limitation stays
   * visible: if it ever fails because anon is no longer granted, the residual
   * risk is gone and the ADR note and this test should be removed.
   */
  it("FND-FR-08: KNOWN RESIDUAL: a table created as supabase_admin is still granted to anon (not mitigated, see ADR 0003)", async () => {
    const { DATABASE_MIGRATION_URL } = resolveLocalTestEnv();
    assertLocalDatabase("DATABASE_MIGRATION_URL", DATABASE_MIGRATION_URL);
    const url = new URL(DATABASE_MIGRATION_URL);
    url.username = "supabase_admin";
    const owner = postgres(url.toString(), { max: 1, onnotice: () => {} });
    const name = `${THROWAWAY_PREFIX}sa_${randomSuffix()}`;
    try {
      await owner.unsafe(`create table public."${name}" (id int)`);

      const [row] = await adminSql()<{ anon: boolean }[]>`
        select has_table_privilege('anon', ${`public."${name}"`}, 'select') as anon`;

      expect(row?.anon).toBe(true);
    } finally {
      await owner.unsafe(`drop table if exists public."${name}"`);
      await owner.end({ timeout: 5 });
    }
  });
});

describe("FND-FR-08: the Data API serves no tables", () => {
  it("FND-FR-08: /rest/v1/ on the local stack is not served (non-2xx) and returns no table data", async () => {
    const { NEXT_PUBLIC_SUPABASE_URL } = resolveLocalTestEnv();
    assertLocalDatabase("NEXT_PUBLIC_SUPABASE_URL", NEXT_PUBLIC_SUPABASE_URL);

    // With the Data API enabled this valid key would get the OpenAPI document
    // (200); without a key the gateway would answer 401 and hide the problem.
    const response = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: LOCAL_DEMO_ANON_KEY },
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.text();

    expect(response.ok).toBe(false);
    expect(body).not.toContain("definitions");
    expect(body).not.toContain("paths");
  });
});
