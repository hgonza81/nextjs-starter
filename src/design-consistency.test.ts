import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FND-FR-18: the design system consistency rule (docs/design-system.md 1.1) as
 * an automated check. It is a unit test, not an ESLint rule: it needs no
 * parser, runs with `pnpm test` in CI, and leaves eslint.config.mjs to the
 * boundary rules (FND-T-37). The patterns are deliberately coarse; a false
 * positive is fixed by using a token, or by an entry in ALLOWED below that
 * says why.
 *
 * Token colors live only in src/app/globals.css, which is not scanned.
 */
const RAW_VALUE_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  { name: "dark: utility", pattern: /\bdark:\S/ },
  { name: "hex color", pattern: /#[0-9a-fA-F]{3,8}\b/ },
  { name: "rgb()/hsl()/oklch() color", pattern: /\b(?:rgb|hsl|oklch)\(/ },
  { name: "arbitrary hex value", pattern: /\[#/ },
  { name: "arbitrary numeric value", pattern: /-\[[0-9]/ },
  {
    name: "ring-3 or ring-ring/ (shadcn default)",
    pattern: /ring-3|ring-ring\//,
  },
  { name: "opacity modifier on a role color", pattern: /\/[0-9]{2}\b/ },
  {
    name: "Tailwind palette color",
    pattern:
      /\b(?:bg|text|border|ring|outline|fill|stroke)-(?:white|black|gray|slate|zinc|neutral|stone|red|blue|green|yellow|orange|indigo|violet|sky|amber|emerald)\b/,
  },
  { name: "inline style", pattern: /style=/ },
];

/** Documented exceptions: a file and the exact text of the allowed line. */
const ALLOWED: readonly { file: string; lineIncludes: string; why: string }[] =
  [
    {
      file: "src/components/ui/sonner.tsx",
      lineIncludes: "style={toasterStyle}",
      why: "Sonner reads CSS custom properties that only an inline style can set; every value is a token variable (design system 4.9).",
    },
  ];

const SCANNED_DIRECTORIES = ["src/components", "src/app"];

export type RawValueViolation = { line: number; rule: string; text: string };

/** Returns every line of `source` that breaks the consistency rule. */
export function findRawValues(
  source: string,
  file: string,
): RawValueViolation[] {
  const violations: RawValueViolation[] = [];
  source.split("\n").forEach((text, index) => {
    for (const { name, pattern } of RAW_VALUE_PATTERNS) {
      if (!pattern.test(text)) continue;
      const isAllowed = ALLOWED.some(
        (entry) => entry.file === file && text.includes(entry.lineIncludes),
      );
      if (!isAllowed) {
        violations.push({ line: index + 1, rule: name, text: text.trim() });
      }
    }
  });
  return violations;
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !/\.test\.tsx?$/.test(entry.name),
    )
    .map((entry) => path.join(entry.parentPath, entry.name));
}

describe("findRawValues (the check itself)", () => {
  it.each([
    ['className="bg-[#123456]"', "arbitrary hex value"],
    ['const color = "#fff"', "hex color"],
    ['className="dark:bg-muted"', "dark: utility"],
    ['className="w-[327px]"', "arbitrary numeric value"],
    ['className="bg-primary/50"', "opacity modifier on a role color"],
    ['className="text-gray-600"', "Tailwind palette color"],
    ["color: rgb(0 0 0)", "rgb()/hsl()/oklch() color"],
    ['<div style={{ color: "red" }} />', "inline style"],
  ])("FND-FR-18: flags %s", (source, rule) => {
    expect(findRawValues(source, "src/components/x.tsx")).toContainEqual(
      expect.objectContaining({ rule }),
    );
  });

  it("FND-FR-18: accepts token utilities and anchors that only look like hex", () => {
    const source =
      '<a href="#components" className="bg-primary text-primary-foreground h-control w-1/2 [&_svg]:size-4">x</a>';

    expect(findRawValues(source, "src/components/x.tsx")).toEqual([]);
  });

  it("FND-FR-18: honors a documented exception only in its own file and line", () => {
    const line = "style={toasterStyle}";

    expect(findRawValues(line, "src/components/ui/sonner.tsx")).toEqual([]);
    expect(findRawValues(line, "src/components/ui/other.tsx")).not.toEqual([]);
  });
});

describe("design system consistency rule (FND-FR-18)", () => {
  const files = SCANNED_DIRECTORIES.flatMap(listSourceFiles).map((file) =>
    path.relative(process.cwd(), file),
  );

  it("scans the component and app sources", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)(
    "%s has no raw color, dark: utility or arbitrary value",
    (file) => {
      const violations = findRawValues(readFileSync(file, "utf8"), file);

      expect(violations).toEqual([]);
    },
  );
});
