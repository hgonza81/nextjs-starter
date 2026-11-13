# 0009. CI/CD pipeline

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
The PO overrode the "CI only" recommendation: GitHub Actions for CI and deployment to Vercel, with a hello-world check, no branches, no PRs, no hooks, and workflows that run on every push (questions.md Q5, Q6, Q9, round 2; spec D6, D7, D11). Earlier notes called deployment a two-way door with no ADR (spec D6, FND-T-26). It is recorded now because the PO asked for ADRs and because the secret model and gating are expensive to unpick. Secrets and the environment split are in ADR 0004; this ADR records the pipeline shape.

## Options considered
1. **One GitHub Actions workflow; blocking and informational jobs; deploy from Actions only after all blocking jobs pass.** Pros: one place, same commands as local, deploy gated by tests. Cons: Vercel secrets live in GitHub.
2. **Vercel Git auto-deploy.** Pros: zero pipeline code. Cons: deploys before or regardless of CI; rejected (PO round 2: only Actions deploys).
3. **CI only, no deploy (original recommendation).** Overridden by the PO.
4. **Audit and security checks all blocking (tester's Q9 A).** Rejected: audit findings are often unfixable noise and would block unrelated work (Q9 B chosen).

## Decision
Option 1, in `.github/workflows/ci.yml` (`on: push`, no `pull_request`; concurrency per ref, cancel in progress except on `main`; `permissions: contents: read`):
- **Jobs:** `fast` (no Docker: install with `--frozen-lockfile`, lint, typecheck, format check, unit tests, build; blocking); `database-and-e2e` (local Supabase reduced to Postgres and Kong, `db:reset`, schema drift check, `test:db`, `test:e2e`, Playwright browser cache; blocking, independent of `fast`); `secret-scan` (Gitleaks binary, version and SHA-256 pinned, full history, `--redact`; blocking); `audit` (`pnpm audit`, `continue-on-error`; informational); `deploy`.
- **Deploy:** `needs: [fast, database-and-e2e, secret-scan]` (never `audit`), runs only on `main`, own concurrency group that is never cancelled, `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`, then a post-deploy `vercel curl` of `/api/health` that must return the known body. `vercel.json` sets `git.deploymentEnabled: false`. Only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` are GitHub secrets, each passed only to the steps that call Vercel; no database variable or service-role key exists in the job. A preflight step skips the deploy (green, with a warning) while any of the three secrets is missing, so the PO can push before the Vercel setup.
- **Supply chain of the pipeline:** third-party actions are pinned by full commit SHA with the release in a comment; Dependabot keeps `github-actions` current (the npm ecosystem is dropped, see ADR 0010). The Vercel CLI runs as `pnpm dlx vercel@<exact version>` instead of a devDependency (a devDependency adds about 235 packages to every install and audit); its transitive dependencies are not lockfile-pinned (accepted trade-off, ADR 0004 amendment FND-T-26).
- **Gates are proven** to fail on bad input once on a throwaway commit (FND-FR-26; FND-T-47, pending the PO's push).

## Consequences
- Positive: failures surface in parallel, deploy cannot bypass tests, the deployed app touches no database, no extra secrets are stored.
- Negative: no branch protection or PR review (PO Q6); anyone with write access can push a branch whose workflow reads the three secrets; the CI Supabase stack omits Auth, Storage and Realtime until an epic needs them (remove services from the exclusion list then).
- Revisit when real users exist or a cloud database is added: GitHub Environment `production` restricted to `main`, branch ruleset, cloud migrations job (never from the deploy job). These are architect suggestions the PO has not decided (see the question below).

## Question for the Product Owner (not blocking)
Before real users: add a GitHub Environment `production` restricted to `main` (and optionally a branch ruleset)? Source: acceptance/step-5-6.md, suggestions. Recommended: yes, when the first real deployment target with data exists.

## References
- `specs/001-foundations/questions.md` (Q5, Q6, Q9, round 2), `spec.md` (D6, D7, D11, FND-FR-23 to FND-FR-26), `acceptance/step-5-6.md`.
- ADR 0004 (secrets, Vercel flow, Amendment FND-T-26), `docs/architecture.md` (CI/CD), `verification/step-5.md`, `step-6.md`.
- Vercel Git configuration: https://vercel.com/docs/project-configuration/git-configuration.
