# Acceptance record: step 2 (FND-T-06, FND-T-07, FND-T-08)

Task: FND-T-09. Acceptor: product-manager. Date: 2026-11-12.
Scope: FND-FR-05, FND-FR-11 (liveness part only), FND-NFR-06 (Supabase CLI pin).
Repository state inspected: `main`, HEAD `7889641` (step 2 verification report). Build commits: `320cf34` (T-06, `feat(db)`), `72fc765` (T-07, `feat(health)`). The tester report `verification/step-2.md` covers `72fc765`.

## Method and limits

- Evidence comes from (a) my own inspection of the files on `main`: `package.json`, `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/`, `src/app/api/health/route.ts`, the `src/` tree and `.git/logs/HEAD`; (b) the tester's report (fresh clone, commands run, T-08).
- **Limit: this acceptor session had NO shell.** I did not run any command. Commands I could not run, for the orchestrator (all cheap):
  - C1: `git status --short` (expect only the new acceptance file, plus pre-existing untracked `.vscode/` or `tasks.md` changes, which must not be staged) and `git show --stat 320cf34 72fc765` (expect only the files listed in the scope gate below).
  - C2: `git log --format=%B -12 | grep -iE "co-authored|claude|copilot|anthropic"` (expect nothing).
  - C3: with Docker running: `pnpm db:start && pnpm db:reset && pnpm db:stop`, then `curl -i http://127.0.0.1:54321/rest/v1/` while the stack is up (expect non-2xx, no table data).
  - C4: `pnpm build && pnpm start` with no `DATABASE_*` and Supabase stopped, then `curl -i localhost:3000/api/health` (expect 200 `{"status":"ok"}`); plus `pnpm lint && pnpm typecheck && pnpm format:check`.
  - The commit of this record could not be made either (see "Commit").

## Per requirement

| Requirement | Criterion | Evidence | Verdict |
|-------------|-----------|----------|---------|
| FND-FR-05 | Local Supabase runs through the Supabase CLI with Docker; `supabase/` folder, `config.toml`, migrations folder, package scripts to start, stop, reset | `supabase/` contains `config.toml`, `migrations/` (only `.gitkeep`), `seed.sql` (comment-only placeholder), `.gitignore`; `package.json` scripts `db:start`, `db:stop`, `db:reset`, `db:status` map to `supabase start/stop/db reset/status`; CLI is the devDependency `supabase` `3.1.0` (exact), no global install | Accepted |
| FND-FR-05 | Given Docker running, `pnpm db:start` then `pnpm db:reset` start the stack and apply migrations from scratch, exit 0 | Tester rows 1-2, 4: fresh volumes and from backup, two rounds, rc 0 each, `db:stop` leaves 0 supabase containers. Not re-run by me (C3) | Accepted (tester evidence; re-run C3) |
| FND-FR-05 | `config.toml` has `[api] enabled = false` (Data API off) | Confirmed by me: `supabase/config.toml` line 10-11 `[api]` / `enabled = false`. Tester row 5: `GET :54321/rest/v1/` and `/rest/v1/users` return 503, no PostgREST container, `public` has 0 tables | Accepted |
| FND-FR-05 | Auth still works locally with the Data API off | Tester row 6: `/auth/v1/health` 200, signup returns a token; `[auth] enabled = true` in config (confirmed by me); Studio answers (row 7) | Accepted |
| FND-FR-05 | Postgres major set and documented | `[db] major_version = 17` (confirmed by me, config line 46); noted in Execution notes (17 supports `WITH INHERIT FALSE, SET TRUE` for T-11) | Accepted |
| FND-FR-05 | The README documents each command | No README exists yet; owned by FND-T-41 (traceability: FR-05 -> T-06, T-41) | Deferred to T-41 (by design) |
| FND-FR-05 / spec 11 | Docker not running: `db:*` fail with a clear message | Tester row 8: with an unreachable Docker socket all four scripts exit non-zero with "failed to connect to the docker API ... check if the daemon is running" (one-line JSON). A truly stopped daemon was not tested (same client failure path) | Accepted with note (N2) |
| FND-FR-11 (liveness) | `GET /api/health` returns 200 with a known JSON body | `src/app/api/health/route.ts`: `GET()` returns `Response.json({ status: "ok" })`; tester row 11: `HTTP 200`, `application/json`, `{"status":"ok"}` | Accepted |
| FND-FR-11 (liveness) | Stays 200 with no database and no `DATABASE_*` variables | Confirmed by me: the route file has no imports (no DB module, no env module), `dynamic = "force-dynamic"`. Tester rows 12-14: Supabase stopped, no `DATABASE_*`, production build + `next start` gives 200; dev mode also 200; `POST` gives 405. Re-run C4 | Accepted (re-run C4) |
| FND-FR-11 | `/api/health/db` | Not part of step 2: moved to FND-T-12 (recorded deviation in `tasks.md` section 0, because it needs `withRls`) | Deferred to T-12 (recorded) |
| FND-NFR-06 | Supabase CLI version pinned; same commands local/CI | `supabase` `3.1.0` exact in `package.json`; lockfile resolves 3.1.0 (tester row 16); scripts are the commands CI will reuse. Playwright pin belongs to T-17 | Accepted |
| Global | lint, typecheck, format:check, build still pass | Tester row 17 in a fresh clone (all rc 0). Re-run C4 | Accepted (re-run C4) |

## Scope gate (nothing extra)

Files of the two build commits per the tester's `git diff HEAD~2 HEAD --name-only` and my tree inspection: `package.json`, `pnpm-lock.yaml`, `src/app/api/health/route.ts`, `supabase/.gitignore`, `supabase/config.toml`, `supabase/seed.sql`, `supabase/migrations/.gitkeep`. Findings:

- No tables, no roles, no Drizzle, no supabase-js, no `src/db`, no `/api/health/db`, no auth/users/tenants code, no README, no tests. `src/` holds only `app` (layout, page, `api/health`), `lib` (`env.ts`, `env.server.ts`) and `instrumentation.ts`. Nothing beyond the spec.
- `supabase/.temp/` and `supabase/.branches/` exist locally; they are CLI temp output, covered by `.gitignore` per T-01 (confirm with C1 that they are not tracked).
- `supabase/config.toml` is the CLI-generated template with the Data API disabled and Postgres 17 set; other services (Studio, analytics, edge runtime, realtime, storage) keep CLI defaults. Judged in scope (FR-05 asks only for a working local stack); the tester's optional trimming suggestion is not adopted (see decisions).
- No `Co-Authored-By` or AI mention is visible in the one-line subjects in `.git/logs/HEAD` for `320cf34`, `72fc765`, `7889641`; bodies not read (no shell), hence C2.

## Notes

- N1: `project_id = "nextjs-starter"` is shared by every checkout, so two copies of the project cannot run local stacks at once (tester O1). README (T-41).
- N2: the Docker-down message is a one-line JSON error, readable but not prose; spec section 11 asks that the message points to the README prerequisite. Satisfied once T-41 lists "Docker running" as a prerequisite; a truly stopped daemon should be seen once during later verification (T-19 or T-42).
- N3: "Skipping migration .gitkeep" prints on every start/reset until T-11 adds the first migration (then remove `.gitkeep`).
- N4: `db:status` lists rest, imgproxy and pooler as "Stopped services": expected with the Data API off; mention in the README.
- N5: `/api/health` has no automated test yet; owed by T-13/T-17 (FR-19/20). Until then its evidence is manual.

## Open points the spec says must be handled later

| Item | Owner and task |
|------|----------------|
| `/api/health/db` through `withRls` (FR-11, DoD 2); deviation from spec section 12 recorded | developer, T-12 |
| README documents each `db:*` command, Docker prerequisite and the Docker-down error, shared `project_id`, `db:status` "Stopped services", where to get the local anon key (`supabase status`) | developer, T-41 |
| Remove `supabase/migrations/.gitkeep` when the first migration lands; `app_backend` local password in `seed.sql` must match `.env.example` (`app_backend_local_password`) | developer, T-11 |
| Automated tests for `/api/health` (unit/E2E) and the hello-world check | tester, T-13 / T-17; post-deploy curl in T-24 |
| Truly stopped Docker daemon behavior seen at least once | tester, T-19 or T-42 |
| Carried from step 1 (unchanged): ADR 0004 / `docs/architecture.md` env split wording; boundary rules allowing `env.server.ts` and `NEXT_RUNTIME`; bundle assertion; secret scan | architect T-36/T-43; developer T-37; tester T-13; developer T-22 |

## Verdict

**Step 2 accepted.** FND-FR-05 and the liveness part of FND-FR-11 are met; FND-NFR-06 holds for the Supabase CLI pin. No rejected items. Two items are deferred by design (README documentation to T-41; `/api/health/db` to T-12). Acceptance was done by inspection plus the tester's evidence without a shell; the re-runs C1-C4 are cheap confirmations, not known gaps.

## Decisions for the Product Owner

- None blocking. Optional, carried from the tester (O5): disable unused local Supabase services (analytics, edge runtime, vector, realtime) to speed up startup. Recommendation: leave as is now; revisit if the README onboarding dry run (T-42) exceeds the 15-minute target.

## Commit

None made: this session has no shell, so the file is left uncommitted. Suggested commit by the orchestrator: stage only `specs/001-foundations/acceptance/step-2.md` (never `tasks.md` or `.vscode/`), scope `docs(spec)`, subject "accept step 2 of foundations", body `Task: FND-T-09`, no trailers; then verify with `git log -1 --format=%B | grep -iE "co-authored|claude|copilot"` (expect nothing).
