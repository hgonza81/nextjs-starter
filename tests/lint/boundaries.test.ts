/**
 * FND-FR-12 / FND-FR-20: every boundary lint rule reports an illegal import and
 * accepts a legal one. Rules live in `eslint.config.mjs` (`boundaryRules`);
 * conventions in `docs/architecture.md`, "Lint rules".
 *
 * ESLint runs programmatically on inline source text (`lintText` with a
 * virtual `filePath`, which selects the config zone). Only rule (e) needs real
 * files; those live in `tests/lint/fixtures/`, which normal `pnpm lint`
 * ignores, so the test lints them with `ignore: false`.
 */
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { beforeAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

let eslint: ESLint;
let textEslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: root, ignore: false });
  // Virtual files do not exist on disk, which `import/no-cycle` cannot handle;
  // rule (e) is tested separately on real fixture files with the full config.
  textEslint = new ESLint({
    cwd: root,
    ignore: false,
    overrideConfig: { rules: { "import/no-cycle": "off" } },
  });
});

/** Rule ids reported for `code` as if it lived at `filePath`. */
async function lint(filePath: string, code: string): Promise<string[]> {
  const [result] = await textEslint.lintText(code, {
    filePath: root + filePath,
  });
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

async function lintFile(filePath: string): Promise<string[]> {
  const [result] = await eslint.lintFiles([root + filePath]);
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);
}

const IMPORTS = "no-restricted-imports";
const SYNTAX = "no-restricted-syntax";
const PROPS = "no-restricted-properties";
const CYCLE = "import/no-cycle";

describe("FND-FR-12 (a): modules are imported only through their public API", () => {
  it.each([
    [
      "alias, from app",
      "src/app/page.ts",
      'import { x } from "@/modules/auth/internal/service";',
    ],
    [
      "alias, from lib-free component",
      "src/components/a.ts",
      'import { x } from "@/modules/auth/queries";',
    ],
    [
      "relative path, from app",
      "src/app/page.ts",
      'import { x } from "../modules/auth/internal";',
    ],
    [
      "relative path, from tests",
      "tests/db/x.test.ts",
      'import { x } from "../../src/modules/auth/internal";',
    ],
    [
      "alias, from tests",
      "tests/db/x.test.ts",
      'import { x } from "@/modules/auth/internal";',
    ],
    [
      "alias, from another module",
      "src/modules/users/service.ts",
      'import { x } from "@/modules/auth/internal";',
    ],
    [
      "relative climb, depth 1",
      "src/modules/users/service.ts",
      'import { x } from "../auth";',
    ],
    [
      "relative climb, depth 2",
      "src/modules/users/a/service.ts",
      'import { x } from "../../auth";',
    ],
    [
      "relative climb, depth 3",
      "src/modules/users/a/b/service.ts",
      'import { x } from "../../../auth";',
    ],
    [
      "relative climb, depth 4",
      "src/modules/users/a/b/c/service.ts",
      'import { x } from "../../../../lib/utils";',
    ],
  ])("reports a deep import (%s)", async (_label, file, code) => {
    expect(await lint(file, code)).toContain(IMPORTS);
  });

  it.each([
    [
      "public API via alias",
      "src/app/page.ts",
      'import { x } from "@/modules/auth";',
    ],
    [
      "public API from tests",
      "tests/db/x.test.ts",
      'import { x } from "@/modules/auth";',
    ],
    [
      "another module's public API",
      "src/modules/users/service.ts",
      'import { x } from "@/modules/auth";',
    ],
    [
      "same-module relative import",
      "src/modules/users/service.ts",
      'import { x } from "./internal";',
    ],
    [
      "same-module relative import one level down",
      "src/modules/users/a/service.ts",
      'import { x } from "../internal";',
    ],
    [
      "shared lib through the alias",
      "src/modules/users/service.ts",
      'import { x } from "@/lib/utils";',
    ],
  ])("passes a legal import (%s)", async (_label, file, code) => {
    expect(await lint(file, code)).not.toContain(IMPORTS);
  });
});

describe("FND-FR-12 (b): src/lib is domain-free", () => {
  it.each([
    ['import { x } from "@/modules/auth";'],
    ['import { x } from "@/db";'],
    ['import { x } from "../db";'.replace("../db", "@/db/rls")],
  ])("reports a domain import: %s", async (code) => {
    expect(await lint("src/lib/helper.ts", code)).toContain(IMPORTS);
  });

  it("passes imports of other lib files and third-party packages", async () => {
    const code = 'import { x } from "./utils";\nimport { z } from "zod";';
    expect(await lint("src/lib/helper.ts", code)).not.toContain(IMPORTS);
  });
});

describe("FND-FR-12 (c): src/db is below modules; UI reaches data through modules", () => {
  it("reports src/db importing a module", async () => {
    const code = 'import { x } from "@/modules/auth";';
    expect(await lint("src/db/helper.ts", code)).toContain(IMPORTS);
  });

  it("passes src/db importing its own internals and lib", async () => {
    const code =
      'import { c } from "./client";\nimport { u } from "@/lib/utils";';
    expect(await lint("src/db/helper.ts", code)).not.toContain(IMPORTS);
  });

  it.each([
    ["app", "src/app/dashboard/page.ts"],
    ["components", "src/components/widget.ts"],
    ["hooks", "src/hooks/use-thing.ts"],
  ])("reports %s importing the @/db public API", async (_zone, file) => {
    expect(await lint(file, 'import { withRls } from "@/db";')).toContain(
      IMPORTS,
    );
  });

  it("reports app importing @/db by a relative path", async () => {
    expect(
      await lint(
        "src/app/dashboard/page.ts",
        'import { withRls } from "../../db";',
      ),
    ).toContain(IMPORTS);
  });

  it("passes app importing a module public API", async () => {
    expect(
      await lint(
        "src/app/dashboard/page.ts",
        'import { x } from "@/modules/auth";',
      ),
    ).not.toContain(IMPORTS);
  });
});

describe("FND-FR-12 (c) exception: only the readiness route may import @/db", () => {
  const route = "src/app/api/health/db/route.ts";

  it("passes the health route importing the @/db public API", async () => {
    expect(await lint(route, 'import { withRls } from "@/db";')).not.toContain(
      IMPORTS,
    );
  });

  it("still reports the health route importing @/db internals", async () => {
    expect(
      await lint(route, 'import { client } from "@/db/client";'),
    ).toContain(IMPORTS);
    expect(await lint(route, 'import { x } from "@/db/rls";')).toContain(
      IMPORTS,
    );
  });

  it("still reports the health route deep-importing a module", async () => {
    expect(
      await lint(route, 'import { x } from "@/modules/auth/internal";'),
    ).toContain(IMPORTS);
  });

  it.each([
    ["a sibling health route", "src/app/api/health/route.ts"],
    ["a route in a different folder", "src/app/api/other/route.ts"],
    ["a page", "src/app/health/page.ts"],
  ])("does not extend the exception to %s", async (_label, file) => {
    expect(await lint(file, 'import { withRls } from "@/db";')).toContain(
      IMPORTS,
    );
  });
});

describe("FND-FR-12 (d): the raw DB client is private to src/db", () => {
  it.each([
    ["@/db/client", 'import { client } from "@/db/client";'],
    ["@/db/rls", 'import { x } from "@/db/rls";'],
    ["@/db/schema", 'import { t } from "@/db/schema";'],
    ["@/db/schema/schema", 'import { t } from "@/db/schema/schema";'],
  ])("reports %s from outside src/db", async (_label, code) => {
    expect(await lint("src/lib/other.ts", code)).toContain(IMPORTS);
    expect(await lint("src/app/page.ts", code)).toContain(IMPORTS);
  });

  it("reports a relative path to the raw client from app", async () => {
    const code = 'import { client } from "../../db/client";';
    expect(await lint("src/app/x/page.ts", code)).toContain(IMPORTS);
  });

  it.each([
    ["client", 'import { client } from "../db/client";'],
    ["rls", 'import { withRls } from "../db/rls";'],
  ])("reports a relative path to the raw %s from src/lib", async (_l, code) => {
    expect(await lint("src/lib/other.ts", code)).toContain(IMPORTS);
  });

  it("reports a module importing the raw client", async () => {
    expect(
      await lint(
        "src/modules/auth/service.ts",
        'import { client } from "@/db/client";',
      ),
    ).toContain(IMPORTS);
  });

  it("passes src/db importing its own client", async () => {
    expect(
      await lint("src/db/index.ts", 'import { client } from "./client";'),
    ).not.toContain(IMPORTS);
  });

  it("passes a module using the @/db public API", async () => {
    expect(
      await lint(
        "src/modules/auth/service.ts",
        'import { withRls } from "@/db";',
      ),
    ).not.toContain(IMPORTS);
  });

  it("exempts tests/** (current behavior: they import the raw client to prove denial)", async () => {
    expect(
      await lint("tests/db/x.test.ts", 'import { client } from "@/db/client";'),
    ).not.toContain(IMPORTS);
  });
});

describe("FND-FR-12 (e): no import cycles", () => {
  it("reports two files that import each other", async () => {
    expect(await lintFile("tests/lint/fixtures/cycle/a.ts")).toContain(CYCLE);
    expect(await lintFile("tests/lint/fixtures/cycle/b.ts")).toContain(CYCLE);
  });

  it("passes a one-way import", async () => {
    expect(await lintFile("tests/lint/fixtures/acyclic/a.ts")).not.toContain(
      CYCLE,
    );
    expect(await lintFile("tests/lint/fixtures/acyclic/b.ts")).not.toContain(
      CYCLE,
    );
  });
});

describe("FND-FR-12 (f): one data path, no supabase-js .from() or .rpc()", () => {
  it.each([
    ['await supabase.from("tenants").select("*");'],
    ['await supabase.rpc("do_thing", { a: 1 });'],
    ['await client.schema("x").from("t").select();'],
  ])("reports %s", async (code) => {
    expect(await lint("src/modules/auth/service.ts", code)).toContain(SYNTAX);
  });

  it("also reports it in tests (baseline rule)", async () => {
    expect(
      await lint("tests/db/x.test.ts", 'await supabase.from("t").select();'),
    ).toContain(SYNTAX);
  });

  it.each([
    ["Array.from", "const a = Array.from(new Set([1]));"],
    ["Array.from with a string literal", 'const a = Array.from("abc");'],
    [
      "Buffer.from with a string literal",
      'const b = Buffer.from("abc", "utf8");',
    ],
    ["Drizzle .from(table)", "const r = await db.select().from(tenants);"],
  ])("passes %s (false-positive guard)", async (_label, code) => {
    expect(await lint("src/modules/auth/service.ts", code)).not.toContain(
      SYNTAX,
    );
  });
});

describe("FND-FR-12 / ADR 0003: sql.raw only in src/db/rls.ts", () => {
  const code = 'const q = sql.raw("select 1");';

  it("reports sql.raw in src files", async () => {
    expect(await lint("src/modules/auth/service.ts", code)).toContain(SYNTAX);
    expect(await lint("src/db/other.ts", code)).toContain(SYNTAX);
  });

  it("passes sql.raw in src/db/rls.ts", async () => {
    expect(await lint("src/db/rls.ts", code)).not.toContain(SYNTAX);
  });

  it("passes sql.raw in tests/** (current behavior: fixtures may use it)", async () => {
    expect(await lint("tests/db/x.test.ts", code)).not.toContain(SYNTAX);
  });

  it("passes the parameterised sql tag", async () => {
    expect(
      await lint("src/modules/auth/service.ts", "const q = sql`select ${id}`;"),
    ).not.toContain(SYNTAX);
  });
});

describe("FND-FR-12 / ADR 0004: process.env only in src/lib/env*.ts", () => {
  it.each([
    ["a module", "src/modules/auth/service.ts"],
    ["app", "src/app/page.ts"],
    ["src/db", "src/db/client.ts"],
    ["src/lib/utils.ts", "src/lib/utils.ts"],
  ])("reports process.env in %s", async (_label, file) => {
    expect(await lint(file, "const u = process.env.DATABASE_URL;")).toContain(
      PROPS,
    );
  });

  it.each([["src/lib/env.ts"], ["src/lib/env.server.ts"]])(
    "passes process.env in %s",
    async (file) => {
      expect(
        await lint(file, "const u = process.env.DATABASE_URL;"),
      ).not.toContain(PROPS);
    },
  );

  it("passes process.env in tests/** (current behavior)", async () => {
    expect(
      await lint("tests/db/x.test.ts", "const u = process.env.DATABASE_URL;"),
    ).not.toContain(PROPS);
  });

  describe("src/instrumentation.ts exception", () => {
    const file = "src/instrumentation.ts";

    it("passes reading process.env.NEXT_RUNTIME", async () => {
      const ids = await lint(
        file,
        'if (process.env.NEXT_RUNTIME === "nodejs") { init(); }',
      );
      expect(ids).not.toContain(PROPS);
      expect(ids).not.toContain(SYNTAX);
    });

    it.each([
      ["another variable", "const u = process.env.DATABASE_URL;"],
      ["a computed key", "const u = process.env[name];"],
      ["destructuring", "const { DATABASE_URL } = process.env;"],
      ["passing the whole object", "use(process.env);"],
    ])("reports %s", async (_label, code) => {
      expect(await lint(file, code)).toContain(SYNTAX);
    });

    it("does not extend the NEXT_RUNTIME allowance to other files", async () => {
      const code = 'if (process.env.NEXT_RUNTIME === "nodejs") { init(); }';
      expect(await lint("src/app/page.ts", code)).toContain(PROPS);
    });
  });
});
