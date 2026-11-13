import { expect, type Page } from "@playwright/test";

export const FRAME_SLUGS = ["auth", "app-shell", "loading"] as const;
export const FRAME_WIDTHS = [375, 768, 1280] as const;
export const COLOR_SCHEMES = ["light", "dark"] as const;

const FRAME_COUNT = 18;
// Bounded but generous: 18 documents are requested at once while other
// workers load the same server. Below the 30 s test timeout, so this message
// (naming the frames) is the failure, not a bare test timeout.
const FRAMES_LOAD_TIMEOUT_MS = 20_000;

/**
 * The 18 layout iframes on `/design` are `loading="lazy"`. Flipping the
 * attribute to eager after the page is up does NOT reliably start the
 * deferred navigations in Chromium: some frames stay on their initial
 * `about:blank` document forever (FND-T-60). So the helper navigates every
 * frame explicitly by re-assigning its `src`, then waits until every frame
 * shows its real document (path and frame page title). The state is
 * deterministic (axe sees the same content on every run) and a frame that
 * never loads is named in the failure.
 */
export async function loadAllDesignFrames(page: Page): Promise<void> {
  await expect(page.locator("iframe")).toHaveCount(FRAME_COUNT);

  await page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      const src = frame.getAttribute("src");
      frame.loading = "eager";
      if (src !== null) {
        frame.src = src;
      }
    }
  });

  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll("iframe")]
            .filter((frame) => {
              const doc = frame.contentDocument;
              const expectedPath = new URL(
                frame.getAttribute("src") ?? "",
                document.baseURI,
              ).pathname;
              return !(
                doc?.readyState === "complete" &&
                doc.location.pathname === expectedPath &&
                // Landmark of a real frame page (a 404 page has another title).
                /^Design: .+ frame$/.test(doc.title) &&
                doc.body.childElementCount > 0
              );
            })
            .map(
              (frame) =>
                `${frame.getAttribute("src")} (${frame.contentDocument?.location.href ?? "no document"}, ${frame.contentDocument?.readyState ?? "?"})`,
            ),
        ),
      {
        message: `all ${FRAME_COUNT} layout iframes load (listed: frames that did not)`,
        timeout: FRAMES_LOAD_TIMEOUT_MS,
      },
    )
    .toEqual([]);
}
