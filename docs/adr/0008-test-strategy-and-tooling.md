# 0008. Test strategy and tooling

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
Tenant isolation lives in Postgres policies (ADR 0003, 0005), so tests that never reach a real database cannot prove it. The test layout, runners and harness shape every later epic's tests, so they are a one-way door in practice. The PO accepted the recommendations of questions.md Q8 and spec D10 and FND-FR-19 to FND-FR-22.

## Options considered
1. **Vitest (two projects: `unit`, `db`) + Playwright + `@axe-core/playwright`, a real-Postgres harness that calls the production `withRls`.** Pros: fast unit layer without Docker, behavior proven on the real database, one runner for unit and DB. Cons: DB tests need the local Supabase stack.
2. **Jest instead of Vitest.** Pros: familiar. Listed as an alternative in Q8; Vitest chosen (shares the Vite/TypeScript setup, one runner for both Node layers).
3. **pgTAP for RLS.** Pros: tests live in SQL. Cons: a second language and runner. Not chosen (Q8 A, Vitest through the production access path); deferred in the spec, revisit if policies get complex.

## Decision
Option 1:
- **Layers and commands:** `pnpm test` (Vitest project `unit`, `src/**/*.test.ts(x)` colocated, node environment, no Docker); `pnpm test:db` (project `db`, `tests/db/**`, real local Postgres as `app_backend`, `fileParallelism: false`, a global setup that fails fast if the stack is down); `pnpm test:e2e` (Playwright, Chromium only, production build via `next start`, trace on first retry, 2 retries in CI); `pnpm test:coverage` (v8, report only, no threshold).
- **Real-DB harness** (`tests/utils/`): `asUser(claims)` and `asAnon()` call the production `withRls` and `withAnonymousRls` (never a re-implementation); `asAppBackendWithoutRls()` proves skipping `withRls` is denied; throwaway tables are created and dropped by test setup, never in `supabase/migrations/`; table-driven allow/deny matrices; unique data per test; `createTestUser` and `createTenant` are stubs that epic 002 completes.
- **Schema guard** in `test:db`: every `public` table has RLS enabled and at least one policy (read from the catalog, not the TypeScript schema), with an allowlist; proven by a guard-of-the-guard test.
- **Catalog hardening tests** for roles, timeouts, function privileges and the disabled Data API (FND-T-51).
- **Accessibility and layout** are asserted in E2E with axe (WCAG 2.0 to 2.2 A/AA tags) in both color schemes, plus no horizontal scroll at 375 and 1280 px.
- **Tests assert behavior and are proven by mutation** (a deliberate break makes them red; recorded in `tests/README.md`). Testing Library is used only where a component test is needed.
- **Boundary lint rules** are tested on fixtures with `ESLint#lintText` and real fixture files for cycles (ADR 0001 amendment, FND-T-38); they run in the unit layer.

## Consequences
- Positive: the fast layer needs no Docker, isolation is proven where it is enforced, and every later epic writes tests with the same helpers.
- Negative: two simultaneous `test:db` runs on one stack are unsupported; E2E needs a build; no pgTAP, no coverage threshold, no visual regression (all deferred by the PO).
- Revisit pgTAP when policies get complex; revisit a coverage threshold when real modules exist.

## References
- `specs/001-foundations/questions.md` (Q8), `spec.md` (D10, FND-FR-19 to FND-FR-22), `tests/README.md`, `specs/001-foundations/verification/step-3-4.md`, `acceptance/step-3-4.md`.
