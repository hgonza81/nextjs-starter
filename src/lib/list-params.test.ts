import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { listParams, parseListParams } from "@/lib/list-params";

const schema = () =>
  listParams({
    sortable: ["name", "created_at"],
    filters: ["status", "role"],
    defaultSort: { field: "created_at", dir: "desc" },
  });

/** Parses and returns the thrown AppError (fails the test if nothing throws). */
function failure(
  input: unknown,
  s: Parameters<typeof parseListParams>[0] = schema(),
) {
  try {
    parseListParams(s, input);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return error as AppError;
  }
  throw new Error("expected parseListParams to throw");
}

describe("listParams defaults (PH-AC-39)", () => {
  it("PH-FR-20: empty input gives page 1, size 20, default sort, no filters", () => {
    expect(parseListParams(schema(), {})).toEqual({
      page: 1,
      pageSize: 20,
      sort: { field: "created_at", dir: "desc" },
      filters: {},
    });
  });

  it("PH-FR-20: honors a custom defaultPageSize and maxPageSize", () => {
    const s = listParams({
      sortable: ["name"],
      filters: [],
      defaultSort: { field: "name", dir: "asc" },
      defaultPageSize: 10,
      maxPageSize: 50,
    });

    expect(parseListParams(s, {}).pageSize).toBe(10);
    expect(parseListParams(s, { pageSize: "50" }).pageSize).toBe(50);
    expect(failure({ pageSize: "51" }, s).fieldErrors).toHaveProperty(
      "pageSize",
    );
  });

  it("PH-FR-20: parses explicit page, size, sort, dir and filters", () => {
    const parsed = parseListParams(schema(), {
      page: "3",
      pageSize: "50",
      sort: "name",
      dir: "asc",
      status: "active",
      role: "owner",
    });

    expect(parsed).toEqual({
      page: 3,
      pageSize: 50,
      sort: { field: "name", dir: "asc" },
      filters: { status: "active", role: "owner" },
    });
  });

  it("PH-FR-20: a dir without sort applies to the default sort field", () => {
    expect(parseListParams(schema(), { dir: "asc" }).sort).toEqual({
      field: "created_at",
      dir: "asc",
    });
  });

  it("PH-FR-20: a sort without dir uses the default direction", () => {
    expect(parseListParams(schema(), { sort: "name" }).sort).toEqual({
      field: "name",
      dir: "desc",
    });
  });

  it("PH-FR-20: omits filters that were not supplied", () => {
    expect(
      parseListParams(schema(), { status: "active" }).filters,
    ).toStrictEqual({ status: "active" });
  });

  it("PH-FR-20: treats filter values as opaque data", () => {
    const value = "a b%_'; DROP TABLE x;--";

    expect(parseListParams(schema(), { status: value }).filters.status).toBe(
      value,
    );
  });
});

describe("listParams boundaries (PH-AC-39, 40, 75)", () => {
  it.each([
    ["page", "1", 1],
    ["page", "10000", 10_000],
    ["pageSize", "1", 1],
    ["pageSize", "100", 100],
  ])("PH-AC-40: accepts %s=%s", (key, raw, expected) => {
    expect(parseListParams(schema(), { [key]: raw })).toMatchObject({
      [key]: expected,
    });
  });

  it.each([
    ["page", "0"],
    ["page", "10001"],
    ["pageSize", "0"],
    ["pageSize", "101"],
  ])("PH-AC-40: rejects %s=%s as validation", (key, raw) => {
    const error = failure({ [key]: raw });

    expect(error.type).toBe("validation");
    expect(error.fieldErrors).toHaveProperty(key);
  });

  it.each(["1e3", "1.5", "+1", " 1", "1 ", "0x10", "", "-1", "1_0", "١"])(
    "PH-AC-75: rejects the non-integer page %j without reaching Number()",
    (raw) => {
      const error = failure({ page: raw });

      expect(error.type).toBe("validation");
      expect(error.fieldErrors?.page).toBeDefined();
    },
  );

  it.each(["1e3", "1.5", "+1", " 1", "0x10", "", "-1", "1_0"])(
    "PH-AC-75: rejects the non-integer pageSize %j",
    (raw) => {
      expect(failure({ pageSize: raw }).fieldErrors?.pageSize).toBeDefined();
    },
  );

  it("PH-AC-75: rejects a number type (only strings come from a URL)", () => {
    expect(failure({ page: 1 }).fieldErrors?.page).toBeDefined();
  });

  it("PH-AC-75: accepts leading zeros as base-10 digits", () => {
    expect(parseListParams(schema(), { page: "007" }).page).toBe(7);
  });
});

describe("listParams rejections (PH-AC-39, 40)", () => {
  it("PH-AC-40: rejects an unknown key as a form-level error", () => {
    const error = failure({ extra: "1" });

    expect(error.type).toBe("validation");
    expect(error.fieldErrors).toHaveProperty("_form");
  });

  it("PH-AC-40: rejects an unknown sort field", () => {
    expect(failure({ sort: "password" }).fieldErrors).toHaveProperty("sort");
  });

  it("PH-AC-40: rejects an unknown filter field as an unknown key", () => {
    expect(failure({ password: "x" }).type).toBe("validation");
  });

  it("PH-AC-40: rejects an invalid dir", () => {
    expect(failure({ dir: "sideways" }).fieldErrors).toHaveProperty("dir");
  });

  it("PH-AC-40: rejects an empty filter value", () => {
    expect(failure({ status: "" }).fieldErrors).toHaveProperty("status");
  });

  it.each([
    ["page", ["1", "2"]],
    ["sort", ["name", "name"]],
    ["status", ["a", "b"]],
  ])("PH-AC-40: rejects a repeated key %s (array value)", (key, value) => {
    expect(failure({ [key]: value }).type).toBe("validation");
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])(
    "PH-AC-40: treats hostile key %j as an unknown key",
    (key) => {
      const input = JSON.parse(`{"${key}": "x"}`) as unknown;

      expect(failure(input).type).toBe("validation");
    },
  );

  it.each([
    "name; DROP TABLE tenants",
    "name' OR '1'='1",
    "<script>alert(1)</script>",
    "NAME",
    "../../etc/passwd",
    "name\u0000",
  ])("PH-AC-40: rejects hostile sort value %j", (value) => {
    expect(failure({ sort: value }).fieldErrors).toHaveProperty("sort");
  });

  it("PH-AC-40: rejects non-object input", () => {
    expect(failure(null).type).toBe("validation");
    expect(failure("page=1").type).toBe("validation");
  });

  it("PH-AC-40: groups several problems by field in one error", () => {
    const error = failure({ page: "0", sort: "nope", extra: "x" });

    expect(Object.keys(error.fieldErrors ?? {}).sort()).toEqual([
      "_form",
      "page",
      "sort",
    ]);
  });

  it("PH-AC-40: error message is safe and does not echo input", () => {
    const error = failure({ sort: "<script>alert(1)</script>" });

    expect(error.message).not.toContain("script");
  });

  it("PH-AC-39: validation fails before the query callback could run", () => {
    const tx = vi.fn();
    const run = (input: unknown) => {
      const params = parseListParams(schema(), input);
      tx(params);
    };

    expect(() => run({ page: "10001" })).toThrow(AppError);
    expect(tx).not.toHaveBeenCalled();
  });
});

describe("listParams misconfiguration", () => {
  const base = {
    sortable: ["name", "created_at"] as ["name", "created_at"],
    filters: [] as string[],
    defaultSort: { field: "name" as const, dir: "asc" as const },
  };

  it("PH-FR-20: throws a plain Error when defaultSort is not sortable", () => {
    const build = () =>
      listParams({
        ...base,
        defaultSort: { field: "other" as "name", dir: "asc" },
      });

    expect(build).toThrow(Error);
    expect(build).not.toThrow(AppError);
  });

  it.each(["page", "pageSize", "sort", "dir"])(
    "PH-FR-20: throws a plain Error when a filter is named %s",
    (name) => {
      const build = () => listParams({ ...base, filters: [name] });

      expect(build).toThrow(Error);
      expect(build).not.toThrow(AppError);
    },
  );

  it.each([
    ["maxPageSize above 100", { maxPageSize: 101 }],
    [
      "defaultPageSize above maxPageSize",
      { defaultPageSize: 30, maxPageSize: 20 },
    ],
    ["defaultPageSize above the default max", { defaultPageSize: 101 }],
    ["defaultPageSize of 0", { defaultPageSize: 0 }],
  ])("PH-FR-20: throws a plain Error for %s", (_label, extra) => {
    const build = () => listParams({ ...base, ...extra });

    expect(build).toThrow(Error);
    expect(build).not.toThrow(AppError);
  });
});

describe("list-params module purity (PH-FR-20)", () => {
  it("PH-FR-20: the source imports no database module", () => {
    const source = readFileSync(resolve(__dirname, "list-params.ts"), "utf8");

    expect(source).not.toMatch(/from\s+["']@\/db/);
  });
});
