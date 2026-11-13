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
| FND-T-01 | git init and `.gitignore` | developer | 1 | none | done |
| FND-T-02 | Next.js skeleton and toolchain | developer | 1 | T-01 | done |
| FND-T-03 | Typed environment configuration | developer | 1 | T-02 | done |
| FND-T-04 | Verify step 1 | tester | 1 | T-03 | done |
| FND-T-49 | Step 1 follow-ups from T-04 (public env fails the build, relax Node pin) | developer | 1 | T-04 | done |
| FND-T-05 | Accept step 1 | product-manager | 1 | T-04, T-49 | done |
| FND-T-06 | Local Supabase, scripts, Data API off | developer | 2 | T-03 | done |
| FND-T-07 | `/api/health` liveness | developer | 2 | T-03 | done |
| FND-T-08 | Verify step 2 | tester | 2 | T-06, T-07 | done |
| FND-T-09 | Accept step 2 | product-manager | 2 | T-08 | done |
| FND-T-10 | Drizzle stack, schema entry, `db:schema` | developer | 3 | T-06 | done |
| FND-T-11 | `app_backend` role migration | developer | 3 | T-10 | done |
| FND-T-12 | `withRls`, `VerifiedContext`, `/api/health/db` | developer | 3 | T-11 | done |
| FND-T-13 | Vitest tooling, unit layer, env unit test | tester | 4 | T-12 | done |
| FND-T-14 | DB test harness | tester | 4 | T-13 | done |
| FND-T-15 | `withRls` integration tests, part A | tester | 4 | T-14 | done |
| FND-T-16 | `withRls` integration tests, part B, and schema guard | tester | 4 | T-15 | done |
| FND-T-17 | Playwright tooling and E2E home test with axe | tester | 4 | T-13 | done |
| FND-T-18 | Architect review of the data stack and ADR confirmation | architect | 4 | T-16 | done |
| FND-T-50 | Role timeouts and function default privileges (T-18 should-fix 1 and 2) | developer | 4 | T-18 | done |
| FND-T-51 | Catalog tests for timeouts, function privileges and anon grants (T-18 should-fix 1, 2, 3) | tester | 4 | T-50 | done |
| FND-T-19 | Independent verification of steps 3-4 | tester | 4 | T-16, T-17, T-18, T-51 | done |
| FND-T-52 | `db:schema` safety, ESLint ignores, `test:db` glob guard (T-19 D1, G2) | developer | 4 | T-19 | done |
| FND-T-53 | Tests for `/api/health/db` no-leak and Data API config (T-19 G1, G3) | tester | 4 | T-52 | done |
| FND-T-20 | Accept steps 3-4 | product-manager | 4 | T-19, T-52, T-53 | done |
| FND-T-21 | CI workflow: fast group and Docker group | developer | 5 | T-17, T-20 | done |
| FND-T-22 | CI security jobs and Dependabot | developer | 5 | T-21 | done |
| FND-T-23 | Verify CI workflow locally | tester | 5 | T-22 | done |
| FND-T-24 | Deploy job and hello-world smoke test | developer | 6 | T-22 | done |
| FND-T-25 | Verify deploy workflow locally | tester | 6 | T-24 | done |
| FND-T-54 | Use `--env` instead of the deprecated `-e` in the deploy job (T-25 D1) | developer | 6 | T-25 | done |
| FND-T-26 | Architect review of CI/CD | architect | 6 | T-25, T-54 | done |
| FND-T-55 | Dependabot: drop the inert npm ecosystem, keep github-actions (T-26 S1) | developer | 6 | T-26 | done |
| FND-T-27 | Accept steps 5-6 (local part) | product-manager | 6 | T-26, T-55 | todo |
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

### FND-T-49 Step 1 follow-ups from T-04

- **Assignee:** developer. **Step:** 1. **Depends on:** FND-T-04 (verification report `specs/001-foundations/verification/step-1.md`, defects D1 and D3). Added after T-04; the PO accepted the tester's recommendations.
- **Requirements:** FND-FR-03, FND-NFR-06.
- **Goal:** (1) a build made without the public `NEXT_PUBLIC_*` variables must fail, naming the variable, instead of passing and returning 500 at `next start`; (2) the Node pin must accept any 26.x at or above 26.13.1 so Node security patches need no config change.
- **Read first:** AGENTS.md, `verification/step-1.md`, `src/lib/env.ts`, `src/lib/env.server.ts`, `src/instrumentation.ts`, `next.config.ts`, `package.json`, `.nvmrc`, ADR 0004, the Execution notes at the end of this file.
- **Do:** (1) make `next build` fail on missing or invalid `NEXT_PUBLIC_*` variables with the existing error format (names the variable, never the value); for example import the public env module from `next.config.ts` with a relative path (careful: `env.server.ts` imports `server-only`, which throws outside the Next server, so only the public module may be loaded in config; the server env stays validated at start). DB variables stay optional in production builds. (2) set `engines.node` to `>=26.13.1 <27` and `.nvmrc` to `26` (or the equivalent that keeps pnpm's engine-strict rejecting Node 24 and accepting 26.x); keep every dependency exact.
- **Acceptance:** `pnpm build` with the three public variables set passes; with any one missing it fails and names it; with only DB variables missing it still passes; under Node 24 `pnpm install` still fails with `ERR_PNPM_UNSUPPORTED_ENGINE`; under Node 26.13.1 install, lint, typecheck, format:check and build pass. No new dependency unless unavoidable (say why).
- **Out of scope:** tests (T-13 adds them), ADR/architecture wording (architect, T-36 and T-43), anything else.
- **Output:** code and config changes. Commit scope `fix(env)`, body `Task: FND-T-49`.

### FND-T-50 Role timeouts and function default privileges

- **Assignee:** developer. **Step:** 4. **Depends on:** FND-T-18 (architect review, ADR 0003 "Open issues"). Added after T-18; the orchestrator took the architect's recommendations (hardening of the data foundation, same spirit as FND-FR-08).
- **Requirements:** FND-FR-08, FND-FR-09, FND-NFR-05.
- **Goal:** (1) bound query time: inside `withRls`, `show statement_timeout` is 0 today because the role-level settings of `authenticated` (8s) and `anon` (3s) apply at login, not on `SET ROLE`, and `app_backend` has none; (2) close the function default-privilege gap: a function created by `postgres` in `public` is executable by `anon`, `authenticated` and PUBLIC.
- **Read first:** AGENTS.md, ADR 0003 (Open issues, verified facts), `supabase/migrations/20261112120000_app_backend_role.sql`, `src/db/rls.ts`, `tests/README.md`, the Execution notes (T-11, T-12, T-15, T-16, T-18).
- **Do:** a NEW migration (never edit the existing one) that (a) sets `alter role app_backend set statement_timeout = '8s'` and `idle_in_transaction_session_timeout` (a short value such as `10s`; justify it) so they apply at login, including through the transaction pooler; verify on the real local stack that inside `withRls` (and through the Supavisor transaction pooler if you can enable it temporarily, then revert the config) `show statement_timeout` is 8s and a `pg_sleep(10)` is cancelled with SQLSTATE 57014; if role-level settings do not reach the session in some path, fall back to `set_config('statement_timeout', '8s', true)` inside `withRls` and say why; (b) revokes default function privileges for the `postgres` owner in `public` from PUBLIC, `anon` and `authenticated` (`alter default privileges ... revoke execute on functions ...`; verify the exact syntax for PUBLIC on the real PG 17 stack: if a schema-scoped revoke from PUBLIC does not work, use the non-schema-scoped form and explain), so epic 002 helpers need an explicit `grant execute ... to authenticated`; update the migration header comments and, if behavior changed, the ADR 0003 sentence on function privileges (small edit, keep it factual; the architect reviews later). Run `pnpm db:reset`, `pnpm test:db` (194 tests must still pass; adjust nothing in tests unless a test legitimately encoded the old behavior, and say so), `pnpm db:schema` plus `git diff --exit-code src/db` (unchanged).
- **Acceptance:** after `pnpm db:reset`: `app_backend` has `statement_timeout` 8s and the idle timeout set (`pg_roles.rolconfig`), effective inside `withRls`; a `pg_sleep` beyond the limit is cancelled; a function created by `postgres` in `public` is NOT executable by `anon`, `authenticated` or PUBLIC until granted; `pnpm test`, `test:db`, lint, typecheck, format:check and build pass.
- **Out of scope:** new tests (T-51), Realtime/Storage hardening, nested `withRls` guards, epic 002 functions.
- **Output:** migration file (and small ADR 0003 fix if needed). Commit scope `feat(db)`, body `Task: FND-T-50`. Do not push; no Co-Authored-By or AI mention.

### FND-T-51 Catalog tests for timeouts, function privileges and anon grants

- **Assignee:** tester. **Step:** 4. **Depends on:** FND-T-50 (and the T-18 should-fix 3).
- **Requirements:** FND-FR-08, FND-FR-10, FND-FR-22.
- **Goal:** lock the three hardening facts with tests so they cannot regress: (1) timeouts; (2) no default execute on new functions; (3) `anon` (and `authenticated` without an explicit grant) has no privileges on `public` tables and sequences, which the schema guard (RLS and policies only) does not cover.
- **Read first:** AGENTS.md, `tests/README.md`, the helpers in `tests/utils/`, ADR 0003, `tests/db/app-backend-role.test.ts`, `tests/db/schema-guard.test.ts`, the Execution notes (T-14, T-16, T-18).
- **Do:** add tests in `tests/db/` using the existing harness: (1) `pg_roles.rolconfig` of `app_backend` holds the statement and idle-in-transaction timeouts, `show statement_timeout` inside `withRls` is the expected value, and a `pg_sleep` beyond it is cancelled with 57014 (keep the sleep short enough for a fast suite); (2) a function created by `postgres` in a throwaway way is not executable by `anon`, `authenticated` or PUBLIC (`has_function_privilege`), then dropped; (3) a catalog check that `anon` has no privileges on any table or sequence in `public` (`has_table_privilege`, `has_sequence_privilege`; throwaway tables are named `tmp_test_*` and are granted explicitly only inside their own tests, so assert on the real schema and on a table created without grants), and that a table created as `supabase_admin` is documented as the known residual case (ADR 0003): assert the current behavior explicitly with a comment, or leave it out and say why. Optionally add the local Data API check (`/rest/v1/` not serving tables, HTTP) only if it is robust and fast; skip it otherwise and say why. Try to break each assertion (mutate the migration/state temporarily, see red, restore) and add a short mutation table to `tests/README.md`.
- **Acceptance:** `pnpm test:db` passes (all previous tests plus the new ones, twice in a row); each new test is proven to fail under its mutation; lint, typecheck, format:check, test and build pass.
- **Out of scope:** production code changes (report defects instead), Realtime/Storage checks.
- **Output:** new test file(s) under `tests/db/`, README section. Commit scope `test(db)`, body `Task: FND-T-51`. Do not push; no Co-Authored-By or AI mention.

### FND-T-52 `db:schema` safety, ESLint ignores, `test:db` glob guard

- **Assignee:** developer. **Step:** 4. **Depends on:** FND-T-19 (report `verification/step-3-4.md`, defect D1 and gap G2). Added after T-19.
- **Requirements:** FND-FR-07, FND-FR-19, FND-FR-21.
- **Goal:** (1) `pnpm db:schema` must never leave the repository damaged: today, with no `.env.local` and no `DATABASE_MIGRATION_URL`, it first deletes the tracked `src/db/schema/schema.ts` and `relations.ts`, then `drizzle-kit pull` aborts, leaving two tracked files deleted (and it prints a MODULE_TYPELESS warning); (2) ESLint must ignore the gitignored `coverage/` output (2 warnings today); (3) `pnpm test:db` uses `--passWithNoTests`, so a broken glob would pass silently.
- **Read first:** AGENTS.md, `verification/step-3-4.md` (D1, G2), `scripts/db-schema.ts`, `drizzle.config.ts`, `eslint.config.mjs`, `package.json`, `vitest.config.mts`, `tests/README.md`, the Execution notes (T-10, T-13, T-14).
- **Do:** (1) make `scripts/db-schema.ts` validate that `DATABASE_MIGRATION_URL` is set and well-formed BEFORE deleting anything, failing with a clear message that points to `.env.local` / `.env.example`; also make a failure of `drizzle-kit pull` restore the previous generated files (or write to a temp dir and move into place only on success); remove the MODULE_TYPELESS warning if it is cheap and safe (e.g. a `.mts` script or the right Node flag; do not change the package type unless clearly harmless); (2) add `coverage/` to the ESLint ignores; (3) remove `--passWithNoTests` from `test:db` so it fails when no DB tests are found (the DB project has files now), and make sure `pnpm test` (unit) behavior is unchanged. Keep each change minimal.
- **Acceptance:** with `DATABASE_MIGRATION_URL` unset, `pnpm db:schema` exits non-zero with a clear message and `git status` shows the generated files untouched; with the stack up and the variable set, `pnpm db:schema` followed by `git diff --exit-code src/db` is empty; `pnpm lint` has 0 errors and 0 warnings even when a `coverage/` folder exists; `pnpm test:db` fails if the glob matches nothing (prove it by temporarily pointing the include elsewhere, then restore) and passes 212/212 normally; `pnpm test`, typecheck, format:check and build pass.
- **Out of scope:** the CI drift job (T-21), new tests, any other script.
- **Output:** the changed scripts/config. Commit scope `fix(db)`, body `Task: FND-T-52`. Do not push; no Co-Authored-By or AI mention.

### FND-T-53 Tests for `/api/health/db` no-leak and the Data API config

- **Assignee:** tester. **Step:** 4. **Depends on:** FND-T-52 (and T-19 gaps G1, G3).
- **Requirements:** FND-FR-11, FND-FR-05, FND-FR-19.
- **Goal:** (1) an automated unit test for `/api/health/db` (today it is verified only manually): 200 `{"status":"ok","role":"anon"}` when `withAnonymousRls` succeeds, 503 `{"status":"unavailable"}` when it throws, and NO connection details (host, user, password, URL) in the response body or in what is logged when the thrown error contains a full connection string; Docker-free (mock `@/db` / `withAnonymousRls`); (2) make the Data API check independent of the running stack by asserting `supabase/config.toml` has `[api] enabled = false` (a one-line file-level test), keeping the existing HTTP check.
- **Read first:** AGENTS.md, `verification/step-3-4.md` (G1, G3), `src/app/api/health/db/route.ts`, `src/app/api/health/route.test.ts`, `tests/db/hardening-catalog.test.ts`, `tests/README.md`, the Execution notes (T-12, T-13, T-51).
- **Do:** add `src/app/api/health/db/route.test.ts` (unit project, no Docker) and the config assertion (in the DB hardening file or a small unit test, your choice; it must run in the suite where it is cheapest and most reliable). Prove each new assertion can fail (mutate the route to return the error message, or flip the config, see red, restore) and add a short mutation table to `tests/README.md`.
- **Acceptance:** `pnpm test` (unit, Docker stopped) passes with the new tests; `pnpm test:db` passes (212/212 plus any addition) twice in a row; each new assertion is proven red under its mutation; lint, typecheck, format:check and build pass.
- **Out of scope:** changing production code (report defects), the CI.
- **Output:** new test file(s), README section. Commit scope `test(health)`, body `Task: FND-T-53`. Do not push; no Co-Authored-By or AI mention.

### FND-T-54 Use `--env` instead of the deprecated `-e` in the deploy job

- **Assignee:** developer. **Step:** 6. **Depends on:** FND-T-25 (report `verification/step-6.md`, defect D1). Added after T-25.
- **Requirements:** FND-FR-25.
- **Goal:** `vercel deploy -e` is deprecated in the pinned CLI 65.15.0 (it prints `! -e is deprecated. Use --env.`); the job uses it three times; a future CLI bump could remove the alias.
- **Do:** in `.github/workflows/ci.yml` replace the three `-e NAME=value` with `--env NAME=value`; verify with `pnpm dlx vercel@65.15.0 deploy --help` that `--env` takes `KEY=value` the same way; while there, remove the cosmetic extra 5 s sleep after the last failed post-deploy attempt if it is a one-line change. Nothing else.
- **Acceptance:** `actionlint` clean; no `-e ` left in the deploy command (grep); the deploy job otherwise unchanged (`git diff` shows only those lines); lint, typecheck, format:check, test pass.
- **Out of scope:** J2 (promote-after-check), CLI pinning, anything else.
- **Output:** the workflow change. Commit scope `ci`, body `Task: FND-T-54`. Do not push; no Co-Authored-By or AI mention.

### FND-T-55 Dependabot: drop the inert npm ecosystem, keep github-actions

- **Assignee:** developer. **Step:** 6. **Depends on:** FND-T-26 (finding S1). Added after T-26; the orchestrator took the architect's option (c).
- **Requirements:** FND-FR-24.
- **Goal:** Dependabot npm updates never work: run 43336683433 failed with `ERR_PNPM_UNSUPPORTED_ENGINE` (wanted `>=26.13.1 <27`, current Node 24.22.3 inside Dependabot's updater), because `engineStrict: true` and the Node 26 floor are deliberate (FND-FR-02) and must not be relaxed. A configured-but-failing ecosystem looks functional and produces red noise.
- **Read first:** AGENTS.md, `.github/dependabot.yml`, the T-22, T-23 and T-26 Execution notes, `docs/adr/0004-env-and-secrets.md` and `docs/architecture.md` (what they say about Dependabot), `gh run view 43336683433 --repo hgonza81/nextjs-starter --log` (read-only).
- **Do:** remove the `npm` ecosystem entry from `.github/dependabot.yml` and keep `github-actions` (weekly, grouped), with a short comment explaining why npm is not listed (Dependabot's updater runs Node 24 and the project enforces Node 26 through `engineStrict`; dependencies are updated manually and `pnpm audit` in CI stays informational) and how to re-add it once the updater supports Node 26; fix any sentence in `docs/adr/0004-env-and-secrets.md` and `docs/architecture.md` that says Dependabot also covers npm (small factual edits only). Validate the file against the SchemaStore dependabot schema as in T-22.
- **Acceptance:** `.github/dependabot.yml` is valid and lists only `github-actions`; no doc claims Dependabot updates npm; `actionlint` unaffected; lint, typecheck, format:check, test pass.
- **Out of scope:** relaxing `engineStrict` or the Node floor, README text (T-41 notes it), other workflow changes.
- **Output:** the config and doc edits. Commit scope `ci`, body `Task: FND-T-55`. Do not push; no Co-Authored-By or AI mention.

## Execution notes (hand-off between tasks; added by the orchestrator)

Facts discovered while executing tasks that later tasks must know. Read the ones that name your task.

- **Node:** Node 26.13.1 (active LTS) is pinned in `.nvmrc`/`engines` and is now the PO's system Node (installed with Homebrew `node`, replacing Node 24; pnpm 12.18.0 installed with Homebrew `pnpm`; Node 26 has no corepack, so do not use `corepack`). Agents no longer need a temporary Node copy; pnpm 12.18.0 via `packageManager`; `engineStrict` and `saveExact` live in `pnpm-workspace.yaml`. The PO's system Node is 24 and pnpm rejects it; agents use a temporary Node 26 copy on PATH. TypeScript is held at 6.0.3 and ESLint at 9.39.5 (typescript-eslint / peer ceilings); `lint` is `eslint .` (no `next lint` in Next 16). (T-02)
- **`AGENTS.md` agent-rules block:** `pnpm dev`/`next dev` re-adds a "This is NOT the Next.js you know" block to `AGENTS.md`. Never commit it; revert with `git checkout AGENTS.md`. (T-02)
- **`.vscode/`** may appear untracked (PO editor settings). Never stage it.
- **Two env files (T-03, affects T-12, T-36, T-37, T-43):** `src/lib/env.ts` holds the public schema and `publicEnv` (safe for client code); `src/lib/env.server.ts` starts with `import "server-only"`, reads `process.env` for server variables, exports `serverEnv` and `requireDatabaseUrl()`; `src/instrumentation.ts` imports both so a bad env fails at startup. The boundary rules (T-37) must allow `env.server.ts`; `docs/architecture.md` and ADR 0004 need a note about the split (architect, T-36 and T-43). The T-12 DB module must call `requireDatabaseUrl()`.
- **`app_backend` local password (T-11):** `.env.example` uses `postgresql://app_backend:app_backend_local_password@127.0.0.1:54322/postgres`. T-11's `seed.sql` must set the same password, or `.env.example` must be updated to match.
- **Local anon key (T-06 / T-41):** `.env.example` has the placeholder `replace-with-local-anon-key`; the real value comes from `supabase status` and must be documented in the README.
- **Public env vars are required at build time (T-21, T-24):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` are inlined at build, so CI and the Vercel build need them set (non-secret placeholder values are fine in CI; configure them for Vercel).
- **Unit tests for `env.server.ts` (T-13):** `server-only` throws outside the Next.js server environment, so Vitest must alias or stub it.
- **Commits:** no `Co-Authored-By` trailers or AI mentions (AGENTS.md). Every commit so far is authored by the PO's git identity.
- **T-04 verdict (pass) and decisions:** step 1 passed. PO accepted the tester's recommendations: the `env.ts` / `env.server.ts` split stays (ADR 0004 and `docs/architecture.md` must be amended by the architect in T-36/T-43, and the T-37 boundary rules must allow `env.server.ts` and the `NEXT_RUNTIME` read in `src/instrumentation.ts`); public variables must fail the build and the Node pin is relaxed (both in T-49). The permanent assertion that no server-only variable reaches the client bundle belongs to T-13/T-37. gitleaks was not installed during T-04, so the secret scan was not run until T-22.
- **`AGENTS.md` and `.vscode/` (orchestrator, commit 04533c8):** the Next.js agent-rules block is now committed in `AGENTS.md`, so `next dev` leaves the file unchanged (verified). Do not remove it; if a future Next upgrade rewrites it, commit that change with the upgrade. `.vscode/settings.json` and `.vscode/extensions.json` are versioned (Prettier, ESLint, workspace TypeScript); T-29 adds the Tailwind extension recommendation.
- **T-49 (done):** `next.config.ts` now imports `./src/lib/env` (public env only), so `next build` fails on a missing/invalid `NEXT_PUBLIC_*` variable. Side effect: `next.config.ts` is also loaded by `next start` and `next dev`, so they too fail if the public variables are missing at runtime. For T-24 (Vercel deploy) and T-21 (CI): the three `NEXT_PUBLIC_*` variables must be configured both at build and at runtime on Vercel and in CI. `engines.node` is `>=26.13.1 <27` and `.nvmrc` is `26`. Under Node 24, a plain `pnpm install` prints "Already up to date" and skips the engine check; `pnpm install --force` triggers the rejection.
- **T-05 (step 1 accepted):** see `acceptance/step-1.md`. Notes: under a wrong Node a plain `pnpm install` on an installed tree skips the engine check (README T-41 must say to check `node -v`; Node 26 has no corepack, use Homebrew or another manager for pnpm); the permanent server-only-in-client-bundle test is owed by T-13/T-37; the secret scan does not exist until T-22/T-23. Amendments owed later: ADR 0004 and `docs/architecture.md` (env split, `NEXT_PUBLIC_` validation in `next.config.ts`, `NEXT_RUNTIME` read in `src/instrumentation.ts`) by the architect in T-36/T-43; T-37 boundary rules must allow `env.server.ts`.
- **T-06 (done):** the Supabase CLI is the exact devDependency `supabase@3.1.0` (scripts `db:start`, `db:stop`, `db:reset`, `db:status`; no global install). Local Postgres is major 17 (`[db] major_version = 17` in `supabase/config.toml`, must match the future cloud project; 17 supports `WITH INHERIT FALSE, SET TRUE` for the `app_backend` role in T-11). `[api] enabled = false` is set: `GET :54321/rest/v1/` returns 503, and Auth (GoTrue), signup and Studio still work (verified by running the stack). Local DB URL for migrations is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. The CLI prints a harmless "Skipping migration .gitkeep" on every start/reset until T-11 adds the first real migration (remove `supabase/migrations/.gitkeep` then). Local keys come from `supabase status -o json` (`ANON_KEY` legacy JWT, `PUBLISHABLE_KEY` `sb_publishable_...`); `.env.example` still has the anon-key placeholder, to be documented in T-41. Docker-not-running gives a clear "failed to connect to the docker API" error (JSON line).
- **T-07 (done):** `GET /api/health` returns 200 `{"status":"ok"}`, imports nothing (no DB, no env module) and sets `dynamic = "force-dynamic"` so it is never prerendered. This is the known body for the post-deploy hello-world check (T-24). Its tests belong to T-13/T-17; `/api/health/db` belongs to T-12.
- **T-08 (step 2 verified: pass, no defects):** see `verification/step-2.md`. For the README (T-41): `project_id = nextjs-starter` is shared, so two checkouts of the project cannot run local stacks at the same time; the Docker-down error is a raw one-line JSON, so list "Docker running" as a prerequisite; `db:status` lists rest, imgproxy and pooler as "Stopped services", which is expected with the Data API off. Not yet verified (later steps): a truly stopped Docker daemon (only an unreachable socket was simulated), `/api/health/db`, the `app_backend` role. No automated test for `/api/health` yet (T-13/T-17). The tester suggested disabling unused local Supabase services (analytics, edge runtime, vector) to speed up startup; recommended to leave as is for now.
- **T-09 (step 2 accepted):** see `acceptance/step-2.md`. The product-manager had no shell, so the orchestrator ran the residual checks (tracked files, no AI trailers in history, lint/typecheck/format, `db:start`/`db:reset`/`db:stop` with REST 503 and no containers left, production build and `/api/health` without DB variables): all passed. Still owed later: T-12 (`/api/health/db`); T-41 README items; T-11 removes `supabase/migrations/.gitkeep` and keeps the `app_backend` password in sync with `.env.example`; T-13/T-17 automated tests for `/api/health`; a truly stopped Docker daemon has only been simulated, someone should see it once (T-19 or T-42).
- **T-10 (done), facts for later tasks:** pinned `drizzle-orm` 0.45.4, `postgres` 4.1.1, `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7, `drizzle-kit` 0.31.11 (dev). `pnpm db:schema` is `node --env-file-if-exists=.env.local scripts/db-schema.ts` (Node 26 native TypeScript and `.env.local` loading; needs `DATABASE_MIGRATION_URL`, so CI (T-21) must set it). It deletes the old generated files, runs `drizzle-kit pull`, removes the junk `*.sql` and `meta/`, and prepends a "GENERATED, do not edit" header to `src/db/schema/schema.ts` and `relations.ts` (ignored by Prettier and ESLint). Output is stable: a second run gives an empty `git diff` (this is what the CI drift check relies on). `src/db/client.ts` is private (`server-only`, `drizzle(postgres(requireDatabaseUrl(), { prepare: false, max: 1 }))`); `src/db/index.ts` exports the schema only and no raw client; `withRls` arrives in T-12. `pnpm-workspace.yaml` has `allowBuilds: { esbuild: false }` because pnpm 12 blocks esbuild's install script (not needed). A gitignored `.env.local` copied from `.env.example` is needed locally for `db:schema` (README, T-41).
- **`drizzle-kit pull` facts to record in ADR 0002 (architect, T-18):** it emits policies (`pgPolicy`) but NOT the RLS-enabled flag (a table with RLS and no policy shows no `.enableRLS()` in the TS), and NOT roles or grants by default (`entities: { roles: true }` only adds noisy system roles; left off). Therefore the schema guard test of T-16 must query the catalog (`pg_class.relrowsecurity`, `pg_policies`), never the TS schema. The ADR 0002 fallback (hand-written schema) was not needed because the wrapper makes the output stable.
- **Local Docker note:** an unrelated container `agent-template-postgres-1` is running on the PO's machine; it is not from this project.
- **T-11 (done), facts for T-12, T-15, T-16, T-18:** migration `supabase/migrations/20261112120000_app_backend_role.sql` creates `app_backend` (`LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT`, no password in the migration) and runs `GRANT authenticated TO app_backend WITH INHERIT FALSE, SET TRUE` (same for `anon`). `supabase/seed.sql` sets the LOCAL-ONLY password `app_backend_local_password` (matches `.env.example`; the cloud password is a real secret set manually, nothing sets it automatically). Verified on the real PG 17 stack: `app_backend` owns nothing, has no table grants, cannot SELECT without switching role, can `SET ROLE` only to `authenticated`/`anon` (`postgres`, `service_role`, `supabase_admin` refused), wrong password rejected. **Important for tests and for epic 002:** the migration revokes the default privileges Supabase gives `anon`/`authenticated` on new tables and sequences in `public` (for tables created by `postgres`), so a table is DENIED to `authenticated` after `SET ROLE` until a migration grants it explicitly. Therefore the throwaway test tables of T-15/T-16 must be created with explicit `GRANT`s and RLS policies, and every real table in epic 002 needs explicit grants plus RLS (this is the intended fail-closed behavior). **Deviation to record in ADR 0003 (architect, T-18):** the default-privilege revoke covers the `postgres` owner only; `postgres` cannot change default privileges for `supabase_admin` (SQLSTATE 42501), so a table created in `public` as `supabase_admin` would still be auto-granted to `anon`/`authenticated`; migrations, Studio SQL and the CLI all run as `postgres`, so this should not matter in practice. `supabase/migrations/.gitkeep` was removed.
- **T-12 (done), facts for T-13 to T-16, T-18, T-37:** `src/db/rls.ts` exports `withRls(ctx, fn)`, `withAnonymousRls(fn)` and the types `VerifiedContext`, `RlsTransaction`; `src/db/index.ts` re-exports them and the schema (no raw client). One transaction via `getDb().transaction`; claims are set with parameterized `select set_config(..., $n, true)` (`request.jwt.claims`, `request.jwt.claim.sub`, optional `app.current_tenant`); `set local role` uses a hard-coded two-entry allowlist (`authenticated`, `anon`) via `sql.raw` on constants, no fallback. `withRls` throws on a missing/empty/non-UUID `userId` (message "withRls requires a non-empty verified user id (UUID).") and on an empty `tenantId`. **`sub` and `role` in the stored claims are always overwritten** with the verified `userId` and `authenticated`, so the T-15 test "claims equal those supplied" must compare the other fields (e.g. `email`) and expect `sub`/`role` to be the verified values and a forged `role`/`sub` to be overwritten. The anonymous variant sets claims `{"role":"anon"}` (no sub, no tenant). Once a GUC has been set in a session it reads back as `""` (not NULL) after the transaction ends: that is the "no claims" state for tests. A plain query as `app_backend` (no role switch) cannot call `auth.uid()` (permission denied on schema `auth`): intended fail-closed behavior. `src/db/client.ts` is now a memoized lazy `getDb()` (still one private instance, `prepare: false, max: 1`, server-only) because `next build` imports every route and an eager client threw without `DATABASE_*`; **architect (T-18) must update ADR 0003** for the lazy `getDb()` and the forced `sub`/`role` claims. `/api/health/db` runs `select current_user` through `withAnonymousRls`: 200 `{"status":"ok","role":"anon"}` with the DB up; 503 `{"status":"unavailable"}` with the DB down or `DATABASE_*` unset (production), logging only the error class name, never connection details; it is `force-dynamic`, the single `@/db` import exception in `app` (T-37 must allow exactly this file and T-38 must test that), and `/api/health` is untouched. In `next dev`, unset `DATABASE_*` is rejected earlier by the env module (required outside production). Manual evidence recorded by the developer: role, `auth.uid()`, claims visible inside; context reset after commit, rollback (callback threw) and anonymous call, all on the same connection (`max: 1`).
- **T-13 (done), facts for T-14 to T-17, T-21, T-37:** `vitest@5.1.0` and `@vitest/coverage-v8@5.1.0` pinned exactly. Config `vitest.config.mts` (`.mts` to avoid a CJS warning; included in `tsconfig.json`) defines two projects: `unit` (`src/**/*.test.ts`, node env) and `db` (`tests/db/**/*.test.ts`, `fileParallelism: false`, a guess that T-14 may adjust). Both alias `@` to `src` and alias `server-only` to the stub `tests/utils/server-only-stub.ts`. Scripts: `test` = `vitest run --project unit` (no Docker), `test:db` = `vitest run --project db --passWithNoTests`, `test:coverage` = `vitest run --project unit --coverage` (v8, report only, no threshold). 31 unit tests exist (`src/lib/env.test.ts`, `src/db/rls.test.ts` mocking `./client` so nothing reaches Postgres, `src/app/api/health/route.test.ts`). Coverage baseline: statements 64.4%, branches 67.85%, functions 58.82%, lines 63.79%; `instrumentation.ts`, `/api/health/db` and `client.ts` are at 0% (DB-backed or startup only: T-15 to T-17 own them). Env tests use `vi.resetModules` + `vi.stubEnv` + dynamic import because the env modules validate at import. The tests were proven to fail by mutation (4 mutations, all reverted). The "no server-only variable in the client bundle" assertion is NOT in T-13 (needs a build artifact): it stays with T-37. There is no test README yet (T-14 starts it, T-40/T-42 finish it); `tests/db/.gitkeep` exists.
- **T-14 (done), harness facts for T-15, T-16, T-17, T-21, T-37, T-40:** helpers in `tests/utils/`: `asUser(claims, {tenantId}).run(fn)` and `asAnon().run(fn)` call the production `withRls`/`withAnonymousRls` (nothing re-implemented); `asAppBackendWithoutRls()` returns the app's private `getDb()` to prove skipping `withRls` is denied; `closeAppConnection()` and `closeAdmin()` must be called in `afterAll`; `adminSql()` is a privileged `postgres` connection for setup/teardown only; `createThrowawayTable({columns, rls, policies, grants})` creates `public.tmp_test_<hex>` with explicit GRANTs and policies (needed because T-11 removed default privileges) and `dropThrowawayTablesAfter("test" | "file")` drops them; `defineAccessMatrix` generates one `it` per case (deny = SQLSTATE 42501 or zero rows); `createTestUser`/`createTenant` are in-memory stubs that epic 002 replaces; `ids.ts` has `uniqueName`, `uniqueEmail`, `newId`; `tests/utils/local-env.mts` holds the non-secret local defaults (same as `.env.example`, no `.env.local` needed; real env vars override; `assertLocalDatabase` refuses non-loopback hosts). Global setup `db-global-setup.ts` fails fast (about 0.4 s, exit 1, "Is the local Supabase stack running? Start it with: pnpm db:start"), also for a wrong `app_backend` password (28P01, "run: pnpm db:reset"), and sweeps leftover `tmp_test_*` tables. `tests/db/harness.test.ts` (9 tests) passes; `tests/README.md` exists (prerequisites, commands, helpers, stack-down behavior, debugging). **Notes:** `getDb()` is `max: 1`, so "parallel calls on a small pool" (T-15 item 3) queue on one connection; for a genuinely larger pool build a second pooled `postgres` client in the test and do NOT change `client.ts`. Assert claims other than the forced `sub`/`role`. A GUC reads back `""` after a transaction. T-16 schema guard queries the catalog (`pg_class.relrowsecurity`, `pg_policies`), never the TS schema; the guard-of-the-guard test creates its policy-less table with `createThrowawayTable({rls:false})` and relies on the afterEach drop. `fileParallelism: false`; two simultaneous `test:db` runs on one stack are unsupported. Vitest prints "No test files found, exiting with code 0" when global setup aborts, but the real exit code is 1 (documented). `tsconfig.json` has `allowImportingTsExtensions` (noEmit already on) because `local-env.mts` is imported with its extension. **For T-37:** tests import the private `@/db/client`, so the boundary rules must exempt `tests/` (or another seam is needed). **Small follow-up (developer, any later config task such as T-37):** ESLint reports 2 warnings inside the gitignored `coverage/` output; add `coverage/` to the ESLint ignores.
- **T-15 (done), facts for T-16, T-18, T-19:** tests `tests/db/with-rls-context.test.ts` (real `getDb()`, pool size 1: ADR items 1, 2, 5, 7, anonymous variant, fail-closed without `withRls`) and `tests/db/with-rls-parallel.test.ts` (item 3: mocks only `@/db/client` with a pool of 8 so `withRls` runs unmodified on a real multi-connection pool; asserts more than one backend PID; also 20 calls over 8 connections and a failing call among 4 good ones). `pnpm test:db`: 47/47 in 3 files, twice in a row; `pnpm test`: 31/31. No defect found in `withRls`; `src/db/*` untouched. A 14-row mutation table (mutation -> tests that went red) is recorded in `tests/README.md` section "withRls context tests and mutation record (FND-T-15)"; every mutation of `src/db/rls.ts` turned the matching test red (an equivalent mutant of "skip UUID validation" was corrected to two real mutants). **For the architect (T-18):** the legacy GUC `request.jwt.claim.sub` set in `rls.ts` is load-bearing, not defensive: removing it breaks `auth.uid()` on this Supabase version (mutation "sub GUC never set"), so ADR 0003 must say it stays. The "default context reads `''`" assertions only hold once the GUCs have been defined on that connection; on a never-used connection PG returns NULL (a PG behavior note, not a defect; tests always run `withRls` first on the connection). Tests 4, 6, 8 (as a catalog check), 9 and 10 of the ADR list belong to T-16.
- **T-16 (done), facts for T-17 to T-20, T-21, T-37, epic 002:** `pnpm test:db` is 194/194 in 6 files, twice in a row. New: `tests/db/tenant-isolation.test.ts` (109 tests on throwaway tables `memberships`, `items`, `scoped`: matrix of user A, user B, a member of both tenants, a valid user with no membership, anonymous with/without grant, across select/insert/update/delete; attacks: unfiltered select, tampered tenant id on INSERT/multi-row INSERT/UPDATE, `ON CONFLICT DO UPDATE` hijack, forged `service_role`/tenant claims, forged selector, membership removal effective on the next call, no self-insert into `memberships`), `tests/db/app-backend-role.test.ts` (24 tests from the catalog; also `SET ROLE` escalations from inside `withRls` fail and the connection stays usable), `tests/db/schema-guard.test.ts` (14 tests) and `tests/utils/schema-guard.ts` (`findUnguardedPublicTables`: catalog based, `pg_class.relrowsecurity` + `pg_policies`, empty `SCHEMA_GUARD_ALLOWLIST`; self-tests prove it reports RLS off, RLS on without policy, policy with RLS off, partitioned tables, and honors the allowlist). Mutation table in `tests/README.md` section "Isolation, role model and schema guard (FND-T-16)" (about 45 mutations; two survived at first, both test gaps that were fixed: `RETURNING` masking a weak `WITH CHECK`, and partitioned tables). No defect in the migration or `withRls`; no production code touched. **Numbering:** ADR 0003's list and the task brief number tests differently; T-16 covered the brief's 4, 6, 8, 9 plus the FND-FR-22 guard; the ADR's own item 10 (lint fixture) belongs to T-38. **Not covered by a test:** a Data API check (HTTP, not a DB property; verified manually in T-06/T-08): T-19 should judge whether to add an automated check. **Notes:** the guard on the real schema relies on `fileParallelism: false`; the guard covers tables only (FND-FR-22): add a view check (`security_invoker`) when epic 002 introduces views, and it does not require FORCE RLS (not needed: `app_backend` owns nothing); PUBLIC-readable `pg_stat_statements` views in `extensions` are exempted; facts are local PG 17 only (cloud untested); an INSERT with `RETURNING` also needs a passing SELECT policy (policy templates for epic 002); there is no `psql` on the host (privileged mutations used `docker exec` as `supabase_admin`).
- **T-17 (done), facts for T-19, T-21, T-24, T-33, T-40:** pinned `@playwright/test` 1.65.0 and `@axe-core/playwright` 4.14.0; Chromium only (`pnpm exec playwright install chromium`, cached in `~/Library/Caches/ms-playwright`, outside the repo). `playwright.config.ts`: `testDir` `tests/e2e`, `testMatch` `**/*.spec.ts`, trace `on-first-retry`, CI 2 retries and local 0, list + html reporters; `webServer` runs `pnpm build && pnpm exec next start --port 3100` (`E2E_PORT` overrides), waits on `/api/health`, never reuses an existing server, sets the three `NEXT_PUBLIC_*` variables from `.env.example` and removes `DATABASE_URL`/`DATABASE_MIGRATION_URL`. **If `E2E_BASE_URL` is set, no server is started and nothing is built**: this is the mode T-24 reuses for the post-deploy hello-world check (`E2E_BASE_URL=<url> pnpm exec playwright test tests/e2e/health.spec.ts`). Tests: `tests/e2e/home.spec.ts` (5: 200 + h1 "Next.js Starter" + no console/page errors; axe with wcag2a/2aa/21a/21aa/22aa in light and dark; no horizontal scroll at 375 and 1280 px) and `tests/e2e/health.spec.ts` (`/api/health` 200 `{"status":"ok"}`). `pnpm test:e2e`: 6 passed (about 5 s once built). Mutation proofs (6, all red as expected) are in `tests/README.md`. `.gitignore` gained `blob-report/` and `playwright/.cache/`. **For CI (T-21):** run `pnpm exec playwright install --with-deps chromium` and set `CI=1`. **For T-33:** add `/design` to the axe tests; the dark-mode axe test passes trivially until the home page has dark styling. The Playwright webServer inherits the caller's environment minus the two DB variables.
- **T-18 (done), architect verdict PASS, no blockers** (commit b8db556; ADRs 0001-0004 and `docs/architecture.md` updated to match reality): the PO's decisions are faithfully implemented; isolation is fail-closed by role design. Verified by the architect on the real stack: `db:reset` + `db:schema` + `git diff --exit-code src/db` is clean; `test:db` 194/194; `RESET ROLE` returns to `app_backend` (no privileges), `SET ROLE postgres/service_role` and `SET SESSION AUTHORIZATION postgres` fail with 42501; `auth.uid()` reads `request.jwt.claim.sub` first (the legacy GUC is load-bearing); Data API off (`/rest/v1/` and `/graphql/v1` 503; Storage and Realtime remain on locally with an empty `supabase_realtime` publication). **New evidence: the whole `test:db` suite (194) passes through the local Supavisor pooler in transaction mode (port 54329, `prepare: false`)**, config reverted afterwards. **Should-fix items became tasks T-50/T-51** (decision of the orchestrator, same spirit as FND-FR-08): (1) no statement/idle-in-transaction timeout inside `withRls` (role-level settings of `authenticated`/`anon` apply at login, not on `SET ROLE`; recommended `alter role app_backend set statement_timeout = '8s'` + idle timeout, with a catalog test); (2) function default privileges not revoked (a function created by `postgres` in `public` is executable by anon/authenticated/PUBLIC; epic 002 `SECURITY DEFINER` helpers then need explicit `revoke execute ... from public, anon` and `grant ... to authenticated`); (3) no test asserts that `anon` has no privileges on `public` tables/sequences (the schema guard checks RLS and policies, not grants). **Rules and notes recorded in ADR 0003 for epic 002 and later tasks:** nested `withRls`, or any `getDb()` query inside a callback, deadlocks on `max: 1` (documented, cannot be linted); `withRls` validates only that `tenantId` is non-empty, so epic 002 policies must read it as `nullif(current_setting('app.current_tenant', true), '')::uuid` to fail closed; a callback can run arbitrary SQL including `set_config('request.jwt.claims', ...)`, so T-37 should restrict `sql.raw` to `src/db/rls.ts` and raw SQL with request input stays forbidden; `/api/health/db` is unauthenticated and opens a transaction per request (fine for an MVP); the drift check compares tracked files only (the wrapper always writes the same two file names, so it holds); epic 002 must not add tables to the `supabase_realtime` publication without a decision; never use `--include-seed` or `db reset --linked` against a cloud project (`seed.sql` sets the local-only `app_backend` password). **Left as optional (PO/architect later):** disabling Realtime/Storage in `config.toml` as hardening. **Re-verify when a cloud project exists:** Postgres major 17; `CREATE ROLE app_backend ... NOBYPASSRLS` and `GRANT ... WITH INHERIT FALSE, SET TRUE` allowed for the cloud `postgres` role (supautils); password set manually and pooler username `app_backend.<project-ref>`; SSL (`client.ts` passes no `ssl` option, so the URL needs `?sslmode=require`; confirm postgres.js honors it); transaction pooler on port 6543 with the full `test:db` suite including parallel contexts and connection saturation with `max: 1` per Vercel instance; timeouts in effect; default privileges for tables and functions match local, including the `supabase_admin` residual case; Data API toggle off in the dashboard; Realtime publication empty; no `--include-seed` on cloud. **T-37 allowances (ADR 0001):** `env.server.ts`, the `NEXT_RUNTIME` read in `src/instrumentation.ts`, exactly `src/app/api/health/db/route.ts` as the one `app` file allowed to import `@/db` (T-38 must test it), `tests/` exempt from the raw-client restriction, `sql.raw` only in `src/db/rls.ts`, generated schema files excluded from lint and Prettier.
- **T-50 (done), facts for T-51, T-19, T-41, epic 002:** new migration `supabase/migrations/20261112130000_app_backend_timeouts_function_privileges.sql` (the first one is untouched): `alter role app_backend set statement_timeout = '8s'` and `set idle_in_transaction_session_timeout = '10s'` (10s because `withRls` transactions only wait on the database, so an idle transaction means a stuck callback pinning the single `max: 1` connection); `alter default privileges for role postgres revoke execute on functions from public` (deliberately NOT schema-scoped: the PUBLIC EXECUTE entry is the built-in global default and a schema-scoped revoke cannot remove it; side effect: postgres-owned functions in every schema lose default EXECUTE for PUBLIC, which is the intended fail-closed behavior) and `alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated` (`service_role` keeps EXECUTE by Supabase default). Evidence (PG 17 local): `rolconfig` of `app_backend` is `{statement_timeout=8s,idle_in_transaction_session_timeout=10s}` (`authenticated` 8s, `anon` 3s unchanged); inside `withRls` `show statement_timeout` is `8s`, idle `10s`, and `pg_sleep(10)` is cancelled after about 8 s with SQLSTATE 57014; the same through the Supavisor transaction pooler (`[db.pooler]` enabled temporarily and reverted); `withAnonymousRls` also shows 8s because the login role's setting persists after `SET LOCAL ROLE anon`, so the `set_config` fallback in `withRls` was not needed and `src/db` is unchanged. Function privileges: before, a function created by `postgres` in `public` had `proacl` `{=X/postgres,postgres=X,anon=X,authenticated=X,service_role=X}`; after, `{postgres=X/postgres,service_role=X/postgres}` (no PUBLIC entry); a function in a new throwaway schema has `{postgres=X/postgres}`. **Local pooler username:** `app_backend.pooler-dev` on port 54329 (the local tenant id is `pooler-dev`; `app_backend.nextjs-starter` does not work): useful for T-51 and the README. The `supabase_admin` defaults still auto-grant functions (as for tables) and cannot be changed from `postgres`. ADR 0003 small edit: function-privileges bullet describes the revoke; Open issues 1 and 2 marked resolved in T-50 (catalog test left to T-51). Re-verify on a cloud project that role-level settings and default-privilege revokes are allowed for the cloud `postgres` role. All 194 existing tests pass unchanged.
- **T-51 (done), facts for T-19, T-21, T-40:** `tests/db/hardening-catalog.test.ts` (18 tests) covers: `rolconfig` of `app_backend` exactly `statement_timeout=8s` and `idle_in_transaction_session_timeout=10s`, effective inside `withRls` and `withAnonymousRls`, `pg_sleep(9)` cancelled with 57014 (this test takes about 8 s; the idle timeout is checked in the catalog and as effective value but not waited out); function privileges (a function created by `postgres` in `public` is executable only by `postgres` and `service_role`, one in a new schema only by `postgres`, anon/authenticated calls fail with 42501 and authenticated works after an explicit grant); table/sequence/column/view grants (the real-schema scan finds no anon privilege in `public`, excluding `tmp_test_*`, with a granted control table proving it is not vacuous; tables and identity sequences created without grants are closed to anon and authenticated); the known residual case pinned as current behavior (a table created as `supabase_admin` is still granted to anon; the test says to remove it when it fails; it connects as `supabase_admin` over loopback only, which depends on the local `supabase_admin` password being `postgres`); and the Data API check (`GET /rest/v1/` not 2xx, no OpenAPI document, about 50 ms, 503 today; it sends the public local demo anon key on purpose so an enabled API would answer non-401). Mutation table in `tests/README.md` section "Hardening catalog tests (FND-T-51)" (including `[api] enabled = true` making the Data API test red). `pnpm test:db`: 212/212 in 7 files, twice in a row. The real `public` schema has no tables yet, so the real-schema grant scan only becomes meaningful when epic 002 adds tables; until then the default-privilege tests protect it. Nothing was run against a cloud project. No defect found; `src/` and migrations untouched.
- **T-19 (done), verdict PASS, no blockers** (commit 876ce98; report `verification/step-3-4.md`): fresh clone; 212/212 `test:db` twice, 31/31 unit, 6/6 E2E, `db:schema` stable, health endpoints behave (production: `/api/health` 200 always; `/api/health/db` 200 with the DB up and 503 `{"status":"unavailable"}` down or unset, no connection details; dev: same; unset `DATABASE_*` makes dev fail at startup by step-1 design). **Sabotage: 19 of 19 caught, none escaped** (non-local `set_config`, no `set local role`, connect as `postgres`, policy-less table, dropped policy, default grants to anon, default function EXECUTE, no timeouts migration, Data API on, non-UUID user id, swallowed errors, plus extras). `pnpm test` (unit) alone catches only input validation: **every behavioural mutation is caught only by `test:db`, so CI (T-21) must keep `test:db` blocking.** **Defects/gaps and who handles them:** D1 (db:schema deletes tracked files when `DATABASE_MIGRATION_URL` is missing) and G2 (`--passWithNoTests`) and the ESLint `coverage/` ignore: **T-52**; G1 (no automated test for `/api/health/db` no-leak) and G3 (Data API test depends on the running stack, not on `config.toml`): **T-53**; D2 (stale text in ADR 0003: "Residual risks" says timeouts are not applied, "Open issue 3" says no anon-grant test exists; both fixed by T-50/T-51) and D3 (`docs/architecture.md` lists `lib/supabase/`, which does not exist): **the architect in T-36/T-43**; G4 (`tests/db/hardening-catalog.test.ts` line 43 contains Supabase's public demo anon JWT, which gitleaks may flag): **T-22** (run gitleaks locally and, if it flags it, add a narrow allowlist or build the key at runtime from the local `supabase status`/env, never allowlist broadly); CI (T-21) must set `DATABASE_MIGRATION_URL` for `db:schema`. Unverified observations: a dev-HMR pool-leak hypothesis for `getDb()`; the 10 s idle timeout is checked only in catalog and as effective value. **Bypass review:** a Server Component that imports `@/db/client` and calls `getDb()` (even with `sql.raw`) passes lint/typecheck/build today because the boundary rules arrive in T-37 (harmless for data because `app_backend` is fail-closed); a client component importing `@/db` fails the build through `server-only`; nothing outside `src/db` uses `getDb`, `sql.raw` or supabase-js for data; no secrets tracked. **Do not start epic 002 module work before T-37.**
- **T-52 (done):** `scripts/db-schema.ts` is now `scripts/db-schema.mts` (removes the MODULE_TYPELESS warning without changing the package type; `tsconfig.json` includes `scripts/**/*.mts`). It validates `DATABASE_MIGRATION_URL` before touching anything (unset, empty, not a URL or not `postgres(ql):` exit 1 with a message pointing to `.env.local` / `.env.example`) and restores the previous `schema.ts`/`relations.ts` if `drizzle-kit pull` fails. `test:db` no longer has `--passWithNoTests` (it exits 1 when the glob matches nothing; `pnpm test` is unchanged). ESLint ignores `coverage/**` (`pnpm lint` now has 0 errors and 0 warnings). ADR 0002 and ADR 0004 had the script filename updated (filename only); ADR 0002 still does not describe the validate-and-restore behavior: **architect (T-36/T-43) folds that in; T-41 README must say `pnpm db:schema` needs `DATABASE_MIGRATION_URL` (`.env.local`)**. `pnpm test:db` 212/212 twice.
- **T-53 (done):** `src/app/api/health/db/route.test.ts` (unit, Docker-free, `@/db` mocked via `vi.hoisted`): 200 `{"status":"ok","role":"anon"}` through `withAnonymousRls`; 503 `{"status":"unavailable"}` for an `Error` and a non-`Error` rejection; with `postgresql://app_backend:secret@db.example.com:6543/postgres` in the thrown message and stack, neither the 503 body nor anything logged through `console.*` (serialized with `util.inspect`) contains the URL, `postgresql://`, `app_backend`, `secret`, `db.example.com` or `6543`; a failure is still logged; `force-dynamic` asserted. `src/app/api/health/db/data-api-config.test.ts` (unit): a section-aware parser asserts `supabase/config.toml` has `[api] enabled = false` (with self-checks: `enabled` in another section, commented keys and `[api.tls]` do not count). 9 mutations, all red (table in `tests/README.md`, section "`/api/health/db` and Data API config tests (FND-T-53)"; a first draft using `JSON.stringify` missed logging the raw error object and was fixed with `util.inspect`). `pnpm test` (Docker stopped) 54/54 in 5 files; `pnpm test:db` 212/212 twice; lint 0 errors and 0 warnings. The older "Not covered here" paragraph in the T-16 README section still says the Data API is only verified manually; the new section supersedes it (T-40 test README pass should tidy it).
- **T-20 (steps 3-4 accepted with notes, no rejected items):** see `acceptance/step-3-4.md`. The product-manager had no shell; the orchestrator ran the residual checks on the final state `5bd2401`: lint (0 errors, 0 warnings), typecheck, format:check, build; `pnpm test` 54/54 with the stack stopped; `test:db` 212/212 twice; `db:schema` + `git diff --exit-code src/db` clean; `test:e2e` 6/6; `db:schema` without `DATABASE_MIGRATION_URL` exits 1 and leaves `src/db` untouched; no AI trailers in the history; no supabase containers left. Accepted: FR-06, FR-08, FR-10, FR-11, FR-21, FR-22, NFR-02; accepted for what steps 3-4 own (rest deferred by design): FR-07 (CI drift check, T-21), FR-09 (lint half, T-37/T-38), FR-19 (test README finishing pass, T-40), FR-20 (`/design` axe check T-33, lint fixtures T-38); NFR-05 accepted with notes (secret scan and the permanent bundle assertion do not exist yet). Open points owed: T-21 (CI drift check, `DATABASE_MIGRATION_URL` and `NEXT_PUBLIC_*` set in CI, `test:db` BLOCKING); T-22 (Gitleaks and the demo anon JWT in `hardening-catalog.test.ts`); T-24 (no migration URL and no service-role key in the deploy job); T-33 (`/design` axe checks); T-36/T-43 (fold the `db:schema` validate-and-restore behavior into ADR 0002, fix stale ADR 0003 text at about line 91 and Open issue 3, remove `lib/supabase/` from `docs/architecture.md`, add the ADR 0004 env-split note, record the cloud re-verification list); T-37/T-38 (boundary lint and fixtures, including the health-route exception); T-40 (test README finishing pass; the older "not covered here" paragraph of the T-16 section); T-41 (project README: `.env.local` for `db:schema`, local pooler username `app_backend.pooler-dev`, never `--include-seed` against a cloud project, Node 26 and no corepack). **No epic 002 module work before T-37.** Spec change log updated for T-49 to T-53.
- **T-21 (done), facts for T-22 to T-27, T-41, epic 002:** `.github/workflows/ci.yml` (commit 664fd33): `on: push`, concurrency `ci-${{ github.ref }}` with cancel-in-progress, `permissions: contents: read`, the three `NEXT_PUBLIC_*` placeholders at workflow level (same values as `.env.example`). Job `fast` "Fast checks (blocking)" (no Docker, 15 min): `pnpm install --frozen-lockfile`, lint, typecheck, format:check (added by the developer), test, build. Job `database-and-e2e` "Database and E2E (blocking)" (30 min, no `needs`; sets the local `DATABASE_MIGRATION_URL` and `CI=1`): `pnpm db:start -x ...`, `db:reset`, drift check (`pnpm db:schema` then `git diff --exit-code src/db`), `pnpm test:db` (blocking; the only job that catches behavioural regressions), Playwright browser cache, `pnpm exec playwright install --with-deps chromium`, `pnpm test:e2e`, artifact `playwright-report/` + `test-results/` on failure (7 days), `pnpm db:stop` with `if: always()`. Node comes from `.nvmrc` through setup-node with `cache: pnpm`; pnpm from `pnpm/action-setup` reading `packageManager` (12.18.0), no corepack. **Actions are pinned by full commit SHA** (release in a comment): checkout v7.0.1 `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node v7.1.0 `949feb2413d6458794dcd2491c4babbbce0c15c1`, pnpm/action-setup v6.1.1 `73e46992e05b19abd31f2f3c20e0e7370d762115`, cache v6.1.0 `55cc8345863c7cc4c66a329aec7e433d2d1c52a9`, upload-artifact v7.0.2 `cf430e030ddbb5b0abf93d22962f4752f3646cd9`. **Kong cannot be excluded** from the CI stack: the test "FND-FR-08: /rest/v1/ ... is not served" needs Kong (without it it gets ECONNREFUSED instead of 503). The excluded services are `gotrue,realtime,storage-api,imgproxy,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`; **epic 002 must remove `gotrue` from that exclusion list when it needs Auth in CI.** Validated with `actionlint` 1.7.12 (installed with Homebrew; exit 0) and a full local dry run in workflow order (212/212, 6/6, drift clean). **Not provable until the first push:** that `pnpm db:start -x ...` and the Supabase image pulls work on `ubuntu-latest` (images are not cached), that `playwright install --with-deps` and its cache behave, that `.nvmrc` `26` resolves to a Node satisfying `engines >=26.13.1`, and that the artifact uploads. README badge owed to T-41.
- **T-22 (done), facts for T-23 to T-27, T-41:** commit c1d905f adds to `.github/workflows/ci.yml` the job `secret-scan` "Secret scan (blocking)" (no `needs`, `fetch-depth: 0`, downloads the Gitleaks BINARY v8.30.1 `gitleaks_8.30.1_linux_x64.tar.gz`, verifies `sha256sum --check` against the hard-coded `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb` taken from the official checksums file, runs `gitleaks detect --source . --log-opts=--all --redact --verbose`) and the job `audit` "Dependency audit (informational)" (`pnpm audit`, `continue-on-error: true`, output visible, no install). `.github/dependabot.yml`: npm and github-actions, weekly on Mondays, open PRs capped at 3 (npm) and 2 (actions), npm minor/patch grouped in one PR and majors one each, actions grouped, prefixes `chore(deps)` and `ci`; Dependabot opens PRs: the PO merges or ignores them; it becomes active once the file is on `main` on GitHub. `.gitleaks.toml` extends the default rules and attaches one allowlist to the `jwt` rule only, requiring BOTH the path `(^|/)tests/db/hardening-catalog\.test\.ts$` AND the exact public Supabase demo token regex (`condition = "AND"`; a top-level `[[allowlists]]` with a path would have skipped the whole file for every rule). The JWT literal could not be removed from history (already committed in 45e95fc and history must not be rewritten). Local scans: history (30 commits) and tracked tree clean after the config; `.env.example` and `tests/utils/local-env.mts` are not flagged. Negative proofs (scratch dirs, deleted): a fake AWS key makes Gitleaks exit 1; a different JWT or a fake AWS key in the allowlisted path, or the demo token in another path, are still reported. `pnpm audit` locally exits 1 with 2 moderate transitive findings (esbuild via drizzle-kit, minimatch via eslint-config-next): why the job is informational. `actionlint` exit 0; Dependabot file valid against the schemastore schema. **Maintenance:** Gitleaks is pinned by `GITLEAKS_VERSION` plus hash in the workflow; Dependabot does not track a binary downloaded by `curl`, so bump both together. **Not provable until the first run:** the Gitleaks download/checksum step on `ubuntu-latest`, `pnpm audit` registry access on the runner. **T-41 README** must state that a pushed secret must be rotated (not just removed), and how failures are noticed (badge, GitHub failure email).
- **First real CI run (orchestrator, after T-22):** the PO authorized pushes; the push of `ddf7210` triggered run `43336680336` on https://github.com/hgonza81/nextjs-starter: conclusion success; `Fast checks (blocking)` success (about 45 s), `Database and E2E (blocking)` success (about 2 min 27 s), `Secret scan (blocking)` success (about 4 s), `Dependency audit (informational)` failure as designed (`continue-on-error`, so the run is green). This proves on `ubuntu-latest`: the Gitleaks download and checksum step, the Supabase stack start with the excluded-services list, the drift check, `test:db`, Playwright and the E2E, and the pinned actions. Dependabot also started two dynamic runs (`npm_and_yarn` and `github_actions`).
- **T-23 (done), verdict PASS, no defects** (commit 02a5cbf; report `verification/step-5.md`): workflow design verified (push only, per-ref concurrency, `contents: read`, `timeout-minutes` on all 4 jobs, `continue-on-error` only on `audit`, no `secrets.` and no deploy job yet); all 5 action SHAs match their stated tags via `gh api` and are the latest releases; Gitleaks checksum equals the official one; real run 43336680336 evidence: 54/54 unit, `test:db` 212 in 7 files, E2E 6 with no retries, drift check ran, Node v26.13.1, pnpm 12.18.0, Gitleaks scanned 32 commits with no leaks, audit shows 2 moderate transitive findings, artifact step skipped on success, caches created but not yet restored; a fresh clone with no Docker and no `.env.local` passes install/lint/typecheck/format:check/test/build. **Risks the deploy task (T-24) MUST handle:** R1 `push` also fires on tags and Dependabot branches, so the deploy job needs `if: github.ref == 'refs/heads/main'` (and should not run on tag pushes); R2 `cancel-in-progress` could cancel a deploy mid-run, so the deploy job needs its own concurrency group with cancel off; R3 deploy must `needs` ALL THREE blocking jobs (`fast`, `database-and-e2e`, `secret-scan`) and must NOT list `audit` (its result is `failure`; if `needs` includes it the deploy would be skipped, and if the deploy has `if: success()` semantics check how `needs` of a failed job behaves). **Other notes:** R4 CI starts Supabase with 12 services excluded so Auth is not exercised in CI (epic 002 removes `gotrue` from the list); R5 the drift check is near-vacuous with 0 tables; R6/R7 `ubuntu-latest` is already `ubuntu-26.04`, Supabase images are pulled every run (about 54 s) so a registry outage can cause a false red, `pnpm audit` depends on the live advisory database; R8 the two jobs share a pnpm cache key (a harmless "Failed to save: Unable to reserve cache" appeared once); R9 about 3.5 job-minutes per push (free on a public repo). Playwright system dependencies are reinstalled every run (about 19 s; only browsers are cached). Cache restore and artifact upload are unproven until another run. **Decisions taken by the orchestrator (recommendations of the tester):** keep the reduced Supabase stack in CI; keep CI on Dependabot branches as long as T-24 restricts deploy to `main`.
- **T-24 (done), facts for T-25 to T-27, T-46, T-47, T-41:** commit a55dba5. `vercel.json` (`$schema`, `git.deploymentEnabled: false`: verified against Vercel docs, which resolves the ADR 0004 "not re-verified" note). Job `deploy` in `ci.yml`: `needs: [fast, database-and-e2e, secret-scan]` (NOT `audit`), `if: success() && github.ref == 'refs/heads/main'` (tags never deploy), own concurrency group `deploy-production` with `cancel-in-progress: false`, `permissions: contents: read`, `timeout-minutes: 15`, only the three `VERCEL_*` secrets, each passed only to the steps that call Vercel, no `DATABASE_*`/`SUPABASE_SERVICE_ROLE_KEY`/`DATABASE_MIGRATION_URL` in the job. **Workflow-level concurrency changed** to `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`: cancelling a run cancels all its jobs, so a job-level group alone would not protect a deploy; runs on `main` are now never cancelled (consecutive pushes to `main` run in sequence), other refs behave as before. Vercel CLI pinned as `pnpm dlx vercel@65.15.0` (variable `VERCEL_CLI_VERSION`; an exact devDependency was tried and reverted: +235 packages, +3,200 lockfile lines, 17 auto-added `minimumReleaseAgeExclude` entries; trade-off: only the top-level version is pinned, transitive deps are not locked, and Dependabot will not bump it). Steps: `preflight` (maps the three secrets to env, checks each is non-empty; if any is missing emits `::warning title=Deployment skipped::...` and a `$GITHUB_STEP_SUMMARY` line and sets `ready=false`, every later step has `if: steps.preflight.outputs.ready == 'true'`, so the job ends GREEN while secrets are missing; with all three present any failure fails the job), `vercel pull --yes --environment=production`, `vercel build --prod`, `vercel deploy --prebuilt --prod -e NEXT_PUBLIC_SUPABASE_URL=... -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... -e NEXT_PUBLIC_APP_URL=...` (runtime env; build env comes from the workflow-level placeholders; `NEXT_PUBLIC_APP_URL` keeps the placeholder `http://localhost:3000` because the deployed URL is unknown at build time and nothing reads it yet), then the post-deploy hello-world check `vercel curl "$URL/api/health" --yes -- --fail --silent --show-error --output file` compared with `{"status":"ok"}`, up to 5 attempts 5 s apart (chosen over plain `curl` because Vercel Deployment Protection may return 401 on the unique deployment URL; `vercel curl` adds the bypass itself with the same token; no browser needed). `actionlint` clean; the preflight logic was simulated in bash; the local equivalent (production build with only the three `NEXT_PUBLIC_*` values, `pnpm start`, curl `/api/health`) passed. **Only provable after the PO adds `VERCEL_TOKEN` and the first deploy:** that `pull --yes` works with only org/project env vars and no local `.vercel`; `vercel build --prod` on the runner; that `deploy --prebuilt -e` satisfies the instrumentation check at runtime; `vercel curl` and its automatic bypass; the effect of the workflow-level concurrency change on `main`. ADR 0004 line 46 still says the Vercel flow was not re-verified: **architect (T-26) updates it.** If the Vercel project also defines `NEXT_PUBLIC_*` variables they are used at build and the `-e` values apply at runtime.
- **T-25 (done), verdict PASS with one low defect** (commit 4fd8f10; report `verification/step-6.md`): job graph correct (`deploy` needs exactly `fast`, `database-and-e2e`, `secret-scan`; a failed or skipped needed job skips the deploy; `audit` is irrelevant); concurrency valid (two quick pushes to `main`: push 1 runs as A, push 2 queues as B, push 3 cancels B and queues C; A finishes in full including its deploy, C runs after; the middle commit gets no run of its own but C includes it); only the three `VERCEL_*` secrets referenced and never echoed; preflight simulated for all 8 combinations (any missing: warning, summary line, `ready=false`; all present: `ready=true`; all 7 later steps guarded); post-deploy check simulated against a clean build (right body passes on attempt 1; wrong body, HTTP 500 and a dead port each fail after 5 attempts); `vercel.json` and CLI 65.15.0 flags verified; `actionlint` clean; FND-FR-03 holds (production build without DB variables succeeds, `/api/health` returns the known body, `/api/health/db` returns 503 without crashing; the same build without the public variables fails clearly). **D1 (low):** `vercel deploy -e` deprecated: fixed in T-54. **Judgments decided by the orchestrator (tester's recommendations):** J1 the deploy job ends green with only a warning while secrets are missing, so a green badge does not mean "deployed": keep until the three secrets exist, then T-46 considers making it fail-loud; J2 the health check runs after `--prod` has already promoted the deployment, so a bad build would serve traffic with no rollback: accepted for hello-world (option for later: `deploy --skip-domain`, check, then `vercel promote`); J3 only the top-level Vercel CLI version is pinned: accepted; J4 runs on `main` queue instead of cancel: accepted. **Unproven until the first real deploy:** `vercel pull --yes` with only the three env vars and no `.vercel/`; `vercel build --prod` on the runner; `deploy --prebuilt --env` output and runtime env; `vercel curl` with a full URL and the Deployment Protection bypass; real queue behavior on consecutive pushes to `main`; a real red blocking job preventing the deploy (T-47); `pnpm dlx` of the CLI on a cold runner under the `minimumReleaseAge` policy. `NEXT_PUBLIC_APP_URL` is still the `localhost` placeholder and must be replaced before any feature reads it; the `--env` values are non-sensitive placeholders.
- **T-54 (done):** commit 761a89d replaces the three `-e` with `--env` in the deploy command of `ci.yml` (3 insertions, 3 deletions, nothing else). The agent's final report arrived empty ("pending"), so the orchestrator verified the result directly: diff limited to those lines, no `-e ` flag left, `actionlint` exit 0, no AI trailers in the history.
- **T-26 (done), architect verdict PASS, no blockers** (commit 2e9c386; edited `docs/adr/0004-env-and-secrets.md`, whose Deployment and Gitleaks bullets were rewritten and an "Amendment (FND-T-26)" added, and `docs/architecture.md`, whose Deployment paragraph became a CI/CD section with the job table, concurrency design and Gitleaks maintenance rule; no new ADR, deployment is a two-way door). **Should-fix S1:** Dependabot npm updates are inert: run 43336683433 failed with `ERR_PNPM_UNSUPPORTED_ENGINE` (Dependabot's updater runs Node 24.22.3 against `engines >=26.13.1 <27` and `engineStrict: true`); github-actions works. **Decision (orchestrator, architect's option c):** task T-55 removes the npm ecosystem from `dependabot.yml` and documents manual dependency updates; `engineStrict` and the Node floor stay (FND-FR-02); T-41 README must say dependencies are updated manually and `pnpm audit` in CI is informational; revisit when Dependabot's updater supports Node 26. **Notes recorded in ADR 0004 / architecture:** fork and Dependabot exposure (no `pull_request` trigger, so a fork PR starts no run; Dependabot-triggered runs get only Dependabot secrets and a read-only token; secrets are referenced only inside the `deploy` job, `main` only; never add `pull_request_target`); write-access residual (anyone with write access or a stolen PAT can push a branch whose workflow reads the three `VERCEL_*` secrets because repo secrets are not branch-scoped; `main` is unprotected and the default workflow token is read-only); `pnpm dlx vercel` transitive dependencies unlocked while the job holds `VERCEL_TOKEN` (accepted for the MVP, revisit before real users); `minimumReleaseAge` not set explicitly in the repo; J1 is LIVE (only `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` exist, so every push to `main` ends with the deploy job green and skipped); J2 promote-before-check accepted; `NEXT_PUBLIC_APP_URL=http://localhost:3000` must be replaced before epic 002 auth redirects/emails; reduced CI stack covers only Postgres and Kong (no gotrue, Realtime, Storage, PostgREST); Gitleaks runs with `--redact`; Playwright artifacts kept 7 days on failure (in epic 002 traces must contain only test users); Node 26 is available on Vercel; `vercel curl --fail` is the equivalent of the spec's `curl --fail`. **Suggestions NOT in scope, for the PO to consider later:** (1) put the three secrets in a GitHub Environment `production` restricted to `main` (add `environment:` to the deploy job) to remove the write-access residual; (2) a branch ruleset on `main` blocking force-push and deletion (required checks conflict with the solo push-to-main workflow); (3) set `minimumReleaseAge` explicitly in `pnpm-workspace.yaml`; (4) pin the Vercel CLI as a devDependency or a checksum-verified binary once real users exist. **Epic 002 must add to CI:** remove `gotrue` from the `-x` list (re-check the Kong 503 test); real DB tests for the real policies and grants kept in `test:db` as blocking; Auth-flow E2E against the real gotrue (mailpit/inbucket decision for email flows); a migration check (forward-only, applies cleanly from scratch, drift check then meaningful); a decision on preview deployments (would need a GitHub Environment and non-production secrets); a decision on a cloud Supabase project and its secrets (`DATABASE_URL` as the pooler URL in Vercel env, real `NEXT_PUBLIC_*` values and `NEXT_PUBLIC_APP_URL`, `DATABASE_MIGRATION_URL` never on Vercel; a migration-apply-to-cloud step needs its own secret and job); check that a Secret-type `DATABASE_URL` behaves with `vercel pull`/`build`. **Unproven until the first real deploy:** `vercel pull --yes` with only the three env vars and no `.vercel/`; `vercel build --prod` on the runner; `deploy --prebuilt --env` prints only the URL and the runtime env satisfies `instrumentation.ts` and `next.config.ts`; `vercel curl` with a full URL and the Deployment Protection bypass; `pnpm dlx` of the CLI on a cold runner under the release-age policy; real queue behavior on consecutive pushes; that a red blocking job prevents the deploy (T-47); that the skipped-deploy run ends green with the warning and summary visible; cache restore on a second run and the artifact upload.
- **T-55 (done):** commit 459ee7e removes the `npm` entry from `.github/dependabot.yml` (kept `github-actions`, weekly, grouped, limit 2) with a header comment (the updater runs Node 24, the project enforces Node >=26.13.1 through `engineStrict` per FND-FR-02, every npm run failed with `ERR_PNPM_UNSUPPORTED_ENGINE`; npm dependencies are updated manually; `pnpm audit` in CI stays informational; how to re-add npm once the updater supports Node 26) and edits the "Known limits" paragraph of `docs/architecture.md`. ADR 0004 needed no edit. The file validates against the SchemaStore dependabot-2.0 schema. `engineStrict` and the Node floor are untouched.
