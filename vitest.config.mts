import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { resolveLocalTestEnv } from "./tests/utils/local-env.mts";

const fromRoot = (path: string) =>
  fileURLToPath(new URL(path, import.meta.url));

// Shared by both projects: the `@/` alias mirrors tsconfig `paths`, and the
// `server-only` package (which throws outside Next.js) is replaced by a stub.
const alias = {
  "@": fromRoot("./src"),
  "server-only": fromRoot("./tests/utils/server-only-stub.ts"),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      // Report only, no threshold (FND-FR-19). Generated schema is excluded.
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/db/schema/**"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        // Unit layer: colocated tests, lint-rule tests and script tests, no Docker, no database.
        extends: true,
        test: {
          name: "unit",
          include: [
            "src/**/*.test.{ts,tsx}",
            "tests/lint/**/*.test.ts",
            "tests/scripts/**/*.test.ts",
          ],
          // Component tests opt into jsdom with a `// @vitest-environment jsdom`
          // docblock; everything else stays on node.
          environment: "node",
        },
      },
      {
        // DB layer: real local Supabase as `app_backend` (harness: FND-T-14).
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          // Local Supabase defaults (non-secret); real env vars win.
          env: resolveLocalTestEnv(),
          globalSetup: ["tests/utils/db-global-setup.ts"],
          // One connection per worker is shared state: run files in sequence.
          fileParallelism: false,
        },
      },
    ],
  },
});
