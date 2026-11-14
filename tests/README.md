# Tests

Three layers, each with its own command. Write every test at the cheapest layer
that gives real confidence. Every test name starts with the requirement it
protects (for example `FND-FR-22: ...`).

## Commands

| Layer    | Command         | Where                                                 | Needs Docker/Supabase                      |
| -------- | --------------- | ----------------------------------------------------- | ------------------------------------------ |
| Unit     | `pnpm test`     | `src/**/*.test.ts(x)` (colocated) and `tests/lint/**` | No                                         |
| DB / RLS | `pnpm test:db`  | `tests/db/*.test.ts`                                  | Yes (local Supabase)                       |
| E2E      | `pnpm test:e2e` | `tests/e2e/*.spec.ts`                                 | No (no database; DB variables are removed) |

- `pnpm test` is Vitest, project `unit`. It passes with Docker stopped.
- `pnpm test:db` is Vitest, project `db`, real local Supabase as the `app_backend`
  role. Files run one after another (`fileParallelism: false`).
- `pnpm test:e2e` is Playwright (Chromium) against a production build. It builds
  once and starts four servers (see "E2E (FND-T-17)", "E2E: design system" and
  "E2E: platform hardening harness").
- Any extra argument is passed to the runner: `pnpm test src/lib`,
  `pnpm test:db tests/db/harness.test.ts`, `pnpm test:e2e tests/e2e/health.spec.ts`.
- Coverage is report only, with no threshold (FND-FR-19): `pnpm test:coverage`
  runs the unit project with v8 and prints a text summary (HTML in `coverage/`).
  It is a signal; read the uncovered risky branches, do not chase a percentage.
- Quick loop while coding: `pnpm test`. Before a commit: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`. Before a merge or push: also `pnpm test:db`
  and `pnpm test:e2e` (CI runs all of them).

## Layout

```text
src/**/*.test.ts(x)          unit tests, next to the code they test
tests/
  db/                        DB / RLS tests (project `db`)
  e2e/                       Playwright specs; helpers/ holds axe and /design helpers
  lint/                      lint boundary-rule tests (run in `pnpm test`)
    fixtures/{cycle,acyclic}/  real files for the import-cycle rule
  utils/                     shared harness: roles, admin, throwaway tables, matrices,
                             schema guard, factories, ids, local env, global setup
```

Shared configuration: `vitest.config.mts` (projects `unit` and `db`, the `@/`
alias, a stub for `server-only`) and `playwright.config.ts`.

## Prerequisites

- Node 26 and pnpm from `package.json` (`node -v` must be 26.x), `pnpm install`.
- Docker running (a Docker-compatible runtime such as Docker Desktop or OrbStack)
  for `pnpm test:db` and the local stack. `pnpm test` and `pnpm test:e2e` do not
  need it.
- Local Supabase started and migrated, for `pnpm test:db` only: `pnpm db:start`,
  then `pnpm db:reset` once (it applies the migrations and `supabase/seed.sql`,
  which creates the `app_backend` role and its local password).
- Chromium for E2E, once per machine: `pnpm exec playwright install chromium`
  (CI: `pnpm exec playwright install --with-deps chromium`). Browsers are stored
  in the user cache (`~/Library/Caches/ms-playwright` on macOS), outside the
  repository, so they are never committed.
- Environment variables: none are needed. `tests/utils/local-env.mts` holds the
  local, non-secret DB defaults (same as `.env.example`) and real environment
  variables override them; the suite refuses any non-loopback database host.
  `playwright.config.ts` sets the three `NEXT_PUBLIC_*` variables itself with
  the `.env.example` values (verified: `pnpm test:e2e` passes with none of them
  exported). If you start the app by hand outside Playwright, export the three
  `NEXT_PUBLIC_*` values from `.env.example` first.

## Resetting state

- Whole database (suite level): `pnpm db:reset`. Use it when the schema looks
  wrong or after changing migrations.
- Per test: tests create their own data with unique names and clean up. Test
  tables are dropped after each test (or file). A crashed run is cleaned by the
  global setup, which drops leftover `public.tmp_test_*` tables.
- Run `pnpm test:db` twice in a row: it must pass both times.
- Stop the stack when done: `pnpm db:stop`.
- E2E keeps no state between runs; `test-results/` and `playwright-report/` are
  overwritten by each run.

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
  empty). Every real table added in epic 002 is checked automatically. See
  "Schema guard allowlist" below.

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

## Schema guard allowlist

The guard (`findUnguardedPublicTables` in `tests/utils/schema-guard.ts`, used by
`tests/db/schema-guard.test.ts`) fails `pnpm test:db` when a table in `public`
has RLS disabled or no policy. The only escape hatch is
`SCHEMA_GUARD_ALLOWLIST` in the same file, a list of bare table names that is
empty and must stay empty unless a table is justified in a code review (put the
reason in a comment next to the name). Prefer fixing the table: enable RLS and
add a policy in the migration. Throwaway `tmp_test_*` tables of other tests are
created and dropped inside their own tests and are not allowlisted.

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

In that mode the config defines a single `deployed` project that only matches
`health.spec.ts` and `design-gate.spec.ts` (see the next section), so a bare
`E2E_BASE_URL=<url> pnpm exec playwright test` is safe too: the other specs need
the `/design` page and would fail against a deployment. Verified locally against
a separately started `next start`.

Scope rule: axe runs on every key page in E2E; add each new page to the axe
tests when the page exists.

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

## E2E: design system (FND-T-33)

Files in `tests/e2e/` (helpers in `tests/e2e/helpers/`), 100 new tests:

| File                         | Requirement           | What it checks                                                                                                                                                                                                                         |
| ---------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `design-a11y.spec.ts`        | FND-NFR-03            | axe (wcag2a/aa, 21a/aa, 22aa), zero violations: `/design` at 375 and 1280 in both OS color schemes with all 18 iframes loaded; each frame route at 375/768/1280 x OS light/dark x no theme, `?theme=light`, `?theme=dark` (54 combos)  |
| `design-layout.spec.ts`      | FND-NFR-04            | `/design` has no horizontal page scroll at 375 and 1280 (home page: `home.spec.ts`)                                                                                                                                                    |
| `design-theme.spec.ts`       | FND-FR-15, FND-FR-16  | key tokens resolve to the `globals.css` values in light and dark; dark OS first paint with JavaScript off; SSR HTML has the stylesheet and no theme script/class; background at the first paint entry; `data-theme` panel on `/design` |
| `design-form-field.spec.ts`  | FND-FR-16             | `aria-invalid`, `aria-describedby` to the polite live error, `aria-required`, focus on the first invalid field, password toggle with Enter and Space                                                                                   |
| `design-app-shell.spec.ts`   | FND-FR-16, FND-NFR-03 | drawer at 375 through the app-shell frame: keyboard open, dialog named Navigation, focus inside, Tab/Shift+Tab trap, Escape returns focus, resize across `md` closes it; skip link focuses `#main-content`                             |
| `design-live-states.spec.ts` | FND-FR-16             | Button hover/active tokens, 2px ring on keyboard focus only, disabled and loading ignore click and Enter                                                                                                                               |
| `design-toast.spec.ts`       | FND-FR-16             | exactly one Sonner region on `/` and `/design`, a trigger shows one toast in the polite live region                                                                                                                                    |
| `design-gate.spec.ts`        | FND-FR-17             | `/design` and sub-routes return 404 with the flag off; `/` and `/api/health` stay 200                                                                                                                                                  |

Two servers, one build. `pnpm test:e2e` builds once, then starts two
production servers from that build: port 3100 with `DESIGN_PAGE_ENABLED=true`
(project `chromium`, every spec except the gate) and port 3101 with the flag
unset (project `design-gate-off`, only `design-gate.spec.ts`). The second port
is `E2E_PORT + 1`; the flag is removed from its environment even if exported in
the caller's shell. Web servers start in order, so the second one only starts
after the build is done. CI needs no change: the `database-and-e2e` job runs
`pnpm test:e2e`, which goes through `playwright.config.ts`.

Against a deployment (FND-T-46: Vercel has no flag, so `/design` must be 404):

```bash
E2E_BASE_URL=https://my-app.example.com pnpm exec playwright test tests/e2e/health.spec.ts tests/e2e/design-gate.spec.ts
```

Notes and limits:

- The 18 lazy iframes of `/design` are made eager (`loading = "eager"`) and
  waited for before axe runs, so the checked DOM is the same on every run.
- Expected token colors are read from `src/app/globals.css` by the test (no
  hex is duplicated), and actual colors come from a probe element that uses
  `var(--token)`. Color transitions (100 ms) are awaited with `expect.poll`.
- "Ignores click" for a loading Button is observed as: the click reaches the
  page but is default-prevented by the Button (a form would not submit), and no
  state changes. `/design` has no handler or form to observe more than that.
- The drawer hides the page from assistive technology while open (Radix), so
  the hamburger's `aria-expanded` is read through its attribute selector then.
- Playwright treats `aria-disabled` as not actionable, so the loading Button
  is clicked with `force: true`.
- Not covered: `prefers-reduced-motion`, the toast auto-dismiss, WebKit and
  Firefox, visual regression (out of scope of the task).

Mutation record (each applied temporarily, `pnpm test:e2e` run, restored with
`git checkout -- src`; never committed). Baseline is 106 passed.

| Mutation                                                              | Result                                                              |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| low-contrast paragraph (`#ccc` on `#fff`) added to the `/design` page | 4 red (axe on `/design`, 375 and 1280, light and dark)              |
| unlabeled `<input>` added to the `/design` page                       | 4 red (same four)                                                   |
| `gateDesignPage` call removed from `src/app/design/layout.tsx`        | 6 red (all `design-gate.spec.ts` 404 tests)                         |
| `aria-describedby` never set in `form-field.tsx`                      | 1 red (invalid control points at the live error)                    |
| raw `bg-[#123456]` on the default Button                              | 23 red (live-state color test and axe contrast on `/design` frames) |
| default Button hover uses `bg-primary` instead of `bg-primary-hover`  | 1 red (hover token test)                                            |
| `dark:bg-muted` added to `card.tsx` (unit check, `pnpm test`)         | 1 red (`design-consistency.test.ts`)                                |
| Escape ignored in the drawer (`onEscapeKeyDown` prevented)            | 1 red (Escape closes and returns focus)                             |
| drawer `modal={false}` only                                           | green: equivalent (Radix `FocusScope` still loops Tab inside)       |
| drawer `modal={false}` and Tab keydown stopped before the focus scope | 1 red (Tab and Shift+Tab never leave the drawer)                    |
| second `<Toaster />` in the root layout                               | 4 red (both region counts, single toast, other panel)               |
| loading guard removed from `button.tsx`                               | 1 red (loading Button ignores click and Enter)                      |
| `tabIndex={-1}` removed from `#main-content`                          | 2 red (skip link at 375 and 1280)                                   |
| inline script that adds a `dark` class added to the root layout       | 1 red (server HTML has no theme script or class)                    |
| hamburger `aria-label` changed to "Menu"                              | 5 red (drawer tests)                                                |

## E2E: stable "all 18 layout iframes load" check (FND-T-60)

`loadAllDesignFrames` (`tests/e2e/helpers/design-page.ts`) is used by the two
`/design` axe tests (1280 and 375 px, light and dark OS mode).

Root cause of the flakiness (reproduced: 8 of 40 runs failed with 4 to 8
workers): the 18 iframes on `/design` are `loading="lazy"`, and the old helper
only set `frame.loading = "eager"` from the test. In Chromium that does not
reliably start the deferred navigations: some frames stayed on their initial
`about:blank` document (`readyState` "complete", 0 children) for 13 s or more
while the others loaded, so the 5 s poll expired. It is not a page defect (lazy
loading is intended for real users) and not related to the second server.

Fix: the helper re-assigns each frame's `src` (a real navigation), then polls
for up to 20 s until every frame has `readyState` "complete", the expected
path, a `Design: ... frame` document title (so a 404 page does not count) and
content. On failure the message lists the `src` and the real URL of each frame
that did not load. No retries were added.

Mutation record (applied temporarily, restored with
`git checkout src/app/design/_lib/frames.ts`, never committed): `frameHref`
returned `/design/frames/missing` for the `loading` frame.

| Mutation                                        | Result                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| One frame slug points to a 404 route            | Both `all 18 frames loaded` tests red, naming the 6 `/design/frames/missing?theme=...` frames that did not load |
| Same mutation with the first version of the fix | Survived (a 404 page has a body and its own path); this is why the title landmark was added                     |

## E2E: platform hardening harness (epic 002, PH-FR-23, PH-FR-24)

Everything in this section is for `pnpm test:e2e` (no Docker, no database).

### Run one file and read its server log

```bash
pnpm exec playwright install chromium            # once per machine
pnpm test:e2e tests/e2e/error-pages.spec.ts      # builds, starts the servers, runs one file
cat tests/.logs/server-3100.log                  # the main server's log of that run
```

Playwright runs `pnpm build` and then starts every server with
`node scripts/e2e-server.mts <port>` (a production build and `next start`, never
the dev server). Do not run two E2E runs at the same time: they share the
ports below (and `.next/`, `tests/.logs/`), and a server already on a port is
never reused, so the second run fails or tests the wrong build. Stop a stray
`next start` before running again.

### Server wrapper and log tee

`scripts/e2e-server.mts <port>` spawns `next start --port <port>` through Node,
copies the child's stdout and stderr to the console (Playwright and the CI log
still show them) and to `tests/.logs/server-<port>.log`. The file is truncated
when the server starts (a log never mixes two runs), the folder is git-ignored,
and the wrapper exits with the child's exit code. The log holds Next's own lines
and the app logger's JSON lines.

Read it from a spec with `tests/e2e/helpers/server-log.ts` (every function
re-reads the file, so use it inside `expect.poll`; the port defaults to the main
server):

- `findLogEntries({ digest })`: parsed JSON entries whose fields equal every given value.
- `readLogEntries(port?)`, `readLogLines(port?)`: all entries or all raw lines.
- `findLogLinesContaining(text, port?)`: raw lines, to prove a token never reached the log.
- `MAIN_PORT`, `FLAG_OFF_PORT`, `BASE_PORT`: the port constants.

```ts
await expect
  .poll(async () => (await findLogEntries({ digest })).length)
  .toBe(1);
```

Rule: servers are shared by parallel tests and the log is cumulative, so a test
finds its entries by a value unique to it (the error digest, the per-test
`token` query parameter, a `request_id` it sent in `x-request-id`), never by
counting entries in the whole log and never by "the last line".

### Port layout

All ports derive from `E2E_PORT` (default 3100; `tests/e2e/helpers/server-log.ts`
and `telemetry.ts` use the same offsets as `playwright.config.ts`):

| Offset | Port (default) | What                                                                                                  |
| ------ | -------------- | ----------------------------------------------------------------------------------------------------- |
| +0     | 3100           | main server, `DESIGN_PAGE_ENABLED=true` (project `chromium`)                                          |
| +1     | 3101           | same build, flag unset (project `design-gate-off`, the Vercel production state)                       |
| +2     | 3102           | telemetry on: exports to the OTLP receiver (`e2e-telemetry-on`)                                       |
| +3     | 3103           | telemetry to a closed port (`e2e-telemetry-closed`)                                                   |
| +5     | 3105           | spare port: `telemetry-config-startup.spec.ts` spawns its own `next start` there (bad variable)       |
| +10    | 3110           | OTLP receiver (plain Node `http`, `http/json`), started by `tests/e2e/global-setup.ts` before servers |
| +11    | 3111           | nothing listens: the closed-port destination of the +3 server                                         |

The four servers start from one build (the first command builds; the others
reuse it). Database variables and any `OTEL_*` variable of your shell are
removed from every server; only the telemetry servers get `OTEL_*` values
(batch delays of 100 ms so exports happen inside the test window). The
telemetry servers also set `DESIGN_PAGE_ENABLED=true`. The Docker collector is
never used by any test or CI job: the receiver replaces it.

### Fault-injection seams (PH-FR-23, spec decision C4)

Both seams ship in the production build and are inert unless
`DESIGN_PAGE_ENABLED` is on (the flag-off server proves it, PH-AC-76; the unit
test is `src/lib/fault-injection.test.ts`). They never touch the database.

- Fixtures under `/design/errors/*` (`src/app/design/errors/`): `page-throw`
  (page whose render throws, message carries `?token=`), `route-throw` (route
  handler that throws), `retry` (fails the first request per token, then
  renders), `not-found-page` (`notFound()`, an expected 404), `form` (a real
  page posting to real Server Actions: throwing, wrapped, redirect and
  oversized-body). With the flag off they all answer 404.
- Root layout failure: `src/app/layout.tsx` calls `assertFaultInjection()`
  (`src/lib/fault-injection.ts`), which throws only when the flag is on and the
  request carries the header `x-fault: root-layout`. This is the only way to
  reach `global-error`. Tests add the header for one navigation, for example
  `page.route` with `route.continue({ headers: { ...route.request().headers(), "x-fault": "root-layout" } })`
  for the one document path, removed after `page.goto` (helper
  `navigateWithRootLayoutFault` in `error-pages.spec.ts`).

Give every fault request a unique token (`randomUUID()` in the query string):
the error digest then differs per test and per attempt, which makes log lookups
exact. Exception: the digest of the body-limit error is the same for every
oversized post (it hashes the message), so only ONE test in the whole suite may
send an oversized body (`server-action-limits.spec.ts`). Do not add a second.

### CSP-violation base fixture

Every spec imports `test`/`expect` from `tests/e2e/helpers/fixtures.ts` (not
from `@playwright/test`; `telemetry-config-startup.spec.ts` is the exception,
it uses no page). The fixture is automatic: it records `securitypolicyviolation`
events and Chromium's console errors about the Content Security Policy, and
fails the test if any was seen (PH-AC-78). A test that provokes violations on
purpose opts out and may read what was seen:

```ts
test.use({ allowCspViolations: true }); // file or describe level
test("...", async ({ page, cspViolations }) => {
  /* ... */
});
```

Use it only for tests that attack the policy or the framing rules (the negative
tests in `security-headers-csp.spec.ts`).

### Where the other tests of the epic live

| Level                       | Location                                                           | Runs in         |
| --------------------------- | ------------------------------------------------------------------ | --------------- |
| Unit                        | `src/**/*.test.ts(x)`                                              | `pnpm test`     |
| Lint rule tests             | `tests/lint/` (`no-console`, boundaries, with `fixtures/`)         | `pnpm test`     |
| Script tests                | `tests/scripts/` (`gen:module`)                                    | `pnpm test`     |
| DB                          | `tests/db/`                                                        | `pnpm test:db`  |
| E2E on a production build   | `tests/e2e/`                                                       | `pnpm test:e2e` |
| Process test (bad variable) | `tests/e2e/telemetry-config-startup.spec.ts` (own server, port +5) | `pnpm test:e2e` |

Level per PH-AC (spec section 8, "Test level per criterion"):

- Unit: 11, 12, 13, 16, 17, 18, 23 (schema), 27-30 (policy and config parts), 39, 40, 44-47, 49-53, 59, 60 (hook call), 64, 70, 71, 72, 73, 74, 75, 76 (gate), 79 (policy and config).
- `test:db`: 14, 15, 34, 35, 37, 38, 41, 42, 43, 63, 68, 69.
- E2E on the production build: 01-06, 08, 09, 10, 20-22, 27-29, 31, 32, 58, 60 (`notFound()` page), 61, 62, 64 (E2E half), 65, 66, 67, 70, 76 (flag-off server), 77, 78 (fixture), 79 (headers and framing).
- Process test: 23 (bad variable). Lint test: 19.
- CI gates: 25, 36, 54. Review: 33, 56.
- Manual checks (not automated, listed in the epic acceptance checklist): PH-AC-24
  and 26 (start and stop of the Docker collector), 55 (each PH-HR is covered
  or listed), 57 (the product-manager compares the final diff with the
  out-of-scope list).

If the spec and this list ever differ, the spec wins; update this section.

## Lint boundary tests (`tests/lint`, FND-FR-12, FND-FR-20)

`tests/lint/boundaries.test.ts` runs in `pnpm test` (no Docker). It runs ESLint
programmatically with the repository's real `eslint.config.mjs` and asserts the
rule ids reported, for every boundary rule (a) to (f) in
`docs/architecture.md`, "Lint rules": one illegal import is reported and one
legal import passes.

- Rules (a), (b), (c), (d), (f) use `eslint.lintText(code, { filePath })` with
  inline source and a virtual `filePath`; the path only selects the config zone
  (for example `src/lib/x.ts` versus `src/app/x.ts`). Fast, and no file has to
  exist.
- Rule (e), `import/no-cycle`, cannot work on virtual files (it resolves real
  modules), so it is switched off for the inline tests and proven on real
  fixtures: `tests/lint/fixtures/cycle/{a,b}.ts` import each other and must be
  reported, `tests/lint/fixtures/acyclic/{a,b}.ts` must pass. The fixtures are in
  the ESLint `globalIgnores`, so `pnpm lint` and the build skip them; the test
  lints them with `ignore: false`.
- To add a rule: add an `it.each` row with an illegal and a legal case, and keep
  the zone-specific virtual path. Removing a rule from the config makes its test
  fail, because the test asserts the specific rule id.
- Run only this file: `pnpm test tests/lint`.

## Gate failure proofs (FND-FR-26)

Executed on GitHub Actions on 2026-11-13 (UTC, run timestamps) against
`hgonza81/nextjs-starter`, branch `main`, with the Product Owner's
authorization. Each case was one throwaway commit that broke exactly one gate
(checked locally beforehand: only that gate failed), pushed on its own, observed
on the real runner, then reverted. Run results were re-read with
`gh run view <id> --json conclusion,jobs`.

| #   | Case                                                                                            | Throwaway commit | Run           | Red job and step                                                                   | Deploy              | Revert                                |
| --- | ----------------------------------------------------------------------------------------------- | ---------------- | ------------- | ---------------------------------------------------------------------------------- | ------------------- | ------------------------------------- |
| 1   | Lint error: `src/lib/gate-proof-lint.ts` imports `@/db/client`, violating the boundary rule     | `d11b7af`        | `43363308177` | Fast checks, step "Run pnpm lint"                                                  | skipped             | `78bdd22`                             |
| 2   | Type error: `const x: number = "..."`                                                           | `2afa791`        | `43363938024` | Fast checks, step "Run pnpm typecheck" (and Database and E2E, see below)           | skipped             | `c9f4bcb`                             |
| 3   | Failing test: `expect(1 + 1).toBe(3)`                                                           | `fd83c0d`        | `43364322005` | Fast checks, step "Run pnpm test"                                                  | skipped             | `59f78e7`                             |
| 4   | Dummy secret: a recognizable FAKE `ghp_` token in `src/lib/gate-proof-secret.ts`                | `556f8be`        | `43364785782` | Secret scan, step "Scan the full git history" (rule `github-pat`, 1 leak)          | skipped             | `5e1565b` (plus `aeb6799`, see below) |
| 5   | Failing hello-world: expected health body in `ci.yml` changed to `{"status":"ok","proof":true}` | `88f79bb`        | `43365201080` | Deploy to Vercel, step "Post-deploy health check" (all three blocking gates green) | job red (see below) | `27ad4b2`                             |

Final state: run `43365790603` (on `27ad4b2`) is green for Fast checks,
Secret scan, Database and E2E and Deploy to Vercel.

Notes per case:

- **Case 2, extra red job.** Database and E2E was also red (step "Run
  pnpm test:e2e"). This is expected, not a second defect: the Playwright web
  server runs `next build`, which type-checks, and the build failed with
  `src/lib/gate-proof-types.ts:2:14 - error TS2322: Type 'string' is not
assignable to type 'number'`. Fast checks failed on the same error at "Run pnpm
  typecheck". In case 1 (lint) the build does not lint, so Database and E2E stayed
  green.
- **Case 4, the token stays in history.** Secret scan scans the full git
  history, so the fake token remains detectable after the revert commit. Commit
  `aeb6799` added a regex allowlist for that exact string to `.gitleaks.toml`
  (checked locally: the history passes, and a different token is still
  detected). The rotation rule applies to real secrets: removing a pushed secret
  is not enough, rotate it.
- **Case 5, honest limit.** The post-deploy check runs after `vercel deploy
--prod`, so the deploy had already happened (same app, nothing broken) when
  the check failed. The proof shows that a wrong health body turns the Deploy
  job and the run red; it does not roll anything back (accepted judgment J2
  from T-25).
- **Dependency audit (informational)** is red in every run (3 known advisories)
  and never blocks the deploy, by design.
- In cases 1 to 4 the Deploy job was skipped because a needed blocking job
  failed, which proves that a red blocking job prevents the deploy.

Lesson: the secret-scan proof leaves a permanent fake token in git history and
a permanent allowlist entry in `.gitleaks.toml`. Repeat it only if that cost is
acceptable.

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
