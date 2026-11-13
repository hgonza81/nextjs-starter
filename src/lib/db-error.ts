import {
  AppError,
  conflictError,
  forbiddenError,
  notFoundError,
  validationError,
} from "@/lib/errors";

/**
 * Database error mapping (PH-FR-07, ADR 0015).
 *
 * Duck-typed on `.code` so `src/lib` imports nothing from `src/db`. Drizzle
 * wraps the driver error (`DrizzleQueryError.cause` is the `PostgresError`
 * carrying the SQLSTATE), so the chain is walked a few levels deep.
 */

const MAX_CAUSE_DEPTH = 3;

// Fixed, user-safe messages: database text can contain SQL, parameters and
// personal data, so it never reaches an AppError.
const MESSAGES = {
  conflict: "This conflicts with existing data.",
  forbidden: "You are not allowed to do this.",
  validation: "Some of the submitted data is not valid.",
  unexpected: "Something went wrong.",
} as const;

function readSqlState(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    if ("code" in current && typeof current.code === "string") {
      return current.code;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

/**
 * Maps a database failure to an `AppError`. Unrecognized errors (including
 * `57014`, `40001`, `40P01`) become `unexpected` with a generic message.
 */
export function fromDbError(error: unknown): AppError {
  switch (readSqlState(error)) {
    case "23505":
    case "23503":
      return conflictError(MESSAGES.conflict);
    case "42501":
      return forbiddenError(MESSAGES.forbidden);
    case "23502":
    case "23514":
      return validationError(MESSAGES.validation);
    default:
      return new AppError("unexpected", MESSAGES.unexpected);
  }
}

/**
 * Returns the row, or throws `not_found` when there is none. Rows hidden by
 * RLS come back as zero rows, so this is also how they are reported: always
 * `not_found`, never `forbidden`, so existence does not leak across tenants
 * (PH-AC-63).
 */
export function requireRow<T>(row: T | null | undefined, message: string): T {
  if (row === null || row === undefined) {
    throw notFoundError(message);
  }
  return row;
}
