import { withAnonymousRls, withRls, type RlsTransaction } from "@/db";
import { getDb } from "@/db/client";

/**
 * Role helpers. They call the PRODUCTION `withRls` / `withAnonymousRls` (no
 * re-implementation), over the app's own `app_backend` connection, so a test
 * sees exactly what a request would see.
 */
export type UserClaims = {
  /** Verified user id (`auth.uid()`); must be a UUID. */
  sub: string;
  [claim: string]: unknown;
};

export type Actor = {
  readonly label: string;
  run: <T>(fn: (tx: RlsTransaction) => Promise<T>) => Promise<T>;
};

/** Authenticated user: `asUser({ sub, email }).run((tx) => ...)`. */
export function asUser(
  claims: UserClaims,
  options: { tenantId?: string; label?: string } = {},
): Actor {
  const { sub, ...rest } = claims;
  return {
    label: options.label ?? `user ${sub}`,
    run: (fn) =>
      withRls({ userId: sub, claims: rest, tenantId: options.tenantId }, fn),
  };
}

/** Anonymous visitor (database role `anon`, no user). */
export function asAnon(): Actor {
  return { label: "anonymous", run: (fn) => withAnonymousRls(fn) };
}

/**
 * The raw `app_backend` connection WITHOUT `withRls` (no role switch, no
 * claims). Only for proving that skipping `withRls` is denied. Private to the
 * app, importable here because tests are allowed to look behind the wrapper.
 */
export function asAppBackendWithoutRls() {
  return getDb();
}

/** Ends the app connection used by the helpers above; use in `afterAll`. */
export async function closeAppConnection(): Promise<void> {
  await getDb().$client.end({ timeout: 5 });
}
