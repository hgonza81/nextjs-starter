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

// The deployed app has no database (ADR 0004), so the E2E server gets none:
// database variables are removed even if they are set in the caller's shell.
// Only the three public variables are provided (same values as .env.example).
const databaseVariables = ["DATABASE_URL", "DATABASE_MIGRATION_URL"];
const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] =>
      entry[1] !== undefined && !databaseVariables.includes(entry[0]),
  ),
);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `pnpm build && pnpm exec next start --port ${port}`,
        url: `${localBaseUrl}/api/health`,
        // A stale server on the port could serve an old build: never reuse.
        reuseExistingServer: false,
        timeout: 240_000,
        stdout: "pipe",
        env: {
          ...inheritedEnv,
          NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "replace-with-local-anon-key",
          NEXT_PUBLIC_APP_URL: localBaseUrl,
        },
      },
});
