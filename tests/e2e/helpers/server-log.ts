import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Reads the log file that scripts/e2e-server.mts writes for each test server
// (PH-FR-23 seam use, D14). Every function re-reads the file, so it works
// inside `expect.poll`:
//
//   await expect.poll(() => findLogEntries({ digest: code })).toHaveLength(1);

export type LogEntry = Record<string, unknown>;

// Playwright runs from the repository root (where playwright.config.ts is).
const LOG_DIR = join(process.cwd(), "tests", ".logs");

/** Base port of the E2E servers (same default as playwright.config.ts). */
export const BASE_PORT = Number(process.env.E2E_PORT ?? 3100);
/** The main server, flag on. */
export const MAIN_PORT = BASE_PORT;
/** The server started without DESIGN_PAGE_ENABLED. */
export const FLAG_OFF_PORT = BASE_PORT + 1;

/** Every line of the server log, as written (Next's own lines included). */
export async function readLogLines(
  port: number = MAIN_PORT,
): Promise<string[]> {
  let text: string;
  try {
    text = await readFile(join(LOG_DIR, `server-${port}.log`), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return text.split("\n").filter((line) => line.trim() !== "");
}

/** The lines that are JSON objects (the logger's entries), parsed. */
export async function readLogEntries(
  port: number = MAIN_PORT,
): Promise<LogEntry[]> {
  const entries: LogEntry[] = [];
  for (const line of await readLogLines(port)) {
    if (!line.startsWith("{")) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        entries.push(parsed as LogEntry);
      }
    } catch {
      // Not a JSON line (framework output): skipped.
    }
  }
  return entries;
}

/**
 * Entries whose fields equal every given value, e.g.
 * `{ digest: code }` or `{ event: "request.unhandled_error" }`.
 */
export async function findLogEntries(
  match: Readonly<Record<string, unknown>>,
  port: number = MAIN_PORT,
): Promise<LogEntry[]> {
  const entries = await readLogEntries(port);
  return entries.filter((entry) =>
    Object.entries(match).every(([key, value]) => entry[key] === value),
  );
}

/** Raw lines containing the text, to prove a token never reached the log. */
export async function findLogLinesContaining(
  text: string,
  port: number = MAIN_PORT,
): Promise<string[]> {
  return (await readLogLines(port)).filter((line) => line.includes(text));
}
