/**
 * PH-FR-22 (PH-AC-49 to 53): `pnpm gen:module <name>` creates only
 * `src/modules/<name>/index.ts`, rejects invalid or existing names without
 * changing anything, and the result obeys the boundary lint rules.
 *
 * `generateModule` runs against a temp directory, never inside the repo. The
 * CLI derives its root from its own location (no override), so CLI tests only
 * cover the paths that exit before anything is written.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { generateModule } from "../../scripts/gen-module.mts";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const scriptPath = join(repoRoot, "scripts", "gen-module.mts");

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "gen-module-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

/** Every file and folder under `dir`, relative and sorted. */
function tree(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((p) => relative(dir, join(dir, p)))
    .sort();
}

describe("PH-AC-49, 50: a valid name creates only index.ts with the header", () => {
  it("PH-AC-49: creates exactly src/modules/orders/index.ts and nothing else", () => {
    const result = generateModule(tmp, "orders");

    expect(result).toEqual({
      ok: true,
      indexPath: join(tmp, "src", "modules", "orders", "index.ts"),
    });
    expect(tree(tmp)).toEqual([
      "src",
      join("src", "modules"),
      join("src", "modules", "orders"),
      join("src", "modules", "orders", "index.ts"),
    ]);
  });

  it("PH-AC-50: index.ts holds the header comment and an empty export", () => {
    generateModule(tmp, "orders");

    const content = readFileSync(
      join(tmp, "src", "modules", "orders", "index.ts"),
      "utf8",
    );
    expect(content).toMatch(/^\/\*\*\n \* Public API of this module\./);
    expect(content).toContain("ADR 0001 rule 1");
    expect(content.trimEnd().endsWith("export {};")).toBe(true);
  });

  it.each(["orders", "order-items", "a1", "a", "a-1", "audit-log-2"])(
    "PH-AC-49: accepts the valid name %s",
    (name) => {
      const result = generateModule(tmp, name);

      expect(result.ok).toBe(true);
      expect(existsSync(join(tmp, "src", "modules", name, "index.ts"))).toBe(
        true,
      );
    },
  );

  it("PH-AC-49: works when src/modules already holds other modules and leaves them alone", () => {
    const other = join(tmp, "src", "modules", "users");
    mkdirSync(other, { recursive: true });
    writeFileSync(join(other, "index.ts"), "export const x = 1;\n");

    generateModule(tmp, "orders");

    expect(readFileSync(join(other, "index.ts"), "utf8")).toBe(
      "export const x = 1;\n",
    );
    expect(readdirSync(join(tmp, "src", "modules")).sort()).toEqual([
      "orders",
      "users",
    ]);
  });
});

describe("PH-AC-51: an invalid name stops with a message and changes nothing", () => {
  it.each([
    ["empty", ""],
    ["whitespace only", "   "],
    ["uppercase", "Orders"],
    ["uppercase in the middle", "orDers"],
    ["parent traversal", "../x"],
    ["nested traversal", "a/../../x"],
    ["path separator", "a/b"],
    ["backslash", "a\\b"],
    ["underscore", "a_b"],
    ["leading digit", "1a"],
    ["trailing hyphen", "a-"],
    ["leading hyphen", "-a"],
    ["double hyphen", "a--b"],
    ["leading space", " a"],
    ["trailing newline", "a\n"],
    ["null byte", "a\0b"],
    ["single dot", "."],
    ["double dot", ".."],
    ["dot folder", ".git"],
    ["absolute path", "/etc/passwd"],
    ["unicode letter", "órdenes"],
    ["very long with invalid char", `${"a".repeat(300)}_`],
  ])("rejects %s", (_label, name) => {
    const result = generateModule(tmp, name);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Invalid module name/);
    expect(readdirSync(tmp)).toEqual([]);
  });

  it("accepts a very long but well-formed name (no length rule in the spec)", () => {
    // Documents current behavior: the pattern has no maximum length.
    const name = "a".repeat(100);

    expect(generateModule(tmp, name).ok).toBe(true);
  });
});

describe("PH-AC-52: an existing module is never overwritten", () => {
  it("a second call on the same name fails and leaves the first file untouched", () => {
    const first = generateModule(tmp, "orders");
    if (!first.ok) throw new Error("setup failed");
    writeFileSync(first.indexPath, "export const edited = true;\n");
    const before = tree(tmp);

    const second = generateModule(tmp, "orders");

    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already exists/);
    expect(readFileSync(first.indexPath, "utf8")).toBe(
      "export const edited = true;\n",
    );
    expect(tree(tmp)).toEqual(before);
  });

  it("an existing folder without index.ts is not touched either", () => {
    const dir = join(tmp, "src", "modules", "orders");
    mkdirSync(dir, { recursive: true });

    const result = generateModule(tmp, "orders");

    expect(result.ok).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe("PH-AC-53: boundary lint rules and TypeScript apply to a generated module", () => {
  // Virtual file: `import/no-cycle` cannot resolve files that do not exist.
  const eslint = new ESLint({
    cwd: repoRoot,
    ignore: false,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });

  async function lintAsModuleIndex(
    name: string,
    code: string,
  ): Promise<string[]> {
    const [result] = await eslint.lintText(code, {
      filePath: join(repoRoot, "src", "modules", name, "index.ts"),
    });
    return (result?.messages ?? []).map(
      (m) => m.ruleId ?? `fatal: ${m.message}`,
    );
  }

  function generatedContent(name: string): string {
    const result = generateModule(tmp, name);
    if (!result.ok) throw new Error(result.error);
    return readFileSync(result.indexPath, "utf8");
  }

  it("the generated index.ts has no lint findings", async () => {
    expect(
      await lintAsModuleIndex("order-items", generatedContent("order-items")),
    ).toEqual([]);
  });

  it.each([
    [
      "alias to another module's internals",
      'import { x } from "@/modules/auth/service";',
    ],
    ["relative path out of the module", 'import { x } from "../auth/service";'],
    ["raw db internals", 'import { x } from "@/db/client";'],
  ])("an added %s fails lint", async (_label, line) => {
    const code = `${generatedContent("orders")}\n${line}\nexport const y = x;\n`;

    expect(await lintAsModuleIndex("orders", code)).toContain(
      "no-restricted-imports",
    );
  });

  it("an added import through another module's public API passes lint", async () => {
    const code = `${generatedContent("orders")}\nimport { x } from "@/modules/auth";\nexport const y = x;\n`;

    expect(await lintAsModuleIndex("orders", code)).toEqual([]);
  });

  it("the generated index.ts is valid TypeScript under strict settings", () => {
    const result = generateModule(tmp, "orders");
    if (!result.ok) throw new Error(result.error);

    const program = ts.createProgram([result.indexPath], {
      strict: true,
      noEmit: true,
      isolatedModules: true,
      skipLibCheck: true,
      types: [],
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);

    expect(
      diagnostics.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      ),
    ).toEqual([]);
  });
});

describe("PH-AC-51: the CLI exits non-zero with a message on bad input", () => {
  // These paths exit before anything is written, so running against the repo
  // root (the CLI has no root override) is safe; each test asserts that.
  function run(...args: string[]) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: tmp,
      encoding: "utf8",
    });
  }

  function modulesSnapshot(): string[] {
    const dir = join(repoRoot, "src", "modules");
    return existsSync(dir) ? readdirSync(dir).sort() : [];
  }

  it("fails with a usage message when the name is missing", () => {
    const before = modulesSnapshot();

    const result = run();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
    expect(modulesSnapshot()).toEqual(before);
  });

  it("fails with a usage message when there are extra arguments", () => {
    const before = modulesSnapshot();

    const result = run("billing", "extra");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage:");
    expect(modulesSnapshot()).toEqual(before);
  });

  it("fails with a message naming the problem for an invalid name", () => {
    const before = modulesSnapshot();

    const result = run("Bad_Name");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid module name");
    expect(modulesSnapshot()).toEqual(before);
  });
});
