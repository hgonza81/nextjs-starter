import { expect, test } from "./helpers/fixtures";

import { loadAllDesignFrames } from "./helpers/design-page";

// FND-NFR-04 (responsive, no horizontal page scroll at 375px and 1280px).
// `/` is covered in home.spec.ts. The 18 iframes of fixed width on `/design`
// sit in scrollable wrappers, so the page itself must never overflow.

for (const width of [375, 1280]) {
  test(`FND-NFR-04: /design does not scroll horizontally at ${width}px width with all frames loaded`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/design");
    await loadAllDesignFrames(page);

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
  });
}
