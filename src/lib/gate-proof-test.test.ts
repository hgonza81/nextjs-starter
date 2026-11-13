import { expect, it } from "vitest";

// Throwaway test for FND-T-47: proves that the test gate fails.
it("fails on purpose", () => {
  expect(1 + 1).toBe(3);
});
