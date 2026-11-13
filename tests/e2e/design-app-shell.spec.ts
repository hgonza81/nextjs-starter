import { expect, test, type Page } from "@playwright/test";

// FND-FR-16 (AppShell: drawer below `md`, skip link), FND-NFR-03 (keyboard
// operation). The app-shell frame route is the real AppShell with sample
// content, loaded as its own page so the viewport is the page viewport.

const FRAME = "/design/frames/app-shell";

async function activeElementIsInside(
  page: Page,
  selector: string,
): Promise<boolean> {
  return page.evaluate(
    (sel) => !!document.activeElement?.closest(sel),
    selector,
  );
}

test.describe("mobile drawer at 375px", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await page.goto(FRAME);
  });

  test("FND-FR-16: keyboard opens the drawer as a dialog named Navigation and moves focus inside", async ({
    page,
  }) => {
    const hamburger = page.getByRole("button", { name: "Open navigation" });
    await hamburger.focus();

    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Navigation" });
    await expect(dialog).toBeVisible();
    // Radix hides the rest of the page from assistive technology while the
    // modal is open, so the hamburger is found by its attribute here.
    await expect(
      page.locator('button[aria-label="Open navigation"]'),
    ).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() => activeElementIsInside(page, '[role="dialog"]'))
      .toBe(true);
    await expect(
      dialog.getByRole("button", { name: "Close navigation" }),
    ).toBeFocused();
  });

  test("FND-FR-16: Tab and Shift+Tab never leave the open drawer", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Open navigation" }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Navigation" }),
    ).toBeVisible();

    const insideAfterEachKey: boolean[] = [];
    for (const key of [
      ...Array<string>(8).fill("Tab"),
      ...Array<string>(8).fill("Shift+Tab"),
    ]) {
      await page.keyboard.press(key);
      insideAfterEachKey.push(
        await activeElementIsInside(page, '[role="dialog"]'),
      );
    }

    expect(insideAfterEachKey).toEqual(Array<boolean>(16).fill(true));
  });

  test("FND-FR-16: Escape closes the drawer and returns focus to the hamburger", async ({
    page,
  }) => {
    const hamburger = page.getByRole("button", { name: "Open navigation" });
    await hamburger.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Navigation" }),
    ).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(hamburger).toBeFocused();
    await expect(hamburger).toHaveAttribute("aria-expanded", "false");
  });

  test("FND-FR-16: Space also opens the drawer", async ({ page }) => {
    await page.getByRole("button", { name: "Open navigation" }).focus();

    await page.keyboard.press("Space");

    await expect(
      page.getByRole("dialog", { name: "Navigation" }),
    ).toBeVisible();
  });

  test("FND-FR-16: resizing across the md breakpoint closes the open drawer and shows the permanent sidebar", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page.getByRole("dialog", { name: "Navigation" }),
    ).toBeVisible();

    await page.setViewportSize({ width: 1000, height: 800 });

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });

  test("FND-FR-16: the hamburger is hidden and the sidebar is permanent from the md breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 800 });

    await expect(
      page.getByRole("button", { name: "Open navigation" }),
    ).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  });
});

for (const width of [375, 1280]) {
  test.describe(`skip link at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test(`FND-NFR-03: the first Tab stop is the skip link and Enter focuses #main-content`, async ({
      page,
    }) => {
      await page.goto(FRAME);

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "Skip to main content" });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();

      await page.keyboard.press("Enter");

      await expect(page.locator("#main-content")).toBeFocused();
    });
  });
}

// FND-T-58 M5: PageHeader owns the full-width mobile action.
for (const { width, isFull } of [
  { width: 375, isFull: true },
  { width: 1280, isFull: false },
]) {
  test(`FND-FR-16: PageHeader primary action ${isFull ? "spans" : "does not span"} its container at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(FRAME);

    const action = page.getByRole("button", { name: "New report" });
    const widths = await action.evaluate((button) => ({
      button: button.getBoundingClientRect().width,
      container: button.parentElement?.getBoundingClientRect().width ?? 0,
    }));

    if (isFull) {
      expect(widths.button).toBeCloseTo(widths.container, 0);
    } else {
      expect(widths.button).toBeLessThan(widths.container);
    }
  });
}
