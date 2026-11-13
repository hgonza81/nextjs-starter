import { serverEnv } from "@/lib/env.server";

/**
 * Reads the per-test token from a `?token=` query parameter (PH-AC-08), so a
 * test can find its own failure in the server log among parallel requests.
 * Falls back to "none" so a fixture opened by hand still works.
 */
export function readToken(value: string | string[] | undefined): string {
  const token = Array.isArray(value) ? value[0] : value;
  return token === undefined || token === "" ? "none" : token;
}

/**
 * Route handlers and Server Actions are not wrapped by the segment layout, so
 * they cannot rely on the `/design/errors` gate (PH-FR-23). Returns true when
 * the fixtures are disabled and the caller must answer 404.
 */
export function areFaultFixturesDisabled(): boolean {
  return !serverEnv.DESIGN_PAGE_ENABLED;
}
