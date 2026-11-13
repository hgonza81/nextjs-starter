import { BASE_PORT } from "./server-log";
import { RECEIVED_PATH, type ReceivedExport } from "./otlp-receiver";

/** Server with telemetry pointed at the receiver. */
export const TELEMETRY_ON_PORT = BASE_PORT + 2;
/** Server with telemetry pointed at a closed port. */
export const TELEMETRY_CLOSED_SERVER_PORT = BASE_PORT + 3;
/** The OTLP receiver started by global setup. */
export const RECEIVER_PORT = BASE_PORT + 10;
/** Nothing listens here: the destination of the closed-port server. */
export const CLOSED_PORT = BASE_PORT + 11;

/** Service names, so each server's exports can be told apart. */
export const TELEMETRY_ON_SERVICE = "e2e-telemetry-on";
export const TELEMETRY_CLOSED_SERVICE = "e2e-telemetry-closed";
/** The app's default name, used by the main server if it exported anything. */
export const DEFAULT_SERVICE = "nextjs-starter";

/** Everything the receiver has been sent so far. */
export async function readReceived(): Promise<ReceivedExport[]> {
  const response = await fetch(
    `http://127.0.0.1:${RECEIVER_PORT}${RECEIVED_PATH}`,
  );
  return (await response.json()) as ReceivedExport[];
}
