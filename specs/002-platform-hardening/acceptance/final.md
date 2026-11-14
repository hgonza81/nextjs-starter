# 002 - Platform hardening: final acceptance (PH-T-62)

Date: 2026-11-13. Acceptor: product-manager (fresh instance).

## Verdict

**Epic accepted, pending one external item: the real GitHub CI run (PH-AC-54).** Every requirement and criterion is met, met with a recorded relaxation, or covered by a named manual check. Nothing is "not met". Nothing was found outside the approved scope (section 2). The one open item needs the Product Owner's authorization to push (section 3).

## Evidence basis (read this first)

This instance has **no shell** and re-ran nothing. The `acceptance.md` rule (acceptor re-runs the key commands) is therefore NOT met by this document, and the evidence is marked as such:

- **Orchestrator/tester-reported (not re-run here):** lint, typecheck, format clean; unit 610 passed; `test:db` 300 passed; E2E 203 passed on every run (the tester ran 3 runs in `acceptance/tester-final.md`, the previous task ran 2); gitleaks clean on 222 commits; local gates in `acceptance/ac-coverage.md`.
- **Read by me:** spec, tasks, requirements, traceability, all files in `acceptance/`, `.github/workflows/ci.yml` (gen:module smoke step present, no collector step), file listings of `src/`, `tests/`, `docs/`, `scripts/`, `docker/`, `supabase/migrations/`, and keyword searches of `src/`.
- **Manual evidence by another agent:** collector check (PH-AC-24, 25, 26) in `acceptance/collector-manual.md`, on a real Docker collector.

## 1. Checklist

Status: Met / Met (relaxed) = met with a recorded relaxation / Partially / Not met / Deferred. "AC" files are in `acceptance/`; test titles start with the PH-AC id (full table in `ac-coverage.md`).

### Functional requirements

| ID | Status | Evidence |
|----|--------|----------|
| PH-FR-01 500 page | Met | step1.md; `tests/e2e/error-pages.spec.ts` (PH-AC-01, 02, 06, 07, 62) |
| PH-FR-02 global error | Met | step1.md, step3.md; `error-pages.spec.ts` (PH-AC-03), `security-headers-csp.spec.ts` (PH-AC-61) |
| PH-FR-03 404 page | Met | step1.md; `error-pages.spec.ts` (PH-AC-04, 62), `design-gate.spec.ts` (PH-AC-05) |
| PH-FR-04 `StatusPage` | Met | step1.md; `error-pages.spec.ts` (PH-AC-07, 77, axe light and dark; G2 closed by PH-T-69); `docs/design-system.md` 7.4 |
| PH-FR-05 server capture | Met (known limit) | step1.md; `src/instrumentation.test.ts`; `server-capture.spec.ts` (PH-AC-08, 09, 10, 58, 60). Limit: Next prints the raw error before the hook (ADR 0015) |
| PH-FR-06 typed errors | Met | step1.md; `src/lib/errors.test.ts` (PH-AC-12) |
| PH-FR-07 DB mapping | Met | step1.md; `src/lib/db-error.test.ts`, `tests/db/db-error.test.ts` (PH-AC-13, 14, 15, 63) |
| PH-FR-08 `defineAction` | Met | step1.md; `src/lib/action.test.ts` (PH-AC-44 to 47, 59, 64, 71); `leakage-and-request-id.spec.ts` (PH-AC-64) |
| PH-FR-09 logger | Met | step1.md; `src/lib/logger.test.ts` (PH-AC-16, 17, 18, 70, 72); E2E PH-AC-70 (route-handler `request_id` fixed by PH-T-63) |
| PH-FR-10 no ad hoc console | Met | step1.md; `tests/lint/no-console.test.ts` (PH-AC-19) |
| PH-FR-11 telemetry off by default | Met | step2.md; `src/instrumentation.register.test.ts`, `telemetry-export.spec.ts` (PH-AC-20) |
| PH-FR-12 telemetry export | Met | step2.md; `telemetry-export.spec.ts` (PH-AC-21, 22, 65). Metrics: pipeline wiring only, as specified |
| PH-FR-13 telemetry configuration | Met (relaxed) | step2.md; `src/lib/env.test.ts`, `telemetry-config-startup.spec.ts` (PH-AC-23). Process stays alive and answers 500 (spec change log) |
| PH-FR-14 local collector | Met (manual) | step2.md; `collector-manual.md` (PH-AC-24, 25, 26 PASS) |
| PH-FR-15 CSP | Met | step3.md; `src/lib/csp.test.ts`, `src/proxy.test.ts`, `security-headers-csp.spec.ts` (PH-AC-27, 31, 32, 61, 66, 74, 79) |
| PH-FR-16 other headers, hardening | Met (relaxed) | step3.md; `src/next-config.test.ts`, `server-action-limits.spec.ts` (PH-AC-28 to 30, 67, 73). PH-AC-30: non-2xx (500), 413 in the log, not a literal 413 |
| PH-FR-17 conventions documented | Met | step4.md; ADR 0012 |
| PH-FR-18 reusable trigger | Met | step4.md; migration `20261113120000_set_updated_at_function.sql`; `tests/db/set-updated-at.test.ts` (PH-AC-34, 69) |
| PH-FR-19 convention guard | Met (recorded limits) | step4.md; `tests/db/schema-guard.test.ts` (PH-AC-35, 68); drift check PH-AC-36 orchestrator-run; the guard runs on fixtures only until epic 003 adds tables |
| PH-FR-20 `listParams` | Met | step5.md; `src/lib/list-params.test.ts` (PH-AC-39, 40, 75), typed filters (PH-T-66, 67) |
| PH-FR-21 `paginate` | Met | step5.md; `tests/db/paginate.test.ts` (PH-AC-37, 38, 41, 42, 43) |
| PH-FR-22 `gen:module` | Met | `tests/scripts/gen-module.test.ts` (PH-AC-49 to 53, labels fixed by PH-T-69); CI step "Generator smoke test (gen:module)" in `ci.yml`; smoke run green in `ac-coverage.md` |
| PH-FR-23 test seams | Met | step1.md; `src/lib/fault-injection.test.ts`, `design-gate.spec.ts` (PH-AC-76); architect-final.md (C4 reflected) |
| PH-FR-24 docs and ADRs | Met | ADRs 0012 to 0016 Accepted and indexed; `docs/architecture.md`, `docs/design-system.md`, README updated; `step6-architecture-docs.md`; architect-final.md (PH-AC-56 by review) |

### Non-functional requirements

| ID | Status | Evidence |
|----|--------|----------|
| PH-NFR-01 no leakage | Met (known limit) | PH-AC-06, 08, 11, 18, 58 tests; sentinel absent from HTML, RSC payload, headers (`leakage-and-request-id.spec.ts`); tester-final.md section 3 (no secrets in logs or fixtures). Limit: the framework's own stderr, see section 4 |
| PH-NFR-02 zero cost when unused | Met | PH-AC-20 (SDK module never imported; no export) |
| PH-NFR-03 telemetry off the request path | Met | PH-AC-22 (20 of 20 requests 200 under 2 s against a closed port, process alive) |
| PH-NFR-04 accessibility | Met | axe light and dark on the three pages and the `/design` StatusPage section; focus and selectable code tests |
| PH-NFR-05 quality bar of 001 | Partially | Local gates green (orchestrator/tester-reported). CI jobs `fast`, `database-and-e2e`, `secret-scan` NOT yet verified on GitHub (PH-AC-54). Collector never required (grep and manual check) |
| PH-NFR-06 reversibility | Met | architect-final.md "Reversibility fallbacks" (all present); `docs/architecture.md` "Reversibility (epic 002)" |

### Original high-level requirements

| HR | Status | Via | Note |
|----|--------|-----|------|
| PH-HR-01 error pages | Met | FR-01 to 04 | Global error page is decision C2 (confirmed) |
| PH-HR-02 server capture | Met | FR-05 | Known limit in section 4 |
| PH-HR-03 typed errors | Met | FR-06, 07 | |
| PH-HR-04 structured logging | Met | FR-09, 10 | |
| PH-HR-05 OpenTelemetry | Met (relaxed) | FR-11, 12, 13 | Startup failure does not exit the process |
| PH-HR-06 local collector | Met (manual) | FR-14 | Stack decided: Grafana LGTM (D1) |
| PH-HR-07 headers and hardening | Met (relaxed) | FR-15, 16 | CSP strictness decided: nonce + `strict-dynamic` (D10, C3) |
| PH-HR-08 database conventions | Met | FR-17, 18, 19 | C1: hard delete, no audit columns |
| PH-HR-09 pagination | Met | FR-20, 21 | Offset, decided in D12 |
| PH-HR-10 action wrapper | Met | FR-08 | |
| PH-HR-11 module template | Met | FR-22 | No tests generated (D13) |
| PH-HR-12 same quality bar | Partially | FR-23, 24; NFR-05 | Real CI run pending (PH-AC-54) |

### Criteria that are not automated tests

| AC | Status | Evidence |
|----|--------|----------|
| PH-AC-24, 26 | Met (manual) | `collector-manual.md` |
| PH-AC-25 | Met | `collector-manual.md` section 5; `ci.yml` read: no collector reference |
| PH-AC-33, 56 | Met (review) | ADR 0012, ADR index, architect-final.md |
| PH-AC-36 | Met (orchestrator-run) | `db:reset`, `db:schema`, empty diff; the CI run itself is part of PH-AC-54 |
| PH-AC-54 | **Open** | Needs a push; see section 3 |
| PH-AC-55 | Met | This file plus `ac-coverage.md` (every PH-AC mapped; PH-AC-48 dropped by spec) |
| PH-AC-57 | Met (by reading, no shell) | Section 2 |

## 2. Scope check (PH-AC-57)

Method: compared the file inventory of `src/`, `tests/`, `docs/`, `scripts/`, `docker/`, `supabase/migrations/` and `.github/` and keyword searches of `src/` against spec section 3 (Out of scope) and `requirements.md`. I could not run `git diff --stat 0e4b432..HEAD` (no shell; that commit hash is not recorded in any spec file), so the check is by inventory and the step acceptance files, not by a line-level diff. The orchestrator can confirm it with `git diff --stat 0e4b432..HEAD`.

**Out-of-scope items: none found.**

| Out of scope item | Result |
|-------------------|--------|
| Auth, users, tenants, memberships | None. No `src/modules` folder (the generator smoke test removes its folder); one migration only, `set_updated_at`; no application tables |
| Rate limiting, email, jobs, storage, feature flags | No match in `src/` (search for rate limit, mail, queue, bucket, sentry). `DESIGN_PAGE_ENABLED` is the epic 001 design gate, not a feature flag system |
| Cloud Supabase, pooler, CD migrations, preview environments | `ci.yml` only gains the generator smoke step; no deploy job |
| Production telemetry destination | None. `OTEL_*` variables only; collector is local, 127.0.0.1, not referenced by CI |
| CodeQL, license scanning, SEO, date/currency utilities | None |
| Table and Dialog components, shared error renderer, Copy button | None |
| Database spans, custom metrics, keyset pagination, filter operators, soft delete, audit columns, placeholder tests from `gen:module` | None (step 5 and architect-final.md confirm) |

**Additions beyond the literal requirement text, each recorded:**

| Addition | Where recorded |
|----------|----------------|
| `StatusPage` `isEmbedded` and `titleRef` props | step1.md scope check; ADR 0015 |
| `requireRow` helper (needed for "no row where one is required") | step1.md; ADR 0015 |
| `x-vercel-id` as second request id header | step1.md; ADR 0013 and 0015 |
| Fault route fixtures and `assertFaultInjection()` in the production artifact | Decision C4 (confirmed), PH-FR-23 |
| `parseListParams` helper | step5.md; ADR 0016 (thin wrapper, not named in PH-FR-20) |
| Typed filter values in `listParams` (record form) | Spec change log 2026-11-13 (PH-FR-20 extended by orchestrator decision, PO delegated technical decisions); tasks PH-T-66, 67 |
| Reserved filter keys, strict-object rules in `listParams` | step5.md; ADR 0016 |
| Shared `fieldErrorsFromZod` helper | Fix task PH-T-65 (architect F1) |
| `/design/frames/*` `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN` exception | Spec change log (spike PH-T-33), PH-FR-15, 16, PH-AC-79; ADR 0014 |
| `src/lib/zod-jitless.ts` and root layout `connection()` | PH-FR-15; ADR 0014; C3 |
| `@opentelemetry/sdk-trace` devDependency and `tests/utils/otel-test-tracer.ts` | Spec section 10; ADR 0013 |
| OTLP test receiver, E2E server wrapper, `tests/.logs/` | Spec section 8 "E2E harness" (D14) |
| CI step "Generator smoke test (gen:module)" | PH-FR-22 |
| Fix tasks PH-T-63 (`request_id` on route-handler failures), 64 (startup test), 65, 66, 67, 68 (`gen:module` header folders match C1), 69 (labels, gaps G1 to G3) | `tasks.md`; PH-T-63, 64, 66 also in the spec change log. PH-T-65, 67, 68, 69 are refactor, test and wording fixes with no behavior change; the spec change log has no row for them (see "Found while accepting") |
| Spec relaxations: PH-AC-23, 30, 32, 78 wording | Spec change log |

None of these adds a user-visible feature or breaks section 3.

## 3. Final results and the one open item

| Check | Result | Source |
|-------|--------|--------|
| `pnpm lint`, `typecheck`, `format:check` | Clean | Orchestrator-reported |
| `pnpm test` (unit) | 610 passed | Orchestrator-reported |
| `pnpm test:db` | 300 passed, 3 runs | Orchestrator-reported; tester-final.md |
| `pnpm test:e2e` | 203 passed on every run (3 tester runs, 2 by the previous task) | Tester-reported |
| `pnpm build`, `db:reset`, `db:schema` drift check, gen:module smoke | Green | `ac-coverage.md` (PH-T-59) |
| gitleaks | 222 commits, no leaks | Tester-reported |
| **GitHub CI run for the final commit** | **NOT verified** | Needs the Product Owner's authorization to push (PH-AC-54) |

Note from tester-final.md: the three `test:db` runs overlapped in time with the three E2E runs. The E2E suite uses no database, and every run was green, so I accept it. Re-run in isolation only if the Product Owner wants that literal guarantee. `pnpm audit` (informational CI job) was not run.

**Decision for the Product Owner:** authorize `git push` so the orchestrator can check `fast`, `database-and-e2e` and `secret-scan`. If a job fails, a fix task is added after the push (AGENTS.md). Until then the epic is "Done pending push and CI verification".

## 4. Known limits and relaxations the Product Owner should know

Relaxations of the approved criteria (all recorded in the spec change log):

1. **PH-AC-23.** A bad `OTEL_*` value does not stop the process on Next.js 16.4.6. The variable is named, the value is not printed, and every request answers 500. Deployment health checks must call `/api/health` and must not rely on a crash. Same behavior as the epic 001 variables.
2. **PH-AC-30.** An oversized Server Action (over 1 MB) is rejected and the action does not run, but the response is 500 (not a literal 413). The log shows `statusCode: 413`. The test reads Next's raw console line, which can break if Next changes its log format (it fails loudly). The key is under `experimental` in Next 16.4.6.
3. **PH-AC-32.** Under `strict-dynamic`, a script inserted by already-running trusted code is allowed by design. The policy blocks parser-inserted scripts and inline handlers. Rule for code: never build script elements from user input.
4. **PH-AC-78.** Five tests opt out of the CSP-violation fixture on purpose (three for PH-AC-32, two blocked-framing cases).

Product and security limits:

5. **Framework raw-error output.** Next prints the thrown error (message, stack) to the server log before `onRequestError`. It never reaches the client, but an unwrapped database failure could put SQL in the platform log. PH-NFR-01 holds for pages, responses, headers and the app's own log entries, not for the framework's own stderr. Mitigation is a review rule (database access through `defineAction`, route handlers use `logger.exception`). Recorded in ADR 0015; step 1 asked the Product Owner to accept it, so please confirm.
6. **Every page renders per request** (C3, nonce CSP): no static optimization and no CDN page cache.
7. **Fault routes ship in the production build** behind `DESIGN_PAGE_ENABLED` (C4). The flag must stay off in every real deployment; if it is on, anyone can make the root layout throw with an `x-fault` header (availability only, no database access).
8. **`/api/*` carries no CSP** (static headers still apply). A future route returning HTML or SVG needs its own CSP.
9. **`style-src 'unsafe-inline'`** (needed by Radix and Sonner). Script protection is the nonce.
10. **Origin-less Server Action POST is accepted by Next.** Epic 003 must keep the session cookie `SameSite=Lax` or stricter.
11. **Telemetry:** no flush of the last batch on SIGTERM; `OTEL_LOG_LEVEL` can make the SDK print the destination URL; per-signal and undeclared `OTEL_*` variables are not validated; metrics are wired but not asserted; `sdk-node` is a 0.x release, exact-pinned.
12. **Database guard:** plural table names and `<singular>_id` FK names are not checked; `ON DELETE` rule means "not NO ACTION" (write `RESTRICT` deliberately); an allowlist entry exempts the whole rule for that table; the `set-updated-at-trigger` rule still accepts `UPDATE OF <cols>`, `WHEN` clauses and disabled triggers; the guard only runs on fixtures until epic 003 adds tables; the Drizzle pull omits triggers.
13. **Pagination:** counts are READ COMMITTED-approximate; `pageCount` is 0 when nothing matches; an untyped filter on a uuid or enum column gives `unexpected` (22P02 is deliberately not mapped), so lists over non-text columns must use the record form of `filters`; `columns` must include `id`.
14. **Errors in Client Components** have no digest, do not reach the hook, and the page omits the reference code.
15. **`/design/frames` exact path** sends `X-Frame-Options: SAMEORIGIN` with `frame-ancestors 'none'` (404 page, dev and CI only, fails closed).
16. **Zod `jitless`** first-import convention has no lint rule; a miss shows only as a CSP console error caught by E2E on pages E2E visits.
17. **CI Supabase stack** excludes `gotrue`; the drift check is vacuous with zero tables.

## 5. Inherited by epic 003

The full list (18 items) is in `specs/003-auth-memberships/notes-from-002.md`. Highlights: allowlist entries and the `updated_at` decision for `profiles` and `memberships` (a Product Owner question for the 003 review); FK `ON DELETE` and indexes; add the `tenant_id` guard rule; remove the `gotrue` exclusion in CI; add `defineAuthedAction`; compose session refresh with the CSP in `src/proxy.ts`; keep `SameSite=Lax`; start OAuth from a Server Action or route redirect; keep sign-up and login messages generic despite `23505` mapping to `conflict`; decide rate limiting (`proxy.ts` or the wrapper); choose the Supabase client factory location; import `@/lib/zod-jitless` first in client forms; confirm sibling subdomains serve HTTPS (HSTS `includeSubDomains`); keep `DESIGN_PAGE_ENABLED` off in deployments; use typed filters for uuid and enum list columns.

## 6. Parked, optional follow-ups

Also copied to `backlog.md` in this folder. None is needed for acceptance.

| Item | Source | When |
|------|--------|------|
| Flush telemetry on SIGTERM (`sdk.shutdown()`, FIX-B) | step2.md G2, architect-final.md | First production deployment |
| Harden the `set-updated-at-trigger` rule (FIX-A) | step4.md, architect-final.md | With the epic 003 migration that adds the first real trigger |
| Align the exact `/design/frames` path (F-1) | step3.md, architect-final.md | Optional, low |
| Maximum length of the `gen:module` name | Raised during the epic | Optional |
| Filter operators beyond equality, keyset pagination, text search | Spec section 3 | Per list, when a module needs them |
| Validate per-signal `OTEL_*` variables and `OTEL_SDK_DISABLED` | step2.md G4 | First production deployment |
| Lint rule or review checklist for `"use server"` files and for the `zod-jitless` first import | architect-final.md R1, R10 | Epic 003 |
| Stronger test assertions: `action.test.ts` redirect pass-through (N1), HSTS `toContain("max-age=")` in E2E (N2) | tester-final.md | Next edit of those files |
| Guard against a foreign-table column in `paginate` `columns` | step5.md limit 5 | Epic 003, with the first list |

## 7. Found while accepting

- `spec.md` PH-FR-19 lists the guard rules without the "explicit ON DELETE" rule that ADR 0012 and the code enforce, and PH-FR-20 does not mention reserved keys, `parseListParams` or typed filters beyond the change log row. Both are consistent in intent and recorded in ADRs; I left the requirement text unchanged (no scope change) and added a change log row.
- `specs/README.md` folder convention names `acceptance.md`; this epic used `acceptance/final.md` as the task specified, with per-step files from the earlier tasks. The README says "no per-step acceptance documents"; this epic's per-step files were requested by `tasks.md` (T-22, 32, 40, 46, 52). See the retrospective.

## 8. Retrospective (a few bullets)

What worked:
- Spikes first (PH-T-01, 23, 33, 41) paid off: they found the `cause` shape, the `/design/frames` framing exception, `global-error` nonce behavior, and the 413 behavior before any build, and changed the spec cheaply.
- E2E on a production build with the server log tee'd to a file made "one reference code, one log entry" testable, and caught the route-handler `request_id` defect (PH-T-63).
- The traceability check before approval found real gaps (PH-AC-76 unit half, missing dependencies, self-containment) at the cheapest moment.
- Fresh-agent-per-task with files as hand-off kept each task small; the final architect and tester reads found no must-fix and fixed wording directly.

What to change in `specs/README.md`:
- **Shell access.** Agents without a shell cannot commit or re-run gates (every product-manager acceptance in this epic was by reading). State in the workflow that acceptance tasks and any task that must commit need a shell, or that the orchestrator runs gates and commits for shell-less agents.
- **Empty reports.** Fresh-agent replies sometimes arrived empty and the orchestrator had to verify by git state. Add a rule: a task is verified by files and git state, never by the reply, and the task's output files are listed so this check is mechanical.
- **Per-step acceptance.** The README says no per-step acceptance documents, but the tasks asked for five. Either drop the step acceptances for non-security steps, or allow them when an epic has more than about 40 tasks.
- **Spec change log discipline.** Fix tasks 65, 67, 68, 69 were not logged in the spec change log, although the README requires it. Make it a checklist item when adding a fix task.
- **Record the base commit** of an epic in `tasks.md` so the final scope check can be one `git diff --stat` command.
- **Test levels** fixed per criterion in the spec (spec section 8) made test tasks unambiguous; keep this for epics with many criteria.
