# Verification report: steps 3 and 4 (FND-T-10 to FND-T-18, FND-T-50, FND-T-51)

Task: FND-T-19. Verifier: tester (fresh agent, adversarial). Date: 2026-11-12.
Scope: FND-FR-06 to FND-FR-11, FND-FR-19 to FND-FR-22, FND-NFR-02 (HEAD `45e95fc`).

## Method

- Fresh `git clone` of HEAD into a scratch folder outside the repo; every command and every sabotage ran there. The main working copy was not touched (it still has only the PO's pre-existing uncommitted `tasks.md`).
- System Node 26.13.1, pnpm 12.18.0, Supabase CLI 3.1.0 through the package scripts. No stack was running at the start; the PO container `agent-template-postgres-1` was never touched and is still running. The local stack is stopped at the end (0 supabase containers); no dev or start server is left (checked ports and `next-server` processes).
- The clone shares `project_id` with the main copy, so `db:start` printed "Starting database from backup" (volumes from earlier runs). `db:reset` rebuilds the database anyway, so every result below is from freshly migrated state.
- Sabotage: each mutation was applied in the clone, the relevant suite run, then reverted with `git checkout` and (for migrations/config) `db:reset` again. A final `pnpm test:db` after all reverts was 212/212.
- Nothing was fixed; no production code was committed.

## Results by criterion

| # | Criterion (source) | Result | Evidence |
|---|--------------------|--------|----------|
| 1 | `pnpm install --frozen-lockfile` (FR-02, NFR-06) | PASS | rc 0, lockfile unchanged. |
| 2 | `db:start`, `db:reset` twice (FR-05, FR-08) | PASS | Both resets finish "Finished supabase db reset"; both migrations and `seed.sql` apply. |
| 3 | `db:schema` then `git diff --exit-code` is empty, and stable on a second run (FR-07) | PASS with defect D1 | With `.env.local` copied from `.env.example`: diff empty twice. WITHOUT `.env.local` the command fails (see D1). |
| 4 | `src/db/schema/` has no table definitions; `public` has no tables; only `pull` is used, no `generate/migrate/push` (FR-06, FR-07) | PASS | `schema.ts` and `relations.ts` contain only imports and the "GENERATED" header; `drizzle.config.ts` has `schemaFilter: ['public']`, `out: src/db/schema`; grep for `drizzle-kit generate/migrate/push` finds only prohibitions in comments. The real-schema schema-guard test passes with zero tables. |
| 5 | `pnpm test`: unit, no Docker (FR-19, FR-20) | PASS | 31/31 in 3 files, also with the stack stopped (re-run with 0 containers). |
| 6 | `pnpm test:db` twice in a row (FR-19, FR-21) | PASS | 212/212 in 7 files, 12.9 s, both runs (and a third after all sabotage reverts). |
| 7 | `pnpm test:db` with the stack stopped | PASS | Fails fast with ECONNREFUSED from `db-global-setup.ts`, exit 1 (the Vitest line "No test files found" is misleading, as documented in tests/README). |
| 8 | `pnpm test:e2e` (FR-19, FR-20, NFR-03) | PASS | `playwright install chromium` then 6 passed (8.4 s): health 200 + known body; home h1, axe light and dark, no horizontal scroll at 375 and 1280. |
| 9 | lint, typecheck, format:check, build (FR-02) | PASS | all rc 0. |
| 10 | `GET /api/health` and `/api/health/db`, production start, DB up (FR-11) | PASS | `{"status":"ok"}` 200; `{"status":"ok","role":"anon"}` 200. |
| 11 | Same, DB down (stack stopped while the server runs) | PASS | `/api/health` 200; `/api/health/db` 503 `{"status":"unavailable"}`; server log only "Database health check failed: Error" (grep for `app_backend`, `54322`, `password` in the log: 0 hits). |
| 12 | Same, `DATABASE_*` unset (production start) | PASS | `/api/health` 200; `/api/health/db` 503 `{"status":"unavailable"}`; no connection details in log. |
| 13 | Dev mode, DB down, then DB restarted (FR-11) | PASS | `/api/health` 200, `/api/health/db` 503, then 200 after `db:start` without restarting the server (the memoized client recovers). |
| 14 | Dev mode, `DATABASE_*` unset | PASS (as designed) | The instrumentation hook fails at start naming `DATABASE_URL` and `DATABASE_MIGRATION_URL` ("Required when NODE_ENV is development"); no route answers. This is the step-1 design (required outside production). |
| 15 | `app_backend`: not superuser, no BYPASSRLS, owns nothing, no password in migrations (FR-08, NFR-02) | PASS | Catalog tests in `app-backend-role.test.ts` pass; `grep -i password supabase/migrations` shows only a comment line; the password is only in `seed.sql`. |
| 16 | Server-only values absent from the client bundle (NFR-05, extra) | PASS | Build with a sentinel `DATABASE_URL`: 0 files in `.next/static` mention `SENTINELPW`, `DATABASE_URL`, `DATABASE_MIGRATION` or `app_backend`. A client component importing `@/db/client` fails `next build` (server-only). |

## Requirement coverage (recomputed from tests actually run)

| ID | Tests (files in `tests/db/` unless noted) | Status |
|----|-------------------------------------------|--------|
| FND-FR-06 | typecheck imports `@/db`; schema-guard real-schema test; `db:schema` output | covered (by command evidence plus guard; no dedicated assertion that `src/db/schema/` has no tables, acceptable) |
| FND-FR-07 | `db:schema` + `git diff --exit-code` (manual here, CI drift check owed by T-21) | covered locally; automated drift check arrives in T-21 |
| FND-FR-08 | `app-backend-role.test.ts` (24), `hardening-catalog.test.ts` (18) | covered |
| FND-FR-09 | `src/db/rls.test.ts` (unit), `with-rls-context.test.ts`; lint half (FR-12) not yet built (T-37) | covered except the lint rule (T-37) |
| FND-FR-10 items 1-9 | `with-rls-context.test.ts`, `with-rls-parallel.test.ts`, `tenant-isolation.test.ts` (109), `app-backend-role.test.ts`, `schema-guard.test.ts` | covered (each item caught at least one sabotage below) |
| FND-FR-11 | `tests/e2e/health.spec.ts`, `src/app/api/health/route.test.ts` for liveness; `/api/health/db` has NO automated test (see G1) | liveness covered; DB health covered only by this manual check |
| FND-FR-19 | commands run, README exists | covered |
| FND-FR-20 | one real test per layer; `/design` axe part is T-33 | covered for what exists |
| FND-FR-21 | `harness.test.ts` (9), twice in a row | covered |
| FND-FR-22 | `schema-guard.test.ts` (14) | covered (see sabotage S4, S5) |
| FND-NFR-02 | S1 to S4, S10, S15 all red | covered |

## Sabotage results

All sabotages were applied in the clone only and reverted. "Unit" is `pnpm test`, "DB" is `pnpm test:db`.

| # | Sabotage | Caught? | By which tests (main) |
|---|----------|---------|-----------------------|
| S1 | `withRls` uses `set_config(..., false)` (not local) for claims, sub and tenant | YES (DB 10 failed; unit stayed green because it mocks the client) | `with-rls-context.test.ts` FR-10 (2) after commit, rollback, anonymous call, next user; (7) after DB error and rollback; anonymous variant; tenant only when supplied; `harness.test.ts` anon |
| S2 | Remove `set local role` | YES (DB 62 failed) | `with-rls-context`, `harness`, `schema-guard` (9) zero-rows tests, `tenant-isolation` forged context, `hardening-catalog` function-call test |
| S3 | App connects as `postgres` (`DATABASE_URL` overridden for the test run) | YES (DB 19 failed) | `app-backend-role.test.ts` (SET ROLE and escalation refusals, 7 tests); `hardening-catalog` timeouts (3); `harness` "connects as app_backend when withRls is not used"; `with-rls-context` role and context tests |
| S4a | Real migration creates a public table with RLS enabled and no policy | YES (3 failed) | `schema-guard.test.ts`: "every table in public has RLS enabled and at least one policy" (plus 2 knock-on guard self-tests that assume an otherwise clean schema) |
| S4b | Real migration creates a public table without RLS | YES (3 failed) | same tests |
| S5 | Table with RLS and a policy (control: suite passes 212/212), then a later migration drops the policy | YES (3 failed) | same schema-guard tests. The control proves the guard is not vacuous: a compliant table passes. |
| S5c | Extra: table with a permissive `using (true)` policy and `grant select to anon` | YES (1 failed) | `hardening-catalog`: "on the real schema anon holds no table, column or sequence privilege in public" |
| S6a | Default privileges grant all on new tables to anon and authenticated (first migration edited) | YES (4 failed) | `app-backend-role`: table created without grants closed to app_backend/authenticated/anon; `hardening-catalog` (2); `harness` "denies authenticated and anon until grants are explicit" |
| S6d | Same for sequences | YES (2 failed) | `app-backend-role` sequence test; `hardening-catalog` identity-sequence test |
| S6b | Default function privileges granted to anon/authenticated | YES (4 failed) | `hardening-catalog` function-privilege tests |
| S6c | Default function EXECUTE granted to PUBLIC | YES (5 failed) | same, including the "new schema, not executable by PUBLIC" test |
| S7 | Remove the timeouts and function-privileges migration | YES (9 failed) | `hardening-catalog`: `rolconfig` test, effective timeouts in `withRls` and `withAnonymousRls`, `pg_sleep` cancellation (57014), and the 5 function-privilege tests |
| S8 | Data API on (`[api] enabled = true`, stack restarted, `db:reset`) | YES (1 failed) | `hardening-catalog`: "/rest/v1/ on the local stack is not served (non-2xx) and returns no table data" (REST answered 200 during the sabotage). The test checks the RUNNING stack, not `config.toml` (see judgment J3). |
| S9 | `withRls` accepts a non-UUID user id (validation replaced by "defined") | YES (unit 5 and DB 11 failed) | `rls.test.ts`; `with-rls-context` (5): empty, not-a-UUID, null, number, trailing newline, padded, injection-looking and admin-literal ids |
| S10 | Callback errors swallowed inside the transaction | YES (DB 21 failed, all 7 files) | `with-rls-context` (7); also many tests that rely on errors surfacing (escalation, 42501 denials, tenant-isolation, harness). Unit stayed green (mocked). |
| S12 | Extra: empty/whitespace tenant id accepted | YES (unit 2, DB 2) | `rls.test.ts`; `with-rls-context` (5) tenant-id tests |
| S13 | Extra: caller claims may override verified `sub`/`role` | YES (DB 2) | `with-rls-context` (1): forged sub/role overwritten; `auth.jwt()`/`auth.role()` |
| S14 | Extra: legacy `request.jwt.claim.sub` GUC never set | YES (DB 7) | `with-rls-context` (1) `auth.uid()` and (2), (7) |
| S15 | Extra: the `authenticated` statement switches to `anon` | YES (DB 44) | `harness`, `tenant-isolation`, `hardening-catalog` |

**Sabotages NOT caught: none.** Every requested sabotage and every extra one turned at least one test red, and the control (compliant table with a policy) stayed green.

Notes on sabotage quality: the unit layer (mocked client) catches only input validation (S9, S12); all behavioral mutations (S1, S2, S10, S13 to S15) are caught only by `test:db`. That is expected, but it means a developer who runs only `pnpm test` gets no signal on the core isolation logic, which the README and CI (T-21) should make explicit.

## Adversarial review: how `withRls` could be bypassed by a future developer

Demonstrated in the clone (reverted): a Server Component page `src/app/bypass/page.tsx` that does `import { getDb } from "@/db/client"` and runs ``getDb().execute(sql.raw(`select current_user`))`` passes `pnpm lint`, `pnpm typecheck` and `pnpm build` (route built as dynamic). Nothing stops it today because the boundary lint rules arrive in T-37 (noted, not a failure). What still protects the data meanwhile:

- the connection is `app_backend`: such a query cannot read any table (fail-closed role, tested by S3 and `app-backend-role.test.ts`), so the bypass yields "permission denied", not a leak;
- `server-only` makes `next build` fail if a client component imports `@/db` or `@/db/client` (verified: build error "You're importing a module that depends on server-only");
- `src/db/index.ts` exports no raw client or `getDb`, and no application code outside `src/db` uses `sql.raw`, `getDb`, `supabase-js`, `@supabase/ssr`, `.from(` or `.rpc(` (grep of `src/`, excluding tests, shows only `rls.ts` and `client.ts`). `supabase-js` and `@supabase/ssr` are installed but unused.

Residual bypass routes that lint (T-37) or tests (T-38) must close, and that are only documented now:

- `import "@/db/client"` from `app` or a module (T-37 `no-restricted-imports`, with `tests/` exempt).
- `sql.raw(...)` with request input inside a callback (T-37: restrict to `src/db/rls.ts`; the ADR already says so).
- Inside a callback, SQL can call `set_config('request.jwt.claims', ...)` (documented in ADR 0003; no test can prevent it, it needs review and the lint rules).
- Nested `withRls` or a `getDb()` query inside a callback deadlocks with `max: 1` (documented; not lintable).
- `supabase-js` used for data (`.from()`/`.rpc()`): blocked by the Data API being off (S8 shows the Data API test fails if it is turned on) and by T-37 `no-restricted-syntax`; with the Data API off such calls would fail at runtime anyway.

## `.env*` and secrets

- Tracked env-like files: only `.env.example` (placeholders and local, labelled non-secret values). History has added no other `.env*` file.
- `.gitignore` ignores `.env*` except `.env.example`; `.env.local` (created in my clone) stayed untracked and `git status` stayed clean.
- No server variable reaches `.next/static` (sentinel test, criterion 16). `SUPABASE_SERVICE_ROLE_KEY` is not defined anywhere (only a comment in `env.server.ts`).
- `grep` of tracked source for key patterns finds one hit: `tests/db/hardening-catalog.test.ts:43` contains Supabase's public local demo anon JWT (`eyJhbGci...`, role `anon`, `exp` 1983812996). It is not a secret (same value as every local stack) but a secret scanner with a JWT rule (Gitleaks, T-22) may flag it. See G4.
- `gitleaks` is not installed on this machine, so no scanner run was possible here (T-22/T-23 own that).
- `tests/db/hardening-catalog.test.ts` connects as `supabase_admin` with the local password `postgres`, over loopback only (`assertLocalDatabase` refuses non-loopback hosts). Acceptable.

## Docs vs code

| Item | Finding |
|------|---------|
| ADR 0003 "Residual risks" third bullet says `statement_timeout` is not applied and queries are unbounded (`show statement_timeout` = 0) | STALE: contradicted by migration `20261112130000` (8 s, tested) and by "Open issues 1: resolved" in the same ADR. See D2. |
| ADR 0003 "Open issues 3" (no test asserts `anon` has no table/sequence privileges) | STALE: `hardening-catalog.test.ts` now has it (T-51). See D2. |
| ADR 0003 Amendment says "194 `test:db` tests pass" | historical statement (T-18 time); the suite is now 212. Harmless but may confuse; consider "194 at review time". |
| `docs/architecture.md` layout lists `lib/supabase/ (Auth clients only)` | no such folder exists (no factories in 001, per tasks.md). The layout describes a future state without saying so. See D3. |
| ADR 0003 and tasks.md say lint rules (`no-restricted-imports`, `no-restricted-syntax`) enforce the client restriction | they do not exist yet (T-37); documented as pending. Not a defect. |
| `tests/README.md` "No `.env.local` is needed for the DB tests" | true for `test:db` (verified: it ran without it), but `pnpm db:schema` DOES need `.env.local` or `DATABASE_MIGRATION_URL`; this is documented only in tasks.md notes until T-41. See D1. |
| Code versus ADR 0003 for `withRls` (lazy `getDb()`, forced `sub`/`role`, legacy GUC, allowlisted `sql.raw`, no fallback) | matches (read line by line; S13 and S14 prove the claims about forced values and the load-bearing GUC). |
| Migration comments versus behavior (default privileges, timeouts, function revokes) | match; mutated variants S6a to S6d and S7 are all caught. |

## Defects and gaps

Severity: D = defect, G = gap, O = observation. No blocker for accepting steps 3-4.

- **D1 (medium) `pnpm db:schema` fails on a fresh clone and leaves the tree dirty.** Reproduction: fresh clone, `db:start`, `db:reset`, `pnpm db:schema` (no `.env.local`). The wrapper script first deletes `src/db/schema/schema.ts` and `relations.ts`, then `drizzle-kit pull` aborts with "DATABASE_MIGRATION_URL is required to run drizzle-kit" (exit 1), so `git status` shows two deleted tracked files. A second effect is that a developer who then runs `git diff --exit-code` sees a large diff. Fix suggestion for a developer task: validate the variable before deleting anything (or write to a temp dir and move into place), and mention `.env.local` in the README. CI is unaffected only if T-21 sets `DATABASE_MIGRATION_URL`. Also `scripts/db-schema.ts` prints a `MODULE_TYPELESS_PACKAGE_JSON` warning on every run (cosmetic).
- **D2 (low) stale ADR 0003 text** (Residual risks timeout bullet, Open issue 3). Architect to correct in the next ADR pass (T-43 or earlier).
- **D3 (low) `docs/architecture.md` layout mentions `lib/supabase/`**, which does not exist. Mark as "(epic 002)" like the modules line.
- **G1 (medium) no automated test for `/api/health/db`.** It is spec FR-11 and a deployment-adjacent endpoint; today only this manual check covers 200 up, 503 down, 503 unset, and "no connection details in the body or logs". A unit test (mock `withAnonymousRls` to throw an error whose message contains a connection string, assert the response body and `console.error` args) is cheap and does not need Docker; the up-case can go in `test:db` or E2E (E2E removes `DATABASE_*` by design). Recommend a small tester task; not a blocker for acceptance because the manual evidence above is recorded.
- **G2 (low) `test:db` uses `--passWithNoTests`.** If the include glob ever breaks or the global setup aborts, Vitest prints "No test files found, exiting with code 0" before the real exit; today the real exit code is 1 on abort (verified with the stack down), but a broken glob would pass silently. Consider removing the flag now that tests exist.
- **G3 (info) the Data API test checks the running stack, not `config.toml`.** Verified in S8 (it went red only after the stack restarted with the API on). In CI the stack starts fresh, so it is sound there; locally a stale running stack could hide a config change. A one-line assertion on `supabase/config.toml` (`[api] enabled = false`) would make it independent.
- **G4 (info) Gitleaks and the demo JWT** (see Secrets): T-22 should add the demo key to an allowlist or replace the literal in the test with a value read from `supabase status`/a constant that does not look like a JWT.
- **G5 (info) unit coverage cannot detect behavioral regressions of `withRls`** (S1, S2, S10, S13 to S15 pass `pnpm test`); only `test:db` does. T-21 must keep `test:db` blocking, and the README should say that `pnpm test` alone is not enough before touching `src/db`.
- **O1 (info) dev-mode connection leak hypothesis (not verified).** `getDb()` memoizes in a module variable; under Next dev HMR a module reload creates a new `max: 1` pool without closing the old one. Low impact locally; worth a `globalThis` cache if it shows up. I did not test it.
- **O2 (info) the idle-in-transaction timeout (10 s) was verified only in the catalog and as an effective value** (as the T-51 note says), and what `postgres.js` does with the server-killed connection (reconnect on next use) was not tested. Recommend confirming when a real pooled environment exists.
- **O3 (info) lint config:** `coverage/` is not in the ESLint ignores (T-14 follow-up, still open; lint was clean on the fresh clone because no `coverage/` existed).
- **O4 (info) real-schema grant scan is vacuous until tables exist.** The S5 control (a compliant table passes, S5c an anon grant fails) shows it works, so this only matters for coverage perception.

## Judgments for the Product Owner

- **J1: accept steps 3-4?** Recommended YES. All commands pass from a fresh clone, every sabotage is caught, no blocker. D1 to D3 and G1 to G5 are small; I recommend one developer fix task for D1 (and G2), one tester task for G1 (and G3), and an ADR/doc touch-up by the architect for D2 and D3, all before or alongside T-21, none blocking T-20.
- **J2: bypass protection depends on T-37.** Until the lint rules exist, the only barrier against code importing the raw client is the fail-closed role (data cannot leak, but the query would simply fail) plus server-only. That is acceptable for foundations; do not start epic 002 module work before T-37 lands, because epic 002 is where a bypass becomes likely.
- **J3: should the Data API check also assert `config.toml`?** Recommended yes (G3), trivial cost.
- **J4: Realtime and Storage remain enabled locally** (architect's optional item): unchanged, I did not test them beyond what T-18 recorded; the decision stays with the PO.

## Not verified

- A cloud project, the cloud pooler, SSL and cloud default privileges (none exists).
- A truly stopped Docker daemon (only the stack being stopped was exercised; the earlier simulated socket case is in step-2.md).
- Gitleaks and CodeQL (not installed, later tasks).
- Concurrency of two `test:db` runs on one stack (documented as unsupported).
- Dev-mode HMR connection behavior (O1).

## Verdict

PASS. Steps 3 and 4 meet FND-FR-06 to FND-FR-11 (liveness automated, DB health manually verified), FND-FR-19 to FND-FR-22 and FND-NFR-02 with evidence; 19 of 19 sabotages (the 10 requested plus extras) are caught, none escaped. Open items are the small defects D1 to D3 and gaps G1 to G5 listed above, none blocking.
