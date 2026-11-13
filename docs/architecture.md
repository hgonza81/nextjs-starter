# Architecture

Short overview; decisions and reasons are in the ADRs ([index](adr/README.md)). Boundary rules and their lint mechanism are in the section "Lint rules" below.

| ADR | Topic |
|-----|-------|
| [0001](adr/0001-code-structure-and-layering.md) | Code structure, layering, module boundaries |
| [0002](adr/0002-supabase-local-first-and-migrations.md) | Supabase local-first, SQL-first migrations, `db:schema` |
| [0003](adr/0003-drizzle-rls-data-access.md) | Drizzle, `withRls`, `app_backend` role, Data API off |
| [0004](adr/0004-env-and-secrets.md) | Environment variables, secrets, deployment |
| [0005](adr/0005-tenant-isolation-direction.md) | Tenant isolation direction for epic 002 |
| [0006](adr/0006-ui-stack-and-design-system-boundary.md) | UI stack (Tailwind v4, shadcn on Radix, Lucide, Geist) and the bounded design system |
| [0007](adr/0007-theming-mechanism-and-browser-floor.md) | `light-dark()` theming and the `browserslist` floor |
| [0008](adr/0008-test-strategy-and-tooling.md) | Vitest unit/db projects, Playwright, axe, real-DB harness |
| [0009](adr/0009-ci-cd-pipeline.md) | CI jobs, blocking vs informational, deploy from Actions only |
| [0010](adr/0010-toolchain-pinning-and-supply-chain.md) | pnpm, Node pin, exact versions, release-age policy, manual dependency updates |
| [0011](adr/0011-validation-and-forms.md) | Zod and React Hook Form |

## Stack
Next.js (App Router, strict TypeScript), Supabase Auth, PostgreSQL with RLS, Drizzle ORM (`postgres` driver), Tailwind CSS v4 with shadcn (Radix) components, Supabase CLI + Docker for local development and CI, Vercel deployment from GitHub Actions.

## Layout
```
src/
  app/              routing only: pages, layouts, route handlers; calls module public APIs
    design/         the /design showcase (gated by DESIGN_PAGE_ENABLED); ordinary app code, no exemptions
    api/health/     liveness (/api/health); db/ readiness (/api/health/db) is the one app file that may import @/db
    globals.css     the ONE design-token file
  components/       shared UI, domain-free (docs/design-system.md section 0.3)
    ui/             shadcn-owned primitives actually used (Button, Input, Card, Sidebar, Sonner, ...)
    form/           FormField, PasswordInput (React Hook Form + ui/)
    layout/         AuthLayout, AppShell, PageHeader, PageSkeleton
    brand/          wordmark and PRODUCT_NAME (the one place to rebrand)
  hooks/            shared client hooks (use-mobile.ts)
  modules/<name>/   epic 002+: index.ts (public API), actions/, queries/, schemas/, components/, types.ts
  db/               client.ts (private, lazy getDb()), rls.ts (withRls, withAnonymousRls), schema/ (generated), index.ts (public API)
  lib/              env.ts (public), env.server.ts (server-only), utils.ts; domain-free
  instrumentation.ts  startup env validation
tests/              db/ (real Postgres), e2e/ (Playwright), utils/ (harness); see tests/README.md
scripts/            db-schema.mts (wrapper for `pnpm db:schema`)
supabase/           config.toml, migrations/ (SQL, source of truth), seed.sql
```
Unit tests are colocated (`*.test.ts(x)` next to the file); database and E2E tests live under `tests/`.

**Module folders.** A module is `src/modules/<name>/` and exposes its public API only through `src/modules/<name>/index.ts`. Epic 001 creates no module folder (no empty folders, no placeholder `index.ts`); `auth`, `users` and `tenants` arrive in epic 002 and create only the subfolders they need. Tables and inferred types are not module-owned: they come from `@/db` (ADR 0001). The Supabase Auth client factories (`@supabase/ssr`, Auth only) do not exist yet; epic 002 creates them and chooses their location. ADR 0001 and 0004 name `src/lib/supabase/` as the intended home; if epic 002 uses another place, it records that in the ADR.

## Dependency direction
`app` -> module `index.ts` -> `@/db`, `@/lib`. `lib` imports neither `modules` nor `db`; `db` imports nothing from `modules`; `app` and components never import `@/db`; no cycles. Enforced by lint in CI (ADR 0001, section "Lint rules").

## Data and security rules
- All table access goes through `withRls(ctx, fn)` (or `withAnonymousRls`); the raw DB client is private to `src/db`. The app connects as `app_backend`, which fails closed (ADR 0003). Never nest `withRls` calls (single connection: deadlock), never use session-level SQL state, never build SQL from request input.
- **Every query inside the callback uses the transaction handle `tx` that `withRls` passes in**, never `getDb()` or any other handle. One `withRls` call per use case; multi-step writes live in one callback or in a database function; no external network call inside the callback. A `VerifiedContext` is built only by server code after `supabase.auth.getUser()` or `getClaims()` and, for a tenant, after a membership check.
- Every table needs explicit `GRANT`s and RLS policies in its own migration (default privileges for `anon`/`authenticated` are revoked); an `INSERT ... RETURNING` also needs a SELECT policy. The schema guard test queries the catalog, not the generated TS schema (which carries no RLS flag or grants).
- Data API (PostgREST, GraphQL) is disabled; Storage and Realtime are not used for app tables.
- `supabase-js` is for Auth only: no `.from()` / `.rpc()` (lint rule f; the Data API is off, so a call would fail at runtime anyway).
- Migrations are SQL-first in `supabase/migrations`; the Drizzle schema is generated by `pnpm db:schema` (wrapper over `drizzle-kit pull`, `scripts/db-schema.mts`) and drift-checked in CI: `supabase db reset`, `pnpm db:schema`, `git diff --exit-code src/db` (ADR 0002). The wrapper validates `DATABASE_MIGRATION_URL` before touching anything and restores the previous generated files if `pull` fails. Supabase CLI 3.1.0 (pinned), local Postgres 17.
- Tenant isolation: shared schema + `tenant_id` + RLS (ADR 0005).

## Environment
- Two modules read `process.env` for the app (ADR 0004): `src/lib/env.ts` (public schema, `publicEnv`, safe for client code) and `src/lib/env.server.ts` (starts with `import "server-only"`; `serverEnv`, `requireDatabaseUrl()`). Importing the server module from client code is a build error.
- `src/instrumentation.ts` imports both when `process.env.NEXT_RUNTIME === "nodejs"`, so a bad variable fails at `next dev` / `next start` with a message naming it. That is the only extra `process.env` read in `src`.
- `next.config.ts` imports the public module (`./src/lib/env`, relative path), so `next build` fails on a missing `NEXT_PUBLIC_*` variable. Consequence: the three `NEXT_PUBLIC_*` variables are needed at build **and** at runtime (`next start`, CI, Vercel).
- `DATABASE_URL` / `DATABASE_MIGRATION_URL` are required unless `NODE_ENV=production`; the lazy `getDb()` fails on first use when `DATABASE_URL` is missing.
- `DESIGN_PAGE_ENABLED` (server-only, in `env.server.ts`; accepts `true`, `false`, `1`, `0`; blank counts as unset): unset means ON only when `NODE_ENV=development` and OFF otherwise, so it is absent on Vercel and every `/design*` route returns 404 there. `playwright.config.ts` sets it to `true` for the E2E server (project `design-gate-off` strips it to prove the 404). Never prefix it with `NEXT_PUBLIC_`.
- Tooling (`drizzle.config.ts`, `scripts/db-schema.mts`, Playwright and Vitest config, `tests/utils/local-env.mts`) reads `process.env` outside the app.

## Conventions
Numbers C1 to C12 are stable: lint messages cite them (`eslint.config.mjs`). The "Lint rules" table below says which conventions are enforced mechanically.

| # | Convention | Detail |
|---|------------|--------|
| C1 | Layout | As in "Layout": `src/app` (routing only, thin), `src/modules/<name>/{actions,queries,schemas,components}` plus `index.ts` (public API) and `types.ts`, `src/db` (shared, generated schema, `withRls`), `src/lib` (domain-free), shared UI in `src/components` and `src/hooks`. Create only folders that have content; no empty module folders. Modules `auth`, `users`, `tenants` arrive in epic 002. |
| C2 | kebab-case files | All file and folder names are kebab-case (`app-shell.tsx`, `use-mobile.ts`, `create-tenant.ts`). Next.js reserved names (`page.tsx`, `route.ts`, `layout.tsx`) are unchanged. Identifiers follow TypeScript norms (PascalCase components and types, camelCase functions). |
| C3 | Named exports | No `export default` in our code. Exceptions are files a framework requires to be default (`page`, `layout`, `loading`, `error`, `not-found`, config files). Route handlers use named `GET` / `POST` exports. `index.ts` of a module re-exports its public API by name. |
| C4 | `@/` alias | Cross-folder imports use `@/` (maps to `src/`). Inside one module or one component folder, use relative imports for its own files. No `../../..` chains that leave a module or a top-level folder. Exception: `next.config.ts` imports `./src/lib/env` by relative path because it loads outside the alias. |
| C5 | Server Components by default | Add `"use client"` only for interactivity or browser APIs, at the smallest leaf possible. Client code may import only `publicEnv` (never `env.server.ts`), and never anything from `@/db`. A Server Component must not pass event handlers to a Client Component. |
| C6 | Mutations via Server Actions with a typed result | Actions live in `modules/<name>/actions/` and return `{ ok: true, data } \| { ok: false, error }`; expected failures are returned, not thrown. An action re-checks the session with `supabase.auth.getUser()` and never relies on the UI or middleware. |
| C7 | Zod at the boundary | Every external input (form data, action arguments, route handler body, query params) is parsed with a Zod schema from `modules/<name>/schemas/` before use; the parsed type is the only type passed on. Env is validated by `env.ts` / `env.server.ts` (ADR 0004). |
| C8 | Error logging without PII | Server-side and structured (event name, error class or code, ids only). Never log secrets, tokens, passwords, emails, request bodies, connection strings or full error objects that may embed them (pattern: `src/app/api/health/db/route.ts` logs only `error.name`). Response bodies carry no internal detail. No observability tooling in the MVP; the single log call site is the seam. |
| C9 | All queries use the `withRls` transaction | A query function in `queries/` receives the transaction handle `tx` passed by `withRls(ctx, fn)` (or `withAnonymousRls(fn)`) and uses only it, never `getDb()` or another handle. The raw client (`src/db/client.ts`) is private to `src/db`; never nest `withRls`, never use `sql.raw` outside `src/db/rls.ts`, never build SQL from request input, no external network call inside the callback, one `withRls` per use case (ADR 0003). The `VerifiedContext` must come from a verified session. |
| C10 | One data path | `supabase-js` and `@supabase/ssr` are for Auth only (the client factories do not exist yet; epic 002 creates them and chooses their location); data goes through Drizzle. The Data API is disabled as a backstop (ADR 0003). |
| C11 | Env access | Only `src/lib/env.ts` (public) and `src/lib/env.server.ts` (`server-only`) read `process.env`, plus the single `NEXT_RUNTIME` read in `src/instrumentation.ts` (the edge runtime must not load `server-only`). Tooling outside `src` (drizzle config, scripts, Playwright and Vitest config, `tests/`) is exempt (ADR 0004). |
| C12 | Commits | Conventional Commits, documented, not enforced. |

## Lint rules
Every FND-FR-12 rule is an ESLint check that runs in `pnpm lint` and in CI (`fast` job). FND-T-37 implemented them in `eslint.config.mjs` (commit `5369669`); FND-T-38 proves each with an illegal and a legal fixture, and FND-T-61 extended rule (d) and the (b) test to relative `../db/client` and `../db/rls` imports from `src/lib`. Sources: spec FND-FR-12, ADR 0001 (rules 1 to 5 and amendment), ADR 0003.

| FR-12 | Rule | Convention / ADR | ESLint mechanism (as shipped) | Documented exceptions |
|-------|------|------------------|-------------------------------|-----------------------|
| (a) | Other code imports a module only through its `index.ts` | C1, C4; ADR 0001 rule 1 | `no-restricted-imports` patterns `@/modules/*/**` and `**/modules/*/**` on every linted file. Inside `src/modules/**` (file depths 1 to 4 below a module) the relative-path pattern is replaced by "no relative import that climbs out of the module" (`../**` at depth 1, `../../**` at depth 2, and so on) | A module imports its own files with relative paths; its public entry is `@/modules/<name>`. With no module folders yet, only fixtures exercise the rule. |
| (b) | `src/lib` does not import `src/modules` | C1; ADR 0001 rule 2 | Override `src/lib/**`: `no-restricted-imports` on `@/modules`, `@/modules/**`, `**/modules/**`, `@/db`, `@/db/**` | `env.server.ts` is ordinary `lib` code; `src/db` importing it is allowed (`db` -> `lib`). |
| (c1) | `src/db` does not import `src/modules` | ADR 0001 rule 2 | Override `src/db/**`: `no-restricted-imports` on `@/modules`, `@/modules/**`, `**/modules/**` | none |
| (c2) | `app` and UI components do not import `@/db` | C5, C9; ADR 0001 rule 3 | Override `src/app/**`, `src/components/**`, `src/hooks/**`: `no-restricted-imports` on `@/db` and `../**/db` (plus the internals group of rule d) | Exactly one file, `src/app/api/health/db/route.ts` (calls `withAnonymousRls`; no module exists to call in epic 001): a later override for that path drops the `@/db` pattern but keeps rule (d), so it still cannot import `@/db/client`. A sibling `route.ts` importing `@/db` is reported (FND-T-38 tests it). `src/modules/**` may import `@/db`. |
| (d) | The raw DB client is importable only inside `src/db` | C9; ADR 0003 | On `src/**`: `no-restricted-imports` on `@/db/**`, `**/db/client`, `**/db/rls`, `**/db/schema`, `**/db/schema/**` (so `@/db` is the only public entry); the `src/db/**` override omits it | `tests/**` (DB tests import `@/db/client` to prove a query without `withRls` is denied and to mock the pool); not linted by this rule. |
| (e) | No import cycles | ADR 0001 rule 4 | `import/no-cycle` on every linted file (plugin `eslint-plugin-import`, registered by `eslint-config-next`, TypeScript resolver already configured) | none |
| (f) | supabase-js `.from()` / `.rpc()` data calls restricted | C10; ADR 0003 | `no-restricted-syntax` on every linted file: `CallExpression[callee.property.name='rpc']` and `CallExpression[callee.property.name='from'][arguments.0.type='Literal']:not([callee.object.name=/^(Array\|Buffer)$/])`. Drizzle also ends queries in `.from(table)` (an identifier), so only the string-literal form is banned | none. The disabled Data API (tested in `data-api-config.test.ts` and `hardening-catalog.test.ts`) is the backstop for forms a syntactic check cannot see. |
| ADR 0003 | `sql.raw` only in `src/db/rls.ts` | C9 | `no-restricted-syntax` selector `CallExpression[callee.object.name='sql'][callee.property.name='raw']` on `src/**` | `src/db/rls.ts`; `tests/**` (SQL built from constants and generated table names). |
| ADR 0004 | `process.env` only in the env modules | C11 | `no-restricted-properties` on `process.env` for `src/**`; off for `src/lib/env.ts` and `src/lib/env.server.ts`; in `src/instrumentation.ts` two selectors allow only `process.env.NEXT_RUNTIME` | `tests/**`, `scripts/`, root config files. |

Generated `src/db/schema/schema.ts` and `relations.ts` are in `globalIgnores` (ADR 0002); other files importing them are still linted.

**Tool choice (ADR 0001 left it open; recorded in its FND-T-36 amendment).** ESLint 9.39.5 flat config with core `no-restricted-imports`, `no-restricted-syntax`, `no-restricted-properties` and `import/no-cycle`. No dependency is added: `eslint-config-next@16.4.6` already depends on `eslint-plugin-import@2.32.0` and `eslint-import-resolver-typescript@3.10.1`, registers the plugin under the name `import` and configures the TypeScript resolver (both are in the lockfile, so the pinned `minimumReleaseAge` of 24 hours is not involved; the plugin's peer range includes `eslint ^9`). Do not register the plugin a second time (flat config rejects a second definition under the same name); if a future Next release drops it, ESLint fails loudly on the missing rule and the fallback is `eslint-plugin-import@2.32.0` as an exact devDependency. Rejected: `eslint-plugin-boundaries` (new dependency; its 7.x major has shipped about a dozen releases in four months, 7.4.3 on 2026-11-12 is inside the age gate, and its configuration is split across `@boundaries/*` packages) and `dependency-cruiser` (a second CLI and config outside `pnpm lint`). Flat-config detail the config relies on: a later block that sets the same rule for the same file replaces the options, so every override restates the complete pattern set it needs.

**Known gaps of the shipped mechanism (found while verifying against the real tree, 2026-11-13).** `no-restricted-imports` matches the import string, not the resolved file, so relative paths can bypass it. Verified with `ESLint#lintText` on virtual files:
1. `src/lib/**` importing the data layer index by a relative path (`../db`, `../db/index`) is not reported; only `@/db` is. Since FND-T-61 the relative internals `../db/client` and `../db/rls` are reported (rule d is applied to `src/lib`). Rule (b) covers `modules` by relative path but not the `db` index.
2. Rule (c2) lists three folders (`app`, `components`, `hooks`): a new top-level folder under `src`, or a root file such as `src/instrumentation.ts`, importing `@/db` is not reported (verified with a virtual `src/instrumentation2.ts`).
3. Module files nested deeper than four folders below a module are not checked by the "do not climb out" rule.
4. Rule (f) reports `Uint8Array.from("ab")` (a false positive; only `Array` and `Buffer` are excluded) and misses a template-literal argument and a variable argument (``.from(`users`)``, `.from(name)`).
These are convention (C4) violations as much as lint gaps, and none is reachable by the code that exists today. If they matter once epic 002 adds modules, the hardening is resolver-based: `import/no-restricted-paths` (same plugin, no new dependency) with zones `./src/lib` and `./src/db` against `./src/modules`, `./src/!(db|modules)/**` against `./src/db`, `./src/!(db)/**` against `./src/db/client.ts`, and one zone per directory found under `src/modules` with `except: ["./index.ts"]`. It resolves alias and relative imports alike. This was verified on a fixture tree (alias and relative imports reported, the health route allowed to import `@/db` but not `@/db/client`, new top-level folders covered). It is a follow-up for the orchestrator to schedule, not part of the accepted T-37.

**Testing the rules (for FND-T-38).** `no-restricted-imports`, `no-restricted-syntax` and `no-restricted-properties` need no files on disk, so `ESLint#lintText` with a virtual `filePath` inside the repo works. `import/no-cycle` crashes (`TypeError` in `scc`) when asked to lint virtual text whose import resolves to a real file, and needs real files to report a cycle: for rule (e) use real fixture files in a folder excluded from the normal lint and the build, or disable `import/no-cycle` in the virtual-text cases.

**How the rules treat other files.**
- Design files and the `/design` page (`src/app/design/**`, `src/components/**`, `src/hooks/**`) are ordinary `app` and UI code: no exemption is needed because they import only `@/components`, `@/lib` and relative siblings. The raw-color and arbitrary-value check on them is the Vitest test `src/design-consistency.test.ts`, not ESLint (FND-FR-18 allows this).
- `tests/` gets only the baseline (a), (f) and `import/no-cycle`: it may import `@/db` and `@/db/client`, use `sql.raw` and read `process.env`.
- Colocated unit tests under `src/**` follow the rules of their folder (for example `src/db/rls.test.ts` may import `./client`; `src/app/api/health/db/route.test.ts` uses `vi.mock("@/db")`, a string, not an import).

## Design system
Tokens, components and rules are in [design-system.md](design-system.md). Architecture-relevant points:
- `src/app/globals.css` is the one token file. Theming uses CSS `light-dark()` with `color-scheme: light dark` instead of shadcn's `.dark` class; changing the mechanism edits that one file because components consume semantic tokens only. It is explained in design-system section 2.1 and recorded in [ADR 0007](adr/0007-theming-mechanism-and-browser-floor.md); the UI stack is in [ADR 0006](adr/0006-ui-stack-and-design-system-boundary.md).
- **`browserslist` rule.** `package.json` pins `chrome >= 123`, `edge >= 123`, `firefox >= 120`, `safari >= 17.5`. Do not lower it or replace it with Next's default list: lightningcss would then polyfill `light-dark()` into a rule resolved at `:root`, which breaks the `data-theme` panels on `/design` and any per-subtree theming. Raising it is fine.
- `/design` is gated by `DESIGN_PAGE_ENABLED` (see "Environment") and is not linked from the app.

## Dependency notes
- **`cn@0.5.2` (exact).** Verified on the npm registry (2026-11-13): maintainer `shadcn <m@shadcn.com>`, repository `github.com/shadcn-ui/cn`, MIT, zero dependencies, "drop-in replacement for clsx + tailwind-merge", published from GitHub Actions with npm provenance (SLSA attestation). It is the package the shadcn `radix-nova` style uses (`shadcn@4.23.0` itself depends on it transitively, and `shadcn migrate cn` installs it). Caution: the npm name `cn` belonged to an unrelated package (`0.1.0` and `0.1.1`, 2013, a different maintainer); the shadcn team publishes it from `0.2.0` (2026-09-01) onward, so the exact pin matters (never resolve to a `0.1.x`) and `src/lib/utils.ts` is the single re-export (`export { cn } from "cn"`). It is young: the first release under this owner is about two months old. If it ever becomes a concern, the one-file swap back is `clsx` + `tailwind-merge` inside `src/lib/utils.ts`.
- **`shadcn@4.23.0` is a runtime dependency** only because `globals.css` imports `shadcn/tailwind.css` (the `data-open` / `data-closed` variants). It is heavy for one CSS file; accepted for the MVP. Removing it means copying that CSS into `globals.css`.
- **`minimumReleaseAgeExclude`** in `pnpm-workspace.yaml` holds three exact versions that pnpm needed to bypass the 24-hour age gate (`minimumReleaseAge` 1440 minutes, set explicitly): `@hookform/resolvers@7.0.6` (published 2026-11-11 23:30 UTC), `prettier@3.10.1` (2026-11-12 07:06 UTC), `@testing-library/user-event@14.6.10` (2026-11-12 04:41 UTC). Entries are version-specific, so they are harmless but dead once the version is a day old (all three by 2026-11-13 07:06 UTC). Housekeeping rule (T-43 review): after that moment, remove the three entries in one change and confirm that a fresh `pnpm install --frozen-lockfile` still succeeds (the lockfile pins the versions, so it should). Do not add broad name-only entries.
- **Known `pnpm audit` advisories (accepted, not suppressed).** The informational audit job shows red because of three advisories in development tooling; none reaches the deployed code and none is exploitable here. Checked 2026-11-13. The job is left as is (no ignore list, no overrides), so a new advisory is still visible next to these. (1) `GHSA-67mh-4wv8-2f99`, esbuild <=0.24.2 via `drizzle-kit` (moderate): the flaw is in esbuild's dev server, which `drizzle-kit` never starts; no newer stable `drizzle-kit` exists, and an `override` to esbuild >=0.25 risks breaking it. (2) `GHSA-g3hv-75wg-m249`, minimatch ReDoS via `typescript-eslint` and `shadcn` (moderate): needs crafted glob patterns, and every pattern here is fixed by us; an `override` to 11.x risks breaking `typescript-eslint`. (3) `GHSA-gcqx-w48m-w2h4`, deepmerge via `shadcn` (low): `shadcn` is used only for one CSS import, and no patched version exists. **Review trigger:** when a new version of `drizzle-kit`, `shadcn` or `eslint-config-next` is released, or by 2027-05-13 at the latest; then re-run `pnpm audit` and either update or re-confirm this note. Any advisory not listed here, or any in a production dependency, needs a decision.
- **Pinning policy.** Exact versions (`saveExact`), lockfile committed; no dependency is added without a requirement. Epic 001 adds none for the boundary lint.

## CI/CD
Decision record: [ADR 0009](adr/0009-ci-cd-pipeline.md); toolchain and dependency policy: [ADR 0010](adr/0010-toolchain-pinning-and-supply-chain.md); tests: [ADR 0008](adr/0008-test-strategy-and-tooling.md); validation and forms: [ADR 0011](adr/0011-validation-and-forms.md).

One workflow, `.github/workflows/ci.yml`, trigger `on: push` (no `pull_request`: fork PRs start nothing; Dependabot branches and tags run the checks but never deploy). Permissions are `contents: read`; actions are pinned by full commit SHA with the release in a comment (Dependabot bumps them). Runs use the same `pnpm` scripts as local development.

| Job | Kind | What it does |
|-----|------|--------------|
| `fast` | blocking | no Docker: install (frozen lockfile), lint, typecheck, format:check, unit tests, build |
| `database-and-e2e` | blocking | local Supabase, `db reset`, drift check (`db:schema` + `git diff --exit-code src/db`), `test:db` (the only job that catches RLS and grant regressions), Playwright E2E |
| `secret-scan` | blocking | Gitleaks binary over the full history (`fetch-depth: 0`), rules and one narrow allowlist in `.gitleaks.toml` |
| `audit` | informational | `pnpm audit`, `continue-on-error`: shows a red job, the run stays green; never in `needs` |
| `deploy` | on `main` only | see below |

**Gitleaks pinning.** The binary is downloaded from the release and verified with a hard-coded SHA-256 (`GITLEAKS_VERSION` and `GITLEAKS_SHA256` in the job env). Dependabot does not track it: when bumping, change the version and the hash together, taking the hash from the release's official checksums file.

**Deploy job.** `needs: [fast, database-and-e2e, secret-scan]` and `if: success() && github.ref == 'refs/heads/main'`; Vercel's Git auto-deploy is off (`vercel.json`), so this is the only deploy path. Steps: skip-safe preflight (any of the three `VERCEL_*` secrets missing: green, warning, rest skipped), `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod --env ...`, then `vercel curl /api/health` (5 attempts, body `{"status":"ok"}`). The CLI is run as `pnpm dlx vercel@65.14.0` (not a devDependency; transitive dependencies unpinned, accepted for the MVP; bumped manually, and only to a release at least 24 h old because of `minimumReleaseAge`, FND-T-64). The deployed app has no database until a cloud project exists: the job sets no `DATABASE_*` or service-role key, and `/api/health` is liveness only (ADR 0004).

**Concurrency.** Workflow group `ci-${{ github.ref }}` cancels in-progress runs on every ref except `main` (`cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`), because cancelling a run cancels its jobs and could kill a deployment half-way. On `main` runs queue (one running, one pending; a newer pending run replaces the older one, so a middle commit may get no run of its own). The deploy job also has its own `deploy-production` group with cancel off.

**Reduced Supabase stack.** CI starts only Postgres and Kong (`pnpm db:start -x gotrue,realtime,storage-api,...`). Nothing in epic 001 touches Auth, Realtime or Storage, so CI does not prove behaviour with them. Kong stays because the Data-API-disabled test expects a 503 from the gateway. **Epic 002 must remove `gotrue` from the exclusion list** (and the full list should be revisited) when Auth is exercised. The drift check is nearly vacuous with 0 tables and only protects once epic 002 adds tables. Supabase image versions and Postgres 17 come from the pinned Supabase CLI (3.1.0), so CI and local use the same images; images are pulled on every run.

**Known limits.** Until `VERCEL_TOKEN` exists the deploy job is green and skipped, so a green badge does not mean "deployed". The health check runs after production was promoted (no rollback). `NEXT_PUBLIC_APP_URL` is a `localhost` placeholder in production. Dependabot covers only GitHub Actions: its npm updater runs Node 24 and the repo enforces `engines.node >=26.13.1` with `engineStrict`, so npm is not configured (it failed with ERR_PNPM_UNSUPPORTED_ENGINE); npm dependencies are updated manually.

**Vercel account prerequisite.** The Vercel account must have the GitHub account that owns the commits connected (Account Settings, Authentication / Login Connections). Otherwise Vercel blocks the deployment ("commit email could not be matched to a GitHub account") and `vercel deploy` waits until the job's 15-minute timeout. Seen once in the first real deploy attempts; fixed by connecting the account. A bounded poll instead of an unbounded wait (`--no-wait`) is a possible hardening, not built.
