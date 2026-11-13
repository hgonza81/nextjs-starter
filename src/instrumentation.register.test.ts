import { createServer } from "node:net";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// The module whose import is observed: with telemetry off it must never load.
const sdkModuleLoaded = vi.hoisted(() => vi.fn());
const startTelemetry = vi.hoisted(() => vi.fn());
vi.mock("@/instrumentation.node", () => {
  sdkModuleLoaded();
  return { startTelemetry };
});

const env = vi.hoisted(() => ({
  serverEnv: {
    OTEL_EXPORTER_OTLP_ENDPOINT: undefined as string | undefined,
    OTEL_SERVICE_NAME: "nextjs-starter",
  },
}));
vi.mock("@/lib/env.server", () => env);
vi.mock("@/lib/env", () => ({ publicEnv: {} }));

/**
 * PH-FR-11, PH-NFR-02, PH-AC-20 (unit half): `register()` imports the SDK
 * module only when an endpoint is set. The real-export E2E half is PH-T-29.
 */

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
});

afterEach(() => {
  vi.unstubAllEnvs();
  env.serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT = undefined;
});

describe("register (telemetry opt-in)", () => {
  it("PH-AC-20: with the endpoint unset, the SDK module is never imported", async () => {
    const { register } = await import("@/instrumentation");

    await register();

    expect(sdkModuleLoaded).not.toHaveBeenCalled();
    expect(startTelemetry).not.toHaveBeenCalled();
  });

  it("PH-AC-20: with the endpoint set, the SDK module is imported and started once", async () => {
    env.serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
    const { register } = await import("@/instrumentation");

    await register();

    expect(sdkModuleLoaded).toHaveBeenCalledTimes(1);
    expect(startTelemetry).toHaveBeenCalledTimes(1);
  });

  it("PH-AC-20: outside the Node runtime nothing is loaded, even with the endpoint set", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    env.serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";
    const { register } = await import("@/instrumentation");

    await register();

    expect(sdkModuleLoaded).not.toHaveBeenCalled();
  });
});

async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe("startTelemetry with an unreachable destination", () => {
  it("PH-AC-22: starting the real SDK against a closed port does not throw or reject", async () => {
    vi.doUnmock("@/instrumentation.node");
    vi.stubEnv("OTEL_BSP_SCHEDULE_DELAY", "100");
    vi.stubEnv("OTEL_BLRP_SCHEDULE_DELAY", "100");
    const port = await closedPort();
    const endpoint = `http://127.0.0.1:${port}`;
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint);
    env.serverEnv.OTEL_EXPORTER_OTLP_ENDPOINT = endpoint;
    const { register } = await import("@/instrumentation");

    await expect(register()).resolves.toBeUndefined();
    // The real module ran (the fake `startTelemetry` was not used).
    expect(startTelemetry).not.toHaveBeenCalled();
  });
});
