import { randomUUID } from "node:crypto";

import { loadAllDesignFrames } from "./helpers/design-page";
import { expect, test, type Page } from "./helpers/fixtures";

// PH-FR-15 and PH-FR-16 on the production build, in a real browser:
// security headers (PH-AC-27, 28, 29), per-request nonce (PH-AC-66), CSP
// enforcement (PH-AC-32), no violations on the existing pages (PH-AC-31, 61),
// framing rules (PH-AC-79). PH-AC-78 is the base fixture: every test here
// also fails on any CSP violation unless it opts out with
// `test.use({ allowCspViolations: true })` (only the negative tests do).
// The Server Action origin and size checks are in a later task (PH-T-38).

const ERROR_TITLE = "Something went wrong";
const FOREIGN_ORIGIN = "https://evil.example";

// Same ports as playwright.config.ts: the flag-off server is main + 1.
const mainPort = Number(process.env.E2E_PORT ?? 3100);
const flagOffBaseUrl = `http://localhost:${mainPort + 1}`;

/** Extracts the nonce from a CSP header value. */
function nonceOf(csp: string): string {
  const match = /script-src [^;]*'nonce-([^']+)'/.exec(csp);
  if (!match?.[1]) throw new Error(`No script nonce in CSP: ${csp}`);
  return match[1];
}

/** The nonce attribute of every script tag in an HTML document. */
function scriptNonces(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*\bnonce="([^"]*)"/g)].map(
    (match) => match[1] ?? "",
  );
}

/** Adds the root-layout fault header to the next document request only. */
async function navigateWithRootLayoutFault(
  page: Page,
  path: string,
): Promise<void> {
  const pattern = (url: URL) => url.pathname === path;
  await page.route(pattern, (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-fault": "root-layout" },
    }),
  );
  await page.goto(path);
  await page.unroute(pattern);
}

test.describe("security headers on pages", () => {
  const pages = [
    { name: "home page", path: "/", status: 200 },
    { name: "/design", path: "/design", status: 200 },
    { name: "404 page", path: "/no-such-page", status: 404 },
    {
      name: "500 page",
      path: "/design/errors/page-throw?token=headers",
      status: 500,
    },
  ];

  for (const { name, path, status } of pages) {
    test(`PH-AC-27, PH-AC-28: the ${name} carries the security headers and no X-Powered-By`, async ({
      request,
    }) => {
      const response = await request.get(path);
      const headers = response.headers();

      expect(response.status()).toBe(status);
      expect(headers["content-security-policy"]).toContain(
        "default-src 'self'",
      );
      expect(headers["strict-transport-security"]).toBe(
        "max-age=63072000; includeSubDomains",
      );
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["content-security-policy"]).toContain(
        "frame-ancestors 'none'",
      );
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["referrer-policy"]).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(headers["permissions-policy"]).toBe(
        "camera=(), microphone=(), geolocation=()",
      );
      expect(headers["x-powered-by"]).toBeUndefined();
    });
  }

  test("PH-AC-27: the production policy has no unsafe-inline or unsafe-eval in script-src", async ({
    request,
  }) => {
    const csp = (await request.get("/")).headers()["content-security-policy"];
    const scriptSrc = /script-src ([^;]*)/.exec(csp ?? "")?.[1] ?? "";

    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  test("PH-AC-27, PH-AC-28: the flag-off server still sends the headers on pages", async ({
    request,
  }) => {
    const response = await request.get(`${flagOffBaseUrl}/`);
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["strict-transport-security"]).toBeDefined();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("PH-AC-27: the flag-off 404 for a hidden /design page carries the headers too", async ({
    request,
  }) => {
    const response = await request.get(`${flagOffBaseUrl}/design`);

    expect(response.status()).toBe(404);
    expect(response.headers()["content-security-policy"]).toContain(
      "default-src 'self'",
    );
    expect(response.headers()["x-frame-options"]).toBe("DENY");
  });
});

test.describe("API routes", () => {
  test("PH-FR-15, PH-FR-16: /api/health has the static headers and no CSP", async ({
    request,
  }) => {
    const response = await request.get("/api/health");
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers["content-security-policy"]).toBeUndefined();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toBeDefined();
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});

test.describe("no CORS headers", () => {
  for (const path of ["/", "/api/health"]) {
    test(`PH-AC-29: a request to ${path} with a foreign Origin gets no Access-Control-* header`, async ({
      request,
    }) => {
      const response = await request.get(path, {
        headers: { Origin: FOREIGN_ORIGIN },
      });
      const corsHeaders = Object.keys(response.headers()).filter((name) =>
        name.startsWith("access-control-"),
      );

      expect(corsHeaders).toEqual([]);
    });
  }

  test("PH-AC-29: a preflight OPTIONS from a foreign origin is not granted", async ({
    request,
  }) => {
    const response = await request.fetch("/api/health", {
      method: "OPTIONS",
      headers: {
        Origin: FOREIGN_ORIGIN,
        "Access-Control-Request-Method": "GET",
      },
    });
    const corsHeaders = Object.keys(response.headers()).filter((name) =>
      name.startsWith("access-control-allow-"),
    );

    expect(corsHeaders).toEqual([]);
  });
});

test.describe("nonce", () => {
  test("PH-AC-66: two requests to the same page carry different nonces", async ({
    request,
  }) => {
    const first = await request.get("/");
    const second = await request.get("/");

    const firstNonce = nonceOf(
      first.headers()["content-security-policy"] ?? "",
    );
    const secondNonce = nonceOf(
      second.headers()["content-security-policy"] ?? "",
    );
    expect(firstNonce).not.toBe("");
    expect(firstNonce).not.toBe(secondNonce);
  });

  test("PH-AC-66: every script in the HTML carries the nonce of that response", async ({
    request,
  }) => {
    const response = await request.get("/");
    const nonce = nonceOf(response.headers()["content-security-policy"] ?? "");
    const nonces = scriptNonces(await response.text());

    expect(nonces.length).toBeGreaterThan(0);
    expect(new Set(nonces)).toEqual(new Set([nonce]));
  });

  test("PH-AC-66: the browser runs the nonced scripts (the page hydrates) without violations", async ({
    page,
  }) => {
    await page.goto("/design");
    await page.getByRole("button", { name: "Success toast" }).first().click();

    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
  });
});

test.describe("CSP enforcement", () => {
  // Provokes violations on purpose (PH-AC-32): the global fixture is off here.
  test.use({ allowCspViolations: true });

  // Why document.write: with 'strict-dynamic' the browser trusts script
  // elements that a trusted script creates with createElement, so injecting
  // that way would (correctly, by design) not be blocked. What an attacker who
  // can only inject markup gets is a parser-inserted script, which needs the
  // nonce. document.write produces exactly that. It replaces the document, so
  // the page-level listener is lost; the console message the fixture also
  // records survives.

  test("PH-AC-32: a parser-inserted script from an unlisted origin is blocked and never requested", async ({
    page,
    cspViolations,
  }) => {
    const unlisted = "http://unlisted.example/evil.js";
    let requested = false;
    // If the browser did not block it, this body would set the flag.
    await page.route(unlisted, (route) => {
      requested = true;
      return route.fulfill({
        contentType: "text/javascript",
        body: "window.__evilRan = true;",
      });
    });
    await page.goto("/");

    await page.evaluate((src) => {
      document.write(`<script src="${src}"></script>`);
      document.close();
    }, unlisted);

    await expect
      .poll(() =>
        cspViolations.some(
          (entry) =>
            entry.includes("Content Security Policy") &&
            entry.includes("unlisted.example"),
        ),
      )
      .toBe(true);
    expect(requested, "the unlisted origin must not be contacted").toBe(false);
    expect(
      await page.evaluate(() => "__evilRan" in window),
      "the unlisted script must not have run",
    ).toBe(false);
  });

  test("PH-AC-32: a parser-inserted inline script without a nonce is blocked", async ({
    page,
    cspViolations,
  }) => {
    await page.goto("/");

    await page.evaluate(() => {
      document.write("<script>window.__inlineRan = true;</script>");
      document.close();
    });

    await expect
      .poll(() =>
        cspViolations.some((entry) =>
          entry.includes("Content Security Policy"),
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(() => "__inlineRan" in window),
      "the inline script must not have run",
    ).toBe(false);
  });

  test("PH-AC-32: an inline event handler injected as markup is blocked", async ({
    page,
    cspViolations,
  }) => {
    await page.goto("/");

    await page.evaluate(() => {
      const holder = document.createElement("div");
      holder.innerHTML = '<img src="x" onerror="window.__handlerRan = true">';
      document.body.append(holder);
    });

    await expect
      .poll(() => cspViolations.some((entry) => entry.includes("script-src")))
      .toBe(true);
    expect(
      await page.evaluate(() => "__handlerRan" in window),
      "the inline handler must not have run",
    ).toBe(false);
  });
});

test.describe("existing pages under the CSP (no violations, usable)", () => {
  // The base fixture fails each of these tests on any violation (PH-AC-78).

  test("PH-AC-31: the home page loads with its styles applied", async ({
    page,
  }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });

    await expect(heading).toBeVisible();
    // Tailwind applied: the heading is not the unstyled browser default.
    const fontWeight = await heading.evaluate(
      (el) => getComputedStyle(el).fontWeight,
    );
    expect(Number(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("PH-AC-31: /design loads, hydrates and shows a toast", async ({
    page,
  }) => {
    await page.goto("/design");

    await page.getByRole("button", { name: "Error toast" }).first().click();

    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
  });

  test("PH-AC-31, PH-AC-79: the /design live form builds its Zod schema in the browser with no violation and validates", async ({
    page,
  }) => {
    await page.goto("/design");

    await page.getByRole("button", { name: "Check form" }).first().click();

    await expect(page.getByText(/enter a valid email/i).first()).toBeVisible();
  });

  test("PH-AC-61: the 500 page loads and Try again works under the CSP", async ({
    page,
  }) => {
    await page.goto("/design/errors/page-throw?token=csp-500");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      ERROR_TITLE,
    );

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      ERROR_TITLE,
    );
  });

  test("PH-AC-61: the global error page (root layout fault) loads with styles", async ({
    page,
  }) => {
    await navigateWithRootLayoutFault(page, "/");

    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText(ERROR_TITLE);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    const fontWeight = await heading.evaluate(
      (el) => getComputedStyle(el).fontWeight,
    );
    expect(Number(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("PH-AC-61: the 404 page loads and a client-side Link navigation to / works", async ({
    page,
  }) => {
    await page.goto(`/no-such-page-${randomUUID()}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );

    await page.getByRole("link", { name: "Go to home page" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Next.js Starter" }),
    ).toBeVisible();
  });
});

test.describe("framing", () => {
  const framePath = "/design/frames/auth";
  const frameBase = "/design/frames/";

  test("PH-AC-79: /design/frames/* allows the same origin only, by header", async ({
    request,
  }) => {
    const headers = (await request.get(framePath)).headers();

    expect(headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'self'",
    );
  });

  test("PH-AC-79: every other route is not framable, by header", async ({
    request,
  }) => {
    for (const path of ["/", "/design", "/api/health"]) {
      const headers = (await request.get(path)).headers();

      expect(headers["x-frame-options"], path).toBe("DENY");
      if (path !== "/api/health") {
        expect(headers["content-security-policy"], path).toContain(
          "frame-ancestors 'none'",
        );
      }
    }
  });

  test("PH-AC-79: the same origin can embed /design/frames/auth", async ({
    page,
  }) => {
    // The /design showcase embeds its frames itself, so this is the real use.
    await page.goto("/design");

    await loadAllDesignFrames(page);

    const frames = page.frames().filter((f) => f.url().includes(frameBase));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.map((f) => f.url()).join()).not.toContain("chrome-error:");
  });

  test.describe("blocked framing (the browser reports a violation)", () => {
    test.use({ allowCspViolations: true });

    /** Embeds `target` in an iframe on `host` and returns the frame's URL once settled. */
    async function frameUrlAfterLoad(
      page: Page,
      embedderUrl: string,
      target: string,
    ): Promise<string> {
      await page.route(embedderUrl, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><iframe id="f" src="${target}"></iframe>`,
        }),
      );
      await page.goto(embedderUrl);
      const handle = await page.locator("#f").elementHandle();
      const frame = await handle?.contentFrame();
      await frame?.waitForLoadState("load");
      return frame?.url() ?? "";
    }

    test("PH-AC-79: a different origin cannot embed /design/frames/auth", async ({
      page,
      baseURL,
    }) => {
      const url = await frameUrlAfterLoad(
        page,
        "http://other-origin.example/embed",
        `${baseURL}${framePath}`,
      );

      // Chromium replaces a refused frame with an error document.
      expect(url).toContain("chrome-error:");
    });

    test("PH-AC-79: the same origin cannot embed a route outside /design/frames", async ({
      page,
      baseURL,
    }) => {
      // Served from the app origin so the embedder itself is same-origin.
      const url = await frameUrlAfterLoad(
        page,
        `${baseURL}/embed-probe`,
        `${baseURL}/`,
      );

      expect(url).toContain("chrome-error:");
    });
  });
});
