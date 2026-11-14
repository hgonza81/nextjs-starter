# Final tester read (PH-T-61, D17)

Epic 002-platform-hardening. Date: 2026-11-13. Tester: fresh instance. Docker and local Supabase were running. Production code and tests were not changed (only temporary mutations, all reverted).

## Verdict

No must-fix items. Three notes below (none blocks acceptance).

## 1. Repeated runs (flakiness and speed)

| Command | Run 1 | Run 2 | Run 3 |
|---------|-------|-------|-------|
| `pnpm test:e2e --reporter=list` | 203 passed (52.0 s) | 203 passed (51.5 s) | 203 passed (53.5 s) |
| `pnpm test:db` | 300 passed, 10 files (15.2 s) | 300 passed (15.0 s) | 300 passed (15.0 s) |

- No failure, no retry, no test reported as flaky, in any of the six runs. The E2E count is 203 (was 200 in PH-T-59; PH-T-69 added the 3 gap tests).
- E2E runs were sequential. Process note: the three `test:db` runs overlapped in time with the three E2E runs (one tool call batch). The E2E suite has no database, so they do not share state, and all runs were green; but strictly it was not "one layer at a time". Re-run in isolation if the PO wants that literal guarantee.
- Slowest E2E tests: `server-action-limits.spec.ts` PH-AC-30 body size limit 17.6 s (sends a over-1 MB body; stable across 3 runs); four `design-a11y.spec.ts` axe tests at about 8.5 s each (18 frames loaded); everything else is 2 s or less. Total is under 1 minute; nothing to fix.
- The E2E server logs print expected error lines (fault fixtures, sentinel `token:` value in an injected error message). They are not failures.

## 2. Spot mutation (five criteria plus one extra, all reverted)

| # | Mutation (temporary) | Layer run | Result | Failing tests (examples) |
|---|----------------------|-----------|--------|--------------------------|
| M1 | `src/db/paginate.ts`: removed the `asc(columns.id)` tiebreaker | `pnpm test:db tests/db/paginate.test.ts` | caught, 2 failed | PH-AC-38 (25 rows sharing one sort value; pages cover every row once) |
| M2 | `src/lib/logger.ts`: redaction regex replaced by one that matches nothing | `pnpm test src/lib/logger.test.ts` | caught, 12 failed | PH-AC-17 redacts `email`, `userEmail`, ... |
| M3 | `src/lib/csp.ts`: `frame-ancestors` always `'self'` | `pnpm test src/lib/csp.test.ts` | caught, 1 failed | PH-AC-79 frame-ancestors is `'none'` by default |
| M4 | `src/lib/action.ts`: removed `unstable_rethrow(thrown)` | `pnpm test src/lib/action.test.ts` | caught, 3 failed | PH-AC-59 redirect() and notFound() pass through, log nothing |
| M5 | `src/lib/csp.ts`: removed the nonce from `script-src` | `pnpm test src/lib/csp.test.ts` | caught, 2 failed | PH-AC-27 script-src carries the nonce; embeds exactly the nonce given |
| M6 (extra) | `next.config.ts`: HSTS value changed to `max-age=0` | `pnpm test src/next-config.test.ts` | caught, 1 failed | PH-AC-29 HSTS is sent in production without preload |

Every file was restored with `git checkout <file>`; after each round `git diff -- src next.config.ts` was empty. The only other dirty files in the tree (docs/adr/0004, 0013, architecture.md, spec.md, specs/003 notes, architect-final.md) belong to other tasks running in parallel and were not touched or committed by this task.

## 3. Secrets and tokens in logs, fixtures and output

- Scanned `tests/.logs/`, `test-results/`, `playwright-report/` (all three are gitignored) for JWT-like strings, `sb_secret`, `service_role`, `password`, `Bearer`: only hits are minified Playwright viewer JS in `playwright-report/index.html` (no credential). `tests/.logs` and `test-results` have no hit.
- Scanned `tests/`, `src/`, `docs/`, `.github/`, `.env.example`, `playwright.config.ts` for JWTs: exactly one, `tests/db/hardening-catalog.test.ts` line 43, the documented public local Supabase demo anon key (`role: anon`, `iss: supabase-demo`), allowlisted in `.gitleaks.toml` by path AND exact value.
- Database URLs with passwords in tests are the local defaults (`tests/utils/local-env.mts`, the same values as `.env.example`) or obvious dummies (`secret`, `pw-for-tests`, `db.example.com`). No service-role key, no real credential.
- The sentinel "secret" and `token:` strings in E2E logs are deliberate fixtures proving non-leakage (PH-AC-06, PH-AC-08).
- Committed fixtures: only `tests/lint/fixtures/{cycle,acyclic}` (source files) and the Playwright fixtures helper. No snapshots committed.

Result: no leak.

## 4. Vacuous or weak tests

- No `expect(true)`, no `.skip`, `.only`, `.todo`, `fixme` anywhere in `src/` and `tests/`.
- Every test file contains at least one assertion.
- Weak assertions found (notes, not defects; the behavior is protected elsewhere):
  - N1: `src/lib/action.test.ts` line 286 asserts `rejects.toBeDefined()` for the redirect pass-through; the real check is the `log.warn` and `log.exception` `not.toHaveBeenCalled()` lines right after, and M4 proved the group fails when the behavior is removed. Suggest `rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") })` when someone next edits the file.
  - N2: `tests/e2e/security-headers-csp.spec.ts` lines 110 and 139 assert HSTS only `toBeDefined()`; the value is asserted in `src/next-config.test.ts` (M6 proved it). Optionally assert `toContain("max-age=")` to keep the E2E level meaningful.
  - N3: `tests/db/db-error.test.ts` line 51 `toBeDefined()` has an explicit message and is followed by the real mapping assertions. Fine.
- The `toBeDefined()` on `errorId` in `design-form-field.spec.ts` is meaningful (`Array.find` returns `undefined` when missing).

## Must-fix items

None.

## Left open (not verifiable here)

- PH-AC-54 (real CI run after push) and PH-AC-57 (final-diff scope check) stay with the orchestrator and PH-T-62, as recorded in `ac-coverage.md`.
- `pnpm audit` was not run (informational CI job).
