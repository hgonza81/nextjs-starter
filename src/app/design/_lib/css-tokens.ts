/**
 * Reads the design tokens from `src/app/globals.css`, the single token file
 * (design system 1.1). `/design` shows the values from here instead of
 * repeating them, so the page cannot drift from the file and no color literal
 * ever appears in page code.
 */

export type Theme = "light" | "dark";

export type TokenValues = { readonly light: string; readonly dark: string };

const DECLARATION_START = /^[ \t]*(--[\w-]+):[ \t]*/gm;
const LIGHT_DARK_PREFIX = "light-dark(";
const VAR_REFERENCE = /^var\((--[\w-]+)\)/;

/** Splits `a, b` at the single top-level comma (commas inside `()` are kept). */
function splitTopLevelPair(inner: string): readonly [string, string] | null {
  let depth = 0;
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      return [inner.slice(0, index).trim(), inner.slice(index + 1).trim()];
    }
  }
  return null;
}

/** Returns the text between the parentheses opened right before `start`. */
function readBalanced(source: string, start: number): string | null {
  let depth = 1;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "(") depth += 1;
    else if (source[index] === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index);
    }
  }
  return null;
}

/**
 * Returns every token declared with `light-dark(light, dark)`, plus tokens
 * that alias another one with `var(--other)` (for example `--ring`), resolved
 * to the aliased token's values. Shadows and other non-color declarations are
 * ignored.
 */
export function parseTokenValues(css: string): Map<string, TokenValues> {
  const tokens = new Map<string, TokenValues>();
  const aliases = new Map<string, string>();

  for (const match of css.matchAll(DECLARATION_START)) {
    const name = match[1];
    if (name === undefined) continue;
    const valueStart = match.index + match[0].length;
    const rest = css.slice(valueStart);

    if (rest.startsWith(LIGHT_DARK_PREFIX)) {
      const inner = readBalanced(css, valueStart + LIGHT_DARK_PREFIX.length);
      const pair = inner === null ? null : splitTopLevelPair(inner);
      if (pair !== null) {
        tokens.set(name, { light: pair[0], dark: pair[1] });
      }
      continue;
    }

    const alias = VAR_REFERENCE.exec(rest)?.[1];
    if (alias !== undefined) {
      aliases.set(name, alias);
    }
  }

  for (const [name, target] of aliases) {
    const values = tokens.get(target);
    if (values !== undefined) {
      tokens.set(name, values);
    }
  }
  return tokens;
}
