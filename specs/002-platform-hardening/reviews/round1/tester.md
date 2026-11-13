# Review by tester — 002-platform-hardening — round 1 (requirements + flows)

## Summary
Most criteria are testable at the cheapest level (unit for logic, `test:db` for pagination and conventions, E2E on the production start for pages, headers and CSP). The biggest issue: four criteria cannot be tested as written without decisions on test seams (fault-injection routes in a production build, a readable log sink, the route-handler "body with code" in PH-AC-10, and double logging between the wrapper and `onRequestError`). Several others are vague (PH-AC-22 "slow down noticeably", PH-AC-48, PH-AC-53, PH-AC-55, PH-AC-57) or depend on numbers not yet defined (page size defaults, body limit, enforced conventions).

Existing setup that helps: Vitest `unit` and `db` projects, Playwright against `next build` + `next start` on two servers (with DB variables removed), axe helper, throwaway-table and `asUser` harness, schema-guard with guard-of-the-guard, jsdom + Testing Library already installed. No MSW or OpenTelemetry packages yet (see tooling).

## Concerns and gaps

### Blockers (testability)
- [blocker] **Fault-injection seam (PH-AC-01, 02, 03, 06, 08, 10, 30).** Error pages, retry, root-layout failure, route-handler throw and oversized action all need something that fails on demand in a production build. E2E runs only production builds. Needs a decision (Question 1).
- [blocker] **Log capture for E2E (PH-AC-08, 10, 20).** "Exactly one log entry contains code X" needs the server's stdout. Playwright `webServer` does not expose stdout to tests. Needs a sink (Question 2).
- [blocker] **PH-AC-10 contradicts framework behavior.** A route handler that throws gets Next's empty 500, not "a generic body with the code". Either the epic ships a route-handler wrapper (not in PH-HR-10, which is about actions), or the criterion is relaxed to "no internals, one log entry". Question 3.
- [blocker] **PH-AC-09 vs PH-AC-47 / PH-FL-04 Alt.** An action throwing an unknown error is caught by the wrapper (`unexpected` + code, logged by the wrapper). Then `onRequestError` never sees it, so "the hook logs it" is true only for an action that is NOT wrapped. Define: wrapped action = one log entry from the wrapper, none from the hook (assert exactly one, no double logging); unwrapped action = hook logs it. Test both.

### Important
- [important] **PH-AC-18 "forbidden field" is undefined for the logger.** A logger cannot detect an email inside a free string. Propose: typed allow-list of fields at compile time plus a runtime key deny-list (`email`, `token`, `password`, `body`, `authorization`, `cookie`, `url`/connection-string-like values, case-insensitive, nested), and `Error` values reduced to `name`/`code`. Say explicitly that PII embedded in a free-text message is not detectable and is handled by never logging messages (PH-AC-11).
- [important] **Request id source undefined (PH-AC-16).** Where does the request id come from (header, generated in middleware/proxy)? Without it the AC cannot assert a value. Trace id comes from the active OpenTelemetry span context.
- [important] **PH-AC-22 "does not slow down noticeably" is untestable.** Propose a measurable form: with the destination an unused closed port, 20 sequential requests all return 200 and each is under 2 s, and the server process is still alive afterwards.
- [important] **PH-AC-23 needs the list of validated variables.** Name them (for example `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME`) and the validation rule (URL, enum `http/protobuf|http/json|grpc`). Which one is "invalid" decides the test.
- [important] **Pagination parameters undefined (PH-AC-39, 40).** Default page size, maximum, default sort, filter operators (equals only? contains? ranges?), sort direction, NULL ordering, and what "negative page" means for 0, non-integers, `"1e3"`, and huge pages (offset overflow would reach SQL as a database error, not `validation`). Propose: default 20, max 100, page >= 1 integer and <= 10000 (cap), filters are equality plus `contains` on text columns with `%` and `_` escaped, sort = allow-listed column + `asc|desc` + the primary key as final tie-breaker (needed for PH-AC-38 "stable for equal values").
- [important] **PH-AC-30 limit value undefined.** Propose keeping the Next default of 1 MB stated explicitly in config and docs; test at 1 MB minus a margin (accepted) and 1 MB plus a margin (rejected, 413). Needs an action fixture (Question 1).
- [important] **Nonce-based CSP forces dynamic rendering (Q2 / PH-AC-27, 31).** All pages become per-request rendered; PH-FL-03 says screens "render statically". This is an architect/developer concern (cost, caching), not a test concern, but it changes what the E2E sees (a fresh nonce per request). Test: two requests give different nonces; scripts carry the nonce.
- [important] **PH-AC-04 / BR-03 status codes.** With streaming, a failure after the shell is flushed can already have returned 200, and `notFound()` below a Suspense boundary can too. "HTTP 500 (or the Next.js error status)" is vague. Propose: assert 404 for unknown URLs and gated routes; assert 500 for a fixture that throws before the shell; do not assert status for streamed failures.
- [important] **PH-AC-35 is only testable once the enforced conventions exist.** List them in the ADR with the exact rule per convention (for example: `id uuid primary key default gen_random_uuid()`, `created_at`/`updated_at timestamptz not null default now()`, trigger present, snake_case plural name, RLS already guarded). The message must contain table name and rule. Needs an explicit exception allowlist with a reason (PH-FL-10 Alt).
- [important] **PH-AC-34 needs a defined trigger clock.** `now()` is the transaction start, so an update inside the same transaction as the insert shows no change. The trigger should use `clock_timestamp()` or the test must update in a separate transaction. Also decide: is `created_at` immutable (update that sets it is ignored/rejected)? Is a client-supplied `updated_at` overwritten? Add both as cases.
- [important] **Wrapper must not swallow Next control-flow errors.** `redirect()` and `notFound()` throw special errors; a catch-all would turn them into `unexpected`. Add an AC: a handler calling `redirect()`/`notFound()` still redirects/404s and is not logged as an error. Missing from PH-AC-44..47.
- [important] **"Agreed structure" of a module is not defined (PH-AC-49, 53).** Also C1 says "no empty module folders", and git does not track empty folders, so the generated structure and C1 must agree. Needed to write PH-AC-49/53 as a file list.

### Minor / vague
- [minor] PH-AC-48 is conditional on Q8; remove it if Q8 A is taken (recommended).
- [minor] PH-AC-53 "no sample business feature": define as an exact expected file list plus exports limited to the public API stub.
- [minor] PH-AC-55 and PH-AC-57 are process checks, not tests. PH-AC-55 is covered by the traceability table in the spec; PH-AC-57 is a PM review of the diff. Mark both "manual/review" in the spec.
- [minor] BR-02 wording "non-guessable-free of personal data" is garbled. Testable form: the code matches a safe charset (`^[A-Za-z0-9_-]+$`), contains no user data. If Q6 A (framework digest): it exists only in production builds, so PH-AC-08 is production-only.
- [minor] PH-AC-33, 56 (docs and ADRs) are review items; a tiny check that ADR files are listed in `docs/adr/README.md` is optional.
- [minor] PH-AC-24, 26 need Docker and a human or a script; manual check, documented, not in CI.
- [minor] PH-AC-36 and PH-AC-54 need no new tests; they are the existing CI gates.

## Proposals

### Test level per acceptance criterion

| AC | Level | How |
|----|-------|-----|
| 01 | E2E (prod) + component | E2E on a fixture page that throws a message with a sentinel secret: friendly text, code visible, sentinel absent. Component test of `error.tsx` with an `Error` whose message is the sentinel and a digest prop. |
| 02 | Component + E2E | Component: "Try again" calls `reset`. E2E: fixture whose failure is toggled by a cookie or query parameter; first load fails, after toggle and retry it renders; with toggle still on it fails again. |
| 03 | Component, E2E if seam allows | Component test of `global-error.tsx` (renders own `html`/`body`, message, code, no dependency on tokens). E2E only if a seam can make the root layout throw without making every page dynamic; otherwise component only and say so. |
| 04, 05 | E2E | Status 404 and 404 text. 05 extends `design-gate.spec.ts` (flag-off server) to compare with the unknown-URL 404 page. |
| 06 | E2E (prod) | Fixture throws a sentinel; assert it is absent from the HTML, the RSC payload, headers, and from action/route responses. |
| 07 | E2E | Existing axe helper on the three pages in both color schemes; reference code has `user-select` not none and is real text; Tab reaches each action. |
| 08 | E2E + log sink | Code read from the page; assert exactly one log line with that code (keyed by a unique code, so CI retries cannot double count). |
| 09 | E2E | Two cases: wrapped action (wrapper logs once, hook silent) and unwrapped action (hook logs once, generic message + code). |
| 10 | E2E | Per Question 3. |
| 11 | Unit | Call the hook function directly with an error whose message contains an email and token; assert the injected sink holds only class/code/route/kind/code ids. |
| 12-15 | Unit | Table-driven. Fake Postgres errors with SQLSTATE `23505`, `42501`, unknown. Plus `test:db`: real unique violation and real RLS denial through `withRls` (the driver/Drizzle wraps the error, mapping must read the nested cause), proving the real error shape and no DB message in the result. |
| 16, 17 | Unit | Real OpenTelemetry API with an in-memory span exporter and a started span; injected clock and sink; parse each line with `JSON.parse`, one object per line. |
| 18 | Unit, table-driven | Each forbidden key, nested, mixed case, `Error` instance, arrays; assert the secret value is absent from the whole output string. |
| 19 | Lint | An ESLint `no-console` rule (error) for `src/**` with the logger file as the only override; test it like `tests/lint/boundaries.test.ts` with `lintText`. Better than a grep test and it stays enforced. |
| 20 | E2E | Default servers (no OTel variables), already exercised by every other spec; add an assertion that a JSON log line appears in the server log. |
| 21 | E2E with test receiver | A small Node HTTP server in the test acting as an OTLP/HTTP receiver (use `http/json` protocol to avoid protobuf decoding); a third `next start` on its own port with the endpoint set and a short batch delay (`OTEL_BSP_SCHEDULE_DELAY`); `expect.poll` until a request to `/v1/traces` arrives with the service name. No MSW needed. |
| 22 | E2E | Server pointed at a closed port; 20 requests, all 200 and under 2 s, server alive. |
| 23 | Unit + one process test | Unit on the env schema (table of invalid values, message names the variable). One spawn of `next start` with a bad value: exits non-zero and stderr names the variable. |
| 24, 26 | Manual (documented) | Needs Docker and a UI. Optional script smoke later. Not in CI. |
| 25 | Existing gates | Guaranteed by keeping the collector out of CI and test config; CI green is the proof. |
| 27-29 | E2E (prod, `request` API) | Over `/`, an unknown URL, an error fixture, `/api/health`, and a `/_next/static` asset. Parse the CSP into directives and assert: `script-src` has a nonce and no `unsafe-inline`/`unsafe-eval`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri`; assert HSTS `max-age`, `nosniff`, referrer and permissions policy values. No whole-header snapshot. 29: foreign `Origin` on GET and on an `OPTIONS` preflight; assert no `access-control-allow-*`. Also a Server Action posted with a foreign `Origin` is rejected. |
| 30 | E2E | Action fixture; just under and just over the limit. |
| 31 | E2E | Global fixture: every E2E test fails on a `securitypolicyviolation` event or a CSP console error (so all existing `/design` specs become CSP regression tests for free), plus explicit visits to `/`, `/design`, 404 and the error page. |
| 32 | E2E | In the page, append a script from `https://example.invalid` and an inline script without nonce; assert two `securitypolicyviolation` events. No fixture route needed. |
| 33, 56 | Review | Doc review by `architect`/PM. |
| 34 | `test:db` | Throwaway table plus the real trigger from the migration; cases as above (separate transactions, `created_at` unchanged, client-supplied value overwritten, no-op update). |
| 35 | `test:db` | Convention guard reading the catalog (same pattern as the schema guard), with a guard-of-the-guard that creates a violating throwaway table and expects a failure naming table and rule, and an exception allowlist test. |
| 36 | CI | Existing steps. |
| 37-41, 43 | `test:db` | Throwaway table seeded with 25 deterministic rows including duplicate sort values; pages 1, 2, last, beyond, empty filter; hostile values (`'; DROP TABLE x;--`, `%`, `_`, backslash, unicode, very long) proven by the table still existing and the literal row matching. Boundaries: page size 1, max, max+1; page 0, -1, 1.5, huge. |
| 40 | Unit | Spy on the `tx` handle: validation errors do not call it. |
| 42 | `test:db` | Two users with RLS via `asUser`, each sees only own rows; also `asAnon` sees none. |
| 44-47 | Unit (fakes) | Handler spy and in-memory log sink. Add cases: FormData and plain object inputs, extra and missing fields, `redirect()`/`notFound()` passthrough, handler throws a non-Error value, handler returns a DB error (real one in `test:db`). |
| 48 | Drop | If Q8 A. |
| 49-53 | Unit (temp dir) + CI smoke | Generator is a function taking a root path, so unit tests run in `os.tmpdir()`: expected file list, no overwrite (directory byte-identical, nothing created), invalid-name table (empty, no argument, `Billing`, `my module`, `../x`, `a/b`, `-a`, `a--b`, trailing newline, unicode, too long, reserved names such as `index` and existing `auth`/`users`/`tenants`), second run fails. AC-50: `lintText` of a deep-import fixture against the generated module. AC-49 lint+typecheck: a CI step in the `fast` job `pnpm gen:module ci-smoke && pnpm lint && pnpm typecheck`, then remove it (a real run, no extra suite). |
| 54 | CI | Green gates. |
| 55, 57 | Review | Process checks; the traceability table lands in `spec.md`. |

### Tooling and environment (no collector needed anywhere)
- Tests, CI and builds never set telemetry variables except the dedicated receiver and unreachable-destination servers started by the tests themselves (BR-11, PH-AC-25).
- New dev dependencies likely: the OpenTelemetry SDK test exporter (in-memory) only; no MSW (the receiver is a plain Node server). No new runner.
- Log sink for E2E: start the E2E servers through a shell wrapper that tees stdout to a file under a git-ignored folder (for example `next start ... 2>&1 | tee tests/.logs/server-<port>.log`), and read it in tests. Keeps the logger free of test-only options.
- Fixtures (throwing page, throwing route, large-body action, retry toggle) live under one clearly named test-only segment, gated by an env flag like `DESIGN_PAGE_ENABLED` and absent (404) in production, with a unit test that the gate is off by default.

### CI impact
- `fast`: `pnpm test` grows (still no Docker); add the `gen:module` smoke step (~1 min with typecheck). `pnpm build` slightly longer with OpenTelemetry.
- `database-and-e2e`: `test:db` adds conventions, trigger, pagination and mapping files (seconds, run in sequence as today). `test:e2e` adds servers: telemetry-on, unreachable-destination, invalid-variable spawn; they reuse the existing build so they add seconds, not a rebuild. Well inside the 30 minute timeout. Fault-injection fixtures keep the same two-server pattern of 001.
- Flakiness controls: unique codes per test for log assertions, `expect.poll` for receiver and log reads (no sleeps), receiver on a free port, retries stay at 2 in CI.
- Do not add the collector, k6, ZAP or Lighthouse now. Roadmap items that start paying off after this epic: a security-header scan (ZAP baseline) once there is a public deployment; cross-browser E2E for the CSP (Firefox/WebKit enforce it differently) when real users arrive; propose, do not build.

## Questions for the client
1. How should production-build E2E reach error states?
   - Options: A fixtures in a test-only segment gated by an env flag (404 when off), same precedent as `DESIGN_PAGE_ENABLED`; B a second test-only build with its own `distDir`; C component tests only, no error-page E2E.
   - Recommendation: A, because it needs no second build and the flag-off server already exists. Cost: test code ships in the artifact behind a gate; B removes that but adds minutes to every CI run.
   - Impact if undecided: PH-AC-01, 02, 06, 08, 10, 30 stay untestable end to end.
2. Log sink for the logger and `onRequestError` in E2E?
   - Options: A tee server stdout to a file read by the tests; B an optional env-selected file sink in the logger; C unit tests only.
   - Recommendation: A, because it tests the real output with no test-only production code.
   - Impact: PH-AC-08, 10, 20 cannot assert "exactly one entry".
3. PH-AC-10 route-handler body?
   - Options: A relax to "no internals in the response, one log entry" (Next default empty 500); B ship a small route-handler wrapper that returns `{ code }` (scope grows beyond PH-HR-10).
   - Recommendation: A; B is a suggestion (not in scope unless approved).
   - Impact: the criterion fails by design otherwise.
4. Numeric defaults for the helpers (page size default 20, max 100, body limit 1 MB, page cap 10000)?
   - Options: A accept these; B others.
   - Recommendation: A, easy to change in one constant each; tests read the constants and test their boundaries.
   - Impact: PH-AC-30, 39, 40 have no boundary values.

## Risks and assumptions
- Highest-risk behaviors to verify first: CSP nonce not breaking Next/Tailwind/shadcn scripts (PH-AC-31), no PII or secrets in logs and error responses (PH-AC-06, 11, 18, 47), real DB error mapping (PH-AC-13, 14), SQL-safety of pagination (PH-AC-43), `updated_at` trigger correctness (PH-AC-34).
- Assumes the digest exists in production builds only; any criterion about the reference code runs on the production start.
- Assumes Q3 (hard delete, no audit columns) is confirmed, so the convention guard has no `deleted_at` or `*_by` rules; if answered differently, PH-AC-34/35 gain cases.
- Real-DB tests need the local Supabase stack; the E2E layer stays DB-free (error fixtures must not touch the database).
- Not verified in this round: no code was run; Next 16 behavior of `global-error` and `onRequestError` for server actions should be confirmed against `node_modules/next/dist/docs/` by the developer before the spec fixes PH-AC-03 and PH-AC-09.
