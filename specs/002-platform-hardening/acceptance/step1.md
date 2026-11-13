# Step 1 acceptance (PH-T-22)

Date: 2026-11-13. Reviewer: product-manager (fresh instance). Scope: PH-T-01 to PH-T-21 and fix task PH-T-63 against spec sections 7, 8, 15.

## Method and what was not re-verified
- Read the code and tests listed below. This instance has **no shell**, so it did not re-run any gate.
- **Orchestrator-reported (not re-verified here):** `pnpm lint`, `pnpm typecheck`, unit 399 passing, E2E 158 passing, `test:db` passing, run just before this task.
- Evidence format: file and test title prefix (every test title starts with its PH-AC id).

## Verdict
**Step 1 accepted**, with two items deferred to later steps (PH-AC-61, PH-FR-24 docs half) and three documented gaps that need no fix task but need the Product Owner to know (G1 to G3). No requirement is "not met".

## Requirements

| Req | Status | Evidence |
|-----|--------|----------|
| PH-FR-01 500 page | Met | `src/app/error.tsx` on `StatusPage`; `tests/e2e/error-pages.spec.ts` "PH-AC-01, PH-AC-62" (HTTP 500, code, Try again, home link), "PH-AC-02" (retry recovers / persists, h1 focused), "PH-AC-01, PH-AC-06" (no message, stack, path in text and HTML). Code omitted without digest is covered by the 404 test and the `/design` samples (PH-AC-77). |
| PH-FR-02 global error | Met (CSP half deferred) | `src/app/global-error.tsx`; "PH-AC-03" x2 (root layout fault via `x-fault`, status 500, plain `href="/"` link works). Production-CSP check is PH-AC-61, step 3. |
| PH-FR-03 404 page | Met | `src/app/not-found.tsx`; "PH-AC-04, PH-AC-62" (unknown URL 404, no reference code), "PH-AC-04" (`notFound()`), `design-gate.spec.ts` "PH-AC-05" (gated `/design` shows same page, no code). |
| PH-FR-04 `StatusPage` | Met | `src/components/layout/status-page.tsx` (no `next/link`, no hooks, `isEmbedded` variant); `docs/design-system.md` 7.4; "PH-AC-77" lists it on `/design` (light and dark), axe tests "PH-AC-07" in both modes for all three pages. |
| PH-FR-05 server capture | Met (known limit G1) | `src/instrumentation.ts` `onRequestError` (only routePath, routeType, method, error class, digest, db code, request id; never throws); `src/instrumentation.test.ts` PH-AC-58/11/60; E2E `server-capture.spec.ts` PH-AC-08 (per-test token absent from HTML, RSC, log), PH-AC-58, PH-AC-60 (x2), PH-AC-10, PH-AC-09; `leakage-and-request-id.spec.ts` PH-AC-11. |
| PH-FR-06 typed errors | Met | `src/lib/errors.ts` (five types, `Result`, `ActionError`, no `server-only`); `src/lib/errors.test.ts` PH-AC-12. |
| PH-FR-07 db mapping | Met | `src/lib/db-error.ts` (`fromDbError`, cause chain, `requireRow`); `src/lib/db-error.test.ts` PH-AC-13/14/15/63; `tests/db/db-error.test.ts` PH-AC-13/14/15/63 with real database error shapes (orchestrator-reported passing). |
| PH-FR-08 `defineAction` | Met | `src/lib/action.ts` (parse, handler, `unstable_rethrow`, AppError, db map, unexpected with 8-hex `ref`; logs only in wrapper); `src/lib/action.test.ts` PH-AC-44/45/46/47/59/64/71; E2E `leakage-and-request-id.spec.ts` PH-AC-64 x3. |
| PH-FR-09 logger | Met | `src/lib/logger.ts` (JSON line, typed primitives, deny-list redaction, 200-char truncation, error reduced to name/code/digest, trace ids from active span, request id read not generated, never rejects); `src/lib/logger.test.ts` PH-AC-16/17/18/70/72; E2E PH-AC-70 x4. |
| PH-FR-10 no ad hoc console | Met | `eslint.config.mjs` (`no-console: error`, logger file exempt); `tests/lint/no-console.test.ts` PH-AC-19; `src/app/api/health/db/route.ts` uses `logger.exception`. Remaining `console.*` are in `scripts/` only, outside `src/**`. |
| PH-FR-23 test seams | Met | `src/lib/fault-injection.ts` (`assertFaultInjection`, pure gate), called from `src/app/layout.tsx`; fixtures under `src/app/design/errors/**` (page-throw, retry, not-found-page, route-throw, form, actions); `src/lib/fault-injection.test.ts` PH-AC-76 x6; `design-gate.spec.ts` PH-AC-76 x2 on the flag-off server. |
| PH-FR-24 docs (partial) | Deferred | ADRs 0013 and 0015 exist and were reviewed by the architect (PH-T-21); `design-system.md` 7.4 done. ADR index, `architecture.md` full update and README are step 6 (PH-T-57 and neighbours). |

## Acceptance criteria not individually listed above
| AC | Status | Note |
|----|--------|------|
| PH-AC-06 | Met | error-pages.spec "PH-AC-01, PH-AC-06". |
| PH-AC-09, 10 | Met | server-capture.spec (relaxed and replaced wording from spec section 8 followed). |
| PH-AC-61 | Deferred to step 3 | Needs the production CSP (PH-T-34, PH-T-37). |
| PH-AC-62 | Met | 500 on throwing page, 404 on unknown and gated routes (streamed failures not asserted, per spec). |
| PH-AC-72 | Met at unit level | `logger.test.ts` (throwing sink, rejecting id source, unserializable field). No E2E showing the error page still renders when the sink throws; spec section 8 does not require it. |
| PH-AC-78 | Fixture present, inert | `tests/e2e/helpers/fixtures.ts` installs the listener and fails on violations; it is meaningful only once step 3 adds the CSP. |
| PH-NFR-01 (step 1 part) | Met | Sentinel and no-leak assertions in PH-AC-08, 11, 58 tests. |
| PH-NFR-04 | Met | axe light and dark on 500, global error, 404; focus and selectable code tests. |

## Scope check (PH-AC-57, step 1 part)
Nothing from spec section 3 "Out of scope" (auth, rate limiting, email, jobs, storage, flags, cloud config, telemetry destination) was found in the step 1 code. Developer-chosen additions are within requirements and recorded in ADR 0015: event names, `requireRow` (needed for "no row where one is required"), `x-vercel-id` as a second request-id header, `StatusPage` `isEmbedded`/`titleRef`. No unrequested feature found.

## Gaps and notes
- **G1 Framework raw-error output (documented limit, ADR 0015 Consequences).** Next prints the thrown error (message, stack) to the server log before `onRequestError` runs; the app cannot silence it. It never reaches the client (tested), but a DrizzleQueryError from an unwrapped path would put SQL and parameters in the platform log. Mitigation is a rule (DB access through `defineAction`; route handlers catch and use `logger.exception`; no personal data in messages). Consequence for PH-NFR-01: it holds for pages, responses, headers and the app's own log entries, not for the framework's own stderr. **Decision needed from the Product Owner:** accept this limit (recommended, as the architect proposes), and agree to one README sentence in step 6.
- **G2 N1 stale comment.** `src/lib/errors.ts` line 10 still says `FieldErrors` is "the shape produced by `z.flattenError(...).fieldErrors`", but `defineAction` groups by first path segment with `_form` for form-level issues. Comment-only; recommend a tiny developer fix task or folding into the next commit touching the file. Not blocking. Related: N4 (`_form` has no shared helper; fine until epic 003 forms).
- **G3 Root layout and `connection()` (documentation inconsistency, found in this check).** The architect reply says "the root layout forces dynamic rendering with `connection()`", and ADR 0015 spike item 4 records the 500 check under `connection()`. The actual `src/app/layout.tsx` does not call `connection()`; with the flag off `assertFaultInjection()` returns before reading headers. Tests pass (status 500 on the dynamic fixtures), and every logger caller is dynamic, so no defect. But the ADR rationale ("do not log from prerenderable code") should be checked by the architect at step 3 when the nonce CSP forces per-request rendering anyway (spec C3). No task proposed now.
- **N2 (from the architect)**: fault fixtures ship in the production artifact behind `DESIGN_PAGE_ENABLED` (spec C4, approved); README in step 6 must say to keep the flag off in real deployments.
- **Cannot re-verify here:** all gate results (lint, typecheck, unit, E2E, `test:db`); E2E tests I read but did not run.

## Decisions requested
1. Accept G1 as a documented limit (yes/no).
2. N1 comment fix: separate small task, or fold into a later commit (recommend fold).

Everything else is met or deferred to the stated step.
