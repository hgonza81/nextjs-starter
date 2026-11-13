# 0002. Supabase local-first and SQL-first migrations

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
The PO decided: no cloud Supabase project yet; local development and CI use the Supabase CLI with Docker; the app runs on the host (epic 001 Q3, Q5, round 2 confirmations). Drizzle ORM is also adopted (ADR 0003), which introduces a second tool, `drizzle-kit`, able to produce migrations. Epic 002 needs things Drizzle cannot express cleanly: `SECURITY DEFINER` functions with fixed `search_path`, triggers (profile creation), role creation and grants, RLS policies on `auth.uid()`. Tests must run against the migrations exactly as they will be applied in production. The developer (round 2) proposed Drizzle schema as source of truth with `drizzle-kit generate` writing into `supabase/migrations`, falling back to hand-written SQL plus `pull` if generated policy SQL is poor. The architect (round 2) proposed SQL-first with Drizzle derived.

## Options considered
1. **SQL-first (architect).** Hand-written `supabase/migrations/<timestamp>_name.sql` is the only source of truth, applied by Supabase CLI. `drizzle-kit pull` generates `src/db/schema/` from the database; CI fails on drift. Pros: one owner, no format clash, full SQL expressiveness (functions, grants, roles, triggers), tests hit real applied migrations. Cons: tables are written in SQL and again (generated) in TS; reviewers read SQL.
2. **Drizzle-first (developer).** Drizzle schema is the source; `drizzle-kit generate` writes into `supabase/migrations`; hand-written SQL via `--custom` for the rest. Pros: schema authored in TS. Cons: two authoring styles interleaved in one migration folder, journal (`meta/_journal.json`, `0000_` naming) versus Supabase timestamp naming, reliance on `migrations.prefix` behavior and on generated policy SQL quality across ~50 tables, drift is hard to reason about. The developer's own fallback is option 1.
3. **Dual ownership (both tools write migrations).** Guaranteed drift. Rejected.
4. **Cloud-first (develop against a hosted project).** Rejected by PO: shared state, no disposable DB for RLS tests in CI.

## Decision
**Option 1, SQL-first.** This resolves the developer-vs-architect proposals in favor of the developer's own stated fallback: the first option's main risk (generated policy SQL quality at ~50 tables, mixed authoring) is the one we avoid by never letting drizzle-kit write migrations. The Drizzle schema is a typed mirror, not an authority.

- Local and CI: Supabase CLI + Docker. `supabase start`, then `supabase db reset` applies all migrations and `seed.sql` (single command). The CLI is the exact devDependency `supabase@3.1.0` (no global install; scripts `db:start`, `db:stop`, `db:reset`, `db:status`). Local Postgres is major 17 (`[db] major_version = 17` in `supabase/config.toml`; the CLI default is 15); the cloud project must be created on 17 too (re-verify then).
- Every migration that creates a table also enables RLS, adds policies, and grants privileges explicitly, in the same file. Small, forward-only, reviewed.
- `drizzle-kit pull` (connection as the migration role, `schemaFilter: ['public']`) writes `src/db/schema/` (generated, committed, header "generated, do not edit"). It is run only through `pnpm db:schema` (`scripts/db-schema.mts`, see Amendment). Hand-written relations/helpers live in separate files; `src/db/schema/index.ts` is hand-written. `drizzle-kit generate`, `migrate` and `push` are never used (documented; the `drizzle.config.ts` must not point `out` at `supabase/migrations`).
- CI drift check in the DB job: `supabase db reset`, then `pnpm db:schema`, then `git diff --exit-code src/db`. Primary safety net against pull instability. It needs `DATABASE_MIGRATION_URL` set in CI.
- Types: Drizzle inferred types are the model types. `supabase gen types` is not used unless `supabase-js` is ever used for data (it is not; ADR 0003).
- Docker scope: only what the Supabase CLI needs. The app is not containerized in development. A production Dockerfile is not needed (Vercel).
- CI starts the local stack with unneeded services excluded where the pinned CLI supports it, and keeps the DB/E2E job separate from the fast job.
- Cloud: when a project exists, `supabase db push` (or the linked workflow) applies the same migrations. Not in scope for 001.

## Consequences
- Positive: one migration owner; the test database equals production schema; SQL features of epic 002 need no workaround; Supabase CLI flow stays standard.
- Negative: schema is written in SQL, TS mirror regenerated after each migration (one command, enforced by drift check). Developers need SQL fluency.
- Risk: `drizzle-kit pull` output must be stable and handle policies/roles acceptably. Verified on 0.31.11 (see Amendment): stable through the wrapper; it does not carry RLS-enabled or grants, so the TS schema must never be used as a security statement. The hand-written-schema fallback was not needed.
- Revisit if pull proves unreliable at scale, or if the team prefers TS-authored schema once Drizzle's migration story for RLS/functions matures (supersede with a new ADR).

## Amendment (FND-T-18, 2026-11-12): verified `drizzle-kit pull` behavior
Verified on `drizzle-kit` 0.31.11 against the real local Postgres 17 (a table with RLS and a policy, a table with RLS and no policy, explicit grants):
- It **emits policies** (`pgPolicy(...)` with `for`, `to`, `using`, `withCheck`) and tables, columns, keys, indexes.
- It does **not** emit the RLS-enabled flag: a table with RLS and no policy has no `.enableRLS()` in the TS output.
- It does **not** emit grants, and emits **roles** only with `entities: { roles: true }`, which adds noisy system roles; left off.
- Consequence: the TS mirror says nothing about security. The schema guard (FND-FR-22) and every grant/RLS check query the catalog (`pg_class.relrowsecurity`, `pg_policies`, privilege functions), never `src/db/schema`.
- `pull` also writes a random `0000_*.sql` introspection file and a `meta/` folder, and its output has no header. `scripts/db-schema.mts` (run by `pnpm db:schema`) deletes the old generated files, runs `drizzle-kit pull`, removes the junk `*.sql` and `meta/`, and prepends the "GENERATED, do not edit" header to `schema.ts` and `relations.ts`. A second run produces an empty `git diff`; confirmed again after `db:reset` in this review. The generated files are ignored by Prettier and ESLint.
- **Validate and restore (FND-T-52).** The script was renamed from `scripts/db-schema.ts` to `scripts/db-schema.mts` (removes the module-type warning without changing the package type; `tsconfig.json` includes `scripts/**/*.mts`). Before touching anything it validates `DATABASE_MIGRATION_URL` (unset, empty, not a URL, or not `postgres:` / `postgresql:` exits 1 with a message pointing to `.env.local` / `.env.example`), because an earlier version deleted the tracked generated files first and then failed. It keeps the previous `schema.ts` and `relations.ts` in memory and restores them if `drizzle-kit pull` fails, so a failed run leaves `git diff` empty. `pnpm db:schema` therefore needs `DATABASE_MIGRATION_URL` (a gitignored `.env.local`, loaded with Node's `--env-file-if-exists`; CI sets it).
- The drift check compares tracked files only: a brand-new generated file would not appear in `git diff`. The wrapper always writes the same two file names, so this holds; if that changes, also check `git status --porcelain -- src/db`.
- Seed: `supabase/seed.sql` sets the local-only `app_backend` password and runs on `db reset`. Never apply it to a cloud project (`supabase db push --include-seed` and `db reset --linked` are forbidden against cloud).

## References
- Drizzle `drizzle-kit pull`: https://orm.drizzle.team/docs/drizzle-kit-pull (checked 2026-11-12: confirms introspection to `schema.ts`, `schemaFilter`, `--init`; the page does not state output stability or policy/role introspection, which FND-T-10 and FND-T-18 verified empirically, see Amendment).
- Drizzle RLS: https://orm.drizzle.team/docs/rls (checked: `entities.roles` off by default, `provider: 'supabase'` and `pgRole(...).existing()` exist; whether `pull` emits policies is not stated; verified empirically: it does).
- Supabase local config: https://supabase.com/docs/guides/local-development/cli/config (`[db] major_version`, default 15; `[api]` options).
- specs/001-foundations/reviews/architect.md and developer.md (round 2), questions.md round 2 confirmations.
