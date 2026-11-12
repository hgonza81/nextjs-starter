import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import { withRls, withAnonymousRls } from "@/db";

import { adminSql, closeAdmin } from "../utils/admin";
import { newId } from "../utils/ids";
import { createTestUser } from "../utils/factories";
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
 * FND-FR-10 items 1, 2, 5, 7 (and the anonymous variant), ADR 0003 required
 * tests, against real Postgres through the production `withRls`. The app
 * connection has pool size 1 (`getDb()`), so every call reuses ONE physical
 * connection: that is what makes the "context does not leak" checks meaningful.
 * Item 3 (parallel users) lives in with-rls-parallel.test.ts.
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("test");

type Snapshot = {
  current_user: string;
  session_user: string;
  uid: string | null;
  claims: string | null;
  sub: string | null;
  tenant: string | null;
  pid: number;
};

// Reads the security context as the database sees it. `current_setting(x, true)`
// returns NULL for a GUC never defined on this connection and '' once it was
// set (even transaction-locally) and then reset.
const SNAPSHOT = sql`select
  current_user::text as current_user,
  session_user::text as session_user,
  auth.uid()::text as uid,
  current_setting('request.jwt.claims', true) as claims,
  current_setting('request.jwt.claim.sub', true) as sub,
  current_setting('app.current_tenant', true) as tenant,
  pg_backend_pid() as pid`;

// Same, without auth.uid(): app_backend itself has no business calling it.
const RAW_SNAPSHOT = sql`select
  current_user::text as current_user,
  session_user::text as session_user,
  current_setting('request.jwt.claims', true) as claims,
  current_setting('request.jwt.claim.sub', true) as sub,
  current_setting('app.current_tenant', true) as tenant,
  pg_backend_pid() as pid`;

async function snapshotInside(
  user: { id: string; claims?: Record<string, unknown> },
  tenantId?: string,
): Promise<Snapshot> {
  const rows = await withRls(
    { userId: user.id, claims: user.claims ?? {}, tenantId },
    (tx) => tx.execute(SNAPSHOT),
  );
  return rows[0] as unknown as Snapshot;
}

async function rawSnapshot() {
  const rows = await asAppBackendWithoutRls().execute(RAW_SNAPSHOT);
  return rows[0] as unknown as Omit<Snapshot, "uid">;
}

const DEFAULT_CONTEXT = {
  current_user: "app_backend",
  session_user: "app_backend",
  claims: "",
  sub: "",
  tenant: "",
};

describe("FND-FR-10 (1): context inside withRls", () => {
  it("FND-FR-10: runs as role authenticated over the app_backend session", async () => {
    const user = createTestUser();

    const snap = await snapshotInside(user);

    expect(snap.current_user).toBe("authenticated");
    expect(snap.session_user).toBe("app_backend");
  });

  it("FND-FR-10: auth.uid() equals the supplied user id", async () => {
    const user = createTestUser();

    const snap = await snapshotInside(user);

    expect(snap.uid).toBe(user.id);
    expect(snap.sub).toBe(user.id);
  });

  it("FND-FR-10: the other supplied claims reach the database unchanged", async () => {
    const user = createTestUser();
    const claims = {
      email: "o'brien+tag@example.com",
      app_metadata: { provider: "email", n: 1 },
      aal: "aal1",
    };

    const snap = await snapshotInside({ id: user.id, claims });

    expect(JSON.parse(snap.claims ?? "")).toEqual({
      ...claims,
      sub: user.id,
      role: "authenticated",
    });
  });

  it("FND-FR-10: forged sub and role in the claims are overwritten by the verified values", async () => {
    const user = createTestUser();
    const victim = newId();

    const snap = await snapshotInside({
      id: user.id,
      claims: { sub: victim, role: "service_role", email: "a@example.com" },
    });

    expect(JSON.parse(snap.claims ?? "")).toEqual({
      email: "a@example.com",
      sub: user.id,
      role: "authenticated",
    });
    expect(snap.uid).toBe(user.id);
    expect(snap.current_user).toBe("authenticated");
  });

  it("FND-FR-10: auth.jwt() and auth.role() expose the verified role and claims", async () => {
    const user = createTestUser();

    const rows = await withRls(
      { userId: user.id, claims: { email: "x@example.com", role: "anon" } },
      (tx) =>
        tx.execute(
          sql`select auth.role() as role, auth.jwt()->>'email' as email, auth.jwt()->>'sub' as sub`,
        ),
    );

    expect(rows[0]).toEqual({
      role: "authenticated",
      email: "x@example.com",
      sub: user.id,
    });
  });

  it("FND-FR-10: the tenant id is exposed only when supplied", async () => {
    const user = createTestUser();
    const tenantId = newId();

    const withTenant = await snapshotInside(user, tenantId);
    const withoutTenant = await snapshotInside(user);

    expect(withTenant.tenant).toBe(tenantId);
    expect(withoutTenant.tenant).toBe("");
  });

  it("FND-FR-10: a claim value that looks like SQL is stored as data", async () => {
    const user = createTestUser();
    const email = `x'); drop table users; --@example.com`;

    const snap = await snapshotInside({ id: user.id, claims: { email } });

    expect(JSON.parse(snap.claims ?? "").email).toBe(email);
  });
});

describe("FND-FR-10 (2): context is gone after the transaction (pool size 1)", () => {
  it("FND-FR-10: after commit the same connection has the default role and no claims", async () => {
    const user = createTestUser();
    const inside = await snapshotInside(user, newId());

    const after = await rawSnapshot();

    expect(after.pid).toBe(inside.pid); // same physical connection
    expect(after).toMatchObject(DEFAULT_CONTEXT);
  });

  it("FND-FR-10: after rollback the same connection has the default role and no claims", async () => {
    const user = createTestUser();
    let insidePid = 0;
    const attempt = withRls(
      {
        userId: user.id,
        claims: { email: "r@example.com" },
        tenantId: newId(),
      },
      async (tx) => {
        const rows = await tx.execute(SNAPSHOT);
        insidePid = (rows[0] as unknown as Snapshot).pid;
        throw new Error("boom");
      },
    );
    await expect(attempt).rejects.toThrow("boom");

    const after = await rawSnapshot();

    expect(after.pid).toBe(insidePid);
    expect(after).toMatchObject(DEFAULT_CONTEXT);
  });

  it("FND-FR-10: the next withRls call of another user never sees the previous user", async () => {
    const first = createTestUser();
    const second = createTestUser();
    await snapshotInside(first, newId());

    const snap = await snapshotInside(second);

    expect(snap.uid).toBe(second.id);
    expect(snap.sub).toBe(second.id);
    expect(snap.tenant).toBe("");
    expect(JSON.parse(snap.claims ?? "")).toEqual({
      sub: second.id,
      role: "authenticated",
      email: second.email,
    });
  });

  it("FND-FR-10: after an anonymous call the connection is back to the default role", async () => {
    await asAnon().run((tx) => tx.execute(sql`select 1`));

    expect(await rawSnapshot()).toMatchObject(DEFAULT_CONTEXT);
  });
});

describe("FND-FR-10 (5): invalid user ids are refused with no fallback", () => {
  const invalidIds: [string, unknown][] = [
    ["empty string", ""],
    ["whitespace only", "   "],
    ["undefined", undefined],
    ["null", null],
    ["a number", 42],
    ["not a UUID", "not-a-uuid"],
    ["a UUID with a trailing newline", `${newId()}\n`],
    ["a UUID with surrounding spaces", ` ${newId()} `],
    ["an injection-looking string", "x'; set role postgres; --"],
    ["the nil-like admin literal", "service_role"],
  ];

  it.each(invalidIds)(
    "FND-FR-10: refuses %s and never reaches the database",
    async (_label, userId) => {
      const transaction = vi.spyOn(asAppBackendWithoutRls(), "transaction");
      const callback = vi.fn(async () => "ran");

      const attempt = withRls(
        { userId: userId as string, claims: { role: "service_role" } },
        callback,
      );

      await expect(attempt).rejects.toThrow(/verified user id/);
      expect(callback).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      transaction.mockRestore();
    },
  );

  it.each([
    ["empty", ""],
    ["whitespace", "  "],
  ])(
    "FND-FR-10: refuses an %s tenant id and never reaches the database",
    async (_label, tenantId) => {
      const transaction = vi.spyOn(asAppBackendWithoutRls(), "transaction");
      const callback = vi.fn(async () => "ran");

      const attempt = withRls(
        { userId: newId(), claims: {}, tenantId },
        callback,
      );

      await expect(attempt).rejects.toThrow(/tenant/);
      expect(callback).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
      transaction.mockRestore();
    },
  );

  it("FND-FR-10: a refused call leaves the connection in the default context", async () => {
    await expect(
      withRls({ userId: "", claims: {} }, async () => "ran"),
    ).rejects.toThrow();

    expect(await rawSnapshot()).toMatchObject({
      current_user: "app_backend",
      session_user: "app_backend",
    });
  });

  it("FND-FR-10: a refused call does not run the callback under any role", async () => {
    const seenRoles: string[] = [];

    await expect(
      withRls({ userId: "nope", claims: {} }, async (tx) => {
        const rows = await tx.execute(sql`select current_user::text as r`);
        seenRoles.push(String(rows[0]?.r));
      }),
    ).rejects.toThrow();

    expect(seenRoles).toEqual([]);
  });
});

describe("FND-FR-10 (7): an error in the callback rolls back and resets context", () => {
  async function createNotes() {
    return createThrowawayTable({
      columns: "id uuid primary key, owner_id uuid not null",
      policies: (t) => [
        `create policy own_rows on ${t} for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())`,
      ],
      grants: [{ privileges: "select, insert", to: "authenticated" }],
    });
  }
  const countRows = async (qualified: string) => {
    const [row] = await adminSql().unsafe(
      `select count(*)::int as n from ${qualified}`,
    );
    return row?.n as number;
  };

  it("FND-FR-10: a write made before the callback throws is rolled back", async () => {
    const user = createTestUser();
    const table = await createNotes();

    const attempt = asUser(user.claims).run(async (tx) => {
      await tx.execute(
        sql.raw(
          `insert into ${table.qualified} (id, owner_id) values ('${newId()}', '${user.id}')`,
        ),
      );
      throw new Error("callback failed");
    });

    await expect(attempt).rejects.toThrow("callback failed");
    expect(await countRows(table.qualified)).toBe(0);
  });

  it("FND-FR-10: a committed write is visible, proving the rollback test can tell them apart", async () => {
    const user = createTestUser();
    const table = await createNotes();

    await asUser(user.claims).run((tx) =>
      tx.execute(
        sql.raw(
          `insert into ${table.qualified} (id, owner_id) values ('${newId()}', '${user.id}')`,
        ),
      ),
    );

    expect(await countRows(table.qualified)).toBe(1);
  });

  it("FND-FR-10: the callback error is propagated unchanged, not swallowed or replaced", async () => {
    const user = createTestUser();
    const original = new RangeError("specific failure");

    const attempt = asUser(user.claims).run(async () => {
      throw original;
    });

    await expect(attempt).rejects.toBe(original);
  });

  it("FND-FR-10: after a database error inside the callback the connection is usable and clean", async () => {
    const user = createTestUser();
    const table = await createNotes();
    const failing = asUser(user.claims).run((tx) =>
      // WITH CHECK violation (another owner) aborts the transaction.
      tx.execute(
        sql.raw(
          `insert into ${table.qualified} (id, owner_id) values ('${newId()}', '${newId()}')`,
        ),
      ),
    );
    await expect(failing).rejects.toMatchObject({ cause: { code: "42501" } });

    const after = await rawSnapshot();

    expect(after).toMatchObject(DEFAULT_CONTEXT);
    expect(await countRows(table.qualified)).toBe(0);
  });

  it("FND-FR-10: after a rollback the next user does not inherit the failed user's role or claims", async () => {
    const failed = createTestUser();
    const next = createTestUser();
    await expect(
      asUser(failed.claims, { tenantId: newId() }).run(async () => {
        throw new Error("x");
      }),
    ).rejects.toThrow("x");

    const snap = await snapshotInside(next);

    expect(snap).toMatchObject({ uid: next.id, tenant: "" });
  });
});

describe("FND-FR-10: anonymous variant", () => {
  it("FND-FR-10: runs as role anon with no user and claims role anon", async () => {
    const rows = await withAnonymousRls((tx) =>
      tx.execute(sql`select
        current_user::text as role,
        auth.uid() as uid,
        auth.role() as auth_role,
        current_setting('request.jwt.claims', true) as claims,
        coalesce(current_setting('request.jwt.claim.sub', true), '') as sub,
        coalesce(current_setting('app.current_tenant', true), '') as tenant`),
    );

    const row = rows[0] as Record<string, string | null>;
    expect(row).toMatchObject({
      role: "anon",
      uid: null,
      auth_role: "anon",
      sub: "",
      tenant: "",
    });
    expect(JSON.parse(row.claims ?? "")).toEqual({ role: "anon" });
  });

  it("FND-FR-10: anonymous does not inherit the previous authenticated user", async () => {
    const user = createTestUser();
    await snapshotInside(user, newId());

    const rows = await asAnon().run((tx) =>
      tx.execute(
        sql`select auth.uid() as uid, coalesce(current_setting('app.current_tenant', true), '') as tenant`,
      ),
    );

    expect(rows[0]).toEqual({ uid: null, tenant: "" });
  });
});

describe("FND-FR-10 / FND-NFR-02: fail closed without withRls", () => {
  it("FND-NFR-02: a query through the app connection without withRls is denied even on a table granted to authenticated", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      policies: (t) => [
        `create policy allow_all on ${t} for all to authenticated, anon using (true) with check (true)`,
      ],
      grants: [{ privileges: "select, insert", to: "authenticated" }],
    });
    await adminSql().unsafe(`insert into ${table.qualified} values ($1)`, [
      newId(),
    ]);

    const select = asAppBackendWithoutRls().execute(
      sql.raw(`select * from ${table.qualified}`),
    );
    const insert = asAppBackendWithoutRls().execute(
      sql.raw(`insert into ${table.qualified} values ('${newId()}')`),
    );

    await expect(select).rejects.toMatchObject({ cause: { code: "42501" } });
    await expect(insert).rejects.toMatchObject({ cause: { code: "42501" } });
  });

  it("FND-NFR-02: the same table is readable through withRls, so the denial above is due to the missing wrapper", async () => {
    const table = await createThrowawayTable({
      columns: "id uuid primary key",
      policies: (t) => [
        `create policy allow_all on ${t} for select to authenticated using (true)`,
      ],
      grants: [{ privileges: "select", to: "authenticated" }],
    });
    await adminSql().unsafe(`insert into ${table.qualified} values ($1)`, [
      newId(),
    ]);

    const rows = await asUser(createTestUser().claims).run((tx) =>
      tx.execute(sql.raw(`select * from ${table.qualified}`)),
    );

    expect(rows).toHaveLength(1);
  });

  it("FND-NFR-02: app_backend cannot switch to a privileged role by itself", async () => {
    const attempt = asAppBackendWithoutRls().execute(sql`set role postgres`);

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
  });
});
