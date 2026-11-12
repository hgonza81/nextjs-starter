# Acceptance record: step 1 (FND-T-01 to FND-T-04, FND-T-49)

Task: FND-T-05. Acceptor: product-manager. Date: 2026-11-12.
Scope: FND-FR-01, FND-FR-02, FND-FR-03, FND-FR-04, FND-NFR-06.
Repository state inspected: `main` at `1e561cf` (T-49 fix commit), commits `40c7c13` (T-01), `12ec038` (T-02), `d05ad75` (T-03), `1e561cf` (T-49); the tester report `verification/step-1.md` covers `d05ad75`.

## Method and limits

- Evidence comes from (a) the tester's report (T-04, fresh clone, commands run), (b) my own inspection of the files on `main` (`package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `.gitignore`, `.env.example`, `next.config.ts`, `src/**`, `.git/logs/HEAD`).
- Limit: the acceptor session had no shell, so I did NOT re-run commands (build, install under Node 24/26, `git status`). The T-49 behavior is accepted on code inspection plus the developer's recorded results in the Execution notes; a one-line re-run by the orchestrator is suggested (see "Residual checks").

## Per requirement

| Requirement | Criterion | Evidence | Verdict |
|-------------|-----------|----------|---------|
| FND-FR-01 | App Router app, strict TS (`strict`, `noUncheckedIndexedAccess`), `src/`, `@/` alias, home page, no user/tenant/billing features | `src/app/layout.tsx`, `src/app/page.tsx` (heading "Next.js Starter"); `src/` contains only `app`, `lib`, `instrumentation.ts` (no auth/users/tenants/billing); tester rows 9-11: typecheck 0, `GET /` 200 | Accepted |
| FND-FR-01 | Typecheck passes with zero errors | Tester row 6 (`pnpm typecheck` exit 0 in a fresh clone); T-49 reported typecheck passing | Accepted |
| FND-FR-02 | `packageManager`, `engines`/`.nvmrc`, lockfile exist and are committed | `package.json`: `packageManager pnpm@12.18.0`, `engines.node ">=26.13.1 <27"`; `.nvmrc` = `26`; `pnpm-lock.yaml` present and tracked (tester row 8) | Accepted |
| FND-FR-02 | Toolchain pinned and reproducible; ESLint + Prettier; Zod, React Hook Form + resolver installed | All dependencies exact in `package.json` (`saveExact: true` in `pnpm-workspace.yaml`); `zod`, `react-hook-form`, `@hookform/resolvers`, `eslint` (flat config `eslint.config.mjs`), `prettier` present | Accepted |
| FND-FR-02 | `pnpm lint`, `typecheck`, `format:check` exist and exit 0 on a clean tree | Scripts present; tester row 6 exit 0 for all (and build); T-49 reported all passing under Node 26.13.1 | Accepted |
| FND-FR-02 | Installing with a different Node major is reported by `engines` | `engineStrict: true` in `pnpm-workspace.yaml`; tester row 7: Node 24 gives `ERR_PNPM_UNSUPPORTED_ENGINE`. After T-49 the range is `>=26.13.1 <27`, so Node 24 stays rejected (developer evidence, not re-run by me) | Accepted with note (N1) |
| FND-FR-03 | One validated place for env, fail fast naming the variable, no secret echoed | `src/lib/env.ts` (public, Zod) and `src/lib/env.server.ts` (server-only, Zod), `formatEnvError` lists variable names only; tester row 12: missing/invalid `DATABASE_URL`, `DATABASE_MIGRATION_URL`, `NEXT_PUBLIC_APP_URL` fail naming the variable, value not echoed | Accepted with note (N2: two files instead of "one place") |
| FND-FR-03 | Public variables missing: build fails naming the variable (T-49, resolves D1) | `next.config.ts` imports `./src/lib/env`, which parses `publicEnv` at load and throws via `formatEnvError`; this runs in `next build`, `next start` and `next dev`. Developer recorded pass/fail cases in Execution notes. Closes the tester's D1 (build previously passed and `next start` returned 500) | Accepted (re-run suggested, R1) |
| FND-FR-03 | Production build without DB variables succeeds | Server schema makes DB variables optional when `NODE_ENV=production`; `next.config.ts` loads only the public module; tester row 13 exit 0 and `GET /` 200. Unchanged by T-49 (only public module added to config) | Accepted |
| FND-FR-03 | `.env.example` lists every variable, no real secret | Lists the 3 public plus `DATABASE_URL` and `DATABASE_MIGRATION_URL`, all labelled "local only, not secrets"; anon key is a placeholder; tester rows 5, 14 | Accepted |
| FND-FR-03 | Server-only variables not imported by client code / not in the bundle | `env.server.ts` starts with `import "server-only"`; only `NEXT_PUBLIC_` values are inlined; tester row 16 probe (client import of `serverEnv` fails the build, DB canary values absent from `.next/static`). No client consumer exists today, so the permanent assertion is future work (T-13/T-37) | Accepted with note (N3) |
| FND-FR-03 | No `NEXT_PUBLIC_` name matches `SERVICE|SECRET|PASSWORD|DATABASE`; no `SUPABASE_SERVICE_ROLE_KEY` | Manual check of `env.ts`, `env.server.ts`, `.env.example` (and tester row 15); automated enforcement is T-13 by design | Accepted |
| FND-FR-04 | `.gitignore` covers env files and build output; `.env*` except `.env.example` ignored | `.gitignore` lines 11-12 (`.env*`, `!.env.example`), `.next/`, `node_modules/`, `.vercel/`, test output, Supabase temp; tester rows 2-3 (`git check-ignore`) | Accepted |
| FND-FR-04 | No secrets committed; secret scan (FND-FR-24) passes | Tester row 5: manual pattern grep clean; `.env.example` holds local non-secret defaults only. The automated scan does not exist until T-22 | Accepted with note (N4: scan pending T-22) |
| FND-NFR-06 | Node, pnpm, Next.js versions pinned; same commands local/CI | Exact versions in `package.json`; `packageManager` pinned; Node pinned as a bounded range `>=26.13.1 <27` plus `.nvmrc` `26` (deliberate relaxation, PO-approved after D3). Supabase CLI and Playwright pins belong to later steps | Accepted with note (N1) |

Git hygiene checked from `.git/logs/HEAD`: 6 commits on `main`, each authored by the PO identity; the tester verified no `Co-Authored-By` or AI mention in any commit message (row 4). Commits after the verification (`c6edc94`, `04533c8`, `1e561cf`) are the verification report, the orchestrator's `AGENTS.md`/`.vscode` commit and the T-49 fix; I did not see their bodies (no shell), so the "no trailer" check for those three is a residual check (R2).

## Defects from the verification report

| ID | Tester finding | Resolution | Status |
|----|----------------|------------|--------|
| D1 | Public variables fail only at start, not at build | `next.config.ts` imports `./src/lib/env` (public module only; `env.server.ts` stays validated at start by `src/instrumentation.ts` because `server-only` throws in config context). Build now fails naming the variable. Side effect: `next dev`/`next start` also fail without the public variables at runtime | Resolved |
| D2 | `src/instrumentation.ts` reads `process.env.NEXT_RUNTIME` | Framework flag, no config value. Unchanged and accepted; the T-37 boundary rules and the architecture doc must state the exception | Accepted, carried to T-36/T-37 |
| D3 | `engines.node` exact `26.13.1` | Now `>=26.13.1 <27`, `.nvmrc` `26`, `engineStrict` still on, so Node 24 is still rejected and any 26.x at or above 26.13.1 is accepted. All dependency versions remain exact | Resolved (N1) |
| D4 | Remote `origin` exists | PO action after T-01; nothing pushed by any task | Info, no action |
| D5 | Secret scan not verifiable yet | Belongs to T-22/T-23 | Deferred, in plan |

## Notes

- N1: under Node 24 a plain `pnpm install` on an already-installed tree prints "Already up to date" and skips the engine check; `pnpm install --force` (or a fresh clone) triggers `ERR_PNPM_UNSUPPORTED_ENGINE`. The criterion ("installing with a different Node major is reported") holds for a fresh setup, which is what the spec's onboarding path uses. To document in the README (T-41): use `nvm use` first.
- N2: the spec text says env is validated "in one place (`src/lib/env.ts`)"; the implementation is a module family (`env.ts`, `env.server.ts`). The PO accepted this split.
- N3: the "no server-only variable in the client bundle" assertion is by construction today; a permanent test or build check is owned by T-13/T-37.
- N4: FND-FR-04's secret-scan criterion is formally verified only when FND-FR-24 exists (T-22/T-23).

## Scope gate (nothing extra)

Added beyond the literal task text, all judged in scope: `src/instrumentation.ts` (startup validation, serves FR-03 fail-fast, also the side effect of D1), `server-only` dependency (required by FR-03 server-only), `pnpm-workspace.yaml` settings (`engineStrict`, `saveExact`, `minimumReleaseAgeExclude`; required by FR-02/NFR-06), `AGENTS.md` Next.js agent block and shared `.vscode/` settings (orchestrator commit `04533c8`, outside the epic spec but PO/orchestrator-driven and harmless). No Tailwind/shadcn, Supabase, Drizzle, tests, auth, users, tenants or billing code exists. No empty folders.

## Open points the spec requires to be amended later

| Item | Owner and task |
|------|----------------|
| ADR 0004 and `docs/architecture.md` wording: "`env.ts` is the only module reading `process.env`" must describe the `env.ts` / `env.server.ts` split and the `NEXT_RUNTIME` read in `src/instrumentation.ts`; also record that `next.config.ts` imports the public env module so builds fail on bad public variables | architect, T-36 (conventions) and T-43 (final check) |
| T-37 boundary rules must allow `env.server.ts` and the `NEXT_RUNTIME` read in `src/instrumentation.ts` | developer, T-37 |
| Permanent assertion that server-only names never reach the client bundle (canary build and grep `.next/static`) and the `NEXT_PUBLIC_` name-pattern test; Vitest must stub `server-only` | tester, T-13 |
| CI and Vercel need the three `NEXT_PUBLIC_*` variables at build and at runtime (start also fails without them) | developer, T-21 and T-24 |
| `app_backend_local_password` in `.env.example` must match T-11's `seed.sql`; anon key placeholder documented in the README | developer, T-11 and T-41 |
| README: `nvm use` before install (N1) | developer, T-41 |

## Residual checks (for the orchestrator, cheap)

- R1: with Node 26 on PATH run `pnpm build` three times in a clone: all public variables set (expect pass), `NEXT_PUBLIC_APP_URL` unset (expect failure naming it), only DB variables unset (expect pass). Plus `pnpm lint && pnpm typecheck && pnpm format:check`.
- R2: `git log --format=%B -6 | grep -iE "co-authored|claude|copilot"` returns nothing.

## Verdict

Step 1 accepted: FR-01, FR-02, FR-04 and NFR-06 met (with notes N1, N4); FR-03 met with notes N2, N3. No rejected items. D1 and D3 resolved by T-49. Two cheap residual re-runs (R1, R2) are listed because this acceptance was done by inspection without a shell.

## Decisions for the Product Owner

None blocking. The PO already accepted the env split, the build-time failure for public variables and the Node range. Optional: confirm that the cheap re-runs R1/R2 are done by the orchestrator before starting step 2.
