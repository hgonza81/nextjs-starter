import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, describe, expect, it, vi } from "vitest";

import { withRls } from "@/db";

import { closeAdmin } from "../utils/admin";
import { createTestUser } from "../utils/factories";

/**
 * FND-FR-10 (3): parallel calls with different users never see each other's
 * claims. The production `getDb()` has pool size 1, so on its own it would only
 * queue the calls. This file replaces `@/db/client` (nothing else) with a
 * client of the same kind (`drizzle(postgres(DATABASE_URL, { prepare: false }))`)
 * but a pool of 8. `withRls` itself is the unmodified production code and runs
 * on that pool, so the calls really are concurrent on different connections.
 * Limit: the pool size is a test choice; production's `max: 1` is covered by
 * the queued variant below and by with-rls-context.test.ts.
 */
vi.mock("@/db/client", async () => {
  const { drizzle: makeDrizzle } = await import("drizzle-orm/postgres-js");
  const { default: pg } = await import("postgres");
  let instance: ReturnType<typeof makeDrizzle> | undefined;
  return {
    getDb: () => {
      instance ??= makeDrizzle(
        pg(process.env.DATABASE_URL as string, { prepare: false, max: 8 }),
      );
      return instance;
    },
  };
});

afterAll(async () => {
  const { getDb } = await import("@/db/client");
  await (getDb() as ReturnType<typeof drizzle>).$client.end({ timeout: 5 });
  await closeAdmin();
});

type Seen = { uid: string; sub: string; email: string; pid: number };

async function observe(
  user: ReturnType<typeof createTestUser>,
  holdSeconds: number,
): Promise<Seen> {
  return withRls(
    { userId: user.id, claims: { email: user.claims.email } },
    async (tx) => {
      // Hold the transaction open so the calls overlap in time, then read the
      // context again: a leak from a neighbour would show up after the sleep.
      await tx.execute(sql`select pg_sleep(${holdSeconds})`);
      const rows = await tx.execute(
        sql`select auth.uid()::text as uid,
          current_setting('request.jwt.claim.sub', true) as sub,
          auth.jwt()->>'email' as email,
          pg_backend_pid() as pid`,
      );
      return rows[0] as unknown as Seen;
    },
  );
}

describe("FND-FR-10 (3): parallel users keep separate contexts", () => {
  const COUNT = 8;

  it("FND-FR-10: concurrent calls on different connections each see only their own claims", async () => {
    const users = Array.from({ length: COUNT }, () => createTestUser());

    const seen = await Promise.all(users.map((u) => observe(u, 0.3)));

    expect(seen.map((s) => s.uid)).toEqual(users.map((u) => u.id));
    expect(seen.map((s) => s.sub)).toEqual(users.map((u) => u.id));
    expect(seen.map((s) => s.email)).toEqual(users.map((u) => u.claims.email));
    // Proof that the calls really ran concurrently on several connections.
    expect(new Set(seen.map((s) => s.pid)).size).toBeGreaterThan(1);
  });

  it("FND-FR-10: calls that reuse the same connection one after another never inherit a previous user", async () => {
    const users = Array.from({ length: 20 }, () => createTestUser());

    // 20 calls over a pool of 8 force connection reuse.
    const seen = await Promise.all(users.map((u) => observe(u, 0.05)));

    expect(seen.map((s) => s.uid)).toEqual(users.map((u) => u.id));
    expect(seen.map((s) => s.email)).toEqual(users.map((u) => u.claims.email));
    expect(new Set(seen.map((s) => s.pid)).size).toBeLessThan(users.length);
  });

  it("FND-FR-10: a failing concurrent call does not disturb the others", async () => {
    const good = Array.from({ length: 4 }, () => createTestUser());
    const bad = createTestUser();

    const results = await Promise.allSettled([
      ...good.map((u) => observe(u, 0.2)),
      withRls({ userId: bad.id, claims: {} }, async () => {
        throw new Error("one failure");
      }),
    ]);

    expect(results.slice(0, 4).map((r) => r.status)).toEqual(
      Array(4).fill("fulfilled"),
    );
    expect(results[4]?.status).toBe("rejected");
    const uids = results
      .slice(0, 4)
      .map((r) => (r as PromiseFulfilledResult<Seen>).value.uid);
    expect(uids).toEqual(good.map((u) => u.id));
  });
});
