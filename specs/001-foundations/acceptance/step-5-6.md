# Acceptance record: steps 5 and 6, local part (FND-T-21 to FND-T-26, FND-T-54, FND-T-55)

Task: FND-T-27. Acceptor: product-manager. Date: 2026-11-12.
Scope: FND-FR-23, FND-FR-24, FND-FR-25, FND-FR-26 (status only), FND-FR-07 (CI half), FND-NFR-05, FND-NFR-06, decisions D6 and D11, Definition of Done items 8 and 9.
Commits (from the task notes): `664fd33` (T-21), `c1d905f` (T-22), `02a5cbf` (T-23 report), `a55dba5` (T-24), `4fd8f10` (T-25 report), `761a89d` (T-54), `2e9c386` (T-26), `459ee7e` (T-55).

## Method and limits

- Evidence: my own reading of `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitleaks.toml`, `vercel.json`, `docs/architecture.md` and `docs/adr/0004-env-and-secrets.md` (Dependabot mentions); `verification/step-6.md`; the Execution notes of T-21 to T-26, T-54, T-55 and the two "real CI run" notes in `tasks.md`.
- **Limit: this acceptor session had NO shell.** I ran no command and could not run `gh run view`. The facts about runs `43336680336` (first CI, all blocking jobs green, audit red by design, run green) and `43339244913` (deploy job green and skipped, 7 Vercel steps skipped, run green) come from the orchestrator's Execution notes, not from my own read of the runs. `verification/step-5.md` was not re-read in full; its key numbers appear in the T-23 execution note.
- Commands I could not run, for the orchestrator:
  - C1: `actionlint .github/workflows/ci.yml` (expect exit 0; T-21, T-22, T-25 and T-54 report exit 0).
  - C2: `gh run view 43336680336 --repo hgonza81/nextjs-starter --json jobs,conclusion` and the same for `43339244913` (expect `success`; `Dependency audit` failure; `Deploy to Vercel` success with 7 skipped steps).
  - C3: `grep -n "secrets\." .github/workflows/ci.yml` (expect only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) and `grep -nE "SERVICE_ROLE|DATABASE_MIGRATION_URL" .github/workflows/ci.yml` (expect only the `database-and-e2e` env and a comment in the deploy job).
  - C4: `git log --format=%B | grep -iE "co-authored|claude|copilot|anthropic"` (expect nothing).
  - C5: `git status --short` (expect this file plus the PO's `tasks.md` change and `.vscode/`, which must not be staged).

## Per requirement

| Requirement | Criterion | Evidence | Verdict |
|-------------|-----------|----------|---------|
| FND-FR-23 | Workflow runs on every push, no `pull_request`, per-ref concurrency cancel | `ci.yml`: `on: push`; `concurrency.group: ci-${{ github.ref }}`; `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` | Accepted with note N1 (cancel is off on `main` by design, see judgment 4) |
| FND-FR-23 | Job groups: (1) fast, no Docker (install, lint, typecheck, unit, build); (2) Docker + local Supabase (`db reset`, drift check, `test:db`, `test:e2e`); (3) secret scan; (4) audit | Jobs `fast` (adds `format:check`, `pnpm test`, `pnpm build`), `database-and-e2e` (`db:start` with 12 services excluded, `db:reset`, `db:schema` + `git diff --exit-code src/db`, `test:db`, Playwright install, `test:e2e`, `db:stop` with `if: always()`), `secret-scan`, `audit`. Unit tests include the boundary-rule tests only once T-38 exists | Accepted. Boundary-rule tests join the `fast` job automatically when T-38 lands (no workflow change needed; T-38 confirms) |
| FND-FR-23 | Each job labelled blocking or informational | Job names "(blocking)" x3 and "(informational)" x1; comments in the file | Accepted |
| FND-FR-23 | Playwright browsers and dependencies cached | Browser cache via `actions/cache` keyed on the lockfile; pnpm cache via setup-node; system deps reinstalled each run (about 19 s, only browsers cacheable). Cache restore unproven until a second run (T-23 note) | Accepted with note N2 |
| FND-FR-23 | Files exist, pass `actionlint`, run the same documented commands as local | One workflow file; `actionlint` 1.7.12 exit 0 (T-21, T-24, T-25, T-54); commands are the `package.json` scripts; fresh-clone run in workflow order (212/212, 6/6, drift clean) | Accepted (re-run C1) |
| FND-FR-23 | After the first PO push the run is green | Run `43336680336`: all three blocking jobs success, audit failure as designed, run success. Run `43339244913` also green. This is real-runner evidence that arrived earlier than planned | Accepted for the push-and-green criterion; formal confirmation stays with T-45 |
| FND-FR-23 | A README status badge shows the result | No README exists yet (`Glob` finds none). Owned by T-41 | Deferred to T-41 |
| FND-FR-24 | Gitleaks binary, full history (`fetch-depth: 0`, `--log-opts=--all`), blocking | `secret-scan` job: version and SHA-256 pinned, `sha256sum --check`, `--redact`; `.gitleaks.toml` extends defaults with one allowlist on the `jwt` rule requiring BOTH the exact path and the exact demo token (`condition = "AND"`). Real run: 32 commits scanned, no leaks (T-23 note) | Accepted |
| FND-FR-24 | Given a dummy secret in a commit, the secret-scan job fails | Locally (T-22 negative proofs): a fake AWS key exits 1; a different JWT, or the demo token in another path, is still reported. In CI on GitHub: not yet observed | Accepted locally; real-CI proof deferred to T-47 (pending PO push) |
| FND-FR-24 | `pnpm audit` informational (`continue-on-error`, results visible); a known finding does not block the run | `audit` job has `continue-on-error: true`; real runs show the job failing (2 moderate transitive findings) while the run is green. This is the "known audit finding" case, observed on the real runner | Accepted |
| FND-FR-24 | `.github/dependabot.yml` exists ("Dependabot configured") | Exists, valid against the SchemaStore schema (T-55), lists only `github-actions` (weekly Monday, grouped, limit 2). Judgment 3 below | Accepted with note N3 (reduced scope, PO should confirm) |
| FND-FR-24 | README states a pushed secret must be rotated and how failures are noticed | No README yet. The rotation rule is in the `ci.yml` comments and `docs/architecture.md` | Deferred to T-41 |
| FND-FR-25 | Deploy job: `needs` every blocking job, main only, `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod` | `needs: [fast, database-and-e2e, secret-scan]` (not `audit`); `if: success() && github.ref == 'refs/heads/main'`; own group `deploy-production` with cancel off; steps pull, build, deploy `--prebuilt --prod`; `--env` replaced the deprecated `-e` (T-54, diff of 3 lines); CLI pinned 65.15.0. Graph verified in `verification/step-6.md` rows 1a to 1d | Accepted (workflow design). Real execution deferred, see next rows |
| FND-FR-25 | Vercel Git auto-deploy disabled (`git.deploymentEnabled: false`) | `vercel.json` read: exactly that; verified against Vercel docs in T-25 (resolves the ADR 0004 "not re-verified" note) | Accepted |
| FND-FR-25 | Only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are GitHub secrets; `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_MIGRATION_URL` never in the deploy job or on Vercel | I read the deploy job: only those three secrets, each passed only to steps that call Vercel; no `DATABASE_*` or service-role variable (a comment states it). `database-and-e2e` holds the local, non-secret `DATABASE_MIGRATION_URL`. Tester evidence rows 3a to 3d | Accepted (re-run C3) |
| FND-FR-25 | Given any blocking job fails, the deploy job does not run | By GitHub `needs` semantics (documented, step-6 row 1c); no `always()` in the `if`. Not yet observed on a real red job | Accepted by design; real proof deferred to T-47 (pending PO push) |
| FND-FR-25 | Given all pass, the app is deployed and the post-deploy `/api/health` check (`curl --fail`, known body) passes against the deployed URL; failure fails the workflow | The check is `vercel curl ... --fail` comparing `{"status":"ok"}`, 5 attempts. Simulated locally against a real production build: right body passes on attempt 1; wrong body, HTTP 500 and dead port fail after 5 attempts (step-6 row 4). **No real deployment has happened**: the skip-safe path only (run `43339244913`) | **Deferred: pending PO push/secrets** (`VERCEL_TOKEN`; T-46) |
| FND-FR-25 | The deployed app does not touch a database | FND-FR-03 verified in T-25 row 7: production build with no DB variables succeeds, `/api/health` 200, `/api/health/db` 503 without crashing; the deploy job sets no DB variable | Accepted locally; deployed confirmation in T-46 |
| FND-FR-26 | Gates proven to fail on bad input once (lint, type, test, dummy secret, hello-world; failing blocking job prevents deploy), recorded in the test README | Needs throwaway commits pushed to GitHub, and for the deploy case a real token. Not started. T-47 | **Deferred: pending PO push/secrets** (T-47) |
| FND-FR-07 (CI half) | CI runs the drift check and fails on a diff | `database-and-e2e`: `pnpm db:schema` then `git diff --exit-code src/db`, `DATABASE_MIGRATION_URL` set. Ran green on the real runner. Near-vacuous with 0 tables (T-23 R5), meaningful once epic 002 adds tables | Accepted. Closes the item left open in `acceptance/step-3-4.md` |
| FND-NFR-05 | Blocking secret scan; `.env.example` placeholders only; no real secret in the repo | Scan is blocking and passed on the real runner; local tree and history clean after the allowlist; the demo JWT is handled narrowly (step-3-4 open point G4 closed). The permanent "no server-only variable in the client bundle" assertion is still owed (T-37 per notes) | Accepted with note N4 |
| FND-NFR-06 | Reproducibility: versions pinned, CI and local use the same commands | Node from `.nvmrc`, pnpm from `packageManager`, actions pinned by full SHA (5 actions, SHAs verified against their tags in T-23), Gitleaks version plus hash, CLI `vercel@65.15.0`. Trade-off: the Vercel CLI's transitive dependencies are not lockfile-pinned | Accepted with note N5 |
| D6 | Deployment in: Actions CI and Vercel deploy, only after all blocking jobs, Git auto-deploy off, only `VERCEL_*` secrets | All visible in `ci.yml` and `vercel.json`; ADR 0004 and `docs/architecture.md` updated by the architect in T-26 | Accepted |
| D11 | Blocking: lint, typecheck, unit, DB, E2E, build, secret scan; audit informational; Dependabot on | All blocking items are in `fast`, `database-and-e2e` or `secret-scan`; audit informational; Dependabot on for github-actions only | Accepted with note N3 |

## Judgments requested

### 1. What is accepted now and what is deferred
| Item | Status |
|------|--------|
| FND-FR-23 (workflow design, jobs, labels, caches, `actionlint`, green run on push) | Accepted; badge deferred to T-41; formal re-confirmation in T-45 |
| FND-FR-24 (Gitleaks blocking, audit informational, Dependabot file) | Accepted; dummy-secret failure in real CI deferred to T-47; README secret note deferred to T-41 |
| FND-FR-25 (design, `vercel.json`, secrets inventory, graph, simulated smoke test) | Accepted; **real deployment and post-deploy hello-world: pending PO push/secrets** (T-46) |
| FND-FR-26 | **Pending PO push/secrets** (T-47); nothing to accept yet |
| Definition of done item 8 (workflow files exist, pass `actionlint`, same checks pass locally with the documented commands) | **Met** |
| Definition of done item 9 (first push and Vercel setup: CI green, deployed, smoke test, gates fail on bad input) | **Not yet met, pending PO push/secrets.** CI-green part is already evidenced by two real runs; deploy, smoke test on the deployed URL and gate-failure proofs remain (T-45 to T-48). The epic stays "done pending" |

### 2. J1: deploy job green but skipped while secrets are missing
Acceptable for this stage, with the limit stated plainly: while `VERCEL_TOKEN` is absent, a green run and a green badge do NOT mean "deployed". It was chosen so that every push does not turn red before the PO has a Vercel token, and it is visible (annotation plus summary line, proven on run `43339244913`). Condition: once all three secrets exist the job fails loudly on any error (preflight only skips on missing secrets). T-46 must check that the first real run actually deploys (not skipped) and decide whether to make a missing secret fail the job. The PO should know J1 is live today.

### 3. Dependabot reduced to github-actions: does it meet FND-FR-24?
Plainly: **partly.** FR-24 says "Dependabot configured" and D11 says "Dependabot on". The file exists and works for GitHub Actions versions, which is the part that protects the pinned SHAs. It does NOT update npm dependencies, which is what most people expect from Dependabot and the part that would surface vulnerable or stale packages. The npm entry was inert (run `43336683433` failed with `ERR_PNPM_UNSUPPORTED_ENGINE`: the updater runs Node 24, the project enforces Node >=26.13.1 by `engineStrict`, a deliberate FR-02 decision), and a configured-but-failing ecosystem is worse than none. The architect's and orchestrator's choice is reasonable and reversible (a documented re-add path is in the file). I accept it as meeting the literal acceptance criterion ("`.github/dependabot.yml` exists") and the intent only in part: npm updates are manual, and the only automated signal for them is the informational `pnpm audit`. **This reduces the original D11 intent, so I flag it for the PO to confirm (see Decisions).** README (T-41) must say dependencies are updated manually.

### 4. J2 and other recorded trade-offs
| Trade-off | Verdict |
|-----------|---------|
| J2 health check runs after `--prod` has promoted the deployment (a bad build serves traffic, no rollback) | Acceptable for a hello-world with no users and no data. Option for later is recorded in ADR 0004 (`--skip-domain`, check, `vercel promote`). Revisit before real users |
| Workflow-level cancel disabled on `main` (runs queue) | Acceptable: protects a deploy from being killed halfway; cost is only queueing on a solo project |
| Vercel CLI via `pnpm dlx vercel@65.15.0`, transitive dependencies unlocked while the job holds `VERCEL_TOKEN`; Dependabot will not bump it | Acceptable for the MVP; recorded; revisit before real users |
| Write-access residual (anyone who can push a branch can run a workflow that reads the three secrets; repo secrets are not branch-scoped; `main` unprotected) | Acceptable for a solo-owner repository; the architect's suggestion of a GitHub Environment restricted to `main` is a cheap hardening the PO may want (optional, out of scope here) |
| Reduced CI stack (Postgres and Kong only; no Auth, Realtime, Storage) | Acceptable: nothing tested needs them; epic 002 must remove `gotrue` from the `-x` list |
| `NEXT_PUBLIC_APP_URL=http://localhost:3000` in the deployed app | Acceptable: nothing reads it yet; must be replaced before epic 002 auth redirects |
| Drift check near-vacuous with 0 tables | Acceptable; becomes real in epic 002 |

### 5. T-54 and T-55 are inside the spec's intent
- T-54 (3-line change `-e` to `--env`): fixes a deprecation found by verification in the FR-25 job. No new behavior. Inside intent.
- T-55 (drop the npm ecosystem, keep github-actions, comment explaining why): a correction to the FR-24 configuration, not a new feature. Inside intent, with the caveat in judgment 3 (it narrows what "Dependabot configured" delivers). The spec text of FR-24 itself is unchanged; the spec change log should mention it.

### 6. Scope gate: nothing out of scope added
Checked against `ci.yml`, `vercel.json`, `dependabot.yml`, `.gitleaks.toml`: no preview deployments (only `--prod`, main only), no cloud database (no `DATABASE_URL` or migration step anywhere in the deploy job), no extra secrets (exactly three `VERCEL_*`), no CodeQL, ZAP or license scanning, no `pull_request_target`. Additions beyond the literal task text but inside intent: `format:check` in `fast`, the `deploy-production` concurrency group, the skip-safe preflight (a design choice for "PO has not created secrets yet", recorded as J1), Playwright report artifact on failure (7 days). None changes scope; the preflight is the only one with a user-visible effect and is flagged in J1.

## Notes

- N1: because cancel-in-progress is off on `main`, consecutive pushes queue instead of cancelling; the middle commit of a burst can get no run of its own (tester, step-6 row 2).
- N2: Playwright and pnpm cache restore and artifact upload are unproven until a second run (the second run used the caches only for creation, per the T-23 note).
- N3: Dependabot covers github-actions only (judgment 3).
- N4: the secret scan is proven locally and green on the real runner, but the "dummy secret in a commit fails the job" case has only been shown locally; T-47 proves it in CI. The bundle assertion for server-only variables is still owed.
- N5: tiny cosmetic leftovers in `ci.yml` (not defects): the comment above "Deploy prebuilt output" still says `-e` although the flag is now `--env`; the health-check loop still sleeps 5 s after the last failed attempt. Neither affects behavior.
- Unproven until the first real deploy (from the T-24, T-25 and T-26 notes): `vercel pull --yes` with only the three environment variables and no `.vercel/`; `vercel build --prod` on the runner; `deploy --prebuilt --env` printing only the URL and the runtime env satisfying `instrumentation.ts` and `next.config.ts`; `vercel curl` with a full URL and the Deployment Protection bypass; `pnpm dlx` of the CLI on a cold runner under the release-age policy; real queue behavior on consecutive pushes to `main`; a red blocking job preventing the deploy.

## Open points owed to later tasks

| Item | Owner and task |
|------|----------------|
| `/design` axe checks and `/design` 404 in the Vercel production build (production gating must not break the post-deploy `/api/health` check) | tester T-33, developer T-32 |
| Boundary lint rules and fixture tests (they join the `fast` job through `pnpm test`; confirm CI still passes) | developer T-37, tester T-38 |
| README: status badge, "a pushed secret must be rotated, not only removed", how failures are noticed (badge, GitHub failure email), CI/CD overview, PO prerequisites (the three `VERCEL_*` secrets, Vercel project), dependencies updated manually and `pnpm audit` informational, Node 26 and no corepack, `.env.local` for `db:schema`, never `--include-seed` against a cloud project | developer T-41 |
| Test README: finishing pass and the "Gate failure proofs" section (filled by T-47) | tester T-40 |
| Fold the remaining ADR and architecture fixes (ADR 0002 validate-and-restore behavior, stale ADR 0003 text, `lib/supabase/` in `architecture.md`, ADR 0004 env split) and record the cloud re-verification list | architect T-36 (documents), T-43 (final check) |
| Onboarding dry run on a clean machine, including seeing a truly stopped Docker daemon once | tester T-42 |
| First CI run formally green (already evidenced by runs `43336680336` and `43339244913`; T-45 records it against the final commit) | tester T-45 (pending PO push) |
| Real Vercel deploy, post-deploy hello-world on the deployed URL, check that the deploy job is not skipped, decide whether a missing secret should fail loudly (J1), confirm `NEXT_PUBLIC_*` runtime env | tester T-46 (pending `VERCEL_TOKEN`) |
| Gates fail on bad input in real CI (lint, type, test, dummy secret, failing hello-world, failing blocking job prevents deploy), recorded and reverted | tester T-47 (pending PO push/secrets) |
| Final acceptance of DoD item 9 and update of the epic status in `specs/README.md` | product-manager T-48 |
| Epic 002 CI changes: remove `gotrue` from the `-x` list, replace `NEXT_PUBLIC_APP_URL`, migration check, decisions on preview deployments and a cloud project | epic 002 spec (not an 001 task) |

## Verdict

**Steps 5 and 6, local part: accepted** (definition of done item 8 met). **No rejected items.**
- FND-FR-23: accepted, with the README badge deferred to T-41.
- FND-FR-24: accepted with note (Dependabot covers github-actions only; dummy-secret CI proof in T-47; README note in T-41).
- FND-FR-25: design, `vercel.json`, secrets inventory, job graph and simulated smoke test accepted; **real deployment and post-deploy hello-world deferred, pending PO push/secrets (T-46)**.
- FND-FR-26: **deferred, pending PO push/secrets (T-47)**.
- Definition of done item 9: **pending**; the epic stays "done pending".
- FND-FR-07 (CI drift check) and FND-NFR-05, FND-NFR-06: accepted (NFR-05 with the bundle assertion still owed).
The only re-runs I could not do (C1 to C5) are confirmations of reported results, not known gaps.

## Decisions for the Product Owner

1. **Dependabot scope (recommended: accept as is).** Confirm that github-actions-only Dependabot is acceptable for FND-FR-24 and D11, knowing npm updates are manual and only `pnpm audit` (informational) flags them. Alternative: reopen when Dependabot's updater supports Node 26, or relax the Node floor (not recommended; it is an FR-02 decision).
2. **Spec change log (recommended: yes).** Record T-54 and T-55 (and the skip-safe preflight, J1) in the spec change log so the approved spec and the task list agree. No requirement text change needed.
3. **To unlock T-46 to T-48:** the PO creates a Vercel project and adds `VERCEL_TOKEN` to the repository secrets (`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` already exist); until then every push ends green with a skipped deploy (J1).
4. Optional, not recommended now: GitHub Environment `production` restricted to `main`, a branch ruleset on `main`, explicit `minimumReleaseAge` (architect suggestions, out of scope for 001).

## Commit

None made: this session has no shell, so the file is left uncommitted. Suggested commit by the orchestrator: stage only `specs/001-foundations/acceptance/step-5-6.md` (never `specs/001-foundations/tasks.md` or `.vscode/`), subject `docs(spec): accept steps 5-6 of foundations (local part)`, body `Task: FND-T-27`, no trailers; then verify with `git log -1 --format=%B | grep -iE "co-authored|claude|copilot"` (expect nothing). The orchestrator then updates the T-27 status in `tasks.md`.
