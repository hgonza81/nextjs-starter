import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { adminSql, closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";
import { asUser, closeAppConnection } from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * PH-FR-18, PH-AC-34, PH-AC-69 (ADR 0012): `public.set_updated_at()` keeps
 * `updated_at` truthful. `now()` is the transaction start, so every update in
 * these tests runs in its own committed transaction (ADR 0012, spike outcome 3).
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

async function tableWithTrigger() {
  const table = await createThrowawayTable({
    columns: `id uuid primary key default gen_random_uuid(),
      name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()`,
    policies: (t) => [
      `create policy p_all on ${t} for all to authenticated using (true) with check (true)`,
    ],
    grants: [{ privileges: "select, insert, update", to: "authenticated" }],
  });
  await adminSql().unsafe(
    `create trigger ${table.name}_set_updated_at before update on ${table.qualified}
       for each row execute function public.set_updated_at()`,
  );
  return table;
}

type Row = { id: string; created_at: Date; updated_at: Date; name: string };

async function insertRow(table: { qualified: string }): Promise<Row> {
  const [row] = await adminSql().unsafe<Row[]>(
    `insert into ${table.qualified} (name) values ('a') returning *`,
  );
  return row!;
}

async function readRow(table: { qualified: string }, id: string): Promise<Row> {
  const [row] = await adminSql().unsafe<Row[]>(
    `select * from ${table.qualified} where id = '${id}'`,
  );
  return row!;
}

describe("PH-AC-34 / PH-AC-69: set_updated_at trigger", () => {
  it("PH-AC-34: an update in a separate transaction advances updated_at and leaves created_at", async () => {
    const table = await tableWithTrigger();
    const inserted = await insertRow(table);

    await asUser(createTestUser().claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set name = 'b' where id = '${inserted.id}'`,
        ),
      ),
    );

    const after = await readRow(table, inserted.id);
    expect(after.name).toBe("b");
    expect(after.updated_at.getTime()).toBeGreaterThan(
      inserted.updated_at.getTime(),
    );
    expect(after.created_at.getTime()).toBe(inserted.created_at.getTime());
  });

  it("PH-AC-69: a client-supplied updated_at is overwritten", async () => {
    const table = await tableWithTrigger();
    const inserted = await insertRow(table);

    await asUser(createTestUser().claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set name = 'b', updated_at = '2000-01-01T00:00:00Z' where id = '${inserted.id}'`,
        ),
      ),
    );

    const after = await readRow(table, inserted.id);
    expect(after.updated_at.getTime()).toBeGreaterThan(
      inserted.updated_at.getTime(),
    );
  });

  it("PH-AC-69: a client-supplied created_at is not touched by the trigger", async () => {
    const table = await tableWithTrigger();
    const inserted = await insertRow(table);

    await asUser(createTestUser().claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set name = 'b' where id = '${inserted.id}'`,
        ),
      ),
    );

    expect((await readRow(table, inserted.id)).created_at).toEqual(
      inserted.created_at,
    );
  });

  it("PH-AC-69: a no-op update does not error", async () => {
    const table = await tableWithTrigger();
    const inserted = await insertRow(table);

    const result = await asUser(createTestUser().claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set name = name where id = '${inserted.id}' returning id`,
        ),
      ),
    );

    expect(result).toHaveLength(1);
    expect((await readRow(table, inserted.id)).created_at).toEqual(
      inserted.created_at,
    );
  });

  it("PH-AC-34: an update that matches no row does not error and changes nothing", async () => {
    const table = await tableWithTrigger();
    const inserted = await insertRow(table);

    const result = await asUser(createTestUser().claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set name = 'b' where id = gen_random_uuid() returning id`,
        ),
      ),
    );

    expect(result).toHaveLength(0);
    expect(await readRow(table, inserted.id)).toEqual(inserted);
  });

  it("ADR 0012: authenticated cannot call set_updated_at() directly, yet the trigger fires for it", async () => {
    const table = await tableWithTrigger();
    const inserted = await insertRow(table);

    const direct = asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql.raw(`select public.set_updated_at()`)),
    );

    await expect(direct).rejects.toMatchObject({ cause: { code: "42501" } });
    const [privilege] = await adminSql().unsafe<{ allowed: boolean }[]>(
      `select has_function_privilege('authenticated', 'public.set_updated_at()', 'execute') as allowed`,
    );
    expect(privilege?.allowed).toBe(false);
    await asUser(createTestUser().claims).run((tx) =>
      tx.execute(
        sql.raw(
          `update ${table.qualified} set name = 'b' where id = '${inserted.id}'`,
        ),
      ),
    );
    expect(
      (await readRow(table, inserted.id)).updated_at.getTime(),
    ).toBeGreaterThan(inserted.updated_at.getTime());
  });
});
