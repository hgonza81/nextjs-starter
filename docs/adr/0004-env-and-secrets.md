# 0004. Environment variables and secrets

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
Environment access must be typed and validated from day one, public and server-only values must never mix, and secrets handling must fit the PO's setup: no cloud Supabase project in epic 001, deploy to Vercel from GitHub Actions only, solo workflow without PRs or hooks (questions.md Q5, Q6, round 2 confirmations). The deployed hello-world app has no database, so validation must not break the Vercel build.

## Options considered
1. **Single typed Zod module `src/lib/env.ts`** with separate server and public schemas. Pros: one place, fail fast. Cons: small amount of code.
2. **Library (`@t3-oss/env-nextjs`).** Pros: ready-made client/server split. Cons: new dependency for what Zod already does.
3. **Direct `process.env` access.** Simplest; untyped, scattered, no validation. Rejected.

DB variables in production: (a) required everywhere (breaks the deploy, no cloud DB), (b) placeholder values on Vercel (misleading), (c) required in development/test, optional in production until a cloud DB exists (chosen).

## Decision
Option 1, with (c).

- Two modules read `process.env`, split by exposure (amended in FND-T-18, see Amendment): `src/lib/env.ts` (public schema, exports `publicEnv`, safe for client code) and `src/lib/env.server.ts` (starts with `import "server-only"`, server schema, exports `serverEnv` and `requireDatabaseUrl()`). Only `publicEnv` may reach client bundles; importing `env.server.ts` from client code is a build error.
- `NEXT_PUBLIC_` is allowed only for values safe to expose: Supabase URL and anon/publishable key, public app URL. Never for service-role key, database URLs or passwords. A lint or test check asserts no `NEXT_PUBLIC_` name matches `SERVICE|SECRET|PASSWORD|DATABASE`.
- Server variables: `DATABASE_URL` (role `app_backend`, ADR 0003) and, for tooling only, `DATABASE_MIGRATION_URL`. In production they are optional until a cloud DB exists; the module providing DB access fails fast at runtime when they are needed and missing. In development and test they are required. Tighten when the cloud DB arrives (document in `.env.example` and README).
- `SUPABASE_SERVICE_ROLE_KEY` is not defined in 001 (no consumer). If added later, it is server-only, read in one file.
- `.env.example` is committed with placeholders and the known local Supabase defaults clearly labelled "local only, not secrets". `.env*` files other than the example are git-ignored.
- Secret inventory. GitHub Actions secrets: only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (PO creates the Vercel project, token and secrets outside tasks). Vercel project env: `NEXT_PUBLIC_*` values, and `DATABASE_URL` once a cloud DB exists. `DATABASE_MIGRATION_URL` and service-role keys are never on Vercel or in the deploy job.
- Deployment: GitHub Actions is the only deploy path (`vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`); the deploy job `needs:` all blocking CI jobs and runs only on `main`. Vercel's Git auto-deploy is disabled (`git.deploymentEnabled: false` in `vercel.json`). Two-way door; verified facts in the Amendment (FND-T-26) below and job details in `docs/architecture.md`.
- Secret scanning runs on pushed commits (Gitleaks binary pinned by version and SHA-256, full history fetch). With no hooks, a detected secret is already in history: it must be rotated, not just removed. The README states this.
- Supabase Auth client factories (browser, server, middleware via `@supabase/ssr`) do not exist in epic 001 (no consumer); epic 002 creates them in one place (`src/lib/supabase/` was the intent) and they are Auth-only (ADR 0003).
- Logging never includes secrets, tokens, passwords or PII.

## Amendment (FND-T-18, 2026-11-12): implemented shape
- **Split.** One file with both schemas (original text) was replaced by `env.ts` + `env.server.ts` so the server-only guarantee is enforced by `server-only`, not by discipline. `env.server.ts` reuses `formatEnvError` from `env.ts`; messages name the variable and never print values.
- **Startup validation.** `src/instrumentation.ts` `register()` reads `process.env.NEXT_RUNTIME` and, when it is `nodejs`, imports both env modules, so a bad environment fails at `next dev`/`next start` with a message naming the variable. `NEXT_RUNTIME` is the one extra `process.env` read outside the env modules (the edge runtime must not load `server-only`).
- **Build and runtime.** `next.config.ts` imports `./src/lib/env` (relative path; only the public module, because `server-only` throws outside the Next.js server). So `next build` fails on a missing or invalid `NEXT_PUBLIC_*` variable (they are inlined at build), and, as a side effect, `next start` and `next dev` also need the three `NEXT_PUBLIC_*` variables at runtime. CI and Vercel must set them for both build and runtime.
- **Database variables.** `NODE_ENV` plus `DATABASE_URL` and `DATABASE_MIGRATION_URL` are validated; the two URLs are required unless `NODE_ENV` is `production`, and an empty string counts as unset. The lazy `getDb()` calls `requireDatabaseUrl()`, so a missing `DATABASE_URL` fails on first use (ADR 0003). Tooling (`drizzle.config.ts`, `scripts/db-schema.mts`, Playwright and Vitest config, `tests/utils/local-env.mts`) reads `process.env` outside the app and is not subject to this rule.
- **Test.** A unit test asserts no `NEXT_PUBLIC_` name matches `SERVICE|SECRET|PASSWORD|DATABASE`. The assertion that no server-only variable appears in the client bundle needs a build artifact and belongs to FND-T-37.
- **Lint (T-37)** must allow `env.server.ts` (server code only) and the `NEXT_RUNTIME` read in `src/instrumentation.ts`.

## Amendment (FND-T-26, 2026-11-12): CI/CD facts verified
- **Vercel flow (verified in T-24/T-25 against the CLI 65.15.0 and Vercel docs; the pin is now 65.14.0, FND-T-64).** `vercel.json` has `git.deploymentEnabled: false` (Vercel docs, Git Configuration). The deploy job runs `vercel pull --yes --environment=production`, `vercel build --prod` and `vercel deploy --prebuilt --prod --env NAME=value` (`-e` is deprecated, T-54). The project's runtime env is supplied with `--env` (the three non-secret `NEXT_PUBLIC_*` placeholders) so no dashboard setup is needed; build-time values come from the workflow env and the pulled project settings.
- **Post-deploy check.** `vercel curl <url>/api/health` (not plain `curl`): Vercel Deployment Protection answers 401 on the unique deployment URL and `vercel curl` adds the automation bypass with the same token. Up to 5 attempts, body must equal `{"status":"ok"}`.
- **Secrets.** Only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, referenced only by the deploy job's Vercel steps, never echoed, no `DATABASE_*` or service-role key in that job. The deploy job has a skip-safe preflight: while any of the three is missing it ends green with a warning and a summary line, and all later steps are skipped (a green run does not mean "deployed" until the secrets exist).
- **Fork and Dependabot exposure.** No `pull_request` trigger, so fork PRs start no run; a fork's own `push` runs in the fork with the fork's (empty) secrets; GitHub gives Dependabot-triggered runs only Dependabot secrets and a read-only token. Branch and tag pushes run the checks but never deploy (`github.ref == 'refs/heads/main'`). Residual: anyone with write access can push a branch whose workflow reads the repository secrets. Mitigation if it matters: put the three secrets in a GitHub Environment restricted to `main` (suggestion, not built).
- **Accepted trade-offs (MVP).** The CLI is run with `pnpm dlx vercel@65.14.0` instead of a devDependency, so its transitive dependencies are not lockfile-pinned and Dependabot does not bump it (revisit before real users or a cloud DB). The health check runs after `--prod` has already promoted the deployment, so a bad build serves traffic and the failed check does not roll back; option for later: `deploy --skip-domain`, check, `vercel promote`.
- **Epic 002 consequences.** `vercel pull` writes the project's readable production variables to the runner and `vercel build` loads them, so build-time code can see them (Secret-type values are write-only in the dashboard and may not be pulled: verify with the first real `DATABASE_URL`; the app only needs it at runtime, which Vercel injects). Keep build-time code free of DB access and keep `DATABASE_MIGRATION_URL` off Vercel. `DATABASE_URL` must be the Supabase pooler URL (ADR 0003 already disables prepared statements). `NEXT_PUBLIC_APP_URL` is a `localhost` placeholder in production and must be set to the real URL before any feature reads it.

## Consequences
- Positive: single validated entry point; clear public/secret split; deploy works without a database.
- Negative: optional-in-production DB variables weaken fail-fast until the cloud DB exists; mitigated by runtime failure in the DB module and a tracked tightening step.
- Revisit when a cloud DB, preview environments or additional secrets (Stripe, email) are introduced.

## References
- Supabase connecting to Postgres (pooled URL for serverless): https://supabase.com/docs/guides/database/connecting-to-postgres (checked 2026-11-12)
- specs/001-foundations/questions.md (round 2 confirmations), reviews/developer.md and architect.md (round 2).
- Vercel Git configuration (`git.deploymentEnabled`): https://vercel.com/docs/project-configuration/git-configuration (checked 2026-11-12); CLI flags checked with `vercel@65.15.0 --help`; reports `specs/001-foundations/verification/step-5.md` and `step-6.md`.
- GitHub, troubleshooting Dependabot on Actions (Dependabot-triggered runs get only Dependabot secrets and a read-only token): https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions (checked 2026-11-12).

## Amendment (FND-T-36, 2026-11-13): facts added after steps 1 to 7
- **`DESIGN_PAGE_ENABLED`** (FND-T-32) is a third server-only variable in `src/lib/env.server.ts` (Zod; accepts `true`, `false`, `1`, `0`; blank counts as unset; anything else fails at startup naming it). Unset means on only when `NODE_ENV=development`, off otherwise, so the deployed app returns 404 for every `/design*` route without anyone setting anything. It is never `NEXT_PUBLIC_` (that would inline it at build). The E2E server sets it to `true` in `playwright.config.ts`; a second E2E project strips it to prove the 404. The CI workflow and the deploy job do not mention it.
- **Env split, summarized.** `env.ts` (public), `env.server.ts` (server-only), `src/instrumentation.ts` (startup validation, the only `NEXT_RUNTIME` read), `next.config.ts` imports the public env so builds fail on a missing `NEXT_PUBLIC_*` variable. Details above and in `docs/architecture.md`, section "Environment".
- **Vercel account prerequisite (first real deploy, 2026-11-12).** The Vercel account must have the GitHub account that owns the commits connected. Otherwise Vercel blocks the deployment ("commit email could not be matched to a GitHub account"), `vercel deploy` waits, and the job ends only at its 15-minute timeout. Fix was a one-time connection in the Vercel account settings, no code change. Possible hardening, not built: `vercel deploy --no-wait` plus a bounded poll.
- **`browserslist` rule.** `package.json` keeps `chrome >= 123`, `edge >= 123`, `firefox >= 120`, `safari >= 17.5`; lowering it or replacing it with Next's default makes lightningcss polyfill `light-dark()` and breaks the `/design` theme panels (design-system 0.2, `docs/architecture.md`). A build-tool setting, recorded here because it is part of the Vercel build and not visible in code review.
