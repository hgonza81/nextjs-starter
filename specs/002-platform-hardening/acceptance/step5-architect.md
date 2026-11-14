# Step 5 architect check (PH-T-51)

Scope: ADR 0016, `src/lib/list-params.ts`, `src/db/paginate.ts`, `src/db/index.ts`, `src/lib/list-params.test.ts`, `tests/db/paginate.test.ts`. No shell: nothing was executed, review is by reading.

Verdict: PH-FR-20, PH-FR-21 and PH-AC-37 to 43, 75 are satisfied by the design. No code defect blocks acceptance. ADR 0016 and `docs/architecture.md` C15 were amended to match the code.

## Settled questions

1. **`paginate` vs ADR.** Conforms: `id` tiebreaker always appended; equality only via `eq()` on `columns` entries resolved with `Object.hasOwn`; no `sql.raw` (the ADR 0003 lint rule also covers it); page and count run on the same `tx`; `columns` must include `id` (type-enforced); the `PgTable` cast and the row cast are one each; `params` is structural, so `@/db` does not import `@/lib`. `and(undefined, ...)` with no predicates yields no WHERE, which is correct.
2. **`pageCount` 0 when empty.** Decided and written into ADR 0016 (current behavior, tested in PH-AC-41). UI treats 0 as "no results".
3. **READ COMMITTED.** Recommendation, written as a known limit: accept. Page and count can disagree by concurrent writes; REPEATABLE READ in `withRls` would change ADR 0003 and add retry handling to every use case to fix a cosmetic effect. Escape hatch recorded (opt-in isolation per use case, or keyset). Not decided silently beyond the recommendation: a PO veto would need a new ADR touching `withRls`.
4. **Extra `parseListParams`.** Accept the helper (needed by pages outside `defineAction`; now documented in the ADR). Its private `collectFieldErrors` duplicates the one in `src/lib/action.ts`; both encode the ADR 0015 `_form` convention. SHOULD-FIX (fix-task F1 below).
5. **22P02.** `fromDbError` has no 22P02 case, so it falls to `unexpected` (logged, generic 500-style result). For a URL-supplied value on a uuid or enum column that is wrong: a typo in the URL becomes a logged server error. Do not map 22P02 globally in `fromDbError`: it also signals genuine bugs (bad cast in code, malformed tenant selector, which a `withRls` test relies on as a failure). The correct fix is validation before the query (Q1). Documented as a known limit in the ADR meanwhile. Not a PH-AC failure: no AC requires typed filter values.
6. **URL shape.** Was not in the ADR. Now recorded in ADR 0016 (Decision) and C15, including reserved keys, single occurrence, empty value rejection and `dir` without `sort`.
7. **Client importability / jitless.** Correct as written: no `server-only`, no module-level schema, imports only `@/lib/errors` (client-safe). Rule recorded in ADR and C15. It is a convention without a lint check (note N3).

## Question for the client (via PM), one-way door

Q1. Typed filter values. `listParams({ filters })` today takes only names, so values are untyped strings. Options: (a) leave as is and restrict filters to text columns (simplest, but every uuid or enum filter later needs caller-side checks and a typo yields a logged error); (b) recommended: let `filters` be either `readonly string[]` (any non-empty string, today's behavior) or a record `field -> Zod string schema` (for example `z.uuid()`, `z.enum([...])`), so wrong values return `validation` before any query; (c) map 22P02 to `validation` in `fromDbError` (rejected: hides bugs). No consumer exists yet, so (b) is cheap now and breaking later. Recommend (b) in step 5 or at the start of epic 003.

## Proposed fix tasks (small, no scope change)

- F1 (developer, low): export one `fieldErrorsFromZod(error: z.ZodError): FieldErrors` (type-only `zod` import) from `src/lib/errors.ts`; use it in `src/lib/action.ts` and `src/lib/list-params.ts`; delete both private copies. Existing tests must pass unchanged.
- F2 (tester, trivial): rename the `tests/db/paginate.test.ts` case "the page and count queries see one consistent snapshot in the same transaction" to say what it asserts (READ COMMITTED: a concurrent insert shows up in the second call); the current title contradicts ADR 0016.
- F3 (developer + tester, only if Q1 = b): implement per-field schemas in `listParams` plus tests (uuid filter with a non-uuid value returns `validation`, `tx` never called).

## Notes (not blocking)
- N1: `paginate` throws a plain `Error` for a field missing from `columns`; correct (programmer error), tested.
- N2: PgColumn typing allows a `columns` entry from another table; not guarded, review rule.
- N3: no lint rule enforces the zod-jitless-first import; same status as epic 001 convention.
- N4: leading zeros (`page=007`) are accepted and normalized; harmless.

## Edited
- `docs/adr/0016-pagination.md`: URL shape, entry points, `paginate` rules, empty-result rule, client use, new "Known limits" section (snapshot, filter value types, nullable sort).
- `docs/architecture.md`: C15 row.
