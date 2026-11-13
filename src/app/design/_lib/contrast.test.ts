import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/app/design/_lib/contrast";

describe("contrastRatio", () => {
  it("computes the WCAG extremes: black on white is 21 and a color on itself is 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#4f46e5", "#4f46e5")).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    expect(contrastRatio("#636363", "#ffffff")).toBe(
      contrastRatio("#ffffff", "#636363"),
    );
  });

  it("matches a known reference value (#767676 on white is 4.54)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("returns undefined for anything that is not a plain #rrggbb color", () => {
    expect(contrastRatio("rgb(0 0 0 / 0.5)", "#ffffff")).toBeUndefined();
    expect(contrastRatio("#fff", "#000000")).toBeUndefined();
  });
});
