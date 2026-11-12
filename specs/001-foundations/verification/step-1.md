# Verification report: step 1 (FND-T-01 to FND-T-03)

Task: FND-T-04. Verifier: tester. Date: 2026-11-12.
Scope: FND-FR-01, FND-FR-02, FND-FR-03, FND-FR-04, FND-NFR-06 (HEAD `d05ad75`).

## Method

- Fresh `git clone` of the repository (HEAD) into a scratch folder; `pnpm install --frozen-lockfile` and every command below were run there, not in the working tree.
- System Node 24.22.2 used only for the rejection check; Node 26.13.1 (temporary copy, system Node untouched) for everything else.
- Dev/start cases were run on port 3999 with variables passed explicitly (no `.env.local`), and the server output was captured.
- Nothing was fixed; no production code was changed.

## Results by criterion

| # | Criterion (source) | Result | Evidence |
|---|--------------------|--------|----------|
| 1 | Local git repo, branch `main`, one commit per task (T-01) | PASS | `git log`: 3 commits `40c7c13` (T-01), `12ec038` (T-02), `d05ad75` (T-03), each with `Task: FND-T-0x` in the body. |
| 2 | `.env`, `.env.local`, `.env.production` ignored; `.env.example` not ignored (T-01, FR-04) | PASS | `git check-ignore -v` matches `.gitignore:11:.env*` for the three; `.env.example` returns rc 1 (not ignored) and is tracked; `git ls-files` lists no other `.env*`. |
| 3 | `.gitignore` covers node_modules, .next, .vercel, test output, Supabase temp, OS/editor files (T-01) | PASS | Read `.gitignore`. `git status --ignored` shows `.next`, `node_modules`, `next-env.d.ts`, `tsconfig.tsbuildinfo` ignored. |
| 4 | No AI mention / `Co-Authored-By` in any commit; author is the PO identity | PASS | `git log --all --format=%B` grep for claude/copilot/co-authored/anthropic returns nothing; all authors are the PO's identity. |
| 5 | No secrets committed (FR-04) | PASS (limited) | Pattern grep (JWT, `sk_live`, `sbp_`, AWS, private keys) over tracked files outside specs: no hits. `.env.example` contains only local defaults (`postgres:postgres`, `app_backend_local_password`) labelled "local only, not secrets" and the `replace-with-local-anon-key` placeholder. gitleaks is not installed, so the FR-24 scan itself is not verified here (belongs to step 5). |
| 6 | `pnpm install`, `lint`, `typecheck`, `format:check`, `build` exit 0 (T-02) | PASS | In the clone: install 0 (frozen lockfile), lint 0, typecheck 0, format:check 0, build 0 (`/` and `/_not-found` static). |
| 7 | Different Node major is reported (FR-02) | PASS | System Node 24.22.2: `pnpm install` fails with `ERR_PNPM_UNSUPPORTED_ENGINE ... wanted {"node":"26.13.1"} (current 24.22.2)`. Enforced by `engineStrict: true` in `pnpm-workspace.yaml`. |
| 8 | `packageManager`, `engines`, `.nvmrc`, lockfile committed; deps pinned exact (FR-02, NFR-06) | PASS | `packageManager: pnpm@12.18.0`, `engines.node 26.13.1`, `.nvmrc 26.13.1`, `pnpm-lock.yaml` tracked; all dependency versions in `package.json` are exact; `saveExact: true`. Zod, react-hook-form, `@hookform/resolvers`, ESLint (flat config) and Prettier are present. |
| 9 | Strict TypeScript, `src/`, `@/` alias (FR-01) | PASS | `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `paths @/* -> ./src/*`. Typecheck exits 0. |
| 10 | `pnpm dev` renders `/` (FR-01) | PASS | Clone, all variables set: `GET / -> 200` ("Next.js Starter" heading in `src/app/page.tsx`). |
| 11 | No auth/users/tenants/billing route or code (FR-01) | PASS | `find src`: only `app/layout.tsx`, `app/page.tsx`, `instrumentation.ts`, `lib/env.ts`, `lib/env.server.ts`. |
| 12 | Dev start with a required variable missing fails fast naming it (FR-03) | PASS | `DATABASE_URL` missing: `Invalid environment variables: - DATABASE_URL: Required when NODE_ENV is development`. `DATABASE_MIGRATION_URL` empty: same, naming it. `NEXT_PUBLIC_APP_URL` missing: names it. `DATABASE_URL=notaurl`: `DATABASE_URL: Invalid URL` (value not echoed). In all cases `GET /` returns no response (000); no app is served. |
| 13 | Production build succeeds without DB variables (FR-03) | PASS | Build with only the three public variables set, no `DATABASE_*`: exit 0. `next start` in that state: `GET / -> 200`, started without error. |
| 14 | `.env.example` lists every variable, no real secret (FR-03) | PASS | Lists the 3 public + `DATABASE_URL` + `DATABASE_MIGRATION_URL` (all variables the schemas read). Copying it to `.env.local` makes `pnpm build` and `pnpm dev` work. |
| 15 | No `NEXT_PUBLIC_` name matches `SERVICE|SECRET|PASSWORD|DATABASE`; no `SUPABASE_SERVICE_ROLE_KEY` | PASS (manual) | Checked by grep in `.env.example` and `src/lib/env.ts`. The automated enforcement test is T-13 (not yet present, as designed). |
| 16 | Server-only variables not in the browser bundle (FR-03) | PASS (with a probe, see point 3) | The shipped app has no client consumer, so the production `.next/static` is trivially clean. To make the check meaningful I temporarily added a client component (in the clone only, reverted): (a) importing `serverEnv` from `env.server.ts` makes `next build` fail ("importing a module that depends on server-only", trace ends at `Client Component Browser`); (b) importing only `publicEnv` builds, the public value is inlined in `.next/static`, and distinctive DB values (`SECRETPROBE`, `MIGPROBE`) and the names `DATABASE_URL`/`DATABASE_MIGRATION_URL` are absent from `.next/static`. |
| 17 | Sole reader of `process.env` is the env module (FR-03, ADR 0004) | PARTIAL | `grep` finds one other read: `process.env.NEXT_RUNTIME` in `src/instrumentation.ts` (framework runtime flag, no config value). Judged acceptable (see D2). |
| 18 | Agent-rules block in `AGENTS.md` | PASS | The working-tree `AGENTS.md` is unmodified (`pnpm dev` was run only in the clone, where Next regenerated it). |

## Judgments on the points flagged by the developer

1. **Env split (`env.ts` + `env.server.ts`) vs spec/ADR 0004: acceptable, needs a doc update.** The spec says "validated in one place (`src/lib/env.ts`)" and ADR 0004 says `env.ts` "is the only module reading `process.env`". Functionally the split is the sounder way to honour "`server-only` for the server object": a single file importing `server-only` could not export a client-safe `publicEnv`, and the probe above proves the boundary is enforced by the build. The intent of FR-03 (typed, validated, one entry point, fail fast, no leak) is met. The literal wording is not: there are two files and two `process.env` readers (plus `NEXT_RUNTIME` in instrumentation). Recommendation: the PO accepts the split and the architect amends ADR 0004 and `docs/architecture.md` (already scheduled for T-36/T-43 in the execution notes); the spec text "one place" is read as "one module family under `src/lib/env*`". No code change.
2. **Public `NEXT_PUBLIC_*` vars required at build time: the requirement is real but is not enforced at build, only at start.** Evidence: `next build` with none of the three public variables exits 0 (nothing imports the env modules at build; `instrumentation.ts` runs only at server start). The resulting build then fails at `next start` ("Failed to prepare server ... NEXT_PUBLIC_SUPABASE_URL ... NEXT_PUBLIC_APP_URL"; `GET /` returns 500). Conversely a build made with the variables set keeps working at start without them (values are inlined). Consequence for T-21/T-24: a CI or Vercel build with the variables missing would pass the build and ship a broken deployment, caught only by the smoke test. This does not violate the FR-03 criteria as written (which cover DB variables), so it is not a defect of step 1, but it is a gap in fail-fast. See PO decision Q1.
3. **No server-only variable in the client bundle: holds, by construction.** Two layers: `import "server-only"` (build error, shown by the probe) and the fact that only `NEXT_PUBLIC_` values are inlined. Caveat: with no client consumer today, the shipped bundle proves nothing by itself; the permanent assertion (test or build check required by FR-03) belongs to T-13/T-37 and should reuse the probe approach (build with canary values, grep `.next/static`). Minor note: the build error message for the `server-only` violation says "Pages Router" (Next wording), which is misleading but harmless.
4. **No real secrets, `.env*` ignored, `.env.example` placeholders only: holds** (rows 2, 5, 14). The local defaults in `.env.example` are documented Supabase/local values, not secrets; `app_backend_local_password` must be matched by T-11 (already in the execution notes).

## Defects and observations

No blocking defects. Observations, none requires a developer fix in step 1:

- **D1 (low): fail-fast for public variables is start-time, not build-time** (judgment 2). Option for a later task: import the env modules from `next.config.ts` or the root layout so the build fails too.
- **D2 (info): `src/instrumentation.ts` reads `process.env.NEXT_RUNTIME`**, a second `process.env` reader outside the env files. T-37/T-36 should state the exception, or the check should be done differently.
- **D3 (info): `engines.node` is the exact `26.13.1`**, so even another 26.x minor is rejected by pnpm (stricter than the spec's "different major"). Intentional pinning (NFR-06) but it will make a Node security update a config change. The PO may prefer `>=26.13.1 <27`.
- **D4 (info): the original repository now has a remote** `origin` (`https://github.com/hgonza81/nextjs-starter.git`) and `origin/main` at `40c7c13`; HEAD is `d05ad75` (2 commits ahead). T-01 said no remote at that time; this is consistent with the PO having added it afterwards. Nothing was pushed by this verification.
- **D5 (info): the secret scan (FR-24) cannot be checked yet** (gitleaks is not installed locally and no CI exists); only a manual pattern grep was done.
- Working tree notes (not mine): `specs/001-foundations/tasks.md` has uncommitted edits and `.vscode/` is untracked; neither was staged.

## Not verified

- CI secret scan (FR-24), automated env tests (T-13), `/api/health` (T-07), anything of steps 2 and later.
- Behavior on Vercel (no deployment exists yet).

## Verdict

Step 1 passes: all acceptance checks of FND-T-01 to FND-T-03 pass (row 17 partial for a framework-flag read, accepted). FR-01, FR-02, FR-04 covered by evidence; FR-03 covered for the criteria as written, with the automated "no server-only variable in the bundle" assertion still to come in T-13.

## For the Product Owner to decide

- Q1: Should public variables also fail the build (recommended: yes, a one-line import of the env modules in `next.config.ts` or `layout.tsx`, cost: a small developer task before T-21), or is a start-time failure plus the post-deploy smoke test enough?
- Q2: Accept the `env.ts`/`env.server.ts` split and update ADR 0004/architecture wording (recommended), or merge back into one file?
- Q3: Keep the exact Node pin `26.13.1` or relax to `>=26.13.1 <27` (recommended for the Node security-patch cadence)?
