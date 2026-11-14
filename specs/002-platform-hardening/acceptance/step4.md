# Acceptance: step 4 (PH-T-41 to PH-T-45)

Epic: 002-platform-hardening. Requirements: PH-FR-17, PH-FR-18, PH-FR-19. Accepted by: product-manager (PH-T-46), fresh instance.

**Evidence basis.** I have no shell and ran nothing. Command results are cited as run by the orchestrator just now: `pnpm db:reset` OK; `pnpm db:schema` produced zero diff in `src/db` (drift check); `pnpm test:db` 265 passed in 9 files (the tester also ran it twice in a row); unit tests 484 passed; lint, typecheck and format clean. File and test-title evidence comes from reading the files. The step 4 architect check (`acceptance/step4-architect.md`) was also by reading only.

## Verdict

**Step 4 accepted.** PH-FR-17, 18 and 19 are met. PH-AC-33 to 36, 68 and 69 are met. PH-AC-37 and 38 are not step 4 criteria (see the table): they belong to PH-FR-21 (pagination, step 5) and are deferred to PH-T-47 to PH-T-50, not failed. No gap needs a Product Owner decision to close step 4. One question for the Product Owner concerns epic 003 (below).

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| PH-FR-17 Conventions documented (ids, naming, timestamps, trigger, hard delete, no audit columns C1, `ON DELETE` per FK) | Met | `docs/adr/0012-database-conventions.md` (Decision, Consequences). The architect check added the seven named rules, the accepted limits and the epic 003 exceptions. It also removed the stale "C1, PO to confirm" text. |
| PH-FR-18 Reusable trigger (`SECURITY INVOKER`, fixed `search_path`, per-table `BEFORE UPDATE`) | Met | `supabase/migrations/20261113120000_set_updated_at_function.sql`. The architect confirmed `SECURITY INVOKER`, `set search_path = ''`, a body using only `now()` and `new`, and no grant. Behavior is covered by the `tests/db/set-updated-at.test.ts` titles below. `pnpm db:reset` applies the migration. |
| PH-FR-19 Convention guard (id uuid PK, timestamps, trigger, snake_case, FK leading index, named allowlist with reason, failures name table and rule, reset and drift still pass) | Met, with recorded limits | `tests/utils/schema-guard.ts` (`findConventionViolations`, seven rules) and `tests/db/schema-guard.test.ts`. Reset and drift are orchestrator-run. See "Recorded limits". |

## Acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| PH-AC-33 ADR 0012 states each decision with its reason and lists the rules enforced by PH-AC-35 | Met | ADR 0012 after the PH-T-45 edits (seven rules named; the architect verdict says PH-AC-33 is satisfied). Checked by reading only. |
| PH-AC-34 Test table with trigger: update changes `updated_at`, not `created_at` | Met | `set-updated-at.test.ts`: "PH-AC-34: an update in a separate transaction advances updated_at and leaves created_at"; "PH-AC-34: an update that matches no row does not error and changes nothing". |
| PH-AC-35 A `public` table violating a convention fails the db suite naming table and rule | Met | `schema-guard.test.ts`: "PH-AC-35: every public table follows the conventions (or is allowlisted with a reason)". Per-rule fail fixtures: no `id` column; composite PK including `id`; no trigger; trigger running a different function; quoted camelCase column and table; FK without explicit `ON DELETE`; FK column leading no index or only second in an index; composite FK covered by only its first column. Pass fixtures: a conforming table with FK and index; composite FK with a matching index prefix; `ON DELETE` cascade, restrict, set null, set default (`it.each`). |
| PH-AC-36 `supabase db reset` and the drift check still pass | Met (orchestrator-run) | `pnpm db:reset` OK; `pnpm db:schema` followed by an empty diff in `src/db`; `pnpm test:db` 265 passed. Not rerun by me. PH-T-44 was closed without a separate agent for this reason (change log, 2026-11-13). |
| PH-AC-68 Allowlisted violation passes, same violation without entry fails naming table and rule, guard-of-the-guard on a throwaway table | Met | "PH-AC-68: an allowlisted violation (table and rule) passes; another rule on it still fails"; "PH-AC-68: an allowlist entry without a reason is rejected"; "PH-AC-35: the harness really dropped the previous convention fixtures" (cleanup). |
| PH-AC-69 Throwaway table with trigger: `updated_at` advances in a separate transaction, `created_at` unchanged, client `updated_at` overwritten, no-op update does not error | Met | `set-updated-at.test.ts`: "PH-AC-69: a client-supplied updated_at is overwritten"; "PH-AC-69: a client-supplied created_at is not touched by the trigger"; "PH-AC-69: a no-op update does not error"; plus the PH-AC-34 update test. Extra test: "ADR 0012: authenticated cannot call set_updated_at() directly, yet the trigger fires for it" (the 42501 check on a direct call). |
| PH-AC-37 Page 2 of size S returns the correct rows in the requested order | Deferred (not a step 4 criterion) | Mapped in spec section 7 to PH-FR-21 (`paginate`), step 5. Covered by PH-T-48 and PH-T-50. |
| PH-AC-38 Equal sort values come back in `id` order | Deferred (not a step 4 criterion) | Same: PH-FR-21, PH-T-48 and PH-T-50. |

Orchestrator note: the request listed 37 and 38 among the step 4 criteria. The spec maps them to PH-FR-21, so I treated them as deferred to step 5. If the orchestrator wants them tracked under step 4, it should say so and name the evidence. None exists today.

## Checks required by PH-T-46

- **No application tables.** Met. The architect read `public` as empty. The real-schema guard test "PH-AC-35: the guard passes when the schema has zero tables" passes. The drift check shows no table files in `src/db` (orchestrator-run). So PH-FR-19 needs no migration or allowlist entry for existing tables.
- **No audit or soft-delete columns (C1).** Met. ADR 0012 states hard delete and no audit columns, and C1 is confirmed there. No table exists to contradict it.

## Recorded limits (accepted, not defects)

1. `ON DELETE` is enforced as "not NO ACTION". A deliberate NO ACTION must be written as `RESTRICT` (documented in ADR 0012).
2. Plural table names and `<singular>_id` column naming are not checked. Only snake_case is.
3. The Drizzle pull omits triggers, so the guard is the only automated check for the trigger (stated in ADR 0012 and `docs/architecture.md`).
4. An allowlist entry exempts the whole rule for that table (granularity noted by the architect).
5. `public` has no tables, so the rules run on fixtures only until epic 003. PH-FR-19 is satisfied (zero-table pass test).
6. Not executed by me: the tests ran under the orchestrator and tester. The architect's check was by reading.

## Optional follow-up (not decided here)

Architect proposal N1 (FIX-A, developer and tester, low priority): the trigger rule currently accepts `BEFORE UPDATE OF <cols>`, triggers with a `WHEN` clause, and disabled triggers (`tgenabled = 'D'`). Proposed fix: add `tgattr = ''::int2vector and tgqual is null and tgenabled <> 'D'` to the `pg_trigger` query, with three tester cases. It is documented in the ADR as a review rule, so skipping it is acceptable. The Product Owner and orchestrator decide whether to add a fix task. I recommend adding it to the backlog, not to the epic. Smaller notes (partial index counts as covering an FK; `oid::int` cast) are non-blocking and need no action.

## Epic 003 inputs (recorded, not decisions)

Source: `specs/003-auth-memberships/notes-from-002.md` and ADR 0012, "Expected exceptions in epic 003".

- `profiles` (`id` = `auth.users.id`, no default) needs an allowlist entry for `id-uuid-primary-key`.
- `memberships` (composite PK `(tenant_id, user_id)`, no `id`) needs an allowlist entry for `id-uuid-primary-key`. It also needs entries for the `updated_at` and trigger rules while it has no `updated_at`.
- Foreign keys need an explicit `ON DELETE` and a leading index. `tenants.created_by` is a domain column, and `memberships.user_id` needs its own index.
- The current 003 requirements give `profiles` and `memberships` no `updated_at`.

## Product Owner decision needed (for epic 003, not blocking step 4)

Should `profiles` get `updated_at` plus the trigger (the architect recommends yes), and should `memberships` stay allowlisted for both rules until a `role` column exists (the architect's recommendation)? Alternative: add `updated_at` to both so the allowlist has only the `id` exceptions. To be taken to the Product Owner in the 003 review round.
