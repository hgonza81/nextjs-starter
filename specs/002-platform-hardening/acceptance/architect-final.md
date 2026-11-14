# Final architect read (PH-T-60)

Epic 002-platform-hardening, D17. Date: 2026-11-13. Static read, no commands run (no shell). Read: spec (with change log), `questions.md`, ADRs 0012 to 0016, `docs/architecture.md`, step 1 to 6 reports, `ac-coverage.md`, and the code listed in the task (logger, errors, db-error, action, csp, list-params, fault-injection, zod-jitless, paginate, proxy, instrumentation, `next.config.ts`, layout and error pages, `gen-module.mts`, compose file, `set_updated_at` migration, schema guard). No code was changed.

## Verdict

**No must-fix item.** Spec, ADRs and code agree on every limit, name, path and version sampled. Seven wording inconsistencies were found; five were fixed directly (below), two are notes for the product-manager. Gate evidence is from PH-T-59 (`ac-coverage.md`); the real CI run after push (PH-AC-54) is not verified here.

## Values sampled across spec, ADR and code

| Item | Spec / ADR | Code or config | Agree |
|------|-----------|----------------|-------|
| Page size default / max / page cap | 20 / 100 / 10,000 | `list-params.ts`: `DEFAULT_PAGE_SIZE 20`, `MAX_PAGE_SIZE_LIMIT 100`, `MAX_PAGE 10_000` | yes |
| Integer parsing | plain base-10 digits | `DIGITS_ONLY = /^\d+$/` before `Number` | yes |
| `id` tiebreaker, `pageCount` 0 when empty | ADR 0016 | `paginate.ts`: `asc(columns.id)`, `Math.ceil(0 / n) = 0` | yes |
| Logger truncation, deny-list, request id headers | 200 chars, `email\|token\|...\|key`, `x-request-id`/`x-vercel-id` | `logger.ts` constants identical | yes |
| `ref` | 8 hex characters from `crypto.randomUUID()` | `action.ts` `newRef` | yes |
| DB mapping | 23505/23503 conflict, 42501 forbidden, 23502/23514 validation, else unexpected; cause depth 3 | `db-error.ts` | yes |
| Body limit | `experimental.serverActions.bodySizeLimit: '1mb'` | `next.config.ts` | yes |
| `X-Frame-Options` split | DENY except `/design/frames/:path*` SAMEORIGIN, non-overlapping | `next.config.ts` (negative lookahead + frames source) | yes |
| HSTS | production only, `max-age=63072000; includeSubDomains`, no preload | `next.config.ts` | yes |
| CSP | nonce + `strict-dynamic`, dev-only `unsafe-eval`/`ws:`, `frame-ancestors` scoped | `csp.ts`, `proxy.ts` (matcher excludes `api`) | yes |
| `connection()` in root layout, `assertFaultInjection()` no-op with flag off | ADR 0014, 0015, C3, C4 | `layout.tsx`, `fault-injection.ts` | yes |
| Telemetry off unless endpoint set; SDK imported lazily | PH-FR-11 | `instrumentation.ts` `register()` | yes |
| Versions | Next 16.4.6, zod 4.6.7, sdk-node 0.301.2, api 1.10.0, sdk-trace 3.1.1 (dev), LGTM 0.41.0 | `package.json`, `compose.yaml` | yes |
| Trigger function | `SECURITY INVOKER`, `search_path = ''`, no grant | migration `20261113120000_set_updated_at_function.sql` | yes |
| Guard rules | seven rules, allowlist with reasons | `schema-guard.ts` (`CONVENTION_ALLOWLIST` empty) | yes |
| `gen:module` | only `index.ts`, kebab-case, never overwrites, header lists `actions, queries, schemas, components` (matches C1 after PH-T-68) | `gen-module.mts` | yes |
| Scripts, ports | `obs:start/stop`, `gen:module`, UI on 3001, all ports on 127.0.0.1 | `package.json`, `compose.yaml` | yes |

## Decisions C1-C4 and D1-D17: reflected

- C1 hard delete, only `created_at`/`updated_at`: ADR 0012 (Accepted), C13, guard rules 2-4; no `deleted_at` or `*_by` anywhere.
- C2 global error page: `global-error.tsx` built on `StatusPage`, plain `<a href="/">`, tested (PH-AC-03, 61).
- C3 per-request rendering: ADR 0014, C14, `connection()`; fallback recorded.
- C4 fault routes in the artifact: spec PH-FR-23, ADR 0015, architecture "Environment" (flag must stay off in every real deployment).
- D1-D4 (collector, SDK, depth, logger): ADR 0013 and code. D5-D9 (ref, pages, hook scope, wrapper order, mapping): ADR 0015, code, tests. D10 (headers): ADR 0014, `next.config.ts`, proxy. D11 (conventions): ADR 0012. D12 (pagination): ADR 0016. D13 (`gen:module`, no ADR): `docs/architecture.md`, README. D14 (test seams): `tests/README.md`, `scripts/e2e-server.mts`, `.gitignore` has `tests/.logs/`. D15 dropped "renders statically": ADR 0014. D16 ADRs 0012-0016 exist, indexed in `docs/adr/README.md` and `docs/architecture.md`. D17 no design round: this read is the replacement review.

## Reversibility fallbacks: present and documented

| Fallback | Exists | Documented in |
|----------|--------|---------------|
| Static CSP instead of nonce CSP | ADR 0014 "Fallback (recorded, not needed)"; spike proved the nonce works | ADR 0014, spec D10/C3; now also `docs/architecture.md` "Reversibility (epic 002)" |
| Collector optional | no workflow, Playwright or Vitest config references it (grep in PH-T-59) | ADR 0013, README, `docker/observability/README.md`, `collector-manual.md` |
| Conventions allowlist | `CONVENTION_ALLOWLIST` with required reason, guard-of-the-guard test | ADR 0012, architecture lint table |
| OTEL off by default | `register()` imports the SDK only when the endpoint is set; tests PH-AC-20 | ADR 0013, `.env.example`, README |
| C4 seam removal | PH-AC-03 becomes component-level, PH-AC-61 uses `global-preview` | spec PH-FR-23, ADR 0015 |

## Recorded relaxations: described consistently

- **PH-AC-23** (process stays alive, answers 500, variable named, value not printed): spec PH-FR-13, section 8 and change log; ADR 0013 "Review of step 2"; ADR 0004 note; architecture "Environment"; README "Limits worth knowing"; `ac-coverage.md`; `telemetry-config-startup.spec.ts` header. Consistent.
- **PH-AC-30** (non-2xx, 500, `statusCode: 413` in the log, not a literal 413): spec PH-FR-16, section 8, change log; ADR 0014 (spike A and the "Server Action body-limit verification" consequence); `ac-coverage.md`. Consistent.
- **PH-AC-32** under `strict-dynamic` (parser-inserted scripts and inline handlers are blocked; scripts inserted by trusted running code are not): spec change log; ADR 0014 "Accepted limits"; `ac-coverage.md`. Consistent.
- **PH-AC-78** five opt-outs: verified in `security-headers-csp.spec.ts` (three PH-AC-32 tests in "CSP enforcement" plus two blocked-framing tests); spec section 8 and change log; `ac-coverage.md`; `tests/README.md` describes the fixture. `csp-fixture-guard.spec.ts` uses `test.fail()` and is not an opt-out. Consistent.

## Wording inconsistencies

Fixed directly:
1. `spec.md`: a corrupted fragment (`<parameter name="replace_all">false PH-AC-27, ...`) sat as a stray table row after PH-FR-15. Removed. A change log row was added.
2. `spec.md` section 10: "about 9 exact-pinned OpenTelemetry packages" corrected to what was built (one direct package `@opentelemetry/sdk-node`, one devDependency `@opentelemetry/sdk-trace`).
3. `docs/adr/0013-observability.md` Consequences: the same "about 9 dependencies" statement corrected.
4. `docs/adr/0004-env-and-secrets.md`: "the only `NEXT_RUNTIME` read" (two places, in the startup-validation bullet and the env summary) now says two reads, `register()` and `onRequestError`, as C11 already did.
5. `docs/architecture.md`: new section "Reversibility (epic 002)" so PH-NFR-06 is checkable from one place (no existing text changed).

Not edited (owned by the product-manager, to be fixed in PH-T-62):
6. `tasks.md` header says "Spec: ... (Draft, round 2 fixes applied)"; the spec is Approved.
7. `specs/README.md` epic table says "in implementation (step 1)".

Also noted, no action: spec PH-FR-19 lists the guard rules without the "explicit ON DELETE" rule that ADR 0012 and the code enforce (the code is a superset and PH-FR-17 requires `ON DELETE` per FK, so this is consistent in intent). Spec PH-FR-20 does not mention reserved keys, `parseListParams` or typed filters beyond the change log row; ADR 0016 and C15 are the record.

## Must-fix items (fix-task proposals)

None.

## Optional low-priority proposals (no task required)

- **FIX-A (developer + tester):** harden the `set-updated-at-trigger` rule. In `findConventionViolations` (`tests/utils/schema-guard.ts`) add `and tgattr = ''::int2vector and tgqual is null and tgenabled <> 'D'` to the `pg_trigger` query, plus three tester cases (`UPDATE OF <cols>`, `WHEN` clause, disabled trigger) expecting `set-updated-at-trigger`. Source: step 4 N1. Already parked in spec section 3 and documented as a review rule in ADR 0012. Best done together with the epic 003 migration that adds the first real trigger.
- **F-1 (developer):** align the exact path `/design/frames`: change the two `X-Frame-Options` sources in `next.config.ts` to `"/((?!design/frames/).*)"` (DENY) and `"/design/frames/:path+"` (SAMEORIGIN), and add the exact path to `src/next-config.test.ts` expecting `DENY`. Not needed for safety (404 path, CSP `frame-ancestors 'none'` wins; fails closed).
- **FIX-B (developer):** `startTelemetry()` returns the `NodeSDK` and `register()` calls `sdk.shutdown()` on `SIGTERM`, with a unit test using a mocked SDK. Source: step 2. Parked in spec section 3; do it when the first production deployment exists.

## Residual risks

| # | Risk | Severity | Mitigation or owner |
|---|------|----------|---------------------|
| R1 | Next prints the raw error (message, stack) before `onRequestError`; an unwrapped path that throws a `DrizzleQueryError` puts SQL and parameters in the platform log | Medium | Rules in ADR 0015 (DB access through `defineAction`, route handlers catch and `logger.exception`, no personal data in messages); review item, not mechanically enforced. Epic 003 should consider a lint rule or review checklist for `"use server"` files |
| R2 | `DESIGN_PAGE_ENABLED` accidentally on in a real deployment: anyone can make the root layout throw with `x-fault: root-layout` and reach fault routes (no database access) | Low (availability only) | Off by default, gate tested (PH-AC-76), documented in architecture, README and `.env.example`; deployment checklist in 003 |
| R3 | `style-src 'unsafe-inline'` and `strict-dynamic` semantics (trusted script gadgets, CSS injection) | Low | Accepted and recorded in ADR 0014; no code may build script elements or `eval` strings from user input |
| R4 | `serverActions` is an `experimental` key in Next 16.4.6 and 413 appears only in raw console output; a Next upgrade can move the key or change the output | Low | PH-AC-73 config test and one E2E test fail loudly; ADR 0014 |
| R5 | Dependency on a 0.x OpenTelemetry release (`sdk-node` 0.301.2, exact-pinned) and SDK-driven configuration honors undeclared `OTEL_*` variables (per-signal protocol `grpc` would be honored but unsupported); no flush on SIGTERM | Low | SDK off unless the endpoint is set; documented in ADR 0013; FIX-B optional |
| R6 | Startup failure does not exit the process (Next 16.4.6): a bad environment answers 500 but the process stays up | Medium (operational) | Deployment health checks must hit `/api/health` and not rely on a crash (ADR 0013, 0004) |
| R7 | `/api/*` carries no CSP; a route handler returning HTML or SVG would be unprotected | Low (none exists) | ADR 0014 limit; C14 says such a route needs its own CSP |
| R8 | `paginate` totals are READ COMMITTED-approximate; 22P02 is deliberately not mapped, so an untyped filter on a uuid or enum column yields `unexpected` | Low | ADR 0016 "Known limits"; use the record form of `filters` for non-text columns (C15) |
| R9 | Guard gaps: plural table names and `<singular>_id` FK names not checked; partial index counted as covering an FK; Drizzle pull omits triggers; relative-import gaps in the boundary lint (architecture "Known gaps") | Low | Review rules; `import/no-restricted-paths` hardening available when 003 adds modules |
| R10 | Zod `jitless` first-import convention has no lint rule; a miss shows up only as a CSP console error caught by the E2E fixture (and only on pages the E2E visits) | Low | Documented in ADR 0014 and C14; alternative via `instrumentation-client.ts` recorded |
| R11 | CI reduced Supabase stack excludes `gotrue`; drift check is vacuous with 0 tables | Medium for 003 | Epic 003 must remove the exclusion (item 7 in `notes-from-002.md`) |
| R12 | PH-AC-54 (real CI run after push) and PH-AC-57 (final-diff scope check) are not verified by this read | n/a | PH-T-62 and the orchestrator after push |

## Items epic 003 must handle

Recorded in `specs/003-auth-memberships/notes-from-002.md` (items 1 to 6 from step 4, items 7 to 18 appended by this task): allowlist entries and the `updated_at` decision for `profiles` and `memberships`, FK `ON DELETE` and indexes (`tenants.created_by`, `memberships.user_id`), `tenant_id` guard rule, `gotrue` in CI, `defineAuthedAction`, session refresh composed with the CSP, `SameSite=Lax`, OAuth from an action or route redirect, enumeration-safe auth messages despite `23505` to `conflict`, rate limiting, request id, Supabase client factory location, `zod-jitless` in client forms, HSTS subdomain check, `DESIGN_PAGE_ENABLED` off in deployments, typed filters for lists.

## Files edited by this task

- `/Users/hernangonzalezbuteler/dev/nextjs-starter/specs/002-platform-hardening/acceptance/architect-final.md` (new)
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/specs/002-platform-hardening/spec.md`
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/docs/adr/0013-observability.md`
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/docs/adr/0004-env-and-secrets.md`
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/docs/architecture.md`
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/specs/003-auth-memberships/notes-from-002.md`

Not verified: no commands were run; the orchestrator should run `pnpm format:check` (Markdown tables) before the commit.
