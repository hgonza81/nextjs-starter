import { expect, test } from "@playwright/test";

// FND-FR-11 (liveness) seen from outside. The post-deploy hello-world check
// (FND-T-24) runs this file against the deployed URL with E2E_BASE_URL set.

test.describe("GET /api/health", () => {
  test("FND-FR-11: returns 200 and the known body", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
