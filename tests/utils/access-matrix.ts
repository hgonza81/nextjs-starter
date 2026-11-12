import { expect, it } from "vitest";

/**
 * Table-driven allow/deny matrix. Each case runs one action as one actor and
 * returns how many rows it saw or changed. The outcome is:
 * - allowed: the action succeeded and touched at least one row;
 * - denied: Postgres refused it (permission denied 42501, RLS violation) or RLS
 *   filtered it to zero rows (the normal RLS behavior for select/update/delete).
 */
export type AccessCase = {
  actor: string;
  action: string;
  expected: "allow" | "deny";
  run: () => Promise<number>;
};

/** SQLSTATEs that mean "refused by privileges or RLS". */
const DENIED_CODES = new Set(["42501"]);

function pgCode(error: unknown): string | undefined {
  // Drizzle wraps the driver error: the Postgres code is on `cause`.
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export async function attempt(
  run: () => Promise<number>,
): Promise<"allowed" | "denied"> {
  try {
    return (await run()) > 0 ? "allowed" : "denied";
  } catch (error) {
    const code = pgCode(error);
    if (code !== undefined && DENIED_CODES.has(code)) return "denied";
    throw error; // an unexpected failure must fail the test, not count as deny
  }
}

/** Registers one `it` per case. Call inside a `describe`. */
export function defineAccessMatrix(cases: readonly AccessCase[]): void {
  it.each(cases)(
    "$actor: $action is expected to be $expected",
    async ({ expected, run }) => {
      const outcome = await attempt(run);
      expect(outcome).toBe(expected === "allow" ? "allowed" : "denied");
    },
  );
}
