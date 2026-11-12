# Review by developer — 001-foundations — round 1

## Summary
The scope is feasible and well bounded for one epic. The biggest gap is that many `OPEN` items are tightly coupled (UI library, styling, forms, validation, test tools, CI platform) and need to be decided together, and there is no definition of "done" for the epic (what must work end to end when it closes). Billing-readiness (FND-HR-11) is vague and could pull in speculative work.

## Concerns and gaps
- [important] FND-HR-04/05 (UI stack and design system) are the largest effort and risk. The choice drives forms, accessibility, theming and test selectors, and is hard to reverse once screens exist. Needs an early decision and a clear "minimum" definition of the design system (tokens plus a handful of base components).
- [important] FND-HR-02/07 (Supabase local vs cloud, Docker): local Supabase CLI requires Docker Desktop (or a compatible runtime) and several GB of images. CI must also be able to start it for integration/RLS tests. Not stated whether cloud projects (staging/prod) are in scope now.
- [important] FND-HR-10 (modularity): the stated goal (no cross-module imports, layers) only holds if it is enforced by tooling (ESLint boundary rules, TypeScript path aliases). Without enforcement it will erode. Layering should be proportionate: too many layers (services plus repositories plus models for every module) is heavy for an MVP.
- [important] FND-HR-09: CI platform, which checks block merges, branching and commit conventions, and whether CD/deployment is included are all undecided. Secret scanning and dependency audit have different tools and noise levels; blocking vs advisory needs a choice.
- [minor] FND-HR-03: Supabase client wiring is requested here, but Supabase Auth wiring belongs to epic 002. The SSR cookie-based clients (browser/server/middleware) are only meaningful with auth. Need to clarify what "wired" means with no tables and no auth (for example, a typed client plus a health check).
- [minor] FND-HR-06: no Node version policy, env var validation, or `.env.example` mentioned. These are cheap now and painful later.
- [minor] FND-HR-08: "unit, integration, end-to-end" from the start means three tools set up with nothing to test yet. Each needs at least one real sample test to prove the wiring (including one against local Supabase).
- [minor] FND-HR-11: "Billing must be easy to add later" is not testable. Interpreted as "no design decision blocks it" (for example a tenant-scoped data model and webhook-capable route handlers), not as extra code.
- [minor] No requirement for a README or setup docs (clone, install, run, test in a few commands). This is a developer experience gap.

## Proposals
- Package manager: pnpm (fast, strict dependency resolution, good lockfile, widely supported in CI). npm is an acceptable simpler alternative. Pin Node via `.nvmrc` or `engines` plus the `packageManager` field.
- Next.js current stable with App Router, strict TypeScript (`strict`, `noUncheckedIndexedAccess`), `src/` directory, `@/` path alias.
- Validation: Zod, with types inferred from schemas and schemas shared between client and server. Forms: React Hook Form with `@hookform/resolvers/zod` plus Server Actions, or plain `<form action>` with `useActionState`. See question 3.
- Lint/format: ESLint (Next.js flat config) plus Prettier, or Biome as a single faster tool. Add `eslint-plugin-boundaries` or `eslint-plugin-import` `no-restricted-paths` to enforce module boundaries. Add Husky or lefthook with lint-staged for pre-commit and commitlint for Conventional Commits (suggestion, not in scope unless approved).
- Folder layout (proportionate): `src/app` (routes only, thin), `src/modules/<domain>/{components,actions,services,data,schemas,types.ts,index.ts}`, `src/lib` (shared infrastructure: supabase clients, env, utils, no dependency on modules), `src/components/ui` (design system primitives). Create module folders only when epic 002 needs them; in 001 only `src/lib` and `src/components/ui`.
- Layering: keep it to actions (entry) → services (business rules, pure where possible) → data (Supabase queries). Do not add a generic repository abstraction over Supabase; it adds code with little value at this size.
- Testing: Vitest for unit and integration (with local Supabase for RLS tests), Playwright for E2E, Testing Library for components. One sample test per layer in this epic.
- Env: a single `src/lib/env.ts` validating variables with Zod; `.env.example` committed; `NEXT_PUBLIC_` only for browser-safe values.
- Docker: only Supabase local stack (started by the Supabase CLI). The Next.js app runs on the host (`pnpm dev`) for fast refresh and simplicity. Add an app Dockerfile only when deployment requires it (suggestion, not in scope unless approved).
- CI (GitHub Actions if the repo is on GitHub): jobs for lint, typecheck, unit tests, build, then integration/E2E with Supabase CLI started in the runner. Security: `pnpm audit` (or OSV scanner), gitleaks for secrets, Dependabot or Renovate for updates, CodeQL optional.
- Supabase libraries: `@supabase/supabase-js` and `@supabase/ssr`; generated DB types via `supabase gen types`, committed or generated by a script. Install now, but create the three clients (browser/server/middleware) in 002 together with auth, unless the client wants them here.
- UI stack candidate for the client to confirm: Tailwind CSS plus shadcn/ui (Radix primitives, copied into the repo, accessible by default, easy to theme with CSS variables and tokens). It fits a design system that is owned by the project rather than a dependency.
- Epic done criterion (suggestion, not in scope unless approved): fresh clone, then `pnpm install`, `pnpm supabase start`, `pnpm dev` shows a styled home page; `pnpm lint`, `typecheck`, `test`, `test:e2e`, `build` all pass locally and in CI.

## Questions for the client
1. Which UI approach do you want?
   - Options: A) Tailwind CSS plus shadcn/ui / B) A packaged component library (e.g. MUI, Mantine) / C) Tailwind only with hand-built components
   - Recommendation: A, because components are owned in the repo, accessible, and themeable via tokens, which suits a custom design system.
   - Impact if undecided: blocks the design system, the UX designer's work, and form components; hard to change later.
2. Where does the Supabase database run during development and in which environments?
   - Options: A) Local only (Supabase CLI plus Docker) for now / B) Local plus a cloud project for staging/production now / C) Cloud only
   - Recommendation: A, because it is the minimum and keeps the epic small; cloud projects can be added when deployment is decided.
   - Impact if undecided: affects Docker requirements, CI setup, and env var handling.
3. Which form approach?
   - Options: A) React Hook Form plus Zod resolver / B) Native forms with Server Actions, `useActionState` and Zod / C) Decide in epic 002
   - Recommendation: A for client-side per-field validation (epic 002 requires errors next to fields before submitting) with the same Zod schema reused in server actions. B is simpler but weaker for client-side validation.
   - Impact if undecided: only delays form components in the design system; low risk but affects 002 estimates.
4. Which CI platform, and is deployment (CD) included in this epic?
   - Options: A) GitHub Actions, CI only / B) GitHub Actions, CI plus deploy (e.g. Vercel) / C) Other platform
   - Recommendation: A, because deployment target and cloud database are undecided; CD can be its own later epic.
   - Impact if undecided: blocks the CI tasks and the definition of security checks.
5. Should security and quality checks block merges?
   - Options: A) Lint, typecheck, tests, build, and secret scanning block; dependency audit advisory only / B) Everything blocks / C) Everything advisory
   - Recommendation: A, because audit tools produce noise outside our control and would block unrelated work.
   - Impact if undecided: unclear merge rules; either too noisy or too weak.
6. Do you want automated commit and branching enforcement (Husky/lefthook hooks, commitlint) now?
   - Options: A) Yes, pre-commit lint/format plus commitlint / B) Only a documented convention, enforced in CI/review / C) None for now
   - Recommendation: B for the MVP, with A optional; hooks add setup friction, and the convention is already stated in project rules.
   - Impact if undecided: minor; affects developer experience only.
7. How much of Supabase client wiring belongs in this epic given auth is in 002?
   - Options: A) Install libraries and generate types only; clients created in 002 / B) Create the three clients (browser/server/middleware) now, unused until 002 / C) Create them now plus a health-check page querying the DB
   - Recommendation: A or C. C proves the stack works end to end (DB reachable from the app) without any auth or tables; A is leaner.
   - Impact if undecided: unclear acceptance for FND-HR-03; risk of unused code (B).
8. Is the home page expected to show anything beyond a styled placeholder (for example a design system showcase page)?
   - Options: A) Styled placeholder only / B) Placeholder plus a simple design system showcase route / C) Placeholder plus Storybook
   - Recommendation: A or B; Storybook adds tooling and maintenance that is not justified for an MVP.
   - Impact if undecided: effort varies and "beautiful from the start" has no visible acceptance check.

## Risks and assumptions
- Assumes developers have Docker (or a compatible runtime) installed; local Supabase is heavy on RAM and disk and slows CI.
- Assumes the repo is hosted on GitHub; CI choices change otherwise.
- Library versions move fast (Next.js, React, Tailwind, shadcn/ui, Supabase SSR); versions will be verified against current docs when implementing and pinned by lockfile.
- Risk of over-building: setting up three test tools, boundary linting, hooks, and a full design system with no features. Keep each to the minimum plus one sample.
- Module boundary rules are best written once real modules exist (epic 002); in 001 only the layout and lint rule mechanism can be set up.
- Effort estimate (rough): skeleton, tooling and Supabase local: small; design system and UI stack: medium; testing setup: small to medium; CI with Supabase-backed tests: medium.

---

# Review by developer — 001-foundations — round 2

## Summary
I confirm all Product Owner (PO) answers as feasible. The Drizzle ORM + RLS decision is sound if the connection role cannot bypass RLS by default, and it needs one ADR covering migrations, roles and the transaction function. The deployment decision has a real conflict: there is no cloud Supabase project, so the deployed app has no database, and the env validation and `/api/health` design must account for that. No blocking questions for the client; follow-ups below are recommendations for the spec. The epic grows from "medium" to "medium-large" (ORM setup, ADR, role/grant migration, deploy workflow).

## Concerns and gaps
- [important] Safe-by-default connection role (ORM + RLS). If Drizzle connects as `postgres` (the local default), RLS is bypassed whenever a developer forgets the centralized function. The "pure convention" version of the PO's design fails open. Proposal: connect with a dedicated login role (for example `app_backend`) that has no `BYPASSRLS`, is a member of `authenticated` and `anon`, and holds only the grants it needs. Then a query outside the wrapper runs with no claims and sees zero rows (fails closed). The role and grants are created by a Supabase CLI migration. Also export only the transaction function, never the raw `db` instance, and add a lint rule (`no-restricted-imports`) so nothing else can import the driver.
- [important] Setting the security context. `SET LOCAL` cannot take bind parameters; use `select set_config('request.jwt.claims', $1, true)` and `set_config('role', 'authenticated', true)` inside the transaction (third argument `true` = transaction-local), then run the callback with the transaction object. The claims must come from a verified token (`getClaims()`/`getUser()` in the server client), never from a cookie decoded without verification. Tenant selection (the "only after the JWT and tenant are verified" part) must be checked by policies against real `memberships`, not trusted from a claim. All of this is for the architect's ADR; I flag it so the spec states it.
- [important] Migrations: drizzle-kit and Supabase CLI must have one source of truth. Supabase CLI owns applying migrations (`supabase db reset`, `supabase migration up`, CI, later cloud). Proposal:
  - Drizzle schema files are the source for tables, constraints and RLS policies (drizzle-orm supports `pgPolicy`, `.enableRLS()` and the Supabase roles and `auth.users` reference from `drizzle-orm/supabase`).
  - `drizzle-kit generate` writes into `supabase/migrations` using a timestamp-style prefix (verify the `migrations.prefix` option against the installed drizzle-kit version; if unavailable, a tiny rename script). We never run `drizzle-kit migrate` or `push`.
  - Anything Drizzle cannot express (functions, triggers, `SECURITY DEFINER`, role grants, the `auth.users` trigger) goes in hand-written SQL migrations created with `drizzle-kit generate --custom` or the Supabase CLI.
  - Set `schemaFilter: ['public']` so drizzle-kit ignores Supabase-managed schemas (`auth`, `storage`).
  - Drift guard in CI: after `supabase db reset`, `drizzle-kit generate` must produce no new migration.
  Fallback if generated policy SQL proves poor at ~50 tables: hand-written SQL stays the source of truth and `drizzle-kit pull` refreshes the TS schema. The ADR should pick one; I recommend the first.
- [important] Two type systems. With Drizzle, row types come from the Drizzle schema (`InferSelectModel`). `supabase gen types` then duplicates them. Recommendation: use `supabase-js`/`@supabase/ssr` for Auth (and later Storage/Realtime) only, all table access through Drizzle, and generate Supabase types only if a supabase-js data call is ever used. Rule written in the architecture doc, otherwise two data paths appear and RLS context handling splits. Installing the libraries now stays as the PO decided.
- [important] Module boundaries vs Drizzle schema. Foreign keys and relations need tables from other modules (for example `memberships` references `tenants` and users), which conflicts with "never import another module's internals". Proposal: table definitions live in one shared `src/db/schema/*.ts` (one file per domain, allowed import target for modules and drizzle-kit), while queries, services and actions stay inside the modules. The boundary lint rule must allow this explicitly. Needs architect confirmation in the ADR.
- [important] Deployment without a cloud database. The PO excluded creating cloud Supabase, so the deployed Vercel app cannot reach any database. Consequences: (a) the deployed "hello world" test must hit a route that needs no DB, so `/api/health` must be liveness only, with the DB check separate (for example `/api/health/db`, used by local, CI and E2E); (b) `src/lib/env.ts` must not crash the Vercel build or runtime for missing database and Supabase variables. Options: required-in-development/test and optional-in-production for now, or placeholder values set in Vercel. I recommend the first, with the rule documented, and tightening when cloud Supabase arrives. A production pooled connection (Supavisor transaction mode, port 6543) will need `prepare: false` in the driver; note it for the later cloud epic, not now.
- [important] Vercel deployment from GitHub Actions. Standard flow: `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`, using secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Prerequisites are manual PO actions, not tasks: create the Vercel project and token, add the three GitHub secrets. Do not connect Vercel's own Git integration, or every push deploys twice. The "hello world test" can be a post-deploy `curl --fail` against the URL printed by the deploy step (use `--prod` so Vercel Deployment Protection does not block the request). Because the repo may not be on GitHub yet, the deploy job cannot be proven in this epic until the PO pushes; the acceptance criterion should say "workflow files exist, pass `actionlint`, and are green on the first PO push".
- [important] Every push to a single branch with no PRs means gates are after-the-fact. "Blocking" can only mean a red run, so I recommend: the deploy job `needs` the CI jobs, so a broken commit is not deployed (still runs on every push, consistent with the PO's wish). Triggers: `on: push` (all branches, no `pull_request` trigger needed), plus `concurrency` with `cancel-in-progress` per ref so rapid pushes do not queue.
- [important] Secret scanning after the fact. With no hooks and no PRs, a secret reaches GitHub before Gitleaks reports it; the fix is to rotate it, not just to delete it. The PO accepted this trade-off, but the README must say so. Also `gitleaks/gitleaks-action` needs a license key for organization-owned repos (free for personal accounts); running the gitleaks binary directly avoids this. Needs `fetch-depth: 0`.
- [minor] CI with local Supabase. Use `supabase/setup-cli` and `supabase start -x <unneeded services>` (studio, imgproxy, logflare, vector, etc. as supported by the pinned CLI) to cut startup time; read the API URL and keys from `supabase status -o env` into the job env. Expect roughly 6-10 minutes per push with DB tests plus E2E (Playwright browsers cached). Parallelize: fast job (lint, typecheck, unit, build) separate from the Supabase job. Private repos on a free plan have a monthly minutes limit; every-push triggers consume it, so mention it.
- [minor] The project is not a git repository. A task to `git init` (single branch, name chosen by the PO) and a `.gitignore` is implied; creating the GitHub repo stays out of scope as the PO said.
- [minor] Conventional Commits remain a documented convention without enforcement (no commitlint, no hooks). Fine; README states it.
- [minor] Libraries to verify at implementation time (versions move quickly): `drizzle-orm` and `drizzle-kit` (match versions, check whether a 1.x line is current stable), driver choice (`postgres` vs `pg`; I propose `postgres`, works with Drizzle and Vercel), Next.js and `@supabase/ssr` compatibility, ESLint flat config support in the boundary plugin.

## Proposals
- ADR (architect) "Database access: Drizzle + RLS via a transaction function" covering: dedicated non-bypass login role and grants, the single exported `withUserContext`-style function, verified-claims requirement, policies keyed on real membership, no raw `db` export, shared `src/db/schema`, migration flow above, and the supabase-js-for-Auth-only rule.
- RLS and DB tests (Vitest, `test:db`) must go through the same transaction function, so the harness proves the production path, plus one test that a query outside the wrapper returns no rows (fails closed).
- Split `/api/health` (liveness, used by the deploy smoke test) from `/api/health/db` (DB reachability through the wrapper, used locally and in CI).
- CI jobs: `quality` (lint, typecheck, unit, build, gitleaks), `db-e2e` (Supabase local, drift check, `test:db`, `test:e2e`), `deploy` (needs both, then smoke `curl`). Dependency audit stays informational (per Q9 recommendation B), Dependabot on.
- Epic done criterion update: README flow works on a clean machine; all test layers pass locally; workflow files validated with `actionlint` and green on the first PO push; deploy smoke test passes on Vercel.

## Questions for the client
None blocking. Items to confirm, each with a default I will assume if the PO does not object:
1. Deploy only after CI jobs pass (`needs`)? Default: yes.
2. Deployed app has no database yet, so the deployed smoke test is liveness only. Default: yes.
3. Vercel project, token and the three GitHub secrets are created by the PO outside the tasks. Default: yes.

## Risks and assumptions
- The ORM + RLS design is only as safe as the role setup; the fail-closed role is the main mitigation. A mistake here is a tenant-isolation breach, so it deserves the tester's earliest and most adversarial tests.
- Drizzle's RLS and Supabase-role support is relatively recent and changes between versions; generated policy SQL must be reviewed. Mitigation: the fallback in the migration concern above.
- Every query inside a transaction adds a round trip (BEGIN, set_config, COMMIT). Acceptable for an MVP; can be batched into one statement later.
- With ~50 tables planned, one shared schema folder and small per-domain migrations keep drizzle-kit usable; a single developer avoids journal merge conflicts.
- CI cannot be proven before the PO pushes to GitHub; local validation is limited to `actionlint` and running the same scripts locally.
- Effort update: skeleton and tooling: small; Drizzle, roles and transaction function plus ADR: medium; design system: medium; testing setup: medium; CI with Supabase plus Vercel deploy: medium. Overall medium-large, still one epic if the design system stays at Q11 option B.
