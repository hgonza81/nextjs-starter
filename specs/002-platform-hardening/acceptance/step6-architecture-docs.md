# Step 6: architecture docs check (PH-T-56)

Static check by reading (no shell). Compared `docs/architecture.md` and `docs/adr/README.md` with `src/`, `scripts/`, `docker/`, `next.config.ts`, `package.json` scripts, `.github/workflows/ci.yml` and ADRs 0012 to 0016.

## Verified, no change needed
- ADR table in `architecture.md` and the index in `docs/adr/README.md` list 0001 to 0016; 0012 to 0016 are `Accepted` in the README and in each ADR file.
- Scripts `obs:start`, `obs:stop`, `gen:module` exist and match the text; `gen:module` text (only `index.ts`, kebab-case, no overwrite) matches `scripts/gen-module.mts`.
- C13 (guard, limits), C15 (reserved keys, bounds, `id` tiebreaker, `pageCount` 0), startup-validation wording (register() failure keeps the process alive, answers 500), `onRequestError` fields, lint table rows.

## Changed in `docs/architecture.md`
1. Layout: added `design/errors/` (fault routes) and `design/frames/`; `src/lib` now lists `db-error.ts`, `zod-jitless.ts`, `fault-injection.ts`, `fieldErrorsFromZod`; `tests/` lists `lint/` and `scripts/`; `scripts/` lists `e2e-server.mts`; proxy line notes the CSP must be kept.
2. C6: shared `fieldErrorsFromZod`, `_form` key, `fromDbError`.
3. C8: documented limit that Next prints raw error output, with the rules from ADR 0015.
4. C11 and Environment: there are two `NEXT_RUNTIME` reads in `instrumentation.ts` (register and `onRequestError`), not one; removed "only extra read" wording.
5. C14: `connection()` in the root layout, `/design/frames/*` as the only framable path, `/api/*` without CSP, jitless-first-import convention (enforced by the E2E violation fixture, not lint), session refresh must preserve the CSP.
6. C15: typed filters (name list or per-field Zod schema), 22P02 not mapped globally.
7. Guardrail table, ADR 0014 row: jitless-first-import and what catches a miss.
8. Environment, `DESIGN_PAGE_ENABLED`: fault routes and `assertFaultInjection()` ship in production and the flag must stay off in real deployments (note N2). Design section line extended to frames and errors.
9. CI table: `gen:module` smoke step in `fast`.

## Not changed, for the orchestrator
- Code comment in `scripts/gen-module.mts` (`INDEX_CONTENT`) lists folders "actions, schemas, services, data, components", while C1 says `actions, queries, schemas, components` (plus `types.ts`). Docs say C1 is the convention; the generated header should match. Suggest a developer fix (comment only, but it is in the generated file and a test may assert it).
- `next.config.ts` X-Frame-Options sources: `/design/frames` (exact, no trailing segment) is excluded from the DENY source but matched by the SAMEORIGIN source `/design/frames/:path*`, while `isFramablePath` in the proxy needs the `/design/frames/` prefix. Fails closed (CSP `frame-ancestors 'none'` wins, a 404 path). Already known as optional F-1 in step3-architect.md; docs say `/design/frames/*`, which is correct.
- No hard-to-reverse decision found without an ADR.
- Not verified: no commands were run (prettier, lint, markdown table rendering). Orchestrator to run `pnpm format:check`.
