/**
 * `pnpm gen:module <name>`: creates `src/modules/<name>/index.ts` (PH-FR-22,
 * spec D13).
 *
 * Only that one file is created: no sub-folders (they appear when they have
 * content, architecture C1), no sample feature, no test files. The name must
 * be kebab-case, which also rules out path separators and `..`. An existing
 * module is never touched, and a failed run changes nothing.
 *
 * The logic lives in `generateModule` (takes the project root, so tests can
 * run it in a temp dir); the CLI wrapper below only reads argv and exits.
 *
 * The `.mts` extension makes Node treat the file as an ES module without a
 * MODULE_TYPELESS_PACKAGE_JSON warning (the package has no `"type"`).
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MODULE_NAME_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const INDEX_CONTENT = `/**
 * Public API of this module. Other code imports the module only through this
 * file (\`@/modules/<name>\`), never its internals (ADR 0001 rule 1).
 * Export only what other modules need.
 *
 * Folders (actions, queries, schemas, components) are added when they
 * have content, not before (architecture C1).
 */
export {};
`;

export type GenerateModuleResult =
  | { readonly ok: true; readonly indexPath: string }
  | { readonly ok: false; readonly error: string };

/**
 * Creates `<rootDir>/src/modules/<name>/index.ts`.
 *
 * @param rootDir Project root (the folder that contains `src/`).
 * @param name Module name, kebab-case.
 * @returns the created file path, or a user-facing error. On error nothing is
 *   created, and an existing module is never overwritten.
 */
export function generateModule(
  rootDir: string,
  name: string,
): GenerateModuleResult {
  if (!MODULE_NAME_PATTERN.test(name)) {
    return {
      ok: false,
      error: `Invalid module name "${name}". Use kebab-case: lowercase letters and digits, starting with a letter, words separated by single hyphens (for example "billing" or "audit-log").`,
    };
  }

  const modulesDir = join(rootDir, "src", "modules");
  const moduleDir = join(modulesDir, name);
  const indexPath = join(moduleDir, "index.ts");

  mkdirSync(modulesDir, { recursive: true });
  try {
    // Not recursive: fails with EEXIST when the module folder already exists.
    mkdirSync(moduleDir);
  } catch (error) {
    if (isErrnoException(error) && error.code === "EEXIST") {
      return {
        ok: false,
        error: `Module "${name}" already exists at src/modules/${name}. Nothing was changed.`,
      };
    }
    throw error;
  }

  try {
    // `wx` is a second guard: never overwrite an existing file.
    writeFileSync(indexPath, INDEX_CONTENT, { flag: "wx" });
  } catch (error) {
    // Do not leave a half-created module behind.
    rmSync(moduleDir, { recursive: true, force: true });
    throw error;
  }
  return { ok: true, indexPath };
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function runCli(argv: readonly string[]): void {
  const [name, ...extra] = argv;
  if (name === undefined || extra.length > 0) {
    console.error("Usage: pnpm gen:module <name>   (kebab-case, one name)");
    process.exit(1);
  }
  const result = generateModule(join(import.meta.dirname, ".."), name);
  if (!result.ok) {
    console.error(`gen:module: ${result.error}`);
    process.exit(1);
  }
  console.log(`Created ${result.indexPath}`);
}

// Run only when executed directly, so tests can import `generateModule`.
if (process.argv[1] === import.meta.filename) {
  runCli(process.argv.slice(2));
}
