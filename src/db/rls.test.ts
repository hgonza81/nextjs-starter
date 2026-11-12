import { beforeEach, describe, expect, it, vi } from "vitest";

// Unit level only: the database client is replaced, so nothing here can reach
// Postgres. The DB-backed behavior of withRls is covered in tests/db (T-15/16).
const getDb = vi.fn(() => {
  throw new Error("database must not be touched");
});
vi.mock("./client", () => ({ getDb }));

const { withRls } = await import("./rls");

const validUserId = "6f1c5a3e-2b7d-4c1a-9e55-0a1b2c3d4e5f";
const never = async () => {
  throw new Error("callback must not run");
};

beforeEach(() => {
  getDb.mockClear();
});

describe("withRls input validation (no database)", () => {
  it.each([
    ["empty string", ""],
    ["whitespace only", "   "],
    ["not a UUID", "not-a-uuid"],
    ["SQL-looking text", "'; drop table users; --"],
    ["UUID with trailing text", `${validUserId}x`],
    ["undefined (missing)", undefined as unknown as string],
  ])(
    "FND-FR-09: rejects a user id that is %s before touching the database",
    async (_label, userId) => {
      await expect(withRls({ userId, claims: {} }, never)).rejects.toThrow(
        /non-empty verified user id/,
      );
      expect(getDb).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   "])(
    "FND-FR-09: rejects an empty tenant id (%j) before touching the database",
    async (tenantId) => {
      await expect(
        withRls({ userId: validUserId, claims: {}, tenantId }, never),
      ).rejects.toThrow(/empty tenant id/);
      expect(getDb).not.toHaveBeenCalled();
    },
  );

  it("FND-FR-09: a valid context passes validation and proceeds to the database", async () => {
    await expect(
      withRls({ userId: validUserId, claims: {} }, never),
    ).rejects.toThrow("database must not be touched");
    expect(getDb).toHaveBeenCalledOnce();
  });
});
