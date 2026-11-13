# 002 - Platform hardening: tasks

**Status:** Approved (spec and tasks approved by the Product Owner on 2026-11-13; execution started)
**Spec:** [spec.md](spec.md) (Draft, round 2 fixes applied 2026-11-13). IDs: `PH-T-NN`; requirements `PH-FR-NN` / `PH-NFR-NN`; criteria `PH-AC-NN` (section 8 of the spec plus `flows.md` section 6).
**Execution rules** (`specs/README.md`, "Task execution"): every task is run by a NEW agent with a fresh context, sequentially by default, hand-off through files only. The orchestrator updates the Status column after each task. A task that fails verification is not reopened in place: the orchestrator adds a fix task (next free ID) for a new agent and re-runs the verification.

## 0. Notes before starting

- **Common read-first for every task** (paths under `/Users/hernangonzalezbuteler/dev/nextjs-starter/`): `AGENTS.md` (English only, module boundaries, no scope beyond the spec), `specs/002-platform-hardening/spec.md` (sections named in the task), `specs/002-platform-hardening/flows.md` sections 4 (business rules), 5 (screen and state inventory) and 6 (acceptance criteria, the Given/When/Then text of every criterion not rewritten in spec section 8), `docs/architecture.md`, `docs/adr/README.md`, plus the ADR named in the task. Next.js here has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Tasks list only what is **additional**.
- **Common rules for every task:** all files in English; add nothing the spec does not state (spec section 3 "Out of scope" is binding); single branch `main`; **exactly one local commit per completed task** (plain descriptive message, Conventional Commits suggested, task ID in the body, e.g. `Task: PH-T-05`), made only after `pnpm lint`, `pnpm typecheck` and every test that exists at that point pass; **no `Co-Authored-By` trailer or any mention of an AI tool; never `git push`** (only the orchestrator pushes); do not edit the Status column (the orchestrator does); the final reply lists what was done, files changed, commands run and anything left open. Documents-only tasks (architect, ui-ux-designer, product-manager) commit too and still run lint/typecheck if any file under lint scope changed.
- **Spikes:** the first task of each area proves the risky assumption with throwaway code (not committed, except notes). Its outcome is appended as a short "Spike outcome" section to the ADR named in the task, with the commands used. If a spike disproves the assumption, the agent stops, commits only the ADR note and reports; the orchestrator takes the question to the Product Owner (fallbacks are in the ADRs).
- **Test levels** per criterion are fixed by spec section 8 ("Test level per criterion"). Build tasks include only the tests they need to pass the gates; the named test tasks write the criterion-level tests.
- **E2E rules (spec section 8):** production build (`build` + `start`) through `scripts/e2e-server.mts`; stdout and stderr tee'd to `tests/.logs/server-<port>.log`; ports from `E2E_PORT` (3100): +0 main (flag on), +1 flag off, +2 telemetry-on, +3 closed-port destination; OTLP receiver on `E2E_PORT + 10`; database variables removed from every E2E server; every E2E test runs under the CSP-violation fixture (PH-AC-78) once PH-T-37 enables the production CSP.
- **Parallelism:** default sequential. Independent tasks are marked **Independent** in the table.
- **Traceability check:** before the Product Owner approves this list, a fresh `product-manager` instance runs the check on spec + tasks (D17).

## 1. Status table

| ID | Title | Assignee | Step | Depends on | Status |
|----|-------|----------|------|------------|--------|
| PH-T-01 | Spike: Drizzle `cause`, `"use server"` export, hook on `redirect`/`notFound`, 500 under `connection()`, digest | developer | 1 | none | done |
| PH-T-02 | Structured logger | developer | 1 | T-01 | done |
| PH-T-03 | `no-console` lint rule and health route on the logger | developer | 1 | T-02 | done |
| PH-T-04 | Typed errors and `Result` | developer | 1 | T-01 | todo |
| PH-T-05 | `fromDbError` database error mapping | developer | 1 | T-04 | todo |
| PH-T-06 | Fault injection seam and `/design/errors` gate | developer | 1 | T-04 | todo |
| PH-T-07 | Fault route fixtures | developer | 1 | T-06 | todo |
| PH-T-08 | `StatusPage` component, listed on `/design` | developer | 1 | T-01 | todo |
| PH-T-09 | Design system doc: `StatusPage` | ui-ux-designer | 1 | T-08 | todo |
| PH-T-10 | 500, global error and 404 pages | developer | 1 | T-08, T-04, T-07 | todo |
| PH-T-11 | `onRequestError` hook | developer | 1 | T-02, T-04, T-07 | todo |
| PH-T-12 | `defineAction` wrapper | developer | 1 | T-02, T-04, T-05, T-07 | todo |
| PH-T-13 | E2E harness: server wrapper with log tee, ports, config | tester | 1 | T-07, T-10 | todo |
| PH-T-14 | Tests: logger (incl. trace id) and no-console | tester | 1 | T-03 | todo |
| PH-T-15 | Tests: errors and database mapping | tester | 1 | T-05 | todo |
| PH-T-16 | Tests: `defineAction` | tester | 1 | T-12 | todo |
| PH-T-17 | Tests: hook (unit) | tester | 1 | T-11 | todo |
| PH-T-18 | E2E: error pages and 404; unit: fault gate | tester | 1 | T-10, T-13 | todo |
| PH-T-19 | E2E: server-side capture (codes, hook, action, route handler) | tester | 1 | T-11, T-12, T-13 | todo |
| PH-T-20 | E2E: no leakage, wrapper logging, request id | tester | 1 | T-11, T-12, T-13 | todo |
| PH-T-21 | Architect check of step 1 and ADR 0015 / 0013 confirmation | architect | 1 | T-14 to T-20 | todo |
| PH-T-22 | Accept step 1 | product-manager | 1 | T-21 | todo |
| PH-T-23 | Spike: `sdk-node` under Turbopack and Node 26, package versions | developer | 2 | T-22 | todo |
| PH-T-24 | `OTEL_*` variables in `env.server.ts` | developer | 2 | T-23 | todo |
| PH-T-25 | SDK bootstrap, trace export, metrics pipeline | developer | 2 | T-24 | todo |
| PH-T-26 | Logger bridge to OpenTelemetry logs | developer | 2 | T-25 | todo |
| PH-T-27 | Local collector: compose file, scripts, documented variables | developer | 2 | T-24, T-25 (sequential: both edit `package.json`) | todo |
| PH-T-28 | Tests: env schema, telemetry off, bad-variable process test | tester | 2 | T-25 | todo |
| PH-T-29 | E2E: telemetry with receiver and closed port | tester | 2 | T-26, T-13 | todo |
| PH-T-30 | Manual check of the collector | tester | 2 | T-26, T-27 | todo |
| PH-T-31 | Architect check of step 2 and ADR 0013 confirmation | architect | 2 | T-28, T-29, T-30 | todo |
| PH-T-32 | Accept step 2 | product-manager | 2 | T-31 | todo |
| PH-T-33 | Spike: nonce reaches Next scripts, `global-error` nonce, proxy on Node, 413 | developer | 3 | T-32 | todo |
| PH-T-34 | CSP builder and `src/proxy.ts` | developer | 3 | T-33 | todo |
| PH-T-35 | Static headers and config hardening | developer | 3 | T-33 (Independent of T-34) | todo |
| PH-T-36 | Tests: CSP policy and config (unit) | tester | 3 | T-34, T-35 | todo |
| PH-T-37 | E2E: CSP, headers, nonce; global violation fixture | tester | 3 | T-36 | todo |
| PH-T-38 | E2E: Server Action origin and body size | tester | 3 | T-37 | todo |
| PH-T-39 | Architect check of step 3 and ADR 0014 confirmation | architect | 3 | T-37, T-38 | todo |
| PH-T-40 | Accept step 3 | product-manager | 3 | T-39 | todo |
| PH-T-41 | Spike: trigger clock and `set_updated_at` under the default-privilege revoke | developer | 4 | T-40 | todo |
| PH-T-42 | Migration: `public.set_updated_at()` | developer | 4 | T-41 | todo |
| PH-T-43 | Convention guard rules in the schema guard | tester | 4 | T-42 | todo |
| PH-T-44 | Tests: trigger, guard allowlist, guard-of-the-guard | tester | 4 | T-43 | todo |
| PH-T-45 | Architect check of step 4 and ADR 0012 confirmation | architect | 4 | T-44 | todo |
| PH-T-46 | Accept step 4 | product-manager | 4 | T-45 | todo |
| PH-T-47 | `listParams` | developer | 5 | T-46 | todo |
| PH-T-48 | `paginate` | developer | 5 | T-47 | todo |
| PH-T-49 | Tests: `listParams` | tester | 5 | T-47 (Independent of T-48) | todo |
| PH-T-50 | Tests: `paginate` | tester | 5 | T-48 | todo |
| PH-T-51 | Architect check of step 5 and ADR 0016 confirmation | architect | 5 | T-49, T-50 | todo |
| PH-T-52 | Accept step 5 | product-manager | 5 | T-51 | todo |
| PH-T-53 | `gen:module` script | developer | 6 | T-52 | todo |
| PH-T-54 | Tests: `gen:module` | tester | 6 | T-53 | todo |
| PH-T-55 | CI smoke step for `gen:module` | developer | 6 | T-54 | todo |
| PH-T-56 | `docs/architecture.md` and ADR index confirmation | architect | 6 | T-55 | todo |
| PH-T-57 | README: collector commands and new scripts | developer | 6 | T-55 (Independent of T-56) | todo |
| PH-T-58 | Test README: seams, harness, ports | tester | 6 | T-55 (Independent of T-56, T-57) | todo |
| PH-T-59 | Full gates and CI parity | tester | 6 | T-56, T-57, T-58 | todo |
| PH-T-60 | Final architect read | architect | 6 | T-59 | todo |
| PH-T-61 | Final tester read | tester | 6 | T-59 (Independent of T-60) | todo |
| PH-T-62 | Final acceptance | product-manager | 6 | T-60, T-61 | todo |

Count by assignee: developer 26, tester 22, architect 7, product-manager 6, ui-ux-designer 1. Total 62.

---

## 2. Step 1: logger, errors, pages, hook, wrapper, seams

### PH-T-01 Spike: step 1 assumptions
- **Assignee:** developer
- **Goal:** prove or disprove the five risky assumptions of step 1 before building on them.
- **Requirements:** PH-FR-05, 07, 08, 01, 03 (de-risking only).
- **Read first:** spec 11, 12 (step 1 spike column), 13; ADR 0015; `src/db/rls.ts`, `tests/utils/` (real-database harness), `src/instrumentation.ts` (if present).
- **Do (throwaway code, not committed):** (1) with the real local database, trigger a unique-violation, a foreign-key violation, a not-null violation, a check violation and a permission error through Drizzle and record where the SQLSTATE sits along the `cause` chain; (2) confirm a `"use server"` file exporting the result of `defineAction(...)`-style call builds under Next (or record the workaround); (3) confirm `onRequestError` does not fire for `redirect()`/`notFound()`; (4) confirm a page that throws before streaming returns HTTP 500 (not 200) on `build` + `start` under `connection()` in the root layout; (5) confirm `error.digest` is present in the production build for a thrown server error.
- **Acceptance:** a "Spike outcome" section appended to ADR 0015 with one line per item (result, evidence command, consequence for the design). No throwaway code left in the tree.
- **Out of scope:** production code, tests, any ADR change other than the appended section.
- **Output:** edited `docs/adr/0015-error-model-and-action-wrapper.md`. Commit scope `docs(adr)`.
- **Dependencies:** none.

### PH-T-02 Structured logger
- **Assignee:** developer
- **Goal:** one PII-free JSON-line logger.
- **Requirements:** PH-FR-09.
- **Read first:** spec 5 (D4), 7 (PH-FR-09), 8 (PH-AC-16, 17, 18, 70, 72); ADR 0013 (logger section); `src/lib/env.server.ts`.
- **Do:** `src/lib/logger.ts` with `logger.debug/info/warn/error` and `logger.exception`; one JSON line with level, timestamp, event, fields, `trace_id`/`span_id` from the active span when one exists, `request_id` read from `x-request-id`/`x-vercel-id` when present (never generated; header source injectable for tests); typed primitive fields only, key deny-list redaction, 200-character truncation, errors reduced to name, code, digest; works outside a request; the sink is injectable and a throwing sink never propagates. Add the OpenTelemetry API package only if needed for the active span (exact pin, ADR 0010 rules); no other dependency.
- **Acceptance:** `pnpm lint`, `pnpm typecheck` pass; a scratch call writes one valid JSON line; a logger call outside a request does not throw; no logger dependency added.
- **Out of scope:** OpenTelemetry logs bridge (T-26), replacing existing `console` calls (T-03), tests beyond the gates (T-14).
- **Output:** `src/lib/logger.ts`. Commit scope `feat(lib)`.
- **Dependencies:** PH-T-01.

### PH-T-03 `no-console` lint rule and health route on the logger
- **Assignee:** developer
- **Goal:** no ad hoc console in `src/**`.
- **Requirements:** PH-FR-10.
- **Read first:** spec 7 (PH-FR-10), PH-AC-19; ESLint config; `src/app/api/health/db/route.ts` and its tests.
- **Do:** ESLint `no-console` as an error in `src/**` with `src/lib/logger.ts` the only exemption; switch `src/app/api/health/db/route.ts` to the logger keeping its no-leak behavior; fix any other `console.*` in `src/**`.
- **Acceptance:** `pnpm lint` passes; adding a `console.error` in any `src/**` file other than the logger fails lint; the health route tests still pass.
- **Out of scope:** the lint test (T-14).
- **Output:** ESLint config, route edit. Commit scope `feat(lint)`.
- **Dependencies:** PH-T-02.

### PH-T-04 Typed errors and `Result`
- **Assignee:** developer
- **Goal:** the shared error vocabulary.
- **Requirements:** PH-FR-06.
- **Read first:** spec 4 (glossary), 7 (PH-FR-06), PH-AC-12; ADR 0015 (decision, helper names `validationError`, `notFoundError`, `forbiddenError`, `conflictError`).
- **Do:** `src/lib/errors.ts` with `AppError` (exactly five types), `ActionError` (`type`, safe `message`, optional `fieldErrors`, `ref` only for `unexpected`), plain serializable `Result<T>`, and the helper constructors. Importable from client code (no `server-only`).
- **Acceptance:** typecheck passes; a client component can import the types; there are exactly five error types.
- **Out of scope:** DB mapping (T-05), wrapper (T-12).
- **Output:** `src/lib/errors.ts`. Commit scope `feat(lib)`.
- **Dependencies:** PH-T-01.

### PH-T-05 `fromDbError` database error mapping
- **Assignee:** developer
- **Goal:** map database failures to `AppError`.
- **Requirements:** PH-FR-07.
- **Read first:** spec 7 (PH-FR-07), PH-AC-13, 14, 15, 63; ADR 0015 (incl. spike outcome from T-01); `src/db/`.
- **Do:** `fromDbError` (location per ADR 0015, respecting the module boundary rules) reading the SQLSTATE through the `cause` chain: `23505`/`23503` conflict, `42501` forbidden, `23502`/`23514` validation, else unexpected with no database message; helper for "no row where one is required" and rows hidden by RLS returning `not_found`, never `forbidden`.
- **Acceptance:** typecheck and lint pass; a scratch run against the real database maps each of the five spike errors as specified; no database message text reaches the `AppError`.
- **Out of scope:** tests (T-15), wrapper (T-12).
- **Output:** mapping code. Commit scope `feat(db)`.
- **Dependencies:** PH-T-04.

### PH-T-06 Fault injection seam and `/design/errors` gate
- **Assignee:** developer
- **Goal:** the test-only seam and gate that can never be active in production; the fixtures that use it come in T-07.
- **Requirements:** PH-FR-23.
- **Read first:** spec 4 (fault routes), 7 (PH-FR-23), 8 (PH-AC-76); `src/app/design/_lib/gate.ts`, `src/app/design/layout.tsx`, `src/app/layout.tsx`.
- **Do:** `src/lib/fault-injection.ts` exporting `assertFaultInjection()`, which throws only when `DESIGN_PAGE_ENABLED` is on and the request has header `x-fault: root-layout`, and is a no-op otherwise; call it from `src/app/layout.tsx`. Add the gate for everything under `/design/errors/*` (layout that returns 404 when the flag is off, reusing the existing gate; no database access), with no fixtures yet. Gate logic must be unit-testable (exported function) for T-18.
- **Acceptance:** with the flag off, `assertFaultInjection()` is a no-op and `/design/errors/anything` returns 404; with the flag on and the header, the root layout throws; without the header it does not; typecheck and lint pass.
- **Out of scope:** the fixtures (T-07), the `defineAction` wrapper, tests (T-18).
- **Output:** `src/lib/fault-injection.ts`, edit of `src/app/layout.tsx`, `src/app/design/errors/layout.tsx`. Commit scope `feat(design)`.
- **Dependencies:** PH-T-04.

### PH-T-07 Fault route fixtures
- **Assignee:** developer
- **Goal:** pages and routes that fail on demand, behind the gate from T-06.
- **Requirements:** PH-FR-23.
- **Read first:** spec 4 (fault routes), 7 (PH-FR-23), 8 (PH-AC-30/67 note); `src/app/design/errors/layout.tsx`, `src/lib/fault-injection.ts` (from T-06).
- **Do:** under `/design/errors/*`: throwing page (message includes a per-test token read from a query parameter), throwing route handler, throwing unwrapped action, a retry toggle page, an oversized-body action and a fixture form that posts to a real Server Action (for PH-AC-30 and 67), pages calling `notFound()` and an action calling `redirect()`. The wrapped-action fixture is added in PH-T-12.
- **Acceptance:** with the flag on, each fixture fails or redirects as named; with the flag off every `/design/errors/*` route returns 404; typecheck and lint pass.
- **Out of scope:** the `defineAction` wrapper (T-12), E2E tests (T-18 to T-20), a "global-preview" page (only the recorded fallback in the spec).
- **Output:** `src/app/design/errors/**`. Commit scope `feat(design)`.
- **Dependencies:** PH-T-06.

### PH-T-08 `StatusPage` component, listed on `/design`
- **Assignee:** developer
- **Goal:** one presentational component shared by the three status pages.
- **Requirements:** PH-FR-04.
- **Read first:** spec 5 (D6), 7 (PH-FR-04), PH-AC-07, 77; `reviews/round1/ui-ux-designer.md` (copy and layout); `docs/design-system.md` (sections on layout, components, a11y); `src/components/layout/`, `src/app/design/`.
- **Do:** `src/components/layout/status-page.tsx`: title (h1), description, optional selectable reference code (omitted entirely when absent), action slots; no `next/link`, hooks or providers. Add a `StatusPage` sample section to `/design` following the existing section pattern.
- **Acceptance:** renders in light and dark; code line absent when no code; `/design` shows it; lint and typecheck pass.
- **Out of scope:** the pages themselves (T-10), design-system text (T-09), tests (T-18).
- **Output:** component, `/design` section. Commit scope `feat(ui)`.
- **Dependencies:** PH-T-01.

### PH-T-09 Design system doc: `StatusPage`
- **Assignee:** ui-ux-designer
- **Goal:** `docs/design-system.md` documents `StatusPage`.
- **Requirements:** PH-FR-04, PH-FR-24 (design-system part).
- **Read first:** spec 7 (PH-FR-04), 5 (D6); `docs/design-system.md` section 7.4; `reviews/round1/ui-ux-designer.md`; the component from T-08.
- **Do:** update section 7.4 (anatomy, copy for 500, global error and 404, reference code treatment, actions, a11y: h1 focus on mount for client error pages, selectable code).
- **Acceptance:** doc matches the implemented component; no new components or tokens introduced.
- **Out of scope:** code changes (report mismatches instead), Figma.
- **Output:** `docs/design-system.md`. Commit scope `docs(design)`.
- **Dependencies:** PH-T-08.

### PH-T-10 500, global error and 404 pages
- **Assignee:** developer
- **Goal:** friendly pages for every failure kind.
- **Requirements:** PH-FR-01, 02, 03.
- **Read first:** spec 7 (PH-FR-01 to 03), BR-02/BR-03 corrections in spec 6; PH-AC-01 to 07, 62; ADR 0015, ADR 0014 (global-error nonce note); Next docs on `error.tsx`, `global-error`, `not-found`.
- **Do:** `src/app/error.tsx` (client; title, description, selectable `error.digest` code omitted when absent, "Try again" retry, "Go to home page"; h1 focus on mount), `src/app/global-error.tsx` (own `html`/`body`, same copy, plain `<a href="/">`), `src/app/not-found.tsx` (message and home link, no code); all on `StatusPage`; unknown URLs and gated `/design*` routes show the 404.
- **Acceptance:** with the fault routes (T-07), a thrown page shows the 500 page with a code matching `^[A-Za-z0-9_-]+$` and no internals; unknown URL shows the 404 page with HTTP 404; lint and typecheck pass.
- **Out of scope:** E2E tests (T-18), nonce handling for `global-error` (T-33/T-34).
- **Output:** the three files. Commit scope `feat(app)`.
- **Dependencies:** PH-T-08, PH-T-04, PH-T-07 (fault routes; T-06 through T-07).

### PH-T-11 `onRequestError` hook
- **Assignee:** developer
- **Goal:** observe-only server-side capture of unhandled errors.
- **Requirements:** PH-FR-05.
- **Read first:** spec 5 (D5, D7), 6 (BR-02), 7 (PH-FR-05), PH-AC-08 to 11, 58, 60; ADR 0015 (incl. spike outcome); `src/instrumentation.ts` (create if absent; keep existing content).
- **Do:** export `onRequestError` that logs one entry per unhandled error via the logger with only event, `routePath`, `routeType`, `method`, error class, `digest` and database error code; never `request.path`, headers, query string or error message; must not fire for `redirect()`/`notFound()`; must never throw.
- **Acceptance:** with a fixture failure (T-07), one entry containing only the allowed fields is written; typecheck and lint pass.
- **Out of scope:** wrapped-action logging (T-12), tests (T-17, T-19, T-20).
- **Output:** `src/instrumentation.ts`. Commit scope `feat(app)`.
- **Dependencies:** PH-T-02, PH-T-04, PH-T-07 (fault routes; T-06 through T-07).

### PH-T-12 `defineAction` wrapper
- **Assignee:** developer
- **Goal:** one server action wrapper returning `Result<T>`.
- **Requirements:** PH-FR-08.
- **Read first:** spec 7 (PH-FR-08), 5 (D8), PH-AC-44 to 47, 59, 64, 71; ADR 0015 (incl. spike outcome); `src/lib/errors.ts`, `src/lib/logger.ts`.
- **Do:** `src/lib/action.ts` with `defineAction({ name, schema, handler })`: parse with Zod (handler never runs on invalid input; `validation` with `fieldErrors`), run handler, `unstable_rethrow` (so `redirect()`/`notFound()` pass and are not logged as errors), `AppError` passthrough, DB mapping via `fromDbError`, unexpected with a generated random `ref` and exactly one logger entry; wrapped failures are logged by the wrapper only. No auth inside. Add the wrapped-action fault fixture to the fault routes.
- **Acceptance:** typecheck and lint pass; a scratch action returns each of the five result types; `ref` differs between two unexpected results.
- **Out of scope:** auth, tenant guard, authed wrapper, rate limiting (epic 003), tests (T-16, T-20).
- **Output:** `src/lib/action.ts`, fixture edit. Commit scope `feat(lib)`.
- **Dependencies:** PH-T-02, PH-T-04, PH-T-05, PH-T-07.

### PH-T-13 E2E harness: server wrapper with log tee, ports, config
- **Assignee:** tester
- **Goal:** E2E can run on a production build and read the server log.
- **Requirements:** PH-FR-23 (seam use), PH-NFR-05; D14.
- **Read first:** spec 5 (D14), 8 ("E2E harness"), 12 (step 1); `playwright.config.ts`, `tests/e2e/helpers/axe.ts`, `tests/utils/README.md`, `.gitignore`.
- **Do:** `scripts/e2e-server.mts` (spawns `next start`, copies stdout and stderr to console and to `tests/.logs/server-<port>.log`, truncated at start, exits with the child's code); git-ignore `tests/.logs/`; Playwright `webServer` entries for ports +0 (flag on) and +1 (flag off) running `build` once then `start`; a log-reader helper (`expect.poll` friendly, finds entries by code/token); the base fixture with the `securitypolicyviolation` and console-CSP-error listener installed via `addInitScript` (PH-AC-78), wired in but inert until the CSP exists; existing E2E specs keep passing. Telemetry servers (+2, +3) and the receiver are added in T-29.
- **Acceptance:** `pnpm test:e2e` passes on the production build; a deliberately failing server exits non-zero through the wrapper; the log file exists, is git-ignored and is truncated on restart.
- **Out of scope:** telemetry servers and receiver (T-29), new spec files (T-18 to T-20).
- **Output:** `scripts/e2e-server.mts`, `playwright.config.ts`, `tests/e2e/helpers/*`, `.gitignore`. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-07, PH-T-10.

### PH-T-14 Tests: logger (incl. trace id) and no-console
- **Assignee:** tester
- **Goal:** unit tests for the logger and the lint rule.
- **Requirements:** PH-FR-09, PH-FR-10; PH-NFR-01.
- **Read first:** spec 8 (PH-AC-16, 17, 18, 19, 70, 72), 10 (dev-only in-memory exporter), 5 (D14); `src/lib/logger.ts`; `tests/utils/README.md`.
- **Do:** unit tests: one JSON line with required fields (16), including `trace_id` and `span_id` taken from an active span, proven with the dev-only in-memory span exporter and tracer provider (`@opentelemetry/sdk-trace-base` or the package named in spec 10, exact-pinned dev dependency per ADR 0010; it is not a production dependency) and absent when no span is active; typed fields, deny-list redaction, 200-char truncation, errors reduced to name/code/digest, no secrets or messages in output (17, 18); `request_id` carried from an injected header source and absent when none (70); throwing sink does not propagate (72); lint test proving `console.*` in `src/**` fails and the logger file is exempt (19).
- **Acceptance:** tests fail if the corresponding behavior is removed (check by one temporary mutation per behavior, not committed); gates pass; the in-memory exporter is only in `devDependencies`.
- **Out of scope:** production code changes (report defects), the production SDK (T-25).
- **Output:** test files, `package.json` / lockfile (dev dependency). Commit scope `test(lib)`.
- **Dependencies:** PH-T-03.

### PH-T-15 Tests: errors and database mapping
- **Assignee:** tester
- **Goal:** tests for error types and `fromDbError`.
- **Requirements:** PH-FR-06, PH-FR-07.
- **Read first:** spec 8 (PH-AC-12 to 15, 63); `src/lib/errors.ts`, `fromDbError`; `tests/utils/` (database harness, throwaway tables).
- **Do:** unit tests with fake error shapes (12, 13: each SQLSTATE class, `cause` chain walking, unknown to unexpected without database message); `test:db` tests with real errors (14, 15: unique, FK, not-null, check, permission) and the `not_found` rule for rows hidden by RLS or absent (63), never `forbidden`.
- **Acceptance:** `pnpm test` and `pnpm test:db` pass; each SQLSTATE case is a separate test.
- **Out of scope:** production code changes (report defects).
- **Output:** test files. Commit scope `test(db)`.
- **Dependencies:** PH-T-05.

### PH-T-16 Tests: `defineAction`
- **Assignee:** tester
- **Goal:** unit tests for the wrapper with fakes.
- **Requirements:** PH-FR-08.
- **Read first:** spec 8 (PH-AC-44 to 47, 59, 64, 71); `src/lib/action.ts`.
- **Do:** unit tests: invalid input never runs the handler and returns `validation` with field errors; each `AppError` type passes through; `redirect()`/`notFound()` pass through with no `error`-level entry (59); unexpected returns `ref` matching `^[A-Za-z0-9_-]+$`, different between two occurrences (71), exactly one log entry from the wrapper (64, unit half); order parse, handler, rethrow, AppError, DB mapping, unexpected.
- **Acceptance:** gates pass; each listed criterion has a named test.
- **Out of scope:** E2E half of 64 (T-20).
- **Output:** test files. Commit scope `test(lib)`.
- **Dependencies:** PH-T-12.

### PH-T-17 Tests: hook (unit)
- **Assignee:** tester
- **Goal:** unit tests for `onRequestError`.
- **Requirements:** PH-FR-05.
- **Read first:** spec 8 (PH-AC-11, 58, 60); `src/instrumentation.ts`.
- **Do:** call the hook with fake request/error: only allowed fields logged; no `request.path`, headers, query string or message (58, unit half); no entry for redirect/not-found errors (60, hook-call half); never throws when the sink throws.
- **Acceptance:** gates pass.
- **Out of scope:** E2E (T-19, T-20).
- **Output:** test file. Commit scope `test(app)`.
- **Dependencies:** PH-T-11.

### PH-T-18 E2E: error pages and 404; unit: fault gate
- **Assignee:** tester
- **Goal:** prove the pages in a real browser on the production build, and the fault gate at unit level.
- **Requirements:** PH-FR-01, 02, 03, 04, 23; PH-NFR-04.
- **Read first:** spec 8 (PH-AC-01 to 07, 62, 76, 77, 78); `tests/e2e/*.spec.ts`, `helpers/axe.ts`; `src/lib/fault-injection.ts`, fault routes.
- **Do:** unit test (PH-AC-76, unit half): the gate returns 404 when `DESIGN_PAGE_ENABLED` is off and passes when on, and `assertFaultInjection()` is a no-op when the flag is off or the header is absent and throws only with flag on plus `x-fault: root-layout`. E2E: throwing page shows the 500 page with code, no internals, retry and home actions work (01, 02, 06, 07); root-layout failure via `x-fault: root-layout` on one navigation shows the global error page (03); unknown URL and gated route show the 404 with HTTP 404, no code (04, 05); pre-streaming failure returns 500 (62); with the flag-off server every `/design/errors/*` returns 404 (76, E2E half); `/design` shows `StatusPage`, axe clean in light and dark, keyboard reaches every action, h1 focused on mount (07, 77).
- **Acceptance:** `pnpm test` and `pnpm test:e2e` pass; retry-toggle test proves "Try again" recovers.
- **Out of scope:** CSP assertions (T-37), log assertions (T-19, T-20).
- **Output:** spec files. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-10, PH-T-13.

### PH-T-19 E2E: server-side capture (codes, hook, action, route handler)
- **Assignee:** tester
- **Goal:** prove one log entry per unhandled failure and that only allowed fields are logged.
- **Requirements:** PH-FR-05, 09.
- **Read first:** spec 8 (PH-AC-08, 09, 10, 58, 60, new text for PH-AC-08), 5 (D5, D7); the log-reader helper from T-13.
- **Do:** E2E with the per-test token from a query parameter: code on the page equals the code in exactly one log entry, polled with `expect.poll`, token absent from HTML, RSC payload and log entry (08); unwrapped action: exactly one hook entry, generic error (09); route handler: no internals, exactly one entry (10); `?token=x` plus `Authorization` header: only allowed fields logged (58, E2E half); `notFound()` page and `redirect()` action produce no entry (60).
- **Acceptance:** `pnpm test:e2e` passes and is stable across 3 consecutive runs.
- **Out of scope:** production code changes (report defects); leakage, wrapper and request id (T-20).
- **Output:** spec files. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-11, PH-T-12, PH-T-13.

### PH-T-20 E2E: no leakage, wrapper logging, request id
- **Assignee:** tester
- **Goal:** prove no leakage, wrapper-only logging for wrapped actions, and request id propagation.
- **Requirements:** PH-FR-05, 08, 09; PH-NFR-01.
- **Read first:** spec 8 (PH-AC-11, 64, 70), 9 (PH-NFR-01); the log-reader helper from T-13.
- **Do:** E2E: no stack, path or env name in responses and headers, sentinel secret absent from HTML, RSC payload and headers (11, NFR-01); wrapped failure: exactly one entry, from the wrapper, none from the hook (64, E2E half); `x-request-id` carried into entries (70, E2E half).
- **Acceptance:** `pnpm test:e2e` passes and is stable across 3 consecutive runs.
- **Out of scope:** production code changes (report defects); capture tests (T-19).
- **Output:** spec files. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-11, PH-T-12, PH-T-13.

### PH-T-21 Architect check of step 1 and ADR confirmation
- **Assignee:** architect
- **Goal:** the code matches ADRs 0015 and 0013 (logger part); decisions are recorded.
- **Requirements:** PH-FR-05 to 10, PH-FR-23; PH-NFR-06.
- **Read first:** ADR 0013, 0015; all step 1 code and tests; spike outcome in ADR 0015.
- **Do:** review against the ADRs and module boundary rules; confirm or amend the ADRs (record the `assertFaultInjection()` seam and its fallback, the location of `fromDbError`, real `cause` shape, spike results); write findings as a short list in the task reply. Fix ADR text directly; do not change product scope. Code defects go back as fix tasks (the orchestrator adds them).
- **Acceptance:** ADR 0015 and the logger part of ADR 0013 are consistent with the code; no unresolved must-fix.
- **Out of scope:** code changes.
- **Output:** edited ADRs. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-14 to PH-T-20.

### PH-T-22 Accept step 1
- **Assignee:** product-manager
- **Goal:** accept step 1 against the spec with evidence.
- **Requirements:** PH-FR-01 to 10, 23 (partial: the docs half of PH-FR-24 comes later).
- **Read first:** spec 7, 8, 15; test results; the architect reply.
- **Do:** run the gates, check each requirement and criterion of step 1 as met / partially / not met, check nothing outside spec section 3 was added, write `specs/002-platform-hardening/acceptance/step1.md` (short checklist).
- **Acceptance:** all step 1 criteria met or deferred with the orchestrator's agreement.
- **Out of scope:** fixing defects.
- **Output:** `acceptance/step1.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-21.

---

## 3. Step 2: OpenTelemetry and local collector

### PH-T-23 Spike: `sdk-node` under Turbopack and Node 26, package versions
- **Assignee:** developer
- **Goal:** prove the SDK starts and exports under the repo's Next and Node, and pick exact versions.
- **Requirements:** PH-FR-11, 12 (de-risking).
- **Read first:** spec 5 (D2, D3), 12 (step 2), 13; ADR 0013; ADR 0010 (pinning and 24h release-age gate); `.nvmrc`.
- **Do (throwaway):** with a scratch `instrumentation.node.ts`, start `sdk-node` with OTLP/HTTP trace and log exporters and batch processors, build and start on `next start`, send to a local plain Node receiver; record package list and exact versions that pass the gate, any Turbopack/webpack external config needed, and Node 26 behavior.
- **Acceptance:** "Spike outcome" section in ADR 0013 (versions, config needed, result). No throwaway code left.
- **Out of scope:** production code.
- **Output:** edited ADR 0013. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-22.

### PH-T-24 `OTEL_*` variables in `env.server.ts`
- **Assignee:** developer
- **Goal:** validated telemetry configuration, validated at startup.
- **Requirements:** PH-FR-13.
- **Read first:** spec 7 (PH-FR-13), 8 (PH-AC-23 with startup text); `src/lib/env.server.ts`, `.env.example`, ADR 0004.
- **Do:** declare `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL), `OTEL_EXPORTER_OTLP_PROTOCOL` (optional `http/protobuf` or `http/json`), `OTEL_SERVICE_NAME` (optional, default `nextjs-starter`) in `env.server.ts` and `.env.example`; validate from `instrumentation.ts` `register()` so an invalid value exits at startup naming the variable; `OTEL_EXPORTER_OTLP_HEADERS` is not read or logged by app code.
- **Acceptance:** an invalid value fails startup naming the variable; with none set the app starts; gates pass.
- **Out of scope:** starting the SDK (T-25).
- **Output:** env module, `.env.example`, `instrumentation.ts`. Commit scope `feat(env)`.
- **Dependencies:** PH-T-23.

### PH-T-25 SDK bootstrap, trace export, metrics pipeline
- **Assignee:** developer
- **Goal:** OpenTelemetry on only when an endpoint is set.
- **Requirements:** PH-FR-11, 12; PH-NFR-02, 03.
- **Read first:** spec 5 (D2, D3), 7 (PH-FR-11, 12), PH-AC-20, 21, 22, 65; ADR 0013 (incl. spike outcome); `src/instrumentation.ts`.
- **Do:** `src/instrumentation.node.ts` loaded from `register()` only in the Node runtime and only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; `sdk-node` with OTLP/HTTP trace exporter and batch span processor, service name from `OTEL_SERVICE_NAME`; metrics pipeline wired with no custom metrics; exact-pinned dependencies per the spike; export failure never breaks or blocks requests. No SDK, no export and no connection noise when unset.
- **Acceptance:** with the variable unset nothing starts (verify no SDK import executes); with it set to a local receiver traces arrive; gates and `pnpm build` pass.
- **Out of scope:** logger bridge (T-26), custom metrics, database spans, runtime metrics.
- **Output:** `src/instrumentation.node.ts`, `src/instrumentation.ts`, `package.json`, lockfile. Commit scope `feat(obs)`.
- **Dependencies:** PH-T-24.

### PH-T-26 Logger bridge to OpenTelemetry logs
- **Assignee:** developer
- **Goal:** log entries are also exported over OTLP when telemetry is on.
- **Requirements:** PH-FR-09, 12.
- **Read first:** spec 7 (PH-FR-09, 12), PH-AC-21, 65; ADR 0013; `src/lib/logger.ts`, `src/instrumentation.node.ts`.
- **Do:** batch log record processor and OTLP/HTTP log exporter in the SDK setup; the logger emits to the OTel logs API only when the SDK is active, keeping the console JSON line; the logger still never throws and still redacts before emitting.
- **Acceptance:** with a local receiver, a request produces trace and log requests carrying the configured service name; with telemetry off the logger behaves as before; gates pass.
- **Out of scope:** tests (T-28, T-29).
- **Output:** edits to logger and `instrumentation.node.ts`. Commit scope `feat(obs)`.
- **Dependencies:** PH-T-25.

### PH-T-27 Local collector: compose file, scripts, documented variables
- **Assignee:** developer
- **Goal:** optional Grafana LGTM for local inspection.
- **Requirements:** PH-FR-14.
- **Read first:** spec 5 (D1), 7 (PH-FR-14), PH-AC-24, 25, 26; ADR 0013; `package.json` scripts; ADR 0010 for pinning.
- **Do:** `docker/observability/compose.yaml` (Grafana LGTM, pinned image tag, UI on host port 3001, ports bound to 127.0.0.1, no volume); scripts `obs:start` / `obs:stop`; a short README note beside the compose file with the three variables to set. Not referenced by `dev`, `test`, `build` or CI.
- **Acceptance:** `docker compose -f docker/observability/compose.yaml config` is valid; no existing script or CI job references the collector; documented variables match PH-FR-13.
- **Out of scope:** running it (T-30), root README (T-57), volumes, dashboards.
- **Output:** compose file, `package.json`. Commit scope `feat(obs)`.
- **Dependencies:** PH-T-24, PH-T-25 (sequential, not parallel: T-25 and this task both edit `package.json`).

### PH-T-28 Tests: env schema, telemetry off, bad-variable process test
- **Assignee:** tester
- **Goal:** tests for configuration and the off-by-default behavior.
- **Requirements:** PH-FR-11, 13; PH-NFR-02.
- **Read first:** spec 8 (PH-AC-20, 23 with startup text); `src/lib/env.test.ts`.
- **Do:** unit tests for the `OTEL_*` schema (non-URL endpoint, bad protocol, empty service name, default name) (23, schema); a process test spawning `next start` on a spare port with a bad value expecting non-zero exit and the variable named on stderr, timeout 30 s (23); a test that with the endpoint unset the SDK module is not loaded (20, unit half).
- **Acceptance:** gates pass; the process test is not flaky over 3 runs.
- **Out of scope:** E2E telemetry (T-29).
- **Output:** test files. Commit scope `test(obs)`.
- **Dependencies:** PH-T-25.

### PH-T-29 E2E: telemetry with receiver and closed port
- **Assignee:** tester
- **Goal:** prove export works and failure never hurts requests.
- **Requirements:** PH-FR-11, 12; PH-NFR-02, 03.
- **Read first:** spec 8 (PH-AC-20, 21, 22 with warm-up text, 65), 8 ("E2E harness"); `playwright.config.ts`, `scripts/e2e-server.mts`.
- **Do:** Playwright `globalSetup` starting a plain Node `http` OTLP receiver (`http/json`) on `E2E_PORT + 10` before any server; servers +2 (endpoint to the receiver) and +3 (endpoint to a closed port) with `OTEL_BSP_SCHEDULE_DELAY` and `OTEL_BLRP_SCHEDULE_DELAY` at 100 ms; tests: receiver gets trace and log requests with the configured service name (21, 65; metrics only "pipeline starts without error"); main server (no endpoint) produces no outbound export and logs to console (20); closed port: one warm-up request excluded, then 20 sequential requests all 200 under 2 s each and the process still alive (22).
- **Acceptance:** `pnpm test:e2e` passes; stable across 3 runs; the collector or Docker is not used.
- **Out of scope:** the collector (T-30).
- **Output:** harness edits, spec files. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-26, PH-T-13.

### PH-T-30 Manual check of the collector
- **Assignee:** tester
- **Goal:** evidence for the manual criteria.
- **Requirements:** PH-FR-14.
- **Read first:** spec 8 (PH-AC-24, 25, 26), 15; compose file and docs from T-27.
- **Do:** run `pnpm obs:start`, start the app with the documented variables, make a request, confirm trace and log in Grafana on port 3001, `pnpm obs:stop`; confirm `pnpm dev`, tests and build work with Docker collector absent; write results with commands and screenshots paths into `specs/002-platform-hardening/acceptance/collector-manual.md`. If Docker is unavailable, state it and mark not verified.
- **Acceptance:** file lists PH-AC-24 and 26 as pass/fail with evidence; PH-AC-25 confirmed via CI config reading.
- **Out of scope:** code changes.
- **Output:** `acceptance/collector-manual.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-26, PH-T-27.

### PH-T-31 Architect check of step 2 and ADR 0013 confirmation
- **Assignee:** architect
- **Goal:** the code matches ADR 0013; spike outcome recorded.
- **Requirements:** PH-FR-11 to 14; PH-NFR-02, 03, 06.
- **Read first:** ADR 0013, step 2 code and tests, T-30 file.
- **Do:** review dependencies (exact pins, ADR 0010), SDK-off behavior, no secrets logged, fallbacks; amend ADR 0013 if needed; report findings.
- **Acceptance:** ADR 0013 consistent with code; no unresolved must-fix.
- **Out of scope:** code changes.
- **Output:** edited ADR 0013. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-28, PH-T-29, PH-T-30.

### PH-T-32 Accept step 2
- **Assignee:** product-manager
- **Goal:** accept step 2.
- **Requirements:** PH-FR-11 to 14; PH-NFR-02, 03.
- **Read first:** spec 7, 8, 9; test results; `acceptance/collector-manual.md`.
- **Do:** as T-22 for step 2; write `acceptance/step2.md`.
- **Acceptance:** criteria met or deferred with orchestrator agreement; nothing outside spec section 3 (no production destination).
- **Out of scope:** fixing defects.
- **Output:** `acceptance/step2.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-31.

---

## 4. Step 3: security headers and CSP

### PH-T-33 Spike: nonce, `global-error`, proxy on Node, 413
- **Assignee:** developer
- **Goal:** prove the nonce CSP works with Next before building it.
- **Requirements:** PH-FR-15, 16 (de-risking).
- **Read first:** spec 5 (D10), 12 (step 3), 13; ADR 0014; Next docs on CSP, `proxy`, `serverActions.bodySizeLimit`.
- **Do (throwaway):** minimal `proxy.ts` setting a nonce CSP; on `build` + `start` check that Next scripts carry the nonce and the page works, that `global-error` receives the nonce (otherwise decide script-free or hash), that the proxy runs on Node, and that an oversized Server Action (fixture from T-07) returns 413 with the limit set.
- **Acceptance:** "Spike outcome" in ADR 0014, including the fallback decision for `global-error` and whether the static CSP fallback is needed.
- **Out of scope:** production code.
- **Output:** edited ADR 0014. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-32.

### PH-T-34 CSP builder and `src/proxy.ts`
- **Assignee:** developer
- **Goal:** per-request nonce CSP.
- **Requirements:** PH-FR-15.
- **Read first:** spec 7 (PH-FR-15), 5 (D10), PH-AC-27, 31, 32, 61, 66, 74; ADR 0014 (incl. spike outcome); `src/lib/env.ts`.
- **Do:** a pure function building the policy (nonce, `strict-dynamic`, no `unsafe-inline`/`unsafe-eval` in production, `style-src 'self' 'unsafe-inline'`, `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, `connect-src` with the Supabase origin from `publicEnv`; no `upgrade-insecure-requests`); `src/proxy.ts` generating a nonce per request and setting the header on pages; apply the `global-error` decision from the spike. The app, error pages, Tailwind, shadcn and Next scripts work under it.
- **Acceptance:** on `build` + `start`, `/`, `/design` and the three status pages load without violations (manual check; automated in T-37); gates pass.
- **Out of scope:** static headers (T-35), tests (T-36, T-37).
- **Output:** policy builder, `src/proxy.ts`. Commit scope `feat(security)`.
- **Dependencies:** PH-T-33.

### PH-T-35 Static headers and config hardening
- **Assignee:** developer
- **Goal:** the non-CSP headers and framework hardening.
- **Requirements:** PH-FR-16.
- **Read first:** spec 7 (PH-FR-16), PH-AC-27 to 30, 67, 73; ADR 0014; `next.config.ts`.
- **Do:** in `next.config.ts`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation off), `X-Frame-Options: DENY`, HSTS in production only without preload, `poweredByHeader: false`, `serverActions.bodySizeLimit: '1mb'`. No CORS headers. Document the 1 MB limit in a comment pointing to ADR 0014.
- **Acceptance:** `pnpm build` passes; headers visible on a `start` server; no CORS header present.
- **Out of scope:** tests (T-36 to T-38).
- **Output:** `next.config.ts`. Commit scope `feat(security)`.
- **Dependencies:** PH-T-33.

### PH-T-36 Tests: CSP policy and config (unit)
- **Assignee:** tester
- **Goal:** unit tests for the policy and the config.
- **Requirements:** PH-FR-15, 16.
- **Read first:** spec 8 (PH-AC-27 to 30 policy/config parts, 73, 74); the policy builder, `next.config.ts`.
- **Do:** policy contains every directive in PH-FR-15, no `unsafe-eval` and no script `unsafe-inline` in production, nonce embedded, `connect-src` contains the Supabase origin from a given `publicEnv` (74); config test: static headers, HSTS production only, no preload, `poweredByHeader` false, `serverActions.bodySizeLimit` is `1mb` and documented (73), no CORS header.
- **Acceptance:** gates pass.
- **Out of scope:** E2E (T-37, T-38).
- **Output:** test files. Commit scope `test(security)`.
- **Dependencies:** PH-T-34, PH-T-35.

### PH-T-37 E2E: CSP, headers, nonce; global violation fixture
- **Assignee:** tester
- **Goal:** prove the headers and CSP in a real browser on the production build.
- **Requirements:** PH-FR-15, 16, 02.
- **Read first:** spec 8 (PH-AC-27 to 29, 31, 32, 61, 66, 78); the base fixture from T-13.
- **Do:** make the PH-AC-78 fixture active for all E2E specs (all existing specs become CSP regression tests; only the two tests provoking violations are excepted); tests: response headers on a page (27, 28, 29); two requests carry different nonces and scripts carry them (66); `/`, `/design` and the three status pages including the global error page via `x-fault` load with no violations and usable styles (31, 61); a provoked violation is detected (32).
- **Acceptance:** `pnpm test:e2e` passes, stable across 3 runs.
- **Out of scope:** Server Action origin and size (T-38); cross-browser, ZAP, Lighthouse (parked).
- **Output:** spec files, fixture. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-36.

### PH-T-38 E2E: Server Action origin and body size
- **Assignee:** tester
- **Goal:** prove the Server Action body limit and origin check on the production build.
- **Requirements:** PH-FR-16.
- **Read first:** spec 8 (PH-AC-30, 67 and the 30/67 note); fault fixture form from T-07; the base fixture from T-13.
- **Do:** oversized fixture-form post is rejected with 413 and one just under 1 MB is accepted (30); foreign `Origin` post is rejected (67).
- **Acceptance:** `pnpm test:e2e` passes, stable across 3 runs.
- **Out of scope:** header and CSP assertions (T-37).
- **Output:** spec files. Commit scope `test(e2e)`.
- **Dependencies:** PH-T-37.

### PH-T-39 Architect check of step 3 and ADR 0014 confirmation
- **Assignee:** architect
- **Goal:** code matches ADR 0014; fallback recorded.
- **Requirements:** PH-FR-15, 16; PH-NFR-06.
- **Read first:** ADR 0014, step 3 code and tests.
- **Do:** review; record the per-request-rendering consequence, the `global-error` outcome and the static CSP fallback; amend ADR text; report findings.
- **Acceptance:** ADR 0014 consistent with code; no unresolved must-fix.
- **Out of scope:** code changes.
- **Output:** edited ADR 0014. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-37, PH-T-38.

### PH-T-40 Accept step 3
- **Assignee:** product-manager
- **Goal:** accept step 3.
- **Requirements:** PH-FR-15, 16.
- **Read first:** spec 7, 8; test results.
- **Do:** as T-22; write `acceptance/step3.md`; confirm no CORS headers and nothing extra (no rate limiting).
- **Acceptance:** criteria met or deferred with orchestrator agreement.
- **Out of scope:** fixing defects.
- **Output:** `acceptance/step3.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-39.

---

## 5. Step 4: database conventions

### PH-T-41 Spike: trigger clock and `set_updated_at` under the default-privilege revoke
- **Assignee:** developer
- **Goal:** prove the trigger works with the role setup from 001.
- **Requirements:** PH-FR-18 (de-risking).
- **Read first:** spec 12 (step 4), PH-AC-34, 69; ADR 0012; ADR 0003/related role ADRs and `supabase/migrations/` (default-privilege revoke on functions, `app_backend`).
- **Do (throwaway):** in a scratch migration, create `public.set_updated_at()` and a throwaway table with the trigger; check that `app_backend` can fire it despite the revoke on function privileges, that `now()` (transaction time) advances across separate transactions, and that `SECURITY INVOKER` with fixed `search_path` works.
- **Acceptance:** "Spike outcome" in ADR 0012 (privileges needed, clock choice). No scratch migration left.
- **Out of scope:** production migration.
- **Output:** edited ADR 0012. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-40.

### PH-T-42 Migration: `public.set_updated_at()`
- **Assignee:** developer
- **Goal:** the reusable trigger function.
- **Requirements:** PH-FR-18, 17.
- **Read first:** spec 7 (PH-FR-17, 18), PH-AC-34, 69, 36; ADR 0012 (incl. spike outcome); existing migrations and `pnpm db:schema` / drift check docs.
- **Do:** one migration creating `public.set_updated_at()` (`SECURITY INVOKER`, fixed `search_path`, sets `updated_at` on `BEFORE UPDATE`, overwriting any client value; grants as the spike found); run `supabase db reset` and refresh the Drizzle schema snapshot if the drift check requires it. No application tables.
- **Acceptance:** `supabase db reset` passes; the drift check passes; no table other than test throwaways is created.
- **Out of scope:** per-table triggers (added by each table's migration), guard rules (T-43).
- **Output:** migration, any schema artifact. Commit scope `feat(db)`.
- **Dependencies:** PH-T-41.

### PH-T-43 Convention guard rules in the schema guard
- **Assignee:** tester
- **Goal:** the schema guard enforces the conventions on every `public` table.
- **Requirements:** PH-FR-19.
- **Read first:** spec 7 (PH-FR-19), PH-AC-35, 36, 68; ADR 0012; `tests/db/schema-guard.test.ts`, `tests/utils/schema-guard.ts`, `tests/utils/throwaway-table.ts`.
- **Do:** add rules for every `public` table: `id uuid` primary key; `created_at` and `updated_at` `timestamptz not null default now()`; the `BEFORE UPDATE` trigger using `set_updated_at`; snake_case identifiers; every FK column leading an index; exceptions only through a named allowlist where each entry carries a reason; failures name table and rule. Existing tables from 001 stay valid or are allowlisted with a reason.
- **Acceptance:** `pnpm test:db` passes on the current schema; failure messages name table and rule.
- **Out of scope:** the throwaway-table tests (T-44); production code.
- **Output:** guard code. Commit scope `test(db)`.
- **Dependencies:** PH-T-42.

### PH-T-44 Tests: trigger, guard allowlist, guard-of-the-guard
- **Assignee:** tester
- **Goal:** tests for the trigger and the guard itself.
- **Requirements:** PH-FR-18, 19.
- **Read first:** spec 8 (PH-AC-34, 35, 68, 69); the guard from T-43.
- **Do:** `test:db` tests with a throwaway table: update in a separate transaction advances `updated_at`, `created_at` unchanged, client-supplied `updated_at` overwritten, no-op update does not error (34, 69); a violating throwaway table makes the guard fail naming table and rule, the same table with an allowlist entry and reason passes (68, 35); confirm `supabase db reset` and the drift check pass (36).
- **Acceptance:** `pnpm test:db` passes; throwaway tables are cleaned up.
- **Out of scope:** production code changes.
- **Output:** test files. Commit scope `test(db)`.
- **Dependencies:** PH-T-43.

### PH-T-45 Architect check of step 4 and ADR 0012 confirmation
- **Assignee:** architect
- **Goal:** ADR 0012 final.
- **Requirements:** PH-FR-17; PH-AC-33.
- **Read first:** ADR 0012, migration, guard and tests, spec 5 (D11), C1.
- **Do:** confirm ADR 0012 states each decision with its reason and lists the rules enforced by PH-AC-35; the "C1 awaits Product Owner confirmation" line was already removed when the Product Owner approved the spec on 2026-11-13 (check it is gone); report findings.
- **Acceptance:** PH-AC-33 satisfied; no unresolved must-fix.
- **Out of scope:** code changes.
- **Output:** edited ADR 0012. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-44.

### PH-T-46 Accept step 4
- **Assignee:** product-manager
- **Goal:** accept step 4.
- **Requirements:** PH-FR-17, 18, 19.
- **Read first:** spec 7, 8; test results.
- **Do:** as T-22; write `acceptance/step4.md`; confirm no application tables and no audit or soft-delete columns (C1).
- **Acceptance:** criteria met or deferred with orchestrator agreement.
- **Out of scope:** fixing defects.
- **Output:** `acceptance/step4.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-45.

---

## 6. Step 5: pagination

### PH-T-47 `listParams`
- **Assignee:** developer
- **Goal:** validated list parameters.
- **Requirements:** PH-FR-20.
- **Read first:** spec 5 (D12), 7 (PH-FR-20), PH-AC-39, 40, 75; ADR 0016; `src/lib/`.
- **Do:** `src/lib/list-params.ts`: `listParams({ sortable, filters, defaultSort, defaultPageSize: 20, maxPageSize: 100 })` returns a Zod schema parsing search params into page, page size, sort and equality filters; page and page size strictly base-10 integers (no `1e3`, `1.5`), page 1 to 10,000, size 1 to 100; unknown keys, sort fields and filter fields rejected as `validation` (via the typed errors). Pure: no database import.
- **Acceptance:** defaults page 1, size 20; each invalid input returns a validation failure; gates pass.
- **Out of scope:** `paginate` (T-48), operators beyond equality, text search, keyset.
- **Output:** `src/lib/list-params.ts`. Commit scope `feat(lib)`.
- **Dependencies:** PH-T-46.

### PH-T-48 `paginate`
- **Assignee:** developer
- **Goal:** offset pagination over a transaction.
- **Requirements:** PH-FR-21.
- **Read first:** spec 7 (PH-FR-21), PH-AC-37, 38, 41, 42, 43; ADR 0016; `src/db/index.ts`, `src/db/rls.ts`.
- **Do:** `src/db/paginate.ts` exported from `@/db`: `paginate(tx, { table, columns, params, where? })` returning `{ rows, total, page, pageSize, pageCount }`; order by requested sort then `id`; count in the same transaction so RLS applies; parameterized predicates only; page past the end or no match returns empty rows.
- **Acceptance:** gates pass; a scratch run on a throwaway table returns the shape and tiebreak order.
- **Out of scope:** tests (T-50), application tables.
- **Output:** `src/db/paginate.ts`, export. Commit scope `feat(db)`.
- **Dependencies:** PH-T-47.

### PH-T-49 Tests: `listParams`
- **Assignee:** tester
- **Goal:** unit tests for `listParams`.
- **Requirements:** PH-FR-20.
- **Read first:** spec 8 (PH-AC-39, 40, 75); `src/lib/list-params.ts`.
- **Do:** defaults; size above 100, page 0, negative, non-integer, `1e3`, `1.5`, page 10,001, unknown sort field, unknown filter field and unknown key each give `validation`, and a fake `tx` is never called; valid equality filters parse.
- **Acceptance:** gates pass.
- **Out of scope:** production code changes.
- **Output:** test file. Commit scope `test(lib)`.
- **Dependencies:** PH-T-47.

### PH-T-50 Tests: `paginate`
- **Assignee:** tester
- **Goal:** `test:db` tests for `paginate`.
- **Requirements:** PH-FR-21.
- **Read first:** spec 8 (PH-AC-37, 38, 41, 42, 43); `src/db/paginate.ts`; `tests/utils/` (throwaway tables, `withRls` harness).
- **Do:** on a throwaway table: result shape and counts (37); equal sort values in `id` order (38); RLS applies to rows and `total` (41); hostile filter/sort strings treated as data or rejected before SQL, no injection (42); page past the end and no match return empty rows, not an error (43).
- **Acceptance:** `pnpm test:db` passes.
- **Out of scope:** production code changes.
- **Output:** test file. Commit scope `test(db)`.
- **Dependencies:** PH-T-48.

### PH-T-51 Architect check of step 5 and ADR 0016 confirmation
- **Assignee:** architect
- **Goal:** ADR 0016 matches code.
- **Requirements:** PH-FR-20, 21.
- **Read first:** ADR 0016, step 5 code and tests.
- **Do:** review (equality filters only, boundaries, parameterization); amend ADR; report findings.
- **Acceptance:** ADR 0016 consistent with code; no unresolved must-fix.
- **Out of scope:** code changes.
- **Output:** edited ADR 0016. Commit scope `docs(adr)`.
- **Dependencies:** PH-T-49, PH-T-50.

### PH-T-52 Accept step 5
- **Assignee:** product-manager
- **Goal:** accept step 5.
- **Requirements:** PH-FR-20, 21.
- **Read first:** spec 7, 8; test results.
- **Do:** as T-22; write `acceptance/step5.md`.
- **Acceptance:** criteria met or deferred with orchestrator agreement.
- **Out of scope:** fixing defects.
- **Output:** `acceptance/step5.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-51.

---

## 7. Step 6: module generator, docs, acceptance

### PH-T-53 `gen:module` script
- **Assignee:** developer
- **Goal:** `pnpm gen:module <name>` creates a module folder.
- **Requirements:** PH-FR-22.
- **Read first:** spec 5 (D13), 7 (PH-FR-22), PH-AC-49 to 53; AGENTS.md (structure); `scripts/db-schema.mts` (script style), boundary lint rules.
- **Do:** `scripts/gen-module.mts` and `package.json` script `gen:module`; creates only `src/modules/<name>/index.ts` (`export {}` plus a header comment); name must match `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`; invalid or existing names stop with a message and change nothing; never overwrites. Core logic exported so tests can run it against a temp dir.
- **Acceptance:** creates the file for a valid name; invalid or existing name exits non-zero with a message and no change; `pnpm lint` and `pnpm typecheck` pass with a generated module present (then removed).
- **Out of scope:** tests (T-54), CI step (T-55), generated test files, templates.
- **Output:** script, `package.json`. Commit scope `feat(scripts)`.
- **Dependencies:** PH-T-52.

### PH-T-54 Tests: `gen:module`
- **Assignee:** tester
- **Goal:** unit tests in a temp directory.
- **Requirements:** PH-FR-22.
- **Read first:** spec 8 (PH-AC-49 to 53); `scripts/gen-module.mts`.
- **Do:** valid name creates only `index.ts` with the header (49, 50); each invalid name class (uppercase, underscore, leading digit, trailing hyphen, empty) stops with a message and changes nothing (51); existing name stops without overwriting (52); boundary lint rules apply to a generated module (a cross-module internal import from it fails lint) (53).
- **Acceptance:** gates pass; tests leave no files in `src/modules/`.
- **Out of scope:** production code changes.
- **Output:** test file. Commit scope `test(scripts)`.
- **Dependencies:** PH-T-53.

### PH-T-55 CI smoke step for `gen:module`
- **Assignee:** developer
- **Goal:** CI proves the generator output passes lint and typecheck.
- **Requirements:** PH-FR-22; PH-NFR-05.
- **Read first:** spec 7 (PH-FR-22 CI sentence), PH-AC-54; `.github/workflows/ci.yml`.
- **Do:** add a step to the `fast` job: `pnpm gen:module ci-smoke && pnpm lint && pnpm typecheck`, then remove the folder (also on failure). No new job. The Docker collector is not referenced.
- **Acceptance:** the same command sequence passes locally and leaves the tree clean; workflow YAML is valid; job names `fast`, `database-and-e2e`, `secret-scan` unchanged.
- **Out of scope:** other CI changes; pushing (CI result is checked after the orchestrator pushes, see T-59).
- **Output:** workflow edit. Commit scope `ci`.
- **Dependencies:** PH-T-54.

### PH-T-56 `docs/architecture.md` and ADR index confirmation
- **Assignee:** architect
- **Goal:** architecture docs match the built epic.
- **Requirements:** PH-FR-24; PH-AC-33, 56.
- **Read first:** spec 7 (PH-FR-24), 5 (D13, D16); `docs/architecture.md`, `docs/adr/README.md`, ADRs 0012 to 0016.
- **Do:** verify `docs/architecture.md` has C1, C6, C8, C11, C13 to C15, layout and the ADR table consistent with the code (including `gen:module`, fault routes, `src/proxy.ts`, `src/lib/*`); verify ADRs 0012-0016 are listed in `docs/adr/README.md` and their status is correct; fix text only.
- **Acceptance:** no doc statement contradicts the code or spec; ADR list complete.
- **Out of scope:** code changes, new ADRs unless a hard-to-reverse decision was found missing (then report).
- **Output:** edited docs. Commit scope `docs(architecture)`.
- **Dependencies:** PH-T-55.

### PH-T-57 README: collector commands and new scripts
- **Assignee:** developer
- **Goal:** the README documents what the epic added.
- **Requirements:** PH-FR-24; PH-FR-14.
- **Read first:** spec 7 (PH-FR-24); `README.md`; `package.json` scripts; compose README from T-27.
- **Do:** document `obs:start`/`obs:stop`, the three `OTEL_*` variables, `gen:module`, the E2E production-build note and `tests/.logs`; keep the README's onboarding steps unchanged otherwise.
- **Acceptance:** every command and variable named exists and works as written; no new feature described.
- **Out of scope:** test README (T-58).
- **Output:** `README.md`. Commit scope `docs(readme)`.
- **Dependencies:** PH-T-55.

### PH-T-58 Test README: seams, harness, ports
- **Assignee:** tester
- **Goal:** the test README records D14 and the new seams.
- **Requirements:** PH-FR-23, 24.
- **Read first:** spec 5 (D14), 8 ("E2E harness", "Test level per criterion"); `tests/utils/README.md`.
- **Do:** document fault routes and `assertFaultInjection()` with the `x-fault` header, `scripts/e2e-server.mts`, log tee location, ports (+0 to +3, receiver +10), the CSP-violation fixture, the per-AC levels table, and the manual checks.
- **Acceptance:** a new developer can run one E2E file and read its server log from the README alone.
- **Out of scope:** code changes.
- **Output:** `tests/utils/README.md`. Commit scope `docs(tests)`.
- **Dependencies:** PH-T-55.

### PH-T-59 Full gates and CI parity
- **Assignee:** tester
- **Goal:** evidence that every gate is green as CI would run it.
- **Requirements:** PH-NFR-05; PH-AC-25, 36, 54, 55, 76.
- **Read first:** spec 9 (PH-NFR-05), 8 (PH-AC-25, 36, 54, 55, 76); `.github/workflows/ci.yml`; `acceptance/`.
- **Do:** from a clean checkout state run lint, typecheck, format check, unit, `test:db`, build, E2E, the drift check, `supabase db reset` and the `gen:module` smoke sequence in the order CI uses; confirm no job needs the collector; list for each PH-AC its test or manual check in `acceptance/ac-coverage.md` (every PH-AC mapped; PH-AC-48 dropped; 24, 26, 55, 57 manual; 33, 56 review; PH-AC-76 mapped to both its unit half and its E2E half, both in T-18). Note that the real CI run is checked after the orchestrator pushes.
- **Acceptance:** every command green (or the failure reported with output); `ac-coverage.md` has no PH-AC without a test or named check, and lists PH-AC-76 unit and E2E.
- **Out of scope:** fixing defects (the orchestrator adds fix tasks).
- **Output:** `acceptance/ac-coverage.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-56, PH-T-57, PH-T-58.

### PH-T-60 Final architect read
- **Assignee:** architect
- **Goal:** final consistency read (D17).
- **Requirements:** PH-NFR-06; all PH-FR.
- **Read first:** spec, ADRs 0012-0016, `docs/architecture.md`, step reports, `ac-coverage.md`.
- **Do:** check spec vs ADRs vs code; confirm reversibility fallbacks exist (CSP, collector, conventions); list residual risks in `acceptance/architect-final.md`.
- **Acceptance:** no must-fix, or must-fix items listed for fix tasks.
- **Out of scope:** code changes.
- **Output:** `acceptance/architect-final.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-59.

### PH-T-61 Final tester read
- **Assignee:** tester
- **Goal:** final read of the test suite (D17).
- **Requirements:** all PH-AC.
- **Read first:** spec 8, 15; test files; `ac-coverage.md`.
- **Do:** check for flaky or vacuous tests (3 consecutive runs of E2E and `test:db`), tests that pass without the behavior (spot mutation on five criteria of choice), and secrets or tokens leaking into test logs; write `acceptance/tester-final.md`.
- **Acceptance:** no must-fix, or must-fix items listed.
- **Out of scope:** code changes.
- **Output:** `acceptance/tester-final.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-59.

### PH-T-62 Final acceptance
- **Assignee:** product-manager
- **Goal:** accept the epic against the approved spec.
- **Requirements:** all; PH-AC-55, 57.
- **Read first:** spec 3, 7, 8, 9, 15, 16; all `acceptance/*.md`; the traceability table below; final diff of the epic.
- **Do:** acceptance checklist over every PH-FR/NFR (met / partially / not met / deferred); check the final diff against spec section 3 (no auth, rate limiting, email, jobs, storage, feature flags, cloud config or production telemetry destination) for PH-AC-57; confirm the manual checks for PH-AC-24 and 26; confirm each blocker/important concern of the round 1 and 2 reviews is resolved or deferred; update epic status in `specs/README.md`; short retrospective note (a few bullets).
- **Acceptance:** `acceptance/final.md` written; gaps reported honestly; README index updated.
- **Out of scope:** fixing defects.
- **Output:** `acceptance/final.md`, `specs/README.md`. Commit scope `docs(specs)`.
- **Dependencies:** PH-T-60, PH-T-61.

---

## 8. Traceability matrix (requirement -> build tasks -> tests/verification)

| Requirement | Build tasks | Tests and verification |
|-------------|-------------|------------------------|
| PH-FR-01 | T-08, T-10 | T-18, T-22, T-62 |
| PH-FR-02 | T-10, T-34 | T-18, T-37, T-22, T-40 |
| PH-FR-03 | T-10 | T-18, T-22 |
| PH-FR-04 | T-08, T-09 | T-18, T-22 |
| PH-FR-05 | T-11 | T-17, T-19, T-20, T-21, T-22 |
| PH-FR-06 | T-04 | T-15, T-22 |
| PH-FR-07 | T-01, T-05 | T-15, T-22 |
| PH-FR-08 | T-12 | T-16, T-20, T-22 |
| PH-FR-09 | T-02, T-26 | T-14, T-19, T-20, T-29, T-22 |
| PH-FR-10 | T-03 | T-14, T-22 |
| PH-FR-11 | T-25 | T-28, T-29, T-32 |
| PH-FR-12 | T-23, T-25, T-26 | T-29, T-32 |
| PH-FR-13 | T-24 | T-28, T-32 |
| PH-FR-14 | T-27, T-57 | T-30, T-59 (CI non-dependence), T-32 |
| PH-FR-15 | T-33, T-34 | T-36, T-37, T-40 |
| PH-FR-16 | T-35 | T-36, T-37, T-38, T-40 |
| PH-FR-17 | T-41, T-42 | T-45 (ADR review), T-46 |
| PH-FR-18 | T-41, T-42 | T-44, T-46 |
| PH-FR-19 | T-43 | T-44, T-59, T-46 |
| PH-FR-20 | T-47 | T-49, T-52 |
| PH-FR-21 | T-48 | T-50, T-52 |
| PH-FR-22 | T-53, T-55 | T-54, T-55 (CI), T-59 |
| PH-FR-23 | T-06, T-07, T-12 | T-18 (gate unit, flag off E2E), T-37, T-58, T-59 |
| PH-FR-24 | T-09, T-21, T-31, T-39, T-45, T-51, T-56, T-57, T-58 | T-56 (review), T-59, T-62 |
| PH-NFR-01 | T-02, T-11 | T-14, T-17, T-19, T-20 |
| PH-NFR-02 | T-25 | T-28, T-29 |
| PH-NFR-03 | T-25 | T-29 |
| PH-NFR-04 | T-08, T-10 | T-18 |
| PH-NFR-05 | T-13, T-55 | T-59, T-62 |
| PH-NFR-06 | ADRs (T-21, T-31, T-39, T-45, T-51) | T-60 |

Criterion coverage: every PH-AC maps to a test or named check in `acceptance/ac-coverage.md` (T-59). Levels follow spec 8: unit tasks T-14, 15, 16, 17, 18 (fault gate, PH-AC-76 unit half), 28, 36, 49, 54; `test:db` tasks T-15, 44, 50; E2E tasks T-18, 19, 20, 29, 37, 38; process test T-28; lint test T-14; CI T-55, T-59; manual T-30, T-62; review T-45, T-56, T-62.

Every PH-FR and PH-NFR appears at least once as a build task and once as a verification or acceptance task. Every task traces to at least one requirement; T-22, 32, 40, 46, 52, 62 are acceptance tasks; T-21, 31, 39, 45, 51, 56, 60 are architect checks; T-61 is a tester read.

## 9. Critical path and parallelism

- **Critical path (sequential):** T-01 -> T-04 -> T-06 -> T-07 -> T-10 -> T-13 -> T-18/T-19/T-20 -> T-21 -> T-22 -> T-23 -> T-24 -> T-25 -> T-26 -> T-29 -> T-31 -> T-32 -> T-33 -> T-34 -> T-36 -> T-37 -> T-38 -> T-39 -> T-40 -> T-41 -> T-42 -> T-43 -> T-44 -> T-45 -> T-46 -> T-47 -> T-48 -> T-50 -> T-51 -> T-52 -> T-53 -> T-54 -> T-55 -> T-56 -> T-59 -> T-60 -> T-62. Side branch that rejoins at T-19/T-20: T-04 -> T-05 -> T-12 (T-12 also needs T-07), and T-02 -> T-11.
- **Independent (may run in parallel, default is still sequential):** T-08/T-09 with T-02 to T-07; T-35 with T-34; T-49 with T-48; T-56, T-57, T-58 with each other; T-60 with T-61. Do not run two tasks in parallel that edit the same file: T-25 and T-26 both edit `instrumentation.node.ts`, T-25 and T-27 both edit `package.json` (so T-27 is sequential after T-25), T-34 and T-35 touch different files.
- **Verification rhythm:** developer builds -> tester verifies (fresh agent) -> architect review -> product-manager accepts, per step.
- **Gate for starting:** the spec is Approved by the Product Owner, and the traceability check on spec + tasks has no open finding.

## 10. Change log

| Date | Change |
|------|--------|
| 2026-11-13 | First draft written, after spec round 2 fixes. Status Draft; not executable until the spec is approved. |
| 2026-11-13 | Traceability findings F1-F8 applied: PH-AC-76 unit test added to T-18 and listed in T-59; T-06 added to dependencies of the page and hook tasks (via the fixtures task); `flows.md` sections 4-6 added to the common read-first; trace id test and dev-only in-memory exporter added to T-14; wrong PH-AC-11 citation removed from the errors test task; old T-06 split into T-06 (seam and gate) and T-07 (fixtures), old T-18 split into T-19 (capture) and T-20 (leakage, wrapper, request id), old T-35 split into T-37 (CSP, headers, nonce) and T-38 (Server Action origin and size); collector task made sequential after the SDK bootstrap task; critical-path wording fixed. All task IDs after T-06 renumbered (59 tasks became 62); status table, dependencies, matrix, critical path and cross-references updated. Statuses unchanged: Draft / todo. |
