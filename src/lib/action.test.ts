import { notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineAction } from "@/lib/action";
import {
  conflictError,
  forbiddenError,
  notFoundError,
  validationError,
} from "@/lib/errors";

vi.mock("server-only", () => ({}));

const log = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  exception: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: log }));

/**
 * PH-FR-08, PH-AC-44/45/46/47/59/64/71 (unit half): the wrapper with fakes.
 * The E2E half of PH-AC-64 (hook vs wrapper) lives in the E2E suite.
 */

const schema = z.object({ name: z.string().min(2), age: z.number() });
const validInput = { name: "Ada", age: 36 };

const entryCount = () =>
  Object.values(log).reduce((sum, fn) => sum + fn.mock.calls.length, 0);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PH-AC-44: invalid input", () => {
  it("PH-AC-44: does not run the handler and returns validation with field errors", async () => {
    const handler = vi.fn();
    const action = defineAction({ name: "t", schema, handler });

    const result = await action({ name: "A", age: "x" });

    expect(handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: { type: "validation" },
    });
    if (result.ok) throw new Error("expected failure");
    expect(Object.keys(result.error.fieldErrors ?? {}).sort()).toEqual([
      "age",
      "name",
    ]);
    expect(result.error.fieldErrors?.name?.length).toBeGreaterThan(0);
  });

  it("PH-AC-44: groups form-level issues under _form", async () => {
    const formSchema = z
      .object({ a: z.string() })
      .refine(() => false, { message: "Form is invalid" });
    const action = defineAction({
      name: "t",
      schema: formSchema,
      handler: vi.fn(),
    });

    const result = await action({ a: "x" });

    expect(result).toMatchObject({
      ok: false,
      error: { fieldErrors: { _form: ["Form is invalid"] } },
    });
  });

  it("PH-AC-44: rejects non-object input without running the handler", async () => {
    const handler = vi.fn();
    const action = defineAction({ name: "t", schema, handler });

    const result = await action(undefined);

    expect(handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { type: "validation" } });
  });
});

describe("PH-AC-45: success", () => {
  it("PH-AC-45: returns ok with the handler data and parsed input", async () => {
    const handler = vi.fn(async (input: { name: string }) => ({
      greeting: `Hi ${input.name}`,
    }));
    const action = defineAction({ name: "t", schema, handler });

    const result = await action({ ...validInput, extra: "dropped" });

    expect(result).toEqual({ ok: true, data: { greeting: "Hi Ada" } });
    expect(handler).toHaveBeenCalledWith(validInput);
    expect(entryCount()).toBe(0);
  });
});

describe("PH-AC-46: AppError passthrough", () => {
  it.each([
    ["not_found", notFoundError("Missing")],
    ["forbidden", forbiddenError("Nope")],
    ["conflict", conflictError("Clash")],
  ] as const)(
    "PH-AC-46: %s thrown by the handler returns the matching result",
    async (type, error) => {
      const action = defineAction({
        name: "t",
        schema,
        handler: async () => {
          throw error;
        },
      });

      const result = await action(validInput);

      expect(result).toEqual({
        ok: false,
        error: { type, message: error.message },
      });
      expect(log.exception).not.toHaveBeenCalled();
    },
  );

  it("PH-AC-46: keeps fieldErrors of a thrown validation AppError", async () => {
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => {
        throw validationError("Bad", { name: ["Taken"] });
      },
    });

    const result = await action(validInput);

    expect(result).toEqual({
      ok: false,
      error: {
        type: "validation",
        message: "Bad",
        fieldErrors: { name: ["Taken"] },
      },
    });
  });

  it("PH-FR-08: maps a database error to its typed result", async () => {
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      },
    });

    const result = await action(validInput);

    expect(result).toMatchObject({ ok: false, error: { type: "conflict" } });
    expect(JSON.stringify(result)).not.toContain("duplicate key");
    expect(log.exception).not.toHaveBeenCalled();
  });
});

describe("PH-AC-47/64/71: unexpected errors", () => {
  const failing = () =>
    defineAction({
      name: "t",
      schema,
      handler: async () => {
        throw new Error("secret internal detail");
      },
    });

  it("PH-AC-47: returns unexpected with a ref and no internal detail", async () => {
    const result = await failing()(validInput);

    expect(result).toMatchObject({
      ok: false,
      error: { type: "unexpected", message: "Something went wrong." },
    });
    expect(JSON.stringify(result)).not.toContain("secret internal detail");
  });

  it("PH-AC-64: writes exactly one log entry from the wrapper", async () => {
    await failing()(validInput);

    expect(log.exception).toHaveBeenCalledTimes(1);
    expect(entryCount()).toBe(1);
  });

  it("PH-AC-47: the log entry carries the action name and the same ref, no input data", async () => {
    const result = await failing()({ name: "Private Person", age: 36 });
    if (result.ok) throw new Error("expected failure");

    const [, , fields] = log.exception.mock.calls[0] as [
      string,
      unknown,
      Record<string, unknown>,
    ];
    expect(fields).toEqual({ action: "t", ref: result.error.ref });
    expect(JSON.stringify(log.exception.mock.calls)).not.toContain(
      "Private Person",
    );
  });

  it("PH-AC-71: ref matches the allowed pattern and differs between occurrences", async () => {
    const action = failing();

    const first = await action(validInput);
    const second = await action(validInput);

    if (first.ok || second.ok) throw new Error("expected failures");
    expect(first.error.ref).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second.error.ref).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.error.ref).not.toBe(second.error.ref);
  });

  it("PH-AC-47: a database error with an unrecognized code is unexpected", async () => {
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => {
        throw Object.assign(new Error("canceled"), { code: "57014" });
      },
    });

    const result = await action(validInput);

    expect(result).toMatchObject({ ok: false, error: { type: "unexpected" } });
    expect(log.exception).toHaveBeenCalledTimes(1);
  });
});

describe("PH-AC-59: Next.js control-flow signals", () => {
  it("PH-AC-59: redirect() passes through and logs nothing", async () => {
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => redirect("/login"),
    });

    await expect(action(validInput)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(entryCount()).toBe(0);
  });

  it("PH-AC-59: notFound() passes through and logs nothing", async () => {
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => notFound(),
    });

    await expect(action(validInput)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK"),
    });
    expect(entryCount()).toBe(0);
  });
});

describe("PH-FR-08: order of checks", () => {
  it("PH-FR-08: validation wins over the handler (parse comes first)", async () => {
    const handler = vi.fn(async () => {
      throw new Error("must not run");
    });
    const action = defineAction({ name: "t", schema, handler });

    const result = await action({});

    expect(handler).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: false, error: { type: "validation" } });
    expect(entryCount()).toBe(0);
  });

  it("PH-FR-08: a redirect is rethrown before AppError or database mapping", async () => {
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => redirect("/x"),
    });

    await expect(action(validInput)).rejects.toBeDefined();
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.exception).not.toHaveBeenCalled();
  });

  it("PH-FR-08: an AppError with a database-like code is passed through, not remapped", async () => {
    const error = Object.assign(forbiddenError("Nope"), { code: "23505" });
    const action = defineAction({
      name: "t",
      schema,
      handler: async () => {
        throw error;
      },
    });

    const result = await action(validInput);

    expect(result).toMatchObject({ ok: false, error: { type: "forbidden" } });
  });
});
