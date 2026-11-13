# Step 5 verification: CI workflow (FND-T-23)

Verifier: tester (fresh context). Scope: FND-FR-23, FND-FR-24, FND-NFR-06, FND-NFR-07 (CI part). State verified: commit `ddf7210` (HEAD of `main`), real run `43336680336` on `hgonza81/nextjs-starter` (event `push`, head SHA `ddf7210006d10ba4cf2dfc8eefc967b631b81bbd`, conclusion `success`). No workflow run was triggered; GitHub was used read-only (`gh run view`, `gh api`).

## Verdict

**PASS, no blocking defects.** All spec criteria that can be checked before T-47 hold, and the real run proves the Docker group. Five low/medium risks and three items owed by later tasks are listed below; none blocks T-24, but R1 and R2 must be handled inside T-24.

## Criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Trigger is `push` only (no `pull_request`) | Pass | `on: push`. Note: `push` also fires for tag pushes and for Dependabot branches (see R1). |
| 2 | Per-ref concurrency with cancel | Pass | `group: ci-${{ github.ref }}`, `cancel-in-progress: true` (see R2 for the effect on a future deploy job). |
| 3 | Least privilege | Pass | Top-level `permissions: contents: read`; no job widens it; no job needs more (cache and artifact use the runtime token, not `GITHUB_TOKEN`). |
| 4 | Jobs labelled blocking / informational | Pass | Names: "Fast checks (blocking)", "Database and E2E (blocking)", "Secret scan (blocking)", "Dependency audit (informational)". |
| 5 | Blocking jobs really block | Pass | `grep` shows `continue-on-error` only on `audit` (job level). No `|| true`, no `if: always()` on a test step. `if: always()` appears only on `db:stop`; `if: failure()` only on the artifact upload. |
| 6 | Audit is the only informational job | Pass | See 5. Run: audit job `failure`, workflow `success`. |
| 7 | Actions pinned by full SHA, and each SHA is the stated tag | Pass | `gh api repos/<r>/git/ref/tags/<tag>` (peeled when annotated): checkout v7.0.1 `3d3c42e5...` MATCH; setup-node v7.1.0 `949feb24...` MATCH; pnpm/action-setup v6.1.1 `73e46992...` MATCH; cache v6.1.0 `55cc8345...` MATCH; upload-artifact v7.0.2 `cf430e03...` MATCH. All five are also the latest releases today. |
| 8 | Gitleaks checksum | Pass | Hard-coded `551f6fc8...470eb` equals the line for `gitleaks_8.30.1_linux_x64.tar.gz` in the official `gitleaks_8.30.1_checksums.txt` (downloaded) and the GitHub asset digest from `gh api .../releases/tags/v8.30.1`. The run log shows `...tar.gz: OK`. |
| 9 | No secrets referenced | Pass | No `secrets.` anywhere. Workflow env holds only the three `NEXT_PUBLIC_*` placeholders and the local DB URL (`postgres:postgres@127.0.0.1`, same as `.env.example`). |
| 10 | No deploy job yet | Pass | Four jobs only. |
| 11 | `timeout-minutes` on every job | Pass | 15 / 10 / 10 / 30. |
| 12 | Run: fast job ran the documented commands | Pass | Steps: `pnpm install --frozen-lockfile`, lint, typecheck, `format:check`, test, build, all success; 54/54 unit tests; `next build` compiled. No Docker used by this job. |
| 13 | Run: `test:db` really ran 212 tests | Pass | Log: `Test Files 7 passed (7)`, `Tests 212 passed (212)`, duration 14.27 s (includes the 8 s timeout test). |
| 14 | Run: E2E ran 6 tests | Pass | Log: `Running 6 tests using 2 workers`, `6 passed (13.3s)`; no retry/flaky marker. |
| 15 | Run: drift check ran | Pass, but weak | Step "Schema drift check" ran `pnpm db:schema` then `git diff --exit-code src/db`, success. The real schema has 0 tables today, so the check is nearly vacuous until epic 002 (see R5). |
| 16 | Run: Node satisfies `engines` (`>=26.13.1 <27`) | Pass (at the floor) | `.nvmrc` `26` resolved to `node: v26.13.1` in all three Node jobs. pnpm 12.18.0 (matches `packageManager`). |
| 17 | Run: caches used or created | Pass (created, not yet restored) | First run on this repo: `pnpm cache is not found` then saved (fast job); Playwright: `Cache not found for input keys: playwright-Linux-...` then `Cache saved with key`. A restore cannot be proven until the next run. |
| 18 | Run: audit output visible, findings | Pass | Full table in the log. 2 moderate, both transitive dev dependencies: esbuild `<=0.24.2` via `drizzle-kit>@esbuild-kit/...` (GHSA-67mh-4wv8-2f99) and minimatch `>=7 <11.0.1` via `eslint-config-next>...>typescript-estree` (GHSA-g3hv-75wg-m249). Exit 1 shown as `##[error]`, job red, run green. Same 2 findings locally. |
| 19 | Run: artifact step skipped on success | Pass | `Upload Playwright report` = skipped; `Stop local Supabase` ran (success). |
| 20 | Gitleaks in the run | Pass | `32 commits scanned ... no leaks found` (local: also 32 commits, no leaks, same config). `fetch-depth: 0` present. |
| 21 | CI commands equal the documented local commands | Pass | `package.json` scripts and `tests/README.md` list the same commands. Fresh clone of `ddf7210` on Node 26.13.1 without Docker and without `.env.local`, with only the three `NEXT_PUBLIC_*` variables set: `pnpm install --frozen-lockfile` exit 0, lint 0, typecheck 0, format:check 0, test 0 (54/54), build 0. Documented differences: CI starts the stack with `-x <services>` (R4) and sets `DATABASE_MIGRATION_URL`/`CI=1` as env instead of `.env.local`. |
| 22 | `actionlint` | Pass | actionlint 1.7.12, `.github/workflows/ci.yml`: exit 0, no output. Also valid against the SchemaStore GitHub-workflow schema (`check-jsonschema`). |
| 23 | `dependabot.yml` valid | Pass | `check-jsonschema` against `https://json.schemastore.org/dependabot-2.0.json`: ok. npm + github-actions, weekly Monday, PR caps 3/2, groups as documented. Dependabot already started its two dynamic runs on GitHub (per the orchestrator note). |
| 24 | `.gitleaks.toml` scope | Pass | Extends default rules; a single allowlist on the `jwt` rule with `condition = "AND"` (exact file path and exact demo token). Run and local scans agree. |

## Requirement coverage (what T-23 can cover)

| ID | Status | Note |
|----|--------|------|
| FND-FR-23 | Covered except README badge (T-41) and "dependencies cached": only browsers are cached; the apt system dependencies of `--with-deps` are reinstalled every run (about 19 s), which is what the spec's own workflow comment says. | Green run on GitHub verified. |
| FND-FR-24 | Covered for the secret scan (blocking, full history, binary, checksum), audit (informational, visible) and Dependabot. README rotation statement owed by T-41. | The "dummy secret makes the job fail" proof is T-47 (not done here by instruction; T-22 reported a local negative proof). |
| FND-NFR-06 | Covered for CI: pinned SHAs, no secrets, least privilege. Deploy part is T-24. | |
| FND-NFR-07 | Covered: documented commands = CI commands. | |

## Defects

None.

## Risks and judgments (ordered by importance)

- **R1 (medium, for T-24): `on: push` fires for every branch and tag**, including Dependabot's `dependabot/*` branches and any tag. The future deploy job must be guarded with `if: github.ref == 'refs/heads/main'` (and `needs` on the three blocking jobs), otherwise a Dependabot branch or a tag could deploy.
- **R2 (medium, for T-24): `cancel-in-progress: true` can cancel a run in the middle of a deploy** when a second push arrives. Give the deploy job its own `concurrency` group with `cancel-in-progress: false`.
- **R3 (medium, for T-24): `needs` semantics.** `database-and-e2e`, `fast` and `secret-scan` have no `needs` between them (by design, they run in parallel). The deploy job must list all three in `needs`. It must NOT list `audit`: with job-level `continue-on-error` its result is `failure` and the deploy would never run. Document this in the workflow.
- **R4 (low/medium): the CI stack excludes 12 Supabase services (`-x ...`) while local `pnpm db:start` runs the full stack.** Tests that pass in CI therefore do not prove behaviour with Auth (`gotrue`), PostgREST etc.; the T-21 note already says epic 002 must remove `gotrue` from the list. Kong is required by the FND-FR-08 test. Judgment: acceptable now, add a task item in epic 002.
- **R5 (low): the drift check is nearly vacuous** (`0 tables fetching` in the log): it will only protect once epic 002 adds tables. The check itself and its failure path were not exercised (T-47).
- **R6 (low): unpinned runtime pieces.** `ubuntu-latest` already moved to `ubuntu-26.04` (image `20261111.196`); Node is `26` resolved by the runner manifest (today 26.13.1, exactly the `engines` floor, newer 26.x are fine); the Supabase container images are pinned only through the Supabase CLI version (`supabase` 3.1.0 in `devDependencies`: kong 2.8.1, postgres 17.11.0.018 seen in the log) and are pulled on every run (no image cache; run step took about 54 s); Playwright's Chromium version follows `@playwright/test` 1.65.0 (pinned); Gitleaks is pinned by version and hash but Dependabot will not bump it (documented). `pnpm audit` depends on the live npm advisory database, so it can start reporting new findings without any commit (informational, acceptable). `pnpm` itself is installed by `pnpm/action-setup` from `packageManager`, then downloads `@pnpm/exe` at run time.
- **R7 (low): Supabase image pull and registry dependence.** A registry outage or rate limit would fail the blocking `database-and-e2e` job (false red) and, once T-24 gates on it, block deploys. Flaky-prone steps in this job: image pulls, `apt` install by `playwright install --with-deps`, the 8 s `pg_sleep` timeout test (deterministic, but the most timing-sensitive test). In the real run none was flaky (6/6 with no retry). The E2E uses CI retries 2, which can hide a flaky test; the run log shows no retry.
- **R8 (low): cache race.** Both `fast` and `database-and-e2e` use the same setup-node pnpm cache key; in the real run one of them logged `Failed to save: Unable to reserve cache ... another job may be creating this cache`. It is non-fatal and harmless. Whether the next run restores the cache is not proven yet.
- **R9 (info): cost.** Billable time of the real run about 3.5 job-minutes (fast 45 s, database 2 m 27 s, secret 4 s, audit 15 s), wall time about 2.5 min. A public repository has free Actions minutes, so cost is nil; the 30 min job timeout is a sane cap.
- **R10 (info): scan scope.** Gitleaks runs `--log-opts=--all` after a `fetch-depth: 0` checkout, so it scans everything reachable from the checked-out ref plus fetched tags, not unrelated remote branches. Adequate for a single-branch project.
- **R11 (info): the audit job shows a red X in the Actions UI** although the run and the badge stay green. This is the designed behaviour; the README (T-41) should say so, so nobody treats it as an incident.

## Not verified (by instruction or impossible before a later push)

- That each gate fails on bad input (dummy secret, failing test, drift): T-47.
- That caches are restored on a second run.
- That the artifact upload works (skipped on success; only provable on a failing run).
- That the Docker group works on a fresh clone locally: not rerun, the real run already proves it on `ubuntu-latest`.
- README badge and rotation text: T-41.

## For the Product Owner to decide

1. Whether to accept R4 as is (CI stack reduced, Auth added back in epic 002) or to run the full Supabase stack in CI at about 1-2 extra minutes per run. Recommendation: keep reduced, as the T-21 note already commits epic 002 to re-enable `gotrue`.
2. Whether Dependabot PRs may also run CI (they do today, because `push` fires on their branches). Recommendation: keep, harmless, but T-24 must restrict deploy to `main` (R1).

## Commands run

`gh run view 43336680336 --json jobs,...` and `--log`; `gh api` tag/ref lookups for the five actions; release asset digest and `gitleaks_8.30.1_checksums.txt` download; `actionlint .github/workflows/ci.yml` (exit 0); `check-jsonschema` on both YAML files; fresh `git clone` of `ddf7210` into the scratchpad, then install/lint/typecheck/format:check/test/build (all exit 0); `pnpm audit` locally (exit 1, same 2 findings); `gitleaks detect --source . --log-opts=--all --redact` locally (32 commits, no leaks). The clone was deleted afterwards. No production code or tests were changed.
