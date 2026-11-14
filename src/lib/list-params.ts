import { z } from "zod";

import { fieldErrorsFromZod, validationError } from "@/lib/errors";

/**
 * List parameters (PH-FR-20, D12, ADR 0016): parses URL search params into
 * `{ page, pageSize, sort, filters }`. Pure: no database import, no I/O.
 * `paginate` (`@/db`) consumes the parsed value.
 *
 * Client-importable on purpose (no `server-only`): a list screen may validate
 * its URL state in the browser. Schemas are created inside `listParams`, never
 * at module level, so importing this file alone creates no Zod schema. A client
 * file that calls `listParams` must import `@/lib/zod-jitless` FIRST (ADR 0014).
 *
 * URL shape: `?page=2&pageSize=50&sort=name&dir=desc&<filterField>=<value>`.
 * Filters are equality on allow-listed fields; each is a top-level key.
 */

export const MAX_PAGE = 10_000;
/** Hard ceiling for `maxPageSize` (ADR 0016). */
export const MAX_PAGE_SIZE_LIMIT = 100;

const DEFAULT_PAGE_SIZE = 20;
const RESERVED_KEYS: readonly string[] = ["page", "pageSize", "sort", "dir"];
const INVALID_LIST_PARAMS_MESSAGE =
  "Some of the list parameters are not valid.";

export type SortDirection = "asc" | "desc";

export type ListParams<Sortable extends string, Filter extends string> = {
  readonly page: number;
  readonly pageSize: number;
  readonly sort: { readonly field: Sortable; readonly dir: SortDirection };
  readonly filters: Readonly<Partial<Record<Filter, string>>>;
};

type ListParamsConfig<Sortable extends string, Filter extends string> = {
  /** Fields the caller may sort by; must be non-empty. */
  readonly sortable: readonly [Sortable, ...Sortable[]];
  /** Fields the caller may filter on by equality. */
  readonly filters: readonly Filter[];
  readonly defaultSort: {
    readonly field: Sortable;
    readonly dir: SortDirection;
  };
  /** Defaults to 20. */
  readonly defaultPageSize?: number;
  /** Defaults to, and may not exceed, 100. */
  readonly maxPageSize?: number;
};

/**
 * Strictly base-10 digits: rejects `1e3`, `1.5`, `+1`, `-1`, ` 1`, `0x10`
 * and the empty string before `Number` ever sees them.
 */
const DIGITS_ONLY = /^\d+$/;

const boundedInteger = (name: string, min: number, max: number) =>
  z
    .string()
    .regex(DIGITS_ONLY, `${name} must be a whole number.`)
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, `${name} must be at least ${min}.`)
        .max(max, `${name} must be at most ${max}.`),
    );

/**
 * Builds the schema for one list. Input is a search-params record such as
 * Next's `searchParams`. Repeated keys (arrays), unknown keys, unknown sort or
 * filter fields and out-of-range numbers all fail validation.
 *
 * Throws a plain `Error` on a misconfigured list (programmer error, not user
 * input): empty or overlapping names, or inconsistent page sizes.
 */
export function listParams<Sortable extends string, Filter extends string>(
  config: ListParamsConfig<Sortable, Filter>,
) {
  const defaultPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = config.maxPageSize ?? MAX_PAGE_SIZE_LIMIT;

  if (maxPageSize > MAX_PAGE_SIZE_LIMIT || defaultPageSize > maxPageSize) {
    throw new Error(
      "listParams: need 1 <= defaultPageSize <= maxPageSize <= 100.",
    );
  }
  if (defaultPageSize < 1) {
    throw new Error("listParams: defaultPageSize must be at least 1.");
  }
  if (!config.sortable.includes(config.defaultSort.field)) {
    throw new Error("listParams: defaultSort.field must be sortable.");
  }
  const reservedFilter = config.filters.find((field) =>
    RESERVED_KEYS.includes(field),
  );
  if (reservedFilter !== undefined) {
    throw new Error(
      `listParams: filter "${reservedFilter}" collides with a reserved key.`,
    );
  }

  const filterShape = Object.fromEntries(
    config.filters.map((field) => [
      field,
      z.string().min(1, `${field} must not be empty.`).optional(),
    ]),
  );

  return z
    .strictObject({
      page: boundedInteger("page", 1, MAX_PAGE).optional(),
      pageSize: boundedInteger("pageSize", 1, maxPageSize).optional(),
      sort: z.enum(config.sortable).optional(),
      dir: z.enum(["asc", "desc"]).optional(),
      ...filterShape,
    })
    .transform((input): ListParams<Sortable, Filter> => {
      const filters: Partial<Record<Filter, string>> = {};
      // The dynamic filter keys are not visible in the inferred object type.
      const raw: Readonly<Record<string, unknown>> = input;
      for (const field of config.filters) {
        const value = raw[field];
        if (typeof value === "string") {
          filters[field] = value;
        }
      }
      return {
        page: input.page ?? 1,
        pageSize: input.pageSize ?? defaultPageSize,
        // `dir` without `sort` applies to the default field.
        sort: {
          field: input.sort ?? config.defaultSort.field,
          dir: input.dir ?? config.defaultSort.dir,
        },
        filters,
      };
    });
}

/**
 * Parses `input` with a schema from `listParams`, for callers outside
 * `defineAction` (for example a page reading `searchParams`).
 *
 * @throws AppError of type `validation`, with `fieldErrors` shaped as in
 *   ADR 0015, before any query runs.
 */
export function parseListParams<Output>(
  schema: z.ZodType<Output>,
  input: unknown,
): Output {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw validationError(
      INVALID_LIST_PARAMS_MESSAGE,
      fieldErrorsFromZod(parsed.error),
    );
  }
  return parsed.data;
}
