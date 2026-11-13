import { randomUUID } from "node:crypto";

import { expect, test } from "./helpers/fixtures";
import { MAIN_PORT, findLogEntries, readLogLines } from "./helpers/server-log";
import {
  DEFAULT_SERVICE,
  TELEMETRY_CLOSED_SERVER_PORT,
  TELEMETRY_ON_PORT,
  TELEMETRY_ON_SERVICE,
  readReceived,
} from "./helpers/telemetry";

// PH-FR-11, PH-FR-12, PH-NFR-02, PH-NFR-03: telemetry export seen from outside.
// Servers: main (no endpoint), +2 (endpoint = the receiver started by global
// setup, http/json, 100 ms batch delays), +3 (endpoint = a closed port). The
// receiver is a plain Node server; the Docker collector is not involved.

const HOOK_EVENT = "request.unhandled_error";
const ON_URL = `http://localhost:${TELEMETRY_ON_PORT}`;
const CLOSED_URL = `http://localhost:${TELEMETRY_CLOSED_SERVER_PORT}`;
const MAIN_URL = `http://localhost:${MAIN_PORT}`;

function failingRoute(): string {
  return `/design/errors/route-throw?token=t-${randomUUID()}`;
}

test.describe("with a receiver", () => {
  test("PH-AC-21, PH-AC-65: the receiver gets trace and log requests carrying the configured service name", async ({
    request,
  }) => {
    // A normal request makes a trace; the failing route makes the hook log.
    expect((await request.get(`${ON_URL}/api/health`)).status()).toBe(200);
    expect((await request.get(`${ON_URL}${failingRoute()}`)).status()).toBe(
      500,
    );

    await expect
      .poll(async () =>
        (await readReceived()).filter(
          (r) => r.serviceName === TELEMETRY_ON_SERVICE,
        ),
      )
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "/v1/traces" }),
          expect.objectContaining({
            path: "/v1/logs",
            logBodies: expect.arrayContaining([HOOK_EVENT]),
          }),
        ]),
      );
  });

  test("PH-AC-65: the metrics pipeline starting causes no error output and the server keeps answering", async ({
    request,
  }) => {
    // Metrics are not asserted (no custom metrics): only that startup and a
    // request leave no OpenTelemetry error in the server output.
    const response = await request.get(`${ON_URL}/api/health`);

    expect(response.status()).toBe(200);
    const lines = await readLogLines(TELEMETRY_ON_PORT);
    const noisy = lines.filter((line) => /opentelemetry|OTLP/i.test(line));
    expect(noisy.length, "OpenTelemetry error lines").toBe(0);
  });
});

test.describe("without an endpoint", () => {
  test("PH-AC-20: nothing is exported and the log entry goes to the console", async ({
    request,
  }) => {
    // First prove the receiver path works for the telemetry-on server, so the
    // "nothing arrived" check below cannot pass because export was too slow.
    await request.get(`${ON_URL}/api/health`);
    await expect
      .poll(async () => (await readReceived()).length)
      .toBeGreaterThan(0);

    expect((await request.get(`${MAIN_URL}${failingRoute()}`)).status()).toBe(
      500,
    );

    await expect
      .poll(
        async () =>
          (await findLogEntries({ event: HOOK_EVENT }, MAIN_PORT)).length,
      )
      .toBeGreaterThan(0);
    const received = await readReceived();
    expect(
      received.filter((r) => r.serviceName === DEFAULT_SERVICE),
      "exports from the main server",
    ).toEqual([]);
    const lines = await readLogLines(MAIN_PORT);
    expect(
      lines.filter((line) => /opentelemetry|OTLP/i.test(line)).length,
      "OpenTelemetry output on the main server",
    ).toBe(0);
  });
});

test.describe("with a closed destination", () => {
  test("PH-AC-22: 20 sequential requests all return 200 in under 2 s and the process stays alive", async ({
    request,
  }) => {
    test.setTimeout(60_000);
    // One warm-up request is excluded (first-request compilation and SDK work).
    await request.get(`${CLOSED_URL}/api/health`);

    const outcomes: { status: number; ms: number }[] = [];
    for (let i = 0; i < 20; i += 1) {
      const started = performance.now();
      const response = await request.get(`${CLOSED_URL}/api/health`);
      outcomes.push({
        status: response.status(),
        ms: performance.now() - started,
      });
    }

    expect(outcomes.map((o) => o.status)).toEqual(Array(20).fill(200));
    expect(Math.max(...outcomes.map((o) => o.ms))).toBeLessThan(2000);
    // Still alive after all of them.
    expect((await request.get(`${CLOSED_URL}/api/health`)).status()).toBe(200);
  });
});
