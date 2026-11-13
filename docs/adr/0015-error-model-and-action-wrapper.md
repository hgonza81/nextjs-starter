# 0015. Error model, Result type and action wrapper

Status: Accepted
Date: 2026-11-13
Epic: 002-platform-hardening

## Context
Convention C6 requires actions to return a typed result, but no type exists. Every module will write actions; without one shape and one wrapper each would invent its own error handling, leak database messages, or swallow framework control flow (`redirect()`, `notFound()`). Users also need a reference code to quote when something unexpected fails.

## Options considered
1. **Result type plus a `defineAction` wrapper** (chosen): one shape, one place for parse, catch, map, log.
2. Convention only (each action hand-writes try/catch): inconsistent, untestable as a unit.
3. Throw errors and let `error.tsx` render them: loses field errors, shows generic pages for expected failures, and server-action errors are masked in production.
4. A shared error renderer component: rejected (PH-AC-48 removed); each form decides its UI.

## Decision
Option 1.
- **Types** in `src/lib/errors.ts` (domain-free, no `server-only`, so the UI can import them): `AppErrorType = "validation" | "not_found" | "forbidden" | "conflict" | "unexpected"`; `class AppError extends Error` with `type` and optional `fieldErrors`; helpers `validationError`, `notFoundError`, `forbiddenError`, `conflictError` (deliberately not named `notFound`/`forbidden`, which would collide with the Next.js functions that must pass through the wrapper). Wire shape is plain and serializable: `ActionError = { type; message; fieldErrors?; ref? }` and `Result<T> = { ok: true; data: T } | { ok: false; error: ActionError }`. `ref` exists only for `unexpected`.
- **DB mapping:** `fromDbError(err)`, duck-typed on `.code` (so `lib` imports nothing from `db`), walks the `cause` chain up to 3 levels (Drizzle wraps driver errors). `23505` and `23503` map to conflict; `42501` to forbidden; `23502` and `23514` to validation (no field mapping); everything else, including `57014`, `40001`, `40P01`, to unexpected with no database message. Rows hidden by RLS on SELECT/UPDATE/DELETE return zero rows silently: "not found" is the handler's job, and rows hidden by RLS are reported as `not_found`, never `forbidden`, so existence does not leak across tenants.
- **Wrapper** `src/lib/action.ts`: `defineAction({ name, schema, handler })` returns `(input: unknown) => Promise<Result<T>>`. Order: `schema.safeParse` (invalid returns validation via `z.flattenError`; the handler does not run); handler; on throw, `unstable_rethrow(err)` first (so `redirect()`, `notFound()`, `forbidden()` and dynamic-rendering signals pass through), then `AppError` (log `warn`), then `fromDbError`, then unknown becomes `unexpected` with `ref` and a `logger.error`. No authentication inside yet. Seam for epic 003: a sibling `defineAuthedAction` or a context argument that resolves a verified context with `getUser()` before the handler.
- **Reference code:** on error pages and in the hook `ref` is the framework `error.digest`; the wrapper always generates its own, `newRef()` (8 hex characters from `crypto.randomUUID()`), for an `unexpected` result, so it is unique per occurrence and matches `^[A-Za-z0-9_-]+$`. It carries no personal data and need not be secret. It is shown as selectable text, no copy button. A digest is a hash of the error, so the same bug yields the same code on pages (good for lookup, not unique per request).
- **Known limits (stated, not fixed):** errors thrown in Client Components have no digest and do not reach the server hook; `onRequestError` is observe-only and cannot add a code to a route handler response, so route handlers and unwrapped actions return Next's generic response and the code reaches the user only through the wrapper (PH-AC-10 relaxed).
- **Error pages:** 500, `global-error.tsx` (C2, included) and 404 share a small `StatusPage` in `src/components/layout/`, listed on `/design`.

## Consequences
- Positive: one result shape for every module; control flow preserved; no database text reaches users; the hook and the wrapper log through the same logger (ADR 0013).
- Negative: modules must route all actions through the wrapper (lint or review; a custom rule is not built now).
- **Spikes:** Drizzle error `cause` shape against the real database (a `test:db` case); a `"use server"` file exporting `defineAction(...)` results is accepted by the Next build (it checks that exports are async functions); `onRequestError` not firing for `redirect()`/`notFound()`; whether `global-error` receives the nonce (ADR 0014).
- Updates convention C6 with the concrete type. Revisit when authenticated actions are added in epic 003.

## Spike outcome
Run 2026-11-13 under PH-T-01 (Next.js 16.4.6, Postgres 17 local, real `app_backend` role). All five assumptions hold; no design change.

1. **Drizzle `cause` shape: confirmed.** Every failure is a `DrizzleQueryError` (no `code`) whose `.cause` is the driver `PostgresError` carrying the SQLSTATE: `23505` unique, `23503` foreign key, `23502` not null, `23514` check, `42501` permission denied (all at depth 1). Evidence: a throwaway `node` script against `postgresql://app_backend@127.0.0.1:54322` printing the `cause` chain. Consequence: `fromDbError` walking up to 3 levels is sufficient. `DrizzleQueryError.message` contains the SQL text and parameters, so it must never be shown or logged as-is (reinforces "no database message to users" and the logger's errors-reduced-to-name-and-code rule).
2. **`"use server"` file exporting a `defineAction(...)`-style result: confirmed, no workaround.** A `"use server"` file with `export const x = makeAsyncFn()` built with `pnpm build`, appeared in `server-reference-manifest.json`, and a direct POST with the `Next-Action` header to `pnpm start` returned HTTP 200 and the expected result. Consequence: modules can `export const myAction = defineAction(...)` from `"use server"` files.
3. **`onRequestError` does not fire for `redirect()`/`notFound()`: confirmed.** With a logging hook on `build` + `start`, `/spike/redirect` (307) and `/spike/notfound` (404) logged nothing, while `/spike/throw` logged exactly one hook line (`routeType=render`). Consequence: the hook needs no filter for control-flow signals (`unstable_rethrow` in the wrapper is a separate path and stays).
4. **HTTP 500 under `connection()` in the root layout: confirmed.** With `await connection()` in the root layout and a page that throws before streaming, `curl -w "%{http_code}"` against `pnpm start` returned `500`, not 200. Consequence: status-code assertions are valid in production mode.
5. **`error.digest` in production: confirmed.** The thrown server error got a digest (`3849511219`), visible in the server log, in the `onRequestError` argument (`err.digest`) and in the RSC payload sent to the client. Consequence: the hook can use `digest` as `ref`, matching what error pages show.

All throwaway code was removed; only this section is committed.

## References
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`
- `.../03-file-conventions/error.md` (digest), `instrumentation.md` (`onRequestError`)
- Epic 002 `questions.md` (C2, D5 to D9); ADR 0003, ADR 0011, ADR 0013.
