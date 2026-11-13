import { areFaultFixturesDisabled } from "@/app/design/errors/_lib";

// Evaluated per request: the flag is read at runtime, never baked in at build.
export const dynamic = "force-dynamic";

/**
 * Fault fixture (PH-FR-23): a route handler that throws. Gates itself because
 * the segment layout does not wrap route handlers; answers a plain 404 when the
 * flag is off.
 */
export function GET(request: Request): Response {
  if (areFaultFixturesDisabled()) {
    return new Response(null, { status: 404 });
  }
  const token = new URL(request.url).searchParams.get("token") ?? "none";
  throw new Error(`Injected route handler fault (token: ${token})`);
}
