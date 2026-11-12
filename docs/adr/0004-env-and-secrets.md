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

- `src/lib/env.ts` is the only module reading `process.env`. Zod schemas: server schema and public schema. Server variables are imported only from server code (`server-only`); the public object is the only one that may reach client bundles.
- `NEXT_PUBLIC_` is allowed only for values safe to expose: Supabase URL and anon/publishable key, public app URL. Never for service-role key, database URLs or passwords. A lint or test check asserts no `NEXT_PUBLIC_` name matches `SERVICE|SECRET|PASSWORD|DATABASE`.
- Server variables: `DATABASE_URL` (role `app_backend`, ADR 0003) and, for tooling only, `DATABASE_MIGRATION_URL`. In production they are optional until a cloud DB exists; the module providing DB access fails fast at runtime when they are needed and missing. In development and test they are required. Tighten when the cloud DB arrives (document in `.env.example` and README).
- `SUPABASE_SERVICE_ROLE_KEY` is not defined in 001 (no consumer). If added later, it is server-only, read in one file.
- `.env.example` is committed with placeholders and the known local Supabase defaults clearly labelled "local only, not secrets". `.env*` files other than the example are git-ignored.
- Secret inventory. GitHub Actions secrets: only `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (PO creates the Vercel project, token and secrets outside tasks). Vercel project env: `NEXT_PUBLIC_*` values, and `DATABASE_URL` once a cloud DB exists. `DATABASE_MIGRATION_URL` and service-role keys are never on Vercel or in the deploy job.
- Deployment: GitHub Actions deploys via `vercel pull`, `vercel build`, `vercel deploy --prebuilt --prod`; the deploy job `needs:` all blocking CI jobs and runs only on the single branch. Vercel's Git auto-deploy is disabled (`git.deploymentEnabled: false` in `vercel.json`) so there is exactly one deploy path. This is a two-way door; details live in `docs/architecture.md`.
- Secret scanning runs on pushed commits (gitleaks binary run directly, full history fetch). With no hooks, a detected secret is already in history: it must be rotated, not just removed. The README states this.
- Supabase Auth client factories (browser, server, middleware via `@supabase/ssr`) live only in `src/lib/supabase/`; they are Auth-only (ADR 0003). Auth-aware logic arrives in epic 002.
- Logging never includes secrets, tokens, passwords or PII.

## Consequences
- Positive: single validated entry point; clear public/secret split; deploy works without a database.
- Negative: optional-in-production DB variables weaken fail-fast until the cloud DB exists; mitigated by runtime failure in the DB module and a tracked tightening step.
- Revisit when a cloud DB, preview environments or additional secrets (Stripe, email) are introduced.

## References
- Supabase connecting to Postgres (pooled URL for serverless): https://supabase.com/docs/guides/database/connecting-to-postgres (checked 2026-11-12)
- specs/001-foundations/questions.md (round 2 confirmations), reviews/developer.md and architect.md (round 2). Vercel CLI deploy flow and `git.deploymentEnabled` were taken from the reviews and not re-verified against Vercel docs; the developer must confirm when implementing.
