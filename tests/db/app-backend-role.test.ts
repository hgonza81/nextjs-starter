import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import {
  asAppBackendWithoutRls,
  asUser,
  closeAppConnection,
} from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * FND-FR-10 (6), FND-FR-08, FND-NFR-02: the `app_backend` role model, asserted
 * from the Postgres catalog (what the server really enforces) and by trying the
 * forbidden operations over the real app connection.
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

describe("FND-FR-10 (6): app_backend attributes in pg_roles", () => {
  async function role(name: string) {
    const [row] = await adminSql()<
      {
        rolsuper: boolean;
        rolbypassrls: boolean;
        rolinherit: boolean;
        rolcanlogin: boolean;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
      }[]
    >`select rolsuper, rolbypassrls, rolinherit, rolcanlogin, rolcreatedb,
             rolcreaterole, rolreplication
      from pg_roles where rolname = ${name}`;
    return row;
  }

  it("FND-FR-10 (6): app_backend exists and can log in", async () => {
    expect((await role("app_backend"))?.rolcanlogin).toBe(true);
  });

  it("FND-FR-10 (6): app_backend is not a superuser", async () => {
    expect((await role("app_backend"))?.rolsuper).toBe(false);
  });

  it("FND-FR-10 (6): app_backend does not bypass row level security", async () => {
    expect((await role("app_backend"))?.rolbypassrls).toBe(false);
  });

  it("FND-FR-08: app_backend is NOINHERIT (never picks up privileges of authenticated/anon implicitly)", async () => {
    expect((await role("app_backend"))?.rolinherit).toBe(false);
  });

  it("FND-FR-08: app_backend cannot create databases or roles or replicate", async () => {
    const row = await role("app_backend");

    expect([row?.rolcreatedb, row?.rolcreaterole, row?.rolreplication]).toEqual(
      [false, false, false],
    );
  });

  it.each(["authenticated", "anon"])(
    "FND-NFR-02: the role %s that withRls switches to is neither superuser nor BYPASSRLS",
    async (name) => {
      const row = await role(name);

      expect([row?.rolsuper, row?.rolbypassrls]).toEqual([false, false]);
    },
  );
});

describe("FND-FR-10 (6): app_backend owns nothing", () => {
  it("FND-FR-10 (6): no object in this database or shared catalog depends on app_backend as owner", async () => {
    const owned = await adminSql()<{ classid: string; objid: string }[]>`
      select d.classid::regclass::text as classid, d.objid::text as objid
      from pg_shdepend d
      join pg_roles r on r.oid = d.refobjid
      where r.rolname = 'app_backend' and d.deptype = 'o'`;

    expect([...owned]).toEqual([]);
  });

  it("FND-FR-10 (6): app_backend owns no relation, function, type, schema or database (direct catalog scan)", async () => {
    const [row] = await adminSql()<{ owned: number }[]>`
      select (
        (select count(*) from pg_class where relowner = r.oid) +
        (select count(*) from pg_proc where proowner = r.oid) +
        (select count(*) from pg_type where typowner = r.oid) +
        (select count(*) from pg_namespace where nspowner = r.oid) +
        (select count(*) from pg_database where datdba = r.oid)
      )::int as owned
      from pg_roles r where r.rolname = 'app_backend'`;

    expect(row?.owned).toBe(0);
  });
});

describe("FND-FR-08: app_backend memberships", () => {
  it("FND-FR-08: app_backend is a member of exactly authenticated and anon, with SET and without INHERIT or ADMIN", async () => {
    const rows = await adminSql()<
      {
        role: string;
        inherit_option: boolean;
        set_option: boolean;
        admin_option: boolean;
      }[]
    >`select r.rolname as role, a.inherit_option, a.set_option, a.admin_option
      from pg_auth_members a
      join pg_roles r on r.oid = a.roleid
      join pg_roles m on m.oid = a.member
      where m.rolname = 'app_backend'
      order by r.rolname`;

    expect([...rows]).toEqual([
      {
        role: "anon",
        inherit_option: false,
        set_option: true,
        admin_option: false,
      },
      {
        role: "authenticated",
        inherit_option: false,
        set_option: true,
        admin_option: false,
      },
    ]);
  });

  it("FND-FR-08: authenticated and anon are not themselves members of any role (no transitive path to a privileged role)", async () => {
    const rows = await adminSql()<{ role: string; member: string }[]>`
      select r.rolname as role, m.rolname as member
      from pg_auth_members a
      join pg_roles r on r.oid = a.roleid
      join pg_roles m on m.oid = a.member
      where m.rolname in ('authenticated', 'anon')`;

    expect([...rows]).toEqual([]);
  });
});

describe("FND-NFR-02: app_backend has no privileges on any table", () => {
  it("FND-NFR-02: no table, view or column in public is accessible to app_backend", async () => {
    const rows = await adminSql()<{ relation: string }[]>`
      select c.relname as relation
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'v', 'm', 'f')
        and has_any_column_privilege(
          'app_backend', c.oid, 'select, insert, update, references')`;

    expect([...rows]).toEqual([]);
  });

  it("FND-NFR-02: no relation outside system schemas is accessible to app_backend (except the PUBLIC-readable pg_stat_statements views of the extensions schema)", async () => {
    const rows = await adminSql()<{ relation: string }[]>`
      select n.nspname || '.' || c.relname as relation
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind in ('r', 'p', 'v', 'm', 'f')
        and n.nspname !~ '^pg_' and n.nspname not in ('information_schema', 'extensions')
        and has_any_column_privilege(
          'app_backend', c.oid, 'select, insert, update, references')`;

    expect([...rows]).toEqual([]);
  });

  it("FND-NFR-02: app_backend cannot create objects in public", async () => {
    const [row] = await adminSql()<{ can_create: boolean }[]>`
      select has_schema_privilege('app_backend', 'public', 'CREATE') as can_create`;

    expect(row?.can_create).toBe(false);
  });

  it("FND-FR-08: a table created by the migration owner without grants is closed to app_backend, authenticated and anon (default privileges removed)", async () => {
    const table = await createThrowawayTable({ columns: "id uuid" });

    const [row] = await adminSql()<
      { app_backend: boolean; authenticated: boolean; anon: boolean }[]
    >`select
        has_any_column_privilege('app_backend', ${table.qualified}::regclass, 'select, insert, update, references') as app_backend,
        has_any_column_privilege('authenticated', ${table.qualified}::regclass, 'select, insert, update, references') as authenticated,
        has_any_column_privilege('anon', ${table.qualified}::regclass, 'select, insert, update, references') as anon`;

    expect(row).toEqual({
      app_backend: false,
      authenticated: false,
      anon: false,
    });
  });

  it("FND-FR-08: a sequence created by the migration owner is closed to authenticated and anon (default privileges removed)", async () => {
    const table = await createThrowawayTable({
      columns: "id bigint generated always as identity primary key",
    });
    const [seq] = await adminSql()<{ name: string }[]>`
      select pg_get_serial_sequence(${table.qualified}, 'id') as name`;

    const [row] = await adminSql()<
      { app_backend: boolean; authenticated: boolean; anon: boolean }[]
    >`select
        has_sequence_privilege('app_backend', ${seq?.name ?? ""}, 'usage, select, update') as app_backend,
        has_sequence_privilege('authenticated', ${seq?.name ?? ""}, 'usage, select, update') as authenticated,
        has_sequence_privilege('anon', ${seq?.name ?? ""}, 'usage, select, update') as anon`;

    expect(row).toEqual({
      app_backend: false,
      authenticated: false,
      anon: false,
    });
  });
});

describe("FND-NFR-02: app_backend cannot take another identity", () => {
  it.each(["postgres", "service_role", "supabase_admin"])(
    "FND-NFR-02: SET ROLE %s from the app connection is refused (42501)",
    async (target) => {
      const attempt = asAppBackendWithoutRls().transaction((tx) =>
        tx.execute(sql.raw(`set local role ${quote(target)}`)),
      );

      await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
    },
  );

  it("FND-NFR-02: SET ROLE is refused for every existing role other than authenticated, anon and itself", async () => {
    const roles = await adminSql()<{ rolname: string }[]>`
      select rolname from pg_roles
      where rolname not in ('authenticated', 'anon', 'app_backend')
      order by rolname`;
    expect(roles.length).toBeGreaterThan(3); // guard against an empty scan

    const outcomes = await Promise.all(
      roles.map(async ({ rolname }) => {
        try {
          await asAppBackendWithoutRls().transaction((tx) =>
            tx.execute(sql.raw(`set local role ${quote(rolname)}`)),
          );
          return `${rolname}: allowed`;
        } catch (error) {
          const code = (error as { cause?: { code?: string } }).cause?.code;
          return `${rolname}: ${code}`;
        }
      }),
    );

    expect(outcomes).toEqual(roles.map(({ rolname }) => `${rolname}: 42501`));
  });

  it("FND-NFR-02: SET SESSION AUTHORIZATION is refused (42501)", async () => {
    const attempt = asAppBackendWithoutRls().transaction((tx) =>
      tx.execute(sql.raw("set local session authorization postgres")),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  it.each(["postgres", "service_role", "supabase_admin"])(
    "FND-NFR-02: code running inside withRls cannot escalate to %s (42501), and the connection stays usable",
    async (target) => {
      const user = createTestUser();

      const attempt = asUser(user.claims).run((tx) =>
        tx.execute(sql.raw(`set local role ${quote(target)}`)),
      );

      await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
      const rows = await asAppBackendWithoutRls().execute(
        sql`select current_user as role`,
      );
      expect(rows[0]).toEqual({ role: "app_backend" });
    },
  );
});
