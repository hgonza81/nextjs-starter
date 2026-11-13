# Acceptance record: steps 3 and 4 (FND-T-10 to FND-T-19, FND-T-50 to FND-T-53)

Task: FND-T-20. Acceptor: product-manager. Date: 2026-11-12.
Scope: FND-FR-06 to FND-FR-11, FND-FR-19 to FND-FR-22, FND-NFR-02, FND-NFR-05 (database and test parts), Definition of Done items 2 to 5.
Repository state inspected: `main`, HEAD `5bd2401` (T-53). Build and test commits: `48c6978` (T-10), `ba4f3b5` (T-11), `8a33c93` (T-12), `86664df` (T-13), `5c92bdd` (T-14), `02cd1e0` (T-15), `d438ca9` (T-16), `9f3782d` (T-17), `b8db556` (T-18 ADR confirmation), `6f5feab` (T-50), `45e95fc` (T-51), `876ce98` (T-19 report), `4551453` (T-52), `5bd2401` (T-53).

## Method and limits

- Evidence comes from (a) my own inspection of the files on `main` (listed per row below) and `.git/logs/HEAD`; (b) the independent verification report `verification/step-3-4.md` (T-19, fresh clone, 19 of 19 sabotages caught) and the execution notes of T-50 to T-53 in `tasks.md`.
- **Limit: this acceptor session had NO shell.** I ran no command. The numbers 212/212 (`test:db`), 54/54 (unit) and 6/6 (E2E) come from the T-19 report and the T-52/T-53 notes, not from my own run. T-19 ran at HEAD `45e95fc`; T-52 and T-53 came after it, so the final state (`5bd2401`) rests on the developer's and tester's notes plus my file inspection.
- Commands I could not run, for the orchestrator:
  - C1: `pnpm lint && pnpm typecheck && pnpm format:check && pnpm build` (expect rc 0, lint with 0 errors and 0 warnings).
  - C2: `pnpm test` with Docker stopped (expect 54/54 in 5 files).
  - C3: `pnpm db:start && pnpm db:reset`, then `pnpm test:db` twice in a row (expect 212/212 in 7 files, both runs), then `pnpm db:schema` and `git diff --exit-code src/db` (expect empty), then `pnpm db:stop`.
  - C4: `pnpm test:e2e` (expect 6 passed).
  - C5: `git log --format=%B | grep -iE "co-authored|claude|copilot|anthropic"` (expect nothing; my grep of `.git/logs` and `COMMIT_EDITMSG` found 0 hits, but commit bodies live in compressed objects I cannot read).
  - C6: `git status --short` (expect only this file plus the PO's pre-existing `tasks.md` change and `.vscode/`, which must not be staged).
  - C7 (cheap, optional): with `DATABASE_MIGRATION_URL` unset, `pnpm db:schema` exits non-zero and `git status` shows `src/db/schema/` untouched (T-52 acceptance).

## Per requirement

| Requirement | Criterion | Evidence | Verdict |
|-------------|-----------|----------|---------|
| FND-FR-06 | Drizzle, drizzle-kit (`schemaFilter: ['public']`), Postgres driver, `supabase-js`, `@supabase/ssr` installed; empty schema entry point; no tables | `package.json` pins `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `postgres` 4.1.1, `@supabase/supabase-js` 2.119.0, `@supabase/ssr` 0.12.7 (all exact). `src/db/schema/` holds `index.ts`, `schema.ts`, `relations.ts` (generated, header only per T-19 row 4); `drizzle.config.ts` exists. `public` has no tables (T-19 rows 4, 15; schema guard passes on zero tables) | Accepted. Note N1 |
| FND-FR-06 | `pnpm typecheck` passes importing the DB package | `src/app/api/health/db/route.ts` imports `@/db`; T-19 row 9 typecheck rc 0 | Accepted (re-run C1) |
| FND-FR-07 | One migration workflow: SQL migrations are the source of truth; `drizzle-kit pull` generates a committed schema marked generated; no `generate/migrate/push` | Migrations only in `supabase/migrations/` (two files). `scripts/db-schema.mts` prepends "GENERATED ... Do not edit" and runs only `pull`. Repo-wide grep for `drizzle-kit (generate|migrate|push)` finds no use outside prohibitions (T-19 row 4) | Accepted |
| FND-FR-07 | `pnpm db:schema` after `db:reset` gives an empty `git diff`; stable on a second run | T-19 row 3 (empty twice, with `.env.local`); T-52 notes the same after its changes. Not re-run by me (C3) | Accepted (re-run C3) |
| FND-FR-07 | The command is safe and documented | Defect D1 of T-19 closed by T-52: `scripts/db-schema.mts` validates `DATABASE_MIGRATION_URL` before touching files and restores the generated files if `pull` fails (I read the script; the order is validate, snapshot, delete, pull, restore on error). MODULE_TYPELESS warning removed by the `.mts` extension. README documentation owed to T-41 | Accepted. Open points O2, O6 |
| FND-FR-07 | CI runs the drift check and fails on a diff | Not part of steps 3-4: CI does not exist yet. Build task is T-21 (traceability row FR-07: T-10, T-21) | Deferred to T-21 (by design) |
| FND-FR-07 | Behavior of `pull` for roles/policies recorded in ADR 0002 | Recorded by the architect in T-18 (`b8db556`) and in the execution notes: policies emitted, RLS-enabled flag and roles/grants not; hence the schema guard queries the catalog. ADR 0002 does not yet describe the validate-and-restore behavior of T-52 | Accepted with note (O2) |
| FND-FR-08 | Migration creates `app_backend` (LOGIN, NOSUPERUSER, NOBYPASSRLS, owns nothing, switch only to `authenticated`/`anon`); password outside migrations | `supabase/migrations/20261112120000_app_backend_role.sql`; password only in `supabase/seed.sql` (T-19 row 15: `grep -i password supabase/migrations` shows a comment only). `app-backend-role.test.ts` (24) and `hardening-catalog.test.ts` (18) cover the catalog; SET ROLE to `postgres`, `service_role`, `supabase_admin` refused | Accepted |
| FND-FR-08 | `app_backend` is not owner of any `public` object; a query as `app_backend` outside `withRls` is denied or empty | `app-backend-role.test.ts`, `harness.test.ts` ("connects as app_backend when withRls is not used"), `with-rls-context.test.ts` fail-closed test; sabotage S3 (connect as `postgres`) caught by 19 tests | Accepted |
| FND-FR-08 | Hardening added by T-50 (timeouts, function default privileges) | `supabase/migrations/20261112130000_app_backend_timeouts_function_privileges.sql` (read): `alter role app_backend set statement_timeout = '8s'`, idle timeout `10s`, revoke default EXECUTE on functions from PUBLIC, anon, authenticated. Locked by `hardening-catalog.test.ts` (S7, S6b, S6c caught). See scope gate | Accepted (inside spec intent, see scope gate) |
| FND-FR-08 | App `DATABASE_URL` uses `app_backend`; migrations/drizzle-kit use a separate `DATABASE_MIGRATION_URL` never deployed | `.env.example` pins the `app_backend` URL (execution notes T-11); `drizzle.config.ts` and `scripts/db-schema.mts` use `DATABASE_MIGRATION_URL`; production build without DB variables passes (step 1). "Never deployed" is enforced by the deploy job (T-24) | Accepted; deploy-side enforcement owed to T-24 |
| FND-FR-09 | Single `withRls(ctx, fn)` in `src/db/`: one transaction, `set_config(..., true)`, `set local role` hard-coded (`authenticated`; `anon` for the explicit variant), no fallback | `src/db/rls.ts` read line by line: `ROLE_STATEMENTS` is a fixed two-entry table; claims set with parameterized `set_config(..., true)`; `sub` and `role` are overwritten with verified values; UUID validation rejects missing, empty, non-UUID ids with an error; `withAnonymousRls` is a separate explicit variant. Sabotages S1, S2, S9, S10, S12, S13, S14, S15 all caught | Accepted |
| FND-FR-09 | Raw Drizzle client not exported from `src/db/index.ts`; `VerifiedContext` type documents verified-claims rule | `src/db/index.ts` read: exports schema, `withRls`, `withAnonymousRls`, `RlsTransaction`, `VerifiedContext` only; `client.ts` private (`server-only`); JSDoc on `VerifiedContext` states claims must come from a verified session. A client component importing `@/db/client` fails `next build` (T-19) | Accepted |
| FND-FR-09 | Lint rejects importing the raw client outside `src/db/` | No boundary lint rule exists yet. Build task is T-37, tests T-38 (traceability FR-09: T-12, T-37). T-19 demonstrated a Server Component importing `@/db/client` passes lint/typecheck/build today; data stays protected by the fail-closed role | Deferred to T-37 / T-38 (by design). Note N2 |
| FND-FR-10 (1, 2, 3, 5, 7) | Context handling proven against real Postgres as `app_backend` through `withRls` | `tests/db/with-rls-context.test.ts`, `with-rls-parallel.test.ts` (real pool of 8 via mocked `@/db/client`, asserts more than one backend PID). 14-row mutation table in `tests/README.md`. Sabotages S1, S10, S14 caught | Accepted |
| FND-FR-10 (4, 6, 8, 9) | Isolation, role model, fail-closed | `tests/db/tenant-isolation.test.ts` (109), `app-backend-role.test.ts`, `schema-guard.test.ts`; throwaway tables created by setup and dropped after, none in `supabase/migrations/`; about 45 mutations in `tests/README.md` | Accepted |
| FND-FR-10 | Tests pass and leave no state | `test:db` 212/212 in 7 files, twice in a row (T-19 row 6; T-52 and T-53 notes after the last changes). Re-run C3 | Accepted (re-run C3) |
| FND-FR-11 | `GET /api/health` returns 200 with a known body, even with no database | `src/app/api/health/route.ts` (step 2); now automated: `src/app/api/health/route.test.ts` (unit) and `tests/e2e/health.spec.ts` | Accepted |
| FND-FR-11 | `/api/health/db` returns 200 when the database is reachable | `src/app/api/health/db/route.ts` (read): `withAnonymousRls` runs `select current_user`, returns `{"status":"ok","role":"anon"}`. Manual T-19 rows 10, 13 (200 up, recovers after restart); unit test with mocked `@/db` (T-53) | Accepted. Note N3 |
| FND-FR-11 | With the database stopped, non-200 without connection details | Route returns 503 `{"status":"unavailable"}` and logs only the error class name. T-19 rows 11, 12 (log grep for `app_backend`, `54322`, `password`: 0 hits). Gap G1 closed by T-53: `route.test.ts` asserts the body and everything logged through `console.*` contain none of URL, `postgresql://`, user, password, host, port when the error holds a full connection string; 9 mutations proven red | Accepted |
| FND-FR-19 | Three commands exist: `pnpm test` (no Docker), `pnpm test:db`, `pnpm test:e2e`; layout unit colocated, `tests/db/`, `tests/e2e/`, `tests/utils/`; coverage reported, no threshold | `package.json` scripts read (`test`, `test:db`, `test:e2e`, `test:coverage`); layout confirmed by directory listing. T-19: unit 31/31 with Docker stopped, `test:db` 212/212, E2E 6/6 (now unit 54/54 after T-53). `test:db` no longer has `--passWithNoTests` (G2 closed by T-52, `package.json` read) | Accepted |
| FND-FR-19 | Each command is documented in a test README (prerequisites, debugging, reset `pnpm db:reset`) | `tests/README.md` exists with prerequisites, commands, debugging, stack-down behavior and mutation tables (T-14, T-15, T-16, T-17, T-51, T-53). The finishing pass (including the "Gate failure proofs" stub and tidying the stale "Not covered here" paragraph) is T-40 | Accepted with note (O5) |
| FND-FR-20 | One real passing test per layer, asserting behavior; E2E fails if the home heading is removed or an axe violation appears | Unit: `env.test.ts`, `rls.test.ts`, health tests; DB: FND-FR-10 suites and harness; E2E: `tests/e2e/home.spec.ts` (heading, axe light and dark, no horizontal scroll at 375 and 1280) and `health.spec.ts`; 6 mutation proofs in `tests/README.md` (heading removal included) | Accepted (re-run C4) |
| FND-FR-20 | `/design` axe check | Not in steps 3-4: `/design` does not exist until T-32; test is T-33 | Deferred to T-33 (by design) |
| FND-FR-20 | Lint-rule fixture tests (unit layer) | Belong to FR-12; T-38 | Deferred to T-38 (by design) |
| FND-FR-21 | Harness: `asUser(claims)` calls production `withRls`; role helpers; factory stubs; unique data per test; table-driven matrix; test tables created and dropped by setup, never in migrations | `tests/utils/` (roles, factories, access-matrix, ids, throwaway-table, admin, db-global-setup); `harness.test.ts` (9 tests); `asUser` and `asAnon` wrap the production functions (T-14 note, T-19 row 6). `test:db` twice in a row passes | Accepted |
| FND-FR-22 | Schema guard asserts every `public` table has RLS enabled and at least one policy except an allowlist; passes with zero tables; guard-of-the-guard | `tests/utils/schema-guard.ts` (catalog-based, empty allowlist) and `tests/db/schema-guard.test.ts` (14); sabotages S4a, S4b, S5 caught, control (compliant table) green | Accepted |
| FND-NFR-02 | Fail-closed foundation: no `BYPASSRLS`, not owner or superuser, no app-table privileges; query without `withRls` returns no data; service-role key not provisioned | Catalog tests above; S1 to S4, S10, S15 red; repo grep finds `SERVICE_ROLE` only in a comment in `env.server.ts` ("deliberately not defined") | Accepted |
| FND-NFR-05 (steps 3-4 part) | Server-only variables absent from the client bundle; no real secret in the repo | T-19 row 16 (sentinel build, 0 hits in `.next/static`); only `.env.example` tracked; the only key-looking literal is Supabase's public demo anon JWT in `hardening-catalog.test.ts` (G4). The permanent bundle assertion and the secret scan are not built yet | Accepted with note (O3, O4). Secret scan owned by T-22 |

## Judgments requested

### 1. Each requirement in scope has a build task and a verification
Yes. FR-06 to FR-11, FR-19 to FR-22 and NFR-02 each have a build task (T-10 to T-17, T-50, T-52) and a verification (T-18, T-19, T-51, T-53, this record) per the traceability table. Parts that belong to later steps are listed as deferred (FR-07 CI drift check, FR-09 lint half, FR-20 `/design` and lint fixtures, FR-19 test README finishing).

### 2. T-19 gaps closed or routed
| T-19 item | Disposition | Evidence |
|-----------|-------------|----------|
| D1 `db:schema` deletes files when the URL is missing (plus MODULE_TYPELESS warning) | Closed by T-52 | `scripts/db-schema.mts` validates first and restores on failure |
| G2 `--passWithNoTests` | Closed by T-52 | `package.json` `test:db` has no flag |
| O3 ESLint `coverage/` | Closed by T-52 | `eslint.config.mjs` line 14 `"coverage/**"` |
| G1 no test for `/api/health/db` | Closed by T-53 | `src/app/api/health/db/route.test.ts` |
| G3 Data API test depends on the running stack | Closed by T-53 | `src/app/api/health/db/data-api-config.test.ts` (`config.toml` has `[api] enabled = false`; `config.toml` read: `[api]` then `enabled = false`) |
| D2 stale ADR 0003 text | Still open, routed to the architect (T-36 or T-43) | I confirmed `docs/adr/0003-drizzle-rls-data-access.md` line 91 ("Residual risks") still says timeouts are not applied, while line 99 says resolved. "Open issue 3" (anon-grant test) also still to be marked resolved |
| D3 `docs/architecture.md` lists `lib/supabase/` | Still open, routed to the architect (T-36 or T-43). Confirmed at `docs/architecture.md` line 14 (also ADR 0001 line 29, and ADR 0004 line 28 describes the folder as the future home) | Doc-only |
| G4 demo JWT in a test file | Routed to T-22 | No scanner has run yet |
| G5 unit tests alone do not catch behavioral regressions | Routed to T-21 (keep `test:db` blocking) and T-40/T-41 (say it in the READMEs) | |
| O1 dev-HMR pool leak (unverified), O2 idle-timeout behavior in a pooled environment (unverified), O4 vacuous real-schema grant scan | Observations, no owner required; O1 and O2 re-check when a cloud project exists or if it shows up | |

### 3. PO decisions visible in code and docs
| PO decision | Where it shows | Verdict |
|-------------|----------------|---------|
| Drizzle with RLS through one centralized function | `src/db/rls.ts` is the only code touching `getDb()`; `src/db/index.ts` exports no raw client; grep of `src/` (T-19) finds `getDb`, `sql.raw` only in `rls.ts`/`client.ts`; ADR 0003 | Visible. Lint enforcement still owed (T-37) |
| Data API disabled | `supabase/config.toml` `[api] enabled = false`; `hardening-catalog` HTTP test plus the new file-level test; ADR 0003 | Visible and tested |
| SQL-first migrations, schema generated by `pull` | `supabase/migrations/` (2 files), `scripts/db-schema.mts`, `drizzle.config.ts` outputs to `src/db/schema/` not to migrations; no `generate/migrate/push` | Visible |
| No ORM bypass | No raw client export; `server-only` on `client.ts`; `app_backend` is fail-closed so a bypass is denied; `supabase-js` and `@supabase/ssr` installed but unused for data | Visible; lint rules owed (T-37, T-38) |
| No Stripe | Grep of code and config: no Stripe (only mentions in agent definitions) | Visible (absent) |
| No branches, no hooks | Only `.git/hooks/*.sample` exist; no Husky, commitlint or lint-staged in `package.json`; single branch `main` (`.git/logs/HEAD`) | Visible (absent) |
| No service-role key | Only a comment in `env.server.ts` | Visible (absent) |

### 4. Scope gate: nothing out of scope added
- No auth, users, tenants, billing, real tables, policies, routes beyond `/api/health` and `/api/health/db`; `supabase-js` and `@supabase/ssr` are installed as FR-06 requires and have no consumer; no client factories (as tasks.md decided). `src/` contains `app`, `db`, `lib`, `instrumentation.ts` only.
- T-50, T-51, T-52, T-53 additions: **I agree they are inside the spec's intent.**
  - T-50 (timeouts, function default privileges) implements FND-FR-08 ("fail-closed login role") and FND-NFR-02 ("fails closed") for gaps the architect found in the same role model; it is a new migration of about 20 lines, no new feature, no table. Without it a callback could run an unbounded query on a single-connection pool and new functions would be callable by `anon`. Reversible (one migration).
  - T-51 are tests for T-50 and for the anon-grant gap, mapped to FR-08, FR-10, FR-22. Within scope.
  - T-52 fixes a defect in the FR-07 command and two lint/test config gaps found by the verifier (FR-07, FR-19, FR-21). Within scope.
  - T-53 adds the missing automated checks for FR-11 and FR-05 that the spec's criteria already required. Within scope.
  - Caveat, not a rejection: these tasks were authorized by the orchestrator and `tasks.md` was updated by it; the spec itself (section 8.2) was not edited. The record here and the traceability notes are the audit trail; the PO may want the spec change log to mention them (see Decisions).
- Test-only extras (about 45 mutation checks, `supabase_admin` residual-case test, bundle sentinel, view/column grant checks) stay inside `tests/` and `tests/README.md`; no production code. Judged proportionate for the highest-risk piece of the starter (risk R1), not gold-plating, but the test suite is large for an empty schema (212 DB tests, mostly the 109 matrix cases); acceptable because it is the reusable pattern epic 002 will copy.

## Notes

- N1: `src/db/schema/schema.ts` and `relations.ts` are generated, header-only files; the spec's "no table definitions" criterion has command evidence plus the schema guard but no dedicated assertion (T-19 judged acceptable; I agree).
- N2: until T-37 lands, nothing stops application code from importing the raw client; data is protected by the role, not by lint. Agree with T-19 J2: **no epic 002 module work before T-37.**
- N3: the up-case of `/api/health/db` (200) is automated only at unit level with a mocked `@/db`; against the real database it rests on the manual T-19 evidence (E2E starts without DB variables by design). Acceptable for FR-11; a DB-level check could be added if epic 002 wants it.
- N4: the sabotage evidence was collected at `45e95fc`; T-52 and T-53 changed only scripts, ESLint config, `package.json` and added tests, so it still applies, and each new test has its own mutation proof.

## Open points owed to later tasks

| Item | Owner and task |
|------|----------------|
| FND-FR-07: CI runs `db:schema` plus `git diff --exit-code src/db`; CI must set `DATABASE_MIGRATION_URL` and the three `NEXT_PUBLIC_*` variables; `test:db` must be blocking (G5); Playwright `--with-deps chromium` and `CI=1` | developer, T-21 |
| Gitleaks run; decide how to treat the demo anon JWT in `tests/db/hardening-catalog.test.ts` line 43 (narrow allowlist or construct at runtime, never broad); secret-scan evidence for NFR-05 | developer, T-22 (checked by T-23) |
| `DATABASE_MIGRATION_URL` and service-role key absent from the deploy job; deployed app needs no DB variable; `/api/health` as the only smoke target | developer, T-24 (T-25, T-26) |
| Fold `pull` behavior (validate-and-restore), stale Residual risks line 91 and Open issue 3 into ADR 0002/0003; remove `lib/supabase/` from the layout (mark "epic 002"); ADR 0004 env-split note | architect, T-36 (documents), T-43 (final check) |
| Boundary lint rules (raw client only in `src/db`, `app` may not import `@/db` except the health route, `sql.raw` only in `rls.ts`, supabase-js `.from/.rpc`, tests exempt, `env.server.ts` and `NEXT_RUNTIME` allowed, generated schema excluded) | developer, T-37; fixture tests including the exception and its non-application to other `app` files: tester, T-38 |
| `/design` axe checks, `/design` 404 in production | tester T-33, developer T-32 |
| Test README finishing pass: "Gate failure proofs" stub, tidy the stale "Not covered here" Data API paragraph (T-16 section), state that `pnpm test` alone is not enough before touching `src/db`, document how to read the Vitest "No test files found" line when global setup aborts | tester, T-40 |
| Project README: `db:*` commands, Docker prerequisite and error, `.env.local` copy (needed for `db:schema`), local anon key from `supabase status`, local pooler username `app_backend.pooler-dev`, shared `project_id`, `db:status` "Stopped services", `node -v` check, never use `--include-seed` or `db reset --linked` on a cloud project | developer, T-41 |
| Final architect check of ADRs 0001 to 0005 against the code; cloud re-verification list (PG 17, supautils role creation and password, SSL, pooler 6543 with `max: 1`, timeouts, default privileges, Realtime publication) recorded as "when a cloud project exists" | architect, T-43 |

## Verdict

**Steps 3 and 4 accepted** (accepted with notes on the rows marked). No rejected items. FND-FR-06, 08, 10, 11, 21, 22 and FND-NFR-02 are met; FND-FR-07, 09, 19 and 20 are met for what steps 3-4 own, with the CI drift check (T-21), the lint half of FR-09 (T-37/T-38), the test README finishing (T-40) and the `/design` axe check (T-33) deferred by design to the named tasks. The T-19 gaps D1, G1, G2, G3 and the ESLint ignore are closed; D2, D3, G4, G5 are routed to named tasks and are documentation or later-step items, not blockers. The re-runs C1 to C7 are confirmations of the developer's and tester's reported numbers, not known gaps; I did not execute them (no shell).

## Decisions for the Product Owner

- None blocking.
- Optional (recommended yes): record T-50 to T-53 in the spec change log as "hardening and gap-closing inside FR-08/09/10/21/22" so the approved spec and the task list agree. The spec text itself needs no requirement change.
- Optional, carried over from T-18 and unchanged: disable Realtime and Storage in `supabase/config.toml` locally as hardening. Recommendation: leave as is for the MVP; revisit with the cloud project.

## Commit

None made: this session has no shell, so the file is left uncommitted. Suggested commit by the orchestrator: stage only `specs/001-foundations/acceptance/step-3-4.md` (never `specs/001-foundations/tasks.md` or `.vscode/`), subject `docs(spec): accept steps 3-4 of foundations`, body `Task: FND-T-20`, no trailers; then verify with `git log -1 --format=%B | grep -iE "co-authored|claude|copilot"` (expect nothing). The orchestrator then updates the T-20 status in `tasks.md`.
