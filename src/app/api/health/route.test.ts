import { describe, expect, it } from "vitest";

import { GET, dynamic } from "./route";

describe("GET /api/health", () => {
  it("FND-FR-11: responds 200 with the known liveness body", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("FND-FR-11: is evaluated per request, never prerendered", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
