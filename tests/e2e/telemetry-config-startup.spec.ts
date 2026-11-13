import { spawn } from "node:child_process";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { BASE_PORT } from "./helpers/server-log";

// PH-FR-13, PH-AC-23 (process half): an invalid OTEL_* value stops `next start`
// at startup, naming the variable. It lives in the E2E project because it
// needs the production build that the E2E webServer creates first (ADR 0008:
// the unit layer has no build). The unit half is in src/lib/env.test.ts.
//
// KNOWN PRODUCTION DEFECT (reported in PH-T-28, not fixed here): on Next 16.4.6
// a throwing `register()` makes `next start` log "Failed to prepare server" and
// keep running, answering every request with 500, instead of exiting. The exit
// test below therefore uses `test.fail()`: it documents the defect and turns
// red as soon as startup really exits, which is the signal to remove it.
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

type Outcome = { code: number | null; output: string; timedOut: boolean };

/**
 * Starts `next start` with the given OTEL_* values and resolves when the
 * process exits, when `stopWhen` matches the output (the process is then
 * stopped), or after the timeout (also stopped, `timedOut` true). The child is
 * always gone when the promise settles.
 */
function startWith(
  overrides: Record<string, string>,
  stopWhen?: string,
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
    let stopping = false;
    const stop = () => {
      if (!stopping) child.kill("SIGTERM");
      stopping = true;
    };
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      if (stopWhen !== undefined && output.includes(stopWhen)) stop();
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
      resolve({ code, output, timedOut });
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

test("PH-AC-23: next start exits non-zero at startup when OTEL_EXPORTER_OTLP_ENDPOINT is invalid", async () => {
  // See the KNOWN PRODUCTION DEFECT note at the top of this file.
  test.fail();
  test.setTimeout(STARTUP_TIMEOUT_MS + 10_000);

  const outcome = await startWith({
    OTEL_EXPORTER_OTLP_ENDPOINT: "not a url",
  });

  expect(outcome.timedOut, "process exited by itself").toBe(false);
  expect(outcome.code, "exit code is non-zero").not.toBe(0);
  expect(outcome.code, "exit code is set").not.toBeNull();
});
