import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import { randomSuffix } from "../utils/ids";
import { asAnon, asUser, closeAppConnection } from "../utils/roles";
import { findUnguardedPublicTables } from "../utils/schema-guard";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * FND-FR-22 / ADR 0003 test 9: every table in `public` has RLS enabled and at
 * least one policy. The guard reads the catalog (see tests/utils/schema-guard.ts)
 * and is itself tested, so a broken guard cannot pass silently.
 * Also FND-FR-10 (9): a table without a policy returns zero rows.
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

const guard = () => findUnguardedPublicTables(adminSql());

describe("FND-FR-22: schema guard on the real schema", () => {
  it("FND-FR-22: every table in public has RLS enabled and at least one policy", async () => {
    const offenders = await guard();

    expect(offenders).toEqual([]);
  });

  it("FND-FR-22: the guard passes when the schema has zero tables", async () => {
    const schema = `tmp_test_schema_${randomSuffix()}`;
    await adminSql().unsafe(`create schema "${schema}"`);
    try {
      const offenders = await findUnguardedPublicTables(adminSql(), [], schema);

      expect(offenders).toEqual([]);
    } finally {
      await adminSql().unsafe(`drop schema "${schema}" cascade`);
    }
  });
});

describe("FND-FR-22: the guard itself is proven to detect violations", () => {
  it("FND-FR-22: reports a table with RLS disabled and no policy", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      rls: false,
    });

    const offenders = await guard();

    expect(offenders).toContainEqual({
      table: table.name,
      rlsEnabled: false,
      policyCount: 0,
    });
  });

  it("FND-FR-22: reports a table with RLS enabled but no policy", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      rls: true,
    });

    const offenders = await guard();

    expect(offenders).toContainEqual({
      table: table.name,
      rlsEnabled: true,
      policyCount: 0,
    });
  });

  it("FND-FR-22: reports a table that has a policy but RLS disabled (policy is inert)", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      rls: false,
      policies: (t) => [
        `create policy p on ${t} for select to authenticated using (true)`,
      ],
    });

    const offenders = await guard();

    expect(offenders).toContainEqual({
      table: table.name,
      rlsEnabled: false,
      policyCount: 1,
    });
  });

  it("FND-FR-22: accepts a table with RLS enabled and a policy", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      policies: (t) => [
        `create policy p on ${t} for select to authenticated using (true)`,
      ],
    });

    const offenders = await guard();

    expect(offenders.map((o) => o.table)).not.toContain(table.name);
  });

  it("FND-FR-22: reports a partitioned table without RLS", async () => {
    const name = `tmp_test_part_${randomSuffix()}`;
    await adminSql().unsafe(
      `create table public."${name}" (id int) partition by range (id)`,
    );
    try {
      const offenders = await guard();

      expect(offenders).toContainEqual({
        table: name,
        rlsEnabled: false,
        policyCount: 0,
      });
    } finally {
      await adminSql().unsafe(`drop table if exists public."${name}" cascade`);
    }
  });

  it("FND-FR-22: an allowlisted table is exempt, and only that one", async () => {
    const allowed = await createThrowawayTable({
      columns: "id uuid primary key",
      rls: false,
    });
    const notAllowed = await createThrowawayTable({
      columns: "id uuid primary key",
      rls: false,
    });

    const offenders = await findUnguardedPublicTables(adminSql(), [
      allowed.name,
    ]);

    expect(offenders.map((o) => o.table)).toEqual([notAllowed.name]);
  });

  it("FND-FR-22: the harness really dropped the previous throwaway tables", async () => {
    expect(await guard()).toEqual([]);
  });
});

describe("FND-FR-10 (9): a table without a policy returns zero rows", () => {
  async function tableWithRowsAndNoPolicy() {
    const table = await createThrowawayTable({
      columns: "id int primary key, secret text",
      rls: true,
      grants: [
        { privileges: "select, insert, update, delete", to: "authenticated" },
        { privileges: "select, insert, update, delete", to: "anon" },
      ],
    });
    await adminSql().unsafe(
      `insert into ${table.qualified} values (1, 'a'), (2, 'b')`,
    );
    return table;
  }

  it("FND-FR-10 (9): the table really holds rows (the zero below is RLS, not emptiness)", async () => {
    const table = await tableWithRowsAndNoPolicy();

    const [row] = await adminSql().unsafe<{ n: number }[]>(
      `select count(*)::int as n from ${table.qualified}`,
    );

    expect(row?.n).toBe(2);
  });

  it("FND-FR-10 (9): an authenticated user sees zero rows even with SELECT granted", async () => {
    const table = await tableWithRowsAndNoPolicy();

    const rows = await asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql.raw(`select * from ${table.qualified}`)),
    );

    expect(rows).toHaveLength(0);
  });

  it("FND-FR-10 (9): anonymous sees zero rows even with SELECT granted", async () => {
    const table = await tableWithRowsAndNoPolicy();

    const rows = await asAnon().run((tx) =>
      tx.execute(sql.raw(`select * from ${table.qualified}`)),
    );

    expect(rows).toHaveLength(0);
  });

  it("FND-FR-10 (9): update and delete touch zero rows and the data is unchanged", async () => {
    const table = await tableWithRowsAndNoPolicy();
    const user = createTestUser();

    const updated = await asUser(user.claims).run((tx) =>
      tx.execute(
        sql.raw(`update ${table.qualified} set secret = 'x' returning id`),
      ),
    );
    const deleted = await asUser(user.claims).run((tx) =>
      tx.execute(sql.raw(`delete from ${table.qualified} returning id`)),
    );

    const stored = await adminSql().unsafe(
      `select id, secret from ${table.qualified} order by id`,
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
    expect([...stored]).toEqual([
      { id: 1, secret: "a" },
      { id: 2, secret: "b" },
    ]);
  });

  it("FND-FR-10 (9): insert is refused by RLS (42501) and nothing is stored", async () => {
    const table = await tableWithRowsAndNoPolicy();

    const attempt = asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql.raw(`insert into ${table.qualified} values (3, 'c')`)),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
    const [row] = await adminSql().unsafe<{ n: number }[]>(
      `select count(*)::int as n from ${table.qualified}`,
    );
    expect(row?.n).toBe(2);
  });
});
