import { expect, type Page } from "@playwright/test";

export const FRAME_SLUGS = ["auth", "app-shell", "loading"] as const;
export const FRAME_WIDTHS = [375, 768, 1280] as const;
export const COLOR_SCHEMES = ["light", "dark"] as const;

/**
 * The 18 layout iframes on `/design` are lazy. Making them eager and waiting
 * until every one has a loaded document makes the page state deterministic
 * (axe sees the same content on every run).
 */
export async function loadAllDesignFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      frame.loading = "eager";
    }
  });

  await expect(page.locator("iframe")).toHaveCount(18);
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll("iframe")].every(
            (frame) =>
              frame.contentDocument?.readyState === "complete" &&
              frame.contentDocument.body.childElementCount > 0 &&
              frame.contentDocument.location.pathname.startsWith(
                "/design/frames/",
              ),
          ),
        ),
      { message: "all 18 layout iframes load" },
    )
    .toBe(true);
}
