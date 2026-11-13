/**
 * E2E server wrapper (PH-T-13, D14, spec section 8 "E2E harness").
 *
 * Usage: `node scripts/e2e-server.mts <port>`
 *
 * Spawns `next start` on the given port, copies the child's stdout and stderr
 * to this process (so Playwright and the CI log still show them) and to
 * `tests/.logs/server-<port>.log`, which is truncated at start and git-ignored.
 * E2E specs read that file to assert on server-side log entries. Exits with the
 * child's exit code (or 1 when it was killed by a signal it did not handle).
 *
 * The app is built beforehand by whoever calls this (`pnpm build`).
 */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const LOG_DIR = join(ROOT, "tests", ".logs");
const NEXT_BIN = join(ROOT, "node_modules", "next", "dist", "bin", "next");

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("e2e-server: usage: node scripts/e2e-server.mts <port>");
  process.exit(2);
}

mkdirSync(LOG_DIR, { recursive: true });
// Flag "w" truncates the file, so a log never mixes two server runs.
const logFile = createWriteStream(join(LOG_DIR, `server-${port}.log`), {
  flags: "w",
});

// Node runs `next` directly (not through pnpm) so a signal reaches the server.
const child = spawn(
  process.execPath,
  [NEXT_BIN, "start", "--port", String(port)],
  {
    cwd: ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

child.stdout.on("data", (chunk: Buffer) => {
  process.stdout.write(chunk);
  logFile.write(chunk);
});
child.stderr.on("data", (chunk: Buffer) => {
  process.stderr.write(chunk);
  logFile.write(chunk);
});

// Playwright stops the wrapper with SIGTERM: pass it on so no server is left.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("error", (error) => {
  console.error(`e2e-server: could not start next: ${error.message}`);
  logFile.end(() => process.exit(1));
});

child.on("close", (code) => {
  // `close` fires after the child's streams ended, so no output is lost.
  logFile.end(() => process.exit(code ?? 1));
});
