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
  // PH-AC-76 (E2E half): every fault fixture is gated too.
  "/design/errors/page-throw",
  "/design/errors/retry",
  "/design/errors/not-found-page",
  "/design/errors/route-throw",
  "/design/errors/form",
  "/design/errors/anything-else",
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

  test("PH-AC-05: a gated route shows the 404 page without a reference code", async ({
    page,
  }) => {
    const response = await page.goto("/design");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
    await expect(page.getByText("Reference code")).toHaveCount(0);
  });

  test("PH-AC-76: a fault fixture page shows the 404 page in a browser", async ({
    page,
  }) => {
    const response = await page.goto("/design/errors/page-throw?token=x");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Page not found",
    );
  });

  test("PH-AC-76: the root layout fault header has no effect when the flag is off", async ({
    request,
  }) => {
    const response = await request.get("/", {
      headers: { "x-fault": "root-layout" },
    });

    expect(response.status()).toBe(200);
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
