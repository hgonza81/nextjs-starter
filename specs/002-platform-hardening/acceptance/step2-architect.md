# Step 2 architect check (PH-T-31)

Scope: telemetry (PH-FR-11 to 14, PH-NFR-02/03). Reviewed code, tests, ADR 0013, ADR 0004, C8/C11. Static review only (no commands run).

Verdict: no unresolved must-fix. No code defect found.

## Must-fix

None.

## Settled points

1. **NodeSDK self-configures from `OTEL_*`** (deviation from the ADR pin list): accepted and recorded in ADR 0013 "Review of step 2". Protocol and wire format cannot disagree; one direct dependency; still OTLP/HTTP and batch processors.
2. **Next.js 16.4.6 keeps the process alive when `register()` throws:** spec (2026-11-13 entry) already said so; now also stated in ADR 0013, ADR 0004 (note on the startup-validation bullet) and `docs/architecture.md` (Environment). Applies equally to the epic 001 variables.
3. **`next start` listens on all interfaces:** out of scope for telemetry (app-wide, platform-fronted). Noted in the ADR; optional `--hostname 127.0.0.1` for local dev/E2E. No change.
4. **`.env.example` endpoint:** harmonized to `127.0.0.1:4318` (matches the collector README and compose); the stale "must match the exporter packages in use" comment replaced.
5. **E2E helpers strip all `OTEL_*`** (`playwright.config.ts` `inheritedEnv`, `startWith`): correct and desirable; the telemetry servers re-add exactly what they need. Test-only variables `OTEL_BSP_SCHEDULE_DELAY` / `OTEL_BLRP_SCHEDULE_DELAY` are fine.
6. **Security:** `OTEL_EXPORTER_OTLP_HEADERS` is not declared and not read by any `src/` file; the OTel log record and stdout line share one sanitized entry. Residual: SDK diagnostic logger (`OTEL_LOG_LEVEL`) can print exporter errors; documented in the ADR.
7. **Contradictions with ADR 0013 / C8 / C11:** only textual (explicit exporters, "per-signal not supported", "fails at startup"); all corrected in the ADR. Code complies with C8 (logger sole output, `onRequestError` fields) and C11 (only `NEXT_RUNTIME` read in `instrumentation.ts`; `OTEL_*` exception documented).

## Notes (no action required now)

- **Honored-but-undeclared variables.** Once the endpoint is set, the SDK honors per-signal endpoints/protocols, `OTEL_TRACES_EXPORTER`, `OTEL_SDK_DISABLED`, etc. A per-signal `grpc` protocol bypasses our validation. Accepted for the first cut (ADR).
- **No flush on SIGTERM.** Last batch can be lost at exit. Seam: `startTelemetry()` could return the SDK or register `sdk.shutdown()`.
- **Empty `OTEL_EXPORTER_OTLP_PROTOCOL` or other blank values:** our validation treats blank as unset; the SDK is expected to do the same for blank values (not verified here; low impact).
- **Dependencies:** `@opentelemetry/sdk-node` 0.301.2 and `@opentelemetry/api` 1.10.0 exact; `@opentelemetry/sdk-trace` 3.1.1 exact devDependency (test helper only). Release-age gate (ADR 0010) was checked at install time by T-25.

## Fix-task proposals

None required. Optional, low priority (new task only if the PO wants it): `startTelemetry()` returns the `NodeSDK` and `register()` hooks `process.once("SIGTERM", () => sdk.shutdown())`, with a unit test using a mocked SDK.

## Files edited by this task

- `docs/adr/0013-observability.md` (inline wording fixes; new section "Review of step 2")
- `docs/adr/0004-env-and-secrets.md` (relaxed startup note)
- `docs/architecture.md` (Environment bullet)
- `.env.example` (endpoint host, protocol comment)
