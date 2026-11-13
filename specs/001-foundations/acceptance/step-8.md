# Acceptance record: step 8, conventions and enforcement (FND-T-36 to FND-T-38, FND-T-61, FND-T-62)

Task: FND-T-39. Acceptor: product-manager. Date: 2026-11-12.
Scope: FND-FR-12, FND-FR-13, Definition of Done item 7, FND-HR-10 (structure), the scope gate for the extra `sql.raw` and `process.env` checks.

## Verdict

**Step 8 accepted, with notes. No rejected items.** Every rule (a) to (f) has a documented convention, a lint rule and a test that reports an illegal import and passes a legal one. The T-61 gap fix is covered by tests. Nothing beyond the spec was added except the two ADR-derived checks the PO accepted. One documentation point (stale "Known gaps" text) is owed to the architect.

## Method and limits

- Evidence: my reading of `eslint.config.mjs`, `tests/lint/boundaries.test.ts`, `tests/lint/fixtures/**`, `docs/architecture.md` (Conventions C1 to C12, "Lint rules"), ADR 0001 amendments (T-18 and T-36), `vitest.config.mts`, `.github/workflows/ci.yml`, spec 8.3 and section 13.
- **Limit: this session had no shell.** I ran no command. The orchestrator ran and confirmed on HEAD: `pnpm lint` and `pnpm typecheck` clean, `pnpm test` 242/242 in 16 files, git tree clean.
- I did not re-prove the "removing a rule makes its test fail" criterion of T-38 myself. By reading, each `it.each` asserts a specific rule id (`no-restricted-imports`, `no-restricted-syntax`, `no-restricted-properties`, `import/no-cycle`) on a zone-specific virtual path, so a removed rule or zone would drop the id and fail; a mutation run was not repeated by me.

## Traceability: rule -> convention -> lint rule -> test

| FR-12 rule | Convention (docs/architecture.md) | Lint rule (`eslint.config.mjs`) | Test (`tests/lint/boundaries.test.ts`) | Verdict |
|------------|-----------------------------------|---------------------------------|----------------------------------------|---------|
| (a) modules only through `index.ts` | C1, C4; ADR 0001 rule 1 | `no-restricted-imports`: `@/modules/*/**` and `**/modules/*/**` on every linted file; inside `src/modules/**` the relative pattern is replaced by "do not climb out" at depths 1 to 4 | describe (a): 10 illegal (alias from app, components, tests, another module; relative from app and tests; climbs at depths 1 to 4) and 6 legal (public API from app, tests, another module; same-module relative at two depths; `@/lib`) | Accepted. Proven on virtual files only, as the spec allows (no module folders yet) |
| (b) `src/lib` does not import `src/modules` | C1; ADR 0001 rule 2 | `src/lib/**` zone: `libForbidden` (`@/modules`, `@/db` and their subpaths, `**/modules/**`) plus `dbInternals` (T-61) | describe (b): `@/modules`, `@/db`, `@/db/rls` reported; `./utils` and `zod` pass. T-61 tests under (d): relative `../db/client` and `../db/rls` from `src/lib` reported | Accepted with note N1 |
| (c1) `src/db` does not import `src/modules` | ADR 0001 rule 2 | `src/db/**` zone: `dbForbidden` | describe (c): `src/db` importing a module reported; `./client` and `@/lib/utils` pass | Accepted |
| (c2) `app` and UI do not import `@/db` | C5, C9; ADR 0001 rule 3 | `src/app/**`, `src/components/**`, `src/hooks/**` zone: `dbFromUi` (`@/db`, `../**/db`) plus `dbInternals` | describe (c): reported from app, components and hooks, and by relative path from app; module public API passes | Accepted |
| (c2) exception: `/api/health/db` | ADR 0001 amendment (T-18); spec FR-12 | One later override for `src/app/api/health/db/route.ts` drops only `dbFromUi` | describe (c) exception: the route passes `@/db`; still reports `@/db/client`, `@/db/rls` and a deep module import; the exception is not extended to a sibling health route, a route in another folder, or a page | Accepted. The exception is exactly one path, as the spec says |
| (d) raw DB client only inside `src/db` | C9; ADR 0003 | `dbInternals` (`@/db/**`, `**/db/client`, `**/db/rls`, `**/db/schema`, `**/db/schema/**`) on `src/**`; the `src/db/**` zone omits it | describe (d): four internals reported from `src/lib` and `src/app`; relative path from app; **relative client and rls from `src/lib` (T-61)**; module importing the client reported; `src/db` importing `./client` and a module using `@/db` pass; `tests/**` exemption pinned | Accepted |
| (e) no import cycles | ADR 0001 rule 4 | `import/no-cycle` on every linted file (plugin already registered by `eslint-config-next`; no new dependency) | describe (e): real fixture files `tests/lint/fixtures/cycle/{a,b}.ts` reported, `acyclic/{a,b}.ts` pass; fixtures are in `globalIgnores`, so normal lint and build skip them | Accepted |
| (f) supabase-js `.from()` / `.rpc()` restricted | C10; ADR 0003 | `no-restricted-syntax`: `.rpc()` and `.from("literal")` excluding `Array`/`Buffer`, on every linted file (tests included) | describe (f): `.from("t")`, `.rpc()`, chained `.schema().from()` reported in `src/modules`, and in `tests/`; false-positive guard: `Array.from`, `Buffer.from`, Drizzle `.from(table)` pass | Accepted with the known limit N2 (documented in architecture.md) |

Rules run in `pnpm lint` and in CI: `ci.yml` job "Fast checks (blocking)" runs `pnpm lint` and `pnpm test`; `vitest.config.mts` includes `tests/lint/**/*.test.ts` in the unit project, so the rule tests run with no Docker.

## FND-FR-13: conventions document

| Criterion | Evidence | Verdict |
|-----------|----------|---------|
| Document exists with layout, kebab-case, named exports, `@/` alias, Server Components by default, Server Actions with typed result, Zod at the boundary, error logging without PII, all queries use the `withRls` transaction | `docs/architecture.md` C1 to C9 cover each item in that order (C1 layout, C2 kebab-case, C3 named exports, C4 alias, C5 Server Components, C6 Server Actions result, C7 Zod, C8 logging without PII, C9 `withRls`) | Met |
| Links ADRs 0001 to 0005 | Five `adr/000[1-5]` links found in the file; ADRs 0006 to 0011 were added by T-62 | Met |
| Each FR-12 rule is traceable to a convention | The "Lint rules" table has columns FR-12, Rule, Convention / ADR, ESLint mechanism, Documented exceptions; matches my table above | Met |
| Reviewed by the architect | The document was written by the architect in T-36 | Met |

Conventions C2, C3, C5 (partly), C6, C7, C8 are not mechanically enforced; the spec asks only for documentation (FR-13) and traceability of the FR-12 rules, so this is not a gap. C12 (Conventional Commits) is documented, not enforced, as stated.

## Scope check

| Item | Finding | Verdict |
|------|---------|---------|
| `sql.raw` only in `src/db/rls.ts` | Not in FR-12's list; derived from ADR 0003 and the ADR 0001 T-18 amendment; accepted by the PO. Rule, convention C9, tests present (src reported, `rls.ts` and `tests/**` pass, parameterised `sql` tag passes) | In scope (accepted extra) |
| `process.env` only in `env.ts` / `env.server.ts` (+ `NEXT_RUNTIME` in `instrumentation.ts`) | Not in FR-12; derived from ADR 0004 (C11); accepted by the PO. Tests cover modules, app, `src/db`, `src/lib`, the two allowed files, and four bypass shapes in `instrumentation.ts` | In scope (accepted extra) |
| `tests/**` exempt from raw-client, `sql.raw` and `process.env` rules | Documented in ADR 0001 amendment, architecture.md (rows d, `sql.raw`, `process.env`; "How the rules treat other files") and pinned by three "current behavior" tests. `tests/**` still gets (a), (f) and `import/no-cycle` | Consistent and documented |
| `hooks` and `components` folders added to rule (c2) | Spec says "app and UI components"; hooks are UI code. Cheap and within intent | Accepted |
| New dependency or new rule beyond the above | None: no dependency added (plugin already comes with `eslint-config-next`); no rule beyond (a) to (f), `sql.raw`, `process.env`, cycles | Clean |
| Empty module folders created | None; `src/modules` does not exist | Clean |
| T-61 | Adds only the `dbInternals` group to the `src/lib` zone and turns the `it.todo` into two tests; no other rule touched | In scope (FR-12) |
| T-62 | Docs only (ADRs 0006 to 0011, index, links); outside FR-12 but required by AGENTS.md and requested by the PO | Accepted |

## T-61 gap fix

- Config: `src/lib/**` zone now passes `libForbidden` and `dbInternals`, with a comment explaining the relative forms. The pattern set is complete, as the file header requires for flat-config replacement.
- Tests: describe (d), "reports a relative path to the raw %s from src/lib" runs for `../db/client` and `../db/rls`. No `it.todo` remains in the file (I searched for `todo`).
- Covered by a test: yes.

## Do the boundary rules break design files?

No, by reading and by the orchestrator's clean `pnpm lint`:

- A search of `src/app/design/**`, `src/components/**` and `src/hooks/**` for `@/db`, a path ending in `/db`, or `modules` found no match, so rules (a), (c2) and (d) have nothing to report there.
- `eslint.config.mjs` has no carve-out for design files and needs none. They are ordinary `app` and UI code, as architecture.md says. The raw-value check stays in `src/design-consistency.test.ts` (Vitest), not ESLint, as accepted in step 7.
- `src/db/rls.test.ts` importing `./client` and `src/app/api/health/db/route.test.ts` using `vi.mock("@/db")` are legal under the zones (checked by reading; lint is clean).

## Notes

- N1: Rule (b) is only partly covered for relative paths. `../db/client` and `../db/rls` from `src/lib` are now reported (T-61), but a relative import of the data-layer index (`../db`, `../db/index`) is not, and `../modules` from `src/lib` has no dedicated test (the pattern `**/modules/**` exists). The architecture.md "Known gaps" item 1 still says only `@/db` is reported, which is now stale (T-61 narrowed it). Not reachable by today's code; the hardening is already described (`import/no-restricted-paths`).
- N2: The other known gaps in architecture.md (new top-level folder or root file importing `@/db`; module files deeper than four levels; rule (f) false positive on `Uint8Array.from("ab")` and misses on template-literal or variable arguments) are documented, none reachable today, and are not scope of FR-12 as written (the spec's criterion is a fixture per rule).
- N3: Test readability: the (b) table contains `'import { x } from "../db";'.replace("../db", "@/db/rls")`, which just yields `@/db/rls`. Harmless; a plain string would be clearer. Cosmetic.
- N4: The T-38 and T-61 tasks have no Execution note in `tasks.md` (only this task's note is added now). Facts live in the test header, architecture.md and the commits.

## Open points by owner

| Point | Owner |
|-------|-------|
| Update architecture.md "Known gaps" item 1 to say that `../db/client` and `../db/rls` from `src/lib` are now reported (T-61) and only `../db` / `../db/index` remain; mention T-61 where the section says what T-38 proves | architect (T-43 docs pass) |
| Replace the contrived `.replace(...)` case in the (b) test with a plain string; optionally add a `../modules/x` case from `src/lib` | tester (optional, cosmetic) |
| Decide whether to schedule the resolver-based hardening (`import/no-restricted-paths`) | PO, via orchestrator. Default: defer to the start of epic 002, when real modules exist and rules (a) to (c) are first exercised on real code |
| Final sign-off of Definition of Done item 7 | T-48 (final epic acceptance) |

## Result by requirement

| Requirement | Verdict |
|-------------|---------|
| FND-FR-12 | Met (rules a to f, each with an illegal and a legal test; exception limited to one path; run in `pnpm lint` and CI; notes N1, N2) |
| FND-FR-13 | Met |
| DoD item 7 | Met for step 8; final sign-off in T-48 |

PO decisions required now: none.
