import { expect, test } from "@playwright/test";

// FND-FR-15, FND-T-58 I1: the auth card is lighter than the page behind it
// in dark (surfaces get lighter as they rise) and differs from it in light.

for (const theme of ["light", "dark"] as const) {
  test(`FND-FR-15: the auth card background differs from the canvas in ${theme} theme`, async ({
    page,
  }) => {
    await page.goto(`/design/frames/auth?theme=${theme}`);

    const colors = await page.evaluate(() => {
      const card = document.querySelector("main > *");
      const canvas = document.querySelector("main")?.parentElement;
      return {
        card: card ? getComputedStyle(card).backgroundColor : "",
        canvas: canvas ? getComputedStyle(canvas).backgroundColor : "",
      };
    });

    expect(colors.card).not.toBe("");
    expect(colors.card).not.toBe(colors.canvas);
    if (theme === "dark") {
      expect(colors.canvas).toBe("rgb(10, 10, 10)");
      expect(colors.card).toBe("rgb(23, 23, 23)");
    }
  });
}
