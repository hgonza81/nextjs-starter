import { randomUUID } from "node:crypto";

import { expectNoAxeViolations } from "./helpers/axe";
import { expect, test, type Page } from "./helpers/fixtures";

// PH-FR-01, 02, 03, 04, 23 and PH-NFR-04: the 500, global error and 404 pages
// in a real browser on the production build. These are client-rendered error
// boundaries, so they cannot be checked with a plain HTTP request.
// The flag-off half (every /design/errors/* returns 404) is in
// design-gate.spec.ts, which runs against the flag-off server.

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const ERROR_TITLE = "Something went wrong";

/** A unique value per test so parallel tests never share a fixture state. */
function newToken(): string {
  return `t-${randomUUID()}`;
}

function heading(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

/** The reference code is the `code` element next to the "Reference code" label. */
function referenceCode(page: Page) {
  return page.locator("code");
}

/** Adds the root-layout fault header to the next document request only. */
async function navigateWithRootLayoutFault(
  page: Page,
  path: string,
): Promise<number | undefined> {
  const pattern = (url: URL) => url.pathname === path;
  await page.route(pattern, (route) =>
    route.continue({
      headers: { ...route.request().headers(), "x-fault": "root-layout" },
    }),
  );
  const response = await page.goto(path);
  await page.unroute(pattern);
  return response?.status();
}

test.describe("500 page (error.tsx)", () => {
  test("PH-AC-01, PH-AC-62: a page that throws before streaming answers HTTP 500 and shows the friendly page with a reference code", async ({
    page,
  }) => {
    const response = await page.goto(
      `/design/errors/page-throw?token=${newToken()}`,
    );

    expect(response?.status()).toBe(500);
    await expect(heading(page)).toHaveText(ERROR_TITLE);
    await expect(referenceCode(page)).toHaveText(CODE_PATTERN);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Go to home page" }),
    ).toBeVisible();
  });

  test("PH-AC-01, PH-AC-06: the page and the response HTML show no message, stack or path", async ({
    page,
  }) => {
    const token = newToken();
    const response = await page.goto(
      `/design/errors/page-throw?token=${token}`,
    );
    const html = (await response?.text()) ?? "";

    await expect(heading(page)).toHaveText(ERROR_TITLE);
    const visibleText = await page.locator("body").innerText();
    for (const text of [visibleText, html]) {
      expect(text).not.toContain("Injected page fault");
      expect(text).not.toMatch(/\bat .*\.(js|ts|tsx):\d+/);
      expect(text).not.toContain("/src/app/");
    }
  });

  test("PH-AC-02: Try again recovers when the cause is gone", async ({
    page,
  }) => {
    const token = newToken();
    // The retry fixture fails on the first request for a token only.
    await page.goto(`/design/errors/retry?token=${token}`);
    await expect(heading(page)).toHaveText(ERROR_TITLE);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(
      page.getByText(`Recovered after retry (token: ${token})`),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: ERROR_TITLE })).toHaveCount(
      0,
    );
  });

  test("PH-AC-02: Try again shows the 500 page again while the cause persists", async ({
    page,
  }) => {
    await page.goto(`/design/errors/page-throw?token=${newToken()}`);
    await expect(heading(page)).toHaveText(ERROR_TITLE);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect(heading(page)).toHaveText(ERROR_TITLE);
    await expect(referenceCode(page)).toHaveText(CODE_PATTERN);
    await expect(heading(page)).toBeFocused();
  });

  test("PH-AC-01: Go to home page leaves the error page for /", async ({
    page,
  }) => {
    await page.goto(`/design/errors/page-throw?token=${newToken()}`);

    await page.getByRole("link", { name: "Go to home page" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: ERROR_TITLE })).toHaveCount(
      0,
    );
  });

  test("PH-AC-07, PH-NFR-04: the heading is focused on mount and Tab reaches each action in order", async ({
    page,
  }) => {
    await page.goto(`/design/errors/page-throw?token=${newToken()}`);

    await expect(heading(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Go to home page" }),
    ).toBeFocused();
  });

  test("PH-AC-07, PH-NFR-04: the reference code is selectable text", async ({
    page,
  }) => {
    await page.goto(`/design/errors/page-throw?token=${newToken()}`);
    const code = referenceCode(page);
    const expected = (await code.textContent()) ?? "";

    await code.dblclick();

    const selected = await page.evaluate(() =>
      window.getSelection()?.toString().trim(),
    );
    expect(expected).toMatch(CODE_PATTERN);
    expect(selected).toBe(expected);
  });
});

test.describe("global error page (global-error.tsx)", () => {
  test("PH-AC-03, PH-FR-23: a root layout failure shows the global error page with a reference code", async ({
    page,
  }) => {
    const status = await navigateWithRootLayoutFault(page, "/");

    expect(status).toBe(500);
    await expect(heading(page)).toHaveText(ERROR_TITLE);
    await expect(referenceCode(page)).toHaveText(CODE_PATTERN);
    await expect(heading(page)).toBeFocused();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // No site chrome: the root layout is gone, only the status page remains.
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("Injected root layout fault");
  });

  test("PH-AC-03: the home action is a plain link that loads / once the fault is gone", async ({
    page,
  }) => {
    await navigateWithRootLayoutFault(page, "/");
    const home = page.getByRole("link", { name: "Go to home page" });
    await expect(home).toHaveAttribute("href", "/");

    await home.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: ERROR_TITLE })).toHaveCount(
      0,
    );
  });

  test("PH-FR-23: without the fault header the root layout renders normally", async ({
    page,
  }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: ERROR_TITLE })).toHaveCount(
      0,
    );
  });
});

test.describe("404 page (not-found.tsx)", () => {
  test("PH-AC-04, PH-AC-62: an unknown URL answers HTTP 404 and shows the page without a reference code", async ({
    page,
  }) => {
    const response = await page.goto(`/no-such-page-${randomUUID()}`);

    expect(response?.status()).toBe(404);
    await expect(heading(page)).toHaveText("Page not found");
    await expect(page.getByText("Reference code")).toHaveCount(0);
    await expect(referenceCode(page)).toHaveCount(0);
  });

  test("PH-AC-04: notFound() from a page shows the same 404 page", async ({
    page,
  }) => {
    const response = await page.goto("/design/errors/not-found-page");

    expect(response?.status()).toBe(404);
    await expect(heading(page)).toHaveText("Page not found");
  });

  test("PH-AC-04: Go to home page leaves the 404 page for /", async ({
    page,
  }) => {
    await page.goto("/no-such-page");

    await page.getByRole("link", { name: "Go to home page" }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(heading(page)).not.toHaveText("Page not found");
  });
});

test.describe("accessibility of the status pages", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test.describe(`${colorScheme} mode`, () => {
      test.use({ colorScheme });

      test(`PH-AC-07, PH-NFR-04: the 500 page has no axe violations in ${colorScheme} mode`, async ({
        page,
      }) => {
        await page.goto(`/design/errors/page-throw?token=${newToken()}`);
        await expect(heading(page)).toHaveText(ERROR_TITLE);

        await expectNoAxeViolations(page);
      });

      test(`PH-AC-07, PH-NFR-04: the global error page has no axe violations in ${colorScheme} mode`, async ({
        page,
      }) => {
        await navigateWithRootLayoutFault(page, "/");
        await expect(heading(page)).toHaveText(ERROR_TITLE);

        await expectNoAxeViolations(page);
      });

      test(`PH-AC-07, PH-NFR-04: the 404 page has no axe violations in ${colorScheme} mode`, async ({
        page,
      }) => {
        await page.goto("/no-such-page");
        await expect(heading(page)).toHaveText("Page not found");

        await expectNoAxeViolations(page);
      });
    });
  }
});

test.describe("StatusPage on /design", () => {
  test("PH-AC-77: the showcase lists StatusPage with and without a reference code", async ({
    page,
  }) => {
    await page.goto("/design");
    const section = page.locator("#status-page");

    await expect(section).toBeVisible();
    // Embedded samples use h3 so /design keeps one h1 (two themes x two samples).
    await expect(
      section.getByRole("heading", { name: ERROR_TITLE }),
    ).toHaveCount(2);
    await expect(
      section.getByRole("heading", { name: "Page not found" }),
    ).toHaveCount(2);
    await expect(section.getByText("1234567890")).toHaveCount(2);
  });
});
