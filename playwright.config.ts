import { defineConfig, devices } from "@playwright/test";

// FND-FR-19: E2E runs against a production-like start (`next build` then
// `next start`), not the dev server.
//
// Two modes:
// - Default: Playwright builds and starts the app on a dedicated port.
// - E2E_BASE_URL set (e.g. https://my-app.vercel.app): no local server is
//   started and no build is made; the tests run against that URL. This is how
//   the post-deploy hello-world check reuses the same tests.
const externalBaseUrl = process.env.E2E_BASE_URL;

// Not 3000, so a running `pnpm dev` does not collide with the E2E server.
const port = Number(process.env.E2E_PORT ?? 3100);
const localBaseUrl = `http://localhost:${port}`;
// Second production server for the flag-off check (FND-FR-17): same build,
// started without DESIGN_PAGE_ENABLED.
const gateOffPort = port + 1;
const gateOffBaseUrl = `http://localhost:${gateOffPort}`;
// Telemetry servers (PH-FR-12): +2 exports to the OTLP receiver (+10), +3 to a
// closed port (+11). Same build, started without a rebuild.
const telemetryOnPort = port + 2;
const telemetryClosedPort = port + 3;
const receiverPort = port + 10;
const closedPort = port + 11;
// http/json for the plain Node receiver (the SDK default is http/protobuf);
// 100 ms batch delays so exports happen within the test window.
const telemetryEnv = (endpointPort: number, serviceName: string) => ({
  ...inheritedEnv,
  ...publicEnv,
  // The fault fixtures (a failing route, which logs) need the flag on.
  DESIGN_PAGE_ENABLED: "true",
  OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${endpointPort}`,
  OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
  OTEL_SERVICE_NAME: serviceName,
  OTEL_BSP_SCHEDULE_DELAY: "100",
  OTEL_BLRP_SCHEDULE_DELAY: "100",
});

// The deployed app has no database (ADR 0004), so the E2E server gets none:
// database variables are removed even if they are set in the caller's shell.
// Only the three public variables are provided (same values as .env.example).
// Telemetry settings are removed too, so only the servers that set them on
// purpose export anything (PH-AC-20 needs a main server with no endpoint).
const databaseVariables = ["DATABASE_URL", "DATABASE_MIGRATION_URL"];
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined &&
      !databaseVariables.includes(entry[0]) &&
      !entry[0].startsWith("OTEL_"),
  ),
);
// The flag-off server must see the flag unset, even if the caller exported it.
const envWithoutDesignFlag = Object.fromEntries(
  Object.entries(inheritedEnv).filter(
    ([name]) => name !== "DESIGN_PAGE_ENABLED",
  ),
);

const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "replace-with-local-anon-key",
  NEXT_PUBLIC_APP_URL: localBaseUrl,
};

// Specs that are meaningful against a deployed URL (E2E_BASE_URL mode).
const deployedSpecs = ["**/health.spec.ts", "**/design-gate.spec.ts"];

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // The OTLP receiver for the telemetry specs; there are no local servers (and
  // no telemetry specs) in E2E_BASE_URL mode.
  globalSetup: externalBaseUrl ? undefined : "./tests/e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    // Trace is recorded only when a failed test is retried (FND-FR-19).
    trace: "on-first-retry",
  },
  projects: externalBaseUrl
    ? [
        // Deployed URL: no local server, only the checks that are valid
        // remotely (liveness and the flag-off 404 gate).
        {
          name: "deployed",
          testMatch: deployedSpecs,
          use: { ...devices["Desktop Chrome"] },
        },
      ]
    : [
        {
          name: "chromium",
          // The flag-off gate runs in its own project, on the second server.
          testIgnore: "**/design-gate.spec.ts",
          use: { ...devices["Desktop Chrome"] },
        },
        {
          name: "design-gate-off",
          testMatch: "**/design-gate.spec.ts",
          use: { ...devices["Desktop Chrome"], baseURL: gateOffBaseUrl },
        },
      ],
  // Servers start in order: the first builds, the second reuses that build.
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          // The wrapper tees the server log to tests/.logs (D14).
          command: `pnpm build && node scripts/e2e-server.mts ${port}`,
          url: `${localBaseUrl}/api/health`,
          // A stale server on the port could serve an old build: never reuse.
          reuseExistingServer: false,
          timeout: 240_000,
          stdout: "pipe",
          env: {
            ...inheritedEnv,
            ...publicEnv,
            // FND-FR-17: this is a production build, where the flag would
            // default to off, and the /design tests need the page.
            DESIGN_PAGE_ENABLED: "true",
          },
        },
        {
          // Same production build, flag unset: the Vercel production state.
          command: `node scripts/e2e-server.mts ${gateOffPort}`,
          url: `${gateOffBaseUrl}/api/health`,
          reuseExistingServer: false,
          timeout: 60_000,
          stdout: "pipe",
          env: { ...envWithoutDesignFlag, ...publicEnv },
        },
        {
          command: `node scripts/e2e-server.mts ${telemetryOnPort}`,
          url: `http://localhost:${telemetryOnPort}/api/health`,
          reuseExistingServer: false,
          timeout: 60_000,
          stdout: "pipe",
          env: telemetryEnv(receiverPort, "e2e-telemetry-on"),
        },
        {
          command: `node scripts/e2e-server.mts ${telemetryClosedPort}`,
          url: `http://localhost:${telemetryClosedPort}/api/health`,
          reuseExistingServer: false,
          timeout: 60_000,
          stdout: "pipe",
          env: telemetryEnv(closedPort, "e2e-telemetry-closed"),
        },
      ],
});
