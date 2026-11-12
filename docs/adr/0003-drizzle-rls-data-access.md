# 0003. Data access with Drizzle and RLS through a single `withRls` function

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
PO decision (epic 001 Q4): Drizzle ORM for PostgreSQL access, Supabase Auth for identity, PostgreSQL RLS for tenant isolation, one centralized function runs every query in a transaction in the user's security context (`set local role` plus `request.jwt.claims`), only after the JWT and tenant are verified. Tenant isolation now depends on one function and on database roles, so this is the highest-risk decision of the epic. Known pitfalls: if the app connects as `postgres` (owner/superuser power) a query that forgets the wrapper bypasses RLS silently; Drizzle's documented example decodes the token without verifying it and takes the role from the token; the Supabase Data API (PostgREST) is a second, unreviewed data path; Supabase's transaction pooler has no session state and no prepared statements.

## Options considered
1. **Drizzle + `withRls` + dedicated fail-closed role (chosen).** Pros: one data path, failure mode is "permission denied". Cons: 3-4 extra statements per transaction.
2. **Drizzle as `postgres` with `withRls` by convention.** Pros: trivial setup. Cons: fails open; one forgotten wrapper leaks every tenant. Rejected.
3. **`supabase-js` for data (PostgREST) with user JWT.** Pros: RLS applied natively, no role setup. Cons: contradicts the PO's ORM decision; second type system. Rejected.
4. **Application-level `WHERE tenant_id` filters only.** Violates the multi-tenancy rule (RLS must enforce). Rejected.

Connection type:
- (a) Direct connection everywhere: simple, but IPv6-only on Supabase cloud and unreliable on Vercel serverless.
- (b) Pooler transaction mode (port 6543) in cloud, direct locally.
- (c) Pooler session mode: IPv4, supports prepared statements, but holds a connection per client, poor for serverless.

## Decision
Option 1 with connection choice (b).

**Single entry point.** `src/db/rls.ts` exports `withRls(ctx, fn)`. It opens `db.transaction`, then:
1. `select set_config('request.jwt.claims', $claims, true)` and `set_config('request.jwt.claim.sub', $sub, true)` (third argument `true` = transaction-local; `SET LOCAL` cannot take bind parameters).
2. Optionally `set_config('app.current_tenant', $tenantId, true)`.
3. `set local role authenticated` (or `anon` for the anonymous variant). The role is a hard-coded constant, never read from a token or any input.
4. Runs `fn(tx)`; queries must use `tx`. Commit or rollback resets everything.
One `withRls` call per use case; multi-step writes live in one callback or in a database function. No external network calls inside the callback.

**Exports.** `src/db/index.ts` exports `withRls`, schema tables and types. The raw client (`src/db/client.ts`) is not exported; lint (`no-restricted-imports`) forbids importing it outside `src/db`.

**Verified claims only.** `ctx` is a `VerifiedContext` (userId, claims, optional tenantId) constructed only by server code after `supabase.auth.getUser()` or `getClaims()` (validated, not a plain decode of the cookie) and, for tenant, after a membership check. `withRls` refuses to run with missing or empty user. In 001 the type, function and a test helper exist; the real constructor arrives in epic 002 (auth module).

**Tenant selector is not a credential.** `app.current_tenant` only selects which tenant a request targets. Policies (epic 002) must verify real membership through a `SECURITY DEFINER` helper, so a forged setting grants nothing.

**Roles (migration in 001).** Dedicated login role `app_backend`: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, `NOINHERIT`, not owner of any table, no privileges on app tables, only membership in `authenticated` and `anon` so it can `SET ROLE` to them (on PG16+ may use `WITH INHERIT FALSE, SET TRUE`; check the Postgres major in `config.toml`). Forgetting `withRls` therefore yields "permission denied", not a leak. Table privileges are granted explicitly to `authenticated` in the migration that creates each table; `anon` gets none on app tables. Consider `ALTER DEFAULT PRIVILEGES` so new tables are not auto-granted to `anon`. Passwords are never in migrations: locally set in `seed.sql`/setup script (non-secret local value), in cloud set manually.

**Service role.** `SUPABASE_SERVICE_ROLE_KEY` is not provisioned in 001. If epic 002 needs the Auth admin API it goes in one `server-only` file with a lint allowlist. Drizzle never uses it; no bypass handle exists. Drizzle never writes to the `auth` schema (FK references only).

**Data API disabled.** Set `[api] enabled = false` locally (config.toml; documented option, default true) and turn off "Enable Data API" in the cloud project when it exists, so the anon key cannot reach tables at all. Auth endpoints are unaffected. `supabase-js` and `@supabase/ssr` are used for Auth only; lint (`no-restricted-syntax`) blocks `.from()` / `.rpc()` data calls. This hardening was proposed by the architect in round 2 and is not among the PO's round 2 confirmations; it is recorded here as accepted but flagged for explicit PO confirmation (the alternative, leaving the Data API on, relies on RLS alone for that path).

**Connections.**
- `DATABASE_URL` (runtime): role `app_backend`. Local and CI: direct `127.0.0.1:54322`. Cloud/Vercel (later): Supabase pooler, transaction mode, port 6543, username format from the dashboard (`<role>.<project-ref>` pattern; verify when created), SSL required.
- Driver: `postgres` (postgres-js) with `prepare: false` for the pooled URL and a small pool (`max: 1` per serverless instance, client created once at module scope). Supabase docs recommend exactly this for serverless.
- `DATABASE_MIGRATION_URL`: role `postgres`, used only by Supabase CLI and `drizzle-kit pull`; never set on Vercel or in the deploy job.
- Test connections must match the runtime connection type where possible; pool size 1 is used in tests to force connection reuse.

**Required tests (`test:db`, real local Postgres, never mocked), all through `withRls`:**
1. Inside the function `current_user = 'authenticated'` and `auth.uid()` equals the supplied sub; claims equal those supplied.
2. After commit and after rollback the next transaction on the same connection has the default role and no claims (pool size 1).
3. Parallel calls with different users on a small pool never see each other's claims.
4. A throwaway table (created in test setup, not in migrations) with RLS and a membership-based policy: user of tenant A cannot select/insert/update/delete tenant B rows; anon and no-membership users denied; tampered tenant id rejected by `WITH CHECK`.
5. `withRls` refuses missing/empty user and never falls back to a privileged role.
6. `app_backend` is not superuser, not `BYPASSRLS`, not a table owner (`pg_roles`).
7. An error thrown in the callback rolls back and resets context.
8. A query without `withRls` as `app_backend` is denied.
9. Schema guard: every table in `public` has RLS enabled and at least one policy, except an explicit allowlist (vacuous until 002).
10. Lint fixture proves the raw-client import restriction.

## Consequences
- Positive: fail-closed by role design, not discipline; one reviewed data path; tests cover the single point of failure.
- Negative: 3-4 extra statements and a transaction per request (acceptable for an MVP; may be batched later); role and grant management is manual SQL; password handling per environment must be documented in README and `.env.example`.
- Risk: the function is the single point of failure for isolation; a mistake is a cross-tenant breach. Tests above are mandatory acceptance criteria. Policy repetition across ~50 tables is mitigated by standard policy templates in 002, not designed here.
- Pooler behavior and the pooled username format could not be exercised (no cloud project); re-verify when one is created.
- Revisit if `withRls` overhead becomes material, or if Drizzle ships a first-class verified-RLS helper.

## References
- Drizzle RLS (token example decodes only; `createDrizzle` is an external example): https://orm.drizzle.team/docs/rls (checked 2026-11-12)
- Supabase connecting to Postgres (pooler transaction mode 6543, IPv6 direct, prepared statements off, serverless pool size 1): https://supabase.com/docs/guides/database/connecting-to-postgres (checked 2026-11-12)
- Supabase roles (custom roles, login roles): https://supabase.com/docs/guides/database/postgres/roles (checked; the page does not cover granting `anon`/`authenticated` to a custom role or BYPASSRLS semantics, so the `app_backend` grant pattern is from PostgreSQL documentation and general knowledge and must be proven by tests 1-8 on the pinned local stack)
- Supabase securing your API (Data API toggle in Dashboard): https://supabase.com/docs/guides/api/securing-your-api (checked)
- Supabase CLI config (`[api] enabled`, `schemas`): https://supabase.com/docs/guides/local-development/cli/config (checked)
