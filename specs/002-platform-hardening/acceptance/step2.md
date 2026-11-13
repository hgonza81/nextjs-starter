# Step 2 acceptance (PH-T-32)

Date: 2026-11-13. Reviewer: product-manager (fresh instance). Scope: PH-T-23 to PH-T-31 and fix task PH-T-64 against spec sections 7, 8, 15 (telemetry: PH-FR-11 to 14, PH-NFR-02, 03).

## Method and what was not re-verified
- Read the code, tests, the manual collector check and the architect check listed below. This instance has **no shell**, so it did not re-run any gate.
- **Orchestrator-reported (not re-verified here):** `pnpm lint`, `pnpm typecheck`, `pnpm format:check` clean; unit 413 passing; E2E 166 passed in three consecutive orchestrator runs (39 s, 42 s, 39 s) plus 13 consecutive runs by the tester. `test:db` was not rerun since step 1 (226 passing); step 2 touches no database code.
- **Manual evidence (tester, `acceptance/collector-manual.md`, 2026-11-13):** PH-AC-24, 25, 26 on a real Docker collector. Taken from that document, not re-run here.
- Evidence format: file and test title prefix (every test title starts with its PH-AC id).

## Verdict
**Step 2 accepted.** No requirement is "not met". PH-FR-13 and PH-AC-23 are met in their **relaxed** form (recorded in the spec change log, 2026-11-13). Four documented gaps (G1 to G4) need no fix task but the Product Owner should know them; G2 has an optional fix task proposal that needs a PO decision. Nothing outside spec section 3 was added (no production destination, no custom metrics, no collector dependency).

## Requirements

| Req | Status | Evidence |
|-----|--------|----------|
| PH-FR-11 off by default | Met | `src/instrumentation.ts` `register()` loads `src/instrumentation.node.ts` only in the Node runtime and only with the endpoint set. `src/instrumentation.register.test.ts` "PH-AC-20" x3 (endpoint unset: SDK module never imported; set: imported and started once; non-Node runtime: nothing loaded). E2E `tests/e2e/telemetry-export.spec.ts` "PH-AC-20: nothing is exported and the log entry goes to the console" (main server, receiver proven working first, no export from the default service, no OpenTelemetry output, hook entry on the console). |
| PH-FR-12 export | Met (metrics by wiring only) | `src/instrumentation.node.ts`: `NodeSDK` self-configures trace, log and metric OTLP exporters with batch processors and a periodic metric reader; no custom metrics. E2E "PH-AC-21, PH-AC-65" (receiver gets `/v1/traces` and `/v1/logs` with the configured service name; log body contains `request.unhandled_error`, which also proves the logger bridge, PH-T-26). E2E "PH-AC-65: the metrics pipeline starting causes no error output" (no OpenTelemetry error lines, server keeps answering). Unreachable destination: see PH-AC-22 below. |
| PH-FR-13 configuration | Met (relaxed) | `src/lib/env.server.ts` declares `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_SERVICE_NAME` (default `nextjs-starter`). `src/lib/env.test.ts` "PH-AC-23" (defaults, valid values, each bad value rejected naming the variable, endpoint value not printed). `OTEL_EXPORTER_OTLP_HEADERS` is not declared and no `src/` file reads it (architect check, point 6). Relaxation: "fails startup" means variable named, value not printed, every request 500; the process does not exit (see PH-AC-23). |
| PH-FR-14 local collector | Met (manual) | `docker/observability/compose.yaml` (`grafana/otel-lgtm:0.41.0`, UI on 3001, ports on 127.0.0.1, no volume), `docker/observability/README.md`, `obs:start` / `obs:stop` scripts. Verified manually: `acceptance/collector-manual.md` sections 1 to 6. |
| PH-NFR-02 zero cost when unused | Met | Same evidence as PH-AC-20: SDK module never imported (unit), no export and no OpenTelemetry output (E2E). |
| PH-NFR-03 never on the request path | Met | PH-AC-22 below: 20 of 20 requests 200 under 2 s against a closed port, process alive; batch processors only (`instrumentation.node.ts`). Latency is asserted only as a 2 s ceiling, as the spec states. |

## Acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| PH-AC-20 no variables: app works, logs on console | Met | Unit and E2E as in PH-FR-11. |
| PH-AC-21 receiver gets a trace | Met | E2E "PH-AC-21, PH-AC-65" (also covers logs). |
| PH-AC-22 closed port: 20 requests, 200, under 2 s, alive | Met | E2E "PH-AC-22: 20 sequential requests all return 200 in under 2 s and the process stays alive" (warm-up excluded; liveness checked by a 21st request). Unit "PH-AC-22: starting the real SDK against a closed port does not throw or reject". |
| PH-AC-23 bad variable names it, value not printed, 500 | Met (relaxed, recorded) | `tests/e2e/telemetry-config-startup.spec.ts`: "PH-AC-23: startup reports a bad ... by name and never prints the value" x3 (endpoint, protocol, empty service name; sentinel values absent from output) and "PH-AC-23: with an invalid OTEL_EXPORTER_OTLP_ENDPOINT every request answers 500 and the value is not printed" (probe on `/api/health` returns 500). Relaxation: Next.js 16.4.6 keeps the process alive when `register()` throws; `process.exit(1)` rejected as fragile on serverless (spec change log 2026-11-13; ADR 0013 and ADR 0004 notes). The 500 is asserted only for the endpoint variable; protocol and service name are asserted by name and no value leak. |
| PH-AC-24 trace and log visible in the collector UI | Met (manual) | `collector-manual.md` sections 2 and 3: Tempo shows the failing route trace, Loki shows the single log entry with the same `trace_id`, service name honoured; screenshot `acceptance/collector-manual/grafana-explore-loki.png`. Caveat: the app was run with `next start` (what `pnpm start` runs) after `pnpm build`, and the env was passed on the command line; `pnpm dev` through pnpm and `.env.local` edits were not exercised (collector-manual section 7). |
| PH-AC-25 collector not required | Met (manual plus CI by construction) | `collector-manual.md` section 5: with the collector stopped, `next dev` answered 200, `pnpm build`, unit 413 and E2E 166 passed; no workflow, Playwright or Vitest config references the collector. CI itself not re-checked here (pushes are the orchestrator's). |
| PH-AC-26 stop leaves nothing running | Met (manual) | `collector-manual.md` section 4: container and network removed, no volume, no listener on 3001, 4317, 4318. |
| PH-AC-65 receiver gets trace and log with service name; metrics not asserted | Met | E2E tests named under PH-FR-12. |
| PH-AC-72 logger sink throws, user still gets the result | Met (step 1, relevant here) | `src/lib/logger.test.ts` "PH-AC-72" x3 (throwing sink, rejecting request id source, unserializable field). Step 2 adds the OTel log bridge inside the same logger; the E2E closed-port test (PH-AC-22) shows an export failure does not affect responses. |

## Documented gaps and recorded relaxations

| # | Item | Status | Impact and recommendation |
|---|------|--------|---------------------------|
| G1 | PH-AC-23 relaxed (process not exited, requests 500) | Recorded in spec and ADRs; already accepted by the PO in the change log | None. Same behaviour as the epic 001 variables. |
| G2 | **No flush of the last telemetry batch on SIGTERM.** Batch processors can lose the last batch when the process is stopped. | Gap, known limit; not required by any PH-FR/AC | Low impact (starter, telemetry opt-in). Optional fix task proposed by the architect: `startTelemetry()` returns the SDK and `register()` hooks `process.once("SIGTERM", ...)` to `sdk.shutdown()`, with a unit test on a mocked SDK. **PO decision needed:** add the task now, or record in `backlog.md` and document the limit (recommended: document the limit in the observability README and backlog; add the task only if a real deployment needs it). |
| G3 | **SDK diagnostic logger risk.** `OTEL_LOG_LEVEL` set by an operator makes the SDK print exporter errors, which can include the destination URL. Off by default; E2E asserts no OpenTelemetry output only in the default configuration. | Documented in ADR 0013 | Low. Operator opt-in; recommend leaving as is. |
| G4 | **Per-signal and undeclared `OTEL_*` variables are not validated** (for example `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, a per-signal `grpc` protocol, `OTEL_SDK_DISABLED`). The SDK honours them once the base endpoint is set. Also blank `OTEL_EXPORTER_OTLP_PROTOCOL` is treated as unset by our validation, the SDK's handling of blanks was not verified. | Accepted for the first cut (architect check, ADR 0013); not in spec requirements | Low. Recommend leaving as is and noting it under Out of scope / Future (backlog). |
| G5 | Metrics export is not asserted anywhere; PH-AC-65 requires only that the pipeline starts. The manual check saw no app metrics in Prometheus after about 25 s (export interval not waited out). | Matches the spec (no custom metrics) | None. Nothing to fix. |
| G6 | Manual check not covered: first-time image pull and offline behaviour, `pnpm dev` through pnpm with `.env.local`. `pnpm obs:start` returns before Grafana is ready (README now says so with a health check). | Minor | None. |
| G7 | `next start` listens on all interfaces (app-wide, not telemetry). Optional `--hostname 127.0.0.1` for local use noted in the ADR. | Out of PH-FR-14 | None for this step. |
| G8 | `test:db` not rerun since step 1. | Orchestrator-reported | Step 2 touches no database code; rerun at epic end (PH-NFR-05). |

## Scope check
- No code was edited by this task. Nothing was found that the spec does not state: dependencies are `@opentelemetry/sdk-node` and `@opentelemetry/api` (exact) plus a test-only helper, the deviation from the ADR pin list (NodeSDK self-configuring) is recorded in ADR 0013 "Review of step 2".
- No production telemetry destination was added (spec section 3).

## Needs a Product Owner decision
1. **G2 (SIGTERM flush):** add an optional fix task now, or document the limit and put it in `backlog.md`. Recommendation: document and backlog.
2. Confirm that G3 and G4 (diagnostic logger, undeclared per-signal variables) stay as accepted first-cut limits. Recommendation: yes.
