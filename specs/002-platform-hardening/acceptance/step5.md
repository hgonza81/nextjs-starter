# Acceptance: step 5 (PH-T-47 to PH-T-51, PH-T-65 to PH-T-67)

Epic: 002-platform-hardening. Requirements: PH-FR-20, PH-FR-21. Accepted by: product-manager (PH-T-52), fresh instance.

**Evidence basis.** I have no shell and ran nothing. Command results are cited as run by the orchestrator just now: `pnpm lint`, `pnpm typecheck` and `pnpm format:check` clean; `pnpm test` 566 passed; `pnpm test:db` 300 passed (the tester ran it twice in a row at the previous task). File and test-title evidence comes from reading `src/lib/list-params.ts`, `src/db/paginate.ts`, `src/db/index.ts`, `src/lib/errors.ts` usage, `src/lib/list-params.test.ts`, `tests/db/paginate.test.ts` (test titles via search) and `acceptance/step5-architect.md` (also by reading only).

## Verdict

**Step 5 accepted.** PH-FR-20 and PH-FR-21 are met. PH-AC-37 to 43 and 75 are met. The recorded limits below are accepted, documented in ADR 0016, and none contradicts an acceptance criterion. No gap needs a Product Owner decision to close step 5. One optional item is listed at the end.

## Requirements

| ID | Status | Evidence |
|----|--------|----------|
| PH-FR-20 `listParams` (Zod schema; page, size, sort, equality filters; plain base-10 integers; page 1 to 10,000; defaults 20 / max 100; unknown keys, sort and filter fields rejected as `validation` before any query) | Met | `src/lib/list-params.ts`: `boundedInteger` uses `/^\d+$/` before `Number`; `MAX_PAGE = 10_000`; `MAX_PAGE_SIZE_LIMIT = 100`, default 20; `z.strictObject` rejects unknown keys; `z.enum(sortable)`; filters as names or a record of Zod schemas; `parseListParams` turns failure into a `validation` AppError. Misconfiguration (empty or overlapping names, page sizes above 100, reserved-key filter) throws a plain Error. The module is pure (test "the source imports no database module"). |
| PH-FR-21 `paginate(tx, { table, columns, params, where? })` from `@/db` (returns `{ rows, total, page, pageSize, pageCount }`; sort then `id`; same-transaction count so RLS applies; parameterized predicates only; empty page is not an error) | Met | `src/db/paginate.ts` and the export in `src/db/index.ts` (line 12). `.orderBy(direction(sortColumn), asc(columns.id))`; page and count both on `tx`; only Drizzle `eq`/`and` predicates (no raw SQL); `columnFor` uses `Object.hasOwn`; `columns` must contain `id` (type-enforced). Offset past the end returns `[]` with the real total. |

## Acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| PH-AC-37 Page 2 of size S returns the correct rows in the requested order | Met | `paginate.test.ts`: "PH-AC-37: page 2 of 25 rows with size 10 returns rows 11 to 20 and the counts"; "the last page holds the remainder"; "descending sort returns the highest values first"; "a row count that is an exact multiple of the page size has no empty last page"; "a sort field name maps to its column". |
| PH-AC-38 Equal sort values are returned in `id` order | Met | "PH-AC-38: 25 rows sharing one sort value page in id order with no repeat and no skip"; "with a descending sort, ties are still ordered by id ascending"; "pages with duplicate sort values together cover every row exactly once". |
| PH-AC-39 Defaults are page 1, size 20 (and the documented defaults apply) | Met | `list-params.test.ts`: "PH-FR-20: empty input gives page 1, size 20, default sort, no filters"; "honors a custom defaultPageSize and maxPageSize"; "a dir without sort applies to the default sort field"; "a sort without dir uses the default direction". "PH-AC-39: validation fails before the query callback could run" and "PH-AC-39: a failing typed filter fails before the query callback could run" cover the "`tx` never called" half. |
| PH-AC-40 Size above 100, page 0, negative, non-integer, above 10,000, unknown sort or filter field return `validation`, no query | Met | `describe "listParams boundaries"`: `it.each` accepts page 1 and 10000, size 1 and 100; rejects page 0 and 10001, size 0 and 101. Rejections: "rejects an unknown key as a form-level error"; "rejects an unknown sort field"; "rejects an unknown filter field as an unknown key"; "rejects an invalid dir"; "rejects an empty filter value"; "rejects non-object input"; "groups several problems by field in one error"; "error message is safe and does not echo input". Negative values are covered by the PH-AC-75 `-1` cases. Typed filters: "still rejects an empty value for a typed filter"; "rejects a repeated key for a typed filter"; "rejects an unknown filter key next to typed filters". |
| PH-AC-41 Page beyond the last, or no match, returns an empty page | Met | `paginate.test.ts`: "a page beyond the last returns empty rows with the real total"; "an empty table returns empty rows, total 0 and pageCount 0 (current behavior)"; "a filter that matches nothing returns empty rows, not an error"; "a parsed page 10000 (the listParams cap) works and is empty when beyond the data". |
| PH-AC-42 With RLS, two users each see only their own rows (count included) | Met | "PH-AC-42: two users each see only their own rows and their own total"; "total and pageCount exclude rows hidden by RLS"; "a filter cannot reach another user's rows"; "a user who owns no row gets an empty page". Runs under `test:db` (orchestrator-run, 300 passed). |
| PH-AC-43 Hostile filter value is treated as data | Met | "PH-AC-43: a SQL-looking filter value is matched as data and the table survives"; "a tautology filter value does not widen the result"; "the columns allow-list is the only way to reach a column (owner_id is not sortable by its SQL name)". |
| PH-AC-75 Page 10,001, `1e3` or `1.5` returns `validation`, not a database error | Met | `it.each` "PH-AC-75: rejects the non-integer page %j without reaching Number()" over `1e3`, `1.5`, `+1`, ` 1`, `1 `, `0x10`, empty, `-1`, `1_0` and a non-ASCII digit; the same for `pageSize`; "rejects a number type"; "accepts leading zeros as base-10 digits". Page 10001 is in the boundary `it.each`. |

## Checks required by PH-T-52

- **Fix tasks closed.** PH-T-65 (one shared `fieldErrorsFromZod`): met. It is defined in `src/lib/errors.ts` line 78 and used by `src/lib/action.ts` and `src/lib/list-params.ts`; no private copy remains in `src/`. PH-T-66 (typed filters): met, see `ListParamsConfig.filters` and the tests in "listParams typed filters, record form". PH-T-67 (tests and rename): met. The contradictory snapshot test title is now "documents READ COMMITTED behavior, a concurrent insert appears in the second paginate call of the same transaction (ADR 0016)".
- **No scope creep.** Two additions beyond the literal FR text, both recorded and accepted:
  1. `parseListParams` helper, for pages outside `defineAction`. Accepted by the step 5 architect check and documented in ADR 0016. It is not named in PH-FR-20 text; it is a thin wrapper, not new behavior.
  2. Typed filter values (record form). Recorded in the spec change log (2026-11-13) as an extension of PH-FR-20 by orchestrator decision (the Product Owner delegated technical decisions). The plain name list remains valid.
  Nothing else found: no keyset pagination, no search or operators, no UI. `paginate` is exported from `@/db`; `listParams` stays outside `@/db`.
- **Traceability.** Spec section 7 maps PH-HR-09 to PH-FR-20 and 21 and to PH-AC-37 to 43 and 75 at `test:db` and unit level. Every AC above has at least one named test.

## Recorded limits (accepted, not defects)

1. `pageCount` is 0 when nothing matches (tested, in ADR 0016). A UI treats 0 as "no results".
2. READ COMMITTED: page and count queries share a transaction but not a snapshot, so under concurrent writes they can disagree. Known limit, ADR 0016. The test documents it. Escape hatch recorded: opt-in isolation per use case, or keyset.
3. Filter typing: with the array form, a wrongly typed value on a uuid or enum column reaches Postgres and fails with 22P02, which `fromDbError` maps to `unexpected` (logged). The record form (`z.uuid()`, `z.enum(...)`) returns `validation` first. Text columns need no schema. Mapping 22P02 globally was rejected because it hides real bugs. Test: "a filter value that does not fit the column type is rejected by Postgres (22P02)". Mitigation is a convention, not enforced: a list over a non-text column should use the record form.
4. Equality filters only (no ranges, `like`, or `in`). Matches PH-FR-20 text.
5. `columns` is typed as `PgColumn` and could hold a column from another table; not guarded. Review rule (architect N2).
6. Offset pagination only; deep pages are bounded by the 10,000 page cap and 100 page-size cap.
7. No lint rule enforces importing `@/lib/zod-jitless` first in a client file calling `listParams` (architect N3); same status as the epic 001 convention. Leading zeros (`page=007`) are accepted and normalized (N4).
8. Not executed by me: tests ran under the orchestrator and tester. The architect check was by reading.

## Product Owner decisions

None needed to close step 5.

Optional, non-blocking: limit 3 (22P02 on the array form) and limit 5 (foreign-table column) are convention-only. If the Product Owner wants them enforced, a small lint or type guard could be backlog items; I recommend leaving both to the backlog until epic 003 has a first list screen.
