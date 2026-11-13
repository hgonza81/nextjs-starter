import { expect, test } from "./helpers/fixtures";

// FND-FR-17: /design and every route below it return 404 when the server-side
// flag is off, which is the Vercel production state. This file is the only
// design check that makes sense against a deployed URL (FND-T-46), so it has
// no dependency on the local server:
// - locally, the `design-gate-off` project runs it against a production server
//   started WITHOUT DESIGN_PAGE_ENABLED (see playwright.config.ts);
// - against a deployment: `E2E_BASE_URL=<url> pnpm exec playwright test
//   tests/e2e/design-gate.spec.ts` (see tests/README.md).

const GATED_PATHS = [
  "/design",
  "/design/frames/auth",
  "/design/frames/app-shell",
  "/design/frames/loading",
  "/design/frames/auth?theme=dark",
  "/design/anything-else",
] as const;

test.describe("design showcase gate (flag off)", () => {
  for (const path of GATED_PATHS) {
    test(`FND-FR-17: GET ${path} returns 404`, async ({ request }) => {
      const response = await request.get(path);

      expect(response.status()).toBe(404);
    });
  }

  test("FND-FR-17: a browser visit to /design shows the not-found page, not the showcase", async ({
    page,
  }) => {
    const response = await page.goto("/design");

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: /design/i }),
    ).toHaveCount(0);
    await expect(page.locator("iframe")).toHaveCount(0);
  });

  test("FND-FR-17: the gate does not affect the home page", async ({
    request,
  }) => {
    const response = await request.get("/");

    expect(response.status()).toBe(200);
  });

  test("FND-FR-17: the gate does not affect /api/health", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
