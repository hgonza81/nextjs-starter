import { randomBytes, randomUUID } from "node:crypto";

/** Short random lowercase hex suffix; safe inside SQL identifiers. */
export function randomSuffix(bytes = 6): string {
  return randomBytes(bytes).toString("hex");
}

/** Unique value per call, so tests never collide when run in parallel. */
export function uniqueName(prefix: string): string {
  return `${prefix}_${randomSuffix()}`;
}

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomSuffix()}@example.test`;
}

export function newId(): string {
  return randomUUID();
}

/** Name prefix of every throwaway table (swept by the DB global setup). */
export const THROWAWAY_PREFIX = "tmp_test_";
