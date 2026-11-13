import { describe, expect, it } from "vitest";

import { fromDbError, requireRow } from "@/lib/db-error";
import { AppError } from "@/lib/errors";

/**
 * PH-FR-07, PH-AC-13/14/15/63 (unit half): fake error shapes. Real database
 * errors are checked in tests/db/db-error.test.ts.
 */

const withCode = (code: string) => Object.assign(new Error("pg"), { code });
const wrapped = (code: string) =>
  Object.assign(new Error("Failed query: select 1"), {
    cause: withCode(code),
  });

describe("PH-AC-13/14/15: fromDbError by SQLSTATE", () => {
  it("PH-AC-13: 23505 (unique violation) maps to conflict", () => {
    expect(fromDbError(withCode("23505")).type).toBe("conflict");
  });

  it("PH-AC-13: 23503 (foreign key violation) maps to conflict", () => {
    expect(fromDbError(withCode("23503")).type).toBe("conflict");
  });

  it("PH-AC-14: 42501 (insufficient privilege, RLS) maps to forbidden", () => {
    expect(fromDbError(withCode("42501")).type).toBe("forbidden");
  });

  it("PH-FR-07: 23502 (not-null violation) maps to validation", () => {
    expect(fromDbError(withCode("23502")).type).toBe("validation");
  });

  it("PH-FR-07: 23514 (check violation) maps to validation", () => {
    expect(fromDbError(withCode("23514")).type).toBe("validation");
  });

  it("PH-AC-15: 57014 (query canceled) maps to unexpected", () => {
    expect(fromDbError(withCode("57014")).type).toBe("unexpected");
  });

  it("PH-AC-15: 40001 (serialization failure) maps to unexpected", () => {
    expect(fromDbError(withCode("40001")).type).toBe("unexpected");
  });

  it("PH-AC-15: 40P01 (deadlock) maps to unexpected", () => {
    expect(fromDbError(withCode("40P01")).type).toBe("unexpected");
  });

  it("PH-AC-15: an unknown SQLSTATE maps to unexpected", () => {
    expect(fromDbError(withCode("99999")).type).toBe("unexpected");
  });

  it("PH-AC-15: another 23xxx class code (23000) maps to unexpected", () => {
    expect(fromDbError(withCode("23000")).type).toBe("unexpected");
  });

  it("PH-FR-07: the result is an AppError", () => {
    expect(fromDbError(withCode("23505"))).toBeInstanceOf(AppError);
  });
});

describe("PH-FR-07: fromDbError walks the cause chain", () => {
  it("PH-AC-13: finds the code one level down (Drizzle wrapper shape)", () => {
    expect(fromDbError(wrapped("23505")).type).toBe("conflict");
  });

  it("PH-AC-14: finds the code three levels down", () => {
    const error = new Error("a", {
      cause: new Error("b", {
        cause: new Error("c", { cause: withCode("42501") }),
      }),
    });

    expect(fromDbError(error).type).toBe("forbidden");
  });

  it("PH-FR-07: gives up beyond three levels and returns unexpected", () => {
    const error = new Error("a", {
      cause: new Error("b", {
        cause: new Error("c", {
          cause: new Error("d", { cause: withCode("23505") }),
        }),
      }),
    });

    expect(fromDbError(error).type).toBe("unexpected");
  });

  it("PH-FR-07: the outermost code wins over a deeper one", () => {
    const outer = Object.assign(new Error("outer"), {
      code: "23502",
      cause: withCode("23505"),
    });

    expect(fromDbError(outer).type).toBe("validation");
  });

  it("PH-FR-07: a non-string code is ignored and the chain continues", () => {
    const error = Object.assign(new Error("x"), {
      code: 23505,
      cause: withCode("42501"),
    });

    expect(fromDbError(error).type).toBe("forbidden");
  });

  it("PH-FR-07: a plain object with a code is accepted (duck typing)", () => {
    expect(fromDbError({ code: "23503" }).type).toBe("conflict");
  });

  it("PH-FR-07: a cyclic cause chain terminates", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;

    expect(fromDbError(error).type).toBe("unexpected");
  });
});

describe("PH-AC-15: unrecognized input never exposes database text", () => {
  const inputs: [string, unknown][] = [
    ["undefined", undefined],
    ["null", null],
    ["a string", "duplicate key value violates unique constraint"],
    ["a number", 42],
    ["an error without a code", new Error("select * from secrets")],
    ["an empty object", {}],
  ];

  it.each(inputs)("PH-AC-15: %s maps to unexpected", (_label, input) => {
    expect(fromDbError(input).type).toBe("unexpected");
  });

  it("PH-AC-15: the message of an unexpected error does not contain the database message", () => {
    const secret = 'Failed query: insert into "users" params: a@b.com';
    const error = Object.assign(new Error(secret), { code: "XX000" });

    const mapped = fromDbError(error);

    expect(mapped.message).not.toContain("users");
    expect(mapped.message).not.toContain("a@b.com");
    expect(mapped.message).toBe("Something went wrong.");
  });

  it.each(["23505", "23503", "42501", "23502", "23514"])(
    "PH-FR-07: the message for %s never contains the database message",
    (code) => {
      const error = Object.assign(
        new Error('Key (email)=(a@b.com) already exists in "users"'),
        {
          code,
          detail: "Key (email)=(a@b.com)",
          constraint: "users_email_key",
        },
      );

      const mapped = fromDbError(error);

      expect(mapped.message).not.toContain("a@b.com");
      expect(mapped.message).not.toContain("users");
      expect(mapped.fieldErrors).toBeUndefined();
    },
  );
});

describe("PH-AC-63: requireRow", () => {
  it("PH-AC-63: returns the row when present", () => {
    const row = { id: 1 };

    expect(requireRow(row, "Missing.")).toBe(row);
  });

  it("PH-AC-63: throws not_found for null", () => {
    expect(() => requireRow(null, "Missing.")).toThrowError(
      expect.objectContaining({ type: "not_found", message: "Missing." }),
    );
  });

  it("PH-AC-63: throws not_found for undefined (e.g. result[0] of zero rows)", () => {
    expect(() => requireRow(undefined, "Missing.")).toThrowError(
      expect.objectContaining({ type: "not_found" }),
    );
  });

  it.each([0, "", false])(
    "PH-AC-63: returns the falsy value %j (only null and undefined are missing)",
    (value) => {
      expect(requireRow(value, "Missing.")).toBe(value);
    },
  );

  it("PH-AC-63: the thrown error is an AppError and never forbidden", () => {
    let thrown: unknown;
    try {
      requireRow(null, "Missing.");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).type).not.toBe("forbidden");
  });
});
