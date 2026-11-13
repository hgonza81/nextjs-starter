# Collector manual check (PH-T-30)

Date: 2026-11-13. Tester: fresh instance. Scope: PH-FR-14, PH-AC-24, PH-AC-25, PH-AC-26 (manual criteria). Environment: macOS, Docker 29.9.2, Node 26.13.1, Next 16.4.6, image `grafana/otel-lgtm:0.41.0` (Grafana 13.3.0). Nothing was left running.

## Verdict

| Criterion | Result | Evidence |
|-----------|--------|----------|
| PH-AC-24 trace and log visible in the collector UI | PASS | Sections 1 to 3 |
| PH-AC-25 ports on 127.0.0.1; collector not required by dev, tests, build, CI | PASS | Sections 1 and 5 |
| PH-AC-26 `pnpm obs:stop` leaves nothing running | PASS | Section 4 |

## 1. Start and port binding
- `pnpm obs:start` returned in 0.5 s (image already present; the container starts in the background). `GET http://127.0.0.1:3001/api/health` answered 200 within about 9 s (3 polls of 3 s), so Grafana was up quickly; a first-time image pull is not covered.
- `docker port nextjs-starter-observability-lgtm-1`: `3000/tcp -> 127.0.0.1:3001`, `4317/tcp -> 127.0.0.1:4317`, `4318/tcp -> 127.0.0.1:4318`.
- `lsof -nP -iTCP:3001 -iTCP:4317 -iTCP:4318 -sTCP:LISTEN`: all three listeners on `127.0.0.1` only.
- From the machine's own LAN address (`10.0.0.61`), `curl` to ports 3001 and 4318 failed to connect (HTTP code 000).
- `POST http://127.0.0.1:4318/v1/traces` with `{}` answered 200 (OTLP HTTP receiver ready).

## 2. App to collector
- `pnpm build`, then `node node_modules/next/dist/bin/next start --port 3217` (what `next start` runs, started in the background and stopped by PID) with `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 OTEL_SERVICE_NAME=ph-t30-manual DESIGN_PAGE_ENABLED=true`. `OTEL_EXPORTER_OTLP_PROTOCOL` was deliberately not set, which also proves the README claim that `http/protobuf` is the default.
- Requests: `/api/health` x4 (200), `/design/errors/route-throw?token=manual30` (500, the failing request), `/login` (404, only a probe).
- Server stdout showed the failure as one JSON line: event `request.unhandled_error`, level `error`, `trace_id` `8f5afb3d0170bf9196629db4de67a1b2`, `span_id` `36f02c4fa4b24be9`.

## 3. Evidence in Grafana (HTTP API with `admin:admin`, plus Playwright screenshots)
- Tempo (`/api/datasources/proxy/uid/tempo/api/search`, TraceQL `{ resource.service.name = "ph-t30-manual" }`): 19 traces, including root spans `GET /api/health` and `GET /design/errors/route-throw`. The tag values list for `service.name` was exactly `["ph-t30-manual"]`, so the configured service name is honoured.
- Trace `8f5afb3d...` fetched by id: spans `load route module`, `resolve page components`, `prepare route module`, `load app route module`, `executing api route (app) /design/errors/route-throw` (status ERROR, message "Injected route handler fault (token: manual30)") and `GET /design/errors/route-throw` (status ERROR). The id equals the `trace_id` in the server log line.
- Loki (`query_range`, `{service_name="ph-t30-manual"}`): exactly one entry, body `request.unhandled_error`, `detected_level=error`, labels `trace_id=8f5afb3d...`, `span_id`, `routePath=/design/errors/route-throw`, `method=GET`, `error_name=Error`, `scope_name=nextjs-starter`. No error message, stack or token in the entry. Loki's data source has a derived field that links `trace_id` to Tempo.
- Screenshots: `acceptance/collector-manual/grafana-explore-loki.png` (Explore with the Loki entry) and `acceptance/collector-manual/grafana-password-prompt.png`.

## 4. Stop (PH-AC-26)
- Before stopping, only the app was stopped (`kill <pid>`; no listener on 3217 afterwards).
- `pnpm obs:stop`: container and network `nextjs-starter-observability_default` stopped and removed.
- Afterwards `docker ps -a --filter name=nextjs-starter-observability` listed nothing, no matching network or volume (`docker volume ls` filtered by "observ" and "lgtm"), and no listener on 3001, 4317 or 4318. Other containers on this machine (Supabase, unrelated projects) were not touched.

## 5. Not dependent on the collector (PH-AC-25)
With the collector stopped (section 4), in this order: `node node_modules/next/dist/bin/next dev --port 3218` answered `/api/health` 200 (stopped by PID, port freed); `pnpm build` passed; `pnpm test` 24 files, 413 tests passed; `pnpm test:e2e` 166 passed (including the closed-port destination test).
- `grep` for `docker`, `compose`, `observability`, `obs:` in `.github/workflows/*.yml`, `playwright.config.ts` and the Vitest config: no reference to the collector (the CI hits are the generic "Docker" job comments for local Supabase). `playwright.config.ts` sets `OTEL_*` variables only to point at the test's own in-process receiver on `E2E_PORT + 10`. The only references to the collector in the repo outside specs and docs are the two `obs:*` scripts in `package.json`, `docker/observability/**` and the commented `OTEL_*` lines in `.env.example`. CI therefore cannot depend on it.
- I did not run `pnpm dev` through pnpm itself (the script is `next dev`; the same binary was run directly).

## 6. README claims
- `admin` / `admin` login works: confirmed (API and UI).
- "Grafana may ask to change the password, which can be skipped": confirmed and sharpened. After login Grafana 13.3.0 always shows "Update your password" with a **Skip** link (screenshot above). The README now says so.
- Protocol line optional (`http/protobuf` default): confirmed (see section 2).
- Service name default `nextjs-starter`: confirmed in `src/lib/env.server.ts`; the observed `scope_name` is `nextjs-starter`.
- "Log lines carry the `trace_id`": confirmed, but the log line text is the event name and `trace_id` is a label, so the README now explains that, and gives example Tempo and Loki queries. It also now says `pnpm obs:start` returns before Grafana is ready, with a health check to poll.

## 7. Not verified
- Metrics in Prometheus: after about 25 s only collector-internal metrics (`promhttp_metric_handler_errors_total`) were present, none from the app; the metric export interval was not waited out. Spec only requires "pipeline starts without error" (covered by PH-T-29). Not a PH-AC-24 item.
- First-time image pull duration and behaviour offline.
- `pnpm dev` with `.env.local` edits and an app restart as the README describes (the env was passed on the command line instead).
- The app itself listens on all interfaces (`next start` prints a Network URL); this is outside PH-FR-14 and unchanged.
