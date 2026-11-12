// FND-FR-11 (liveness): reports that the app process is up. It must never
// import the database module or read database variables, so it stays 200 with
// no database (the deployed app has none until a cloud project exists, ADR 0004).
// The post-deploy hello-world check curls this route and expects this body.

// Evaluated per request: a prerendered response would stay "ok" even if the
// running server were unhealthy.
export const dynamic = "force-dynamic";

/** Liveness probe. Returns 200 and `{ "status": "ok" }`. */
export function GET(): Response {
  return Response.json({ status: "ok" });
}
