import { inspect } from "node:util";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route must not need Docker: `@/db` is replaced by a fake.
const withAnonymousRls = vi.hoisted(() => vi.fn());
vi.mock("@/db", () => ({ withAnonymousRls }));

import { GET, dynamic } from "./route";

const CONNECTION_STRING =
  "postgresql://app_backend:secret@db.example.com:6543/postgres";
// Every fragment of the connection string that must never be exposed.
const FORBIDDEN_FRAGMENTS = [
  CONNECTION_STRING,
  "postgresql://",
  "app_backend",
  "secret",
  "db.example.com",
  "6543",
];

// The logger writes JSON lines to stdout (PH-FR-09), so that is what we watch.
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  withAnonymousRls.mockReset();
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function loggedText(): string {
  // inspect() prints Error messages and stacks, which JSON.stringify drops.
  return inspect(stdoutSpy.mock.calls, { depth: 10, maxStringLength: null });
}

describe("GET /api/health/db", () => {
  it("FND-FR-11: responds 200 with the anon role when the query succeeds", async () => {
    withAnonymousRls.mockResolvedValue([{ current_user: "anon" }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", role: "anon" });
  });

  it("FND-FR-11: runs the probe through withAnonymousRls, the only data path", async () => {
    withAnonymousRls.mockResolvedValue([{ current_user: "anon" }]);

    await GET();

    expect(withAnonymousRls).toHaveBeenCalledTimes(1);
  });

  it("FND-FR-11: responds 503 with a fixed body when the database call throws", async () => {
    withAnonymousRls.mockRejectedValue(new Error("connection refused"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it("FND-FR-11: responds 503 when the database call throws a non-Error value", async () => {
    withAnonymousRls.mockRejectedValue(CONNECTION_STRING);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable" });
  });

  it.each(FORBIDDEN_FRAGMENTS)(
    "FND-FR-05: the 503 body never contains %s from the thrown error",
    async (fragment) => {
      withAnonymousRls.mockRejectedValue(
        new Error(`connect ECONNREFUSED ${CONNECTION_STRING}`),
      );

      const response = await GET();

      expect(await response.text()).not.toContain(fragment);
    },
  );

  it.each(FORBIDDEN_FRAGMENTS)(
    "FND-FR-05: nothing logged contains %s from the thrown error",
    async (fragment) => {
      const error = new Error(`connect ECONNREFUSED ${CONNECTION_STRING}`);
      error.stack = `Error: ${CONNECTION_STRING}\n    at connect (db.example.com:6543)`;
      withAnonymousRls.mockRejectedValue(error);

      await GET();

      expect(loggedText()).not.toContain(fragment);
    },
  );

  it("FND-FR-05: nothing is logged when the thrown value is a bare connection string", async () => {
    withAnonymousRls.mockRejectedValue(CONNECTION_STRING);

    await GET();

    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(loggedText()).not.toContain(fragment);
    }
  });

  it("FND-FR-05: a failure is still logged (without details) so operators can see it", async () => {
    withAnonymousRls.mockRejectedValue(new Error(CONNECTION_STRING));

    await GET();

    expect(stdoutSpy.mock.calls.length > 0).toBe(true);
  });

  it("FND-FR-11: is evaluated per request, never prerendered", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});
