import "server-only";

import { sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "./client";

/**
 * The single data-access entry point (ADR 0003, FND-FR-09). Every query runs
 * inside one transaction whose security context is set transaction-locally, so
 * Postgres RLS evaluates it as the caller. The runtime connection is the
 * `app_backend` role, which owns nothing and has no table privileges: a query
 * that skips this wrapper is denied rather than leaked.
 */

/** Transaction handle passed to the callback. Queries MUST use it, not `db`. */
export type RlsTransaction = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

/**
 * Security context of an authenticated request.
 *
 * Construct it ONLY in server code, after the session was verified with
 * `supabase.auth.getUser()` or `getClaims()` (signature validated by Supabase),
 * and, when `tenantId` is set, after a membership check. Never build it from a
 * decode-only read of a cookie or any request input: `withRls` trusts these
 * values completely. The real constructor arrives in epic 002 (auth module).
 */
export type VerifiedContext = {
  /** `auth.users.id` of the verified user (becomes `auth.uid()`). */
  readonly userId: string;
  /** Verified JWT claims. `sub` and `role` are always overwritten by `withRls`. */
  readonly claims: Readonly<Record<string, unknown>>;
  /** Tenant the request targets. A selector, not a credential (ADR 0003). */
  readonly tenantId?: string;
};

// The only roles the app may switch to. `SET LOCAL ROLE` cannot take bind
// parameters, so the SQL text is selected from this fixed table and never
// built from input.
const ROLE_STATEMENTS = {
  authenticated: sql.raw("set local role authenticated"),
  anon: sql.raw("set local role anon"),
} as const;

type RlsRole = keyof typeof ROLE_STATEMENTS;

const userIdSchema = z.uuid();

async function runInContext<T>(
  role: RlsRole,
  claims: Record<string, unknown>,
  userId: string | null,
  tenantId: string | undefined,
  fn: (tx: RlsTransaction) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    // Third argument `true` = transaction-local: commit or rollback resets it,
    // so nothing leaks to the next user of this connection.
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`,
    );
    if (userId !== null) {
      // Legacy GUC that some `auth.uid()` implementations still read.
      await tx.execute(
        sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
      );
    }
    if (tenantId !== undefined) {
      await tx.execute(
        sql`select set_config('app.current_tenant', ${tenantId}, true)`,
      );
    }
    await tx.execute(ROLE_STATEMENTS[role]);
    return fn(tx);
  });
}

/**
 * Runs `fn` in one transaction as role `authenticated` for the verified user.
 *
 * @throws if `ctx.userId` is missing, empty or not a UUID, or if `tenantId` is
 *   present but empty. It never falls back to another role.
 * @returns whatever `fn` returns; an error thrown by `fn` rolls back.
 */
export async function withRls<T>(
  ctx: VerifiedContext,
  fn: (tx: RlsTransaction) => Promise<T>,
): Promise<T> {
  const parsedUserId = userIdSchema.safeParse(ctx.userId);
  if (!parsedUserId.success) {
    throw new Error("withRls requires a non-empty verified user id (UUID).");
  }
  if (ctx.tenantId !== undefined && ctx.tenantId.trim() === "") {
    throw new Error("withRls received an empty tenant id.");
  }
  const userId = parsedUserId.data;
  // sub and role come from the verified values, so the claims can never
  // disagree with the GUCs or with the database role.
  const claims = { ...ctx.claims, sub: userId, role: "authenticated" };
  return runInContext("authenticated", claims, userId, ctx.tenantId, fn);
}

/**
 * Explicit anonymous variant: runs `fn` as role `anon`, with no user and no
 * tenant. For endpoints that must work without a session (e.g. health checks).
 * It exists so that "no user" can never be reached by passing an empty id to
 * `withRls`.
 */
export async function withAnonymousRls<T>(
  fn: (tx: RlsTransaction) => Promise<T>,
): Promise<T> {
  return runInContext("anon", { role: "anon" }, null, undefined, fn);
}
