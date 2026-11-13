import { expect, test, type Locator, type Page } from "@playwright/test";

// FND-FR-16 (component states, design system 4.1): hover, active and
// focus-visible cannot be shown statically on /design, so they are tested
// with real mouse and keyboard input. Expected colors are read from the token
// file through the browser (a probe element with `var(--token)`), never typed.

async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = `var(--${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

function background(button: Locator): Promise<string> {
  return button.evaluate((el) => getComputedStyle(el).backgroundColor);
}

/** Records every click that reaches the window, with its default-prevented state. */
async function recordClicks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log: { text: string; defaultPrevented: boolean }[] = [];
    (window as unknown as { __clicks: typeof log }).__clicks = log;
    window.addEventListener("click", (event) => {
      log.push({
        text: (event.target as HTMLElement).textContent ?? "",
        defaultPrevented: event.defaultPrevented,
      });
    });
  });
}

async function recordedClicks(
  page: Page,
): Promise<{ text: string; defaultPrevented: boolean }[]> {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __clicks: { text: string; defaultPrevented: boolean }[];
        }
      ).__clicks,
  );
}

test.describe("Button live states on /design", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design");
  });

  test("FND-FR-16: the default Button uses --primary at rest, --primary-hover on hover and --primary-active while pressed", async ({
    page,
  }) => {
    const button = page
      .getByRole("button", { name: "default", exact: true })
      .first();
    const [primary, hover, active] = await Promise.all([
      tokenColor(page, "primary"),
      tokenColor(page, "primary-hover"),
      tokenColor(page, "primary-active"),
    ]);
    await expect.poll(() => background(button)).toBe(primary);

    await button.hover();
    await expect.poll(() => background(button)).toBe(hover);

    await page.mouse.down();
    await expect.poll(() => background(button)).toBe(active);

    await page.mouse.up();
  });

  test("FND-FR-16: the destructive Button uses --destructive-hover on hover", async ({
    page,
  }) => {
    const button = page
      .getByRole("button", { name: "destructive", exact: true })
      .first();
    const hover = await tokenColor(page, "destructive-hover");

    await button.hover();

    await expect.poll(() => background(button)).toBe(hover);
  });

  test("FND-FR-16: keyboard Tab focus shows the 2px --ring outline and mouse hover alone does not", async ({
    page,
  }) => {
    const button = page
      .getByRole("button", { name: "default", exact: true })
      .first();
    const ring = await tokenColor(page, "ring");
    const outline = () =>
      button.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          width: style.outlineWidth,
          style: style.outlineStyle,
          color: style.outlineColor,
        };
      });
    await button.hover();
    expect((await outline()).style).toBe("none");

    // Land on the button by keyboard so :focus-visible applies.
    await button.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");

    await expect(button).toBeFocused();
    // The outline color is part of `transition-colors`: wait for it to settle.
    await expect.poll(outline).toEqual({
      width: "2px",
      style: "solid",
      color: ring,
    });
  });

  test("FND-FR-16: a disabled Button receives no click and cannot take focus", async ({
    page,
  }) => {
    const button = page
      .getByRole("button", { name: "default disabled" })
      .first();
    await recordClicks(page);

    await button.click({ force: true });
    await button.focus();
    await page.keyboard.press("Enter");

    await expect(button).toBeDisabled();
    await expect(button).not.toBeFocused();
    expect(await recordedClicks(page)).toEqual([]);
  });

  test("FND-FR-16: a loading Button keeps focus, exposes aria-disabled and ignores click and Enter", async ({
    page,
  }) => {
    const button = page.getByRole("button", { name: "Saving…" }).first();
    await recordClicks(page);
    const before = await background(button);

    // Playwright treats aria-disabled as not actionable, so force the click.
    await button.click({ force: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");

    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(button).not.toHaveAttribute("disabled");
    await expect(button).toBeFocused();
    // Every activation reached the page but was cancelled by the Button.
    const clicks = await recordedClicks(page);
    expect(clicks.length).toBeGreaterThan(0);
    expect(clicks.every((click) => click.defaultPrevented)).toBe(true);
    expect(await background(button)).toBe(before);
  });

  test("FND-FR-16: a loading Button does not change color on hover", async ({
    page,
  }) => {
    const button = page.getByRole("button", { name: "Saving…" }).first();
    const before = await background(button);

    await button.hover();
    await page.mouse.down();

    await expect.poll(() => background(button)).toBe(before);
    await page.mouse.up();
  });
});
