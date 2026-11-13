import "server-only";

import { NodeSDK } from "@opentelemetry/sdk-node";

import { serverEnv } from "@/lib/env.server";

/**
 * Starts the OpenTelemetry Node SDK (PH-FR-11, ADR 0013). Loaded by
 * `register()` only in the Node runtime and only when
 * `OTEL_EXPORTER_OTLP_ENDPOINT` is set, so with telemetry off this module and
 * the SDK are never imported.
 *
 * The SDK configures itself from the standard `OTEL_*` variables: the OTLP
 * trace, log and metric exporters (with batch processors and a periodic metric
 * reader), the signal paths appended to the base endpoint, and the transport.
 * `OTEL_EXPORTER_OTLP_PROTOCOL` selects http/protobuf (the SDK default) or
 * http/json, so the declared variable and the wire format cannot disagree. No
 * custom metrics are defined, so the metrics pipeline starts and stays idle.
 *
 * Export is asynchronous and batched: an unreachable collector drops data
 * silently (the OTel diagnostic logger is off by default) and never delays or
 * fails a request (PH-NFR-03).
 */
export function startTelemetry(): void {
  // `OTEL_SERVICE_NAME` defaults in the validated env, not in `process.env`,
  // so the name is passed explicitly to cover the unset case.
  const sdk = new NodeSDK({ serviceName: serverEnv.OTEL_SERVICE_NAME });
  sdk.start();
}
