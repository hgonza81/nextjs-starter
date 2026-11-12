import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

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
      exclude: ["src/**/*.test.ts", "src/db/schema/**"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        // Unit layer: colocated tests, no Docker, no database.
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
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
          // One connection per worker is shared state: run files in sequence.
          fileParallelism: false,
        },
      },
    ],
  },
});
