import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { defineAccessMatrix } from "../utils/access-matrix";
import { adminSql, closeAdmin } from "../utils/admin";
import { newId } from "../utils/ids";
import { createTenant, createTestUser } from "../utils/factories";
import {
  asAnon,
  asAppBackendWithoutRls,
  asUser,
  closeAppConnection,
  type Actor,
} from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * FND-FR-21: demo of the DB harness. Uses only the helpers in tests/utils, so
 * it doubles as the template for new DB tests.
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("file");

describe("FND-FR-21: roles through the production withRls", () => {
  it("connects as app_backend when withRls is not used", async () => {
    const rows = await asAppBackendWithoutRls().execute(
      sql`select current_user as role`,
    );

    expect(rows[0]).toEqual({ role: "app_backend" });
  });

  it("switches to authenticated and exposes the verified user as auth.uid()", async () => {
    const user = createTestUser();

    const rows = await asUser(user.claims).run((tx) =>
      tx.execute(sql`select current_user as role, auth.uid()::text as uid`),
    );

    expect(rows[0]).toEqual({ role: "authenticated", uid: user.id });
  });

  it("switches to anon with no user", async () => {
    const rows = await asAnon().run((tx) =>
      tx.execute(sql`select current_user as role, auth.uid() as uid`),
    );

    expect(rows[0]).toEqual({ role: "anon", uid: null });
  });

  it("uses the privileged postgres role only for setup", async () => {
    const [row] = await adminSql()`select current_user as role`;

    expect(row).toEqual({ role: "postgres" });
  });
});

describe("FND-FR-21: throwaway tables and the allow/deny matrix", () => {
  it("denies authenticated and anon until grants are explicit", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      rls: false,
    });

    const attempt = asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql.raw(`select * from ${table.qualified}`)),
    );

    await expect(attempt).rejects.toMatchObject({
      cause: { code: "42501" },
    });
  });

  it("creates a distinct table per call (parallel-safe names)", async () => {
    const [a, b] = await Promise.all([
      createThrowawayTable({ columns: "id uuid primary key" }),
      createThrowawayTable({ columns: "id uuid primary key" }),
    ]);

    expect(a.name).not.toBe(b.name);
  });

  describe("owner-only policy with explicit grants", () => {
    const owner = createTestUser();
    const otherUser = createTestUser();
    const tenant = createTenant();
    let tableName = "";

    beforeAll(async () => {
      const table = await createThrowawayTable({
        columns:
          "id uuid primary key, tenant_id uuid not null, owner_id uuid not null",
        policies: (t) => [
          `create policy owner_only on ${t} for select to authenticated using (owner_id = auth.uid())`,
        ],
        grants: [{ privileges: "select", to: "authenticated" }],
      });
      tableName = table.qualified;
      await adminSql().unsafe(
        `insert into ${tableName} (id, tenant_id, owner_id) values ($1, $2, $3)`,
        [newId(), tenant.id, owner.id],
      );
    });

    const visibleRows = (actor: Actor) => async () => {
      const rows = await actor.run((tx) =>
        tx.execute(sql.raw(`select * from ${tableName}`)),
      );
      return rows.length;
    };

    defineAccessMatrix([
      {
        actor: "owner",
        action: "select own row",
        expected: "allow",
        run: visibleRows(asUser(owner.claims)),
      },
      {
        actor: "other user",
        action: "select another user's row",
        expected: "deny",
        run: visibleRows(asUser(otherUser.claims)),
      },
      {
        actor: "anonymous",
        action: "select (no grant for anon)",
        expected: "deny",
        run: visibleRows(asAnon()),
      },
    ]);
  });
});
