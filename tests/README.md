# Tests

Three layers, each with its own command. Write every test at the cheapest layer
that gives real confidence.

| Layer    | Command         | Where                          | Needs Docker/Supabase                      |
| -------- | --------------- | ------------------------------ | ------------------------------------------ |
| Unit     | `pnpm test`     | `src/**/*.test.ts` (colocated) | No                                         |
| DB / RLS | `pnpm test:db`  | `tests/db/*.test.ts`           | Yes (local Supabase)                       |
| E2E      | `pnpm test:e2e` | `tests/e2e/*.spec.ts`          | No (no database; DB variables are removed) |

Coverage (report only, no threshold): `pnpm test:coverage`.

## Prerequisites

- Node 26 and pnpm from `package.json` (`node -v` must be 26.x), `pnpm install`.
- Docker running (DB tests only).
- Chromium for E2E, once per machine: `pnpm exec playwright install chromium`
  (CI later: `pnpm exec playwright install --with-deps chromium`). Browsers are
  stored in the user cache (`~/Library/Caches/ms-playwright` on macOS), outside
  the repository, so they are never committed.
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
4, 6, 8 (catalog), 9 and the schema guard are in the T-16 section below; test 10
(lint fixture) belongs to FND-T-38.

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

## Isolation, role model and schema guard (FND-T-16)

Files (all real Postgres, through the production `withRls`):

- `tests/db/tenant-isolation.test.ts`: ADR test 4. Throwaway `memberships`,
  `items` (membership policy) and `scoped` (membership AND the
  `app.current_tenant` selector) tables. Actor x action x tenant matrix (user A,
  user B, a member of both, a valid user without membership, anonymous with and
  without a grant) plus explicit attack tests checked from the privileged
  connection: no side effects on tenant B, tampered tenant id on INSERT and
  UPDATE rejected by `WITH CHECK`, `ON CONFLICT DO UPDATE` hijack, forged
  tenant/role claims, malformed selector, membership removal takes effect on the
  next call.
- `tests/db/app-backend-role.test.ts`: ADR test 6 and FND-FR-08 from the
  catalog (`pg_roles`, `pg_auth_members`, `pg_shdepend`, `has_*_privilege`), plus
  runtime refusal of `SET ROLE` to every role other than `authenticated`/`anon`
  and of `SET SESSION AUTHORIZATION`, also from inside `withRls`.
- `tests/db/schema-guard.test.ts`: FND-FR-22 (ADR test 9) and ADR test 9 of
  FND-FR-10 (policy-less table returns zero rows). The guard is
  `tests/utils/schema-guard.ts` and reads the catalog; its own tests prove it
  reports a table without RLS, with RLS but no policy, with a policy but RLS off,
  and a partitioned table, and honors the allowlist (`SCHEMA_GUARD_ALLOWLIST`,
  empty). Every real table added in epic 002 is checked automatically.

Not covered here, on purpose: the lint fixture (ADR test 10, FND-T-38); the Data
API being off (an HTTP check of the local stack, not a database property; the
`[api] enabled = false` setting was verified manually in FND-T-06/T-08);
views, functions and `SECURITY DEFINER` helpers in `public` are not checked by
the guard (it covers tables only, as FND-FR-22 states).

Mutation record. Each row was applied temporarily (SQL against the local
database, or an edit of the test file or the guard, always restored) and the
named suite was run. "Equivalent" means the mutation does not change the
behavior, so the test correctly stays green.

| Mutation (thing under test weakened)                                  | Result                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| RLS disabled on the `items` table                                     | 34 red (matrix, anon, attack tests)                                            |
| `WITH CHECK (true)` on `items`                                        | 6 red (insert in matrix, tampered INSERT, insert for tenant B)                 |
| `USING (true)` on `items`                                             | 15 red (cross-tenant select/update/delete, forged context, membership removal) |
| policy `TO public` with the membership check kept                     | green: equivalent (anon has no `auth.uid()`, the check still denies)           |
| policy `TO public USING (true)`                                       | 19 red (anon granted, forged context)                                          |
| `memberships` read policy `USING (true)`                              | 1 red (other tenant's memberships visible)                                     |
| `INSERT` privilege and permissive policy on `memberships`             | 1 red (self-granted membership)                                                |
| `scoped` policy without the membership check                          | 4 red (outsider and non-member selector)                                       |
| `scoped` policy without the selector                                  | 9 red                                                                          |
| `scoped` `WITH CHECK` without the selector (first run: survived)      | 4 red after the fix below                                                      |
| `app_backend` BYPASSRLS / SUPERUSER / INHERIT / CREATEROLE+CREATEDB   | 1 / 13 / 1 / 1 red                                                             |
| `authenticated` BYPASSRLS                                             | 1 red                                                                          |
| `service_role` granted to `app_backend` with SET                      | 4 red (membership list, SET ROLE tests)                                        |
| `anon` granted with INHERIT / `ADMIN OPTION` on `authenticated`       | 2 / 1 red                                                                      |
| `anon` membership dropped                                             | 1 red                                                                          |
| `authenticated` made a member of `service_role` (transitive path)     | 6 red                                                                          |
| `app_backend` owns a table / owns a schema                            | 4 / 2 red                                                                      |
| `SELECT` on a table granted to PUBLIC / column grant to `app_backend` | 2 red each                                                                     |
| `SELECT` on `auth.users` granted to `app_backend`                     | 1 red                                                                          |
| `CREATE` on schema `public` granted to `app_backend`                  | 1 red                                                                          |
| default privileges for new tables / sequences restored for anon+auth. | 1 red each                                                                     |
| real `public` table without RLS / RLS but no policy / policy, RLS off | guard test red (3 red each, incl. a partitioned table)                         |
| guard ignores the RLS flag / ignores the policy count / ignores `p`   | 1 red each (the matching self-test)                                            |
| guard ignores the allowlist / queries another schema                  | 1 / 7 red                                                                      |
| policy-less table gets RLS off / a permissive policy                  | 4 red each (zero-rows tests)                                                   |

Lessons recorded while writing these: a first version of the insert case used
`RETURNING`, which also runs the SELECT policy on the new row and masked a weak
`WITH CHECK` (the mutation survived); the matrix now counts rows without
`RETURNING`. Allow cases seed their own row, so no case depends on another.
Tests rely on `fileParallelism: false`: the guard on the real schema would see
another file's throwaway tables if files ran in parallel.

## Hardening catalog tests (FND-T-51)

File: `tests/db/hardening-catalog.test.ts`. It locks the facts of the two
migrations (`..._app_backend_role.sql`, `..._app_backend_timeouts_function_privileges.sql`)
that neither the role tests nor the schema guard cover:

- Timeouts (FND-NFR-05): `pg_roles.rolconfig` of `app_backend` holds
  `statement_timeout=8s` and `idle_in_transaction_session_timeout=10s`; both are
  the effective values inside `withRls` and `withAnonymousRls`; `pg_sleep(9)` is
  cancelled with 57014 (this one test takes about 8 s, the price of proving the
  setting really bites; a 0.05 s sleep is the control). The idle-in-transaction
  timeout is checked from the catalog and the effective value only; waiting 10 s
  with an idle transaction to see it fire was judged not worth the time.
- Functions (FND-FR-08): a function created by `postgres` in `public` (and in a
  new schema) has no EXECUTE for PUBLIC, `anon` or `authenticated` (read from
  `proacl`, `has_function_privilege`, and by calling it: 42501), and works for
  `authenticated` only after an explicit grant. No real function in `public` is
  executable by `anon`.
- Table and sequence grants (FND-FR-08, FND-FR-10): `anon` holds no table,
  column or sequence privilege on any real `public` relation (tables, views,
  partitions, sequences); a table or identity sequence created without grants
  is closed to `anon` and `authenticated`. Throwaway `tmp_test_*` relations are
  excluded from the real-schema scan (they are granted on purpose in their own
  tests); the scan is shown to be non-vacuous by a granted control table. The
  real schema is empty today, so the default-privilege tests (table without
  grants, sequence) are what bite until epic 002 adds tables; the scan starts
  protecting once real tables exist.
- Known residual (ADR 0003): a table created as `supabase_admin` is still
  granted to `anon`. The test pins the current behavior (anon IS granted) with a
  comment; when it fails the residual risk has gone and the ADR note and the
  test should be removed. It connects as `supabase_admin` with the local
  password (loopback only, same guard as the rest of the suite).
- Data API: `GET /rest/v1/` with the public local demo anon key is not 2xx and
  has no OpenAPI document. It takes about 50 ms. The key is sent on purpose:
  without it an enabled API would answer 401 and the test could not tell.

Mutation record (SQL applied to the local database, the file run, then
restored; nothing is committed):

| Mutation                                                         | Tests that failed                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `statement_timeout` reset / set to 30s on `app_backend`          | rolconfig, effective authenticated, effective anon, pg_sleep (4)   |
| `idle_in_transaction_session_timeout` reset                      | rolconfig, effective authenticated, effective anon (3)             |
| default function EXECUTE granted back to PUBLIC                  | all 5 function tests (public, new schema, anon call, auth call)    |
| default function EXECUTE in `public` granted to `anon`           | owner/service_role list, has_function_privilege, anon call (3)     |
| default function EXECUTE in `public` granted to `authenticated`  | owner/service_role list, has_function_privilege, authenticated (3) |
| default `select` on tables granted to `anon`                     | table without grants, anon read with RLS off (2)                   |
| default `all` on tables granted to `authenticated`               | table without grants (1)                                           |
| default `usage` on sequences granted to `anon` / `authenticated` | identity sequence (1 each)                                         |
| real table / column grant / view / sequence granted to `anon`    | real-schema scan (1 each)                                          |
| real function in `public` granted EXECUTE to `anon`              | no real function executable by anon (1)                            |
| Data API enabled (`[api] enabled = true`, stack restarted)       | `/rest/v1/` test (1; the status becomes 200)                       |

## `/api/health/db` and Data API config tests (FND-T-53)

Files (unit project, no Docker): `src/app/api/health/db/route.test.ts` and
`src/app/api/health/db/data-api-config.test.ts`.

- Route: `@/db` is replaced by a fake `withAnonymousRls`. It checks 200
  `{"status":"ok","role":"anon"}`, 503 `{"status":"unavailable"}` for an `Error`
  and for a non-`Error` throw, `force-dynamic`, and that a thrown error carrying
  `postgresql://app_backend:secret@db.example.com:6543/postgres` (in message and
  stack) leaks none of the URL, scheme, user, password, host or port, neither in
  the response body nor in anything written through `console.*` (logged
  arguments are serialized with `util.inspect`, because `JSON.stringify` drops
  `Error` messages). A failure must still be logged (so silence is not a pass).
- Config: `supabase/config.toml` has `enabled = false` inside `[api]`. The
  parser is section-aware (other sections, `[api.tls]`, comments), with its own
  self-checks. The HTTP check in `hardening-catalog.test.ts` stays: this one
  needs no stack, that one proves the running stack agrees.

Mutation record (applied temporarily, `src/app/api/health/db` run, restored with
`git checkout`; nothing is committed):

| Mutation                                            | Result                                    |
| --------------------------------------------------- | ----------------------------------------- |
| 503 body also returns `error.message`               | 8 red (every body leak case)              |
| route logs the whole `error` object                 | 7 red (log leak cases)                    |
| route logs `error.message`                          | 6 red                                     |
| route no longer logs anything                       | 1 red (failure is still logged)           |
| 503 changed to 500                                  | 2 red                                     |
| `role` taken from a constant instead of the query   | 1 red                                     |
| `dynamic` changed to `auto`                         | 1 red                                     |
| `[api] enabled = true`                              | 1 red                                     |
| `enabled = false` moved to another section (`[zz]`) | 1 red (a different section does not pass) |

First draft lesson: the log check used `JSON.stringify`, so logging the raw
`Error` object survived (1 red instead of 7); it now uses `util.inspect`.

## E2E (FND-T-17)

Files: `playwright.config.ts` (root), `tests/e2e/home.spec.ts` (heading, HTTP 200,
no console errors, axe with the WCAG 2.2 AA tags in light and dark, no horizontal
scroll at 375 and 1280 px) and `tests/e2e/health.spec.ts` (`GET /api/health` is
200 with `{"status":"ok"}`). Chromium only for now.

Production-like start: `pnpm test:e2e` makes Playwright run
`pnpm build && next start --port 3100` (port 3100 so a `pnpm dev` on 3000 does
not collide; override with `E2E_PORT`). The three `NEXT_PUBLIC_*` variables are
set by the config with the `.env.example` values, and `DATABASE_URL` /
`DATABASE_MIGRATION_URL` are removed from the server environment, because the
deployed app has no database. A server already on the port is never reused, so
a stale build cannot be tested. No `.env.local` is needed.

Against an already deployed URL (used by the post-deploy hello-world check,
FND-T-24): set `E2E_BASE_URL`; the config then starts no server and builds
nothing:

```bash
E2E_BASE_URL=https://my-app.example.com pnpm exec playwright test tests/e2e/health.spec.ts
```

Run only `health.spec.ts` that way: `home.spec.ts` is also valid remotely but is
not the hello-world check. Verified locally against a separately started
`next start`.

Scope rule: axe runs on every key page in E2E. `/design` checks arrive with
FND-T-33; add each new page to the axe tests when the page exists.

Mutation record (each applied temporarily, E2E run, restored with
`git checkout`; never committed):

| Mutation                                          | Result                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `<h1>` changed to `<h2>` on the home page         | heading test red (axe stays green: expected)          |
| `<img>` without `alt` added                       | both axe tests red (also the console test, image 404) |
| low-contrast paragraph (`#ccc` on `#fff`) added   | both axe tests red (`color-contrast`)                 |
| 2000 px wide element added                        | both horizontal-scroll tests red                      |
| `/api/health` body changed to `{"status":"down"}` | health test red                                       |
| `console.error` script added to the home page     | console test red                                      |

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
- E2E: `pnpm exec playwright test --headed`, `--ui` for the UI mode, one file:
  `pnpm test:e2e tests/e2e/health.spec.ts`. The HTML report is written to
  `playwright-report/` (`pnpm exec playwright show-report`). Traces are recorded
  on the first retry only (CI retries twice, local runs do not retry); to force
  one locally use `pnpm test:e2e --trace on`, then open it with
  `pnpm exec playwright show-trace test-results/<test>/trace.zip`.
