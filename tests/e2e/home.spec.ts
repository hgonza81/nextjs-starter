import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./helpers/fixtures";

// FND-FR-19/FND-FR-20 (E2E), FND-NFR-03 (home page, light and dark).

test.describe("home page", () => {
  test("FND-FR-20: renders the project heading with HTTP 200 and no console errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "Next.js Starter" }),
    ).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`FND-NFR-03: has no WCAG 2.2 AA axe violations in ${colorScheme} mode`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({ baseURL, colorScheme });
      const page = await context.newPage();
      await page.goto("/");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(results.violations).toEqual([]);
      await context.close();
    });
  }

  for (const width of [375, 1280]) {
    test(`FND-NFR-03: does not scroll horizontally at ${width}px width`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width, height: 800 },
      });
      const page = await context.newPage();
      await page.goto("/");

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );

      expect(overflow).toBeLessThanOrEqual(0);
      await context.close();
    });
  }
});
