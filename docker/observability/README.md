# Local observability (optional)

Grafana LGTM (`grafana/otel-lgtm`) in one container, to inspect the app's
traces and logs locally. It is not needed by `pnpm dev`, tests, build or CI.
Requires Docker.

```bash
pnpm obs:start   # starts the container in the background (returns before it is ready)
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

Open <http://127.0.0.1:3001> once it is up (a few seconds after
`pnpm obs:start`; `curl http://127.0.0.1:3001/api/health` answers 200 when
ready). Log in with `admin` / `admin`; Grafana then shows an "Update your
password" screen with a **Skip** link, which is safe to use because the
container is local and discarded on `pnpm obs:stop`. In **Explore**, pick the
**Tempo** data source for traces (filter by `service.name`, e.g.
`{ resource.service.name = "nextjs-starter" }`) and **Loki** for logs (e.g.
`{service_name="nextjs-starter"}`). The log line is the event name (for
example `request.unhandled_error`); its fields, including `trace_id`, are
labels, and Loki's derived field links `trace_id` to the trace in Tempo.

All published ports (3001, 4317, 4318) are bound to `127.0.0.1`.
