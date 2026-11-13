import { expect, test } from "./helpers/fixtures";

import { expectNoAxeViolations } from "./helpers/axe";
import {
  COLOR_SCHEMES,
  FRAME_SLUGS,
  FRAME_WIDTHS,
  loadAllDesignFrames,
} from "./helpers/design-page";

// FND-NFR-03 (accessibility, WCAG 2.2 AA, zero axe violations), FND-FR-16
// (components and layouts) and FND-FR-17 (/design). `/` is covered in
// home.spec.ts; this file covers the showcase and its layout frames.

for (const colorScheme of COLOR_SCHEMES) {
  test.describe(`/design in ${colorScheme} OS mode`, () => {
    test.use({ colorScheme });

    test(`FND-NFR-03: has no axe violations at 1280px with all 18 frames loaded`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/design");
      await loadAllDesignFrames(page);

      await expectNoAxeViolations(page);
    });

    test(`FND-NFR-03: has no axe violations at 375px with all 18 frames loaded`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto("/design");
      await loadAllDesignFrames(page);

      await expectNoAxeViolations(page);
    });
  });
}

// Frame routes directly: widths x OS color scheme x (no theme | ?theme=...).
// A forced ?theme that differs from the OS scheme proves the panel mechanism.
const themeQueries = ["", "?theme=light", "?theme=dark"] as const;

for (const slug of FRAME_SLUGS) {
  for (const width of FRAME_WIDTHS) {
    test.describe(`/design/frames/${slug} at ${width}px`, () => {
      for (const colorScheme of COLOR_SCHEMES) {
        for (const query of themeQueries) {
          test(`FND-NFR-03: has no axe violations with OS ${colorScheme} mode and query "${query}"`, async ({
            browser,
            baseURL,
          }) => {
            const context = await browser.newContext({
              baseURL,
              colorScheme,
              viewport: { width, height: 900 },
            });
            const page = await context.newPage();

            const response = await page.goto(`/design/frames/${slug}${query}`);
            expect(response?.status()).toBe(200);

            await expectNoAxeViolations(page);
            await context.close();
          });
        }
      }
    });
  }
}
