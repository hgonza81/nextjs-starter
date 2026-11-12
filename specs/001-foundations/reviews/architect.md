# Review by architect — 001-foundations — round 1

## Summary
The requirements are a sound, minimal base. The biggest gap is FND-HR-10: "services/repositories/models" is named as the default layering, but for a large app this is a one-way door and it conflicts with FND-HR-11 (minimal) if applied as a generic abstraction over Supabase. Second gap: local Supabase, migrations, Docker, test database and CI depend on each other and must be decided together. Epic 002 already assumes modules `auth`, `users`, `tenants` and RLS, so foundations must leave those seams ready.

## Concerns and gaps
- [important] FND-HR-10: layering is undecided and expensive to reverse once many features exist. A classic services/repositories/models split over Supabase adds boilerplate with no payoff (Supabase already is the data-access layer, RLS is the real boundary). Boundaries must also be enforced by tooling, not convention.
- [important] FND-HR-02: local vs cloud is open. It affects migrations workflow, RLS testing, CI and secrets. Without a local database, the cross-tenant RLS tests required in 002 cannot run in CI.
- [important] FND-HR-03: no decision on how the Supabase clients are created. 002 needs browser, server and middleware clients with cookie sessions. If the foundation does not define the single place where clients are created, they will be created ad hoc.
- [important] No requirement for typed, validated environment variables. Needed from day one (public vs server-only keys; service-role key must never reach the browser).
- [important] FND-HR-09: security checks are listed but "what is checked" is open. Secret scanning and dependency audit are cheap now and hard to retrofit; RLS-enabled-on-every-table is a check that only works if there is a migrations workflow and a test DB.
- [minor] FND-HR-11: "Billing must be easy to add later" is not testable as written. It is satisfied by module boundaries plus no schema or code coupling, so no billing code or tables now.
- [minor] FND-HR-01 vs FND-HR-02: with no tables, "database working" needs a defined acceptance criterion (e.g. local stack starts and a health check connects).
- [minor] Conventions (naming, file names, import aliases, error handling shape, server-action result type) are not mentioned. Cheap now, noisy to change later.
- [minor] Package manager and Node version pinning are open; they affect Docker, CI and lockfile reproducibility.

## Proposals
- Layout: modules by domain, with one fixed internal shape and a public API.
  ```
  src/
    app/            routing only; thin pages/actions that call module APIs
    modules/<name>/ index.ts (public API), actions/ (server actions), queries/ (reads), schemas/ (Zod), components/, types.ts
    lib/            shared, domain-free: supabase clients, env, utils (must not import modules)
  supabase/         config.toml, migrations/, seed.sql, tests/ (RLS)
  ```
  Dependency direction: app -> module public API -> data access (Supabase client calls inside the module's queries/actions). No repository layer; no service layer unless logic outgrows an action. Add a layer only when a second use case needs it.
- Enforce boundaries with lint: `eslint-plugin-boundaries` or `no-restricted-imports` (modules only via `index.ts`; `lib` cannot import `modules`), plus a cycle check (`dependency-cruiser` or `import/no-cycle`). Run in CI.
- Typed env: a single `src/lib/env.ts` validated with Zod at startup; `NEXT_PUBLIC_` only for URL and anon/publishable key; `.env.example` committed.
- Supabase clients: one folder `src/lib/supabase/` with `browser`, `server`, `middleware` factories using `@supabase/ssr` and `@supabase/supabase-js`. Types generated from the DB (`supabase gen types`) into one file once tables exist. Wired in 001 as plumbing only, no auth logic (auth belongs to 002).
- Local-first Supabase: Supabase CLI runs the local stack (Docker is required by it); migrations in `supabase/migrations`, applied with one command (`supabase db reset`); the same flow runs in CI. Cloud project is only the deployment target, linked later.
- Docker: only what the Supabase CLI needs. The Next.js app runs on the host in dev (faster HMR, fewer moving parts). A production Dockerfile is not needed now (suggestion, not in scope unless approved).
- CI minimum: install, lint, typecheck, unit tests, build, secret scan (gitleaks), dependency audit; a second job starts local Supabase for integration/RLS tests and E2E. Add a migration rule: every migration creating a table enables RLS (checked by an SQL test in 002).
- Conventions to write down in `docs/architecture.md` (one line each): kebab-case files, named exports, `@/` alias, Server Components by default, mutations via Server Actions returning a typed result, input validated with Zod at the boundary, structured server-side error logging without PII.
- ADRs to write after the client answers: (1) code structure and layering, (2) Supabase local-first and migrations workflow, (3) Supabase client organization and env handling, (4) tenant isolation model (shared schema + `tenant_id` + RLS) as the declared direction for 002, so foundation choices do not contradict it. UI stack ADR is owned jointly with ui-ux-designer.
- Billing seam: nothing in 001. Stripe later attaches to `tenants` via a separate table and route handlers (webhooks), in a new `billing` module; no change to existing modules.

## Questions for the client
1. Code organization (FND-HR-10): how should the app be structured?
   - Options: A) Feature modules by domain with a public API, data access inside the module (no repository layer) / B) Classic layers (services, repositories, models) at the top level / C) Modules by domain, each with internal services and repositories.
   - Recommendation: A, because Supabase plus RLS already provides data access and authorization; extra layers add boilerplate without protection, and can be added inside one module later if a real need appears. Boundaries are enforced by lint.
   - Impact if undecided: developer starts with ad-hoc structure; reorganizing later touches every file.
2. Database environment (FND-HR-02): local, cloud, or both?
   - Options: A) Local Supabase via CLI + Docker for dev and CI; cloud project only for deployment later / B) Cloud project only / C) Both used from day one.
   - Recommendation: A, because migrations, RLS tests and CI need a reproducible, disposable database; no cost and no shared state. Cloud is added when there is something to deploy.
   - Impact if undecided: CI cannot run RLS or E2E tests; secrets handling and workflow are unclear.
3. Should the Next.js app also run in Docker in development?
   - Options: A) Only Supabase in Docker, app on host / B) App and Supabase both in Docker (compose) / C) No Docker beyond what the CLI requires (same as A in practice).
   - Recommendation: A, because it is the simplest and fastest; a production Dockerfile can be added with CD.
   - Impact if undecided: extra setup time and slower dev loop if B is assumed.
4. Is the Supabase client wiring (browser/server/middleware factories, typed env) part of this epic, with auth logic left for 002?
   - Options: A) Yes, plumbing only, with a trivial connectivity check / B) No, install only the libraries and wire everything in 002.
   - Recommendation: A, because it fixes the single place where clients are created and the env validation before features exist.
   - Impact if undecided: risk of ad-hoc clients and duplicated env access in 002.
5. CD / deployment (FND-HR-09): included now?
   - Options: A) CI only; deployment target decided later / B) Include deployment (e.g. Vercel + Supabase cloud) now.
   - Recommendation: A, because there is nothing to deploy yet and the choice (hosting, preview DBs) is cheap to defer; CI checks are enough for the foundation.
   - Impact if undecided: scope creep into infrastructure and secrets management.
6. Strictness of architecture enforcement in CI.
   - Options: A) Lint-enforced module boundaries and cycle checks as blocking CI checks / B) Documented convention only.
   - Recommendation: A, because a rule nobody checks gets broken as the app grows large (the stated goal).
   - Impact if undecided: boundary erosion that is costly to repair.

## Risks and assumptions
- Assumption: Docker is available on every developer machine and CI runner (required by Supabase CLI local stack).
- Assumption: epic 002 follows the direction of shared-schema multi-tenancy with RLS and `SECURITY DEFINER` membership helpers; foundations must not contradict it.
- Risk: Supabase local stack is heavy in CI (startup time, memory); mitigate by running it only in the integration/E2E job and caching images.
- Risk: library versions (Next.js, `@supabase/ssr`, ESLint flat config, plugins) change quickly; the developer must verify against current official docs when pinning, and pin versions with a lockfile.
- Risk: over-building the design system and tooling in an epic with no features; keep it to what 002 screens need.
- Assumption: no secrets are needed in 001 beyond local Supabase default keys, which are not sensitive but must not be mistaken for cloud keys.

---

# Review by architect — 001-foundations — round 2

## Summary
The PO's answers are workable and I accept them: Drizzle + RLS through one centralized transaction function is a sound pattern, provided the database role and the exports make "forgot to use the wrapper" fail closed instead of silently bypassing RLS. No blockers. Biggest design issues to settle in ADRs: (1) which role the app connects as, (2) single ownership of migrations (SQL-first, Drizzle schema derived), (3) the JWT must be verified before it becomes the security context (Drizzle's own docs example only decodes it). One conflict: Q3 says no cloud Supabase project, Q5 says deploy to Vercel; a deployed app must not depend on a database that does not exist.

## Concerns and gaps
- [important] ORM + RLS silently fails open if the app connects as `postgres` (table owner / BYPASSRLS-like power) and one query forgets the wrapper. Touches Q4 answer, FND-HR-10. Fix by role design below, not by discipline.
- [important] Drizzle docs (https://orm.drizzle.team/docs/rls, checked 2026-11-12) show the token being decoded, not verified, and `SET LOCAL ROLE` taken from the token. We must never derive the role from the token and must only accept claims from a verified session (`supabase.auth.getUser()` or `getClaims()`), plus a server-validated tenant.
- [important] Two migration tools (Supabase CLI, drizzle-kit) can both claim `supabase/migrations`. Drizzle's `0000_name.sql` + `meta/_journal.json` format is not the Supabase `<timestamp>_name.sql` format, and drizzle cannot express `SECURITY DEFINER` functions, triggers, grants and role setup that epic 002 needs. One owner is required.
- [important] Supabase's Data API (PostgREST) stays exposed with the anon key by default. With Drizzle as the only data path it is unneeded attack surface, and a second, unreviewed data path.
- [important] Q3 (no cloud project) vs Q5 (deploy to Vercel): `/api/health` reaching the DB cannot pass in production without a cloud database or a different DB. Serverless on Vercel also cannot use Supabase's direct connection reliably (IPv6 only); it needs the pooler in transaction mode, which requires `prepare: false` with postgres-js and makes `SET LOCAL` (transaction-scoped only) the only safe way to set context.
- [important] Q5 with Q6 (no branches, deploy from push): if the deploy job does not depend on the CI jobs, a push that fails lint or tests still reaches production. Also Vercel's own Git integration would deploy in parallel with the Actions deploy.
- [minor] Two type sources (`supabase gen types` and Drizzle inferred types) would drift. Supabase types are only useful for `supabase-js` data calls, which we do not want.
- [minor] Round 1 RLS test approach ("Vitest through the supabase client") is superseded: tests must go through the same `withRls` path production uses.
- [minor] Drizzle schema placement conflicts with "modules own their data": tables have cross-module FKs (memberships -> tenants, users), so per-module schema files create import cycles.

## Proposals
Items marked "suggestion" go beyond the stated requirements and need approval. Everything else follows from the PO's decisions.

1. **Security context function (ADR: data access with Drizzle + RLS).**
   - One `withRls(ctx, fn)` in `src/db/rls.ts`: opens `db.transaction`, runs `select set_config('request.jwt.claims', $claims, true)`, `set_config('request.jwt.claim.sub', $sub, true)`, optionally `set_config('app.current_tenant', $tenantId, true)`, and `set local role authenticated` with the role a hard-coded constant (never from the token), then runs `fn(tx)`. `true` = transaction-local, so nothing leaks across pooled connections.
   - Queries must use the `tx` passed in. The raw `db` handle is not exported from the package entry point (`src/db/index.ts` exports `withRls`, schema, and types only). Lint (`no-restricted-imports`) forbids importing the raw client file anywhere except `src/db`.
   - `ctx` is a `VerifiedContext` type (userId, claims, optional tenantId) built only by server code after `getUser()`/`getClaims()` and, for tenant, after a membership check. In 001 only the type, the function and a test helper exist; the real constructor arrives in 002 (auth module).
   - Tenant setting is a selector, not a credential: policies (002) must check real membership for that tenant via a `SECURITY DEFINER` helper, so a forged setting grants nothing.
   - Anonymous/public queries use `ctx = anon` variant (`set local role anon`), same function.
   - Atomicity: one `withRls` call per use case; compose multi-step writes inside one callback or in a database function. No external network calls inside the callback.
2. **Role grants (fail closed).**
   - Migration creates a dedicated login role `app_backend`: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, no privileges on app tables, only the right to switch to `authenticated` and `anon` (`GRANT authenticated, anon TO app_backend` with no inherit and set allowed: `WITH INHERIT FALSE, SET TRUE` on PG16+, `NOINHERIT` on older; check the Postgres major in `config.toml`). Forgetting `withRls` then produces "permission denied", not a data leak.
   - `DATABASE_URL` for the app points to `app_backend`. Password is set outside migrations (local: seed/setup script; cloud: set manually). Migrations and drizzle-kit run as `postgres` via a separate `DATABASE_MIGRATION_URL` (never deployed to Vercel).
   - Table privileges are granted explicitly to `authenticated` per table in the migration that creates it; `anon` gets none on app tables. Optional: `ALTER DEFAULT PRIVILEGES` to stop auto-granting to `anon`.
   - `service_role` key is not used by Drizzle and is not provisioned in 001 (no code needs it). If epic 002 needs the Auth admin API, it goes into one `server-only` file with a lint allowlist. No `bypass` Drizzle handle exists.
3. **Migration ownership (ADR: Supabase local-first and migrations).**
   - SQL-first: hand-written SQL in `supabase/migrations/<timestamp>_name.sql` is the single source of truth, applied by Supabase CLI (`db reset` locally and in CI, `db push` for cloud). It owns tables, RLS, policies, functions, grants, roles, triggers.
   - Drizzle is a typed mirror: `drizzle-kit pull` writes `src/db/schema/*` (generated, committed, header "do not edit"); hand-written relations and helpers live in separate files. CI step: after `supabase db reset`, run `pull` and fail on `git diff` (the equivalent of a gen-types drift check). `drizzle-kit generate/migrate/push` are not used. Verify in the ADR that `pull` output is stable and which policy/role entities it emits (`entities.roles` is off by default and needs `provider: 'supabase'` to skip built-in roles).
   - Rejected: drizzle-kit as owner (cannot express DEFINER functions/grants cleanly, journal format clash); dual ownership (guaranteed drift). Skip `supabase gen types`; Drizzle inferred types are the model types (suggestion: revisit only if `supabase-js` is ever used for data).
4. **Layout impact.**
   ```
   src/
     app/        routing only; calls module public APIs
     modules/<name>/  index.ts, actions/, queries/ (Drizzle via withRls), schemas/ (Zod), components/
     db/         client.ts (private), rls.ts, schema/ (generated), index.ts
     lib/        env.ts, supabase/ (auth clients only), utils; domain-free
   ```
   Dependency rules (lint): `db` imports nothing from `modules`; `modules` import `@/db` and `@/lib`; `app` and components never import `@/db` (data goes through module APIs); `lib` imports neither. `supabase-js` is for Auth only: restrict `.from()`/`.rpc()` data calls by lint (`no-restricted-syntax`) so there is one data path.
5. **Disable the Data API (suggestion, small).** Set `[api]` exposed schemas empty (or disable the Data API in the cloud project) so the anon key cannot reach tables at all; Auth endpoints are unaffected. Defense in depth on top of RLS. Needs PO ok because it is a Supabase configuration choice.
6. **Connection settings.** Local and CI: direct `postgres://app_backend@127.0.0.1:54322`. Vercel: Supabase pooler, transaction mode (port 6543), `postgres-js` with `prepare: false`, small pool (`max: 1` per serverless instance). Driver: `postgres-js` (suggestion; Drizzle supports it and it handles the pooler flag simply).
7. **Deployment (Vercel from GitHub Actions).**
   - Workflow: `ci` jobs (lint, typecheck, unit, DB/integration with `supabase start`, E2E, build, gitleaks) run on every push; `deploy` job `needs:` all of them, runs only on the single branch, using `vercel pull` / `vercel build` / `vercel deploy --prebuilt --prod`. Vercel's Git auto-deploy is turned off (`git.deploymentEnabled: false` in `vercel.json`) so there is exactly one deploy path. If the PO truly wants deploy regardless of CI result, that is a one-line change, but I recommend gating.
   - GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` only. App env on Vercel: `NEXT_PUBLIC_*` public values and the server `DATABASE_URL` once a cloud DB exists. `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_MIGRATION_URL` are never set on Vercel or in CI deploy.
   - No cloud DB in 001 (default, resolves the Q3/Q5 conflict): the deployed hello-world page and a `/api/health` that reports "app up" without touching the DB. The DB check (`/api/health?db=1` or a separate test) runs locally and in CI against local Supabase. `env.ts` marks DB variables optional in a way that does not break the Vercel build until a cloud DB exists (document it); validation still fails fast at runtime when a module needs them.
8. **Tests.** DB harness runs RLS tests through `withRls` with hand-made claims (no app tables needed in 001: assert `current_user = 'authenticated'` and `auth.uid()` inside the tx, assert both are reset after commit, assert a query without `withRls` is denied for `app_backend`, assert a table created in a test migration without a policy returns zero rows). CI check "every table in `public` has RLS enabled" (query `pg_tables.rowsecurity`) is added now, vacuous until 002 and enforced after.
9. **ADRs to write now (after PM spec is drafted or in parallel):**
   - 0001 Code structure and layering (modules, no repository layer, `db` area, lint-enforced boundaries).
   - 0002 Supabase local-first, SQL-first migrations, Drizzle schema as derived mirror (ownership and drift check).
   - 0003 Data access: Drizzle + RLS via `withRls`, role model (`app_backend` / `authenticated` / `anon`), verified-claims rule, service-role policy.
   - 0004 Environment and secrets: typed `env.ts`, public vs server vars, Vercel/GitHub secret inventory, Supabase client factories (Auth only).
   - 0005 Tenant isolation direction (shared schema + `tenant_id` + RLS + membership helpers), as the declared target for 002, including the `app.current_tenant` selector rule.
   - Deployment (Vercel via Actions) is a two-way door: a short section in `docs/architecture.md`, no ADR. UI stack ADR remains joint with ui-ux-designer.

## Questions for the client
None that block the spec. Defaults below will be written into the spec unless the PO objects (the PM may surface them as confirmations):
- Deployed hello world does not use a database (no cloud Supabase project in 001).
- The deploy job runs only when all CI jobs pass.
- Disabling the Supabase Data API (Proposal 5) is accepted as a hardening step; otherwise it stays on and RLS alone protects it.

## Risks and assumptions
- Risk: the Drizzle RLS helper and `drizzle-kit pull` behavior for policies/roles are version-sensitive; the developer must verify against current docs when pinning and keep the drift check as the safety net.
- Risk: pooler transaction mode has no session state and a per-transaction cost of 3-4 extra statements; acceptable for an MVP. Not optimizing it now.
- Risk: roughly 50 tables means policy repetition; mitigated by standard policy templates and the membership helper in 002. Not designed in 001.
- Risk: tests that mock the DB would hide RLS bugs; DB tests must hit the real local Postgres.
- Risk: `app_backend` role needs per-environment password handling; document it in the README and `.env.example`, never in a migration.
- Assumption: Supabase Auth remains the only identity source; Drizzle never writes to the `auth` schema (reads are via `auth.users` FK references only).
- Assumption: Supabase pooler username format and port settings must be taken from the cloud project dashboard when the cloud DB is created (out of scope for 001).
- Assumption: the PO accepts that this reverses round 1 recommendation "no ORM"; the layering ADR stays valid (Drizzle queries live inside module `queries/`, no repository layer).
