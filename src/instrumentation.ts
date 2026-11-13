import type { Instrumentation } from "next";

/**
 * Runs once when the Next.js server starts (`next dev`, `next start`). Loading
 * the env modules here makes a missing or invalid variable fail at startup
 * with a message naming it, instead of on the first request that uses it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
    const { serverEnv } = await import("@/lib/env.server");
    // PH-FR-11: telemetry is opt-in. The SDK module is imported only when an
    // endpoint is set, so it costs nothing and prints nothing otherwise.
    if (serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined) {
      const { startTelemetry } = await import("@/instrumentation.node");
      startTelemetry();
    }
  }
}

/**
 * Observe-only capture of unhandled server errors (PH-FR-05, D7, ADR 0015).
 * Next calls it for errors thrown in renders, route handlers and unwrapped
 * actions, and not for `redirect()`/`notFound()` (ADR 0015 spike), so no
 * filtering is needed here.
 *
 * Only `routePath` (the route pattern), `routeType`, `method`, the error class,
 * `digest`, the database error code and the request id are logged. The only
 * header read is the request id (`pickRequestId`). `request.path` (carries the
 * query string), the other headers and the error message are never read: they
 * can hold personal data, tokens or SQL text.
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
    const { createLogger, pickRequestId } = await import("@/lib/logger");
    // `headers()` is not readable from this hook for route handlers, so the
    // request id comes from the `request.headers` argument (PH-AC-70).
    const requestLogger = createLogger({
      readRequestId: async () => pickRequestId(request.headers),
    });
    await requestLogger.exception("request.unhandled_error", error, {
      routePath: context.routePath,
      routeType: context.routeType,
      method: request.method,
    });
  } catch {
    // Intentionally ignored: observing an error must not cause another one.
  }
};
