# 0016. Pagination

Status: Accepted
Date: 2026-11-13
Epic: 002-platform-hardening

## Context
Every list in later modules (members, tenants, and so on) needs paging, sorting and filtering. The parameter contract is a public API shape and the query helper touches RLS, so both should be decided once. `src/lib` cannot import `src/db` (ADR 0001), so the helper must be split.

## Options considered
1. **Offset with total count** (chosen): page numbers and "N of M" in the UI; simple; cost grows with deep pages (bounded by a page cap).
2. **Keyset (cursor):** stable and fast at any depth; no page numbers or totals, more complex per list.
3. No shared helper (each module writes its own): inconsistent, repeated injection risks.

## Decision
Option 1.
- **`src/lib/list-params.ts` (pure, Zod):** `listParams({ sortable, filters, defaultSort, defaultPageSize: 20, maxPageSize: 100 })` returns a schema that parses `searchParams` into `{ page, pageSize, sort: { field, dir }, filters }`. Page is a plain base-10 integer (`1e3`, `1.5`, negative and non-numeric values are rejected), >= 1 and capped at 10,000; page size likewise, 1 to 100; unknown keys, sort fields and filter fields are rejected; invalid input becomes a `validation` AppError (ADR 0015) before any query. Filters are equality on allow-listed fields only; other operators and text search are added per list when a module needs them.
- **`src/db/paginate.ts`, exported from `@/db`:** `paginate(tx, { table, columns, params, where? })` returns `{ rows, total, page, pageSize, pageCount }`. Parameterized Drizzle predicates only; `ORDER BY` always appends `id` as a tiebreaker (stable order); the count is a second query on the same `tx`, so RLS applies to rows and total alike; a page past the end returns `rows: []` with the real total.
- **URL shape (public contract):** `?page=2&pageSize=50&sort=name&dir=desc&<filterField>=<value>`. Each filter is a top-level key named after its field. `page`, `pageSize`, `sort` and `dir` are reserved: `listParams` throws at configuration time if a filter uses one of them. Every key appears at most once (repeated keys are rejected), an empty filter value is rejected, and `dir` without `sort` applies to the default sort field.
- **Entry points:** `listParams(config)` returns the Zod schema; `parseListParams(schema, searchParams)` is the one throwing helper for callers outside `defineAction` (a page reading `searchParams`) and raises the `validation` AppError with `fieldErrors` grouped as in ADR 0015 (`_form` for unknown keys). Inside `defineAction`, pass the schema directly.
- **`paginate` rules:** `columns` maps public field names to columns and must contain `id` (the tiebreaker; enforced by the type). Sort and filter fields resolve only through `Object.hasOwn(columns, field)`; a miss is a programmer error (plain `Error`), not user input. `where` is a fixed server-side `SQL` ANDed with the filters, and equality values are bound parameters. The base `PgTable` cast and the row-type cast each live in one place inside `paginate.ts`. Its `params` type is structural (`page`, `pageSize`, `sort`, `filters`), so `@/db` does not import `@/lib/list-params`; the two meet only at the call site.
- **Empty results:** `pageCount` is `0` (not 1) when nothing matches, and `Math.ceil(total / pageSize)` otherwise. A page past the end returns `rows: []` with the real `total` and `pageCount`. UI treats `pageCount === 0` as "no results", not as an empty page 1.
- **Client use:** `src/lib/list-params.ts` has no `server-only` and creates no schema at import time, so a client component may validate URL state. A client file that calls `listParams` must import `@/lib/zod-jitless` first (ADR 0014); this is a convention, not a lint rule.
- Keyset is a future per-list sibling (a `cursor` variant); no schema change is needed to add it.

## Consequences
- Positive: one contract and one safe query path; RLS-consistent totals; stable ordering.
- Negative: two queries per list; deep offsets are slower (capped); totals can race with concurrent writes (see "Known limits").
- Revisit: switch a specific list to keyset when it grows past what offset serves.

## Known limits
- **Snapshot:** the page query and the count query run in one transaction, but `withRls` uses PostgreSQL's default READ COMMITTED, so they do not share a snapshot. A row committed between them can make `total` and `rows` disagree by the rows concurrently inserted or deleted. Accepted: offset pagination under concurrent writes is approximate by nature (pages can also shift between requests), and UI must not assume `rows.length` is consistent with `total`. Rejected for now: REPEATABLE READ in `withRls` (a design change to ADR 0003 that adds serialization-failure retries to every use case, to fix a cosmetic effect). If one list needs an exact snapshot, add an opt-in isolation level to `withRls` for that use case, or move that list to keyset. `tests/db/paginate.test.ts` documents the READ COMMITTED behavior.
- **Filter value types:** filter values are strings bound as parameters; `listParams` does not check them against the column type. A value of the wrong type (a non-uuid on a uuid column, an unknown enum label) is rejected by PostgreSQL with `22P02`, which `fromDbError` maps to `unexpected` (generic message, logged). That is wrong for a user-editable URL: the proper fix is per-field value schemas in `listParams` (open question Q1 in `acceptance/step5-architect.md`). Until then, allow-list filters only on text-like columns, or validate the value in the caller.
- **Nullable sort columns:** PostgreSQL puts NULLs last for `asc` and first for `desc`; the order stays total because of the `id` tiebreaker.

## References
- ADR 0001 (layering), ADR 0003 (`withRls`), ADR 0011 (Zod), ADR 0015.
- Epic 002 `questions.md` (D12).
