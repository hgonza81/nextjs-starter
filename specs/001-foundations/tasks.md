# 001 - Foundations: tasks

**Status:** Draft (awaiting Product Owner review of the task list)
**Spec:** [spec.md](spec.md) (approved 2026-11-12). IDs: `FND-T-NN`; requirements `FND-FR-NN` / `FND-NFR-NN`.
**Execution rules** (from `specs/README.md`): every task is run by a NEW agent with a fresh context, sequentially by default, hand-off through files only. The orchestrator updates the Status column after each task. A task that fails verification is not reopened in place: the orchestrator adds a fix task (next free ID) for a new developer agent and re-runs the verification.

## 0. Notes before starting

- **Common read-first for every task** (all paths under `/Users/hernangonzalezbuteler/dev/nextjs-starter/`): `AGENTS.md` (English only, structure rule, no scope beyond the spec), `specs/001-foundations/spec.md` (sections named in the task), `docs/architecture.md`, `docs/adr/README.md`. Tasks list only what is **additional**.
- **Common rules for every task:** all files in English; do not add anything the spec does not state (out of scope list is spec section 3); single branch, **exactly one local commit per completed task** (plain descriptive message, Conventional Commits suggested, e.g. `feat(db): ...`; commit only after lint, typecheck and the existing tests pass; include the task ID in the commit body, e.g. `Task: FND-T-12`) and **never `git push`** (pushing is done only by the orchestrator when the PO asks); `pnpm lint`, `pnpm typecheck` and the tests that exist at that point must pass before finishing; do not edit `tasks.md` status (the orchestrator does); record in the final reply what was done, files changed, commands run and anything left open.
- **Deviation from spec order (recorded):** spec section 12 puts `/api/health/db` in step 2, but FND-FR-11 requires it to use `withRls`, which is built in step 3. So step 2 delivers `/api/health` only, and `/api/health/db` arrives in FND-T-12. Likewise the Vitest tooling (spec step 4) is set up before the `withRls` integration tests (spec step 3) because those tests need it; the tests are therefore in Step 4 below. The delivery order is otherwise unchanged.
- **Cross-check ADRs vs spec (done while writing these tasks):** no real conflict with the PO decisions (Data API disabled, `postgres` driver, Drizzle-inferred types and no `supabase gen types`, SQL-first migrations + `drizzle-kit pull` + drift check, role `app_backend`, env rules, Vercel auto-deploy off). Small mismatches fixed in spec.md (see its change log). One small real tension resolved by an allowlist: `/api/health/db` (in `app`) must call `withRls` from `@/db`, while FND-FR-12(c) forbids `app` importing `@/db`. Handled in FND-T-37.
- **Items for the architect/developer to settle inside tasks (no PO decision needed):** how `/design` is enabled in dev/CI/E2E yet 404 in the Vercel production build (FND-T-32; suggestion: a server-side flag in `env.ts`, on locally and in CI, absent on Vercel); the exact lint tooling (ADR 0001 lets the developer choose); `pnpm db:schema` behavior for roles/policies (FND-T-10, FND-T-18); no thin Supabase client factories are created in 001 (no consumer; the Supabase public variables are still declared in `env.ts` and `.env.example` per ADR 0004).
- **Parallelism:** default is sequential. Tasks marked **Independent** may run in parallel with the tasks named. Everything else waits for its dependencies.
- **Pending PO push:** tasks FND-T-45 to FND-T-48 can only start after the PO creates the GitHub repository, pushes, and sets up Vercel and the three `VERCEL_*` secrets (spec section 14). The epic is "done pending PO push" until they pass.

## 1. Status table

| ID | Title | Assignee | Step | Depends on | Status |
|----|-------|----------|------|------------|--------|
| FND-T-01 | git init and `.gitignore` | developer | 1 | none | todo |
| FND-T-02 | Next.js skeleton and toolchain | developer | 1 | T-01 | todo |
| FND-T-03 | Typed environment configuration | developer | 1 | T-02 | todo |
| FND-T-04 | Verify step 1 | tester | 1 | T-03 | todo |
| FND-T-05 | Accept step 1 | product-manager | 1 | T-04 | todo |
| FND-T-06 | Local Supabase, scripts, Data API off | developer | 2 | T-03 | todo |
| FND-T-07 | `/api/health` liveness | developer | 2 | T-03 | todo |
| FND-T-08 | Verify step 2 | tester | 2 | T-06, T-07 | todo |
| FND-T-09 | Accept step 2 | product-manager | 2 | T-08 | todo |
| FND-T-10 | Drizzle stack, schema entry, `db:schema` | developer | 3 | T-06 | todo |
| FND-T-11 | `app_backend` role migration | developer | 3 | T-10 | todo |
| FND-T-12 | `withRls`, `VerifiedContext`, `/api/health/db` | developer | 3 | T-11 | todo |
| FND-T-13 | Vitest tooling, unit layer, env unit test | tester | 4 | T-12 | todo |
| FND-T-14 | DB test harness | tester | 4 | T-13 | todo |
| FND-T-15 | `withRls` integration tests, part A | tester | 4 | T-14 | todo |
| FND-T-16 | `withRls` integration tests, part B, and schema guard | tester | 4 | T-15 | todo |
| FND-T-17 | Playwright tooling and E2E home test with axe | tester | 4 | T-13 | todo |
| FND-T-18 | Architect review of the data stack and ADR confirmation | architect | 4 | T-16 | todo |
| FND-T-19 | Independent verification of steps 3-4 | tester | 4 | T-16, T-17, T-18 | todo |
| FND-T-20 | Accept steps 3-4 | product-manager | 4 | T-19 | todo |
| FND-T-21 | CI workflow: fast group and Docker group | developer | 5 | T-17, T-20 | todo |
| FND-T-22 | CI security jobs and Dependabot | developer | 5 | T-21 | todo |
| FND-T-23 | Verify CI workflow locally | tester | 5 | T-22 | todo |
| FND-T-24 | Deploy job and hello-world smoke test | developer | 6 | T-22 | todo |
| FND-T-25 | Verify deploy workflow locally | tester | 6 | T-24 | todo |
| FND-T-26 | Architect review of CI/CD | architect | 6 | T-25 | todo |
| FND-T-27 | Accept steps 5-6 (local part) | product-manager | 6 | T-26 | todo |
| FND-T-28 | Design system document | ui-ux-designer | 7 | T-02 | todo (Independent of T-03..T-27) |
| FND-T-29 | Tailwind, shadcn, tokens, fonts, toast provider | developer | 7 | T-28, T-27 | todo |
| FND-T-30 | Base components | developer | 7 | T-29 | todo |
| FND-T-31 | Auth layout, app shell, styled home page | developer | 7 | T-30 | todo |
| FND-T-32 | `/design` showcase and production gating | developer | 7 | T-31 | todo |
| FND-T-33 | Design system E2E and a11y tests | tester | 7 | T-32 | todo |
| FND-T-34 | Design review | ui-ux-designer | 7 | T-33 | todo |
| FND-T-35 | Accept step 7 | product-manager | 7 | T-34 | todo |
| FND-T-36 | Conventions in `docs/architecture.md` | architect | 8 | T-02 | todo (Independent of T-03..T-35) |
| FND-T-37 | Boundary lint rules | developer | 8 | T-36, T-35 | todo |
| FND-T-38 | Boundary rule tests (fixtures) | tester | 8 | T-37 | todo |
| FND-T-39 | Accept step 8 | product-manager | 8 | T-38 | todo |
| FND-T-40 | Test README | tester | 9 | T-39 | todo |
| FND-T-41 | Project README | developer | 9 | T-39 | todo (Independent of T-40) |
| FND-T-42 | Onboarding dry run | tester | 9 | T-40, T-41 | todo |
| FND-T-43 | Final architect check: ADRs, architecture, conventions | architect | 9 | T-42 | todo |
| FND-T-44 | Final acceptance, local part (DoD 1-8, 10) | product-manager | 9 | T-43 | todo |
| FND-T-45 | First CI run is green (pending PO push) | tester | 9 | T-44, PO push | todo |
| FND-T-46 | Vercel deploy and post-deploy smoke test (pending PO push) | tester | 9 | T-45, PO Vercel setup | todo |
| FND-T-47 | Gates fail on bad input (pending PO push) | tester | 9 | T-46 | todo |
| FND-T-48 | Final acceptance, DoD 9 (pending PO push) | product-manager | 9 | T-47 | todo |

Count by assignee: developer 17, tester 17, product-manager 8, architect 4, ui-ux-designer 2. Total 48.

---

## 2. Step 1: skeleton and toolchain

### FND-T-01 git init and `.gitignore`
- **Assignee:** developer
- **Goal:** the project is a local git repository with a good `.gitignore` and one initial commit. Do NOT create a GitHub repository, add a remote or push (PO action).
- **Requirements:** FND-FR-04.
- **Read first:** spec sections 8.1, 14, 17 (item 1).
- **Do:** `git init` with default branch `main` (the PO may rename later); `.gitignore` covering `node_modules`, `.next`, `.env*` except `.env.example`, `.vercel`, Playwright/Vitest output (`test-results`, `playwright-report`, `coverage`), OS/editor files, Supabase local temp (`supabase/.temp`, `supabase/.branches`). Commit existing files (specs, docs, `.claude`, AGENTS.md, CLAUDE.md).
- **Acceptance:** `git status` clean after commit; a file named `.env.local` and `.env` is ignored while `.env.example` is not (`git check-ignore -v`); no remote configured.
- **Out of scope:** hooks, Husky, commitlint, remote, branches.
- **Output:** `.gitignore`, git history. Commit scope `chore(repo)`.
- **Dependencies:** none.

### FND-T-02 Next.js skeleton and toolchain
- **Assignee:** developer
- **Goal:** a pinned, reproducible Next.js app with a plain home page.
- **Requirements:** FND-FR-01, FND-FR-02, FND-NFR-06.
- **Read first:** spec 8.1, decisions D8, D9; ADR 0001 (layout); verify current stable versions against official docs when pinning.
- **Do:** Next.js (current stable, App Router) in `src/` with `@/` alias; `tsconfig` strict plus `noUncheckedIndexedAccess`; pnpm with `packageManager` field and committed lockfile; active-LTS Node pinned in `.nvmrc` and `engines` (with `engine-strict` so another major is reported); ESLint (flat config, `next` rules) and Prettier; scripts `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`; install Zod, React Hook Form and `@hookform/resolvers`. Home page `/` renders a single known heading (e.g. the project name) with no styling work. Create `src/lib/` and `src/db/` folders only when they get content (no empty folders).
- **Acceptance:** `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build` exit 0; `pnpm dev` renders `/`; installing under a different Node major is reported; no route or code for auth, users, tenants, billing.
- **Out of scope:** Tailwind/shadcn (T-29), env module (T-03), tests (T-13), Supabase/Drizzle (T-06, T-10).
- **Output:** app skeleton, config files. Commit scope `chore(app)`.
- **Dependencies:** FND-T-01.

### FND-T-03 Typed environment configuration
- **Assignee:** developer
- **Goal:** one validated place for environment access and a committed `.env.example`.
- **Requirements:** FND-FR-03, FND-NFR-05.
- **Read first:** spec 8.1 (FR-03), 11; ADR 0004 (all); ADR 0003 (connections section).
- **Do:** `src/lib/env.ts` with Zod server schema and public schema; sole reader of `process.env`; `server-only` for the server object. Variables: `DATABASE_URL`, `DATABASE_MIGRATION_URL` (required in development/test, optional in production, runtime failure in the DB module when needed and missing), public Supabase URL and anon key, public app URL. Fails fast naming the variable. No `SUPABASE_SERVICE_ROLE_KEY`. `NEXT_PUBLIC_` names may not match `SERVICE|SECRET|PASSWORD|DATABASE` (enforcement test is in T-13). `.env.example` with placeholders and local Supabase defaults labelled "local only, not secrets". Pin the local connection format `postgresql://app_backend:<local password>@127.0.0.1:54322/postgres` (role created in T-11; use the same non-secret local password documented there).
- **Acceptance:** with a required dev variable missing, `pnpm dev`/start fails with a message naming it; a production build without DB variables succeeds; `.env.example` lists every variable and contains no real secret; server-only variables are not imported by any client code.
- **Out of scope:** Supabase client factories (no consumer in 001), DB connection (T-10), unit tests (T-13).
- **Output:** `src/lib/env.ts`, `.env.example`. Commit scope `feat(env)`.
- **Dependencies:** FND-T-02.

### FND-T-04 Verify step 1
- **Assignee:** tester
- **Goal:** independently verify FND-T-01 to FND-T-03 against the spec.
- **Requirements:** FND-FR-01, 02, 03, 04, FND-NFR-06.
- **Read first:** spec 8.1, 11; the code and configs produced.
- **Do:** from a fresh local copy (`git clone` of the working tree into a new temp folder): run each acceptance check of T-01..T-03 including the env fail-fast and "production build without DB variables" cases, `git check-ignore`, and the Node-major check. Write findings (pass/fail with evidence) in the reply; do not fix code.
- **Acceptance:** every check passes or each failure is listed with evidence and reproduction.
- **Out of scope:** writing automated tests (T-13).
- **Output:** verification report in the reply (orchestrator may store it under `specs/001-foundations/verification/`).
- **Dependencies:** FND-T-03.

### FND-T-05 Accept step 1
- **Assignee:** product-manager
- **Goal:** accept step 1 against the acceptance criteria.
- **Requirements:** FND-FR-01 to 04.
- **Read first:** spec 8.1, 13; T-04 report; the diff of T-01..T-03.
- **Do:** check each criterion against evidence; check nothing extra was added (scope gate); report met / partial / not met.
- **Acceptance:** all FR-01..04 criteria met, or gaps listed for fix tasks.
- **Output:** acceptance note in the reply.
- **Dependencies:** FND-T-04.

---

## 3. Step 2: local Supabase and liveness

### FND-T-06 Local Supabase, scripts, Data API off
- **Assignee:** developer
- **Goal:** local Supabase runs through the CLI and Docker with documented scripts.
- **Requirements:** FND-FR-05, FND-NFR-06.
- **Read first:** spec 8.2 (FR-05), 10; ADR 0002; ADR 0003 ("Data API disabled", "Roles" for PG major note); official Supabase CLI config docs for the pinned CLI version.
- **Do:** Supabase CLI as pinned devDependency; `supabase/config.toml` with `[api] enabled = false` and Postgres major version noted; empty `supabase/migrations/`; `supabase/seed.sql` placeholder; scripts `db:start`, `db:stop`, `db:reset`, `db:status` (or equivalent). Confirm Auth (GoTrue) still starts with the Data API off; if the stack does not start or Studio breaks, report it instead of re-enabling the API silently.
- **Acceptance:** with Docker running, `pnpm db:start` then `pnpm db:reset` exit 0; the API port exposes no table access; `pnpm db:stop` stops the stack. With Docker stopped the scripts fail with a clear message.
- **Out of scope:** any table, role (T-11), Drizzle (T-10), README (T-41).
- **Output:** `supabase/`, package scripts. Commit scope `feat(db)`.
- **Dependencies:** FND-T-03.

### FND-T-07 `/api/health` liveness
- **Assignee:** developer
- **Goal:** a liveness endpoint that never touches the database.
- **Requirements:** FND-FR-11 (liveness part).
- **Read first:** spec 8.2 (FR-11), 4 (glossary: Liveness health, Hello-world test).
- **Do:** Route Handler `GET /api/health` returning 200 and a known JSON body (e.g. `{ "status": "ok" }`); no import of DB or env DB variables. Do not add `/api/health/db` here.
- **Acceptance:** `GET /api/health` returns 200 and the known body with Supabase stopped and with DB variables unset.
- **Out of scope:** `/api/health/db` (T-12), tests (T-13/T-17).
- **Output:** `src/app/api/health/route.ts`. Commit scope `feat(health)`.
- **Dependencies:** FND-T-03. **Independent** of FND-T-06.

### FND-T-08 Verify step 2
- **Assignee:** tester
- **Goal:** independently verify T-06 and T-07.
- **Requirements:** FND-FR-05, FND-FR-11 (liveness), FND-NFR-06.
- **Read first:** spec 8.2, 11 (Docker not running; local DB down).
- **Do:** run the acceptance checks incl. Docker stopped behavior, `db:reset` from scratch twice, `GET /api/health` with Supabase stopped, and confirm the Data API exposes nothing (e.g. request to the REST URL fails or returns no tables).
- **Acceptance:** every check passes or failures are reported with evidence.
- **Output:** verification report in the reply.
- **Dependencies:** FND-T-06, FND-T-07.

### FND-T-09 Accept step 2
- **Assignee:** product-manager
- **Goal:** accept step 2.
- **Requirements:** FND-FR-05, FND-FR-11 (liveness).
- **Read first:** spec 8.2; T-08 report.
- **Acceptance:** criteria met with evidence, no extra scope, or gaps listed.
- **Output:** acceptance note in the reply.
- **Dependencies:** FND-T-08.

---

## 4. Step 3: Drizzle stack, role and `withRls`

### FND-T-10 Drizzle stack, schema entry point, `db:schema`
- **Assignee:** developer
- **Goal:** the database access stack is installed and the one migration workflow runs.
- **Requirements:** FND-FR-06, FND-FR-07.
- **Read first:** spec 7, 8.2 (FR-06, FR-07); ADR 0001 (layout, shared schema), ADR 0002 (all), ADR 0003 (connections, driver); current Drizzle and drizzle-kit docs for the pinned versions.
- **Do:** install `drizzle-orm`, `drizzle-kit`, `postgres` (postgres-js), `supabase-js`, `@supabase/ssr`; `drizzle.config.ts` using `DATABASE_MIGRATION_URL`, `schemaFilter: ['public']`, output `src/db/schema/`, NOT pointing at `supabase/migrations`; script `db:schema` (= `drizzle-kit pull` and whatever is needed to keep output stable and marked "generated, do not edit"); `src/db/client.ts` (private, `postgres` with `prepare: false`, small pool, created once at module scope, URL from validated env, fails at runtime if DB variable missing), `src/db/index.ts` (no raw client export), empty schema entry. Do not use `drizzle-kit generate/migrate/push`. Record what `pull` does with roles/policies/empty schema in the reply.
- **Acceptance:** `pnpm typecheck` passes importing `@/db`; after `db:reset`, `pnpm db:schema` produces a stable result and a second run gives an empty `git diff`; `src/db/schema/` has no table definitions; `public` has no tables.
- **Out of scope:** `withRls` (T-12), role migration (T-11), supabase-js client factories, any app table, `supabase gen types`.
- **Output:** config, `src/db/*`, scripts. Commit scope `feat(db)`.
- **Dependencies:** FND-T-06.

### FND-T-11 `app_backend` role migration
- **Assignee:** developer
- **Goal:** the fail-closed login role exists after `db:reset`.
- **Requirements:** FND-FR-08, FND-NFR-02.
- **Read first:** spec 8.2 (FR-08), 7; ADR 0003 ("Roles (migration in 001)", Postgres 16 note), ADR 0005; `supabase/config.toml` Postgres major.
- **Do:** one SQL migration in `supabase/migrations/` creating `app_backend` (LOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT, owns nothing), granting membership in `authenticated` and `anon` so it can `SET ROLE` (use `WITH INHERIT FALSE, SET TRUE` if the Postgres major supports it), and `ALTER DEFAULT PRIVILEGES` so new `public` tables are not auto-granted to `anon`/`authenticated`/`app_backend` (explicit grants per table come in 002). The password is set outside migrations: local non-secret value in `seed.sql` (or a documented local setup script run by `db:reset`); same value in `.env.example` (T-03). Confirm `db:schema` still yields an empty diff.
- **Acceptance:** after `pnpm db:reset`: `pg_roles` shows `app_backend` with `rolsuper = false`, `rolbypassrls = false`; it owns no `public` object; it can log in with the local password; no password literal appears in migrations.
- **Out of scope:** tests (T-15, T-16), policies, tables.
- **Output:** `supabase/migrations/<timestamp>_app_backend_role.sql`, `seed.sql`. Commit scope `feat(db)`.
- **Dependencies:** FND-T-10.

### FND-T-12 `withRls`, `VerifiedContext`, `/api/health/db`
- **Assignee:** developer
- **Goal:** the single centralized RLS function and the DB health endpoint.
- **Requirements:** FND-FR-09, FND-FR-11, FND-NFR-02.
- **Read first:** spec 4 (glossary), 8.2 (FR-09, FR-11), 11; ADR 0003 ("Single entry point", "Exports", "Verified claims only", test list); T-10/T-11 code.
- **Do:** `src/db/rls.ts`: `VerifiedContext` type (userId, claims, optional tenantId; JSDoc that claims must come from a verified session) and `withRls(ctx, fn)`: open transaction, `set_config('request.jwt.claims', ..., true)` and `request.jwt.claim.sub`, optional `app.current_tenant`, then `set local role` to a hard-coded `authenticated` (separate explicit anonymous variant uses `anon` and needs no user id); throws on missing/empty user id for the authenticated variant; never falls back to another role. Export `withRls`, schema and types from `src/db/index.ts`; raw client stays private. Route `GET /api/health/db` runs `select current_user` through `withRls` (anonymous variant), returns 200 and a known body when reachable and a non-200 without connection details when not.
- **Acceptance:** `/api/health/db` is 200 with local Supabase running and non-200 (no connection string in body or logs) when stopped, while `/api/health` stays 200; `withRls` rejects an empty user id; typecheck passes.
- **Out of scope:** real JWT verification and tenant membership check (epic 002), integration tests (T-15/T-16), lint rules (T-37).
- **Output:** `src/db/rls.ts`, `src/db/index.ts`, `src/app/api/health/db/route.ts`. Commit scope `feat(db)`.
- **Dependencies:** FND-T-11.

---

## 5. Step 4: test tooling, harness, `withRls` tests

### FND-T-13 Vitest tooling, unit layer, env unit test
- **Assignee:** tester
- **Goal:** `pnpm test` and `pnpm test:db` exist; the unit layer has real tests.
- **Requirements:** FND-FR-19, FND-FR-20 (unit), FND-FR-03, FND-NFR-05.
- **Read first:** spec 8.5, decisions D10; ADR 0003 (test list, pool size 1); `src/lib/env.ts`.
- **Do:** Vitest with two projects: unit (colocated `*.test.ts`, no Docker) and db (`tests/db/`, real local Supabase, connects as `app_backend` via the runtime URL, pool size 1 where needed); scripts `test`, `test:db`, `test:coverage` (report only, no threshold); `tests/utils/` created. Unit tests: env validation (missing variable names it, DB variables optional in production, public schema rejects `NEXT_PUBLIC_` names matching `SERVICE|SECRET|PASSWORD|DATABASE`, server-only values absent from the public object); `withRls` rejects empty user id (unit level, no DB). Add a build/bundle assertion or test that no server-only variable name appears in the client bundle if feasible without scope creep.
- **Acceptance:** `pnpm test` passes with Docker stopped; tests assert behavior; deliberately breaking `env.ts` makes a test fail.
- **Out of scope:** harness (T-14), Playwright (T-17), `withRls` DB tests (T-15/16).
- **Output:** Vitest config, scripts, unit tests. Commit scope `test(unit)`.
- **Dependencies:** FND-T-12.

### FND-T-14 DB test harness
- **Assignee:** tester
- **Goal:** helpers so a new DB test can be written without extra setup.
- **Requirements:** FND-FR-21.
- **Read first:** spec 8.5 (FR-21), 7 (harness row); ADR 0003.
- **Do:** under `tests/utils/`: `asUser(claims)` calling the production `withRls` (no re-implementation); role helpers (anon, authenticated with claims); factory stubs `createTestUser`, `createTenant` (stubs only, 002 completes); helpers to create and drop throwaway tables inside test setup (never in `supabase/migrations/`); unique data per test (parallel-safe); a table-driven allow/deny matrix helper.
- **Acceptance:** one small demo test uses only the helpers; `pnpm test:db` twice in a row passes with no leftover state.
- **Out of scope:** real factories for tenants/users/memberships, FND-FR-10 tests.
- **Output:** `tests/utils/*`, demo test. Commit scope `test(db)`.
- **Dependencies:** FND-T-13.

### FND-T-15 `withRls` integration tests, part A
- **Assignee:** tester
- **Goal:** prove context handling of `withRls`.
- **Requirements:** FND-FR-10 items 1, 2, 3, 5, 7; FND-NFR-02.
- **Read first:** spec 8.2 (FR-10); ADR 0003 (required tests); `src/db/rls.ts`; `tests/utils/`.
- **Do:** tests in `tests/db/` against real Postgres, as `app_backend`, through `withRls`: (1) `current_user = 'authenticated'`, `auth.uid()` equals supplied sub, claims equal supplied; (2) after commit and after rollback the next transaction on the same connection (pool size 1) has the default role and no claims; (3) N parallel calls with different users on a small pool see only their own claims; (5) missing/empty user id refused and no privileged fallback; (7) error in callback rolls back and resets context. Try to break each assertion (e.g. temporarily remove `local`/reset) to confirm the test would fail, and note it.
- **Acceptance:** all five tests pass; mutation attempts make them fail.
- **Out of scope:** items 4, 6, 8, 9 (T-16).
- **Output:** `tests/db/with-rls-context.test.ts` (or similar). Commit scope `test(db)`.
- **Dependencies:** FND-T-14.

### FND-T-16 `withRls` integration tests, part B, and schema guard
- **Assignee:** tester
- **Goal:** prove isolation and fail-closed behavior; add the schema guard.
- **Requirements:** FND-FR-10 items 4, 6, 8, 9; FND-FR-22; FND-FR-08; FND-NFR-02.
- **Read first:** spec 8.2 (FR-08, FR-10), 8.5 (FR-22); ADR 0003 and 0005; `tests/utils/`.
- **Do:** (4) throwaway table with RLS and a membership-based policy (created in test setup): tenant A user cannot select/insert/update/delete tenant B rows; anon and no-membership denied; tampered tenant id rejected by `WITH CHECK`; (6) `app_backend` not superuser, not `BYPASSRLS`, owns no object; (8) query without `withRls` as `app_backend` denied; (9) table without policy returns zero rows through `withRls`. Schema guard: every `public` table has RLS enabled and at least one policy except an explicit allowlist; passes with zero tables; a test of the guard proves it fails on a throwaway table without RLS. All throwaway tables dropped after the test.
- **Acceptance:** tests pass; running `pnpm test:db` twice passes; the guard fails when a policy-less table exists.
- **Out of scope:** real tables and policies (002).
- **Output:** `tests/db/*.test.ts`. Commit scope `test(db)`.
- **Dependencies:** FND-T-15.

### FND-T-17 Playwright tooling and E2E home test with axe
- **Assignee:** tester
- **Goal:** `pnpm test:e2e` runs against a production-like start with one real test.
- **Requirements:** FND-FR-19, FND-FR-20 (E2E), FND-NFR-03 (home page, light and dark).
- **Read first:** spec 8.5, 4 (Hello-world test (a)), 9 (NFR-03, 04); D10.
- **Do:** Playwright + `@axe-core/playwright`, pinned; config using `next build` + `next start` (production-like) via `webServer`, trace on first retry; script `test:e2e`; `tests/e2e/`. Test: home page renders the known heading; axe reports zero violations on `/` in light and dark (`colorScheme` emulation); `GET /api/health` 200 with known body; no horizontal scroll at 375px and 1280px. (`/design` checks come in T-33.)
- **Acceptance:** `pnpm test:e2e` exits 0; removing the heading makes it fail.
- **Out of scope:** `/design`, CI wiring (T-21), DB-dependent E2E beyond what exists.
- **Output:** Playwright config, `tests/e2e/home.spec.ts`. Commit scope `test(e2e)`.
- **Dependencies:** FND-T-13. **Independent** of FND-T-14..T-16 (may run in parallel with them).

### FND-T-18 Architect review of the data stack and ADR confirmation
- **Assignee:** architect
- **Goal:** review `withRls`, the role migration, the tests and the Drizzle workflow against ADRs 0001-0004; confirm or update the ADRs with what was actually found.
- **Requirements:** FND-FR-07, FND-FR-08, FND-FR-09, FND-FR-10; FND-NFR-02.
- **Read first:** spec 8.2, 16 (R1, R2); ADRs 0002, 0003; `src/db/*`, `supabase/migrations/*`, `tests/db/*`, T-10 notes on `drizzle-kit pull` behavior.
- **Do:** manual line-by-line review of `withRls` and grants (not only coverage); record in ADR 0002 what `drizzle-kit pull` does with roles/policies and whether the fallback is needed; check Data API disabled works as ADR 0003 states; edit ADRs minimally (status/consequences/references) and list findings as blockers or notes for fix tasks. Do not rewrite code.
- **Acceptance:** written review in the reply; ADR edits committed; no unresolved blocker, or blockers listed.
- **Out of scope:** new architecture decisions beyond the ADRs; implementation.
- **Output:** ADR updates, review in the reply. Commit scope `docs(adr)`.
- **Dependencies:** FND-T-16.

### FND-T-19 Independent verification of steps 3-4
- **Assignee:** tester
- **Goal:** adversarial verification by a fresh agent.
- **Requirements:** FND-FR-06 to 11, 19 to 22; FND-NFR-02.
- **Read first:** spec 8.2, 8.5, 11, 16 (R1); T-18 review; all code and tests from T-10..T-17.
- **Do:** from a fresh clone: `pnpm install`, `db:reset`, `db:schema` (empty diff), `test`, `test:db` (twice), `test:e2e`, `GET /api/health` and `/api/health/db` with DB up and down. Then sabotage locally (and revert): make `withRls` use a non-local `set_config`, remove `set local role`, connect as `postgres`, add a policy-less table; confirm the right tests fail. Report which sabotage was not caught.
- **Acceptance:** all commands pass; every sabotage is caught or the gap is reported.
- **Out of scope:** fixing code.
- **Output:** verification report in the reply.
- **Dependencies:** FND-T-16, FND-T-17, FND-T-18.

### FND-T-20 Accept steps 3-4
- **Assignee:** product-manager
- **Goal:** accept steps 3 and 4.
- **Requirements:** FND-FR-06 to 11, 19 to 22; FND-NFR-02.
- **Read first:** spec 8.2, 8.5, 13 (items 2-5); T-18 and T-19 reports.
- **Acceptance:** every criterion met with evidence (test names and command output), nothing extra added, architect blockers resolved.
- **Output:** acceptance note in the reply.
- **Dependencies:** FND-T-19.

---

## 6. Step 5: CI

### FND-T-21 CI workflow: fast group and Docker group
- **Assignee:** developer
- **Goal:** a GitHub Actions workflow runs the same commands as local.
- **Requirements:** FND-FR-23, FND-FR-07 (drift check in CI), FND-NFR-06, FND-NFR-07.
- **Read first:** spec 8.6 (FR-23), 9 (NFR-06, 07), 11, 16 (R6); ADR 0002 (drift check, trimmed Supabase services); ADR 0004 (deployment); current docs for GitHub Actions, Supabase CLI action/setup, Playwright caching.
- **Do:** `.github/workflows/ci.yml` triggered on `push` (no `pull_request`), per-ref concurrency with cancel-in-progress; Job 1 (blocking, no Docker): install with pinned pnpm/Node and cache, lint, typecheck, `pnpm test`, build; Job 2 (blocking, Docker): start local Supabase (unneeded services excluded where the pinned CLI supports it), `db:reset`, drift check (`pnpm db:schema` then `git diff --exit-code src/db/schema`), `test:db`, `test:e2e` with Playwright browsers cached; jobs 1 and 2 independent (no `needs` between them); each job labelled blocking/informational in its name or comments; least-privilege `permissions`; pin actions by version. Add a README status badge placeholder line only if README exists (full README in T-41).
- **Acceptance:** file passes `actionlint`; commands are identical to the documented local ones; job 1 does not need Docker; no secrets used.
- **Out of scope:** secret scan, audit, Dependabot (T-22), deploy (T-24), running it on GitHub (PO push).
- **Output:** `.github/workflows/ci.yml`. Commit scope `ci`.
- **Dependencies:** FND-T-17, FND-T-20.

### FND-T-22 CI security jobs and Dependabot
- **Assignee:** developer
- **Goal:** blocking secret scan, informational audit, Dependabot.
- **Requirements:** FND-FR-24, FND-FR-04, FND-NFR-05.
- **Read first:** spec 8.6 (FR-24), 9 (NFR-05); ADR 0004 (secret scanning).
- **Do:** in `ci.yml` (or a separate workflow, same trigger): secret-scan job with the Gitleaks binary, `fetch-depth: 0`, blocking; audit job `pnpm audit` with `continue-on-error: true` and visible output, informational; `.github/dependabot.yml` (npm and github-actions ecosystems, weekly). Run Gitleaks locally on the tree and history to confirm it passes (install locally if needed; do not commit binaries).
- **Acceptance:** `actionlint` passes; local Gitleaks run is clean; Dependabot file valid; jobs labelled blocking/informational.
- **Out of scope:** CodeQL, ZAP, license scanning, README secret note (T-41).
- **Output:** workflow changes, `.github/dependabot.yml`. Commit scope `ci`.
- **Dependencies:** FND-T-21.

### FND-T-23 Verify CI workflow locally
- **Assignee:** tester
- **Goal:** verify everything verifiable before the PO's push.
- **Requirements:** FND-FR-23, FND-FR-24 (partly), FND-NFR-06, FND-NFR-07.
- **Read first:** spec 8.6, 12; `.github/`.
- **Do:** run `actionlint`; run each CI command locally in the same order from a fresh clone; check that job 1 uses no Docker; run Gitleaks locally against a temp dir containing a dummy secret and confirm it fails (do not commit the secret); confirm no secrets are referenced other than none.
- **Acceptance:** all pass; failures reported with evidence. Actual GitHub runs are covered in T-45.
- **Output:** verification report in the reply.
- **Dependencies:** FND-T-22.

---

## 7. Step 6: deploy

### FND-T-24 Deploy job and hello-world smoke test
- **Assignee:** developer
- **Goal:** the pipeline can deploy the hello-world app to Vercel from Actions only.
- **Requirements:** FND-FR-25, FND-FR-03 (production without DB), FND-NFR-06.
- **Read first:** spec 4 (Hello-world test), 8.6 (FR-25), 14; ADR 0004 (secret inventory, deployment); Vercel CLI docs (confirm `vercel pull/build/deploy --prebuilt --prod` and `git.deploymentEnabled`, which ADR 0004 says were not re-verified).
- **Do:** `vercel.json` with `git.deploymentEnabled: false`; deploy job in the workflow: `needs:` every blocking job (fast, Docker, secret scan), runs only on the single working branch (`main`), uses only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, runs `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`, then a post-deploy `curl --fail` on the deployed URL's `/api/health` checking the known body; failure fails the workflow. The pre-deploy hello-world check is the E2E home test already in CI. No `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_MIGRATION_URL` anywhere in the deploy job; the deployed app needs no DB variable.
- **Acceptance:** `actionlint` passes; dependency graph shows deploy needs all blocking jobs and not the audit job; secrets limited to the three `VERCEL_*`; local `vercel build` equivalent (production build with no DB variables) succeeds.
- **Out of scope:** creating the Vercel project, token or GitHub secrets (PO), preview deployments, cloud DB, running on GitHub.
- **Output:** `vercel.json`, workflow changes. Commit scope `ci`.
- **Dependencies:** FND-T-22.

### FND-T-25 Verify deploy workflow locally
- **Assignee:** tester
- **Goal:** verify deploy configuration before the push.
- **Requirements:** FND-FR-25 (locally verifiable part), FND-NFR-06.
- **Read first:** spec 8.6 (FR-25); `.github/workflows/*`, `vercel.json`.
- **Do:** `actionlint`; inspect `needs`, branch condition, secrets used, absence of forbidden secrets; run the production build with DB variables unset and `curl` `/api/health` on a local `next start` to simulate the smoke test; confirm the smoke test script fails when the body differs.
- **Acceptance:** all checks pass or failures reported.
- **Output:** verification report in the reply.
- **Dependencies:** FND-T-24.

### FND-T-26 Architect review of CI/CD
- **Assignee:** architect
- **Goal:** review the workflows for security and conformance with ADR 0004 and the Deployment section of `docs/architecture.md`.
- **Requirements:** FND-FR-23, 24, 25; FND-NFR-05, 06.
- **Read first:** spec 8.6, 16 (R4-R6); ADR 0004; `docs/architecture.md`; `.github/`, `vercel.json`.
- **Do:** check permissions, action pinning, secret exposure paths, `needs` graph, single deploy path, no migration URL on Vercel; correct `docs/architecture.md` Deployment section if the implementation differs; list blockers/notes.
- **Acceptance:** review in the reply; no unresolved blocker or blockers listed.
- **Out of scope:** new tooling (CodeQL etc.).
- **Output:** review, doc edits. Commit scope `docs`.
- **Dependencies:** FND-T-25.

### FND-T-27 Accept steps 5-6 (local part)
- **Assignee:** product-manager
- **Goal:** accept what can be accepted before the push (DoD 8).
- **Requirements:** FND-FR-23, 24, 25 (local part).
- **Read first:** spec 8.6, 13 (items 8, 9); T-23, T-25, T-26 reports.
- **Do:** check the workflow files against each FR criterion; mark criteria that need a real run as "pending PO push" (covered by T-45 to T-47).
- **Acceptance:** DoD item 8 met; items needing a push listed.
- **Output:** acceptance note in the reply.
- **Dependencies:** FND-T-26.

---

## 8. Step 7: design system

### FND-T-28 Design system document
- **Assignee:** ui-ux-designer
- **Goal:** write `docs/design-system.md` before components are built.
- **Requirements:** FND-FR-15, FND-FR-16, FND-FR-18, FND-NFR-03, FND-NFR-04.
- **Read first:** spec 8.4 (FR-14 to FR-18), 3 (out of scope components list), 4, decisions D12 to D14; `specs/001-foundations/reviews/ui-ux-designer.md` and `questions.md` (PO answers Q10 to Q12).
- **Do:** document tokens (color roles incl. success/warning/info/destructive/ring, light and dark, placeholder accent calm blue/indigo, type scale, 4px spacing, radius, shadow, motion, breakpoints, density), the component list for epic 002 with states (Button, Input, Label, FormField, Password input, Alert, Card, Spinner/Skeleton, auth layout, app shell, Sonner toast provider), the consistency rule, component Definition of Done, tone guide (UI term "company"), and the documented-only CRUD patterns (navigation, page templates, table pattern, forms, feedback, CRUD verbs). Do not write component code or specify components outside the in-scope list. A UI stack ADR is not required; if the designer thinks one is, say so in the reply instead of writing it.
- **Acceptance:** each section exists; every in-scope component has its states listed; CRUD patterns are marked "documented only, not implemented"; wordmark and accent changeable in one place described.
- **Out of scope:** code, mockup images, Table/Dialog/Select/Dropdown/Tabs/Pagination/Badge/Textarea/Checkbox/Breadcrumb specs beyond a "future components" note.
- **Output:** `docs/design-system.md`. Commit scope `docs(design)`.
- **Dependencies:** FND-T-02. **Independent** of FND-T-03 to FND-T-27 (may run in parallel with any of them).

### FND-T-29 Tailwind, shadcn, tokens, fonts, toast provider
- **Assignee:** developer
- **Goal:** the styling foundation from the design system document.
- **Requirements:** FND-FR-14, FND-FR-15, FND-FR-16 (toast provider).
- **Read first:** spec 8.4; `docs/design-system.md` (tokens); current Tailwind and shadcn/ui docs for pinned versions.
- **Do:** Tailwind CSS and shadcn/ui (Radix) init, Lucide, one `next/font`; tokens as semantic CSS variables mapped in the Tailwind theme in one token file; light and dark following the system (`prefers-color-scheme`), no flash on load, no toggle; wordmark text component; Sonner provider mounted once in the root layout; add only shadcn components needed later in T-30/T-31 (no unused components in `src/components/ui`).
- **Acceptance:** home page uses theme tokens; dark OS setting renders dark tokens on first paint; changing the accent in the token file changes it app-wide; typecheck/lint/build pass.
- **Out of scope:** components (T-30), shell (T-31), `/design` (T-32), dark-mode toggle.
- **Output:** styling config, token file, root layout. Commit scope `feat(ui)`.
- **Dependencies:** FND-T-28, FND-T-27 (sequential default; the code does not depend on CI).

### FND-T-30 Base components
- **Assignee:** developer
- **Goal:** Button, Input, Label, FormField, Password input, Alert, Card, Spinner/Skeleton.
- **Requirements:** FND-FR-16, FND-NFR-03.
- **Read first:** spec 8.4 (FR-16); `docs/design-system.md` (component specs, DoD); T-29 output.
- **Do:** implement from tokens only, all states, both themes, keyboard operable. FormField is control-agnostic (label, control, hint, error, `aria-describedby`, `aria-invalid`) built on React Hook Form + Zod. Password input has show/hide with accessible name. No Table, Dialog, Select, Dropdown, Tabs, Pagination, Badge, Textarea, Checkbox or Breadcrumb.
- **Acceptance:** typecheck/lint pass; components render with no raw color or spacing values; FormField error is associated with its control.
- **Out of scope:** auth layout and app shell (T-31), showcase page (T-32), tests (T-33).
- **Output:** `src/components/ui/*`, form components. Commit scope `feat(ui)`.
- **Dependencies:** FND-T-29.

### FND-T-31 Auth layout, app shell, styled home page
- **Assignee:** developer
- **Goal:** layouts that epic 002 plugs into, and a styled home page.
- **Requirements:** FND-FR-16, FND-FR-14, FND-NFR-03, FND-NFR-04.
- **Read first:** spec 8.4, 17 (item 3, default A); `docs/design-system.md` (auth layout, app shell, home page).
- **Do:** auth layout; app shell designed for growth (sidebar collapsible to a drawer on mobile, top bar with company-name placeholder and user menu slot, page header, one nav item); home page restyled using the system and keeping the known heading from T-02. The shell is not routed to any product page (shown on `/design`).
- **Acceptance:** shell renders at 375px and 1280px with no horizontal page scroll; keyboard can open/close the mobile drawer; home page heading unchanged.
- **Out of scope:** real navigation, auth screens, company switcher, user menu content.
- **Output:** layout components, home page. Commit scope `feat(ui)`.
- **Dependencies:** FND-T-30.

### FND-T-32 `/design` showcase and production gating
- **Assignee:** developer
- **Goal:** the showcase page, hidden in production.
- **Requirements:** FND-FR-17, FND-FR-18 (lint/check against raw values, if feasible).
- **Read first:** spec 8.4 (FR-17, FR-18), 4; `docs/design-system.md`; ADR 0004 (env).
- **Do:** `/design` renders every component in every state in both themes (light and dark shown together or via sections), not linked from product navigation; available in development and in CI/E2E; returns 404 in the Vercel production build via an explicit server-side flag read through `src/lib/env.ts` (on locally and in CI, absent on Vercel; document it in `.env.example`). If feasible, add a lint or script check for raw hex colors and arbitrary Tailwind values; if not feasible, say so (not a blocker).
- **Acceptance:** with the flag on, all components render on `/design`; with it off in a production build, `GET /design` returns 404.
- **Out of scope:** sample pages, additional components.
- **Output:** `src/app/design/*`, env flag, optional check. Commit scope `feat(ui)`.
- **Dependencies:** FND-T-31.

### FND-T-33 Design system E2E and a11y tests
- **Assignee:** tester
- **Goal:** automated checks for the design system.
- **Requirements:** FND-FR-15, 16, 17, 20; FND-NFR-03, FND-NFR-04.
- **Read first:** spec 8.4, 8.5, 9; `tests/e2e/`; `docs/design-system.md`.
- **Do:** E2E: axe zero violations on `/` and `/design` in light and dark; no horizontal page scroll at 375px and 1280px on `/` and `/design`; dark `colorScheme` applies dark tokens with no light flash; FormField error exposes `aria-invalid` and `aria-describedby`; keyboard path to the mobile drawer; `/design` is 404 when the flag is off (separate production-mode start); toast provider mounted once.
- **Acceptance:** `pnpm test:e2e` passes; introducing an axe violation or removing the 404 gate makes a test fail.
- **Out of scope:** visual regression, Storybook.
- **Output:** `tests/e2e/*.spec.ts`. Commit scope `test(e2e)`.
- **Dependencies:** FND-T-32.

### FND-T-34 Design review
- **Assignee:** ui-ux-designer
- **Goal:** review `/design` and the home page against the design document and a11y (R10).
- **Requirements:** FND-FR-14 to 18; FND-NFR-03, 04.
- **Read first:** spec 8.4; `docs/design-system.md`; running app (`/`, `/design`) in light, dark and 375px.
- **Do:** check tokens-only use, all states shown, keyboard operation and focus visibility, contrast, tone; list blockers and minor notes for fix tasks; update `docs/design-system.md` only to match what was actually built.
- **Acceptance:** written review; no unresolved blocker or blockers listed.
- **Output:** review in the reply, doc touch-ups. Commit scope `docs(design)`.
- **Dependencies:** FND-T-33.

### FND-T-35 Accept step 7
- **Assignee:** product-manager
- **Goal:** accept the design system step.
- **Requirements:** FND-FR-14 to 18; FND-NFR-03, 04.
- **Read first:** spec 8.4, 13 (item 6); T-33 and T-34 reports; `src/components/ui` listing.
- **Do:** check criteria and that no out-of-scope component code exists.
- **Acceptance:** criteria met with evidence.
- **Output:** acceptance note in the reply.
- **Dependencies:** FND-T-34.

---

## 9. Step 8: conventions and boundary lint

### FND-T-36 Conventions in `docs/architecture.md`
- **Assignee:** architect
- **Goal:** complete the conventions section and map each lint rule to a convention.
- **Requirements:** FND-FR-13, FND-HR-10.
- **Read first:** spec 8.3 (FR-12, FR-13); ADR 0001, 0003; `docs/architecture.md`.
- **Do:** extend `docs/architecture.md` to cover every item of FR-13 (layout, kebab-case, named exports, `@/` alias, Server Components default, Server Actions typed result, Zod at boundary, error logging without PII, all queries use the transaction from `withRls`); add a table mapping each FR-12 rule (a to f) to its convention and the documented `/api/health/db` exception; link ADRs 0001-0005; specify the exact lint tool choices for the developer if ADR 0001 left them open.
- **Acceptance:** each FR-12 rule is traceable to a convention; ADRs linked.
- **Out of scope:** code, new decisions beyond the ADRs.
- **Output:** `docs/architecture.md`. Commit scope `docs(architecture)`.
- **Dependencies:** FND-T-02. **Independent** of FND-T-03 to FND-T-35.

### FND-T-37 Boundary lint rules
- **Assignee:** developer
- **Goal:** lint enforces module and data-access boundaries.
- **Requirements:** FND-FR-12, FND-FR-09 (raw client restriction), FND-HR-10.
- **Read first:** spec 8.3; ADR 0001 (rules 1-5), ADR 0003 (exports; supabase-js restriction); `docs/architecture.md` (T-36 mapping); `eslint.config.*`.
- **Do:** implement rules (a) import a module only via its `index.ts`; (b) `src/lib` does not import `src/modules`; (c) `src/db` does not import `src/modules`; `app` and UI components do not import `@/db`, with a single file-level allowlist for `src/app/api/health/db/route.ts`; (d) raw client importable only inside `src/db`; (e) no import cycles; (f) restrict supabase-js `.from()` and `.rpc()` calls. Run in `pnpm lint`. Do not create empty module folders; ensure the current tree still lints clean.
- **Acceptance:** `pnpm lint` passes on the tree; each rule reports on a deliberately illegal sample (proven formally in T-38).
- **Out of scope:** the fixture tests (T-38), new rules.
- **Output:** lint config. Commit scope `chore(lint)`.
- **Dependencies:** FND-T-36, FND-T-35.

### FND-T-38 Boundary rule tests (fixtures)
- **Assignee:** tester
- **Goal:** prove each rule reports an illegal import and passes a legal one.
- **Requirements:** FND-FR-12, FND-FR-20.
- **Read first:** spec 8.3 (FR-12); lint config; unit test setup.
- **Do:** unit-layer tests that run ESLint programmatically on fixture files (illegal and legal pair per rule a to f, plus the health route exception and a case showing the exception does not apply to other `app` files). Fixtures live under a test fixtures folder excluded from normal lint and from the build.
- **Acceptance:** `pnpm test` passes; removing a rule makes its test fail; no Docker needed.
- **Output:** tests and fixtures. Commit scope `test(lint)`.
- **Dependencies:** FND-T-37.

### FND-T-39 Accept step 8
- **Assignee:** product-manager
- **Goal:** accept conventions and enforcement.
- **Requirements:** FND-FR-12, FND-FR-13.
- **Read first:** spec 8.3, 13 (item 7); T-36 doc; T-38 test results.
- **Acceptance:** every rule has a convention, a lint rule and a test.
- **Output:** acceptance note in the reply.
- **Dependencies:** FND-T-38.

---

## 10. Step 9: documentation and final acceptance

### FND-T-40 Test README
- **Assignee:** tester
- **Goal:** document the test layers.
- **Requirements:** FND-FR-19, FND-FR-27, FND-FR-26 (section stub).
- **Read first:** spec 8.5, 8.6; `tests/`, package scripts.
- **Do:** `tests/README.md` (location is `tests/README.md` unless the repo already has another place): the three commands, prerequisites (Docker for `test:db`/`test:e2e`), debugging (traces, `--ui`), reset (`pnpm db:reset`), layout, harness usage (`asUser`, throwaway tables, matrices), schema guard and its allowlist, coverage report-only; an empty section "Gate failure proofs" to be filled by T-47.
- **Acceptance:** every command documented matches an existing script and was run once.
- **Out of scope:** README (T-41).
- **Output:** `tests/README.md`. Commit scope `docs(tests)`.
- **Dependencies:** FND-T-39.

### FND-T-41 Project README
- **Assignee:** developer
- **Goal:** onboarding README.
- **Requirements:** FND-FR-27, FND-NFR-01, FND-FR-24 (README notes), FND-FR-05 (commands documented).
- **Read first:** spec 8.6 (FR-24, FR-27), 9 (NFR-01), 11, 14; all `package.json` scripts; `docs/architecture.md`.
- **Do:** README with prerequisites (Node via `.nvmrc`, pnpm, Docker Desktop/OrbStack/Colima), setup steps (install, `cp .env.example`, `db:start`, `db:reset`, `dev`), script table, test commands (link test README), troubleshooting, CI/CD overview with badge and how failures are noticed (badge, GitHub failure email), PO prerequisites (repo, Vercel project/token/secrets), commit convention suggestion, secret-leak note (rotate, not only remove), private-repo CI minutes note, the 15-minute target excluding first image download, link to `docs/`.
- **Acceptance:** every command listed exists and works; all required topics present.
- **Out of scope:** marketing text, extra docs.
- **Output:** `README.md`. Commit scope `docs`.
- **Dependencies:** FND-T-39. **Independent** of FND-T-40.

### FND-T-42 Onboarding dry run
- **Assignee:** tester
- **Goal:** measure onboarding as a stranger would.
- **Requirements:** FND-NFR-01, FND-FR-27.
- **Read first:** `README.md`, `tests/README.md` only (do not read specs; follow the README).
- **Do:** in a fresh clone in a new directory with no existing `node_modules` or `.env`, follow the README exactly; time from clone to styled home page and Supabase running (excluding first Docker image download); record every step where the README was wrong or unclear.
- **Acceptance:** completed in 15 minutes or less, or the gaps are listed for a fix task.
- **Output:** report in the reply.
- **Dependencies:** FND-T-40, FND-T-41.

### FND-T-43 Final architect check: ADRs, architecture, conventions
- **Assignee:** architect
- **Goal:** confirm ADRs 0001-0005 and docs match the built result.
- **Requirements:** FND-FR-13, FND-FR-27; spec D1 to D6.
- **Read first:** ADRs 0001-0005; `docs/architecture.md`; spec 5; final code layout.
- **Do:** compare each ADR decision to the implementation (Data API off, driver, no `supabase gen types`, SQL-first plus drift check, `app_backend`, env rules, auto-deploy off, boundary rules); fix ADR/doc wording; report real divergences as findings.
- **Acceptance:** all ADRs consistent with the code, or divergences listed.
- **Output:** doc edits, findings in the reply. Commit scope `docs(adr)`.
- **Dependencies:** FND-T-42.

### FND-T-44 Final acceptance, local part (DoD 1-8, 10)
- **Assignee:** product-manager
- **Goal:** run the acceptance checklist over every requirement ID.
- **Requirements:** all FND-FR/NFR except those pending the push.
- **Read first:** spec 8, 9, 13, 3 (out of scope); all verification reports; the traceability matrix below.
- **Do:** table of every FND-FR/NFR with status (met / partially / not met / deferred / pending PO push) and evidence; scope-creep check against section 3; update the epic status in `specs/README.md` to "Done pending PO push"; brief retrospective (few bullets); update this file's status table.
- **Acceptance:** DoD items 1-8 and 10 met; gaps listed honestly.
- **Output:** acceptance checklist (appended to this file as section 12 or a separate `acceptance.md`), README status update.
- **Dependencies:** FND-T-43.

### FND-T-45 First CI run is green (pending PO push)
- **Assignee:** tester
- **Goal:** verify the first real GitHub Actions run.
- **Requirements:** FND-FR-23, FND-FR-24, FND-NFR-07.
- **Precondition:** the PO created the GitHub repository, pushed, and reported the run URL (or granted a way to read it).
- **Read first:** spec 8.6, 14; workflow files; the run logs.
- **Do:** check all blocking jobs are green, audit job reports without blocking, Gitleaks ran with full history, caches work, the fast job finished independently of the Docker job, README badge renders; record run times. Report failures; do not silently patch.
- **Acceptance:** run green; durations recorded.
- **Output:** report in the reply.
- **Dependencies:** FND-T-44, PO push.

### FND-T-46 Vercel deploy and post-deploy smoke test (pending PO push)
- **Assignee:** tester
- **Goal:** verify deployment.
- **Requirements:** FND-FR-25, FND-FR-17 (404 in production), FND-FR-03.
- **Precondition:** the PO created the Vercel project, token and the three GitHub secrets.
- **Read first:** spec 8.6 (FR-25), 14; deploy job logs.
- **Do:** confirm the deploy job ran only after blocking jobs, deployed prebuilt, and the post-deploy `curl --fail /api/health` passed; confirm no Vercel Git auto-deploy occurred; `GET /design` on the deployed URL is 404; no DB variables on Vercel.
- **Acceptance:** all confirmed with evidence.
- **Output:** report in the reply.
- **Dependencies:** FND-T-45.

### FND-T-47 Gates fail on bad input (pending PO push)
- **Assignee:** tester
- **Goal:** prove each gate fails once and block deploy.
- **Requirements:** FND-FR-26, FND-FR-24.
- **Precondition:** the PO pushes each throwaway commit (or explicitly allows agents to push); see PO decisions in the reply.
- **Read first:** spec 8.6 (FR-26); `tests/README.md`.
- **Do:** one throwaway commit per case: lint error, type error, failing test, dummy secret, failing hello-world; observe the red job and that deploy does not run; revert each; the dummy secret is a recognizable fake, and the README rotation rule is noted. Record cases and observed red jobs in the "Gate failure proofs" section of `tests/README.md`.
- **Acceptance:** all five cases recorded with the observed red job; tree reverted and green again.
- **Out of scope:** extra gates.
- **Output:** `tests/README.md` update. Commit scope `docs(tests)`.
- **Dependencies:** FND-T-46.

### FND-T-48 Final acceptance, DoD 9 (pending PO push)
- **Assignee:** product-manager
- **Goal:** close the epic.
- **Requirements:** FND-FR-23 to 26 (run evidence); DoD item 9.
- **Read first:** spec 13; T-45, T-46, T-47 reports; the checklist from T-44.
- **Do:** update the checklist, set the epic to Done in `specs/README.md`, final notes.
- **Acceptance:** DoD item 9 met with evidence; epic closed or remaining gaps listed.
- **Output:** updated acceptance checklist and README status.
- **Dependencies:** FND-T-47.

---

## 11. Traceability matrix

| Requirement | Tasks (build -> verify/accept) |
|-------------|-------------------------------|
| FND-FR-01 | T-02 -> T-04, T-05 |
| FND-FR-02 | T-02 -> T-04, T-05 |
| FND-FR-03 | T-03, T-13 -> T-04, T-25, T-46 |
| FND-FR-04 | T-01, T-22 -> T-04, T-23 |
| FND-FR-05 | T-06, T-41 -> T-08, T-09 |
| FND-FR-06 | T-10 -> T-19, T-20 |
| FND-FR-07 | T-10, T-21 -> T-18, T-19, T-23, T-45 |
| FND-FR-08 | T-11 -> T-16, T-18, T-19 |
| FND-FR-09 | T-12, T-37 -> T-15, T-18, T-38 |
| FND-FR-10 | T-15, T-16 -> T-18, T-19, T-20 |
| FND-FR-11 | T-07, T-12 -> T-08, T-19, T-20 |
| FND-FR-12 | T-37 -> T-38, T-39 |
| FND-FR-13 | T-36 -> T-39, T-43 |
| FND-FR-14 | T-29, T-31 -> T-34, T-35 |
| FND-FR-15 | T-28, T-29 -> T-33, T-34, T-35 |
| FND-FR-16 | T-28, T-29, T-30, T-31 -> T-33, T-34, T-35 |
| FND-FR-17 | T-32 -> T-33, T-46 |
| FND-FR-18 | T-28, T-32 -> T-34, T-35 |
| FND-FR-19 | T-13, T-17, T-40 -> T-19, T-20 |
| FND-FR-20 | T-13, T-17, T-33, T-38 -> T-19, T-20 |
| FND-FR-21 | T-14 -> T-19, T-20 |
| FND-FR-22 | T-16 -> T-19, T-20 |
| FND-FR-23 | T-21 -> T-23, T-27, T-45 |
| FND-FR-24 | T-22, T-41 -> T-23, T-27, T-45, T-47 |
| FND-FR-25 | T-24 -> T-25, T-26, T-27, T-46 |
| FND-FR-26 | T-47 -> T-48 |
| FND-FR-27 | T-36, T-40, T-41, T-43 -> T-42, T-44 |
| FND-NFR-01 | T-41 -> T-42, T-44 |
| FND-NFR-02 | T-11, T-12, T-15, T-16 -> T-18, T-19, T-20 |
| FND-NFR-03 | T-17, T-28, T-30, T-31 -> T-33, T-34, T-35 |
| FND-NFR-04 | T-17, T-31 -> T-33, T-35 |
| FND-NFR-05 | T-03, T-13, T-22 -> T-23, T-45 |
| FND-NFR-06 | T-02, T-06, T-21, T-24 -> T-23, T-25 |
| FND-NFR-07 | T-21 -> T-23, T-45 |

Every FND-FR and FND-NFR appears at least once as a build task and at least once as a verification or acceptance task. Every task traces to at least one requirement (T-01 to T-48; T-05, T-09, T-20, T-27, T-35, T-39, T-44, T-48 are acceptance tasks for the requirements they list).

## 12. Critical path and parallelism

- **Critical path (sequential):** T-01 -> T-02 -> T-03 -> T-06 -> T-10 -> T-11 -> T-12 -> T-13 -> T-14 -> T-15 -> T-16 -> T-18 -> T-19 -> T-20 -> T-21 -> T-22 -> T-24 -> T-25 -> T-26 -> T-27 -> T-29 -> ... -> T-35 -> T-37 -> T-38 -> T-39 -> T-40/T-41 -> T-42 -> T-43 -> T-44 -> (PO push) -> T-45 -> T-46 -> T-47 -> T-48.
- **Independent (may run in parallel):** T-07 with T-06; T-17 with T-14..T-16; T-28 with anything after T-02; T-36 with anything after T-02; T-41 with T-40. Everything else waits for its dependencies. Running T-28 and T-36 early (right after T-02) is recommended since they are documents only and shorten the later steps.
- **Verification rhythm:** developer builds -> tester verifies (fresh agent) -> architect/ui-ux-designer review where listed -> product-manager accepts.

## 13. Change log

| Date | Change |
|------|--------|
| 2026-11-12 | First version of the task list (48 tasks). |
