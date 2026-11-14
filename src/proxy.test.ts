import { createRequire } from "node:module";

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" },
}));
const serverEnv = vi.hoisted(() => ({ NODE_ENV: "production" }));
vi.mock("@/lib/env.server", () => ({ serverEnv }));

import { config, proxy } from "@/proxy";

// Next's own matcher semantics for the `source` pattern.
const { pathToRegexp } = createRequire(import.meta.url)(
  "next/dist/compiled/path-to-regexp",
) as { pathToRegexp: (source: string) => RegExp };

const request = (path = "/") => new NextRequest(`http://localhost:3000${path}`);
const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];

describe("proxy", () => {
  it("PH-AC-27: sets the CSP on the response", () => {
    const csp = proxy(request()).headers.get("Content-Security-Policy");

    expect(csp).toContain("default-src 'self'");
  });

  it("PH-AC-66: forwards the same CSP on the request headers for Next to read the nonce", () => {
    const response = proxy(request());
    const csp = response.headers.get("Content-Security-Policy");

    expect(csp).not.toBeNull();
    expect(response.headers.get("x-middleware-override-headers")).toContain(
      "content-security-policy",
    );
    expect(
      response.headers.get("x-middleware-request-content-security-policy"),
    ).toBe(csp);
  });

  it("PH-AC-66: generates a different nonce on every call", () => {
    const nonces = Array.from({ length: 20 }, () =>
      nonceOf(proxy(request()).headers.get("Content-Security-Policy") ?? ""),
    );

    expect(nonces.every((n) => n && n.length >= 16)).toBe(true);
    expect(new Set(nonces).size).toBe(nonces.length);
  });

  it("PH-AC-79: uses frame-ancestors 'self' only for /design/frames/ paths", () => {
    const framed = proxy(request("/design/frames/form")).headers.get(
      "Content-Security-Policy",
    );
    const other = proxy(request("/design")).headers.get(
      "Content-Security-Policy",
    );

    expect(framed).toContain("frame-ancestors 'self'");
    expect(other).toContain("frame-ancestors 'none'");
  });

  it("PH-AC-27: production NODE_ENV yields no unsafe-eval; development adds it", () => {
    serverEnv.NODE_ENV = "production";
    const prod = proxy(request()).headers.get("Content-Security-Policy");
    serverEnv.NODE_ENV = "development";
    const dev = proxy(request()).headers.get("Content-Security-Policy");
    serverEnv.NODE_ENV = "production";

    expect(prod).not.toContain("'unsafe-eval'");
    expect(dev).toContain("'unsafe-eval'");
  });

  it("PH-FR-15: sets no other response header than the CSP (besides Next's internal ones)", () => {
    const names = [...proxy(request()).headers.keys()].filter(
      (name) => !name.startsWith("x-middleware-"),
    );

    expect(names).toEqual(["content-security-policy"]);
  });
});

describe("proxy matcher", () => {
  const [matcher] = config.matcher;
  const regex = pathToRegexp(matcher?.source ?? "");

  it.each(["/", "/design", "/design/frames/form", "/login"])(
    "PH-AC-27: %s goes through the proxy",
    (path) => {
      expect(regex.test(path)).toBe(true);
    },
  );

  it.each([
    "/api/health",
    "/api",
    "/_next/static/chunk.js",
    "/_next/image",
    "/favicon.ico",
  ])("PH-FR-15: %s is excluded from the proxy", (path) => {
    expect(regex.test(path)).toBe(false);
  });

  it("PH-FR-15: prefetch requests are skipped", () => {
    expect(matcher?.missing).toEqual([
      { type: "header", key: "next-router-prefetch" },
      { type: "header", key: "purpose", value: "prefetch" },
    ]);
  });
});
