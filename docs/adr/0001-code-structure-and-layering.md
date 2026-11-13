# 0001. Code structure and layering

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
The app is expected to grow to roughly 50 tables with full CRUD (PO decision, epic 001 Q4). Without a fixed structure, folders become huge and responsibilities blur (FND-HR-10). The PO chose Drizzle ORM + PostgreSQL RLS (see ADR 0003), so there is now a typed data layer that must be placed somewhere. Constraints: modules `auth`, `users`, `tenants` are planned for epic 002 and each exposes a public API (AGENTS.md); tables have cross-module foreign keys (for example `memberships` -> `tenants` and users), which conflicts with "a module never imports another module's internals" if each module owns its table definitions.

## Options considered
1. **Domain modules with a public API, no repository layer** (`src/modules/<name>/`), plus a shared `src/db` area and `src/lib`. Pros: features stay cohesive, little boilerplate, RLS is already the authorization boundary. Cons: needs lint enforcement to hold.
2. **Top-level technical layers** (`services/`, `repositories/`, `models/`). Pros: familiar. Cons: every feature touches every folder, folders grow without bound, repositories duplicate what Drizzle already is.
3. **Domain modules each with internal services and repositories.** Pros: maximum separation. Cons: boilerplate for CRUD-heavy code with no payoff now; can be adopted inside one module later if a real need appears.
4. **Simplest option: conventions only, no lint.** Pros: zero setup. Cons: unenforced rules erode in a large app.

For the schema-versus-module conflict:
- (a) Per-module schema files, importing each other: creates import cycles.
- (b) Duplicated table references per module: drift.
- (c) One shared `src/db/schema` area owned by no module, imported only through `@/db`.

## Decision
Option 1, enforced by lint (option 4 rejected). Schema conflict resolved with (c).

```
src/
  app/              routing only; thin pages, route handlers, actions that call module APIs
  modules/<name>/   index.ts (public API), actions/, queries/ (Drizzle via withRls), schemas/ (Zod), components/, types.ts
  db/               client.ts (private, lazy getDb()), rls.ts, schema/ (generated), index.ts (public: withRls, withAnonymousRls, tables, types)
  lib/              env.ts (public), env.server.ts (server-only), utils; domain-free (Auth client factories arrive in epic 002)
supabase/           config.toml, migrations/, seed.sql
```

Dependency direction: `app` -> module public API (`index.ts`) -> `@/db` and `@/lib`. Rules enforced in CI:
1. A module is imported only through its `index.ts`; no deep imports into another module.
2. `lib` imports neither `modules` nor `db`. `db` imports nothing from `modules`.
3. `app` and UI components never import `@/db`; data flows through module APIs.
4. No import cycles (cycle check in lint or dependency-cruiser; the developer picks the tool, `eslint-plugin-boundaries` or `no-restricted-imports` for rules 1-3).
5. Raw DB client and `supabase-js` data calls are restricted (see ADR 0003).
A test with a deliberately illegal import fixture proves the rule reports.

Cross-module foreign keys: table definitions live in `src/db/schema/` (generated from the database, ADR 0002), not in modules. Modules import tables and inferred types from `@/db`, which is an allowed target for every module. Queries, validation, actions and components stay inside the owning module. A module needing another module's behavior (not tables) calls that module's `index.ts`.

No repository layer and no service layer. A query function inside `queries/` is the data-access unit. Add a layer inside one module only when a second use case needs shared logic.

Conventions (one line each, also in `docs/architecture.md`): kebab-case file names, named exports, `@/` alias, Server Components by default, mutations via Server Actions returning a typed result (`{ ok: true, data } | { ok: false, error }`), input validated with Zod at the boundary, structured server-side error logging without PII.

Epic 001 creates the layout, `db`, `lib` and lint rules. Module folders `auth`, `users`, `tenants` appear in epic 002.

## Amendment (FND-T-18, 2026-11-12): allowances the lint rules (FND-T-37) must implement
The rules above hold with these explicit, narrow exceptions found while implementing epic 001:
- `src/db/client.ts` exposes a memoized lazy `getDb()` (ADR 0003); it is still private to `src/db`.
- `src/lib/env.server.ts` is allowed (server code only; `src/db` imports `requireDatabaseUrl` from it). `lib` still imports neither `modules` nor `db`.
- `src/instrumentation.ts` may read `process.env.NEXT_RUNTIME` and dynamically import the env modules.
- `src/app/api/health/db/route.ts` is the single file in `app` that may import `@/db` (it calls `withAnonymousRls`; FND-FR-11). Exactly that path; T-38 tests that another `app` file importing `@/db` is reported.
- `tests/` is exempt from the raw-client restriction: DB tests import the private `@/db/client` to prove that a query without `withRls` is denied and to mock the client with a larger pool.
- `sql.raw` is restricted to `src/db/rls.ts` (ADR 0003 rule on raw SQL).
- Generated `src/db/schema/schema.ts` and `relations.ts` are excluded from lint and Prettier.

## Consequences
- Positive: features are cohesive; cross-module FKs do not cause cycles; boundary erosion fails CI.
- Negative: `src/db` is a shared dependency of all modules (acceptable; it is generated and passive). Lint config must allow `@/db` explicitly. Moving to option 3 later is possible per module without touching others.
- Revisit if a module's `queries/` grows complex enough to need services, or if a module must be extracted into a separate deployable (not expected).

## References
- AGENTS.md (structure rule), specs/001-foundations/reviews/architect.md (rounds 1-2), reviews/developer.md (round 2, shared schema proposal).

## Amendment (FND-T-36, 2026-11-13): lint tooling chosen
ADR 0001 left the tool to the developer. Chosen and implemented in FND-T-37 (`eslint.config.mjs`): ESLint 9.39.5 flat config with core `no-restricted-imports`, `no-restricted-syntax` and `no-restricted-properties` (rules a to d, f, `sql.raw`, `process.env`) and `import/no-cycle` (rule e). No dependency is added: `import/no-cycle` comes from `eslint-plugin-import@2.32.0`, already installed and registered by `eslint-config-next@16.4.6` with the TypeScript resolver, and the pinned 24-hour `minimumReleaseAge` is not involved. Rejected: `eslint-plugin-boundaries` (new dependency, fast-moving major) and `dependency-cruiser` (separate CLI outside `pnpm lint`). Known limit: the string-matching rules can be bypassed by some relative paths (listed, with a resolver-based hardening using `import/no-restricted-paths`, in `docs/architecture.md`, section "Lint rules"). That section is also the rule-by-rule mapping to conventions C1 to C12. `src/lib/supabase/` was removed from the tree above because it does not exist in epic 001; epic 002 creates the Auth client factories and records their location.
