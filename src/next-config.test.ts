import { createRequire } from "node:module";

import type { NextConfig } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

// Importing the config pulls in the public env module, which validates at import.
vi.mock("@/lib/env", () => ({ publicEnv: {} }));

type Header = { key: string; value: string };
type Rule = { source: string; headers: Header[] };

// Next's own matcher, so the sample-path checks use the real source semantics.
const { pathToRegexp } = createRequire(import.meta.url)(
  "next/dist/compiled/path-to-regexp",
) as { pathToRegexp: (source: string) => RegExp };

async function loadConfig(nodeEnv: string): Promise<NextConfig> {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();
  return (await import("../next.config")).default;
}

async function rulesFor(nodeEnv: string): Promise<Rule[]> {
  const config = await loadConfig(nodeEnv);
  return (await config.headers?.()) as Rule[];
}

/** Header values that apply to a path, in order, like Next merges matching rules. */
function appliedHeaders(rules: Rule[], path: string): Header[] {
  return rules
    .filter((rule) => pathToRegexp(rule.source).test(path))
    .flatMap((rule) => rule.headers);
}

const valuesOf = (headers: Header[], key: string) =>
  headers
    .filter((h) => h.key.toLowerCase() === key.toLowerCase())
    .map((h) => h.value);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("next.config headers()", () => {
  it.each(["/", "/login", "/api/health", "/design/frames/form"])(
    "PH-AC-28: %s gets the static security headers",
    async (path) => {
      const applied = appliedHeaders(await rulesFor("production"), path);

      expect(valuesOf(applied, "X-Content-Type-Options")).toEqual(["nosniff"]);
      expect(valuesOf(applied, "Referrer-Policy")).toEqual([
        "strict-origin-when-cross-origin",
      ]);
      expect(valuesOf(applied, "Permissions-Policy")).toEqual([
        "camera=(), microphone=(), geolocation=()",
      ]);
    },
  );

  it("PH-AC-29: HSTS is sent in production without preload", async () => {
    const [value, ...rest] = valuesOf(
      appliedHeaders(await rulesFor("production"), "/"),
      "Strict-Transport-Security",
    );

    expect(rest).toEqual([]);
    expect(value).toContain("max-age=");
    expect(value).toContain("includeSubDomains");
    expect(value).not.toContain("preload");
  });

  it.each(["development", "test"])(
    "PH-AC-29: HSTS is not sent when NODE_ENV is %s",
    async (nodeEnv) => {
      const applied = appliedHeaders(await rulesFor(nodeEnv), "/");

      expect(valuesOf(applied, "Strict-Transport-Security")).toEqual([]);
    },
  );

  it.each([
    "/",
    "/design",
    "/login",
    "/api/health",
    "/design/frames-evil",
    "/design/frames-evil/x",
  ])("PH-AC-79: %s gets X-Frame-Options DENY only", async (path) => {
    const applied = appliedHeaders(await rulesFor("production"), path);

    expect(valuesOf(applied, "X-Frame-Options")).toEqual(["DENY"]);
  });

  // Edge, documented: the exact path `/design/frames` (no trailing slash) gets
  // SAMEORIGIN here while the CSP says 'none'. No page exists there, so it is
  // deliberately not asserted.
  it.each(["/design/frames/", "/design/frames/form", "/design/frames/a/b"])(
    "PH-AC-79: %s gets X-Frame-Options SAMEORIGIN only",
    async (path) => {
      const applied = appliedHeaders(await rulesFor("production"), path);

      expect(valuesOf(applied, "X-Frame-Options")).toEqual(["SAMEORIGIN"]);
    },
  );

  it("PH-AC-79: the two X-Frame-Options sources never both match a sample path", async () => {
    const rules = (await rulesFor("production")).filter((rule) =>
      rule.headers.some((h) => h.key === "X-Frame-Options"),
    );
    const samples = [
      "/",
      "/design",
      "/design/",
      "/design/frames",
      "/design/frames/",
      "/design/frames/x",
      "/design/frames/x/y",
      "/design/frames-evil",
      "/design/framesx/a",
      "/api/x",
      "/login",
      "/a/b/c",
      "/_next/static/a.js",
    ];

    expect(rules).toHaveLength(2);
    for (const path of samples) {
      const matches = rules.filter((r) => pathToRegexp(r.source).test(path));
      expect(matches.length, path).toBeLessThanOrEqual(1);
    }
  });

  it.each(["/", "/api/health", "/design/frames/form"])(
    "PH-FR-16: %s carries no CORS header",
    async (path) => {
      const keys = appliedHeaders(await rulesFor("production"), path).map((h) =>
        h.key.toLowerCase(),
      );

      expect(keys.filter((k) => k.startsWith("access-control-"))).toEqual([]);
    },
  );
});

describe("next.config options", () => {
  it("PH-FR-16: does not advertise the framework", async () => {
    expect((await loadConfig("production")).poweredByHeader).toBe(false);
  });

  it("PH-AC-73: Server Action body size limit is 1mb", async () => {
    const config = await loadConfig("production");

    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("1mb");
  });
});
