import { expect, test } from "@playwright/test";

// FND-FR-16 (Sonner toast, design system 4.9): exactly one provider, mounted
// in the root layout, so a toast fired from any page appears once.

const REGION = 'section[aria-label^="Notifications"]';

test.describe("toast provider", () => {
  for (const path of ["/", "/design"]) {
    test(`FND-FR-16: ${path} mounts exactly one Sonner region`, async ({
      page,
    }) => {
      await page.goto(path);

      await expect(page.locator(REGION)).toHaveCount(1);
      await expect(page.locator(REGION)).toHaveAttribute("aria-live", "polite");
      // The list appears with the first toast; none must exist beyond one.
      expect(
        await page.locator("[data-sonner-toaster]").count(),
      ).toBeLessThanOrEqual(1);
    });
  }

  test("FND-FR-16: a toast trigger shows one toast inside the polite live region", async ({
    page,
  }) => {
    await page.goto("/design");

    await page.getByRole("button", { name: "Success toast" }).first().click();

    const toast = page.locator(`${REGION} [data-sonner-toast]`);
    await expect(toast).toHaveCount(1);
    await expect(toast).toContainText("Company created.");
    await expect(toast).toHaveAttribute("data-type", "success");
    await expect(page.locator("[data-sonner-toaster]")).toHaveCount(1);
  });

  test("FND-FR-16: the same trigger in the other theme panel still shows a single toast", async ({
    page,
  }) => {
    await page.goto("/design");

    await page.getByRole("button", { name: "Error toast" }).last().click();

    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
    await expect(page.locator("[data-sonner-toast]")).toContainText(
      "Could not save the change.",
    );
  });
});
