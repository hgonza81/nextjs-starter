# PH-AC coverage and gate evidence (PH-T-59)

Epic 002-platform-hardening. Date: 2026-11-13. Tester: fresh instance. Tree: `main`, clean at start and at end. Docker and local Supabase were running (already started).

## Gate results (from the current tree, in the order CI uses)

| Command | Result |
|---------|--------|
| `pnpm install --frozen-lockfile` | OK, lockfile up to date |
| `pnpm lint` | OK, exit 0 |
| `pnpm typecheck` | OK, exit 0 |
| `pnpm format:check` | OK, exit 0 |
| `pnpm test` | 29 files, 609 tests passed |
| `pnpm build` | OK, exit 0 |
| `pnpm db:reset` | OK |
| `pnpm db:schema` then `git diff --exit-code src/db` | OK, no drift (PH-AC-36) |
| `pnpm test:db` | 10 files, 300 tests passed |
| `pnpm test:e2e` (once, `CI=1` like CI) | 200 passed (54.0 s) |
| gen:module smoke (`pnpm gen:module ci-smoke && pnpm lint && pnpm typecheck`, then folder removed) | OK; `src/modules` did not exist before and does not exist after |
| `gitleaks git --config .gitleaks.toml --no-banner` | 222 commits scanned, no leaks found |
| Collector grep (`docker/observability`, `obs:`, `collector`) in `.github/`, `playwright.config.ts`, `vitest.config.mts`, `tests/e2e/global-setup.ts` | No reference (the only `obs:` hit is `jobs:` in ci.yml, a false positive). The collector is never required (PH-AC-25, PH-NFR-05). |

Notes: `DATABASE_MIGRATION_URL` was set to the `.env.example` value for `db:schema`, as in CI. The E2E server logs print expected error lines (fault fixtures); they are not failures. `pnpm audit` (informational CI job) was not run. The real CI run (`fast`, `database-and-e2e`, `secret-scan`, PH-AC-54) is checked after the orchestrator pushes; it is NOT verified here.

## Gaps and findings (reported, not fixed)

- **G1 (traceability labels, gen:module).** In `tests/scripts/gen-module.test.ts` the PH-AC ids are shifted against spec section 8 / flows: the test labelled PH-AC-50 checks "no sample business feature" (spec PH-AC-53); the "existing module is never overwritten" block is labelled PH-AC-52 (spec: 51); the "invalid name" blocks are labelled PH-AC-51 (spec: 52); the lint/typecheck block is labelled PH-AC-53 (spec: 49 lint and typecheck, 50 boundaries). Behavior is covered, only the labels are wrong. PH-AC-50 (deep import into a generated module reported by lint) has no test of that exact form: it relies on the generic boundary rule tests in `tests/lint/boundaries.test.ts`. Recommend a fix task to relabel and optionally add one deep-import case against a generated module.
- **G2 (PH-AC-77).** The `StatusPage` showcase test does not itself run axe; light and dark axe on `/design` comes from `design-a11y.spec.ts` (epic 001 titles). Covered indirectly, no PH id in that title.
- **G3 (PH-AC-78).** No test proves the base fixture fails a test on a violation (the negative tests prove the browser records violations, and every other test would fail on one). Accepted as a test-mechanism criterion; flagged for the architect read.
- **G4 (PH-AC-54, 57).** Open by nature: PH-AC-54 needs the real CI run after push; PH-AC-57 needs the final-diff scope check at epic acceptance (only step 1 has a recorded scope check).
- No PH-AC is without a test or named check. No failing command.

## Coverage table

Levels: unit (Vitest `pnpm test`), test:db (`pnpm test:db`), E2E (Playwright on the production build), process test, lint test, CI gate, manual, review. Test titles start with the PH-AC id unless noted. FLAG column marks the relaxed or clarified criteria.

| PH-AC | Level | Test file and title, or named check | Flag |
|-------|-------|--------------------------------------|------|
| PH-AC-01 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-01, PH-AC-62: a page that throws before streaming answers HTTP 500 and shows the friendly page with a reference code |  |
| PH-AC-02 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-02: Try again recovers when the cause is gone (and the persisting-cause case in the same group, 2 tests) |  |
| PH-AC-03 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-03, PH-FR-23: a root layout failure shows the global error page with a reference code |  |
| PH-AC-04 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-04, PH-AC-62: an unknown URL answers HTTP 404 and shows the page without a reference code |  |
| PH-AC-05 | E2E | `tests/e2e/design-gate.spec.ts`: PH-AC-05: a gated route shows the 404 page without a reference code |  |
| PH-AC-06 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-01, PH-AC-06: the page and the response HTML show no message, stack or path; also `tests/e2e/leakage-and-request-id.spec.ts` (sentinel secret) |  |
| PH-AC-07 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-07, PH-NFR-04: heading focused on mount and Tab order; reference code selectable; axe in light and dark for the 500 and global error pages (5 tests) |  |
| PH-AC-08 | E2E | `tests/e2e/server-capture.spec.ts`: PH-AC-08: the code on the 500 page equals the code in exactly one log entry, and the token is in neither the entry nor the HTML (2 tests) |  |
| PH-AC-09 | E2E | `tests/e2e/server-capture.spec.ts`: PH-AC-09: an unwrapped action that throws logs exactly one hook entry and the caller gets a generic error |  |
| PH-AC-10 | E2E | `tests/e2e/server-capture.spec.ts`: PH-AC-10: a throwing route handler answers 500 with no internals and logs exactly one entry |  |
| PH-AC-11 | unit + E2E | `src/instrumentation.test.ts` (PH-AC-11, 3 tests); `tests/e2e/leakage-and-request-id.spec.ts`: PH-AC-11: a failing page returns no message, stack, path or env name in HTML, RSC payload or headers (5 tests) |  |
| PH-AC-12 | unit | `src/lib/errors.test.ts`: PH-AC-12: creating a %s error keeps its type and a user-safe message (6 tests) |  |
| PH-AC-13 | unit + test:db | `src/lib/db-error.test.ts`: PH-AC-13: 23505 (unique violation) maps to conflict; `tests/db/db-error.test.ts`: PH-AC-13: a unique violation maps to conflict |  |
| PH-AC-14 | unit + test:db | `src/lib/db-error.test.ts`: PH-AC-14: 42501 maps to forbidden; `tests/db/db-error.test.ts`: PH-AC-14: a row-level security WITH CHECK violation maps to forbidden |  |
| PH-AC-15 | unit + test:db | `src/lib/db-error.test.ts`: PH-AC-15: 57014 (query canceled) maps to unexpected (and others); `tests/db/db-error.test.ts`: PH-AC-15: a syntax error maps to unexpected without any database text |  |
| PH-AC-16 | unit | `src/lib/logger.test.ts`: PH-AC-16: writes exactly one parseable JSON line per call with ts, level and event (trace id: `tests/utils/otel-test-tracer.ts`) |  |
| PH-AC-17 | unit | `src/lib/logger.test.ts`: PH-AC-17: outside a request writes valid JSON without ids and does not throw (e.g. turns a non-finite number into null; 9 mentions) |  |
| PH-AC-18 | unit | `src/lib/logger.test.ts`: PH-AC-18: forbidden fields absent; records error_name, error_code and digest only |  |
| PH-AC-19 | lint test | `tests/lint/no-console.test.ts`: PH-AC-19: reports console.* in %s; exempts src/lib/logger.ts |  |
| PH-AC-20 | unit + E2E | `src/instrumentation.register.test.ts`: PH-AC-20: with the endpoint unset, the SDK module is never imported; `tests/e2e/telemetry-export.spec.ts`: PH-AC-20: nothing is exported and the log entry goes to the console |  |
| PH-AC-21 | E2E | `tests/e2e/telemetry-export.spec.ts`: PH-AC-21, PH-AC-65: the receiver gets trace and log requests carrying the configured service name |  |
| PH-AC-22 | unit + E2E | `src/instrumentation.register.test.ts`: PH-AC-22: starting the real SDK against a closed port does not throw or reject; `tests/e2e/telemetry-export.spec.ts`: PH-AC-22: 20 sequential requests all return 200 in under 2 s and the process stays alive | Measurable form per spec (warm-up excluded). |
| PH-AC-23 | unit + process test | `src/lib/env.test.ts`: PH-AC-23 (schema: names OTEL_EXPORTER_OTLP_ENDPOINT, _PROTOCOL, OTEL_SERVICE_NAME; 6 tests); `tests/e2e/telemetry-config-startup.spec.ts`: PH-AC-23: startup reports a bad ${name} by name and never prints the value (spawns `next start`) | RELAXED: process stays alive and answers HTTP 500 instead of exiting (change log 2026-11-13). |
| PH-AC-24 | manual | `acceptance/collector-manual.md` (PASS, sections 1 to 3) |  |
| PH-AC-25 | manual + CI gate | `acceptance/collector-manual.md` section 5 (PASS); this task: lint, typecheck, test, build all green with no collector running; no workflow, Playwright or Vitest config references the collector (grep, see Gate results) |  |
| PH-AC-26 | manual | `acceptance/collector-manual.md` section 4 (PASS, `pnpm obs:stop`) |  |
| PH-AC-27 | unit + E2E | `src/lib/csp.test.ts` (PH-AC-27, 5), `src/proxy.test.ts` (PH-AC-27, 3), `src/next-config.test.ts`; `tests/e2e/security-headers-csp.spec.ts`: PH-AC-27, PH-AC-28: the ${name} carries the security headers and no X-Powered-By |  |
| PH-AC-28 | unit + E2E | `src/next-config.test.ts`: PH-AC-28: %s gets the static security headers; `tests/e2e/security-headers-csp.spec.ts`: PH-AC-27, PH-AC-28 (same test) |  |
| PH-AC-29 | unit + E2E | `src/next-config.test.ts`: PH-AC-29: HSTS is sent in production without preload (2 tests); `tests/e2e/security-headers-csp.spec.ts`: PH-AC-29: a request to ${path} with a foreign Origin gets no Access-Control-* header |  |
| PH-AC-30 | E2E | `tests/e2e/server-action-limits.spec.ts`: PH-AC-30: a Server Action body just under 1 MB is accepted; PH-AC-30: a body over 1 MB is rejected with a non-2xx response before the action runs, and the log shows statusCode 413 without leaking the payload (plus config half in PH-AC-73) | RELAXED: not a literal HTTP 413 (Next returns 500; 413 in the log). |
| PH-AC-31 | E2E | `tests/e2e/security-headers-csp.spec.ts`: PH-AC-31: the home page loads with its styles applied; PH-AC-31: /design loads, hydrates and shows a toast; PH-AC-31, PH-AC-79: the /design live form ... |  |
| PH-AC-32 | E2E | `tests/e2e/security-headers-csp.spec.ts`: PH-AC-32: a parser-inserted script from an unlisted origin is blocked and never requested; a parser-inserted inline script without a nonce is blocked; an inline event handler injected as markup is blocked | CLARIFIED (change log): parser-inserted scripts, not scripts inserted by running code (strict-dynamic). |
| PH-AC-33 | review | `acceptance/step4.md` and `acceptance/step4-architect.md` (ADR 0012 states each decision with its reason and lists the rules of PH-AC-35); `docs/adr/0012-database-conventions.md` |  |
| PH-AC-34 | test:db | `tests/db/set-updated-at.test.ts`: PH-AC-34: an update in a separate transaction advances updated_at and leaves created_at (4 tests) |  |
| PH-AC-35 | test:db | `tests/db/schema-guard.test.ts`: PH-AC-35: every public table follows the conventions (or is allowlisted with a reason); one test per rule naming table and rule (23 mentions) |  |
| PH-AC-36 | CI gate | This task: `pnpm db:reset`, `pnpm db:schema` and `git diff --exit-code src/db` all green (see Gate results); CI job `database-and-e2e` step Schema drift check (real run checked after push) |  |
| PH-AC-37 | test:db | `tests/db/paginate.test.ts`: PH-AC-37: page 2 of 25 rows with size 10 returns rows 11 to 20 and the counts (7 mentions) |  |
| PH-AC-38 | test:db | `tests/db/paginate.test.ts`: PH-AC-38: 25 rows sharing one sort value page in id order with no repeat and no skip |  |
| PH-AC-39 | unit | `src/lib/list-params.test.ts`: PH-AC-39: defaults page 1 size 20; validation fails before the query callback could run |  |
| PH-AC-40 | unit | `src/lib/list-params.test.ts`: PH-AC-40: rejects an unknown key as a form-level error (size above 100, page 0, negative, unknown sort/filter; 18 mentions) |  |
| PH-AC-41 | test:db | `tests/db/paginate.test.ts`: PH-AC-41: a page beyond the last returns empty rows with the real total |  |
| PH-AC-42 | test:db | `tests/db/paginate.test.ts`: PH-AC-42: two users each see only their own rows and their own total |  |
| PH-AC-43 | test:db | `tests/db/paginate.test.ts`: PH-AC-43: a SQL-looking filter value is matched as data and the table survives |  |
| PH-AC-44 | unit | `src/lib/action.test.ts`: PH-AC-44: does not run the handler and returns validation with field errors |  |
| PH-AC-45 | unit | `src/lib/action.test.ts`: PH-AC-45: returns ok with the handler data and parsed input |  |
| PH-AC-46 | unit | `src/lib/action.test.ts`: PH-AC-46: returns the matching typed result (e.g. keeps fieldErrors of a thrown validation AppError) |  |
| PH-AC-47 | unit | `src/lib/action.test.ts`: PH-AC-47: returns unexpected with a ref and no internal detail (one structured log entry) |  |
| PH-AC-48 | dropped | Removed by spec section 8 (no shared renderer, D9). Nothing to test. |  |
| PH-AC-49 | unit (script) | `tests/scripts/gen-module.test.ts`: PH-AC-49: creates exactly src/modules/orders/index.ts and nothing else; PH-AC-49: accepts the valid name %s; lint and typecheck of the generated module (describe labelled PH-AC-53); CI step Generator smoke test | Labelling: see gap G1. |
| PH-AC-50 | lint test | `tests/lint/boundaries.test.ts`: FND-FR-12 (a): modules are imported only through their public API (deep import reported by lint; epic 001 rule). Positive case on a generated module: `tests/scripts/gen-module.test.ts` "an added import through another module's public API passes lint" | PARTIAL by label: no test names PH-AC-50; no test deep-imports a generated module specifically. See gap G1. |
| PH-AC-51 | unit (script) | `tests/scripts/gen-module.test.ts`: describe "PH-AC-52: an existing module is never overwritten" (a second call on the same name fails and leaves the first file untouched; an existing folder without index.ts is not touched) | Labelling: the test calls it PH-AC-52, spec says 51. See gap G1. |
| PH-AC-52 | unit (script) | `tests/scripts/gen-module.test.ts`: describe "PH-AC-51: an invalid name stops with a message and changes nothing" and "PH-AC-51: the CLI exits non-zero with a message on bad input" (empty, uppercase, spaces, path characters) | Labelling: the test calls it PH-AC-51, spec says 52. See gap G1. |
| PH-AC-53 | unit (script) | `tests/scripts/gen-module.test.ts`: PH-AC-50: index.ts holds the header comment and an empty export (no sample business feature) | Labelling: the test calls it PH-AC-50, spec says 53. See gap G1. |
| PH-AC-54 | CI gate | CI jobs `fast`, `database-and-e2e`, `secret-scan` in `.github/workflows/ci.yml`. Local equivalents green in this task. Real CI run NOT yet verified: checked after the orchestrator pushes. | OPEN until the push. |
| PH-AC-55 | manual checklist | This file (every PH-AC mapped) plus `acceptance/step1.md` to `step5.md`, `acceptance/collector-manual.md` |  |
| PH-AC-56 | review | ADRs 0012 to 0016 exist and are Accepted; `docs/architecture.md` lists them and the conventions; `acceptance/step6-architecture-docs.md` (PH-T-56); final read in PH-T-60 |  |
| PH-AC-57 | manual (PM diff check) | `acceptance/step1.md` "Scope check (PH-AC-57, step 1 part)"; the product-manager checks the final diff against spec section 3 at epic acceptance | OPEN: only step 1 has a recorded scope check; the final-diff check is pending epic acceptance. |
| PH-AC-58 | unit + E2E | `src/instrumentation.test.ts`: PH-AC-58: logs one exception entry with route pattern, route type and method only; `tests/e2e/server-capture.spec.ts`: PH-AC-58: a query string and an Authorization header never reach the log |  |
| PH-AC-59 | unit | `src/lib/action.test.ts`: PH-AC-59: redirect() passes through and logs nothing (and notFound) |  |
| PH-AC-60 | unit + E2E | `src/instrumentation.test.ts`: PH-AC-60: writes nothing when the hook is not invoked; `tests/e2e/server-capture.spec.ts`: PH-AC-60: a page that calls notFound() answers 404 and writes no entry |  |
| PH-AC-61 | E2E | `tests/e2e/security-headers-csp.spec.ts`: PH-AC-61: the 500 page loads and Try again works under the CSP; the global error page (root layout fault) loads with styles; the 404 page loads and a client-side Link navigation works |  |
| PH-AC-62 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-01, PH-AC-62 (500 before streaming); PH-AC-04, PH-AC-62 (404) |  |
| PH-AC-63 | unit + test:db | `src/lib/db-error.test.ts`: PH-AC-63: returns the row when present (not_found helpers); `tests/db/db-error.test.ts`: PH-AC-63: another user (RLS-hidden row maps to not_found, real error shape) |  |
| PH-AC-64 | unit + E2E | `src/lib/action.test.ts`: PH-AC-64: writes exactly one log entry from the wrapper; `tests/e2e/leakage-and-request-id.spec.ts`: PH-AC-64: a wrapped action that throws unexpectedly writes exactly one wrapper entry and no hook entry (unwrapped half: PH-AC-09) |  |
| PH-AC-65 | E2E | `tests/e2e/telemetry-export.spec.ts`: PH-AC-21, PH-AC-65: the receiver gets trace and log requests carrying the configured service name |  |
| PH-AC-66 | unit + E2E | `src/proxy.test.ts`: PH-AC-66: forwards the same CSP on the request headers for Next to read the nonce; `tests/e2e/security-headers-csp.spec.ts`: PH-AC-66: two requests to the same page carry different nonces |  |
| PH-AC-67 | E2E | `tests/e2e/server-action-limits.spec.ts`: PH-AC-67: a Server Action post with a foreign Origin is rejected and the action does not run |  |
| PH-AC-68 | test:db | `tests/db/schema-guard.test.ts`: PH-AC-68: an allowlisted violation (table and rule) passes; another rule on it still fails; throwaway-table guard-of-the-guard |  |
| PH-AC-69 | test:db | `tests/db/set-updated-at.test.ts`: PH-AC-69: a client-supplied updated_at is overwritten (and no-op update, 5 mentions) |  |
| PH-AC-70 | unit + E2E | `src/lib/logger.test.ts`: PH-AC-70: carries request_id from the injected source (and absent when none); `tests/e2e/leakage-and-request-id.spec.ts`: PH-AC-70: entries written during a request carry the incoming x-request-id |  |
| PH-AC-71 | unit | `src/lib/action.test.ts`: PH-AC-71: ref matches the allowed pattern and differs between occurrences |  |
| PH-AC-72 | unit | `src/lib/logger.test.ts`: PH-AC-72: a throwing sink does not reject or throw |  |
| PH-AC-73 | unit | `src/next-config.test.ts`: PH-AC-73: Server Action body size limit is 1mb |  |
| PH-AC-74 | unit | `src/lib/csp.test.ts`: PH-AC-74: connect-src holds self plus the Supabase origin only (and no unsafe-eval in production) |  |
| PH-AC-75 | unit | `src/lib/list-params.test.ts`: PH-AC-75: rejects the non-integer page %j without reaching Number() (10,001, 1e3, 1.5) |  |
| PH-AC-76 | unit + E2E (both halves) | UNIT: `src/lib/fault-injection.test.ts`: PH-AC-76: is a no-op with the flag off, even with the fault header, and never reads headers (8 mentions). E2E: `tests/e2e/design-gate.spec.ts`: PH-AC-76: a fault fixture page shows the 404 page in a browser; PH-AC-76: the root layout fault header has no effect when the flag is off (flag-off server) |  |
| PH-AC-77 | E2E | `tests/e2e/error-pages.spec.ts`: PH-AC-77: the showcase lists StatusPage with and without a reference code; axe in light and dark on `/design`: `tests/e2e/design-a11y.spec.ts` (FND-NFR-03 tests, no PH id in the title) | Indirect: the StatusPage test itself does not run axe; the /design axe tests (light and dark) do. See gap G2. |
| PH-AC-78 | E2E (mechanism) | `tests/e2e/helpers/fixtures.ts` (base fixture, `allowCspViolations` option) used by every spec; opt-outs only in `tests/e2e/security-headers-csp.spec.ts` (`test.use({ allowCspViolations: true })`, two describe blocks) | CLARIFIED: five opt-out tests (PH-AC-32 x3 and blocked-framing x2 of PH-AC-79). No test asserts the fixture itself fails on a violation. See gap G3. |
| PH-AC-79 | unit + E2E | UNIT: `src/lib/csp.test.ts` (PH-AC-79 frame-ancestors variants), `src/next-config.test.ts` (PH-AC-79: %s gets X-Frame-Options SAMEORIGIN only), `src/proxy.test.ts`. E2E: `tests/e2e/security-headers-csp.spec.ts`: PH-AC-79: /design/frames/* allows the same origin only, by header; every other route is not framable; the same origin can embed /design/frames/auth; a different origin cannot embed; the same origin cannot embed a route outside /design/frames; PH-AC-31, PH-AC-79: the /design live form ... |  |

## Spec-level criteria where the spec names two halves

- PH-AC-76: unit half `src/lib/fault-injection.test.ts`; E2E half `tests/e2e/design-gate.spec.ts` (flag-off server on `E2E_PORT + 1`). Both listed in the table.
- PH-AC-64: unit (`src/lib/action.test.ts`) and E2E (`tests/e2e/leakage-and-request-id.spec.ts`); the unwrapped half is PH-AC-09 in `server-capture.spec.ts`.
