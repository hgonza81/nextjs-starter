import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  parseTokenValues,
  type TokenValues,
} from "@/app/design/_lib/css-tokens";

/** Path of the one token file, relative to the project root. */
export const TOKEN_FILE = "src/app/globals.css";

/**
 * Loads the token values for `/design`. Reads the source file at request time
 * (the route is dynamic and only exists where the flag is on, never in the
 * Vercel production build), so an edited token shows up on reload.
 */
export async function readTokenValues(): Promise<Map<string, TokenValues>> {
  const css = await readFile(path.join(process.cwd(), TOKEN_FILE), "utf8");
  return parseTokenValues(css);
}
