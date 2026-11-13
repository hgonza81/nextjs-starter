import { expect, test, type Locator, type Page } from "@playwright/test";

// FND-FR-16 (FormField accessibility wiring, design system 4.4 and 7.1) on
// the working form of `/design`.

function liveForm(page: Page): Locator {
  return page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Check form" }) })
    .first();
}

test.describe("FormField on the /design live form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design");
  });

  test("FND-FR-16: shows no error and no aria-invalid before the field is touched", async ({
    page,
  }) => {
    const email = liveForm(page).getByLabel("Email");

    await expect(email).not.toHaveAttribute("aria-invalid", /.*/);
    await expect(email).toHaveAttribute("aria-required", "true");
  });

  test("FND-FR-16: marks the invalid control with aria-invalid and points aria-describedby at the polite live error", async ({
    page,
  }) => {
    const form = liveForm(page);
    const email = form.getByLabel("Email");

    await email.focus();
    await page.keyboard.press("Tab");

    await expect(email).toHaveAttribute("aria-invalid", "true");
    const describedBy = (await email.getAttribute("aria-describedby")) ?? "";
    const errorId = describedBy.split(" ").find((id) => id.endsWith("-error"));
    expect(errorId).toBeDefined();
    const error = page.locator(`[id="${errorId}"]`);
    await expect(error).toHaveAttribute("aria-live", "polite");
    await expect(error).toContainText("Enter a valid email address");
    // The always-visible hint stays in the description as well.
    expect(describedBy.split(" ").some((id) => id.endsWith("-hint"))).toBe(
      true,
    );
  });

  test("FND-FR-16: removes aria-invalid and the error id once the value is valid", async ({
    page,
  }) => {
    const email = liveForm(page).getByLabel("Email");
    await email.focus();
    await page.keyboard.press("Tab");
    await expect(email).toHaveAttribute("aria-invalid", "true");

    await email.fill("name@company.com");

    await expect(email).not.toHaveAttribute("aria-invalid", /.*/);
    await expect(email).not.toHaveAttribute("aria-describedby", /-error/);
  });

  test("FND-FR-16: flags the password field after blur and keeps the required marker on both fields", async ({
    page,
  }) => {
    const form = liveForm(page);
    const password = form.locator("input[name='password']");

    await password.fill("short");
    await password.blur();

    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAttribute("aria-required", "true");
    await expect(form.getByLabel("Email")).toHaveAttribute(
      "aria-required",
      "true",
    );
  });

  test("FND-FR-16: moves focus to the first invalid field when the form is submitted", async ({
    page,
  }) => {
    const form = liveForm(page);

    await form.getByRole("button", { name: "Check form" }).click();

    await expect(form.getByLabel("Email")).toBeFocused();
  });

  for (const key of ["Enter", "Space"]) {
    test(`FND-FR-16: the password toggle flips the field type with ${key}, keeps focus and renames itself`, async ({
      page,
    }) => {
      const form = liveForm(page);
      const password = form.locator("input[name='password']");
      const toggle = form.getByRole("button", { name: "Show password" });
      await toggle.focus();

      await page.keyboard.press(key);

      await expect(password).toHaveAttribute("type", "text");
      const hide = form.getByRole("button", { name: "Hide password" });
      await expect(hide).toBeFocused();

      await page.keyboard.press(key);

      await expect(password).toHaveAttribute("type", "password");
      await expect(
        form.getByRole("button", { name: "Show password" }),
      ).toBeFocused();
    });
  }
});
