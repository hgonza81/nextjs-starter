/**
 * Shared error vocabulary (PH-FR-06, ADR 0015). Domain-free and without
 * `server-only`, so client components can import the wire types.
 */

import type { z } from "zod";

/** Exactly five error types; add one only through an ADR change. */
export type AppErrorType =
  "validation" | "not_found" | "forbidden" | "conflict" | "unexpected";

/**
 * Field name to messages. `defineAction` groups Zod issues by their first path
 * segment; form-level issues use the reserved key `_form` (ADR 0015).
 */
export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * Server-side error thrown by handlers. `message` must be safe to show to a
 * user: never put database text, SQL, or personal data in it.
 */
export class AppError extends Error {
  readonly type: AppErrorType;
  readonly fieldErrors?: FieldErrors;

  constructor(type: AppErrorType, message: string, fieldErrors?: FieldErrors) {
    super(message);
    this.name = "AppError";
    this.type = type;
    if (fieldErrors !== undefined) {
      this.fieldErrors = fieldErrors;
    }
  }
}

/**
 * Plain, serializable error sent over the wire. `ref` exists only for
 * `unexpected` errors, so users can quote it to support.
 */
export type ActionError = {
  readonly type: AppErrorType;
  readonly message: string;
  readonly fieldErrors?: FieldErrors;
  readonly ref?: string;
};

/** Result of a server action: plain data, safe to serialize. */
export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ActionError };

// Helper names deliberately avoid `notFound`/`forbidden`, which would collide
// with the Next.js functions that must pass through the action wrapper.

export function validationError(
  message: string,
  fieldErrors?: FieldErrors,
): AppError {
  return new AppError("validation", message, fieldErrors);
}

export function notFoundError(message: string): AppError {
  return new AppError("not_found", message);
}

export function forbiddenError(message: string): AppError {
  return new AppError("forbidden", message);
}

export function conflictError(message: string): AppError {
  return new AppError("conflict", message);
}

/**
 * Groups Zod issue messages by first path segment; form-level issues (empty
 * path, such as an unknown key) go under the reserved key `_form` (ADR 0015).
 */
export function fieldErrorsFromZod(error: z.ZodError): FieldErrors {
  const collected: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "_form");
    (collected[field] ??= []).push(issue.message);
  }
  return collected;
}
