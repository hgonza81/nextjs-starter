# Review by tester — 001-foundations — round 1

## Summary
The requirements are a sound base, but FND-HR-08 and FND-HR-09 are not yet testable: "set up testing tooling" and "automated checks" have no acceptance criteria and no definition of done. The biggest gap is that nothing proves the tooling actually works end to end (a local DB with no tables, no auth, no UI features), so we need explicit "walking skeleton" smoke tests and a single, documented command set.

## Concerns and gaps
- [important] FND-HR-08 has no acceptance criteria. "Tooling set up" can be claimed without a single passing test. Fix: define done as a minimal passing example per level (unit, integration against local Supabase, E2E, RLS harness, a11y check).
- [important] FND-HR-02/07 (local Supabase, Docker) have no verifiable outcome. We need a checkable statement such as "from a clean clone, one documented sequence of commands starts the DB, applies migrations, and the app talks to it".
- [important] The RLS/database test approach cannot be exercised with zero tables (FND-HR-01/02 and out-of-scope list). Epic 002 will depend on a harness (acting as different users, anon, service role) that does not exist yet. The harness shape needs deciding now, even without tables, or epic 002 will be blocked.
- [important] FND-HR-09: CI checks are listed but not their gating behavior. Which checks block a merge, which are advisory? Without this, "security checks" can be satisfied by a job that never fails.
- [important] FND-HR-10 (modularity "enforced") is only testable if the boundary rules (e.g. modules must not import another module's internals, per AGENTS.md) are automated, e.g. lint rule or dependency check, with a deliberately failing fixture proving the rule works.
- [minor] FND-HR-05/04: design system and "beautiful" are subjective. Testable parts are only accessibility (axe), responsiveness at set viewports, and that tokens/components render. Visual quality is a human review, not a test.
- [minor] FND-HR-11: "minimal, nothing speculative" and "Stripe easy to add later" are not testable; treat as review criteria for the architect, not test targets.
- [minor] No coverage expectation or test data/reset strategy is stated.
- [minor] Test environment config (`.env.test`, local keys, ports) and Node/package-manager versions are not pinned, which causes "works on my machine" flakiness.

## Proposals
- Add acceptance criteria to FND-HR-08 (MVP baseline):
  - `test` (Vitest, unit + integration) runs and passes with at least one real example test; completes in seconds without Docker for the unit part.
  - `test:db` (RLS/integration against local Supabase) runs a harness smoke test: connects as anon, as an authenticated user (JWT), and as service role; asserts the connection and role behavior. No app tables needed (can assert against a throwaway test-only table created and dropped by the test, or `auth` schema behavior).
  - `test:e2e` (Playwright) loads the home page against a production-like start, with trace on first retry, and runs an axe check on it.
  - Each command is documented in a test README (prerequisites, how to debug).
- Acceptance for FND-HR-02/07: a "clean clone" check (manual first, scripted later) that `supabase start`, migration apply, and app connection work; plus a health smoke test that the app can reach the DB (e.g. server-side client query that does not need a table, or a trivial RPC/health check).
- CI gates (FND-HR-09), proposed as blocking on pull request: lint, typecheck, unit/integration, build, E2E smoke, `npm audit` (fail on high/critical, with a documented allowlist process), and secret scanning (gitleaks). RLS suite blocking once epic 002 adds tables. Suggestion (not in scope unless approved): OWASP ZAP baseline and license scanning, deferred until the app is exposed publicly (roadmap step 4).
- Prove the checks work: one-time verification that each CI check fails on a bad input (lint error, type error, failing test, a dummy secret pattern in a throwaway branch). Otherwise a misconfigured gate looks green.
- Module boundary enforcement: add an automated rule (ESLint `no-restricted-imports` or dependency-cruiser) with a test that an illegal cross-module import is reported.
- Test layout convention: unit tests colocated as `*.test.ts`; DB/RLS tests under `tests/db/`; E2E under `tests/e2e/`; shared factories under `tests/utils/` (e.g. `createTestUser`, `createTenant`, to be filled in epic 002).
- Test data strategy: unique data per test (random suffixed emails/tenants), no shared state, parallel-safe; one documented reset command (`supabase db reset`) for suite-level reset.
- Coverage: Vitest v8 coverage reported in CI as a signal only, no threshold at this stage; requirement coverage tracked via the traceability table in `spec.md`.
- Tool set (each justified by a stated requirement): Vitest (FND-HR-08), Testing Library + jsdom only for components with real logic, Playwright (E2E), `@axe-core/playwright` (accessibility of the design system), local Supabase CLI for DB tests, MSW only if external network calls appear. Not now: Stryker, k6, Lighthouse CI, pgTAP (revisit pgTAP vs Vitest-based RLS tests in the architect's ADR).
- Pre-commit hook (lint-staged + typecheck on changed files) is optional; suggestion (not in scope unless approved).

## Questions for the client
1. Which checks must block a merge in CI?
   - Options: A) Lint, typecheck, unit tests, build only / B) A plus E2E smoke, dependency audit, and secret scanning / C) B plus RLS/DB suite and security scans (ZAP) from day one
   - Recommendation: B, because it protects the main risks (regressions, vulnerable dependencies, leaked secrets) at little cost; the RLS suite is added as blocking when epic 002 introduces tables; ZAP waits until public exposure.
   - Impact if undecided: security checks may be implemented as non-failing, giving false assurance.
2. Is CI hosted now, or only local scripts for this epic?
   - Options: A) Local scripts only, CI later / B) CI pipeline now (platform to be chosen with the architect)
   - Recommendation: B for the fast checks, because FND-HR-09 explicitly asks for CI and a pipeline is cheap to set up while the codebase is empty.
   - Impact if undecided: tests exist but nothing enforces them, and the platform choice blocks the security-scan setup.
3. Where do E2E and DB tests run during development?
   - Options: A) Developers start local Supabase (Docker) and the app on the host, tests run on the host / B) Everything, including the app and tests, in Docker Compose
   - Recommendation: A, because it is simpler and faster to debug (headed Playwright, trace viewer); confirm with the architect's answer on FND-HR-07.
   - Impact if undecided: E2E and CI environments diverge from local development.
4. Should RLS tests be written as Vitest tests (JWT impersonation via the client library) or SQL-native pgTAP?
   - Options: A) Vitest only / B) pgTAP only / C) Vitest for behavior through the client, pgTAP later if policies get complex
   - Recommendation: A (revisit C later), because it keeps a single toolchain and tests what the application really calls.
   - Impact if undecided: epic 002 has no harness to start from.
5. Is a coverage threshold desired?
   - Options: A) Report only / B) Minimum threshold on unit tests (e.g. 80%)
   - Recommendation: A, because coverage is a signal, and a threshold on an empty codebase drives low-value tests.
   - Impact if undecided: minor; a number may be imposed arbitrarily later.

## Risks and assumptions
- Assumption: Docker is available on developer machines and CI runners; local Supabase startup time (minutes) makes the DB/E2E suites slower and must stay separate from the quick `test` command.
- Risk: Supabase CLI and Playwright browser downloads make CI slow and flaky without caching and pinned versions; pin versions and cache.
- Risk: with no tables in this epic, the RLS harness may be built on assumptions that break when real policies arrive; keep it minimal and refine in epic 002.
- Risk: dependency and secret scans produce false positives and noise; an allowlist process with owner and expiry is needed or the team will start ignoring them.
- Risk: the design system is the most subjective area; only accessibility and responsiveness are automatable, so visual consistency relies on review by the ui-ux-designer.
- Assumption: the testing tool names follow the project's tester agent baseline (Vitest, Playwright, axe, local Supabase) unless the architect's ADRs say otherwise.


# Review by tester — 001-foundations — round 2

## Summary
I confirm all my round 1 recommendations that the Product Owner accepted, and the new decisions (Drizzle with ORM+RLS through one centralized transaction function, Vercel deploy from GitHub Actions, push-to-one-branch workflows, no Stripe) are testable. The new decisions raise the stakes of one thing: tenant isolation now depends on a single function, so the DB test harness must be built around it and must include a throwaway-table isolation test in this epic, not only in epic 002. There are no blockers for the client; the follow-ups below are proposals for the spec.

## Concerns and gaps
- [important] The centralized transaction function (`SET LOCAL ROLE authenticated` + `request.jwt.claims`) is the single point of failure for tenant isolation. If it leaks context (a pooled connection keeps the role or claims, or a query runs outside the transaction), every table is exposed. It needs its own dedicated tests, which cannot wait for epic 002.
- [important] The ORM+RLS combination has silent-failure modes that only integration tests catch: (a) the app connecting as a role with `BYPASSRLS` or as the table owner, so RLS is not applied; (b) `FORCE ROW LEVEL SECURITY` missing on owner-run queries; (c) tables created by drizzle-kit migrations without RLS enabled; (d) claims not reset after commit/rollback when connections are reused; (e) a query using the global `db` instead of the transaction handle. A green app test would hide all of these.
- [important] Two migration sources now exist (Supabase CLI SQL migrations and drizzle-kit). If both can create schema, the test environment may differ from production and RLS policies (which Drizzle does not manage unless declared) may be lost. Which one is the source of truth for tests must be explicit, and the architect's ADR should settle it. Tests must run against the migrations as actually applied.
- [important] FND-HR-09 gating is now different from round 1: no PRs means "merge gate" becomes "deploy gate". With workflows on every push and deploy to Vercel, deploy must depend on all blocking jobs (`needs:`), otherwise a red push still ships. Also, Vercel's own Git integration auto-deploys on push independent of GitHub Actions; if enabled it bypasses the gate. Deployment must be driven only from the workflow (Vercel Git integration disabled or deploy via CLI/action).
- [important] CI needs Docker + local Supabase for the DB suite and E2E on every push. This makes the pipeline slow (minutes). Fine for a solo PO, but jobs should run in parallel (fast checks vs DB/E2E) so lint/typecheck feedback is quick.
- [important] The hello-world test scope is undefined: pre-deploy (against a local production-like build) or post-deploy (against the Vercel URL)? They prove different things.
- [minor] Without PRs or hooks, nothing stops a push of broken code; only the post-push workflow notifies. Acceptable per PO, but the failure notification path (GitHub email, README badge) should be stated so failures are not unseen.
- [minor] Secret scanning with no PRs runs on the pushed commits; once a secret is pushed it is already in history. Gitleaks cannot prevent that without a pre-commit hook (declined). Document that a detected secret requires rotation, not just removal.
- [minor] Deployment secrets (Vercel token, org and project IDs) and the production environment variables are CI secrets; no real Supabase cloud exists yet, so the deployed app has no database to reach. The deployed hello world must not depend on the DB.
- [minor] ~50 tables with full CRUD means the RLS test matrix will be large; the harness and factories must make a per-table allow/deny matrix cheap to write (table-driven), or coverage will lag behind the schema.
- [minor] Generated types and Drizzle models can drift from the migrations; no check currently detects it.

## Proposals
- **Harness shape (test:db), built in this epic against a throwaway table** created in the test setup (not in `supabase/migrations/`), with RLS enabled and a policy based on a tenant claim and a real membership lookup, then dropped:
  - A `withTestContext` / `asUser(claims)` helper that calls the same centralized production function (not a re-implementation), so tests exercise the real code path.
  - Role helpers: anon, authenticated with claims, service role.
  - Factories under `tests/utils/` (`createTestUser`, `createTenant` stubs to be completed in 002), unique data per test.
- **Required tests for the centralized function (acceptance criteria):**
  1. Inside the function, `current_user` is `authenticated` and `request.jwt.claims` equals the supplied claims.
  2. After commit and after rollback, the next transaction on the same pooled connection has default role and no claims (no leakage); run with pool size 1 to force connection reuse.
  3. Concurrent calls with different users on a small pool never see each other's claims (run N parallel calls, assert each sees only its own rows).
  4. A user of tenant A cannot select, insert, update or delete tenant B rows in the throwaway table; anonymous and no-membership users are denied; a row with a tampered tenant id in the payload is rejected (`WITH CHECK`).
  5. The function refuses to run without verified claims (missing or empty user or tenant) and does not fall back to a privileged role.
  6. The application connection role is not superuser, not `BYPASSRLS`, and not the table owner (assert via `pg_roles`).
  7. Unhappy path: an error thrown inside the callback rolls back and still resets context.
- **Schema guard test (cheap, runs in test:db):** after migrations are applied, every table in the `public` schema has RLS enabled (query `pg_tables.rowsecurity`) and at least one policy, except an explicit allowlist. This protects the ~50-table growth with one test and should be added to the harness now (passes trivially with zero tables, proves the mechanism with the throwaway table).
- **Drift check:** a CI step that regenerates Supabase types and Drizzle output and fails on a diff (`git diff --exit-code`), plus a migration-apply-from-scratch step (`supabase db reset`) in the DB job.
- **Lint rule (ties to the architect's ADR):** forbid importing the raw Drizzle `db` client outside the data-access module and the transaction function, with a deliberately failing fixture proving the rule, so queries cannot bypass the transaction. This is the only practical way to catch concern (e).
- **Pipeline shape on every push to the single branch:**
  - Job group 1 (fast, no Docker): lint, typecheck, unit tests, boundary-rule test, build, secret scan, dependency audit (informational, `continue-on-error`, per merge-gate choice B).
  - Job group 2 (Docker + local Supabase): migrations from scratch, drift check, `test:db`, `test:e2e` smoke with axe.
  - Deploy job: `needs:` all blocking jobs from groups 1 and 2, runs only on the deploy branch, then the post-deploy hello-world check.
  - Blocking vs informational is declared in the workflow with comments; the dependency audit is the only informational job.
- **Hello-world test scope (two parts, both small):** (1) pre-deploy: the home page of the production build renders a known heading in the E2E smoke test (already in the proposed baseline). (2) post-deploy: a single HTTP check against the deployed URL (a page or a DB-independent `/api/health` variant returning 200 and a known body) that fails the workflow if wrong. Keep the DB-connected health check local only until a cloud database exists.
- **Prove the gates once:** same one-time check as round 1 (lint error, type error, failing test, dummy secret, failing hello-world), plus: a failing blocking job prevents the deploy job from running. Run on a throwaway commit, recorded in the test README, then reverted.
- **Acceptance criteria to add to FND-HR-08/09 for the spec:**
  - `test`, `test:db`, `test:e2e` exist, pass locally from a clean clone, and each is documented in the test README.
  - The centralized-function tests above (1 to 7) and the schema guard pass in `test:db`.
  - Workflow runs on every push; a red blocking job means no deployment; the post-deploy hello-world check passes against the Vercel URL.
  - Dependency audit runs and reports but never blocks.
- **Failure visibility:** README status badge and GitHub's default failure email; no extra tooling.
- **Coverage:** unchanged (report only). Add a note that the centralized function and the RLS helpers are the code where uncovered branches matter most; review them by hand regardless of the number.
- **Roadmap (propose only):** when real tables arrive in epic 002, the RLS matrix becomes the highest-value suite; consider pgTAP for policy-level tests then (revisit C), and a production-like cloud smoke test once a Supabase cloud project exists.

## Questions for the client
None that block the spec. Conflicts and decisions to settle are for the architect's ADR (single source of truth for migrations, role grants, ORM client access rule), and I will test whatever is chosen using the shape above. One item for the orchestrator to confirm, not a blocker: Vercel's own Git auto-deploy should be disabled so deployment only happens through the workflow after green checks (recommended; otherwise "deploy only after green checks" cannot be guaranteed).

## Risks and assumptions
- Risk: tenant isolation rests on one function; a mistake there is a cross-tenant data leak. Mitigation: the tests listed above are mandatory acceptance criteria, not optional.
- Risk: pooled connections (for example Supabase's transaction pooler or a Node pool) interact with `SET LOCAL`; behavior differs between direct and pooled connections. Tests must run against the same connection type the app will use, and the architect's ADR must state it (prepared statements are also a known issue with the transaction pooler).
- Risk: CI duration and Docker flakiness on every push; mitigate with caching, pinned versions, parallel jobs, and trace on first retry. Flaky tests are fixed or removed, not retried silently.
- Risk: the harness built on a throwaway table may not match real policies; refine in epic 002, keeping the centralized-function tests unchanged.
- Risk: a solo workflow with no PRs means a broken main branch can be deployed only if the gating is misconfigured; the one-time gate proof covers this.
- Assumption: the deploy branch is the single branch the PO commits to, and deployment runs only from GitHub Actions.
- Assumption: no cloud Supabase project exists in this epic, so the deployed app is a DB-independent hello world.
- Assumption: all round 1 accepted recommendations (pnpm, pinned versions, Vitest, Playwright, axe, test layout, report-only coverage, local-Supabase-on-host) stand unchanged.
