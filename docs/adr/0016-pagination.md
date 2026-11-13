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
- Keyset is a future per-list sibling (a `cursor` variant); no schema change is needed to add it.

## Consequences
- Positive: one contract and one safe query path; RLS-consistent totals; stable ordering.
- Negative: two queries per list; deep offsets are slower (capped); totals can race with concurrent writes (acceptable for an MVP).
- Revisit: switch a specific list to keyset when it grows past what offset serves.

## References
- ADR 0001 (layering), ADR 0003 (`withRls`), ADR 0011 (Zod), ADR 0015.
- Epic 002 `questions.md` (D12).
