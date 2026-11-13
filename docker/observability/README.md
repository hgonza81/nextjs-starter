# Local observability (optional)

Grafana LGTM (`grafana/otel-lgtm`) in one container, to inspect the app's
traces and logs locally. It is not needed by `pnpm dev`, tests, build or CI.
Requires Docker.

```bash
pnpm obs:start   # starts the container in the background
pnpm obs:stop    # stops and removes it (data is discarded; there is no volume)
```

## Send telemetry from the app

Telemetry is off unless the endpoint is set. Add to `.env.local` and restart
`pnpm dev`:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=nextjs-starter
```

The collector accepts OTLP over HTTP on 4318 and gRPC on 4317. The app uses
HTTP, and `http/protobuf` is the SDK default, so the protocol line is
optional; the service name defaults to `nextjs-starter`.

## Open the UI

Open <http://127.0.0.1:3001> (login `admin` / `admin`; Grafana may ask to
change the password, which can be skipped). In **Explore**, pick the **Tempo**
data source for traces (filter by `service.name`) and **Loki** for logs. Log
lines carry the `trace_id` of the active span, so you can jump between them.

All published ports (3001, 4317, 4318) are bound to `127.0.0.1`.
