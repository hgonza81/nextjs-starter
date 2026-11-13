# Verification report: step 6 (deploy workflow, local part)

Task: FND-T-25. Verified commit: `a55dba5` (FND-T-24). Verifier: tester, fresh context, nothing from the developer's report taken on trust.
Scope: FND-FR-25 (locally verifiable part), FND-FR-03 (production without a database), FND-NFR-06 (pinned versions). Not in scope: proving the gates fail in CI (T-47), first real deploy (needs the PO's secrets).
Constraints respected: nothing pushed, no workflow run triggered, no Vercel API call with a token (all CLI calls were `--version`, `--help` or argument parsing with an empty token in an empty scratch HOME).

## Verdict

**PASS with one low defect (D1) and four judgments for the PO (J1 to J4).** Every locally provable criterion passes. The parts that need Vercel are listed under "Unproven until the first real deploy".

## Results

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1a | `deploy` needs exactly `fast`, `database-and-e2e`, `secret-scan`, not `audit` | PASS | `ci.yml` line 182: `needs: [fast, database-and-e2e, secret-scan]`. `audit` appears nowhere in `needs`. |
| 1b | Condition `success() && github.ref == 'refs/heads/main'` | PASS | line 183, exact text. Tag and other-branch pushes evaluate false, so the job is skipped. |
| 1c | A failing or skipped blocking job prevents the deploy | PASS (documented semantics) | GitHub docs, `jobs.<job_id>.needs`: "If a job fails or is skipped, all jobs that need it are skipped unless the jobs use a conditional expression that causes the job to continue" (only `always()`-style expressions do that; `success()` does not). The deploy `if` has no `always()`/`failure()`. |
| 1d | Red `audit` (continue-on-error) does not affect the deploy | PASS | `audit` is not in the `needs` chain, so its result is never consulted by `needs` or `success()`. `audit` is the only job with `continue-on-error` (line 93). Consistent with real run 43336680336 (audit red, run green, per step-5.md). The one thing the docs excerpt I could read does not spell out is how `continue-on-error` is reported to a dependent job; it does not matter here because there is no dependency. |
| 2a | Workflow-level `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}` is valid | PASS | GitHub docs: "you can specify `cancel-in-progress` as an expression with any of the allowed expression contexts"; the `github` context is allowed at workflow level. `actionlint` accepts it. |
| 2b | Runs on main never cancelled, other refs are | PASS (by expression) | main: `false`; branches/tags (`refs/heads/x`, `refs/tags/x`): `true`. |
| 2c | Deploy job's own group | PASS, redundant today | `deploy-production`, `cancel-in-progress: false`. Because the workflow group already serializes runs on main, the job group only matters for a second workflow that deploys (none exists). Harmless, keep as a guard. |
| 3a | Only the three `VERCEL_*` secrets referenced | PASS | `grep 'secrets\.'` gives 12 hits, all `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`; `GITHUB_TOKEN` is not used. Only one workflow file exists. |
| 3b | Each only in steps that call Vercel | PASS (note) | Used in preflight (existence test only), pull, deploy, health check. `Build` (`vercel build --prod`) has none, correct: it works from the pulled `.vercel/` directory. The three `actions/*` steps have none. |
| 3c | No `DATABASE_*`, service-role key or migration URL in deploy job | PASS | `grep 'DATABASE_\|SERVICE_ROLE'` over the whole file: line 111 (`database-and-e2e` job env, legitimate) and line 179 (a comment in the deploy job saying the job never sets them). No variable of that name is set in the deploy job. |
| 3d | No secret echoed | PASS | No `set -x`/`xtrace`. The `echo` lines print only: variable NAMES of missing secrets, `ready=`, the deployment URL, attempt counters, an error text. The token is never expanded in a command line (CLI reads `VERCEL_TOKEN` from the environment, no `--token`). GitHub masks secrets in logs anyway. |
| 3e | Preflight, all 8 combinations (extracted lines 212-224 and run with `bash -e`, as GitHub does) | PASS | See table below. |
| 3f | Every later step guarded | PASS | 7 occurrences of `steps.preflight.outputs.ready == 'true'` for the 7 steps after preflight (checkout, pnpm, setup-node, pull, build, deploy, health). A step `if` without a status function gets an implicit `success()`, so a failed deploy step also skips the health step. |
| 4 | Post-deploy comparison logic against a real local `pnpm build && pnpm start` | PASS | See table below. |
| 5a | `vercel.json` valid; `git.deploymentEnabled: false` correct | PASS | Parses as JSON. Vercel docs ("Git Configuration", updated 2026-08-25): "To turn off automatic deployments for all branches, set the property value to `false`", with exactly this JSON. Resolves the ADR 0004 "not re-verified" note. |
| 5b | Pinned CLI exists | PASS | `pnpm dlx vercel@65.15.0 --version` prints `65.15.0` (also npm `latest` today). |
| 5c | Flags match the CLI (`--help`, plus argument parsing without auth) | PASS with D1 | `pull`: `-y/--yes`, `-e/--environment <ENV>` (the job uses `--environment=production`). `build`: `--prod`. `deploy`: `--prebuilt`, `--prod`, `--env`. `curl`: first argument may be a full URL, `--yes`, `--` then curl options. `-e` on `deploy` still works but is **deprecated** (D1). |
| 6 | `actionlint` clean; nothing undefined | PASS | `actionlint 1.7.12 .github/workflows/ci.yml`: no output, exit 0. `steps.deploy.outputs.url` is defined by step `id: deploy` which writes `url=`; `steps.preflight.outputs.ready` defined; `VERCEL_CLI_VERSION` defined in the job env; `NEXT_PUBLIC_*` come from workflow env. |
| 7 | FND-FR-03: production build with no DB variables and only the three `NEXT_PUBLIC_*` values; `/api/health` known body | PASS | In a clean `git archive HEAD` copy (so the local `.env.local` could not leak DB variables in), `pnpm install --frozen-lockfile`, then `env -i` with only PATH/HOME and the three values: `pnpm build` succeeded (routes `/`, `/_not-found`, `/api/health`, `/api/health/db`). `next start`: `GET /api/health` is 200 with `{"status":"ok"}`. `/api/health/db` is 503 `{"status":"unavailable"}` (no DB, no crash). Control: the same build without the public variables fails with `Invalid environment variables: NEXT_PUBLIC_SUPABASE_URL ...`, so the three values are really required (the workflow supplies them). |
| 8 | Risks | See R1 to R8 | |

### 3e. Preflight simulation (`T`=token, `O`=org, `P`=project; 1 = present)

| T O P | `::warning` | Summary line | Output |
|-------|-------------|--------------|--------|
| 0 0 0 | `Vercel secrets missing: VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID. Create them ...` | `Deployment SKIPPED because secrets are missing: VERCEL_TOKEN VERCEL_ORG_ID VERCEL_PROJECT_ID.` | `ready=false` |
| 1 0 0 | missing: `VERCEL_ORG_ID VERCEL_PROJECT_ID` | same, same names | `ready=false` |
| 0 1 0 | missing: `VERCEL_TOKEN VERCEL_PROJECT_ID` | same | `ready=false` |
| 0 0 1 | missing: `VERCEL_TOKEN VERCEL_ORG_ID` | same | `ready=false` |
| 1 1 0 | missing: `VERCEL_PROJECT_ID` | same | `ready=false` |
| 1 0 1 | missing: `VERCEL_ORG_ID` | same | `ready=false` |
| 0 1 1 | missing: `VERCEL_TOKEN` | same | `ready=false` |
| 1 1 1 | none | none | `ready=true` |

Exit code 0 in every case (the job stays green while secrets are missing, by design). A secret that is unset and one that is empty behave the same (an unconfigured GitHub secret expands to an empty string). A whitespace-only secret counts as present (`ready=true`); negligible.

### 4. Post-deploy check simulation

Method: the exact loop from the workflow (lines 289-302) is extracted and run under `bash -e` with RUNNER_TEMP, VERCEL_CLI_VERSION, DEPLOYMENT_URL and GITHUB_STEP_SUMMARY set. A shell function named `pnpm` stands in for `pnpm --reporter=silent dlx vercel@X curl URL --yes -- <curl opts>`; it asserts the argv shape (zero "UNEXPECTED ARGV" in all runs) and calls plain `curl URL <same options>`.

| Case | Target | Result |
|------|--------|--------|
| Right body | real `next start` of the production build | passes on attempt 1, exit 0, summary line written |
| Wrong body | stub server 200 `{"status":"down"}` | 5 attempts, `::error::Health check failed ...`, exit 1, about 25 s |
| HTTP 500 | stub server 500 `{"status":"ok"}` (right body, wrong status) | 5 attempts, exit 1 (`curl: (22) ... returned error: 500` via `--fail`) |
| Dead port | nothing listening | 5 attempts, exit 1 |
| Trailing newline | stub 200 `{"status":"ok"}\n` | passes (`$(cat)` strips trailing newlines); correct, Next sends none anyway |
| Whitespace in body | stub 200 `{"status": "ok"}` | fails: the comparison is byte exact. Acceptable: the app's own body is fixed and a changed serializer would be a real change to notice. |

Cost note: the loop sleeps 5 s after the 5th failed attempt too (25 s instead of 20 s). Cosmetic.

## Defects

| ID | Severity | Finding | Reproduction | Handled by |
|----|----------|---------|--------------|-----------|
| D1 | Low | `vercel deploy -e` is deprecated in the pinned CLI 65.15.0: it prints `! -e is deprecated. Use --env.` The job uses `-e` three times. It works today and the message goes to stderr (stdout, which the job captures as the URL, stayed clean), but a future CLI bump may remove the alias and break the deploy. | `pnpm dlx vercel@65.15.0 deploy --prebuilt --prod -e A=b --non-interactive` in an empty directory prints the warning on stderr; `-e` with no argument reports "alias for --env". | developer: replace `-e` by `--env` (same semantics, listed in `deploy --help`). Not a blocker. |

No other defect found. No production code or workflow was modified.

## Risks and judgments

| ID | Topic | Assessment | Recommendation |
|----|-------|------------|----------------|
| R1 | Two quick pushes to main | Sequence (GitHub docs: at most one running and one pending per group; a newer pending run replaces the older pending one): push 1 starts run A; push 2 queues run B (pending); push 3 cancels B and queues C; A finishes completely (including its deploy), then C runs. The commit of push 2 never gets its own CI run or deploy (C, which contains it, covers it). A is never cancelled. A stuck run holds the queue up to its job timeouts (30 min for the Docker job, 15 for deploy). Previously main behaved as cancel-in-progress; this costs runner time and delays feedback, which is an accepted trade-off for a solo workflow. | None. Mention in the README (T-41) that a middle commit may show as cancelled while pending. |
| R2 | `pnpm dlx` transitive dependencies not locked | Real and acknowledged in the workflow comment. The CLI is "native" in 65.15.0 (the banner says `65.15.0 (native)`), which limits but does not remove the exposure; the job holds the deploy token. Dependabot will not bump the version. | Accept for the MVP. When the project has a cloud DB or real users, revisit (devDependency with release-age exclusions, or a checksum-verified binary). |
| R3 | Deployment Protection and `vercel curl` | `vercel curl --help` says "automatic protection bypass" and `deploy --verify` says it creates the project's "Protection Bypass for Automation" secret if missing. So the approach is plausible, but whether the token's permission is sufficient and whether the bypass is set up is not provable offline. If it fails, the job fails after a deployment already exists (see J2). | First deploy decides. Fallback options: `deploy --verify`, or turn off Deployment Protection for production. |
| R4 | `NEXT_PUBLIC_APP_URL=http://localhost:3000` placeholder in production | Nothing reads it yet. It will silently be wrong in production as soon as a feature (auth redirects, emails) uses it. | Epic 002 must replace the placeholder before any feature reads it; keep on the tracking list for the cloud-project step. |
| R5 | `-e` values visible in the Vercel dashboard | Confirmed non-sensitive: `http://127.0.0.1:54321`, `replace-with-local-anon-key` (a literal placeholder), `http://localhost:3000`. No secret, no DB variable. A real Supabase anon key will be public by design, but should still go into Vercel project settings, not into the workflow, when it exists. | None now. |
| R6 | A green run on main does not mean "deployed" | While any of the three secrets is missing the job is green and only a warning and a summary line say "SKIPPED". Anyone looking at the green badge could assume production is live. | Covered by J1. |
| R7 | What a failed deploy leaves behind | Build failures happen on the runner before anything is uploaded: nothing is left on Vercel. A failure of `vercel deploy` itself leaves at most a failed/canceled deployment record in the project (not served). A failure of the health check is different: see J2. The prebuilt artifact lives only in the runner's `.vercel/output`, which is destroyed with the runner. | See J2. |
| R8 | Retry window | 5 attempts 5 s apart tolerates about 20 s of cold start or propagation. `vercel deploy` waits for the deployment to be ready by default, so this is probably enough, but it is unproven. | Adjust after the first real run if needed. |

Judgments for the PO (decision needed only if you want a change):

- **J1. Skip-safe job versus fail-loud.** Today the deploy job turns green (skipped with a warning) when secrets are missing, so the first pushes are not red. Risk: it can hide that nothing deploys. Option A (current, recommended while the PO has not created the secrets): keep. Option B: fail the job when secrets are missing, which turns every push red until the secrets exist. Recommendation: A now, and when the PO adds the secrets, tell the orchestrator so that T-46 verifies a real deploy; consider switching to B afterwards.
- **J2. Health check runs after the production deployment is already live.** `vercel deploy --prod` assigns the production domain immediately, so a bad build serves traffic before the check runs; a failing check only turns the workflow red, it does not roll back. For a hello world this is acceptable. Option A (current): keep. Option B: `deploy --prod --skip-domain` (flag exists in 65.15.0), check the deployment URL, then `vercel promote`, which makes production gated by the check. Recommendation: A for now, B when the app has real users.
- **J3. Pin by version only.** See R2. Recommendation: accept.
- **J4. Queue-on-main behavior.** See R1. Recommendation: accept.

## Unproven until the first real deploy

These cannot be shown without the Vercel token and project; none was run:

1. `vercel pull --yes --environment=production` works with only `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`/`VERCEL_TOKEN` in the environment and no `.vercel/` directory (the CLI help does not state it).
2. `vercel build --prod` on the runner uses the pulled settings and produces `.vercel/output` (the same Next.js build was proven locally, but not through the Vercel builder).
3. `deploy --prebuilt --prod --env ...` prints only the URL on stdout in a non-interactive runner, the `case https://*` guard accepts it, and the runtime env satisfies `src/instrumentation.ts`/`next.config.ts` (the app needs the three public variables at start, proven locally with `next start`).
4. `vercel curl <full URL> --yes -- ...` works with a protected deployment and the automatic bypass (R3), and the CLI accepts a full URL as the path argument (the help example uses full URLs; behavior not run).
5. The effect of the changed workflow-level `cancel-in-progress` on real consecutive pushes to main (R1), and that a skipped-deploy run (secrets missing) really ends green with the warning annotation and summary visible.
6. `needs` behavior when a blocking job fails: relied on GitHub's documented semantics; the actual red-job proof belongs to T-47.
7. Whether `pnpm dlx` of the pinned CLI succeeds on a cold runner under the project's `minimumReleaseAge` policy (it ran fine locally here).

## Commands run (all local)

`actionlint .github/workflows/ci.yml` (0 findings); `grep` of secrets/forbidden names; `bash -e` preflight simulation x8 plus unset and whitespace cases; `pnpm dlx vercel@65.15.0 --version | pull --help | build --help | deploy --help | curl --help | deploy ... -e A=b --non-interactive` (empty HOME and token, no network call to any authenticated endpoint, rejected locally for lack of interactive confirmation); clean `git archive HEAD` copy, `pnpm install --frozen-lockfile`, `env -i ... pnpm build` (success) and without public variables (fails as expected), `next start`, curl; health-check loop simulation x6 against the real server and stub servers; Vercel docs (`git.deploymentEnabled`) and GitHub workflow-syntax docs (concurrency, `needs`). All scratch files were outside the repository and the servers were stopped.
