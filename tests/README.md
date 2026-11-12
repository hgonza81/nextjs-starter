# Tests

Three layers, each with its own command. Write every test at the cheapest layer
that gives real confidence.

| Layer    | Command         | Where                          | Needs Docker/Supabase                              |
| -------- | --------------- | ------------------------------ | -------------------------------------------------- |
| Unit     | `pnpm test`     | `src/**/*.test.ts` (colocated) | No                                                 |
| DB / RLS | `pnpm test:db`  | `tests/db/*.test.ts`           | Yes (local Supabase)                               |
| E2E      | `pnpm test:e2e` | `tests/e2e/`                   | Not available yet (Playwright arrives in FND-T-17) |

Coverage (report only, no threshold): `pnpm test:coverage`.

## Prerequisites

- Node 26 and pnpm from `package.json` (`node -v` must be 26.x), `pnpm install`.
- Docker running (DB tests only).
- Local Supabase started and migrated: `pnpm db:start`, then `pnpm db:reset`
  once (it applies the migrations and `supabase/seed.sql`, which creates the
  `app_backend` role and its local password).
- No `.env.local` is needed for the DB tests: `tests/utils/local-env.mts` holds
  the local, non-secret defaults (same as `.env.example`). Real environment
  variables override them. The suite refuses any non-loopback database host.

## Resetting state

- Whole database (suite level): `pnpm db:reset`. Use it when the schema looks
  wrong or after changing migrations.
- Per test: tests create their own data with unique names and clean up. Test
  tables are dropped after each test (or file). A crashed run is cleaned by the
  global setup, which drops leftover `public.tmp_test_*` tables.
- Run `pnpm test:db` twice in a row: it must pass both times.
- Stop the stack when done: `pnpm db:stop`.

## DB test harness (`tests/utils/`)

A new DB test needs only these helpers (see `tests/db/harness.test.ts` for a
working example):

- `roles.ts`: `asUser(claims).run(fn)` and `asAnon().run(fn)` call the
  production `withRls` / `withAnonymousRls` over the app's own `app_backend`
  connection (nothing is re-implemented). `asAppBackendWithoutRls()` is the raw
  app connection, for proving that skipping `withRls` is denied.
  `closeAppConnection()` in `afterAll`.
- `admin.ts`: `adminSql()` is a privileged `postgres` connection, ONLY for
  setup and teardown (it bypasses RLS). `closeAdmin()` in `afterAll`.
- `throwaway-table.ts`: `createThrowawayTable({ columns, rls, policies, grants })`
  creates a uniquely named `public.tmp_test_*` table; `dropThrowawayTablesAfter()`
  drops it. Grants must be explicit: after the `app_backend` migration a new
  table is denied to `anon` and `authenticated` by default (fail closed).
  Throwaway tables never go into `supabase/migrations/`.
- `access-matrix.ts`: `defineAccessMatrix([{ actor, action, expected, run }])`
  generates one test per case. `run` returns the rows seen or changed; "deny"
  means a Postgres permission error (42501) or zero rows.
- `factories.ts`: `createTestUser()`, `createTenant()` are stubs that build
  unique in-memory values (no rows). Epic 002 replaces them with real factories.
- `ids.ts`: `uniqueName`, `uniqueEmail`, `newId` for data that cannot collide
  between tests or parallel runs.

Rules: assert observable outcomes (what a role sees, what is in the database),
one concept per test, test names start with the requirement ID, no `sleep`.

## `withRls` context tests and mutation record (FND-T-15)

Files: `tests/db/with-rls-context.test.ts` (pool size 1, the production
`getDb()`) and `tests/db/with-rls-parallel.test.ts` (item 3). They cover ADR 0003
required tests 1, 2, 3, 5 and 7, the anonymous variant, and the fail-closed
check that a query through the app connection without `withRls` is denied. Tests
4, 6, 8 (as a catalog test), 9 and 10 belong to FND-T-16.

Parallel test: the production client has `max: 1`, so calls would only queue.
The parallel file replaces the module `@/db/client` (and nothing else) with a
client of the same shape but a pool of 8; `withRls` itself is the unmodified
production code. The test asserts that several backend PIDs were used, so it
proves real concurrency. Limit: the pool size is a test choice, and the
production pool of 1 is covered by the other file.

Each assertion was checked by temporarily mutating `src/db/rls.ts` (restored
with `git checkout src/db/rls.ts` after every run; mutations are never
committed). Result: every mutation turned the suite red.

| Mutation of `src/db/rls.ts`                                  | Tests that failed (main ones)                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| claims `set_config(..., false)` (not transaction-local)      | (2) after commit, after rollback, after anonymous call; (7) after a database error                                  |
| `request.jwt.claim.sub` `set_config(..., false)`             | (2) after commit/rollback; anonymous variant (inherits previous sub)                                                |
| `app.current_tenant` `set_config(..., false)`                | (1) tenant only when supplied; (2) after commit/rollback/next user; (7) next user; anonymous variant                |
| remove `set local role` (never switch role)                  | (1) role, `auth.uid()`, claims; (2); (3) all parallel tests; (7) rollback tests; fail-closed read through `withRls` |
| `set role` (session-level) instead of `set local role`       | (2) after commit/rollback/anonymous; (5) connection default after refusal; (7); fail-closed without `withRls`       |
| caller claims override verified `sub`/`role`                 | (1) forged `sub` and `role` overwritten; `auth.jwt()`/`auth.role()`                                                 |
| `role` claim not overwritten                                 | (1) forged role, claims unchanged, `auth.role()`; (2) next user                                                     |
| `request.jwt.claim.sub` never set                            | (1) `auth.uid()`; (2); (3) parallel; (7)                                                                            |
| skip user id validation entirely                             | (5) all ten invalid ids                                                                                             |
| reject only the empty string (no UUID check)                 | (5) whitespace, not a UUID, newline/space-padded UUID, number, null, undefined, injection-looking string            |
| invalid id falls back to the `anon` role instead of throwing | (5) every invalid id, callback ran under a role, default context                                                    |
| swallow the callback error inside the transaction            | (7) rollback, error propagation, database error; (2) after rollback; (3) failing concurrent call                    |
| drop the empty tenant id check                               | (5) empty and whitespace tenant id                                                                                  |
| anon variant switches to `authenticated`                     | anonymous variant (role anon, `auth.role()`)                                                                        |

## When the stack is down

`pnpm test:db` fails immediately, before any test, with a message naming the
cause: stack not running (`pnpm db:start`) or role `app_backend` cannot log in
(`pnpm db:reset`). The "No test files found" line printed above it is a Vitest
side effect of the aborted start; the exit code is non-zero.

## Debugging

- One file: `pnpm test:db tests/db/harness.test.ts`; one test:
  `pnpm test:db -t "switches to anon"`.
- Watch mode: `pnpm exec vitest --project db`.
- Inspect the database: Studio at http://127.0.0.1:54323, or
  `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- A failing "deny" case that unexpectedly passes usually means a missing or
  too broad `grant` or policy in the test setup.
- Playwright trace viewer and headed mode are documented when E2E exists.
