import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

// FND-FR-15 (one token file, light and dark) and FND-FR-16: the OS dark setting applies the dark tokens before first paint with
// no theme script, no class and no flash.

const globalsCss = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

type TokenPair = { light: string; dark: string };

/** Reads `--name: light-dark(#aaaaaa, #bbbbbb);` pairs from globals.css. */
function readTokens(names: readonly string[]): Record<string, TokenPair> {
  return Object.fromEntries(
    names.map((name) => {
      const match = new RegExp(
        `--${name}:\\s*light-dark\\(\\s*(#[0-9a-fA-F]{6})\\s*,\\s*(#[0-9a-fA-F]{6})\\s*\\)`,
      ).exec(globalsCss);
      if (!match) throw new Error(`Token --${name} not found in globals.css`);
      return [name, { light: toRgb(match[1]!), dark: toRgb(match[2]!) }];
    }),
  );
}

function toRgb(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

const KEY_TOKENS = [
  "background",
  "foreground",
  "primary",
  "primary-hover",
  "destructive",
  "muted-foreground",
  "input",
] as const;

/** Resolves each token to the color the browser actually paints. */
async function resolveTokens(
  page: Page,
  selector: string,
): Promise<Record<string, string>> {
  return page.evaluate(
    ({ tokens, selector }) => {
      const host = document.querySelector(selector) ?? document.body;
      const probe = document.createElement("div");
      host.append(probe);
      const resolved = Object.fromEntries(
        tokens.map((token) => {
          probe.style.backgroundColor = `var(--${token})`;
          return [token, getComputedStyle(probe).backgroundColor];
        }),
      );
      probe.remove();
      return resolved;
    },
    { tokens: [...KEY_TOKENS], selector },
  );
}

const expectedTokens = readTokens(KEY_TOKENS);

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} OS color scheme`, () => {
    test.use({ colorScheme: scheme });

    test(`FND-FR-15: resolves the key tokens to the ${scheme} values of globals.css`, async ({
      page,
    }) => {
      await page.goto("/");

      const resolved = await resolveTokens(page, "body");

      expect(resolved).toEqual(
        Object.fromEntries(
          KEY_TOKENS.map((token) => [token, expectedTokens[token]![scheme]]),
        ),
      );
    });
  });
}

test.describe("first paint", () => {
  test.use({ colorScheme: "dark" });

  test("FND-FR-15: paints the dark background without running any JavaScript", async ({
    browser,
    baseURL,
  }) => {
    // With JavaScript off no theme script could have corrected the colors,
    // so dark here means the stylesheet alone decides the theme.
    const context = await browser.newContext({
      baseURL,
      colorScheme: "dark",
      javaScriptEnabled: false,
    });
    const page = await context.newPage();
    await page.goto("/");

    const colors = await page.evaluate(() => ({
      // evaluate still runs: Playwright's isolated world ignores the setting.
      background: getComputedStyle(document.body).backgroundColor,
      text: getComputedStyle(document.body).color,
    }));

    expect(colors).toEqual({
      background: expectedTokens["background"]!.dark,
      text: expectedTokens["foreground"]!.dark,
    });
    await context.close();
  });

  test("FND-FR-15: server HTML has a stylesheet, color-scheme meta and no theme script, class or attribute", async ({
    request,
  }) => {
    const html = await (await request.get("/")).text();
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
    const htmlTag = /<html[^>]*>/.exec(html)?.[0] ?? "";
    const inlineScripts = [
      ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ]
      .map((match) => match[1] ?? "")
      // Next.js flight data and chunk loaders are framework payload, not
      // theme code (the payload carries the 404 page CSS, which has a
      // prefers-color-scheme rule).
      .filter(
        (script) =>
          !script.startsWith("self.__next_f") &&
          !script.startsWith('(globalThis["TURBOPACK"]'),
      );

    expect(head).toMatch(/<link[^>]+rel="stylesheet"[^>]*>/);
    expect(head).toMatch(/<meta name="color-scheme" content="light dark"\/?>/);
    // The only class on <html> is the font variable; no theme class or style.
    expect(htmlTag).not.toMatch(
      /data-theme|style=|class="[^"]*\b(dark|light)\b/,
    );
    expect(
      inlineScripts.filter((script) =>
        /prefers-color-scheme|localStorage|classList|data-theme|setAttribute/.test(
          script,
        ),
      ),
    ).toEqual([]);
  });

  test("FND-FR-15: the first paint already uses the dark background", async ({
    page,
  }) => {
    // Records the body background at the first paint entry. A light flash
    // would show up as the light value here.
    await page.addInitScript(() => {
      new PerformanceObserver((list, observer) => {
        if (list.getEntries().some((e) => e.name === "first-paint")) {
          (window as unknown as { __paintBg: string }).__paintBg =
            getComputedStyle(document.body).backgroundColor;
          observer.disconnect();
        }
      }).observe({ type: "paint", buffered: true });
    });
    await page.goto("/");

    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { __paintBg?: string }).__paintBg,
        ),
      )
      .toBe(expectedTokens["background"]!.dark);
  });
});

test.describe("/design theme panels", () => {
  test.use({ colorScheme: "light" });

  test("FND-FR-16: a data-theme=dark panel resolves dark tokens while the page follows the light OS setting", async ({
    page,
  }) => {
    await page.goto("/design");

    const pageTokens = await resolveTokens(page, "body");
    const panel = await resolveTokens(page, '[data-theme="dark"]');

    expect(pageTokens["background"]).toBe(expectedTokens["background"]!.light);
    expect(panel["background"]).toBe(expectedTokens["background"]!.dark);
    expect(panel["primary"]).toBe(expectedTokens["primary"]!.dark);
  });
});
