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
