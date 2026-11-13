# 002 — Platform hardening: questions and decisions

Consolidated from `reviews/round1/` (architect, developer, ui-ux-designer, tester, product-manager). The Product Owner asked for as few questions as possible, so every item below was resolved with the reviewers' recommendation. The four items C1-C4 are the only ones that need the Product Owner's eye before the spec is approved; the rest are "Decisions taken by default" and can be reverted.

## Needs the Product Owner's confirmation

| # | Decision | Taken | Why it matters |
|---|----------|-------|----------------|
| C1 | Soft delete and audit columns | **Hard delete; only `created_at` and `updated_at` on every table; no `created_by`/`updated_by`.** | Product decision about data recovery and traceability; hard to retrofit across ~50 tables. Soft delete or audit columns can still be added per table later when a module needs them. |
| C2 | Global error page | **Included** (a minimal `global-error.tsx` for failures of the root layout). | Interpretation of PH-HR-01: `requirements.md` names only the 500 and 404 pages. Without it a root layout failure shows the framework default. |

| C3 | Nonce-based CSP renders every page per request | **Accepted** (D10). No static optimization or CDN caching of pages. Fallback: a static CSP in `next.config.ts` (ADR 0014). | Hard to reverse once pages depend on it; raised by the traceability check. |
| C4 | Fault routes and `assertFaultInjection()` ship in the app | **Accepted**, behind `DESIGN_PAGE_ENABLED` (off in production). Fallback in PH-FR-23. | Adds a code path to `src/app/layout.tsx` so error pages can be tested on a production build. |

## Decisions taken by default (revertible)

| # | Topic | Decision | Source |
|---|-------|----------|--------|
| D1 | Local collector | Grafana LGTM (one container, `grafana/otel-lgtm`), UI on host port 3001, ports bound to 127.0.0.1, image tag pinned, `docker/observability/`, `pnpm obs:start` / `obs:stop`. Not part of dev, test or CI. | architect, developer |
| D2 | OpenTelemetry | Manual `@opentelemetry/sdk-node` with OTLP/HTTP exporters in `src/instrumentation.node.ts` (not `@vercel/otel`). SDK starts only if an OTLP endpoint variable is set; batch processors only; `OTEL_*` variables declared and Zod-validated in `env.server.ts`. A first-task spike verifies versions with Node 26 and Turbopack. | architect, developer |
| D3 | Telemetry depth | Framework spans only (no database spans) in the first cut. Metrics pipeline wired, no custom metrics. | developer |
| D4 | Logger | Own logger (~40 lines, no dependency) in `src/lib/logger.ts`: typed primitive fields, key deny-list, 200-char truncation, JSON lines, also emits OTel log records; trace id from the active span; request id read from `x-request-id`/`x-vercel-id`. ESLint `no-console` (logger exempt) enforces use. | architect, developer, tester |
| D5 | Reference code | `ref = error.digest ?? generated ref`. The code contains no personal data and need not be secret. Shown as selectable text; no copy button. Errors thrown in Client Components have no digest and do not reach the server hook: stated as a known limit. | architect, developer, ui-ux-designer |
| D6 | Error pages | 500, global error and 404 share a small `StatusPage` component in `src/components/layout/`, listed on `/design`. 500 offers "Try again" and "Go to home page"; 404 only the home link. Wireframes and Figma skipped (trivial pages). Copy as in `reviews/round1/ui-ux-designer.md`. | ui-ux-designer, PM |
| D7 | Error hook scope | `onRequestError` logs only `routePath`, `routeType`, `method`, error class name, `digest` and the database error code (never the query string, headers or cookies). Route handlers and actions return a generic response; the code reaches the user only through the action wrapper (PH-AC-10 relaxed). | architect, PM |
| D8 | Action wrapper | `defineAction({ name, schema, handler })` returns `Result<T>`; order: parse, handler, `unstable_rethrow` (so `redirect()`/`notFound()` pass through), `AppError`, database error mapping, unexpected with `ref` and a log entry. No auth yet (seam for 003). | architect, developer |
| D9 | Error types | `AppError` (validation, not found, forbidden, conflict, unexpected) and `Result<T>` in `src/lib/errors.ts`; `fromDbError` walks the `cause` chain: `23505`/`23503` conflict, `42501` forbidden, `23502`/`23514` validation, else unexpected; rows hidden by RLS are `not_found`. No shared error renderer (PH-AC-48 removed). | architect, developer |
| D10 | CSP | Nonce-based `script-src` with `strict-dynamic` via `src/proxy.ts`; `style-src 'self' 'unsafe-inline'` (Radix and Sonner inject inline styles); `connect-src` includes the Supabase origin. Consequence accepted: pages render dynamically. Fallback if it proves unworkable: a static CSP in `next.config.ts` (recorded in the ADR). Other headers static in `next.config.ts`: nosniff, referrer policy, permissions policy, `X-Frame-Options: DENY`/`frame-ancestors`, HSTS in production only (no preload), `poweredByHeader: false`, no CORS headers, `serverActions.bodySizeLimit: '1mb'`. | architect, developer |
| D11 | Database conventions | `uuid default gen_random_uuid()` ids (v4; v7 needs Postgres 18), snake_case, plural table names, `<singular>_id` foreign keys, explicit `ON DELETE`, `created_at`/`updated_at timestamptz not null default now()`, trigger `public.set_updated_at()`. Enforced by new rules in `tests/db/schema-guard.test.ts` with a named allowlist. There are no application tables yet, so nothing to migrate. | architect |
| D12 | Pagination | Offset with total count. Pure Zod `listParams` in `src/lib` (default page size 20, max 100, page cap 10,000); `paginate(tx, ...)` exported from `@/db` (always adds `id` as tiebreaker, counts in the same transaction so RLS applies). Filters: equality on allow-listed fields only. Keyset is a future per-list addition. | architect, tester, PM |
| D13 | `gen:module` | `scripts/gen-module.mts <name>` (kebab-case, never overwrites) creates only `modules/<name>/index.ts` with `export {}` and a header comment (C1: no empty folders). No test generation. | architect, developer |
| D14 | Test seams | Fault routes under `/design/errors/*`, gated by `DESIGN_PAGE_ENABLED` (never active in production); E2E runs against `build` + `start` and tees `next start` stdout to a file to assert on logs; OpenTelemetry tested with an in-memory exporter and a small OTLP receiver, never needing the collector. | tester, architect |
| D15 | Rendering | The "renders statically" line in PH-FL-03 is dropped (follows from D10). | architect, PM |
| D16 | ADRs and docs | New ADRs 0012 database conventions, 0013 observability, 0014 security headers and CSP, 0015 error model and action wrapper, 0016 pagination. `docs/architecture.md` updated (C1, C6, C8, C11, layout, ADR table). | architect |
| D17 | Round 2 | No design round (no Figma, trivial screens). The second review is replaced by the traceability check on the spec and tasks, with a final architect and tester read of the spec. | orchestrator |

## Open risks to verify in the first tasks (spikes)

`sdk-node` under Turbopack and Node 26; Drizzle error `cause` shape against the real database; a `"use server"` file exporting `defineAction(...)` results; whether `global-error` receives the nonce; `onRequestError` not firing for `redirect()`/`notFound()`; the proxy running on Node.
