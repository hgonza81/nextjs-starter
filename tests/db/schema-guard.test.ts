import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import { randomSuffix } from "../utils/ids";
import { asAnon, asUser, closeAppConnection } from "../utils/roles";
import {
  findConventionViolations,
  findUnguardedPublicTables,
  formatConventionViolation,
} from "../utils/schema-guard";
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

/**
 * PH-FR-19 / PH-AC-35 / PH-AC-68 (ADR 0012): convention rules on every public
 * table. Each rule is proven by a conforming table that passes and a violating
 * table that the guard reports, naming table and rule.
 */
const CONFORMING_COLUMNS = `id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()`;

async function conformingTable(
  overrides: { columns?: string; extra?: string[] } = {},
) {
  const table = await createThrowawayTable({
    columns: overrides.columns ?? CONFORMING_COLUMNS,
    rls: false,
  });
  if (!overrides.extra) {
    await adminSql().unsafe(
      `create trigger ${table.name}_set_updated_at before update on ${table.qualified}
         for each row execute function public.set_updated_at()`,
    );
  }
  for (const statement of overrides.extra ?? []) {
    await adminSql().unsafe(statement);
  }
  return table;
}

async function violationsOf(name: string) {
  const all = await findConventionViolations(adminSql());
  return all.filter((v) => v.table === name);
}

const withTrigger = (t: { name: string; qualified: string }) =>
  `create trigger ${t.name}_set_updated_at before update on ${t.qualified}
     for each row execute function public.set_updated_at()`;

describe("PH-AC-35: convention guard on the real schema", () => {
  it("PH-AC-35: every public table follows the conventions (or is allowlisted with a reason)", async () => {
    const violations = await findConventionViolations(adminSql());

    expect(violations.map(formatConventionViolation)).toEqual([]);
  });

  it("PH-AC-35: the guard passes when the schema has zero tables", async () => {
    const schema = `tmp_test_schema_${randomSuffix()}`;
    await adminSql().unsafe(`create schema "${schema}"`);
    try {
      const violations = await findConventionViolations(adminSql(), [], schema);

      expect(violations).toEqual([]);
    } finally {
      await adminSql().unsafe(`drop schema "${schema}" cascade`);
    }
  });
});

describe("PH-AC-35, PH-AC-68: the convention guard detects each violation", () => {
  it("PH-AC-35: accepts a fully conforming table with a foreign key and its index", async () => {
    const parent = await conformingTable();
    const child = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, parent_id uuid not null references ${parent.qualified} (id) on delete cascade`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(child));
    await adminSql().unsafe(
      `create index on ${child.qualified} (parent_id, created_at)`,
    );

    expect(await violationsOf(child.name)).toEqual([]);
    expect(await violationsOf(parent.name)).toEqual([]);
  });

  it("PH-AC-35: reports a table without an id column", async () => {
    const table = await conformingTable({
      columns: `created_at timestamptz not null default now(), updated_at timestamptz not null default now()`,
      extra: [],
    });

    const violations = await violationsOf(table.name);

    expect(violations.map((v) => v.rule)).toContain("id-uuid-primary-key");
    expect(formatConventionViolation(violations[0]!)).toContain(
      `table ${table.name} violates rule`,
    );
  });

  it.each([
    ["a bigint id", "id bigint primary key default 1"],
    ["a uuid id without the default", "id uuid primary key"],
    [
      "a uuid id that is not the primary key",
      "id uuid default gen_random_uuid()",
    ],
  ])("PH-AC-35: reports %s", async (_label, idColumn) => {
    const table = await conformingTable({
      columns: `${idColumn}, created_at timestamptz not null default now(), updated_at timestamptz not null default now()`,
      extra: [],
    });

    const rules = (await violationsOf(table.name)).map((v) => v.rule);

    expect(rules).toContain("id-uuid-primary-key");
  });

  it("PH-AC-35: reports a composite primary key that includes id", async () => {
    const table = await conformingTable({
      columns: `id uuid default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key (id, created_at)`,
      extra: [],
    });

    const rules = (await violationsOf(table.name)).map((v) => v.rule);

    expect(rules).toContain("id-uuid-primary-key");
  });

  it.each([
    ["created_at", "created-at-timestamptz"],
    ["updated_at", "updated-at-timestamptz"],
  ] as const)("PH-AC-35: reports a missing %s", async (column, rule) => {
    const other = column === "created_at" ? "updated_at" : "created_at";
    const table = await conformingTable({
      columns: `id uuid primary key default gen_random_uuid(), ${other} timestamptz not null default now()`,
      extra: [],
    });

    const rules = (await violationsOf(table.name)).map((v) => v.rule);

    expect(rules).toContain(rule);
  });

  it.each([
    ["timestamp without time zone", "timestamp not null default now()"],
    ["nullable", "timestamptz default now()"],
    ["without a default", "timestamptz not null"],
    [
      "with a default other than now()",
      "timestamptz not null default clock_timestamp()",
    ],
  ])(
    "PH-AC-35: reports a created_at that is %s",
    async (_label, definition) => {
      const table = await conformingTable({
        columns: `id uuid primary key default gen_random_uuid(), created_at ${definition}, updated_at timestamptz not null default now()`,
        extra: [],
      });

      const rules = (await violationsOf(table.name)).map((v) => v.rule);

      expect(rules).toContain("created-at-timestamptz");
      expect(rules).not.toContain("updated-at-timestamptz");
    },
  );

  it("PH-AC-35: reports a table without the set_updated_at trigger", async () => {
    const table = await conformingTable({ extra: [] });

    const violations = await violationsOf(table.name);

    expect(violations.map((v) => v.rule)).toEqual(["set-updated-at-trigger"]);
  });

  it.each([
    [
      "an AFTER trigger",
      "after update",
      "for each row",
      "public.set_updated_at()",
    ],
    [
      "a BEFORE INSERT trigger",
      "before insert",
      "for each row",
      "public.set_updated_at()",
    ],
    [
      "a statement-level trigger",
      "before update",
      "for each statement",
      "public.set_updated_at()",
    ],
  ])(
    "PH-AC-35: reports %s instead of a BEFORE UPDATE row trigger",
    async (_label, when, level) => {
      const table = await conformingTable({ extra: [] });
      // AFTER triggers cannot modify NEW, so use a no-op function for the wrong shapes.
      const fn = `public.tmp_test_noop_${randomSuffix()}`;
      await adminSql().unsafe(
        `create function ${fn}() returns trigger language plpgsql as $$ begin return null; end $$`,
      );
      try {
        await adminSql().unsafe(
          `create trigger wrong ${when} on ${table.qualified} ${level} execute function ${fn}()`,
        );

        const rules = (await violationsOf(table.name)).map((v) => v.rule);

        expect(rules).toEqual(["set-updated-at-trigger"]);
      } finally {
        await table.drop();
        await adminSql().unsafe(`drop function if exists ${fn}()`);
      }
    },
  );

  it("PH-AC-35: reports a BEFORE UPDATE row trigger that runs a different function", async () => {
    const table = await conformingTable({ extra: [] });
    const fn = `public.tmp_test_other_${randomSuffix()}`;
    await adminSql().unsafe(
      `create function ${fn}() returns trigger language plpgsql as $$ begin return new; end $$`,
    );
    try {
      await adminSql().unsafe(
        `create trigger other before update on ${table.qualified} for each row execute function ${fn}()`,
      );

      const rules = (await violationsOf(table.name)).map((v) => v.rule);

      expect(rules).toEqual(["set-updated-at-trigger"]);
    } finally {
      await table.drop();
      await adminSql().unsafe(`drop function if exists ${fn}()`);
    }
  });

  it("PH-AC-35: reports a quoted camelCase column", async () => {
    const table = await conformingTable({
      columns: `${CONFORMING_COLUMNS}, "displayName" text`,
      extra: [],
    });
    await adminSql().unsafe(withTrigger(table));

    const violations = await violationsOf(table.name);

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "snake-case-identifiers",
        detail: 'column "displayName"',
      }),
    ]);
  });

  it("PH-AC-35: reports a quoted camelCase table name", async () => {
    const name = `tmp_test_Camel_${randomSuffix()}`;
    await adminSql().unsafe(
      `create table public."${name}" (${CONFORMING_COLUMNS})`,
    );
    try {
      await adminSql().unsafe(
        `create trigger t before update on public."${name}" for each row execute function public.set_updated_at()`,
      );

      const violations = await violationsOf(name);

      expect(violations.map((v) => v.rule)).toEqual(["snake-case-identifiers"]);
    } finally {
      await adminSql().unsafe(`drop table if exists public."${name}" cascade`);
    }
  });

  it("PH-AC-35: reports a foreign key without an explicit ON DELETE", async () => {
    const parent = await conformingTable();
    const child = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, parent_id uuid references ${parent.qualified} (id)`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(child));
    await adminSql().unsafe(`create index on ${child.qualified} (parent_id)`);

    const violations = await violationsOf(child.name);

    expect(violations.map((v) => v.rule)).toEqual(["fk-explicit-on-delete"]);
  });

  it.each(["cascade", "restrict", "set null", "set default"])(
    "PH-AC-35: accepts a foreign key with ON DELETE %s",
    async (action) => {
      const parent = await conformingTable();
      const child = await createThrowawayTable({
        columns: `${CONFORMING_COLUMNS}, parent_id uuid references ${parent.qualified} (id) on delete ${action}`,
        rls: false,
      });
      await adminSql().unsafe(withTrigger(child));
      await adminSql().unsafe(`create index on ${child.qualified} (parent_id)`);

      expect(await violationsOf(child.name)).toEqual([]);
    },
  );

  it("PH-AC-35: reports a foreign key column that leads no index", async () => {
    const parent = await conformingTable();
    const child = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, parent_id uuid references ${parent.qualified} (id) on delete cascade`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(child));

    const violations = await violationsOf(child.name);

    expect(violations.map((v) => v.rule)).toEqual(["fk-leading-index"]);
  });

  it("PH-AC-35: reports a foreign key column that is only the second column of an index", async () => {
    const parent = await conformingTable();
    const child = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, parent_id uuid references ${parent.qualified} (id) on delete cascade`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(child));
    await adminSql().unsafe(
      `create index on ${child.qualified} (created_at, parent_id)`,
    );

    const violations = await violationsOf(child.name);

    expect(violations.map((v) => v.rule)).toEqual(["fk-leading-index"]);
  });

  it("PH-AC-35: accepts a composite foreign key covered by an index with the same prefix", async () => {
    const parent = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, a int not null, b int not null, unique (a, b)`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(parent));
    const child = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, a int, b int, foreign key (a, b) references ${parent.qualified} (a, b) on delete cascade`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(child));
    await adminSql().unsafe(`create index on ${child.qualified} (a, b)`);

    expect(await violationsOf(child.name)).toEqual([]);
  });

  it("PH-AC-35: reports a composite foreign key whose index covers only the first column", async () => {
    const parent = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, a int not null, b int not null, unique (a, b)`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(parent));
    const child = await createThrowawayTable({
      columns: `${CONFORMING_COLUMNS}, a int, b int, foreign key (a, b) references ${parent.qualified} (a, b) on delete cascade`,
      rls: false,
    });
    await adminSql().unsafe(withTrigger(child));
    await adminSql().unsafe(`create index on ${child.qualified} (a)`);

    const violations = await violationsOf(child.name);

    expect(violations.map((v) => v.rule)).toEqual(["fk-leading-index"]);
  });

  it("PH-AC-68: an allowlisted violation (table and rule) passes; another rule on it still fails", async () => {
    const table = await conformingTable({
      columns: `${CONFORMING_COLUMNS}, "badCol" text`,
      extra: [],
    });
    const allow = (
      rule: "set-updated-at-trigger" | "snake-case-identifiers",
    ) => ({
      table: table.name,
      rule,
      reason: "fixture: proves the allowlist",
    });

    const partial = await findConventionViolations(adminSql(), [
      allow("set-updated-at-trigger"),
    ]);
    const full = await findConventionViolations(adminSql(), [
      allow("set-updated-at-trigger"),
      allow("snake-case-identifiers"),
    ]);

    expect(
      partial.filter((v) => v.table === table.name).map((v) => v.rule),
    ).toEqual(["snake-case-identifiers"]);
    expect(full.filter((v) => v.table === table.name)).toEqual([]);
  });

  it("PH-AC-68: an allowlist entry without a reason is rejected", async () => {
    const attempt = findConventionViolations(adminSql(), [
      { table: "anything", rule: "id-uuid-primary-key", reason: "  " },
    ]);

    await expect(attempt).rejects.toThrow(/has no reason/);
  });

  it("PH-AC-35: the harness really dropped the previous convention fixtures", async () => {
    expect(await findConventionViolations(adminSql())).toEqual([]);
  });
});
