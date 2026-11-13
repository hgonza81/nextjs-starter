/**
 * PH-AC-19 / PH-FR-10: `console.*` is an error in application code; the logger
 * file is the only exemption. Same technique as `boundaries.test.ts`: ESLint
 * `lintText` with a virtual `filePath` that selects the config zone.
 */
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: root, ignore: false });
});

async function ruleIds(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: root + filePath });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

describe("PH-AC-19: no-console", () => {
  it.each([
    ["src/app/page.ts", "console.log('x');\n"],
    ["src/modules/auth/index.ts", "console.error('x');\n"],
    ["src/lib/utils.ts", "console.warn('x');\n"],
    ["src/components/a.tsx", "export const a = () => console.info('x');\n"],
    ["src/proxy.mts", "console.debug('x');\n"],
  ])("PH-AC-19: reports console.* in %s", async (filePath, code) => {
    expect(await ruleIds(filePath, code)).toContain("no-console");
  });

  it("PH-AC-19: exempts src/lib/logger.ts", async () => {
    expect(
      await ruleIds("src/lib/logger.ts", "console.log('x');\n"),
    ).not.toContain("no-console");
  });

  it("PH-AC-19: accepts code that does not use console", async () => {
    expect(
      await ruleIds("src/lib/utils.ts", "export const a = 1;\n"),
    ).not.toContain("no-console");
  });
});
