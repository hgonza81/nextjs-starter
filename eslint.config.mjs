import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/*
 * Structure and data-access boundaries (FND-FR-12; docs/architecture.md,
 * "Lint rules"; ADR 0001, 0003, 0004).
 *
 * Flat config replaces (does not merge) the options of a rule when a later
 * block sets the same rule for the same file. So each zone below lists the
 * COMPLETE pattern set that applies to it, built from the named groups, and
 * zones are ordered from general to specific.
 */
const SOURCE_FILES = ["src/**/*.{ts,tsx,mts}"];

const restrict = (...groups) => ({
  "no-restricted-imports": ["error", { patterns: groups.flat() }],
});

const MODULE_INTERNALS_MESSAGE =
  "Import a module only through its public API: `@/modules/<name>` (ADR 0001 rule 1).";

// (a) Other code imports a module only through its index.ts.
const moduleInternalsViaAlias = [
  { group: ["@/modules/*/**"], message: MODULE_INTERNALS_MESSAGE },
];
const moduleInternalsViaRelativePath = [
  { group: ["**/modules/*/**"], message: MODULE_INTERNALS_MESSAGE },
];

// (a) Inside src/modules/<name>/..., a relative import may stay in the same
// module but must not climb out of it (use `@/modules/<other>` instead). The
// number of `../` that leaves the module depends on the file depth, hence one
// pattern per depth.
const climbsOutOfModule = (depth) => [
  {
    group: [`${"../".repeat(depth)}**`],
    message:
      "Do not reach into another module with a relative path; import `@/modules/<name>` (ADR 0001 rule 1).",
  },
];

// (d) The raw DB client (and schema/rls internals) is private to src/db.
const dbInternals = [
  {
    group: [
      "@/db/**",
      "**/db/client",
      "**/db/rls",
      "**/db/schema",
      "**/db/schema/**",
    ],
    message:
      "Only `src/db` may import its internals; use the `@/db` public API (ADR 0003, C9).",
  },
];

// (b) src/lib is domain-free: no modules, no data layer.
const libForbidden = [
  {
    group: ["@/modules", "@/modules/**", "**/modules/**", "@/db", "@/db/**"],
    message:
      "`src/lib` must not depend on modules or `@/db` (ADR 0001 rule 2).",
  },
];

// (c) src/db is below modules.
const dbForbidden = [
  {
    group: ["@/modules", "@/modules/**", "**/modules/**"],
    message: "`src/db` must not import modules (ADR 0001 rule 2).",
  },
];

// (c) Routing and UI code reach data through module APIs, never `@/db`.
const dbFromUi = [
  {
    group: ["@/db", "../**/db"],
    message:
      "`app`, components and hooks must not import `@/db`; call a module API (ADR 0001 rule 3).",
  },
];

// (f) One data path: Drizzle only. supabase-js `.from("table")` and `.rpc()`
// are banned; Drizzle's `.from(table)` takes an identifier so it is not hit.
const noSupabaseDataCalls = [
  {
    selector: "CallExpression[callee.property.name='rpc']",
    message:
      "Data goes through Drizzle and `withRls`, not `.rpc()` (ADR 0003, C10).",
  },
  {
    selector:
      "CallExpression[callee.property.name='from'][arguments.0.type='Literal']:not([callee.object.name=/^(Array|Buffer)$/])",
    message:
      'Data goes through Drizzle and `withRls`, not supabase-js `.from("table")` (ADR 0003, C10).',
  },
];

// ADR 0003: `sql.raw` bypasses parameterisation; only src/db/rls.ts may use it.
const noSqlRaw = [
  {
    selector:
      "CallExpression[callee.object.name='sql'][callee.property.name='raw']",
    message: "`sql.raw` is allowed only in `src/db/rls.ts` (ADR 0003, C9).",
  },
];

// ADR 0004: env is read only by src/lib/env.ts and env.server.ts. The one
// extra allowance (the NEXT_RUNTIME read in instrumentation.ts) cannot be
// expressed with no-restricted-properties, so that file uses selectors that
// ban every other `process.env` access.
const noProcessEnv = {
  "no-restricted-properties": [
    "error",
    {
      object: "process",
      property: "env",
      message:
        "Read configuration through `@/lib/env` or `@/lib/env.server` (ADR 0004, C11).",
    },
  ],
};
const onlyNextRuntimeFromProcessEnv = [
  {
    selector:
      "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name='NEXT_RUNTIME'])",
    message:
      "Only `process.env.NEXT_RUNTIME` may be read here; use `@/lib/env.server` for everything else (ADR 0004).",
  },
  {
    selector:
      "MemberExpression[object.name='process'][property.name='env']:not(MemberExpression > .object)",
    message:
      "Only a direct `process.env.NEXT_RUNTIME` read is allowed here (ADR 0004).",
  },
];

const restrictSyntax = (...groups) => ({
  "no-restricted-syntax": ["error", ...groups.flat()],
});

const boundaryRules = [
  // Baseline for every linted file, tests and tooling included: (a), (f).
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    rules: {
      ...restrict(moduleInternalsViaAlias, moduleInternalsViaRelativePath),
      ...restrictSyntax(noSupabaseDataCalls),
    },
  },
  // src only (tests/** may import the raw client to prove denial, use `sql.raw`
  // for fixtures and read process.env): (d), `sql.raw`, process.env.
  {
    files: SOURCE_FILES,
    rules: {
      ...restrict(
        moduleInternalsViaAlias,
        moduleInternalsViaRelativePath,
        dbInternals,
      ),
      ...noProcessEnv,
      ...restrictSyntax(noSupabaseDataCalls, noSqlRaw),
    },
  },
  // (b)
  {
    files: ["src/lib/**"],
    rules: restrict(
      moduleInternalsViaAlias,
      moduleInternalsViaRelativePath,
      libForbidden,
    ),
  },
  // (c) src/db below modules; it may import its own internals.
  {
    files: ["src/db/**"],
    rules: restrict(
      moduleInternalsViaAlias,
      moduleInternalsViaRelativePath,
      dbForbidden,
    ),
  },
  // (c) app and UI code must not import @/db ...
  {
    files: ["src/app/**", "src/components/**", "src/hooks/**"],
    rules: restrict(
      moduleInternalsViaAlias,
      moduleInternalsViaRelativePath,
      dbInternals,
      dbFromUi,
    ),
  },
  // ... except the one documented exception (FND-FR-11 readiness route).
  {
    files: ["src/app/api/health/db/route.ts"],
    rules: restrict(
      moduleInternalsViaAlias,
      moduleInternalsViaRelativePath,
      dbInternals,
    ),
  },
  // (a) modules: relative imports must not leave the module (depths 1 to 4).
  ...[1, 2, 3, 4].map((depth) => ({
    files: [`src/modules/${"*/".repeat(depth)}*.{ts,tsx}`],
    rules: restrict(
      moduleInternalsViaAlias,
      dbInternals,
      climbsOutOfModule(depth),
    ),
  })),
  // Allowed `sql.raw` site.
  {
    files: ["src/db/rls.ts"],
    rules: restrictSyntax(noSupabaseDataCalls),
  },
  // Only the NEXT_RUNTIME read is allowed in instrumentation.ts.
  {
    files: ["src/instrumentation.ts"],
    rules: {
      "no-restricted-properties": "off",
      ...restrictSyntax(
        noSupabaseDataCalls,
        noSqlRaw,
        onlyNextRuntimeFromProcessEnv,
      ),
    },
  },
  // The only files allowed to read process.env.
  {
    files: ["src/lib/env.ts", "src/lib/env.server.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  // (e) No import cycles. The TypeScript resolver (so `@/` resolves) is
  // already configured by eslint-config-next.
  {
    files: ["**/*.{ts,tsx,mts,js,mjs}"],
    rules: { "import/no-cycle": "error" },
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  ...boundaryRules,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "pnpm-lock.yaml",
    // Deliberately illegal sample files for the boundary rule tests (FND-T-38);
    // the tests lint them with `ignore: false`.
    "tests/lint/fixtures/**",
    // Generated by `pnpm db:schema` (ADR 0002).
    "src/db/schema/schema.ts",
    "src/db/schema/relations.ts",
  ]),
]);
