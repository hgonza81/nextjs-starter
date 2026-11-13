import { describe, expect, it } from "vitest";

import {
  AppError,
  conflictError,
  forbiddenError,
  notFoundError,
  validationError,
  type ActionError,
  type AppErrorType,
  type Result,
} from "@/lib/errors";

/** PH-FR-06 / PH-AC-12: the five error types and the plain wire shape. */

const helpers: [AppErrorType, () => AppError][] = [
  ["validation", () => validationError("Check the form.")],
  ["not_found", () => notFoundError("Nothing here.")],
  ["forbidden", () => forbiddenError("Not allowed.")],
  ["conflict", () => conflictError("Already exists.")],
  ["unexpected", () => new AppError("unexpected", "Something went wrong.")],
];

describe("PH-AC-12: AppError types", () => {
  it.each(helpers)(
    "PH-AC-12: creating a %s error keeps its type and a user-safe message",
    (type, create) => {
      const error = create();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.type).toBe(type);
      expect(error.message).not.toBe("");
      expect(error.fieldErrors).toBeUndefined();
    },
  );

  it("PH-AC-12: validation errors carry field errors keyed by field name", () => {
    const fieldErrors = { email: ["Required"], name: ["Too short", "Invalid"] };

    const error = validationError("Check the form.", fieldErrors);

    expect(error.fieldErrors).toEqual(fieldErrors);
  });

  it.each(helpers)(
    "PH-AC-12: a %s error serializes to the typed result shape through JSON",
    (type, create) => {
      const error = create();
      const wire: Result<never> = {
        ok: false,
        error: {
          type: error.type,
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
        },
      };

      const roundTripped = JSON.parse(JSON.stringify(wire)) as typeof wire;

      expect(roundTripped).toEqual({
        ok: false,
        error: { type, message: error.message },
      });
    },
  );

  it("PH-AC-12: the wire shape keeps field errors and the ref of an unexpected error", () => {
    const wire: ActionError = {
      type: "unexpected",
      message: "Something went wrong.",
      ref: "abc_123-X",
    };

    expect(JSON.parse(JSON.stringify(wire))).toEqual(wire);
  });
});
