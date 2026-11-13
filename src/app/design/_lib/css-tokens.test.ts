import { describe, expect, it } from "vitest";

import { parseTokenValues } from "@/app/design/_lib/css-tokens";

describe("parseTokenValues", () => {
  it("reads light-dark() declarations into light and dark values", () => {
    const tokens = parseTokenValues(
      ":root {\n  --primary: light-dark(#4f46e5, #818cf8);\n}",
    );

    expect(tokens.get("--primary")).toEqual({
      light: "#4f46e5",
      dark: "#818cf8",
    });
  });

  it("keeps commas that are nested inside a value", () => {
    const tokens = parseTokenValues(
      "--overlay: light-dark(rgb(10 10 10 / 0.5), rgb(0 0 0 / 0.7));",
    );

    expect(tokens.get("--overlay")).toEqual({
      light: "rgb(10 10 10 / 0.5)",
      dark: "rgb(0 0 0 / 0.7)",
    });
  });

  it("resolves an alias to the values of the token it references", () => {
    const tokens = parseTokenValues(
      "--primary: light-dark(#111111, #eeeeee);\n--ring: var(--primary);\n--sidebar-ring: var(--ring);",
    );

    expect(tokens.get("--ring")).toEqual(tokens.get("--primary"));
    expect(tokens.get("--sidebar-ring")).toEqual(tokens.get("--primary"));
  });

  it("ignores declarations that are not colors", () => {
    const tokens = parseTokenValues(
      "--radius: 0.625rem;\n--shadow-xs: 0 1px 2px 0 light-dark(rgb(0 0 0 / 0.05), rgb(0 0 0 / 0.3));",
    );

    expect(tokens.size).toBe(0);
  });
});
