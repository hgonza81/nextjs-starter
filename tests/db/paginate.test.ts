import { eq } from "drizzle-orm";
import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";

import { paginate, type RlsTransaction } from "@/db";
import { listParams, parseListParams } from "@/lib/list-params";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import { asUser, closeAppConnection } from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * PH-FR-21 (ADR 0016), PH-AC-37, 38, 41, 42, 43: `paginate` over a throwaway
 * table with RLS (`owner_id = auth.uid()`), created and dropped by the test
 * setup. Every test creates its own table and users, so tests run in parallel.
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

type Seed = { n: number; owner: string; label?: string; rank?: number };

/** Deterministic, ordered uuid for row number `n`. */
const idFor = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function createItems(seed: readonly Seed[]) {
  const spec = await createThrowawayTable({
    columns: `id uuid primary key,
      owner_id uuid not null,
      label text not null,
      rank integer not null`,
    policies: (t) => [
      `create policy p_select on ${t} for select to authenticated using (owner_id = auth.uid())`,
    ],
    grants: [{ privileges: "select", to: "authenticated" }],
  });
  for (const row of seed) {
    await adminSql().unsafe(
      `insert into ${spec.qualified} (id, owner_id, label, rank) values ($1, $2, $3, $4)`,
      [idFor(row.n), row.owner, row.label ?? `row-${row.n}`, row.rank ?? row.n],
    );
  }
  const items = pgTable(spec.name, {
    id: uuid("id").primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    label: text("label").notNull(),
    rank: integer("rank").notNull(),
  });
  const columns = {
    id: items.id,
    ownerId: items.ownerId,
    label: items.label,
    rank: items.rank,
  };
  return { spec, items, columns };
}

type Filters = Readonly<Partial<Record<string, string>>>;

function params(
  overrides: {
    page?: number;
    pageSize?: number;
    field?: string;
    dir?: "asc" | "desc";
    filters?: Filters;
  } = {},
) {
  return {
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 10,
    sort: { field: overrides.field ?? "rank", dir: overrides.dir ?? "asc" },
    filters: overrides.filters ?? {},
  };
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const numbers = (n: number, owner: string, rank?: (n: number) => number) =>
  range(1, n).map((i) => ({
    n: i,
    owner,
    ...(rank ? { rank: rank(i) } : {}),
  }));

describe("PH-AC-37: result shape, counts and requested order", () => {
  it("PH-AC-37: page 2 of 25 rows with size 10 returns rows 11 to 20 and the counts", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(25, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ page: 2, pageSize: 10 }),
      }),
    );

    expect(page.rows.map((r) => r.rank)).toEqual(range(11, 20));
    expect(page).toMatchObject({
      total: 25,
      page: 2,
      pageSize: 10,
      pageCount: 3,
    });
  });

  it("PH-AC-37: the last page holds the remainder", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(25, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ page: 3, pageSize: 10 }),
      }),
    );

    expect(page.rows.map((r) => r.rank)).toEqual(range(21, 25));
  });

  it("PH-AC-37: descending sort returns the highest values first", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(25, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ page: 1, pageSize: 5, dir: "desc" }),
      }),
    );

    expect(page.rows.map((r) => r.rank)).toEqual([25, 24, 23, 22, 21]);
  });

  it("PH-AC-37: a row count that is an exact multiple of the page size has no empty last page", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(20, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ page: 2, pageSize: 10 }),
      }),
    );

    expect(page.rows).toHaveLength(10);
    expect(page.pageCount).toBe(2);
  });

  it("PH-AC-37: a sort field name maps to its column", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems([
      { n: 1, owner: user.id, label: "b" },
      { n: 2, owner: user.id, label: "a" },
    ]);

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ field: "label" }),
      }),
    );

    expect(page.rows.map((r) => r.label)).toEqual(["a", "b"]);
  });
});

describe("PH-AC-38: equal sort values are returned in id order", () => {
  it("PH-AC-38: 25 rows sharing one sort value page in id order with no repeat and no skip", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(25, user.id, () => 7));

    const seen = await asUser(user.claims).run(async (tx) => {
      const ids: string[] = [];
      for (const page of [1, 2, 3]) {
        const result = await paginate(tx, {
          table: items,
          columns,
          params: params({ page, pageSize: 10 }),
        });
        ids.push(...result.rows.map((r) => r.id));
      }
      return ids;
    });

    expect(seen).toEqual(range(1, 25).map(idFor));
  });

  it("PH-AC-38: with a descending sort, ties are still ordered by id ascending", async () => {
    const user = createTestUser();
    // Ranks 1,1,1,2,2,2: descending puts the 2s first, each group by id asc.
    const { items, columns } = await createItems(
      numbers(6, user.id, (n) => (n <= 3 ? 1 : 2)),
    );

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ dir: "desc" }),
      }),
    );

    expect(page.rows.map((r) => r.id)).toEqual([4, 5, 6, 1, 2, 3].map(idFor));
  });

  it("PH-AC-38: pages with duplicate sort values together cover every row exactly once", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(
      numbers(23, user.id, (n) => n % 3),
    );

    const seen = await asUser(user.claims).run(async (tx) => {
      const ids: string[] = [];
      for (const page of [1, 2, 3, 4, 5, 6]) {
        const result = await paginate(tx, {
          table: items,
          columns,
          params: params({ page, pageSize: 4 }),
        });
        ids.push(...result.rows.map((r) => r.id));
      }
      return ids;
    });

    expect([...seen].sort()).toEqual(range(1, 23).map(idFor));
    expect(new Set(seen).size).toBe(23);
  });
});

describe("PH-AC-42: RLS applies to rows and to the count", () => {
  it("PH-AC-42: two users each see only their own rows and their own total", async () => {
    const alice = createTestUser();
    const bob = createTestUser();
    const { items, columns } = await createItems([
      ...numbers(7, alice.id),
      ...range(8, 10).map((n) => ({ n, owner: bob.id })),
    ]);
    const list = (user: typeof alice) =>
      asUser(user.claims).run((tx) =>
        paginate(tx, { table: items, columns, params: params() }),
      );

    const [forAlice, forBob] = [await list(alice), await list(bob)];

    expect(forAlice.rows.map((r) => r.id)).toEqual(range(1, 7).map(idFor));
    expect(forAlice).toMatchObject({ total: 7, pageCount: 1 });
    expect(forBob.rows.map((r) => r.id)).toEqual(range(8, 10).map(idFor));
    expect(forBob).toMatchObject({ total: 3, pageCount: 1 });
  });

  it("PH-AC-42: total and pageCount exclude rows hidden by RLS", async () => {
    const alice = createTestUser();
    const other = createTestUser();
    const { items, columns } = await createItems([
      ...numbers(12, alice.id),
      ...range(13, 40).map((n) => ({ n, owner: other.id })),
    ]);

    const page = await asUser(alice.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ pageSize: 5 }),
      }),
    );

    expect(page.total).toBe(12);
    expect(page.pageCount).toBe(3);
  });

  it("PH-AC-42: a filter cannot reach another user's rows", async () => {
    const alice = createTestUser();
    const other = createTestUser();
    const { items, columns } = await createItems([
      { n: 1, owner: alice.id, label: "mine" },
      { n: 2, owner: other.id, label: "secret" },
    ]);

    const page = await asUser(alice.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { label: "secret" } }),
      }),
    );

    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });

  it("PH-AC-42: a user who owns no row gets an empty page", async () => {
    const owner = createTestUser();
    const stranger = createTestUser();
    const { items, columns } = await createItems(numbers(5, owner.id));

    const page = await asUser(stranger.claims).run((tx) =>
      paginate(tx, { table: items, columns, params: params() }),
    );

    expect(page).toMatchObject({ rows: [], total: 0, pageCount: 0 });
  });

  it("PH-AC-42: documents READ COMMITTED behavior, a concurrent insert appears in the second paginate call of the same transaction (ADR 0016)", async () => {
    const user = createTestUser();
    const { items, columns, spec } = await createItems(numbers(5, user.id));

    const [before, after] = await asUser(user.claims).run(
      async (tx: RlsTransaction) => {
        const first = await paginate(tx, {
          table: items,
          columns,
          params: params({ pageSize: 2 }),
        });
        // A row committed by another connection while the transaction is open.
        await adminSql().unsafe(
          `insert into ${spec.qualified} (id, owner_id, label, rank) values ($1, $2, 'late', 99)`,
          [idFor(99), user.id],
        );
        const second = await paginate(tx, {
          table: items,
          columns,
          params: params({ pageSize: 2 }),
        });
        return [first, second];
      },
    );

    // `withRls` runs at READ COMMITTED: each `paginate` call is internally
    // consistent (rows are a prefix of `total`), and the new row shows up in
    // the second call only.
    expect(before?.total).toBe(5);
    expect(after?.total).toBe(6);
  });
});

describe("PH-AC-41: page past the end and no match", () => {
  it("PH-AC-41: a page beyond the last returns empty rows with the real total", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(25, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ page: 9, pageSize: 10 }),
      }),
    );

    expect(page).toMatchObject({
      rows: [],
      total: 25,
      page: 9,
      pageCount: 3,
    });
  });

  it("PH-AC-41: an empty table returns empty rows, total 0 and pageCount 0 (current behavior)", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems([]);

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, { table: items, columns, params: params() }),
    );

    // ADR 0016 does not specify pageCount for no match; 0 is asserted here.
    expect(page).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 10,
      pageCount: 0,
    });
  });

  it("PH-AC-41: a filter that matches nothing returns empty rows, not an error", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(5, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { label: "no-such-label" } }),
      }),
    );

    expect(page).toMatchObject({ rows: [], total: 0, pageCount: 0 });
  });

  it("PH-AC-41: a parsed page 10000 (the listParams cap) works and is empty when beyond the data", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(5, user.id));
    const parsed = parseListParams(
      listParams({
        sortable: ["rank", "label"],
        filters: ["label"],
        defaultSort: { field: "rank", dir: "asc" },
      }),
      { page: "10000", pageSize: "100" },
    );

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, { table: items, columns, params: parsed }),
    );

    expect(page).toMatchObject({
      rows: [],
      total: 5,
      page: 10_000,
      pageSize: 100,
      pageCount: 1,
    });
  });
});

describe("PH-FR-21: equality filters and the fixed where", () => {
  it("PH-FR-21: an equality filter keeps only matching rows and counts only them", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems([
      { n: 1, owner: user.id, label: "red" },
      { n: 2, owner: user.id, label: "blue" },
      { n: 3, owner: user.id, label: "red" },
    ]);

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { label: "red" } }),
      }),
    );

    expect(page.rows.map((r) => r.id)).toEqual([1, 3].map(idFor));
    expect(page.total).toBe(2);
  });

  it("PH-FR-21: several filters are ANDed", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems([
      { n: 1, owner: user.id, label: "red", rank: 1 },
      { n: 2, owner: user.id, label: "red", rank: 2 },
      { n: 3, owner: user.id, label: "blue", rank: 2 },
    ]);

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { label: "red", rank: "2" } }),
      }),
    );

    expect(page.rows.map((r) => r.id)).toEqual([idFor(2)]);
  });

  it("PH-FR-21: the fixed where is ANDed with the filters and with the count", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems([
      { n: 1, owner: user.id, label: "red" },
      { n: 2, owner: user.id, label: "red" },
      { n: 3, owner: user.id, label: "blue" },
    ]);

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params(),
        where: eq(items.label, "red"),
      }),
    );

    expect(page.rows.map((r) => r.id)).toEqual([1, 2].map(idFor));
    expect(page.total).toBe(2);
  });

  it("PH-FR-21: a filter value that does not fit the column type is rejected by Postgres (22P02)", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(3, user.id));

    const run = asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { id: "not-a-uuid" } }),
      }),
    );

    await expect(run).rejects.toMatchObject({ cause: { code: "22P02" } });
  });
});

describe("PH-AC-43: hostile strings are data or rejected before SQL", () => {
  it("PH-AC-43: a SQL-looking filter value is matched as data and the table survives", async () => {
    const user = createTestUser();
    const hostile = "a'; drop table x;--";
    const { items, columns, spec } = await createItems([
      { n: 1, owner: user.id, label: hostile },
      { n: 2, owner: user.id, label: "plain" },
    ]);

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { label: hostile } }),
      }),
    );

    expect(page.rows.map((r) => r.id)).toEqual([idFor(1)]);
    expect(page.total).toBe(1);
    const [stillThere] = await adminSql().unsafe<{ count: string }[]>(
      `select count(*) from ${spec.qualified}`,
    );
    expect(stillThere?.count).toBe("2");
  });

  it("PH-AC-43: a tautology filter value does not widen the result", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(3, user.id));

    const page = await asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ filters: { label: "' OR '1'='1" } }),
      }),
    );

    expect(page).toMatchObject({ rows: [], total: 0 });
  });

  it.each([
    "label; drop table x",
    "rank desc, (select 1)",
    "constructor",
    "__proto__",
    "toString",
    "unknown",
    "",
  ])(
    "PH-AC-43: sort field %j outside the allow-list throws before any query",
    async (field) => {
      const user = createTestUser();
      const { items, columns } = await createItems(numbers(3, user.id));

      const run = asUser(user.claims).run((tx) =>
        paginate(tx, { table: items, columns, params: params({ field }) }),
      );

      await expect(run).rejects.toThrow(/not in the columns allow-list/);
    },
  );

  it.each(["constructor", "__proto__", "hasOwnProperty", "label'; --"])(
    "PH-AC-43: filter field %j outside the allow-list throws before any query",
    async (field) => {
      const user = createTestUser();
      const { items, columns } = await createItems(numbers(3, user.id));

      const run = asUser(user.claims).run((tx) =>
        paginate(tx, {
          table: items,
          columns,
          params: params({ filters: { [field]: "x" } }),
        }),
      );

      await expect(run).rejects.toThrow(/not in the columns allow-list/);
    },
  );

  it("PH-AC-43: the columns allow-list is the only way to reach a column (owner_id is not sortable by its SQL name)", async () => {
    const user = createTestUser();
    const { items, columns } = await createItems(numbers(3, user.id));

    const run = asUser(user.claims).run((tx) =>
      paginate(tx, {
        table: items,
        columns,
        params: params({ field: "owner_id" }),
      }),
    );

    await expect(run).rejects.toThrow(/not in the columns allow-list/);
  });
});
