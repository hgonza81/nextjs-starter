import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { defineAccessMatrix, type AccessCase } from "../utils/access-matrix";
import { adminSql, closeAdmin } from "../utils/admin";
import { createTenant, createTestUser } from "../utils/factories";
import { newId } from "../utils/ids";
import { asAnon, asUser, closeAppConnection, type Actor } from "../utils/roles";
import {
  createThrowawayTable,
  dropThrowawayTablesAfter,
} from "../utils/throwaway-table";

/**
 * FND-FR-10 (4), FND-NFR-02: tenant isolation on throwaway tables that model
 * the epic 002 pattern: a `memberships` table and an `items` table whose
 * policies grant access only through a membership of `auth.uid()`.
 * `app.current_tenant` is modeled on a second table as a SELECTOR that narrows
 * access but never grants it (ADR 0003: "tenant selector is not a credential").
 *
 * Every attack is also checked from the outside (privileged connection) so the
 * tests prove the absence of side effects, not only an error code.
 */
afterAll(async () => {
  await closeAppConnection();
  await closeAdmin();
});
dropThrowawayTablesAfter("file");

const tenantA = createTenant();
const tenantB = createTenant();
const userA = createTestUser(); // member of tenant A only
const userB = createTestUser(); // member of tenant B only
const userAB = createTestUser(); // member of both tenants
const outsider = createTestUser(); // valid user, no membership anywhere

type Tables = { memberships: string; items: string; scoped: string };

const ITEM_COLUMNS = "id uuid primary key, tenant_id uuid not null, title text";
const isMember = (t: string, memberships: string) =>
  `exists (select 1 from ${memberships} m where m.user_id = auth.uid() and m.tenant_id = ${t}.tenant_id)`;

/** memberships + items (membership only) + scoped (membership AND selector). */
async function createTables(options: { grantAnon: boolean }): Promise<Tables> {
  const anonGrant = options.grantAnon
    ? [
        {
          privileges: "select, insert, update, delete",
          to: "anon" as const,
        },
      ]
    : [];
  const memberships = await createThrowawayTable({
    columns: "user_id uuid not null, tenant_id uuid not null",
    policies: (t) => [
      `create policy own_memberships on ${t} for select to authenticated using (user_id = auth.uid())`,
    ],
    grants: [{ privileges: "select", to: "authenticated" }],
  });
  const crud = (t: string) => [
    `create policy members_all on ${t} for all to authenticated
       using (${isMember(t, memberships.qualified)})
       with check (${isMember(t, memberships.qualified)})`,
  ];
  const grants = [
    {
      privileges: "select, insert, update, delete",
      to: "authenticated" as const,
    },
    ...anonGrant,
  ];
  const items = await createThrowawayTable({
    columns: ITEM_COLUMNS,
    policies: crud,
    grants,
  });
  const scoped = await createThrowawayTable({
    columns: ITEM_COLUMNS,
    policies: (t) => [
      `create policy members_in_selected_tenant on ${t} for all to authenticated
         using (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
                and ${isMember(t, memberships.qualified)})
         with check (tenant_id = nullif(current_setting('app.current_tenant', true), '')::uuid
                and ${isMember(t, memberships.qualified)})`,
    ],
    grants,
  });

  const admin = adminSql();
  for (const [user, tenant] of [
    [userA, tenantA],
    [userB, tenantB],
    [userAB, tenantA],
    [userAB, tenantB],
  ] as const) {
    await admin.unsafe(
      `insert into ${memberships.qualified} (user_id, tenant_id) values ($1, $2)`,
      [user.id, tenant.id],
    );
  }
  return {
    memberships: memberships.qualified,
    items: items.qualified,
    scoped: scoped.qualified,
  };
}

async function seedItem(
  table: string,
  tenantId: string,
  title = "seed",
): Promise<string> {
  const id = newId();
  await adminSql().unsafe(
    `insert into ${table} (id, tenant_id, title) values ($1, $2, $3)`,
    [id, tenantId, title],
  );
  return id;
}

async function stored(table: string) {
  const rows = await adminSql().unsafe<
    { id: string; tenant_id: string; title: string }[]
  >(`select id, tenant_id, title from ${table} order by id`);
  return [...rows];
}

const t = (name: string) => sql.raw(name);

// --- operations as an actor: each returns the number of rows seen/changed ---

// Seeds its own row first, so "allow" never depends on another case and a
// "deny" means a row existed but was invisible.
const select = (actor: Actor, table: string, tenantId: string) => async () => {
  const id = await seedItem(table, tenantId);
  return (
    await actor.run((tx) =>
      tx.execute(sql`select id from ${t(table)} where id = ${id}`),
    )
  ).length;
};

// No RETURNING: it would also run the SELECT policy on the new row and mask a
// weak WITH CHECK. The affected-row count comes from the driver.
const insert = (actor: Actor, table: string, tenantId: string) => async () =>
  (
    (await actor.run((tx) =>
      tx.execute(
        sql`insert into ${t(table)} (id, tenant_id, title) values (${newId()}, ${tenantId}, 'new')`,
      ),
    )) as unknown as { count: number }
  ).count;

const update = (actor: Actor, table: string, tenantId: string) => async () => {
  const id = await seedItem(table, tenantId);
  return (
    await actor.run((tx) =>
      tx.execute(
        sql`update ${t(table)} set title = 'changed' where id = ${id} returning id`,
      ),
    )
  ).length;
};

const remove = (actor: Actor, table: string, tenantId: string) => async () => {
  const id = await seedItem(table, tenantId);
  return (
    await actor.run((tx) =>
      tx.execute(sql`delete from ${t(table)} where id = ${id} returning id`),
    )
  ).length;
};

const OPERATIONS = { select, insert, update, delete: remove } as const;

/** Full actor x action x tenant matrix for one actor. */
function matrixFor(
  label: string,
  actor: Actor,
  table: string,
  ownTenants: readonly string[],
): AccessCase[] {
  return [tenantA.id, tenantB.id].flatMap((tenantId) =>
    Object.entries(OPERATIONS).map(([action, operation]) => ({
      actor: label,
      action: `${action} in tenant ${tenantId === tenantA.id ? "A" : "B"}`,
      expected: ownTenants.includes(tenantId) ? "allow" : "deny",
      run: operation(actor, table, tenantId),
    })),
  );
}

// Tables are created while the file is collected (top-level await) so the
// matrix below can be generated from their names; dropped after the last test.
const main = await createTables({ grantAnon: false });
const withAnonGrants = await createTables({ grantAnon: true });

describe("FND-FR-10 (4): membership-based policy, actor x action x tenant", () => {
  defineAccessMatrix([
    ...matrixFor("user A (tenant A)", asUser(userA.claims), main.items, [
      tenantA.id,
    ]),
    ...matrixFor("user B (tenant B)", asUser(userB.claims), main.items, [
      tenantB.id,
    ]),
    ...matrixFor(
      "user with both memberships",
      asUser(userAB.claims),
      main.items,
      [tenantA.id, tenantB.id],
    ),
    ...matrixFor(
      "valid user without membership",
      asUser(outsider.claims),
      main.items,
      [],
    ),
    ...matrixFor("anonymous (no grant)", asAnon(), main.items, []),
  ]);
});

describe("FND-FR-10 (4): anonymous is denied by RLS even when the table is granted to anon", () => {
  defineAccessMatrix(
    matrixFor("anonymous (granted)", asAnon(), withAnonGrants.items, []),
  );
});

describe("FND-FR-10 (4): scoped table, membership AND selector", () => {
  defineAccessMatrix([
    ...matrixFor(
      "user A selecting tenant A",
      asUser(userA.claims, { tenantId: tenantA.id }),
      main.scoped,
      [tenantA.id],
    ),
    ...matrixFor(
      "user A selecting tenant B (not a member)",
      asUser(userA.claims, { tenantId: tenantB.id }),
      main.scoped,
      [],
    ),
    ...matrixFor(
      "user A with no tenant selected",
      asUser(userA.claims),
      main.scoped,
      [],
    ),
    ...matrixFor(
      "member of both, selecting tenant B",
      asUser(userAB.claims, { tenantId: tenantB.id }),
      main.scoped,
      [tenantB.id],
    ),
    ...matrixFor(
      "member of both, selecting tenant A",
      asUser(userAB.claims, { tenantId: tenantA.id }),
      main.scoped,
      [tenantA.id],
    ),
    ...matrixFor(
      "outsider selecting tenant A",
      asUser(outsider.claims, { tenantId: tenantA.id }),
      main.scoped,
      [],
    ),
  ]);
});

describe("FND-FR-10 (4): user A attacking tenant B leaves tenant B untouched", () => {
  it("FND-FR-10 (4): an unfiltered select returns exactly the caller's tenant rows", async () => {
    const own = await seedItem(main.items, tenantA.id);
    const foreign = await seedItem(main.items, tenantB.id);

    const rows = await asUser(userA.claims).run((tx) =>
      tx.execute(sql`select id from ${t(main.items)}`),
    );

    const ids = rows.map((r) => r.id);
    expect(ids).toContain(own);
    expect(ids).not.toContain(foreign);
    expect(rows.map((r) => r.id as string).sort()).toEqual(
      (await stored(main.items))
        .filter((r) => r.tenant_id === tenantA.id)
        .map((r) => r.id)
        .sort(),
    );
  });

  it("FND-FR-10 (4): updating a tenant B row changes nothing", async () => {
    const id = await seedItem(main.items, tenantB.id, "original");

    await asUser(userA.claims).run((tx) =>
      tx.execute(sql`update ${t(main.items)} set title = 'hacked'`),
    );

    const row = (await stored(main.items)).find((r) => r.id === id);
    expect(row).toMatchObject({ tenant_id: tenantB.id, title: "original" });
  });

  it("FND-FR-10 (4): deleting every visible row never deletes a tenant B row", async () => {
    const id = await seedItem(main.items, tenantB.id);

    await asUser(userA.claims).run((tx) =>
      tx.execute(sql`delete from ${t(main.items)}`),
    );

    expect((await stored(main.items)).map((r) => r.id)).toContain(id);
  });

  it("FND-FR-10 (4): inserting a row for tenant B is refused (42501) and nothing is stored", async () => {
    const id = newId();

    const attempt = asUser(userA.claims).run((tx) =>
      tx.execute(
        sql`insert into ${t(main.items)} (id, tenant_id, title) values (${id}, ${tenantB.id}, 'planted')`,
      ),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
    expect((await stored(main.items)).map((r) => r.id)).not.toContain(id);
  });

  it("FND-FR-10 (4): a tampered tenant id on UPDATE (moving an own row into tenant B) is rejected by WITH CHECK", async () => {
    const id = await seedItem(main.items, tenantA.id);

    const attempt = asUser(userA.claims).run((tx) =>
      tx.execute(
        sql`update ${t(main.items)} set tenant_id = ${tenantB.id} where id = ${id}`,
      ),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
    const row = (await stored(main.items)).find((r) => r.id === id);
    expect(row?.tenant_id).toBe(tenantA.id);
  });

  it("FND-FR-10 (4): a tampered tenant id on INSERT is rejected even when a legitimate row is inserted in the same statement", async () => {
    const own = newId();
    const planted = newId();

    const attempt = asUser(userA.claims).run((tx) =>
      tx.execute(
        sql`insert into ${t(main.items)} (id, tenant_id, title)
            values (${own}, ${tenantA.id}, 'ok'), (${planted}, ${tenantB.id}, 'planted')`,
      ),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
    const ids = (await stored(main.items)).map((r) => r.id);
    expect(ids).not.toContain(own);
    expect(ids).not.toContain(planted);
  });

  it("FND-FR-10 (4): ON CONFLICT DO UPDATE cannot overwrite a tenant B row", async () => {
    const id = await seedItem(main.items, tenantB.id, "original");

    const attempt = asUser(userA.claims).run((tx) =>
      tx.execute(
        sql`insert into ${t(main.items)} (id, tenant_id, title) values (${id}, ${tenantA.id}, 'hijacked')
            on conflict (id) do update set title = excluded.title, tenant_id = excluded.tenant_id`,
      ),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
    const row = (await stored(main.items)).find((r) => r.id === id);
    expect(row).toMatchObject({ tenant_id: tenantB.id, title: "original" });
  });
});

describe("FND-FR-10 (4): forged context grants nothing", () => {
  it("FND-FR-10 (4): a forged app.current_tenant does not open another tenant on a membership-only table", async () => {
    const foreign = await seedItem(main.items, tenantB.id);

    const rows = await asUser(userA.claims, { tenantId: tenantB.id }).run(
      (tx) => tx.execute(sql`select id from ${t(main.items)}`),
    );

    expect(rows.map((r) => r.id)).not.toContain(foreign);
  });

  it("FND-FR-10 (4): forged tenant and role claims (service_role, tenant B) are not credentials", async () => {
    const foreign = await seedItem(main.items, tenantB.id);
    const forged = {
      ...userA.claims,
      role: "service_role",
      tenant_id: tenantB.id,
      app_metadata: { tenant_id: tenantB.id, role: "service_role" },
    };

    const rows = await asUser(forged, { tenantId: tenantB.id }).run((tx) =>
      tx.execute(
        sql`select current_user::text as who, (select count(*)::int from ${t(main.items)} where id = ${foreign}) as seen`,
      ),
    );

    expect(rows[0]).toEqual({ who: "authenticated", seen: 0 });
  });

  it("FND-FR-10 (4): a malformed, SQL-looking tenant selector is data: it is rejected by the uuid cast and widens nothing", async () => {
    const attempt = asUser(userA.claims, {
      tenantId: `${tenantA.id}' or '1'='1`,
    }).run((tx) => tx.execute(sql`select id from ${t(main.scoped)}`));

    await expect(attempt).rejects.toMatchObject({ cause: { code: "22P02" } });
  });
});

describe("FND-FR-10 (4): membership is evaluated live", () => {
  it("FND-FR-10 (4): removing a membership removes access on the next call", async () => {
    const member = createTestUser();
    const admin = adminSql();
    await admin.unsafe(
      `insert into ${main.memberships} (user_id, tenant_id) values ($1, $2)`,
      [member.id, tenantA.id],
    );
    const item = await seedItem(main.items, tenantA.id);
    const seen = async () =>
      (
        await asUser(member.claims).run((tx) =>
          tx.execute(sql`select id from ${t(main.items)} where id = ${item}`),
        )
      ).length;
    expect(await seen()).toBe(1);

    await admin.unsafe(`delete from ${main.memberships} where user_id = $1`, [
      member.id,
    ]);

    expect(await seen()).toBe(0);
  });

  it("FND-FR-10 (4): a user cannot read another tenant's memberships", async () => {
    const rows = await asUser(userA.claims).run((tx) =>
      tx.execute(sql`select user_id, tenant_id from ${t(main.memberships)}`),
    );

    expect([...rows]).toEqual([{ user_id: userA.id, tenant_id: tenantA.id }]);
  });

  it("FND-FR-10 (4): a user cannot add themselves to another tenant (no INSERT privilege on memberships, 42501)", async () => {
    const attempt = asUser(userA.claims).run((tx) =>
      tx.execute(
        sql`insert into ${t(main.memberships)} (user_id, tenant_id) values (${userA.id}, ${tenantB.id})`,
      ),
    );

    await expect(attempt).rejects.toMatchObject({ cause: { code: "42501" } });
  });
});
