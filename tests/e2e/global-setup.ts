import { startOtlpReceiver } from "./helpers/otlp-receiver";
import { RECEIVER_PORT } from "./helpers/telemetry";

// Starts the OTLP receiver for the telemetry E2E tests (spec 8 "E2E harness").
// Not started in E2E_BASE_URL mode: no local servers exist there.
export default async function globalSetup(): Promise<() => Promise<void>> {
  return startOtlpReceiver(RECEIVER_PORT);
}
