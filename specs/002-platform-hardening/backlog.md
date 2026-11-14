# 002 - Platform hardening: backlog

Non-blocking findings parked at final acceptance (`acceptance/final.md`, section 6). None is required by the epic.

- Flush the last telemetry batch on SIGTERM: `startTelemetry()` returns the SDK, `register()` calls `sdk.shutdown()` (FIX-B). Do it with the first production deployment.
- Validate per-signal `OTEL_*` variables and `OTEL_SDK_DISABLED`. First production deployment.
- Harden the `set-updated-at-trigger` guard rule: reject `UPDATE OF <cols>`, `WHEN` clauses and disabled triggers, with three tester cases (FIX-A). Best done with the first real trigger in epic 003.
- Align the exact `/design/frames` path so it returns `X-Frame-Options: DENY` (F-1). Optional, fails closed today.
- Maximum length for the `gen:module` name.
- Filter operators beyond equality, keyset pagination and text search, per list when a module needs them.
- Lint rule or review checklist for `"use server"` files (database access through `defineAction`) and for the `@/lib/zod-jitless` first import. Consider in epic 003.
- Guard against a foreign-table column in `paginate` `columns`. Consider with the first list in epic 003.
- Stronger assertions: `src/lib/action.test.ts` redirect pass-through (use `toMatchObject` on the digest); HSTS `toContain("max-age=")` in `tests/e2e/security-headers-csp.spec.ts`.
