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
1. `select set_config('request.jwt.claims', $claims, true)` and `set_config('request.jwt.claim.sub', $sub, true)` (third argument `true` = transaction-local; `SET LOCAL` cannot take bind parameters). The stored claims always have `sub` and `role` overwritten with the verified user id and `authenticated`, so a forged `sub`/`role` in `ctx.claims` is discarded. The legacy GUC `request.jwt.claim.sub` is load-bearing: this Supabase `auth.uid()` reads it first (then `claims->>'sub'`), and a mutation test showed that removing it breaks `auth.uid()`. It stays.
2. Optionally `set_config('app.current_tenant', $tenantId, true)`.
3. `set local role authenticated`. The role comes from a fixed two-entry table (`authenticated`, `anon`) of pre-built statements (`sql.raw` on constants only); there is no fallback and nothing from a token or input reaches the SQL text. `withAnonymousRls(fn)` is a separate exported function that runs as `anon` with claims `{"role":"anon"}`, no user and no tenant, so "no user" can never be reached by passing an empty id to `withRls`.
4. Runs `fn(tx)`; queries must use `tx`. Commit or rollback resets everything.
One `withRls` call per use case; multi-step writes live in one callback or in a database function. No external network calls inside the callback.

**Exports.** `src/db/index.ts` exports `withRls`, `withAnonymousRls`, the types `VerifiedContext` and `RlsTransaction`, and the schema tables. The raw client (`src/db/client.ts`) is not exported; lint (`no-restricted-imports`, FND-T-37) forbids importing it outside `src/db`. The client is a memoized lazy `getDb()` (created on first use, still one private `server-only` instance), not a module-scope constant: `next build` imports every route module and `DATABASE_URL` is optional in production (ADR 0004), so an eager client broke builds without a database.

**Verified claims only.** `ctx` is a `VerifiedContext` (userId, claims, optional tenantId) constructed only by server code after `supabase.auth.getUser()` or `getClaims()` (validated, not a plain decode of the cookie) and, for tenant, after a membership check. `withRls` refuses to run with missing or empty user. In 001 the type, function and a test helper exist; the real constructor arrives in epic 002 (auth module).

**Tenant selector is not a credential.** `app.current_tenant` only selects which tenant a request targets. Policies (epic 002) must verify real membership through a `SECURITY DEFINER` helper, so a forged setting grants nothing.

**Roles (migration in 001).** Dedicated login role `app_backend`: `LOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, `NOINHERIT`, not owner of any table, no privileges on app tables, only membership in `authenticated` and `anon` so it can `SET ROLE` to them (on PG16+ may use `WITH INHERIT FALSE, SET TRUE`; check the Postgres major in `config.toml`). Forgetting `withRls` therefore yields "permission denied", not a leak. Table privileges are granted explicitly to `authenticated` in the migration that creates each table; `anon` gets none on app tables. The migration revokes the default table and sequence privileges Supabase gives `anon`/`authenticated` in `public`, **for the owner `postgres` only** (see Amendment for the residual `supabase_admin` case). Passwords are never in migrations: locally set in `seed.sql`/setup script (non-secret local value), in cloud set manually.

**Service role.** `SUPABASE_SERVICE_ROLE_KEY` is not provisioned in 001. If epic 002 needs the Auth admin API it goes in one `server-only` file with a lint allowlist. Drizzle never uses it; no bypass handle exists. Drizzle never writes to the `auth` schema (FK references only).

**Data API disabled.** Set `[api] enabled = false` locally (config.toml; documented option, default true) and turn off "Enable Data API" in the cloud project when it exists, so the anon key cannot reach tables at all. Auth endpoints are unaffected. `supabase-js` and `@supabase/ssr` are used for Auth only; lint (`no-restricted-syntax`) blocks `.from()` / `.rpc()` data calls. This hardening was proposed by the architect in round 2 and is not among the PO's round 2 confirmations; it is recorded here as accepted but flagged for explicit PO confirmation (the alternative, leaving the Data API on, relies on RLS alone for that path).

**Connections.**
- `DATABASE_URL` (runtime): role `app_backend`. Local and CI: direct `127.0.0.1:54322`. Cloud/Vercel (later): Supabase pooler, transaction mode, port 6543, username format from the dashboard (`<role>.<project-ref>` pattern; verify when created), SSL required.
- Driver: `postgres` (postgres-js) with `prepare: false` for the pooled URL and a small pool (`max: 1` per serverless instance, client created once and memoized, lazily). Supabase docs recommend exactly this for serverless.
- `DATABASE_MIGRATION_URL`: role `postgres`, used only by Supabase CLI and `drizzle-kit pull`; never set on Vercel or in the deploy job.
- Test connections must match the runtime connection type where possible; pool size 1 is used in tests to force connection reuse.

**Required tests (`test:db`, real local Postgres, never mocked), all through `withRls`.** Numbering follows the spec (FND-FR-10) and the test titles; the ADR's first draft numbered items 9 and 10 differently, which this table resolves.

| # | Behavior | Test file |
|---|----------|-----------|
| 1 | Inside the callback `current_user = 'authenticated'`, `auth.uid()` equals the supplied sub, other claims reach the database; forged `sub`/`role` are overwritten | `tests/db/with-rls-context.test.ts` |
| 2 | After commit and after rollback the next transaction on the same connection has the default role and no claims (pool size 1) | `with-rls-context.test.ts` |
| 3 | Parallel calls with different users never see each other's claims (a second, pooled client of 8 built in the test; `client.ts` unchanged) | `with-rls-parallel.test.ts` |
| 4 | Throwaway table with membership-based RLS: tenant A cannot select/insert/update/delete tenant B rows; anon and no-membership denied; tampered tenant id rejected by `WITH CHECK`; forged context grants nothing | `tenant-isolation.test.ts` |
| 5 | `withRls` refuses missing, empty or non-UUID user and never falls back to a privileged role | `with-rls-context.test.ts` |
| 6 | `app_backend` is not superuser, not `BYPASSRLS`, owns nothing, can `SET ROLE` only to `authenticated`/`anon` (catalog) | `app-backend-role.test.ts` |
| 7 | An error in the callback rolls back and resets context | `with-rls-context.test.ts` |
| 8 | A query without `withRls` as `app_backend` is denied | `with-rls-context.test.ts`, `app-backend-role.test.ts` |
| 9 | A table without a policy returns zero rows through `withRls` | `schema-guard.test.ts` |
| G | Schema guard (FND-FR-22): every `public` table has RLS enabled and a policy except an allowlist; queries the catalog; the guard itself is tested | `schema-guard.test.ts`, `tests/utils/schema-guard.ts` |
| L | Lint fixture proves the raw-client import restriction (FND-FR-12) | FND-T-38 (not yet written) |

## Consequences
- Positive: fail-closed by role design, not discipline; one reviewed data path; tests cover the single point of failure.
- Negative: 3-4 extra statements and a transaction per request (acceptable for an MVP; may be batched later); role and grant management is manual SQL; password handling per environment must be documented in README and `.env.example`.
- Risk: the function is the single point of failure for isolation; a mistake is a cross-tenant breach. Tests above are mandatory acceptance criteria. Policy repetition across ~50 tables is mitigated by standard policy templates in 002, not designed here.
- Pooler behavior was exercised only locally (see Amendment); the cloud pooler, its username format and SSL must be re-verified when a project exists.
- Revisit if `withRls` overhead becomes material, or if Drizzle ships a first-class verified-RLS helper.

## Amendment (FND-T-18, 2026-11-12): review findings and verified facts
Reviewed against the code and the running stack (Supabase CLI 3.1.0, Postgres 17). 194 `test:db` tests pass.

**Verified**
- `app_backend`: no superuser, no `BYPASSRLS`, `NOINHERIT`, owns nothing, `SET ROLE` only to `authenticated`/`anon` (`postgres`, `service_role`, `supabase_admin`, `SET SESSION AUTHORIZATION` refused with 42501). `authenticated` and `anon` are members of no other role, so a role switch cannot chain upward.
- From inside a callback, `RESET ROLE` returns to `app_backend` (no privileges) and `SET ROLE anon` lowers privileges: neither escalates.
- Data API off: `GET :54321/rest/v1/` and `/graphql/v1` return 503. This covers PostgREST and GraphQL only. Storage (`/storage/v1`, 200) and Realtime stay enabled locally; they do not expose app tables, and the `supabase_realtime` publication is empty. Epic 002 must not add a table to that publication without a decision.
- Transaction pooler: with `[db.pooler] enabled = true` (local Supavisor 2.10.0, transaction mode, port 54329, user `app_backend.pooler-dev`) the full `test:db` suite passed 194/194 through the pooler with `prepare: false`. This is the only pooler evidence and it is local (the config change was reverted).

**Rules that follow (also for epic 002)**
- Never call `withRls` (or any `getDb()` query) from inside another `withRls` callback: with `max: 1` the inner transaction waits for the connection the outer one holds and hangs (reproduced: 4 s+ with no result). One `withRls` per use case.
- Never use session state through the app connection: no `set_config(..., false)`, plain `SET`, `SET ROLE` without `LOCAL`, advisory session locks, `LISTEN`. They break under transaction pooling and can leak across users.
- Raw SQL with request input is forbidden. A callback can run any SQL, including `set_config('request.jwt.claims', ...)`, so isolation holds only for code that uses Drizzle builders or parameterized `sql`. T-37 should also restrict `sql.raw` to `src/db/rls.ts`.
- `app.current_tenant` is not validated as a UUID by `withRls` (only non-empty). Policies must read it with `nullif(current_setting('app.current_tenant', true), '')::uuid`; a bad value then fails closed with a cast error. It reads `''` (not NULL) once set on a connection.
- An `INSERT ... RETURNING` also needs a passing SELECT policy. Every real table needs explicit `GRANT`s plus RLS in its own migration (default privileges were revoked for `postgres`).

**Residual risks**
- Default privileges are revoked only for the owner `postgres`. `postgres` cannot change `supabase_admin`'s defaults (42501), and a table created in `public` as `supabase_admin` is still auto-granted to `anon`/`authenticated` (reproduced). Acceptable because migrations, Studio SQL and the CLI run as `postgres`. Mitigations: never create objects as `supabase_admin`; the schema guard already fails such a table unless it has RLS and a policy; add a catalog test that `anon` holds no privilege on any `public` table or sequence (open issue 3).
- Default privileges on **functions** were not revoked: a function created by `postgres` in `public` is executable by `anon`, `authenticated` and PUBLIC (reproduced). Epic 002's `SECURITY DEFINER` membership helpers need an explicit `revoke execute ... from public, anon` and `grant execute ... to authenticated`, or a default-privilege revoke for functions (open issue 2).
- `statement_timeout` is not applied: role-level settings of `authenticated` (8s) and `anon` (3s) apply at login, not on `SET ROLE`, and `app_backend` has none, so queries are unbounded (verified: `show statement_timeout` = 0 inside `withRls`). Open issue 1.
- `/api/health/db` is an unauthenticated route that opens a database transaction per request; `postgres` defaults give a 30 s connect timeout. Acceptable for an MVP; no cloud database exists yet.

**Import exception.** `src/app/api/health/db/route.ts` is the single file in `app` allowed to import `@/db` (`withAnonymousRls`). The T-37 lint rule must allow exactly that path and T-38 must test that another `app` file importing `@/db` is reported.

**Re-verify when a cloud project exists:** see the list in the FND-T-18 review (pooler username `app_backend.<ref>` and password set manually, SSL in the URL, `GRANT ... WITH INHERIT FALSE, SET TRUE` and `CREATE ROLE` allowed for the cloud `postgres`, Data API toggle, Postgres 17, default privileges and function grants as in local, pool saturation with `max: 1` per instance, timeouts, rerun `test:db` through port 6543).

## Open issues
1. No statement or idle-in-transaction timeout for `app_backend`. Options: `alter role app_backend set statement_timeout = '8s'` (and `idle_in_transaction_session_timeout`) in a new migration, asserted by a catalog test on `pg_roles.rolconfig`; or `set_config('statement_timeout', '8s', true)` inside `withRls` (pooler-safe, costs a statement). Recommended: the role-level migration. Decision: PO or architect, task before epic 002.
2. Function default privileges (see Residual risks). Recommended: decide in the first epic 002 migration; revoke by default for `anon` and PUBLIC.
3. No test asserts that `anon` has no table/sequence privileges in `public`. Recommended small tester task.

## References
- Drizzle RLS (token example decodes only; `createDrizzle` is an external example): https://orm.drizzle.team/docs/rls (checked 2026-11-12)
- Supabase connecting to Postgres (pooler transaction mode 6543, IPv6 direct, prepared statements off, serverless pool size 1): https://supabase.com/docs/guides/database/connecting-to-postgres (checked 2026-11-12)
- Supabase roles (custom roles, login roles): https://supabase.com/docs/guides/database/postgres/roles (checked; the page does not cover granting `anon`/`authenticated` to a custom role or BYPASSRLS semantics, so the `app_backend` grant pattern is from PostgreSQL documentation and general knowledge and must be proven by tests 1-8 on the pinned local stack)
- Supabase securing your API (Data API toggle in Dashboard): https://supabase.com/docs/guides/api/securing-your-api (checked)
- Supabase CLI config (`[api] enabled`, `schemas`): https://supabase.com/docs/guides/local-development/cli/config (checked)
