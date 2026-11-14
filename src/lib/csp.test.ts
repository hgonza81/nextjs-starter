import { describe, expect, it } from "vitest";

import { buildCsp, isFramablePath } from "@/lib/csp";

const NONCE = "dGVzdC1ub25jZQ==";
const base = {
  nonce: NONCE,
  pathname: "/",
  supabaseUrl: "http://127.0.0.1:54321",
  isDevelopment: false,
};

/** Parses a CSP value into directive name -> source list (no string snapshots). */
function parse(csp: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const part of csp.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name) directives.set(name, sources);
  }
  return directives;
}

const policy = (overrides: Partial<typeof base> = {}) =>
  parse(buildCsp({ ...base, ...overrides }));

describe("buildCsp", () => {
  it("PH-FR-15: emits every required directive exactly once", () => {
    const csp = buildCsp(base);
    const names = csp.split(";").map((p) => p.trim().split(/\s+/)[0]);

    expect(names).toEqual([
      "default-src",
      "script-src",
      "style-src",
      "img-src",
      "font-src",
      "connect-src",
      "object-src",
      "base-uri",
      "form-action",
      "frame-ancestors",
    ]);
  });

  it.each([
    ["default-src", ["'self'"]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "blob:", "data:"]],
    ["font-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
  ])("PH-AC-27: %s has the expected sources", (name, sources) => {
    expect(policy().get(name)).toEqual(sources);
  });

  it("PH-AC-27: script-src carries the nonce and strict-dynamic, without unsafe-inline", () => {
    const script = policy().get("script-src");

    expect(script).toContain(`'nonce-${NONCE}'`);
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("'unsafe-inline'");
  });

  it("PH-AC-27: embeds exactly the nonce it is given", () => {
    const script = policy({ nonce: "other-nonce" }).get("script-src");

    expect(script).toContain("'nonce-other-nonce'");
    expect(script).not.toContain(`'nonce-${NONCE}'`);
  });

  it("PH-AC-27: production has no unsafe-eval and no ws: source", () => {
    const csp = buildCsp(base);

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain("ws:");
  });

  it("PH-AC-27: development adds unsafe-eval to script-src and ws: to connect-src only", () => {
    const dev = policy({ isDevelopment: true });

    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(dev.get("connect-src")).toContain("ws:");
    expect(dev.get("style-src")).not.toContain("'unsafe-eval'");
    expect(dev.get("default-src")).not.toContain("ws:");
  });

  it.each([false, true])(
    "PH-FR-15: never emits upgrade-insecure-requests (development=%s)",
    (isDevelopment) => {
      expect(buildCsp({ ...base, isDevelopment })).not.toContain(
        "upgrade-insecure-requests",
      );
    },
  );

  it("PH-AC-74: connect-src holds self plus the Supabase origin only", () => {
    const connect = policy({
      supabaseUrl: "https://abc.supabase.co/rest/v1?x=1",
    }).get("connect-src");

    expect(connect).toEqual(["'self'", "https://abc.supabase.co"]);
  });

  it("PH-AC-74: connect-src keeps a non-default port of the Supabase origin", () => {
    expect(policy().get("connect-src")).toContain("http://127.0.0.1:54321");
  });

  it("PH-AC-79: frame-ancestors is 'none' by default", () => {
    expect(policy({ pathname: "/" }).get("frame-ancestors")).toEqual([
      "'none'",
    ]);
  });

  it("PH-AC-79: frame-ancestors is 'self' under /design/frames/", () => {
    expect(
      policy({ pathname: "/design/frames/form" }).get("frame-ancestors"),
    ).toEqual(["'self'"]);
  });

  it("PH-FR-15: throws on an invalid Supabase URL instead of emitting a weak policy", () => {
    expect(() => buildCsp({ ...base, supabaseUrl: "not a url" })).toThrow();
  });
});

describe("isFramablePath", () => {
  it.each(["/design/frames/form", "/design/frames/a/b", "/design/frames/"])(
    "PH-AC-79: %s is framable",
    (path) => {
      expect(isFramablePath(path)).toBe(true);
    },
  );

  it.each([
    "/",
    "/design",
    "/design/",
    // Exact path without a trailing slash: no page exists there. The CSP says
    // 'none' while the X-Frame-Options patterns (next.config.ts) say
    // SAMEORIGIN; the stricter CSP wins in browsers that support it.
    "/design/frames",
    "/design/frames-evil",
    "/design/frames-evil/x",
    "/design/framesx/a",
    "/DESIGN/FRAMES/a",
    "/x/design/frames/a",
    "/api/design/frames/a",
    "",
  ])("PH-AC-79: %j is not framable", (path) => {
    expect(isFramablePath(path)).toBe(false);
  });
});
