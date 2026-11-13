import { describe, expect, it } from "vitest";

import { isNavItemActive } from "@/components/layout/nav";

describe("isNavItemActive", () => {
  it("FND-FR-16: matches the exact page", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
  });

  it("FND-FR-16: keeps a section active on its detail pages", () => {
    expect(isNavItemActive("/dashboard/settings", "/dashboard")).toBe(true);
  });

  it("FND-FR-16: does not match a sibling that shares a prefix", () => {
    expect(isNavItemActive("/dashboard-old", "/dashboard")).toBe(false);
  });

  it("FND-FR-16: the root link is active only on the root", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/dashboard", "/")).toBe(false);
  });

  it("FND-FR-16: ignores trailing slashes, queries and hashes", () => {
    expect(isNavItemActive("/dashboard/", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard", "/dashboard?tab=1")).toBe(true);
    expect(isNavItemActive("/dashboard", "/dashboard#top")).toBe(true);
  });
});
