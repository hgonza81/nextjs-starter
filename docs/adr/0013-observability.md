# 0013. Observability: OpenTelemetry NodeSDK, logger, local collector

Status: Accepted
Date: 2026-11-13
Epic: 002-platform-hardening

## Context
Until now the only observability is one `console.error` call site (convention C8). Later epics need traces, structured logs and a way to correlate them, without making the app depend on a telemetry backend, without blocking requests, and without leaking personal data. The app has no edge runtime code. Next.js 16.4.6 supports `instrumentation.ts` with `register()` and `onRequestError`.

## Options considered
1. SDK: (a) manual `@opentelemetry/sdk-node` with OTLP/HTTP exporters; (b) `@vercel/otel` (shorter, couples to Vercel conventions, still needs peer packages); (c) no telemetry, logs only.
2. Exporter: OTLP/HTTP (chosen) versus OTLP/gRPC (native and size cost, poor fit for serverless).
3. Logger: (a) own ~40-line module; (b) pino or winston (dependency, transports we do not need); (c) bare `console`.
4. Local collector: (a) Grafana LGTM in one container (`grafana/otel-lgtm`); (b) Jaeger (traces only); (c) none.

## Decision
- **SDK:** manual `@opentelemetry/sdk-node` with OTLP/HTTP trace, log and metric exporters, started from `src/instrumentation.node.ts`, which `register()` imports only when `NEXT_RUNTIME === "nodejs"` (the NodeSDK is not edge-compatible; the repo has no edge code). Vendor-neutral and configured by the standard `OTEL_*` variables. Rejected: `@vercel/otel` (swapping is a one-file change either way, so this door is cheap), gRPC.
- **Off without a destination:** the SDK starts only if `OTEL_EXPORTER_OTLP_ENDPOINT` is set (per-signal endpoint variables are not supported in the first cut). Otherwise nothing starts, `@opentelemetry/api` calls are no-ops, and there is no connection-refused noise (the NodeSDK default is `localhost:4318`).
- **Never blocking:** batch processors only (never `SimpleSpanProcessor`); exporter errors go to the OTel diagnostic logger, not to the request.
- **Depth (first cut):** framework spans only, no database spans. The metrics pipeline is wired; no custom metrics, no runtime-metrics instrumentation.
- **Variables:** `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL), `OTEL_EXPORTER_OTLP_PROTOCOL` (optional, `http/protobuf` or `http/json`), `OTEL_SERVICE_NAME` (optional, default `nextjs-starter`) are declared and Zod-validated in `env.server.ts`, so a typo fails at startup. The SDK reads the rest of `OTEL_*` itself; this is the documented exception to C11. `OTEL_EXPORTER_OTLP_HEADERS` may carry credentials in cloud: read only by the SDK, never logged, a commented line with a warning in `.env.example`.
- **Logger:** `src/lib/logger.ts` (`import "server-only"`), no dependency. API `logger.debug|info|warn|error(event, fields?)` and `logger.exception(event, err, fields?)`. Fields are typed `string | number | boolean | null` (no objects, no `Error`), strings truncated to 200 characters, and a runtime key deny-list (`/email|token|password|secret|authorization|cookie|body|dsn|url|key/i`) replaces values with `"[redacted]"`. `exception` records only `error_name`, `error_code` and `digest`, never message or stack. Output is one JSON line `{ts, level, event, trace_id?, span_id?, request_id?, ...fields}` on stdout and also an OTel log record through `@opentelemetry/api-logs` (no-op without the SDK). `trace_id` comes from the active span; `request_id` is read from `x-request-id` or `x-vercel-id` through a guarded `headers()` call when present, absent outside a request, and never generated. Emission is wrapped in try/catch: a failing sink never affects the request (PH-AC-72). No log-level variable. ESLint `no-console` on `src/**` with the logger file exempt enforces use.
- **`onRequestError`:** logs only `context.routePath`, `context.routeType`, `request.method`, the error class name, `digest` and the database error code. Never `request.path` (query string may carry tokens or emails), headers, cookies or the message. The hook is observe-only; it cannot change a response.
- **Local collector:** Grafana LGTM, one container, UI on host port 3001, all ports bound to `127.0.0.1`, image pinned to an exact tag, no volume, in `docker/observability/`, `pnpm obs:start` / `pnpm obs:stop`. Not part of `pnpm dev`, tests or CI. Rejected: Jaeger.
- **Test seams:** OpenTelemetry is tested with an in-memory exporter and a small OTLP receiver, never the collector.

## Consequences
- Positive: zero cost and zero failure modes when no endpoint is set; a cloud backend (Grafana Cloud, Sentry via OTLP) is `OTEL_*` variables only; logs and traces correlate.
- Negative: about 9 new exact-pinned dependencies (subject to the 24-hour release-age gate of ADR 0010); the own logger must be kept small.
- Updates convention C8 (the "no observability tooling" sentence is removed).
- **Spikes (first tasks):** `sdk-node` bundling and versions under Turbopack and Node 26 (may need `serverExternalPackages`); that a throwaway OTLP receiver gets a trace; `onRequestError` does not fire for `redirect()` and `notFound()`.
- Revisit: database spans or custom metrics when a feature needs them; `@vercel/otel` if the SDK proves fragile on Vercel.

## References
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`
- `node_modules/next/dist/docs/01-app/02-guides/open-telemetry.md`
- Epic 002 `questions.md` (D1 to D4, D7); ADR 0004, ADR 0010.
