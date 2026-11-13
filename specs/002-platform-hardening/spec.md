# 002 - Platform hardening: specification

**Status:** Approved (Product Owner, 2026-11-13: C1-C4 confirmed)
**Epic:** 002-platform-hardening. Depends on 001-foundations. Next epic: 003-auth-memberships.
**Inputs:** `requirements.md`, `flows.md`, `reviews/round1/*`, `questions.md` (decisions C1, C2, D1-D17), `traceability.md`.
**Requirement IDs:** high-level `PH-HR-xx` (in `requirements.md`), spec level `PH-FR-xx` / `PH-NFR-xx`. Acceptance criteria keep the `PH-AC-xx` IDs from `flows.md` (PH-AC-48 dropped, never reused; PH-AC-58 onward are new). Flow IDs `PH-FL-xx` and business rules `BR-xx` are in `flows.md`.

## Decisions needing Product Owner confirmation

The Product Owner delegated every decision. Only these four are product-level or hard to reverse and are confirmed here before approval; everything else is in section 5 and can be reverted.

| # | Decision | Taken | Why it matters |
|---|----------|-------|----------------|
| C1 | Soft delete and audit columns | **Hard delete. Only `created_at` and `updated_at` on every table. No `created_by`/`updated_by`, no `deleted_at`.** | Data recovery and traceability are product decisions and are hard to retrofit across about 50 tables. A table that later needs them can still add them (additive). |
| C2 | Global error page | **Included**: a minimal `global-error` page for failures of the root layout (PH-FR-02). | Interpretation of PH-HR-01, which names only the 500 and 404 pages. Without it a root layout failure shows the framework default. |
| C3 | Per-request rendering | **The nonce-based CSP makes every page render per request: no static optimization and no CDN caching of pages.** Fallback if not accepted: a static CSP in `next.config.ts` (weaker, no nonce), per ADR 0014. | Product-visible and hard to reverse once pages depend on request-time rendering; affects hosting cost and latency. |
| C4 | Fault routes in the production artifact | **The fault routes and `assertFaultInjection()` ship behind `DESIGN_PAGE_ENABLED`** (off by default, gate tested by PH-AC-76). Fallback: as recorded in PH-FR-23. | Adds a test-only code path to `src/app/layout.tsx` in the production build. |

## 1. Goal

Finish the technical foundations every module needs, so that from epic 003 on the work is only about the module itself: friendly error pages and server-side error capture, typed errors and one server action wrapper, structured logging, OpenTelemetry with an optional local collector, security headers, database conventions, a pagination helper and a module generator. Nothing here needs a cloud service. No auth, users, tenants, application tables or business features are added.

## 2. Context and users

- Users: the end user (sees the error and 404 pages, the only UI) and the developer (uses everything else from epic 003 on). The "operator" is the developer configuring environment variables.
- Why now: these are cross-cutting and hard to retrofit once modules exist (conventions, error shape, headers, rendering mode).

## 3. Scope

### In scope

- 500, global error and 404 pages with a shared `StatusPage` component; server-side capture through `onRequestError`.
- Typed application errors, typed action result, database error mapping, the server action wrapper.
- One structured, PII-free logger replacing ad hoc `console.error`, enforced by lint.
- OpenTelemetry (traces, logs, metrics pipeline) configured only by environment variables; optional local Grafana LGTM collector in Docker.
- Security headers (nonce-based CSP through `src/proxy.ts`, plus static headers) and config hardening.
- Database conventions (ids, naming, timestamps, reusable trigger, hard delete) enforced by tests.
- Offset pagination helper (parameters, sort, equality filters).
- `pnpm gen:module <name>`.
- Tests, ADRs 0012-0016 and `docs/architecture.md` / `docs/design-system.md` updates.

### Out of scope / Future (parking lot)

| Item | Reason |
|------|--------|
| Cloud Supabase project, pooler, migrations from CD, preview/staging environments | No production yet; PO decision in 001 |
| Production destination for traces and logs (Grafana Cloud, Sentry, Datadog) | No production yet; adding one is `OTEL_*` variables only |
| Email, background jobs, file storage, feature flags | Added by the first module that needs them |
| Rate limiting | Decided in 003, where login uses it (seam: `proxy.ts` or the wrapper) |
| CodeQL and license scanning, date/currency utilities, basic SEO metadata | Not requested; parked |
| Auth, users, tenants, memberships; authed action wrapper; `tenant_id` guard rule | Epic 003 (seams documented in ADRs) |
| Table and Dialog components, shared error renderer component, "Copy" button on the reference code | Added by the first epic that needs them |
| Flush of the last telemetry batch on SIGTERM (`sdk.shutdown()`); validation of per-signal `OTEL_*` variables and `OTEL_SDK_DISABLED` | Known first-cut limits found in the step 2 review; a module or the first production deployment can add them |
| Database spans, custom metrics, runtime metrics | Framework spans only in the first cut (D3) |
| Keyset pagination, filter operators beyond equality, text search | Per list, when a module needs them |
| Soft delete, audit columns, security-event audit | Product decisions deferred (C1) |
| Placeholder test files generated by `gen:module` | Tests arrive with the first real code (D13) |
| Response body with a code from route handlers and unwrapped actions | Beyond PH-HR-02; the code reaches the user only through the wrapper (D7) |
| ZAP/Lighthouse scans, cross-browser E2E for the CSP | Roadmap once there is a public deployment |
| Wireframes, Figma, design round | Three trivial pages; skipped per `specs/README.md` (D6, D17) |

## 4. Concepts / glossary

| Term | Definition |
|------|------------|
| AppError / `Result<T>` | The five application error types (`validation`, `not_found`, `forbidden`, `conflict`, `unexpected`) and the plain, serializable action result `{ ok: true, data } \| { ok: false, error }`. |
| Reference code (`ref`) | Short code shown to the user and written to the log for the same failure. On pages and in the hook it is the framework `error.digest`; the wrapper generates its own for `unexpected`. Contains no personal data; need not be secret. |
| Action wrapper | `defineAction({ name, schema, handler })`: parse input, run handler, map errors, log. |
| Hook | The Next.js `onRequestError` function in `src/instrumentation.ts`; observe-only. |
| Collector | Optional local Grafana LGTM container to inspect traces and logs in development. |
| Fault routes | Test-only pages and routes under `/design/errors/*` that fail on demand; gated by `DESIGN_PAGE_ENABLED`, never active in production. |
| Convention guard | Rules added to `tests/db/schema-guard.test.ts` that fail on any `public` table breaking a database convention, with a named exception allowlist. |

## 5. Decisions taken

Decisions D1-D17 in `questions.md` were taken by default on the Product Owner's delegation and are revertible; C1 to C4 are above. ADRs 0012-0016 are written by the architect in parallel and are the record for hard-to-reverse choices.

| # | Decision | Record |
|---|----------|--------|
| D1 | Local collector: Grafana LGTM, one container, UI on host port 3001, ports bound to 127.0.0.1, pinned tag, `pnpm obs:start` / `obs:stop`; not part of dev, test or CI | ADR 0013 |
| D2 | OpenTelemetry: manual `sdk-node` with OTLP/HTTP in `src/instrumentation.node.ts`, started only when an endpoint is set, batch processors only, `OTEL_*` validated in `env.server.ts` | ADR 0013 |
| D3 | Framework spans only; metrics pipeline wired, no custom metrics | ADR 0013 |
| D4 | Own logger (`src/lib/logger.ts`), typed primitive fields, key deny-list, 200-char truncation, JSON lines, trace id from the active span, request id read from `x-request-id`/`x-vercel-id` (never generated); ESLint `no-console` | ADR 0013 |
| D5 | `ref = error.digest ?? generated`; errors in Client Components have no digest and do not reach the hook (known limit) | ADR 0015 |
| D6 | `StatusPage` shared by the three pages, listed on `/design`; 500 offers "Try again" and "Go to home page", 404 only the home link; copy per `reviews/round1/ui-ux-designer.md` | `docs/design-system.md` |
| D7 | Hook logs only `routePath`, `routeType`, `method`, error class, `digest`, database error code | ADR 0015 |
| D8 | Wrapper order: parse, handler, `unstable_rethrow`, `AppError`, DB mapping, unexpected with `ref` and log | ADR 0015 |
| D9 | `fromDbError` walks the `cause` chain: `23505`/`23503` conflict, `42501` forbidden, `23502`/`23514` validation, else unexpected; rows hidden by RLS are `not_found`; no shared error renderer | ADR 0015 |
| D10 | CSP: nonce `script-src` with `strict-dynamic` via `src/proxy.ts`; `style-src 'self' 'unsafe-inline'`; `connect-src` includes the Supabase origin; other headers static in `next.config.ts`; HSTS production only, no preload; `poweredByHeader: false`; no CORS headers; Server Action body limit 1 MB. Consequence accepted: pages render per request. Fallback: static CSP in `next.config.ts` | ADR 0014 |
| D11 | Database: `uuid` ids via `gen_random_uuid()`, snake_case plural tables, `<singular>_id` FKs, explicit `ON DELETE`, `timestamptz` timestamps, `public.set_updated_at()` trigger, rules in the schema guard with allowlist. No application tables exist, so nothing to migrate | ADR 0012 |
| D12 | Pagination: offset with total; `listParams` (pure, `src/lib`) and `paginate(tx, ...)` (`@/db`); default size 20, max 100, page cap 10,000; `id` tiebreaker; equality filters on allow-listed fields | ADR 0016 |
| D13 | `gen:module`: creates only `modules/<name>/index.ts` (`export {}` plus header comment); kebab-case; never overwrites; no tests generated | `docs/architecture.md` (no ADR) |
| D14 | Test seams: fault routes, E2E on `build` + `start` with stdout tee'd to a file, in-memory exporter and small OTLP receiver (never the collector) | Test README |
| D15 | "Renders statically" dropped from the screen description (follows from D10) | This spec |
| D16 | ADRs 0012 database conventions, 0013 observability, 0014 security headers and CSP, 0015 error model and action wrapper, 0016 pagination; `docs/architecture.md` updated | `docs/adr/` |
| D17 | No design round; second review replaced by the traceability check on spec and tasks plus a final architect and tester read | This spec |

## 6. Business rules

BR-01 to BR-16 in `flows.md` apply, with these corrections: BR-02 reads "the reference code matches `^[A-Za-z0-9_-]+$`, contains no user data, and equals the code in the server log entry for that failure"; BR-03 reads "404 pages return HTTP 404; the error pages return HTTP 500 when the failure happens before the response starts streaming (not asserted for streamed failures)"; BR-04 is the logger rule (typed fields, deny-list backstop, errors reduced to name/code/digest); the hook never logs `request.path`, headers, query string or error messages.

## 7. Functional requirements

### Error pages and capture

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-01 | **500 page.** A failure while rendering a page or nested layout shows `error.tsx` (built on `StatusPage`): title, short description, selectable reference code (omitted entirely when no digest), "Try again" (retry) and "Go to home page". No internals ever shown. | PH-AC-01, 02, 06, 07, 62 | 01 |
| PH-FR-02 | **Global error page** (C2). A failure of the root layout shows `global-error.tsx`: own `html`/`body`, same copy and look, built on `StatusPage`, home action is a plain `<a href="/">`. | PH-AC-03, 61 | 01 |
| PH-FR-03 | **404 page.** Unknown URLs, `notFound()` and gated routes (`/design*` when `DESIGN_PAGE_ENABLED` is off) show the same `not-found` page: message and home link, no reference code, HTTP 404. | PH-AC-04, 05, 62 | 01 |
| PH-FR-04 | **`StatusPage` component** in `src/components/layout/`, presentational, no `next/link`, hooks or providers; listed on `/design`; `docs/design-system.md` 7.4 updated. | PH-AC-07, 77 | 01 |
| PH-FR-05 | **Server-side capture.** The `onRequestError` hook logs one entry per unhandled error in pages, route handlers and unwrapped actions, containing only event, route path pattern, route type, method, error class, digest and database error code. It does not fire for `redirect()`/`notFound()`. Route handlers and unwrapped actions return the framework's generic response with no internals. | PH-AC-08, 09, 10, 11, 58, 60, 64, 72 | 02 |

### Errors and wrapper

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-06 | **Typed errors.** `src/lib/errors.ts` defines `AppError` with exactly five types and the plain `Result<T>` / `ActionError` shape (`type`, safe `message`, optional `fieldErrors`, `ref` only for `unexpected`). Importable by the UI. | PH-AC-12 | 03 |
| PH-FR-07 | **Database error mapping.** `fromDbError` reads the SQLSTATE through the `cause` chain: unique and foreign key violations to `conflict`, permission/RLS violation to `forbidden`, not-null/check to `validation`, anything else to `unexpected` with no database message; "no row where one is required" and rows hidden by RLS to `not_found`. | PH-AC-13, 14, 15, 63 | 03 |
| PH-FR-08 | **Action wrapper** `defineAction({ name, schema, handler })` returns `Result<T>` in the order parse, handler, `unstable_rethrow`, `AppError`, DB mapping, unexpected. The handler never runs on invalid input; `redirect()`/`notFound()` pass through and are not logged as errors; an `unexpected` result carries a generated `ref` and one log entry; wrapped failures are logged by the wrapper only, not by the hook. No auth inside. | PH-AC-44, 45, 46, 47, 59, 64, 71 | 10 |

### Logging and telemetry

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-09 | **Structured logger.** One helper (`logger.debug/info/warn/error`, `logger.exception`) writes one JSON line with level, timestamp, event, fields, and trace/span id (from the active span) and request id (read from an incoming header) when present. Fields are typed primitives; denied keys are redacted; strings truncated at 200 characters; errors reduced to name, code, digest. Works outside a request. A logger failure never affects the request. | PH-AC-16, 17, 18, 70, 72 | 04 |
| PH-FR-10 | **No ad hoc console.** ESLint `no-console` is an error in `src/**` with the logger file as the only exemption; `src/app/api/health/db/route.ts` uses the logger. | PH-AC-19 | 04 |
| PH-FR-11 | **Telemetry off by default.** With `OTEL_EXPORTER_OTLP_ENDPOINT` unset, the SDK is not started, nothing is exported, the app runs normally and logs to the console. | PH-AC-20 | 05 |
| PH-FR-12 | **Telemetry export.** With an endpoint set, traces and logs are exported over OTLP/HTTP and the metrics pipeline is wired (no custom metrics). Batch processors only; an unreachable destination never breaks or blocks requests. | PH-AC-21, 22, 65 | 05 |
| PH-FR-13 | **Telemetry configuration.** `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL), `OTEL_EXPORTER_OTLP_PROTOCOL` (optional, `http/protobuf` or `http/json`), `OTEL_SERVICE_NAME` (optional, default `nextjs-starter`) are declared and validated in `env.server.ts`; an invalid value fails startup naming the variable (on Next.js 16 "fails startup" means: the error names the variable, the value is not printed, and every request returns 500; the process does not exit, same as the epic 001 variables). `OTEL_EXPORTER_OTLP_HEADERS` is consumed only by the SDK and never logged. | PH-AC-23 | 05 |
| PH-FR-14 | **Local collector.** `docker/observability/compose.yaml` (Grafana LGTM, pinned image tag, UI on 3001, ports on 127.0.0.1, no volume) with `pnpm obs:start` / `obs:stop` and documented variables. Not required by `pnpm dev`, tests, CI or build. | PH-AC-24, 25, 26 | 06 |

### Security headers

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-15 | **CSP.** `src/proxy.ts` sets a per-request nonce CSP on pages: `script-src` with nonce and `strict-dynamic` (no `unsafe-inline`/`unsafe-eval` in production), `style-src 'self' 'unsafe-inline'`, `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src` including the Supabase origin. The policy is built by a pure, unit-tested function. The app, error pages, Tailwind, shadcn and Next scripts work under it. | PH-AC-27, 31, 32, 61, 66, 74 | 07 |
| PH-FR-16 | **Other headers and hardening.** In `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), `X-Frame-Options: DENY`, HSTS (production only, no preload), `poweredByHeader: false`, `serverActions.bodySizeLimit: '1mb'`. No CORS headers are ever set; Server Actions from a foreign origin are rejected. | PH-AC-27, 28, 29, 30, 67, 73 | 07 |

### Database conventions

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-17 | **Conventions documented** (ADR 0012): ids, naming, timestamps, trigger, hard delete, no audit columns (C1), `ON DELETE` stated per FK. | PH-AC-33 | 08 |
| PH-FR-18 | **Reusable trigger.** A migration creates `public.set_updated_at()` (`SECURITY INVOKER`, fixed `search_path`); each table adds a `BEFORE UPDATE` trigger. `updated_at` changes on update, `created_at` does not, a client-supplied `updated_at` is overwritten. | PH-AC-34, 69 | 08 |
| PH-FR-19 | **Convention guard.** For every `public` table the schema guard checks: `id uuid` primary key; `created_at` and `updated_at` `timestamptz not null default now()`; the trigger; snake_case identifiers; every FK column leading an index. Exceptions only through a named allowlist with a reason; failures name table and rule. `supabase db reset` and the drift check still pass. | PH-AC-35, 36, 68 | 08 |

### Pagination and module template

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-20 | **List parameters.** `listParams({ sortable, filters, defaultSort, defaultPageSize: 20, maxPageSize: 100 })` returns a Zod schema parsing search params into page, page size, sort and equality filters. Page and page size are plain base-10 integers (no `1e3`, no `1.5`); page is from 1 to 10,000; unknown keys, sort fields and filter fields are rejected as `validation` before any query. | PH-AC-39, 40, 75 | 09 |
| PH-FR-21 | **Paginate.** `paginate(tx, { table, columns, params, where? })` exported from `@/db` returns `{ rows, total, page, pageSize, pageCount }`; always orders by the requested sort then `id`; counts in the same transaction so RLS applies; parameterized predicates only; a page past the end or no match returns empty rows, not an error. | PH-AC-37, 38, 41, 42, 43 | 09 |
| PH-FR-22 | **Module generator.** `pnpm gen:module <name>` (`scripts/gen-module.mts`) creates only `src/modules/<name>/index.ts`. Name matches `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`; invalid or existing names stop with a message and change nothing. Boundary lint rules apply to the result. A step in the `fast` CI job runs `pnpm gen:module ci-smoke && pnpm lint && pnpm typecheck` and then removes the folder. | PH-AC-49, 50, 51, 52, 53 | 11 |

### Cross-cutting

| ID | Requirement | Acceptance criteria | HR |
|----|-------------|---------------------|----|
| PH-FR-23 | **Test seams.** Fault pages and routes (throwing page, throwing root-layout case, throwing route handler, throwing wrapped and unwrapped actions, retry toggle, oversized-body action) live under `/design/errors/*`, return 404 when `DESIGN_PAGE_ENABLED` is off, never touch the database. The root-layout failure is injected by `src/app/layout.tsx` calling `assertFaultInjection()` (in `src/lib/fault-injection.ts`), which throws only when `DESIGN_PAGE_ENABLED` is on and the request has the header `x-fault: root-layout`; the E2E test sets that header for one navigation. With the flag off it is a no-op (covered by the PH-AC-76 unit test). Fallback if rejected: PH-AC-03 is component-level only and PH-AC-61 covers the global error page at `/design/errors/global-preview` (loss recorded in ADR 0015). | PH-AC-76 | 12 |
| PH-FR-24 | **Docs and ADRs.** ADRs 0012-0016 exist and are listed in `docs/adr/README.md`; `docs/architecture.md` (C1, C6, C8, C11, new C13 to C15, layout, ADR table) and `docs/design-system.md` are updated; README documents the collector commands and the new scripts. | PH-AC-33, 56 | 12 |

## 8. Acceptance criteria

Unless stated, "Given/When/Then" as in `flows.md` section 6 (kept verbatim for the IDs listed in section 7) with these changes. Fixtures live in tests only; fault routes follow PH-FR-23. Criteria about the reference code, headers, CSP and error pages run on a production build (`build` + `start`).

**Changed from `flows.md`**
- PH-AC-08: production build only; the fixture error message includes a per-test token taken from a query parameter, so the digest is unique per test and per attempt; exactly one log entry carries the code, asserted via the tee'd server log, polled with `expect.poll`. The token itself must be absent from the HTML, the RSC payload and the log entry (the hook never logs messages).
- PH-AC-09 (replaced): Given an **unwrapped** action that throws, When called, Then the hook writes exactly one entry (class, digest) and the caller gets Next's generic error with no internals.
- PH-AC-10 (relaxed): Given a route handler that throws, When called, Then the response has no internals (no message, stack, path) and exactly one log entry exists. No code in the body is required.
- PH-AC-22 (measurable): Given the destination is a closed port, When 20 sequential requests are made, Then all return 200, each in under 2 seconds, and the server process is still alive. One warm-up request is made and excluded from the 20.
- PH-AC-23: names `OTEL_EXPORTER_OTLP_ENDPOINT` (not a URL), `OTEL_EXPORTER_OTLP_PROTOCOL` (not `http/protobuf` or `http/json`), `OTEL_SERVICE_NAME` (empty); one process test spawns `next start` with a bad value and expects the variable named in the output, the value not printed, and HTTP 500 on `/api/health`. `env.server.ts` is validated from `instrumentation.ts` `register()`, so startup fails as described in PH-FR-13 (verified by PH-T-28: Next.js 16.4.6 keeps the process alive and answers 500); the test allows 30 s.
- PH-AC-30: Given the 1 MB limit, a Server Action body just under it is accepted and one just over is rejected (413).
- PH-AC-33: ADR 0012 states each decision with its reason and lists the rules enforced by PH-AC-35.
- PH-AC-38: equal sort values are returned in `id` order.
- PH-AC-39/40: defaults are page 1, size 20; size above 100, page 0, negative, non-integer, above 10,000, unknown sort or filter field return `validation` and the `tx` handle is never called.
- PH-AC-48: **removed** (no shared renderer, D9). The PH-FL-05 story is read as "the result shape is plain, serializable and field-keyed".
- PH-AC-55: each PH-HR has an automated test where testable; where not (collector commands PH-AC-24 and 26, docs) the check is listed in the acceptance checklist at epic end.
- PH-AC-57: not automated; the product-manager checks the final diff against section 3 at acceptance (no auth, rate limiting, email, jobs, storage, feature flags, cloud config, production telemetry destination).
- PH-FL-03 "renders statically" is removed.

**New criteria**
- PH-AC-58: Given a failing request to a path with `?token=x` and an `Authorization` header, When the hook logs it, Then neither the query string, the header values nor the error message appear in the entry; it contains only the allowed fields (D7).
- PH-AC-59: Given a wrapped action whose handler calls `redirect()` or `notFound()`, When called, Then the redirect or 404 still happens and no `error`-level entry is written.
- PH-AC-60: Given a page that calls `notFound()` or an action that calls `redirect()`, When requested, Then the hook writes no entry.
- PH-AC-61: Given the production build and the production CSP, When the 500 page, the global error page and the 404 page load in a real browser, Then there are no `securitypolicyviolation` events, styles apply and the page is usable. If `global-error` does not receive the nonce it stays script-free or uses a hash (recorded in ADR 0014).
- PH-AC-62: Given a fixture that throws before the response starts, Then the status is 500 and the 500 page shows; given an unknown URL or a gated route, Then the status is 404. Streamed failures are not asserted.
- PH-AC-63: Given a row hidden by RLS or absent where one is required, When mapped or fetched through the wrapper's helpers, Then the result is `not_found`, never `forbidden` (no existence leak across tenants); verified with a real database error shape in `test:db`.
- PH-AC-64: Given a wrapped action that throws unexpectedly, Then exactly one log entry exists (from the wrapper, none from the hook); given an unwrapped one, exactly one from the hook.
- PH-AC-65: Given a test OTLP/HTTP receiver (`http/json`), When a request is served, Then the receiver gets trace and log requests with the configured service name. Metrics are not asserted (no custom metrics); the pipeline starting without error is the check.
- PH-AC-66: Given two requests to a page, Then each response carries a different nonce and the page's scripts carry it.
- PH-AC-67: Given a Server Action posted with a foreign `Origin`, Then it is rejected.
- PH-AC-68: Given a table on the exception allowlist with a reason, Then the guard passes; given the same violation without an entry, Then it fails naming table and rule; a guard-of-the-guard test creates a violating throwaway table.
- PH-AC-69: Given a throwaway table with the trigger, When updated in a separate transaction, Then `updated_at` advances, `created_at` is unchanged, a client-supplied `updated_at` is overwritten, and a no-op update does not error.
- PH-AC-70: Given a request with `x-request-id`, Then log entries in it carry that value; given none, Then `request_id` is absent (never generated).
- PH-AC-71: Given an `unexpected` result, Then `ref` matches `^[A-Za-z0-9_-]+$` and differs between two occurrences.
- PH-AC-72: Given the logger sink throws, When a request fails, Then the user still receives the error page or result.
- PH-AC-73: Given the production build, Then `serverActions.bodySizeLimit` is `1mb` (config test) and documented.
- PH-AC-74: Given a Supabase URL in `publicEnv`, When the policy is built, Then `connect-src` contains its origin (unit test); production policy has no `unsafe-eval`.
- PH-AC-75: Given page 10,001 or `1e3` or `1.5`, Then `validation` is returned, not a database error.
- PH-AC-76: Given `DESIGN_PAGE_ENABLED` is off (default), Then every `/design/errors/*` route returns 404 (unit test of the gate plus E2E on the flag-off server).
- PH-AC-77: Given `/design`, Then `StatusPage` appears with axe clean in light and dark.
- PH-AC-78 (test mechanism, no new behavior): the E2E base fixture installs a `securitypolicyviolation` and console-CSP-error listener before navigation (`addInitScript`) and fails any test that records one, except the two tests that provoke violations (PH-AC-32).

**Test level per criterion (one named level each)**
- Unit: 11, 12, 13 (fake errors), 16, 17, 18, 23 (schema), 27-30 (policy and config parts), 39, 40, 44-47, 49-53, 59, 60 (hook call), 64 (fakes), 70 (logger with injected header source), 71, 72 (injected throwing sink; unit only), 73, 74, 75, 76 (gate).
- `test:db`: 14, 15, 34, 35, 37, 38, 41, 42, 43, 63, 68, 69.
- E2E on the production build: 01-06, 08, 09, 10, 20-22, 27-29, 31, 32, 58, 60 (`notFound()` page), 61, 62, 64 (E2E half), 65, 66, 67, 70, 76 (flag-off server), 77, 78 (fixture).
- Process test: 23 (bad variable). Lint test: 19.
- CI gates: 25, 36, 54. Manual checklist: 24, 26, 55, 57. Review: 33, 56.
- PH-AC-30 and 67 drive the oversized and foreign-origin posts through a fixture form in a real page, so the Server Action id is real.

**E2E harness (D14 detail)**
- Test servers start through `scripts/e2e-server.mts`, which spawns `next start`, copies stdout and stderr to the console and to `tests/.logs/server-<port>.log` (git-ignored, truncated at start) and exits with the child's code.
- Ports from `E2E_PORT` (3100): +0 main (flag on), +1 flag off, +2 telemetry-on (endpoint to the receiver), +3 closed-port destination. The OTLP receiver (`http/json`, plain Node `http`) is started by Playwright `globalSetup` on `E2E_PORT + 10` before any server; the telemetry servers set `OTEL_BSP_SCHEDULE_DELAY` and `OTEL_BLRP_SCHEDULE_DELAY` to 100 ms. Database variables stay removed from every E2E server. The bad-variable process test spawns its own `next start` on a spare port.

## 9. Non-functional requirements

| ID | Requirement | Measure |
|----|-------------|---------|
| PH-NFR-01 | **No leakage.** Pages, responses, headers and logs never contain messages, stacks, SQL, paths, env names, tokens, emails or connection strings. | PH-AC-06, 11, 18, 58; sentinel secret absent from HTML, RSC payload and headers |
| PH-NFR-02 | **Zero cost when unused.** Without a telemetry destination there is no SDK, no export, no connection noise. | PH-AC-20 |
| PH-NFR-03 | **Telemetry is never on the request path.** Export failure or slowness does not change response status or latency materially. | PH-AC-22 (20 requests, each under 2 s) |
| PH-NFR-04 | **Accessibility.** Error and 404 pages meet WCAG 2.2 AA: axe clean in light and dark, selectable reference code, keyboard reaches every action, h1 focused on mount for client error pages. | PH-AC-07 |
| PH-NFR-05 | **Quality bar of 001.** Lint, typecheck, unit, `test:db`, E2E and build pass; CI jobs `fast`, `database-and-e2e`, `secret-scan` green; collector never required. | PH-AC-25, 54 |
| PH-NFR-06 | **Reversibility.** CSP, collector and conventions can be relaxed in one place each (fallbacks in ADRs). | ADR review |

## 10. Data and dependencies

- Entities: none for the business. One migration adds `public.set_updated_at()`; no application tables.
- Existing code touched: `src/instrumentation.ts`, `src/app/api/health/db/route.ts`, `next.config.ts`, root layout (per-request rendering), `tests/db/schema-guard.test.ts`, ESLint config, `package.json` scripts.
- New dependencies: about 9 exact-pinned OpenTelemetry packages (ADR 0010 rules, 24h release-age gate); a dev-only in-memory exporter. No logger, MSW or template library.
- Upstream: 001-foundations (`withRls`, schema guard, E2E setup, design system). Downstream: 003 uses the wrapper, logger, `proxy.ts`, conventions, pagination and generator.

## 11. Edge cases and failure states

- Errors in Client Components have no digest and never reach the hook: the page omits the code line (known limit, documented).
- A digest is a hash, so the same bug shows the same code to every user; wrapper codes are unique per occurrence.
- `next dev` shows the framework overlay and may log twice; error-page and log criteria are verified on the production build.
- Telemetry destination unreachable, invalid, or absent: covered by PH-AC-20 to 23.
- Docker missing: only the optional collector flow is unavailable.
- Name collisions or invalid names in `gen:module`: stop, change nothing.
- Hostile filter or sort input in pagination: treated as data or rejected before SQL.
- Streaming can return 200 for a late failure: statuses asserted only for failures before streaming.

## 12. Delivery order

Walking skeleton first so value appears early; the first task of each area is a spike that proves the risky assumption before building on it (spike outcomes recorded in the ADR).

| Step | Area | Spike first |
|------|------|-------------|
| 1 | Logger, typed errors and DB mapping, `StatusPage`, 500/global/404 pages, `onRequestError`, `defineAction`, fault routes, `no-console`; includes the E2E log harness and extra-server wiring (D14) | Drizzle error `cause` shape against the real database; a `"use server"` file exporting `defineAction(...)` results builds; `onRequestError` not firing for `redirect()`/`notFound()`; a page that throws before streaming returns 500 under `connection()`; `error.digest` is present in the production build |
| 2 | OpenTelemetry (SDK, env validation, logger bridge), local collector, tests with receiver | `sdk-node` under Turbopack and Node 26, package versions |
| 3 | `src/proxy.ts` CSP, static headers, hardening | Nonce reaches Next scripts; `global-error` receives the nonce; proxy runs on Node; an oversized Server Action returns 413 |
| 4 | Database conventions, trigger, guard | Trigger clock and `set_updated_at` under the existing default-privilege revoke |
| 5 | Pagination (`listParams`, `paginate`) | None beyond step 1's findings |
| 6 | `gen:module`, docs, ADR index, README, acceptance | None |

Workflow: each task is run by a fresh agent instance (AGENTS.md); one local commit per task after lint, typecheck and tests pass, no AI trailers; only the orchestrator pushes. Test approach: unit for logic, `test:db` for mapping, trigger, guard and pagination, E2E on the production build for pages, headers, CSP and logs; manual documented checks only for PH-AC-24 and 26.

## 13. Risks, assumptions and dependencies

| Risk or assumption | Mitigation |
|--------------------|------------|
| Nonce CSP breaks Next, Tailwind, shadcn or `global-error`; forces per-request rendering for every page | E2E under CSP is the proof (PH-AC-31, 61); fallback static CSP in `next.config.ts` recorded in ADR 0014 |
| `sdk-node` and the OTel logs packages (0.x) are unstable under Turbopack and Node 26 | Spike first; SDK is off when unconfigured, so failure cannot break the app; exact pins |
| Drizzle wraps driver errors, so mapping may miss the SQLSTATE | Spike plus `test:db` with real errors, walking `cause` |
| Digest missing in some paths | Documented limit; wrapper generates its own code |
| Epic is large for "hardening" (12 requirements) | Delivery order above; each area independently shippable |
| Assumes C1 to C4 are confirmed | Listed at the top; changing C1 adds guard rules and columns later, additively; C3 and C4 have recorded fallbacks |
| Test fault routes ship in the artifact behind a gate | Gate is off by default and tested (PH-AC-76) |

## 14. Open decisions

None blocking beyond C1 to C4 at the top. Revertible defaults are D1-D17 (section 5).

## 15. Success criteria / definition of done

- A new module can be created with `pnpm gen:module`, use `defineAction`, `logger`, `paginate` and the conventions with no further platform work.
- A forced failure shows a friendly page whose reference code appears in exactly one server log entry, with no internals visible.
- Headers and CSP are verified in a real browser with no violations on `/`, `/design` and the three status pages.
- With no telemetry variables nothing changes; with the collector running, a request's trace and log are visible in Grafana.
- Every PH-AC has an automated test or a named manual check; CI gates green; ADRs 0012-0016 and docs updated; the product-manager acceptance checklist finds nothing outside section 3.

## 16. Traceability: PH-HR to FR to tests

| HR | FR | Acceptance criteria (tests) |
|----|----|-----------------------------|
| PH-HR-01 | PH-FR-01, 02, 03, 04 | PH-AC-01 to 07, 61, 62, 77 (E2E prod, component, axe) |
| PH-HR-02 | PH-FR-05 | PH-AC-08 to 11, 58, 60, 64, 72 (E2E with log tee, unit on the hook) |
| PH-HR-03 | PH-FR-06, 07 | PH-AC-12 to 15, 63 (unit, `test:db`) |
| PH-HR-04 | PH-FR-09, 10 | PH-AC-16 to 19, 70, 72 (unit, lint test) |
| PH-HR-05 | PH-FR-11, 12, 13 | PH-AC-20 to 23, 65 (unit, E2E with receiver, process test) |
| PH-HR-06 | PH-FR-14 | PH-AC-24 to 26 (manual checklist; CI proves non-dependence) |
| PH-HR-07 | PH-FR-15, 16 | PH-AC-27 to 32, 66, 67, 73, 74 (E2E prod, unit, config test) |
| PH-HR-08 | PH-FR-17, 18, 19 | PH-AC-33 to 36, 68, 69 (`test:db`, review, CI drift check) |
| PH-HR-09 | PH-FR-20, 21 | PH-AC-37 to 43, 75 (`test:db`, unit) |
| PH-HR-10 | PH-FR-08 | PH-AC-44 to 47, 59, 64, 71 (unit with fakes, E2E) |
| PH-HR-11 | PH-FR-22 | PH-AC-49 to 53 (unit in temp dir, lint, CI smoke step) |
| PH-HR-12 | PH-FR-23, 24; PH-NFR-05 | PH-AC-54 to 57, 76 (CI, review, acceptance checklist) |

`tasks.md` (written only after approval) must cover every PH-FR and map every PH-AC to a test or manual check.

## Change log

| Date | Change |
|------|--------|
| 2026-11-13 | First draft written, Draft (awaiting Product Owner approval). |
| 2026-11-13 | Round 2 fixes applied: architect (PH-FR-24, PH-FR-11, PH-FR-20 integers) and tester G1-G9 (PH-AC-08 per-test token, `assertFaultInjection()` seam in PH-FR-23, E2E harness and ports, per-AC test levels, extra spikes, PH-AC-22 warm-up, PH-AC-23 startup validation, PH-AC-78 CSP-violation fixture, `gen:module` CI smoke step in PH-FR-22). Status unchanged: Draft. |
| 2026-11-13 | Traceability check applied: C3 (nonce CSP renders every page per request; fallback static CSP, ADR 0014) and C4 (fault routes and `assertFaultInjection()` ship behind `DESIGN_PAGE_ENABLED`; fallback in PH-FR-23) added to the Product Owner confirmation block. No requirement or criterion changed. `tasks.md` split and renumbered (62 tasks). Status unchanged: Draft. |
| 2026-11-13 | Approved by the Product Owner: C1 (hard delete, `created_at`/`updated_at` only), C2, C3 and C4 confirmed with the recommended options. |
| 2026-11-13 | PH-AC-23 / PH-FR-13 relaxed: Next.js 16.4.6 does not exit when `register()` throws (found by PH-T-28); "fails startup" now means the variable is named, the value is not printed and every request returns 500. Forcing `process.exit(1)` was rejected as fragile on serverless platforms. Same behavior as the epic 001 variables. |
