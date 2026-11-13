import { spawn } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { BASE_PORT } from "./helpers/server-log";

// PH-FR-13, PH-AC-23 (process half): an invalid OTEL_* value fails `next start`
// at startup: the variable is named, the value is never printed and every
// request answers 500. It lives in the E2E project because it
// needs the production build that the E2E webServer creates first (ADR 0008:
// the unit layer has no build). The unit half is in src/lib/env.test.ts.
//
// On Next 16.4.6 a throwing `register()` does not exit the process: `next start`
// logs the error and keeps running, answering every request with 500 (relaxed
// PH-AC-23, spec 2026-11-13). The test therefore stops the server itself.
//
// The values below are deliberately recognisable: the tests check that the
// output never repeats them. Assertions are boolean so a failure message
// cannot print the output (and therefore the value) either.

const SPARE_PORT = BASE_PORT + 5;
const NEXT_BIN = join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const STARTUP_TIMEOUT_MS = 30_000;

type Outcome = {
  code: number | null;
  output: string;
  timedOut: boolean;
  probeStatus: number | null;
};

const PROBE_TIMEOUT_MS = 20_000;

/** Polls /api/health until the server answers (any status) and returns it. */
async function probeHealth(): Promise<number | null> {
  const deadline = Date.now() + PROBE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${SPARE_PORT}/api/health`);
      return response.status;
    } catch {
      // Not listening yet; try again.
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  return null;
}

/**
 * Starts `next start` with the given OTEL_* values and resolves when the
 * process exits, when `stopWhen` matches the output (the process is then
 * stopped), or after the timeout (also stopped, `timedOut` true). The child is
 * always gone when the promise settles.
 */
function startWith(
  overrides: Record<string, string>,
  stopWhen?: string,
  probe = false,
): Promise<Outcome> {
  const env: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(process.env)) {
    // No database and no telemetry settings inherited from the caller.
    if (name.startsWith("OTEL_") || name.startsWith("DATABASE_")) continue;
    env[name] = value;
  }
  Object.assign(env, {
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "replace-with-local-anon-key",
    NEXT_PUBLIC_APP_URL: `http://localhost:${SPARE_PORT}`,
    ...overrides,
  });

  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [NEXT_BIN, "start", "--port", String(SPARE_PORT)],
      {
        cwd: process.cwd(),
        env: env as NodeJS.ProcessEnv,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    let timedOut = false;
    let probeStatus: number | null = null;
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      // Stop by PID so the server never outlives the test.
      if (child.pid !== undefined) process.kill(child.pid, "SIGTERM");
    };
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (stopping || stopWhen === undefined || !output.includes(stopWhen)) {
        return;
      }
      if (!probe) {
        stop();
        return;
      }
      stopping = true; // hold further matches while probing
      void probeHealth().then((status) => {
        probeStatus = status;
        stopping = false;
        stop();
      });
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => {
      timedOut = true;
      stop();
    }, STARTUP_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, output, timedOut, probeStatus });
    });
  });
}

test.describe.configure({ mode: "serial" });

for (const [name, value] of [
  ["OTEL_EXPORTER_OTLP_ENDPOINT", "not a url zz-sentinel-endpoint"],
  ["OTEL_EXPORTER_OTLP_PROTOCOL", "grpc-zz-sentinel-protocol"],
  ["OTEL_SERVICE_NAME", ""],
] as const) {
  test(`PH-AC-23: startup reports a bad ${name} by name and never prints the value`, async () => {
    test.setTimeout(STARTUP_TIMEOUT_MS + 10_000);

    const outcome = await startWith({ [name]: value }, name);

    expect(outcome.timedOut, "variable was named").toBe(false);
    expect(outcome.output.includes(name), `output names ${name}`).toBe(true);
    if (value.includes("zz-sentinel")) {
      expect(outcome.output.includes("zz-sentinel"), "value not printed").toBe(
        false,
      );
    }
  });
}

test("PH-AC-23: with an invalid OTEL_EXPORTER_OTLP_ENDPOINT every request answers 500 and the value is not printed", async () => {
  test.setTimeout(STARTUP_TIMEOUT_MS + PROBE_TIMEOUT_MS + 10_000);

  const outcome = await startWith(
    { OTEL_EXPORTER_OTLP_ENDPOINT: "not a url zz-sentinel-endpoint" },
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    true,
  );

  expect(outcome.timedOut, "variable was named").toBe(false);
  expect(outcome.probeStatus, "/api/health status").toBe(500);
  expect(outcome.output.includes("zz-sentinel"), "value not printed").toBe(
    false,
  );
});
