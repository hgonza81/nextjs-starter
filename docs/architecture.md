# Architecture

Short overview; decisions and reasons are in the ADRs ([index](adr/README.md)).

## Stack
Next.js (App Router, strict TypeScript), Supabase Auth, PostgreSQL with RLS, Drizzle ORM (`postgres` driver), Supabase CLI + Docker for local development and CI, Vercel deployment from GitHub Actions.

## Layout
```
src/
  app/              routing only; calls module public APIs
  modules/<name>/   index.ts (public API), actions/, queries/, schemas/, components/, types.ts
  db/               client.ts (private), rls.ts (withRls), schema/ (generated), index.ts
  lib/              env.ts, supabase/ (Auth clients only), utils; domain-free
supabase/           config.toml, migrations/ (SQL, source of truth), seed.sql
```
Modules `auth`, `users`, `tenants` arrive in epic 002.

## Dependency direction
`app` -> module `index.ts` -> `@/db`, `@/lib`. `lib` imports neither `modules` nor `db`; `db` imports nothing from `modules`; `app` and components never import `@/db`; no cycles. Enforced by lint in CI (ADR 0001).

## Data and security rules
- All table access goes through `withRls(ctx, fn)`; the raw DB client is private to `src/db`. The app connects as `app_backend`, which fails closed (ADR 0003).
- `supabase-js` is for Auth only; no `.from()`/`.rpc()`. Data API disabled.
- Migrations are SQL-first in `supabase/migrations`; Drizzle schema is generated with `drizzle-kit pull` and drift-checked in CI (ADR 0002).
- Tenant isolation: shared schema + `tenant_id` + RLS (ADR 0005).
- Environment access only through `src/lib/env.ts` (ADR 0004).

## Conventions
kebab-case files; named exports; `@/` alias; Server Components by default; mutations via Server Actions returning `{ ok: true, data } | { ok: false, error }`; Zod validation at every boundary; structured server error logging without PII or secrets; Conventional Commits (documented, not enforced).

## Deployment
GitHub Actions runs fast checks and DB/E2E checks on every push; the deploy job (`vercel pull/build/deploy --prebuilt --prod`) `needs` all blocking jobs. Vercel Git auto-deploy is disabled. The deployed app has no database until a cloud project exists; `/api/health` is liveness only, DB checks run locally and in CI (ADR 0004).
