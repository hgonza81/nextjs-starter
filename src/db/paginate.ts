import "server-only";

import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

import type { RlsTransaction } from "./rls";

/**
 * Offset pagination over a transaction (PH-FR-21, ADR 0016).
 *
 * Runs on the `tx` handed out by `withRls`, so RLS applies to the page query
 * and to the count query, which share one transaction. Only Drizzle predicates
 * are used (no raw SQL): filter values are bound parameters, and column names
 * come from the caller's `columns` allow-list, never from request input.
 */

/** Shape of the parsed list parameters (`ListParams` in `@/lib/list-params`). */
type PaginateParams = {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: { readonly field: string; readonly dir: "asc" | "desc" };
  readonly filters: Readonly<Partial<Record<string, string>>>;
};

export type PaginateOptions<Table extends PgTable> = {
  readonly table: Table;
  /**
   * Allow-list mapping a public field name to its column. It must contain
   * `id`, the tiebreaker; every sort and filter field must be a key of it.
   */
  readonly columns: Readonly<Record<string, PgColumn>> & {
    readonly id: PgColumn;
  };
  readonly params: PaginateParams;
  /** Fixed server-side predicate (for example a status scope), ANDed with the filters. */
  readonly where?: SQL;
};

export type Page<Row> = {
  readonly rows: readonly Row[];
  /** Rows matching the filters across all pages. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  /** 0 when nothing matches. */
  readonly pageCount: number;
};

function columnFor(
  columns: Readonly<Record<string, PgColumn>>,
  field: string,
): PgColumn {
  // `Object.hasOwn` so names like "constructor" never resolve via the prototype.
  const column = Object.hasOwn(columns, field) ? columns[field] : undefined;
  if (column === undefined) {
    // Programmer error: `listParams` already rejects unknown fields upstream.
    throw new Error(`paginate: "${field}" is not in the columns allow-list.`);
  }
  return column;
}

/**
 * Returns one page of `table` plus the total count.
 *
 * @throws Error when a sort or filter field is not in `columns` (a mismatch
 *   between `listParams` and `paginate` configuration, not user input).
 */
export async function paginate<Table extends PgTable>(
  tx: RlsTransaction,
  { table, columns, params, where }: PaginateOptions<Table>,
): Promise<Page<Table["$inferSelect"]>> {
  const filterPredicates = Object.entries(params.filters).flatMap(
    ([field, value]) =>
      value === undefined ? [] : [eq(columnFor(columns, field), value)],
  );
  const predicate = and(where, ...filterPredicates);

  const sortColumn = columnFor(columns, params.sort.field);
  const direction = params.sort.dir === "desc" ? desc : asc;

  // Drizzle cannot resolve its conditional `from` type for a generic table, so
  // the query runs on the base `PgTable` and the row type is restored below.
  const baseTable: PgTable = table;
  const rows = await tx
    .select()
    .from(baseTable)
    .where(predicate)
    // `id` makes the order total, so pages never overlap or skip rows.
    .orderBy(direction(sortColumn), asc(columns.id))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);

  const [countRow] = await tx
    .select({ total: count() })
    .from(baseTable)
    .where(predicate);
  const total = countRow?.total ?? 0;

  return {
    // Safe: the select list is the whole table, i.e. `Table["$inferSelect"]`.
    rows: rows as Table["$inferSelect"][],
    total,
    page: params.page,
    pageSize: params.pageSize,
    pageCount: Math.ceil(total / params.pageSize),
  };
}
