# Step 1 architect check (PH-T-21)

Date: 2026-11-13. Scope: ADR 0015, ADR 0013 (logger and hook part), all step 1 code and tests. No code was changed. ADR text was amended directly.

## Verdict
No must-fix code defect. Step 1 can be accepted (PH-T-22) once the orchestrator commits the ADR edits. Module boundaries hold: `src/lib/*` imports nothing from `src/modules` or `src/db`; the only `@/db` user is the health route (documented exception); `no-console` is on with the logger as the sole exemption.

## Settled items
1. **Async logger and guarded `headers()`: accepted.** `Promise<void>` is forced by the async `headers()`; the promise never rejects. The try/catch also swallows Next's dynamic-usage signal, which would only matter in prerenderable code. Every caller is dynamic (actions, route handlers, hook) and the root layout forces dynamic rendering with `connection()`. Recorded in ADR 0013 with the rule "do not log from prerenderable or `use cache` code". Note: if `cacheComponents` is ever enabled, re-check this (headers access during prerender may not throw but wait); the repo does not enable it.
2. **`fieldErrors` grouping: ADR amended to match the code** (first path segment, form-level under `_form`). Trade-off recorded: nested paths collapse to the top-level field; a real field named `_form` would collide (none exists; reserved).
3. **Hook reads `request.headers` through `pickRequestId`: ADR 0013 note added**, with the reason (`headers()` not readable for route handlers, PH-T-63). Only the two id headers are read. `docs/architecture.md` C8 updated to list `request_id`.
4. **Raw framework output: documented limit, no fix task.** Next prints the error (message, stack) before the hook runs; the app cannot silence it without patching `console` (against the no-console rule, fragile). It never reaches the client (PH-AC-11 is tested). Real exposure is a DrizzleQueryError message (SQL plus parameters) from an unwrapped path. Mitigation is a rule, now in ADR 0015 Consequences: DB access goes through `defineAction`; route handlers that touch the DB catch and use `logger.exception`; error messages must not embed personal data. Proposal (not scope creep, optional, for step 6 PH-T-57): one sentence in the README security notes pointing to that ADR section. A deployment-level mitigation (platform log filtering) is out of scope for a starter.
5. **Developer-chosen names recorded in ADR 0015:** event names (`request.unhandled_error`, `action.unexpected_error`, `action.failed`, `health.db.failed`), `requireRow` and the location of `fromDbError` (`src/lib/db-error.ts`), `StatusPage` `isEmbedded`/`titleRef`, `ref` = 8 hex chars (already stated), the `assertFaultInjection()` seam with its fallback (spec C4, PH-FR-23).
6. **OpenTelemetry peer range:** repo pins `@opentelemetry/api` 1.10.0; `sdk-trace-base` 2.12.1 wants `>=1.3.0 <1.10.0`. Recommendation recorded in ADR 0013: pin api to the highest 1.9.x passing the 24h gate (the logger uses only `trace.getActiveSpan` and `isSpanContextValid`, stable in 1.9), after PH-T-23 confirms `sdk-node` and the exporters accept it; `peerDependencyRules.allowedVersions` only as a justified fallback. PH-T-23 decides.

## Must-fix
None.

## Notes (should-fix at convenience, no task required)
- N1. `src/lib/errors.ts` comment on `FieldErrors` still says "the shape produced by `z.flattenError(...).fieldErrors`". Stale after item 2. Proposed tiny fix task (developer, `docs`-level comment only): replace with "field name to messages; grouped by first path segment, form-level issues under `_form` (see `defineAction`)". Can be folded into any later commit touching that file.
- N2. `/design/errors` fixtures and `assertFaultInjection()` ship in the production build, inert unless `DESIGN_PAGE_ENABLED` is on (accepted in spec C4; gate unit-tested). Keep the flag off in any real deployment; step 6 README should say so.
- N3. ADR 0013 still describes the OTel log bridge and `@opentelemetry/api-logs`; they do not exist yet (PH-T-26, step 2). Consistent with the plan, not a defect.
- N4. The `_form` key is a convention for client forms (epic 003 forms must read it); no shared helper exists. Acceptable until a form needs it.

## Files edited
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/docs/adr/0015-error-model-and-action-wrapper.md`
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/docs/adr/0013-observability.md`
- `/Users/hernangonzalezbuteler/dev/nextjs-starter/docs/architecture.md`
- this file
