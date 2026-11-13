import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { fromDbError, requireRow } from "@/lib/db-error";
import { AppError } from "@/lib/errors";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import { newId } from "../utils/ids";
import { asAnon, asUser, closeAppConnection } from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * PH-FR-07, PH-AC-13/14/15/63 (database half): real errors produced by the
 * local Postgres through the production `withRls`, so the Drizzle `cause`
 * shape is the real one (ADR 0015 spike).
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

const ALL = "select, insert, update, delete";

async function createItems() {
  return createThrowawayTable({
    columns:
      "id uuid primary key, owner_id uuid not null, email text unique, qty int check (qty >= 0)",
    policies: (t) => [
      `create policy own_rows on ${t} for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())`,
    ],
    grants: [{ privileges: ALL, to: "authenticated" }],
  });
}

/** Runs `statement` as `user` and returns what `fromDbError` makes of the failure. */
async function mapFailure(
  user: ReturnType<typeof createTestUser>,
  statement: string,
): Promise<AppError> {
  let caught: unknown;
  try {
    await asUser(user.claims).run((tx) => tx.execute(sql.raw(statement)));
  } catch (error) {
    caught = error;
  }
  expect(caught, "the statement must fail").toBeDefined();
  return fromDbError(caught);
}

describe("PH-AC-13: conflict from real database errors", () => {
  it("PH-AC-13: a unique violation maps to conflict", async () => {
    const user = createTestUser();
    const table = await createItems();
    await adminSql().unsafe(
      `insert into ${table.qualified} (id, owner_id, email) values ($1, $2, 'a@example.com')`,
      [newId(), user.id],
    );

    const mapped = await mapFailure(
      user,
      `insert into ${table.qualified} (id, owner_id, email) values ('${newId()}', '${user.id}', 'a@example.com')`,
    );

    expect(mapped.type).toBe("conflict");
    expect(mapped.message).not.toContain("a@example.com");
    expect(mapped.message).not.toContain(table.name);
  });

  it("PH-AC-13: a foreign key violation maps to conflict", async () => {
    const user = createTestUser();
    const parent = await createThrowawayTable({
      columns: "id uuid primary key",
      grants: [{ privileges: "select", to: "authenticated" }],
    });
    const child = await createThrowawayTable({
      columns: `id uuid primary key, owner_id uuid not null, parent_id uuid references ${parent.qualified}(id)`,
      policies: (t) => [
        `create policy own_rows on ${t} for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())`,
      ],
      grants: [{ privileges: ALL, to: "authenticated" }],
    });

    const mapped = await mapFailure(
      user,
      `insert into ${child.qualified} (id, owner_id, parent_id) values ('${newId()}', '${user.id}', '${newId()}')`,
    );

    expect(mapped.type).toBe("conflict");
  });
});

describe("PH-AC-14: forbidden from real database errors", () => {
  it("PH-AC-14: a row-level security WITH CHECK violation maps to forbidden", async () => {
    const user = createTestUser();
    const table = await createItems();

    const mapped = await mapFailure(
      user,
      `insert into ${table.qualified} (id, owner_id) values ('${newId()}', '${newId()}')`,
    );

    expect(mapped.type).toBe("forbidden");
  });

  it("PH-AC-14: a missing table privilege maps to forbidden", async () => {
    const user = createTestUser();
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      grants: [{ privileges: "select", to: "authenticated" }],
    });

    const mapped = await mapFailure(
      user,
      `insert into ${table.qualified} (id) values ('${newId()}')`,
    );

    expect(mapped.type).toBe("forbidden");
  });

  it("PH-AC-14: an anonymous write without a grant maps to forbidden", async () => {
    const table = await createItems();
    let caught: unknown;
    try {
      await asAnon().run((tx) =>
        tx.execute(
          sql.raw(
            `insert into ${table.qualified} (id, owner_id) values ('${newId()}', '${newId()}')`,
          ),
        ),
      );
    } catch (error) {
      caught = error;
    }

    expect(fromDbError(caught).type).toBe("forbidden");
  });
});

describe("PH-FR-07: validation from real database errors", () => {
  it("PH-FR-07: a not-null violation maps to validation", async () => {
    const user = createTestUser();
    const table = await createThrowawayTable({
      columns: "id uuid primary key, name text not null",
      policies: (t) => [
        `create policy all_rows on ${t} for all to authenticated using (true) with check (true)`,
      ],
      grants: [{ privileges: ALL, to: "authenticated" }],
    });

    const mapped = await mapFailure(
      user,
      `insert into ${table.qualified} (id) values ('${newId()}')`,
    );

    expect(mapped.type).toBe("validation");
  });

  it("PH-FR-07: a check violation maps to validation", async () => {
    const user = createTestUser();
    const table = await createItems();

    const mapped = await mapFailure(
      user,
      `insert into ${table.qualified} (id, owner_id, qty) values ('${newId()}', '${user.id}', -1)`,
    );

    expect(mapped.type).toBe("validation");
  });
});

describe("PH-AC-15: unexpected from real database errors", () => {
  it("PH-AC-15: a syntax error maps to unexpected without any database text", async () => {
    const user = createTestUser();

    const mapped = await mapFailure(user, "selec nonsense from nowhere");

    expect(mapped.type).toBe("unexpected");
    expect(mapped.message).toBe("Something went wrong.");
    expect(mapped.message).not.toMatch(/selec|nonsense|syntax/i);
  });

  it("PH-AC-15: an undefined table maps to unexpected", async () => {
    const user = createTestUser();

    const mapped = await mapFailure(
      user,
      "select * from public.no_such_table_ph",
    );

    expect(mapped.type).toBe("unexpected");
  });

  it("PH-AC-15: a statement timeout (57014) maps to unexpected", async () => {
    const user = createTestUser();
    let caught: unknown;
    try {
      await asUser(user.claims).run(async (tx) => {
        await tx.execute(sql`set local statement_timeout = '50ms'`);
        await tx.execute(sql`select pg_sleep(2)`);
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({ cause: { code: "57014" } });
    expect(fromDbError(caught).type).toBe("unexpected");
  });
});

describe("PH-AC-63: rows hidden by RLS or absent are not_found, never forbidden", () => {
  async function selectItem(
    actor: ReturnType<typeof createTestUser>,
    table: string,
    id: string,
  ) {
    const rows = await asUser(actor.claims).run((tx) =>
      tx.execute(sql.raw(`select id from ${table} where id = '${id}'`)),
    );
    return rows[0];
  }

  it("PH-AC-63: another user's row comes back as zero rows and requireRow reports not_found", async () => {
    const owner = createTestUser();
    const other = createTestUser();
    const table = await createItems();
    const id = newId();
    await adminSql().unsafe(
      `insert into ${table.qualified} (id, owner_id) values ($1, $2)`,
      [id, owner.id],
    );

    const row = await selectItem(other, table.qualified, id);

    expect(row).toBeUndefined();
    expect(() => requireRow(row, "Item not found.")).toThrowError(
      expect.objectContaining({ type: "not_found" }),
    );
  });

  it("PH-AC-63: the owner of the same row gets it back (the hidden case is due to RLS)", async () => {
    const owner = createTestUser();
    const table = await createItems();
    const id = newId();
    await adminSql().unsafe(
      `insert into ${table.qualified} (id, owner_id) values ($1, $2)`,
      [id, owner.id],
    );

    const row = await selectItem(owner, table.qualified, id);

    expect(requireRow(row, "Item not found.")).toMatchObject({ id });
  });

  it("PH-AC-63: an id that does not exist is reported as not_found, same as a hidden row", async () => {
    const user = createTestUser();
    const table = await createItems();

    const row = await selectItem(user, table.qualified, newId());

    expect(() => requireRow(row, "Item not found.")).toThrowError(
      expect.objectContaining({
        type: "not_found",
        message: "Item not found.",
      }),
    );
  });

  it("PH-AC-63: updating another user's row affects zero rows (no error, so no forbidden)", async () => {
    const owner = createTestUser();
    const other = createTestUser();
    const table = await createItems();
    const id = newId();
    await adminSql().unsafe(
      `insert into ${table.qualified} (id, owner_id, qty) values ($1, $2, 1)`,
      [id, owner.id],
    );

    const rows = await asUser(other.claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set qty = 2 where id = '${id}' returning id`,
        ),
      ),
    );

    expect(() => requireRow(rows[0], "Item not found.")).toThrowError(
      expect.objectContaining({ type: "not_found" }),
    );
    const [stored] = await adminSql().unsafe(
      `select qty from ${table.qualified} where id = $1`,
      [id],
    );
    expect(stored?.qty).toBe(1);
  });
});
