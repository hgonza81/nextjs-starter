# Verification report: step 2 (FND-T-06, FND-T-07)

Task: FND-T-08. Verifier: tester. Date: 2026-11-12.
Scope: FND-FR-05, FND-FR-11 (liveness part), FND-NFR-06 (HEAD `72fc765`).

## Method

- Fresh `git clone` of HEAD into a scratch folder; `pnpm install --frozen-lockfile` and every command below ran there. System Node 26.13.1, pnpm 12.18.0, Supabase CLI via `pnpm exec`/package scripts (3.1.0).
- No Supabase stack was running at the start (only an unrelated `agent-template-postgres-1` container, left untouched). The clone has the same `project_id` (`nextjs-starter`) as the main copy, so containers and volumes are shared by name; the first run used `supabase stop --no-backup` to guarantee a clean start.
- "Docker unreachable" was simulated with `DOCKER_HOST=unix:///nonexistent.sock` (the daemon stayed up).
- Nothing was fixed; no production code was changed. All stacks and servers were stopped at the end.

## Results by criterion

| # | Criterion (source) | Result | Evidence |
|---|--------------------|--------|----------|
| 1 | `pnpm db:start` from scratch exits 0 (T-06, FR-05) | PASS | After `stop --no-backup`: rc 0, "Starting database...", "Initialising schema...", all 11 containers up (db, auth, kong, studio, storage, realtime, ...). |
| 2 | `pnpm db:reset` exits 0, migrations apply from scratch, twice (T-06, FR-05) | PASS | Round 1 (fresh volumes) and round 2 (start from backup): each start rc 0, reset rc 0 ("Finished supabase db reset on branch main"), `db:stop` rc 0 with 0 supabase containers left. Only message: "Skipping migration .gitkeep" (harmless, no real migration yet). |
| 3 | `pnpm db:status` works (T-06) | PASS | rc 0, prints DB_URL, API_URL, STUDIO_URL, keys. It lists "Stopped services: rest, imgproxy, pooler" (expected, not enabled). |
| 4 | `db:stop` leaves nothing running (T-06) | PASS | `docker ps` shows 0 supabase containers after stop. |
| 5 | `[api] enabled = false` in `config.toml`, Data API serves nothing (FR-05, ADR 0003) | PASS | Config has `[api] enabled = false`. `GET :54321/rest/v1/` returns 503 `{"message":"name resolution failed"}` (Kong, no PostgREST container); `GET /rest/v1/users?select=*` returns 503. `public` has 0 tables. |
| 6 | Auth still works with the Data API disabled (FR-05) | PASS | `GET /auth/v1/health` 200 (GoTrue v2.197.0); `POST /auth/v1/signup` with the legacy anon key returns an access token (user created). |
| 7 | Studio answers (T-06) | PASS | `:54323/` 307 to `/project/default`, final 200. |
| 8 | Docker unreachable gives a clear message (spec 11) | PASS | With an invalid `DOCKER_HOST`, `db:start`, `db:reset`, `db:status`, `db:stop` all fail non-zero (pnpm ELIFECYCLE, exit 1) with "failed to connect to the docker API at ...; check if the path is correct and if the daemon is running". `db:reset` also adds a suggestion to install Docker Desktop. Output is a JSON line, readable but not prose. |
| 9 | Postgres major set and documented (T-06) | PASS | `[db] major_version = 17`. |
| 10 | Scripts `db:start/stop/reset/status` in `package.json`, no global install (T-06) | PASS | Scripts map to `supabase start/stop/db reset/status`; CLI is the devDependency `supabase@3.1.0`. |
| 11 | `GET /api/health` returns 200 with a known body (T-07, FR-11) | PASS | `HTTP/1.1 200`, `content-type: application/json`, body `{"status":"ok"}`. |
| 12 | `/api/health` works with no database, no `DATABASE_*` (T-07, FR-11) | PASS | Supabase stack stopped (0 containers), `env` has no DATABASE variable: production build (`next build`, rc 0, route shown as `ƒ /api/health`) then `next start`: 200 `{"status":"ok"}`, no errors in the server log. |
| 13 | Same in dev mode | PASS | `next dev` with `DATABASE_*` set to an unreachable DB (dev requires them by step-1 design): 200 `{"status":"ok"}`. |
| 14 | Route imports nothing, not prerendered (T-07) | PASS | Source has no imports, `dynamic = "force-dynamic"`; build output marks it dynamic. Non-GET: `POST` returns 405. |
| 15 | No out-of-scope additions | PASS | `git diff HEAD~2 HEAD --name-only`: package.json, lockfile, `src/app/api/health/route.ts`, `supabase/{.gitignore,config.toml,seed.sql,migrations/.gitkeep}`. No tables (0 in `public`), no ORM/supabase-js/drizzle dependency, no auth code, no `src/db`. |
| 16 | Versions pinned exact (NFR-06) | PASS | `supabase` `3.1.0` exact in `package.json`, lockfile resolves `supabase@3.1.0`; every dependency still exact; `engines.node` is the (intentional, T-49) range `>=26.13.1 <27`. |
| 17 | lint / typecheck / format:check / build still pass | PASS | In the clone: lint 0, typecheck 0, format:check 0, build 0. |
| 18 | Working tree clean after the run (clone) | PASS | `git status` clean apart from my own scratch logs, deleted. |

## Defects and observations

No defects. Observations:

- **O1 (info): the clone shares `project_id = nextjs-starter` with the main copy**, so two checkouts cannot run stacks at once and share volumes (round 2 started "from backup"). Expected for a starter; worth one line in the README (T-41).
- **O2 (info): Docker-unreachable errors are one-line JSON** (`{"_tag":"Error","error":{...}}`) rather than prose. Clear enough (names the Docker API and the daemon), but the README should list "Docker must be running" as a prerequisite and show this error.
- **O3 (info): the "Skipping migration .gitkeep" line** appears on every start/reset until T-11 adds a real migration (already in the execution notes).
- **O4 (info): `db:status` reports "Stopped services"** for rest/imgproxy/pooler; this is the visible effect of the Data API being disabled and should not alarm anyone.
- **O5 (info): no `.env` for Studio/analytics**; the stack starts 11 containers including analytics/edge runtime/vector; heavy but not in scope. Consider disabling unused services later if startup time matters.
- **O6 (info):** `/` was not re-verified here beyond the build; the health route is not covered by an automated test yet (belongs to T-13/T-17, as stated in the execution notes).

## Not verified

- `/api/health/db` (T-12), `app_backend` role (T-11), Drizzle (T-10).
- A real "Docker daemon stopped" (only an unreachable socket was simulated; the error path is the same Docker client failure).
- README documentation of the commands (T-41).

## Verdict

Step 2 passes: every acceptance criterion of FND-T-06 and FND-T-07 holds, with no defects. FND-FR-05 and the liveness part of FND-FR-11 are covered by evidence (automated tests are owed by T-13/T-17); NFR-06 holds for the Supabase CLI pin.

## For the Product Owner to decide

- None blocking. Optional: whether to disable unused local Supabase services (analytics, edge runtime, vector, realtime) to speed up startup (recommended: leave as is for now).
