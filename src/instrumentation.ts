import type { Instrumentation } from "next";


/**
 * Runs once when the Next.js server starts (`next dev`, `next start`). Loading
 * the env modules here makes a missing or invalid variable fail at startup
 * with a message naming it, instead of on the first request that uses it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
    await import("@/lib/env.server");
  }
}

/**
 * Observe-only capture of unhandled server errors (PH-FR-05, D7, ADR 0015).
 * Next calls it for errors thrown in renders, route handlers and unwrapped
 * actions, and not for `redirect()`/`notFound()` (ADR 0015 spike), so no
 * filtering is needed here.
 *
 * Only `routePath` (the route pattern), `routeType`, `method`, the error class,
 * `digest` and the database error code are logged. `request.path` (carries the
 * query string), headers and the error message are never read: they can hold
 * personal data, tokens or SQL text.
 *
 * It must never throw, so a logging failure cannot change the response.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  // The logger needs Node APIs; the edge runtime is not used by this app.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { logger } = await import("@/lib/logger");
    await logger.exception("request.unhandled_error", error, {
      routePath: context.routePath,
      routeType: context.routeType,
      method: request.method,
    });
  } catch {
    // Intentionally ignored: observing an error must not cause another one.
  }
};
