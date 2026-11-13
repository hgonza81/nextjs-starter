import { createServer, type Server } from "node:http";

// Minimal OTLP/HTTP receiver for the telemetry E2E tests (PH-AC-65, spec 8
// "E2E harness"). Plain Node `http`, JSON only (the telemetry servers set
// OTEL_EXPORTER_OTLP_PROTOCOL=http/json). The Docker collector is never used.
//
// It runs in the Playwright main process (global setup), while the tests run in
// workers, so recorded requests are read over HTTP: `GET /__received` returns
// every request seen so far, in arrival order.

/** One OTLP export request, reduced to what the tests assert on. */
export type ReceivedExport = {
  /** `/v1/traces`, `/v1/logs` or `/v1/metrics`. */
  path: string;
  contentType: string;
  /** `service.name` resource attribute of the first resource, if any. */
  serviceName: string | null;
  /** Log record bodies (the logger event names); empty for other signals. */
  logBodies: string[];
};

export const RECEIVED_PATH = "/__received";

type AnyValue = { stringValue?: string };
type Attribute = { key?: string; value?: AnyValue };
type OtlpPayload = {
  resourceSpans?: { resource?: { attributes?: Attribute[] } }[];
  resourceLogs?: {
    resource?: { attributes?: Attribute[] };
    scopeLogs?: { logRecords?: { body?: AnyValue }[] }[];
  }[];
  resourceMetrics?: { resource?: { attributes?: Attribute[] } }[];
};

function serviceNameOf(attributes: Attribute[] | undefined): string | null {
  const found = attributes?.find((a) => a.key === "service.name");
  return found?.value?.stringValue ?? null;
}

function summarize(path: string, contentType: string, raw: string) {
  let payload: OtlpPayload = {};
  try {
    payload = JSON.parse(raw) as OtlpPayload;
  } catch {
    // Not JSON (a protobuf body would land here): recorded without details.
  }
  const resource =
    payload.resourceSpans?.[0]?.resource ??
    payload.resourceLogs?.[0]?.resource ??
    payload.resourceMetrics?.[0]?.resource;
  const logBodies = (payload.resourceLogs ?? [])
    .flatMap((r) => r.scopeLogs ?? [])
    .flatMap((s) => s.logRecords ?? [])
    .map((record) => record.body?.stringValue)
    .filter((body): body is string => body !== undefined);
  const entry: ReceivedExport = {
    path,
    contentType,
    serviceName: serviceNameOf(resource?.attributes),
    logBodies,
  };
  return entry;
}

/** Starts the receiver on 127.0.0.1:<port>; resolves with a stop function. */
export async function startOtlpReceiver(
  port: number,
): Promise<() => Promise<void>> {
  const received: ReceivedExport[] = [];
  const server: Server = createServer((request, response) => {
    if (request.method === "GET" && request.url === RECEIVED_PATH) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(received));
      return;
    }
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push(
        summarize(
          request.url ?? "",
          request.headers["content-type"] ?? "",
          Buffer.concat(chunks).toString("utf8"),
        ),
      );
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
}
