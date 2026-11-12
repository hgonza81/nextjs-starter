# 001 - Foundations: specification

**Status:** Approved (Product Owner, 2026-11-12); open items in section 17 use their defaults
**Epic:** 001-foundations. Next epic: 002-auth-memberships (depends on this one).
**Inputs:** `requirements.md`, `reviews/*` (rounds 1 and 2), `questions.md` (PO answers 2026-11-12 and round 2 confirmations; final).
**Requirement IDs:** high-level `FND-HR-xx` (in `requirements.md`, reworded below), spec level `FND-FR-xx` / `FND-NFR-xx`.

## 1. Goal

Deliver a working Next.js skeleton, a local Supabase database, a complete database access stack (Drizzle + RLS through one centralized function), a bounded design system, three test layers, and a CI/CD pipeline (GitHub Actions to Vercel), so that epic 002 and later feature epics start on a proven, enforced base. No users, tenants, memberships, application tables or business features exist in this epic.

## 2. Context and users

- Primary user: the Product Owner (PO), working alone on a single branch, and later developers who clone the starter.
- The app is expected to grow into an MVP with about 50 tables and full CRUD. This is why the ORM, the RLS access function, enforced module boundaries and CRUD UI conventions are decided now (PO decisions).
- Stack decided by the PO: Next.js (frontend + backend), Supabase Auth, Drizzle for PostgreSQL access, PostgreSQL RLS for tenant isolation.

## 3. Scope

### In scope

- Next.js skeleton with a styled home page; pnpm, pinned versions, strict TypeScript, lint/format.
- Typed and validated environment configuration; `.env.example`.
- Local Supabase (CLI + Docker), migrations folder, documented commands.
- Database access stack: Drizzle ORM, drizzle-kit, `supabase-js`, `@supabase/ssr`, Postgres driver, empty schema entry point, one migration workflow, drift check.
- Fail-closed database role model and the centralized `withRls` function, with its integration tests.
- `/api/health` (liveness) and `/api/health/db` (local/CI database reachability).
- Code structure conventions (domain modules, no repository layer) enforced by lint, proven by a test.
- Design system: tokens (light/dark following the system), the components epic 002 needs, a sidebar-ready app shell, a global toast provider, `/design` showcase, `docs/design-system.md` including documented-only CRUD patterns.
- Test tooling and one real passing test per layer (unit, DB/integration, E2E with axe), DB test harness, schema guard.
- GitHub Actions: CI (lint, typecheck, unit, DB, E2E, build, secret scan, dependency audit) and a deploy job to Vercel with a hello-world smoke test. Dependabot.
- Documentation: README (onboarding), `docs/architecture.md`, test README, ADRs 0001-0005.

### Out of scope / Won't do (with reason)

| Item | Reason |
|------|--------|
| Authentication, users, tenants, memberships, sign-up, login | Epic 002 |
| Any application table, Drizzle schema for modules, RLS policies on real tables | Epic 002 (001 has none; throwaway tables exist only inside tests) |
| Verification of the JWT and tenant (building the real `VerifiedContext`) | Needs auth and memberships (epic 002) |
| Auth-aware SSR/cookie clients, middleware, session handling | Auth work (epic 002); `@supabase/ssr` is only installed here |
| Cloud Supabase project, production database, pooler configuration | PO decision Q3: local only for now |
| Email sending | Not requested |
| Stripe / billing | Dropped by the PO; not mentioned or prepared |
| `supabase gen types` for data access, `service_role` key provisioning | One data path (Drizzle); nothing needs them (see ADR 0003) |
| Branches, pull requests, git hooks, Husky, commitlint | PO decision Q6 |
| Creating the GitHub repository, the Vercel project, token and GitHub secrets | PO actions, not tasks |
| Components beyond epic 002's needs (Table, Dialog/AlertDialog, Select, Dropdown, Tabs, Pagination, Badge, Textarea, Checkbox, Breadcrumb) | Added by the first epic that needs them (PO round 2 confirmation) |
| Storybook, visual regression tests, logo and illustrations, dark-mode toggle | Not requested; parked |
| i18n tooling | English only (AGENTS.md) |
| App Dockerfile, app in Docker Compose | App runs on the host; Docker only for Supabase |
| pgTAP, coverage threshold, ZAP/license scanning, CodeQL gating | Deferred (see Parking lot) |
| Sample business features | FND-HR-01 |

## 4. Glossary

| Term | Definition |
|------|------------|
| Tenant | A company. Named `tenant` in code and database, "company" in the UI. Defined and built in 002. |
| Module | A domain folder `src/modules/<name>/` exposing a public API through `index.ts`; other code may import only that file. |
| Security context | The role and JWT claims under which a database transaction runs, so that RLS policies evaluate as the calling user. |
| `withRls` (RLS context function) | The single function that opens a transaction, sets the transaction-local security context (role and claims) and runs the callback with that transaction. All application database work goes through it. |
| `VerifiedContext` | The input type of `withRls` (user id, claims, optional tenant id). Constructed only by server code after the JWT (and, for tenant, a membership check) is verified. In 001 only the type, the function and a test helper exist. |
| `app_backend` | The dedicated login role the app connects as: not superuser, no `BYPASSRLS`, no table privileges, may only switch to `authenticated` and `anon`. A query outside `withRls` therefore fails closed. |
| Migration source of truth | Hand-written SQL in `supabase/migrations/`, applied by the Supabase CLI. The Drizzle schema is generated from the database (`drizzle-kit pull`), never the other way round. |
| Drift check | CI step: after `supabase db reset`, regenerate the Drizzle schema and fail on any git diff. |
| Liveness health | `/api/health`: reports that the app is up; touches no database; used by the deployed hello-world test. |
| DB health | `/api/health/db`: reaches the local database through `withRls`; used locally, in CI and in E2E; not deployed-checked. |
| Hello-world test | (a) Pre-deploy: E2E checks the home page of a production build renders a known heading. (b) Post-deploy: one HTTP check against the Vercel URL that `/api/health` returns 200 and a known body. |
| Blocking / informational | A blocking job turns the run red and stops deploy; an informational job reports only. |

## 5. Decisions taken

| # | Decision | Source | Record |
|---|----------|--------|--------|
| D1 | Domain modules with public API, no repository layer; lint-enforced boundaries | PO Q1, Q2 (recommendation) | `docs/adr/0001-code-structure-and-layering.md` |
| D2 | Supabase local via CLI + Docker, app on the host; no cloud project; SQL-first migrations, Drizzle schema derived by `drizzle-kit pull`, CI drift check | PO Q3 and round 2 | `docs/adr/0002-supabase-local-first-and-migrations.md` |
| D3 | **ORM is in** (PO override of "no ORM", 2026-11-12): Drizzle + drizzle-kit, `supabase-js`, `@supabase/ssr`, Postgres driver. Isolation = ORM + RLS via `withRls`; `app_backend` fail-closed role; verified claims only; `supabase-js` for Auth only | PO Q4 override; architect round 2 | `docs/adr/0003-drizzle-rls-data-access.md` |
| D4 | Typed env in `src/lib/env.ts`, `.env.example`, secret inventory (public vs server-only), Supabase client factories (Auth only) | Architect | `docs/adr/0004-env-and-secrets.md` |
| D5 | Tenant isolation direction for 002: shared schema + `tenant_id` + RLS + membership helpers; tenant setting is a selector, never a credential | Architect | `docs/adr/0005-tenant-isolation-direction.md` |
| D6 | **Deployment is in** (PO override, 2026-11-12): GitHub Actions CI and deploy to Vercel; deploy job only after all blocking CI jobs pass; Vercel Git auto-deploy disabled; only `VERCEL_*` secrets in GitHub | PO Q5 and round 2 | Short section in `docs/architecture.md` (two-way door, no ADR) |
| D7 | No branches, PRs, hooks or commitlint; workflows run on every push; failures fixed afterwards. Conventional Commits as a documented suggestion only | PO Q6 override | Spec |
| D8 | pnpm, current stable Next.js, active-LTS Node, all pinned (`packageManager`, `.nvmrc`/`engines`, lockfile) | PO Q6 (accepted part) | Spec |
| D9 | ESLint + Prettier; Zod; React Hook Form + Zod resolver | PO Q7 | Spec |
| D10 | Vitest + Playwright + `@axe-core/playwright`; Testing Library only where needed; coverage report-only; RLS tests via `withRls` (supersedes "through supabase-js") | PO Q8; tester/architect round 2 | Spec, test README |
| D11 | CI blocking: lint, typecheck, unit, DB/integration, E2E smoke, build, secret scan (Gitleaks); dependency audit informational; Dependabot on | PO Q9 (recommendation B) | Spec |
| D12 | Tailwind CSS + shadcn/ui (Radix), Lucide, one `next/font`; shadcn defaults, neutral theme, one placeholder accent (calm blue/indigo), text-only wordmark; no purchased template | PO Q10, Q12 | UI stack ADR is joint architect/ui-ux-designer; if written, linked from `docs/adr/` (not in the 0001-0005 set) |
| D13 | Design system bounded (option B): 002's components + `/design`; CRUD patterns documented only; `/design` hidden in production | PO Q11 and round 2 | `docs/design-system.md` |
| D14 | Light + dark following the system, no toggle; WCAG 2.2 AA and mobile-first in base components; English only | PO Q12 | Spec |
| D15 | Stripe dropped; billing not mentioned or prepared | PO Q13 override | Spec |

ADR filenames were checked against `docs/adr/` on 2026-11-12 and match. ADR contents were cross-checked against this spec when the tasks were written (see change log); the architect re-confirms them against the built result in task FND-T-18 and FND-T-43.

## 6. Reworded high-level requirements

These replace the wording of FND-HR-02, 03, 09, 10, 11 in `requirements.md` (which stays unchanged as the record of what the PO first said). Other FND-HR keep their original wording.

| ID | Wording |
|----|---------|
| FND-HR-02 | A **local** Supabase (Postgres) development environment is set up through the Supabase CLI (Docker is a documented prerequisite), with a migrations folder and documented start/stop/reset commands. No application tables, no authentication, no cloud Supabase project in this epic. |
| FND-HR-03 | The **database access stack** is installed, configured and proven working: Drizzle ORM and drizzle-kit, `supabase-js`, `@supabase/ssr`, a typed and validated environment configuration, and a schema/type generation command. A single centralized function runs database work inside a transaction in the user's security context (role `authenticated` plus JWT claims set per transaction), and its behavior is proven by automated tests. The app can reach the local database through a health check. Application tables, policies on real tables, and verification of the JWT and tenant belong to epic 002. |
| FND-HR-09 | **CI and CD** run on GitHub Actions on every push to the single working branch. CI runs lint, typecheck, tests (unit, integration, E2E smoke), build, a secret scan (blocking) and a dependency audit (informational). CD deploys to Vercel after CI passes, and a hello-world smoke test against the deployed URL proves the pipeline. Workflows live in the repository. There are no branches, pull requests, git hooks or commit-message tooling; a failing run is fixed afterwards. Creating the GitHub repository and the Vercel project and secrets is a PO action, not a task. |
| FND-HR-10 | The code is modular, readable, maintainable and testable, organized as domain modules with a public API and no repository layer, with conventions documented and enforced by automated lint rules (proven by a test that an illegal import is reported). The structure must stay clear as the app grows to about 50 tables with full CRUD: no huge folders. Module folders for auth/users/tenants are created in 002. |
| FND-HR-11 | Keep the epic to what is stated: no sample business features, no application tables, no speculative layers. Billing is not mentioned or prepared. Where this conflicts with an explicit PO decision (e.g. the ORM and full database stack), the PO decision prevails. |

## 7. Boundary with epic 002

| Item | 001 delivers | 002 delivers |
|------|--------------|--------------|
| Supabase CLI project, `supabase/` folder, local stack, migrations folder | Yes, plus the `app_backend` role/grants migration | First table migrations |
| Packages: drizzle-orm, drizzle-kit, supabase-js, @supabase/ssr, Postgres driver | Installed and configured (drizzle config, DB connection from validated env) | Uses them |
| Drizzle schema / app tables | None (empty schema entry point only) | Tenants, memberships, profiles, ... |
| Schema/type generation | Command and pipeline documented and working; output near-empty | Regenerated with real tables |
| `withRls` + `VerifiedContext` type | Implemented; claims are an input; proven with no app tables and a throwaway test table | Real constructor from the verified JWT and a membership-checked tenant; policies checking real membership; RLS tests on real tables |
| Supabase clients | `@supabase/ssr` and `supabase-js` installed; no auth-aware clients (architect may pre-create thin factories if ADR 0004 requires) | Auth-aware SSR/cookie clients, middleware, session handling |
| `auth`, `users`, `tenants` modules | Convention and boundary rule only; no empty folders | Created |
| Design system | Tokens, 002's components, app shell, toast provider, `/design`, CRUD patterns (docs only) | Uses them; adds components when needed and updates `/design` |
| Schema guard ("every `public` table has RLS and a policy") | Implemented in `test:db`; vacuous with zero tables, proven by a throwaway table | Becomes effective; allowlist maintained |
| Test harness and factories | `asUser(claims)` helper, role helpers, factory stubs | Completes factories; RLS allow/deny matrix |

Epic 002 requirements must be re-reviewed against this table (002's own README status already says "to be re-reviewed").

## 8. Functional requirements

Acceptance criteria are written so that each maps to an automated test or a documented command check. "Local" means a developer machine; "CI" means GitHub Actions.

### 8.1 Application and toolchain

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FND-FR-01 | The repository contains a Next.js App Router application, strict TypeScript (`strict`, `noUncheckedIndexedAccess`), `src/` directory and `@/` alias, with a home page and no user, tenant or business features. | Given a fresh clone after setup, When `pnpm dev` runs, Then the home page renders at `/`. Typecheck passes with zero errors. No route or code exists for auth, users, tenants, billing. |
| FND-FR-02 | The toolchain is pinned and reproducible: pnpm, current stable Next.js, active-LTS Node, lockfile; ESLint + Prettier; Zod and React Hook Form (+ Zod resolver) installed. | `packageManager`, `engines`/`.nvmrc` and lockfile exist and are committed. `pnpm lint`, `pnpm typecheck`, `pnpm format:check` exist and exit 0 on a clean tree. Installing with a different Node major is reported by `engines`. |
| FND-FR-03 | Environment variables are typed and validated in one place (`src/lib/env.ts`, Zod), with a committed `.env.example`. Public values use `NEXT_PUBLIC_` only for browser-safe values. Database variables are required in development/test and optional in production until a cloud database exists (documented). | Given a missing required variable in dev, When the app starts, Then it fails fast with a message naming the variable. Given production build on Vercel without DB variables, Then the build and `/api/health` succeed. `.env.example` lists every variable with no real secret. No server-only variable is exposed to the browser bundle (checked by a test or build assertion). |
| FND-FR-04 | Git hygiene exists for the project files: `.gitignore` covering env files and build output; no secrets committed. | `.env*` (except `.env.example`) is git-ignored. Secret scan (FND-FR-24) passes on the tree. |

### 8.2 Local database and database access stack

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FND-FR-05 | Local Supabase runs through the Supabase CLI with Docker (Docker Desktop, OrbStack or Colima documented as prerequisite), with a `supabase/` folder, `config.toml`, a migrations folder and package scripts to start, stop and reset. | Given Docker is running, When `pnpm db:start` then `pnpm db:reset` run, Then the stack starts and all migrations apply from scratch with exit 0. The README documents each command. `config.toml` has the Supabase Data API disabled (`[api] enabled = false`, Open item 2 default A; ADR 0003) and Auth still works locally. |
| FND-FR-06 | The database access stack is installed and configured: Drizzle ORM, drizzle-kit (`drizzle.config.ts`, `schemaFilter: ['public']`), Postgres driver, `supabase-js`, `@supabase/ssr`, with an empty schema entry point in `src/db/schema/`. No module schemas or tables. | `pnpm typecheck` passes importing the DB package. `src/db/schema/` contains only generated/entry files and no table definitions. No table exists in `public` after `db:reset`. |
| FND-FR-07 | One migration workflow: SQL migrations in `supabase/migrations/` are the single source of truth; the Drizzle schema is generated by `drizzle-kit pull` into `src/db/schema/` (committed, marked generated, not hand-edited). `drizzle-kit generate/migrate/push` are not used. | A documented command (`pnpm db:schema`) regenerates the schema. Given a fresh `db:reset`, When `db:schema` runs, Then `git diff` is empty (drift check). CI runs this check and fails on a diff. Behavior of `pull` for roles/policies is not yet verified (ADR 0002 says so); it is confirmed during implementation (FND-T-10, FND-T-18) and recorded in ADR 0002. |
| FND-FR-08 | A migration creates the fail-closed login role `app_backend` (LOGIN, NOSUPERUSER, NOBYPASSRLS, no privileges on app tables, only able to switch to `authenticated` and `anon`). Its password is set outside migrations (local setup script/seed; documented). The app `DATABASE_URL` uses it; migrations and drizzle-kit use a separate `DATABASE_MIGRATION_URL` that is never deployed. | `pg_roles` shows `app_backend` with `rolsuper = false`, `rolbypassrls = false`; it is not owner of any `public` object. Given a query run as `app_backend` outside `withRls` against a table with data, Then it is denied or returns zero rows (never data). |
| FND-FR-09 | A single centralized function `withRls(ctx, fn)` in `src/db/` opens a transaction, sets transaction-local claims (`set_config(..., true)`) and `set local role` to a hard-coded role (`authenticated`, or `anon` for the explicit anonymous variant, which needs no user id; never taken from the token), then runs `fn` with the transaction handle. The raw Drizzle client is not exported from `src/db/index.ts` (it exports `withRls`, schema and types). A `VerifiedContext` type documents that claims must come from a verified session. | See the test list in FND-FR-10. Lint (FND-FR-12) rejects importing the raw client outside `src/db/`. The function rejects missing/empty user id with an error and never falls back to a privileged role. |
| FND-FR-10 | The `withRls` behavior is proven by integration tests in `test:db`, run against the real local Postgres, as `app_backend`, through the same function production uses. | Tests exist and pass for: (1) inside the callback `current_user = 'authenticated'` and `auth.uid()` equals the supplied claim; (2) after commit and after rollback, the next transaction on the same connection has the default role and no claims (pool size 1 forces reuse); (3) N parallel calls with different users on a small pool each see only their own claims; (4) on a throwaway table (created in test setup, not in `supabase/migrations/`) with RLS and a membership-based policy: tenant A user cannot select/insert/update/delete tenant B rows, anonymous and no-membership users are denied, a tampered tenant id in the payload is rejected by `WITH CHECK`; (5) missing or empty user id is refused; (6) `app_backend` is not superuser, not `BYPASSRLS`, not table owner; (7) an error inside the callback rolls back and context is reset; (8) a query without `withRls` is denied; (9) a table created in a test setup without a policy returns zero rows. |
| FND-FR-11 | The app exposes `/api/health` (liveness, no database access) and `/api/health/db` (reaches the local database through `withRls`, e.g. `select current_user`). | Given the app runs, When `GET /api/health`, Then 200 with a known JSON body, even with no database. Given local Supabase is running, When `GET /api/health/db`, Then 200 reporting the DB reachable. Given the database is stopped, Then `/api/health/db` returns a non-200 status without exposing connection details. |

### 8.3 Structure and enforcement

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FND-FR-12 | Lint rules enforce the structure: (a) other code imports a module only through its `index.ts`; (b) `src/lib` does not import `src/modules`; (c) `src/db` does not import `src/modules`; `app` and UI components do not import `@/db` (data goes through module APIs), with one documented allowlist exception: the `/api/health/db` route handler, which has no module to call in this epic; (d) the raw DB client file is importable only inside `src/db`; (e) no import cycles; (f) `supabase-js` data calls (`.from()`, `.rpc()`) are restricted (one data path). Rules run in `pnpm lint` and in CI. Exact rule set and tooling per ADR 0001 and 0003. | For each rule there is a deliberately illegal fixture/test that the linter reports, run in the unit test layer. A legal import of the same shape passes. With no modules yet, rules are proven on fixtures only; no empty module folders are created. |
| FND-FR-13 | Conventions are documented in `docs/architecture.md`: layout (`app`, `modules/<name>/{actions,queries,schemas,components}`, `db`, `lib`), kebab-case files, named exports, `@/` alias, Server Components by default, mutations via Server Actions returning a typed result, Zod validation at the boundary, structured server-side error logging without PII, rule that all queries use the transaction passed by `withRls`. | The document exists, links ADRs 0001-0005, and each rule in FND-FR-12 is traceable to a documented convention. Reviewed by the architect. |

### 8.4 Design system and UI

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FND-FR-14 | Tailwind CSS and shadcn/ui (Radix) are set up with Lucide icons and one `next/font` font, starting from shadcn defaults with a neutral theme and one placeholder accent color and a text-only wordmark, changeable in one place. | The home page uses the theme. Changing the accent in the token file changes it app-wide (verified by review of one-place definition). No purchased template, no unused components in `src/components/ui`. |
| FND-FR-15 | Design tokens are defined as semantic CSS variables mapped into the Tailwind theme: color roles (incl. success/warning/info, destructive, ring), type scale, 4px spacing, radius, shadow, motion, breakpoints, density (comfortable 40px / compact 32px controls, 44px mobile touch targets, table row height). Light and dark values both defined; theme follows the system setting with no flash on load and no toggle. | Given the OS is set to dark, When the home page loads, Then dark tokens apply with no light flash (E2E with `colorScheme` emulation). Contrast for text and interactive roles meets WCAG 2.2 AA in both themes (checked by axe on `/design`). |
| FND-FR-16 | Base components exist, built from tokens only, with all states, both themes, keyboard operable: Button, Input, Label, FormField (control-agnostic: label, control, hint, error, `aria-describedby`, built on React Hook Form + Zod), Password input (show/hide), Alert, Card, Spinner/Skeleton, auth layout, and an app shell designed for growth (sidebar collapsible to a drawer on mobile, top bar with company name placeholder and user menu slot, page header, one nav item). A toast provider (Sonner) is mounted once in the root layout. | Each component appears on `/design` in every state and both themes. FormField shows an error associated with its control (`aria-describedby`, `aria-invalid`). App shell renders at mobile (375px) and desktop widths without horizontal page scroll. Toast provider mounted once; no other toast usage. |
| FND-FR-17 | A `/design` showcase page renders every component in every state in both themes, is not linked from product navigation, is available in development and CI/E2E and returns 404 in production. | Given a production build, When `GET /design`, Then 404 (checked in the deploy smoke or in E2E against a production-mode start). Given dev/CI mode, Then the page renders all components and the axe check passes with zero violations. |
| FND-FR-18 | `docs/design-system.md` documents tokens, components, the consistency rule ("no raw color/spacing values and no one-off components; add to the system first"), the Definition of Done for any component (tokens only, all states, both themes, keyboard operable, listed on `/design`, passes axe), tone guide (friendly, concise; UI term for tenant is "company"), and **documented-only** CRUD patterns: navigation, page templates, table pattern (server-side pagination/sort/filter, URL state, empty state, mobile fallback), forms (validation timing, server field errors), feedback (toast / inline Alert / AlertDialog), CRUD verbs. | The document exists with each section. No Table, Dialog, Select, Dropdown, Tabs, Pagination, Badge, Textarea, Checkbox or Breadcrumb component code is added in this epic. A lint or review check against raw hex colors and arbitrary Tailwind values is applied if feasible (developer/architect judge; not a blocker). |

### 8.5 Testing

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FND-FR-19 | Three test commands exist and pass from a clean clone: `pnpm test` (Vitest unit; no Docker needed), `pnpm test:db` (Vitest against local Supabase), `pnpm test:e2e` (Playwright against a production-like start, trace on first retry). Layout: unit colocated `*.test.ts`; `tests/db/`; `tests/e2e/`; shared helpers `tests/utils/`. | Each command exits 0 locally. `pnpm test` passes with Docker stopped. Each command is documented in a test README (prerequisites, debugging, reset command `pnpm db:reset`). Coverage is reported, no threshold. |
| FND-FR-20 | One real passing test exists per layer: unit (e.g. env validation or a utility), DB (FND-FR-10 and the harness), E2E (home page renders known heading, with `@axe-core/playwright` check, and `/design` axe check). | Tests assert behavior (not `expect(true)`). E2E fails if the home page heading is removed or an axe violation is introduced. |
| FND-FR-21 | The DB harness provides `asUser(claims)` (calls the production `withRls`, no re-implementation), role helpers (anon, authenticated with claims), factory stubs (`createTestUser`, `createTenant`) under `tests/utils/`, unique data per test, parallel-safe, and a table-driven pattern for allow/deny matrices. Test-only tables are created and dropped by test setup, never in `supabase/migrations/`. | A new test can be written using only these helpers. Running `test:db` twice in a row passes (no leftover state). |
| FND-FR-22 | A schema guard test in `test:db` asserts every table in `public` has RLS enabled and at least one policy, except an explicit allowlist. | With zero tables it passes; given a throwaway table without RLS, the guard fails (proven by a test of the guard). |

### 8.6 CI/CD, security and documentation

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| FND-FR-23 | A GitHub Actions workflow runs on every push (no `pull_request` trigger needed), with per-ref concurrency cancel. Job groups: (1) fast, no Docker: install, lint, typecheck, unit tests (incl. boundary-rule tests), build; (2) Docker + local Supabase: `db reset`, drift check, `test:db`, `test:e2e`; (3) secret scan; (4) dependency audit. Each job is labelled blocking or informational in the workflow. Playwright browsers and dependencies are cached. | Workflow files exist, pass `actionlint`, and run the same documented commands as local. After the first PO push, the run is green. A README status badge shows the result. |
| FND-FR-24 | Security checks: secret scan with the Gitleaks binary (full history, `fetch-depth: 0`) is **blocking**; dependency audit (`pnpm audit`) is **informational** (`continue-on-error`, results visible); Dependabot configured. README states that a detected pushed secret must be rotated, not only removed, and how failures are noticed (badge, GitHub email). | Given a dummy secret in a commit, Then the secret-scan job fails. Given a known audit finding, Then the audit job reports but the run is not blocked. `.github/dependabot.yml` exists. |
| FND-FR-25 | A deploy job deploys to Vercel from GitHub Actions only: `needs:` every blocking job, runs only on the single working branch, uses `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`; Vercel's Git auto-deploy is disabled (`git.deploymentEnabled: false` in `vercel.json`). Only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are GitHub secrets. `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_MIGRATION_URL` are never set on Vercel or in the deploy job. | Given any blocking job fails, Then the deploy job does not run. Given all pass, Then the app is deployed and a post-deploy hello-world check (`curl --fail` on `/api/health`, known body) passes against the deployed URL; failure fails the workflow. The deployed app does not touch a database. |
| FND-FR-26 | Gates are proven to fail on bad input once, on a throwaway commit recorded in the test README and then reverted: lint error, type error, failing test, dummy secret, failing hello-world; and a failing blocking job prevents deploy. | The record lists each case and the observed red job. Done after the PO's first push. |
| FND-FR-27 | Documentation: README (prerequisites incl. Docker, setup commands, scripts, test commands, troubleshooting, CI/CD overview, PO prerequisites, commit convention suggestion, secret-leak note), `docs/architecture.md` (conventions, deployment section), test README, `docs/design-system.md`, ADRs 0001-0005 in `docs/adr/`. | All files exist; a developer who did not write them follows the README on a clean machine (see NFR-01). |

## 9. Non-functional requirements

| ID | Requirement | Measure |
|----|-------------|---------|
| FND-NFR-01 | Onboarding: a new developer gets a running app from the README. | On a clean machine with Docker, from clone to styled home page and local Supabase running in 15 minutes or less (excluding first Docker image download time, stated in the README). |
| FND-NFR-02 | Tenant-isolation foundation fails closed. | `app_backend` has no `BYPASSRLS`, is not owner or superuser, has no app-table privileges; a query without `withRls` returns no data (tests FND-FR-10 items 6, 8, 9). The service-role key is not provisioned or used. |
| FND-NFR-03 | Accessibility: WCAG 2.2 AA in base components and the home page. | axe reports zero violations on `/` and `/design` in light and dark in E2E. |
| FND-NFR-04 | Responsive: mobile-first. | Home page and `/design` have no horizontal page scroll at 375px and 1280px (E2E). |
| FND-NFR-05 | Secrets hygiene. | No real secret in the repository (secret scan blocking); server-only variables absent from the client bundle; `.env.example` has placeholders only. |
| FND-NFR-06 | Reproducibility. | Node, pnpm, Next.js, Supabase CLI and Playwright versions are pinned; CI and local use the same commands. |
| FND-NFR-07 | Fast feedback. | The fast CI group (lint, typecheck, unit, build) needs no Docker and starts independently of the Docker group so a lint failure is visible without waiting for DB/E2E. |

## 10. Data and dependencies

- Entities: none (no application tables). Only the `app_backend` role, grants, and Supabase-managed `auth` schema (read-only reference for later FKs; Drizzle never writes to `auth`).
- Supabase Data API: disabled (`[api] enabled = false` locally) so the anon key reaches no table (Open item 2, default A, used as the PO did not object; ADR 0003).
- Upstream dependency: none. Downstream: 002 depends on `withRls`, `app_backend`, harness, design system, app shell, CI/CD.
- Tools and versions are verified against current official docs when pinned (Next.js, Tailwind, shadcn/ui, drizzle-orm/kit, `@supabase/ssr`, ESLint boundary plugin, Playwright).

## 11. Edge cases and failure states

| Case | Expected |
|------|----------|
| Docker not running | `pnpm test` still passes; `db:*`, `test:db`, `test:e2e` fail with a message pointing to the README prerequisite. |
| Missing or invalid env variable | App fails fast at startup naming the variable (dev/test); production tolerates absent DB variables until a cloud DB exists. |
| Local DB down | `/api/health/db` returns non-200 without leaking connection strings; `/api/health` stays 200. |
| `withRls` callback throws | Transaction rolled back, context reset, error propagated. |
| Query outside `withRls` | Denied or zero rows (fails closed). |
| Drizzle schema out of date | Drift check fails the Docker CI job. |
| Table added without RLS/policy | Schema guard fails `test:db`. |
| Secret pushed | Secret-scan job fails; README procedure: rotate. |
| Pushed commit fails lint/tests | Run is red; deploy does not run; PO fixes afterwards. |
| `/design` requested in production | 404. |
| Private repo minutes exhausted | Documented in README (every push consumes CI minutes). |

## 12. Delivery order (walking skeleton first)

Each step is demonstrable. Steps 5 and 6 can be prepared before the repo exists but are verified only after the PO's first push.

1. Next.js skeleton, pnpm, pinned versions, ESLint/Prettier/typecheck, `.gitignore`, typed env.
2. Local Supabase + Docker + `/api/health` and `/api/health/db`.
3. Drizzle + libraries + migration workflow + `app_backend` migration + `withRls` + its integration tests + schema guard.
4. Test tooling with one real test per layer (unit, DB, E2E + axe) and the harness.
5. CI workflow (fast group, Docker group, secret scan, audit, Dependabot).
6. Vercel deploy job + hello-world smoke test.
7. Design system: tokens, components, app shell, toast provider, styled home page, `/design`, `docs/design-system.md`.
8. Conventions doc + boundary lint rules + their tests.
9. README, test README, ADR check, final acceptance.

Agent workflow and commits: tasks follow `specs/README.md` (fresh agent per task; developer implements, tester verifies, architect/ui-ux-designer review where relevant, product-manager accepts). Single branch, plain descriptive commit messages; Conventional Commits is a documented suggestion with no tooling. Tasks that depend on the PO's push (FND-FR-23 green run, FND-FR-25, FND-FR-26) are marked "verified by PO after first push".

## 13. Definition of done

1. Clean machine, following the README, within about 15 minutes: Docker prerequisite met, `pnpm install`, local Supabase started, app running and showing the styled home page (FND-NFR-01).
2. `/api/health/db` reaches the local database (no tables); `/api/health` is the only deployed smoke target (FND-FR-11).
3. Database stack in place: Drizzle and drizzle-kit configured, schema command works, one documented migration workflow with drift check (FND-FR-06, 07).
4. `withRls` and the `app_backend` role exist and the integration tests of FND-FR-10 pass, including no-leak after commit/rollback.
5. One passing real test per level (unit, DB, E2E with axe on the home page), separate commands, the fast one without Docker (FND-FR-19, 20).
6. Design system minimum (tokens, 002's components, app shell, `/design`) is in place and the home page uses it; `/design` is 404 in production (FND-FR-14 to 18).
7. Conventions doc plus lint rules enforce module and data-access boundaries, and tests show illegal imports are reported (FND-FR-12, 13).
8. GitHub Actions workflow files exist for CI and deploy, pass `actionlint`, and the same checks pass locally with the documented commands (verifiable by the team now).
9. **After the PO's first push to GitHub and Vercel setup:** workflows run on push, CI is green, the app is deployed to Vercel, the hello-world smoke test passes against the deployed URL, and gates are shown to fail on bad input once (FND-FR-23 to 26).
10. ADRs 0001-0005 recorded and `docs/architecture.md`, `docs/design-system.md`, README and test README exist (FND-FR-27).

Items 1-8 and 10 are accepted by the team; item 9 is accepted by the PO after the push. Until then the epic is "done pending PO push". Creating the GitHub repository is not a task.

## 14. PO prerequisites (not tasks)

- Create the GitHub repository and push (the project is not yet a git repository; see Open items for `git init`).
- Create the Vercel project, a Vercel token, and add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` as GitHub secrets.
- Install Docker (Docker Desktop, OrbStack or Colima).

## 15. Traceability: FND-HR to FND-FR / FND-NFR

| HR | Covered by |
|----|------------|
| FND-HR-01 Minimal Next.js skeleton | FND-FR-01, 04 |
| FND-HR-02 Local Supabase + CLI | FND-FR-05, 07, 08, 11 |
| FND-HR-03 Database access stack | FND-FR-03, 06, 07, 08, 09, 10, 11, 21; FND-NFR-02 |
| FND-HR-04 Frontend stack | FND-FR-14, 16 |
| FND-HR-05 Design system | FND-FR-15, 16, 17, 18; FND-NFR-03, 04 |
| FND-HR-06 Libraries and tools | FND-FR-02, 03, 04 |
| FND-HR-07 Docker | FND-FR-05, 27 (Docker only for Supabase; app on host) |
| FND-HR-08 Testing tooling | FND-FR-19, 20, 21, 22 |
| FND-HR-09 CI/CD and security | FND-FR-23, 24, 25, 26; FND-NFR-05, 06, 07 |
| FND-HR-10 Modular, enforced structure | FND-FR-12, 13 (and ADR 0001) |
| FND-HR-11 Minimal, no billing | Section 3 (out of scope list), FND-FR-01; reviewed in acceptance |
| (Onboarding / done criteria, from PM review) | FND-NFR-01, FND-FR-27, section 13 |

Test mapping: every FND-FR acceptance criterion maps to a command or test named in its row; the tester derives the full requirement-to-test table in `tasks.md`.

## 16. Risks and assumptions

| # | Item | Mitigation / status |
|---|------|---------------------|
| R1 | Tenant isolation rests on one function and one role setup; a mistake is a cross-tenant leak, expensive once ~50 tables use it | ADR 0003; mandatory tests FND-FR-10; tester's earliest adversarial tests; manual review of `withRls` and helpers regardless of coverage number |
| R2 | Drizzle RLS support and `drizzle-kit pull` output for roles/policies are version-sensitive | Verify against current docs when pinning; drift check is the safety net; fallback decided in ADR 0002 |
| R3 | Epic is medium-large (ORM, roles, deploy, design system); may need splitting | Boundary table and Won't-do list; any new request is a scope change needing PO approval; PM may propose a split if tasks show it |
| R4 | No branches, hooks or PRs: bad commits and pushed secrets reach the trunk | Accepted by PO; deploy gated by CI; secret scan blocking; README rotation note |
| R5 | CI/CD and Vercel cannot be verified until the PO pushes and sets up Vercel | Acceptance split (DoD 8 vs 9); `actionlint` and local command parity now |
| R6 | CI cost and duration: local Supabase on every push (est. 6-10 minutes), private-repo minutes | Parallel jobs, image/browser caching, trimmed Supabase services; documented |
| R7 | Pooler transaction mode (`prepare: false`, small pool, IPv6) matters once a cloud DB exists | Out of scope; noted in ADR 0003/0004 for the later cloud epic; tests use the direct local connection |
| R8 | Library choices for a ~50-table app made before any feature exist | ADRs; PO owns the trade-off |
| R9 | Documented CRUD patterns drift from components | First CRUD epic updates patterns and `/design` as part of its DoD |
| R10 | Design quality is subjective; only axe, responsive checks and review are automatable | ui-ux-designer reviews `/design` at acceptance |
| A1 | Docker available on developer machines and CI runners | Documented prerequisite |
| A2 | The PO will push to GitHub and set up Vercel before epic acceptance | Epic "done pending PO push" until then |
| A3 | Supabase Auth remains the only identity source; Drizzle never writes to `auth` | ADR 0003 |
| A4 | Type generation with no tables is near-empty; the pipeline is what is accepted | Assumption |
| A5 | Single working branch is the deploy branch (name chosen by the PO) | Assumption |

## 17. Open items for the PO

These are not blockers for approving the spec, but need an answer before or during tasks. The default shown is used if the PO does not object.

1. **`git init` and `.gitignore`.** The project is not a git repository. Who runs `git init` and names the branch? Default: a developer task sets up `git init` and `.gitignore` locally (creating the GitHub repository and pushing stays the PO's action).
2. **Disable the Supabase Data API (architect's hardening proposal, goes beyond what you stated).** Options: A) expose no schemas so the anon key reaches no table, Drizzle is the only data path; B) leave it on and rely on RLS only. Default: A.
3. **App shell and toast provider in 001 (ui-ux-designer's small exception, beyond epic 002's strict needs).** Options: A) build the app shell sidebar-ready with one nav item and mount Sonner once in the root layout; B) strictly a header-only shell and no toast provider. Default: A (included in FND-FR-16 above).
4. **Postgres driver and `supabase gen types`.** Default: `postgres` (postgres-js) as driver; Drizzle-inferred types are the model types; `supabase gen types` is not used because `supabase-js` does not read data. This interprets the PO's "generated types and models" through Drizzle; confirm or ask for `supabase gen types` as well.
5. **Notification of failed runs.** Default: README badge and GitHub's default failure email, no extra tooling.

## 18. Parking lot

Cloud Supabase project and production database; pooler setup; pgTAP for policy tests; dark-mode toggle; Storybook; table/data-table ADR and components (first CRUD epic); Dependabot/CodeQL tuning; branch protection; production Dockerfile; OWASP ZAP and license scanning; RLS allow/deny matrix at scale (epic 002 onward).

## 19. Change log

| Date | Change |
|------|--------|
| 2026-11-12 | First draft merged from requirements, two review rounds and PO answers. |
| 2026-11-12 | Spec approved by the PO; open items 1-5 use their defaults. Wording fixes found while writing tasks and cross-checking ADRs 0001-0005: status line; FR-05 now states Data API disabled (ADR 0003); FR-06 stray wording; FR-07 no longer claims `pull` behavior is already confirmed (ADR 0002 says unverified); FR-09 clarifies the anonymous variant needs no user id; FR-12(c) adds one allowlist exception (`/api/health/db` route imports `@/db`, because FR-11 requires `withRls` and no module exists yet); section 10 Data API wording; section 5 ADR note. |
