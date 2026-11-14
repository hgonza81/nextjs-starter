# Next.js SaaS starter

[![CI](https://github.com/hgonza81/nextjs-starter/actions/workflows/ci.yml/badge.svg)](https://github.com/hgonza81/nextjs-starter/actions/workflows/ci.yml)

Multi-tenant SaaS starter built with Next.js (App Router, strict TypeScript)
and Supabase (Auth + Postgres). A tenant is a company; users belong to tenants
through memberships.

Target: from a clean clone to the styled home page with local Supabase running
in about 15 minutes. That time excludes the first download of the Supabase
Docker images, which depends on your connection.

## Prerequisites

- **Node 26** (`>=26.13.1 <27`). The exact version is in `.nvmrc`. `nvm` is
  optional: any way of getting Node 26 works (with nvm, run `nvm use`). Installing under another Node major fails (`engineStrict`), but a
  plain `pnpm install` on an already-installed tree can skip that check, so
  confirm with `node -v` (it must print `v26.x`). Node 26 ships without
  corepack: do not use `corepack`.
- **pnpm 12.18.0** (the version in `package.json`). Install it with your Node
  manager or Homebrew (`brew install pnpm`).
- **Docker**, running: Docker Desktop, OrbStack or Colima. Local Supabase runs
  in containers. If Docker is stopped, `pnpm db:start` fails with a one-line
  JSON error such as `failed to connect to the docker API`; start Docker and
  retry.
- Chromium for the E2E tests, once per machine:
  `pnpm exec playwright install chromium`.

## Setup

```bash
nvm use                      # or any way to get Node 26; check `node -v`
pnpm install                 # needs network access
cp .env.example .env.local   # never commit .env.local
pnpm db:start                # starts local Supabase in Docker
pnpm db:status               # prints the local keys
```

Copy the local anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`,
replacing the placeholder `replace-with-local-anon-key`. Use the `ANON_KEY`
value, not `PUBLISHABLE_KEY`: the app does not use a Supabase client yet (it
only validates that the variable is non-empty, `src/lib/env.ts`), so the code
does not decide between them, and `ANON_KEY` is the one verified to work. To
print it:

```bash
pnpm -s db:status | grep -o '"ANON_KEY":"[^"]*'   # prints "ANON_KEY":"<key>; copy only <key>
```

It is a local-only value, not a secret. Then:

```bash
pnpm db:reset                # applies migrations and supabase/seed.sql
pnpm dev                     # http://localhost:3000
```

`.env.local` is needed by `pnpm dev` and `pnpm db:schema`. The tests do not
need it (see [tests/README.md](tests/README.md)). Environment variables are
validated at startup; the schema is in `src/lib/env.ts` (public) and
`src/lib/env.server.ts` (server-only), and `.env.example` documents every
variable.

## Scripts

| Script               | What it does                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`           | Next.js dev server on port 3000                                                                                     |
| `pnpm build`         | Production build                                                                                                    |
| `pnpm start`         | Serves the production build                                                                                         |
| `pnpm lint`          | ESLint (includes the module-boundary rules)                                                                         |
| `pnpm typecheck`     | `tsc --noEmit`                                                                                                      |
| `pnpm format`        | Prettier, writes changes                                                                                            |
| `pnpm format:check`  | Prettier, check only                                                                                                |
| `pnpm test`          | Unit tests (Vitest), no Docker                                                                                      |
| `pnpm test:db`       | Database and RLS tests against local Supabase (needs Docker, `db:start` and `db:reset`)                             |
| `pnpm test:e2e`      | Playwright end-to-end tests (builds the app, no database needed)                                                    |
| `pnpm test:coverage` | Unit tests with a coverage report (no threshold)                                                                    |
| `pnpm db:start`      | Starts local Supabase                                                                                               |
| `pnpm db:stop`       | Stops local Supabase                                                                                                |
| `pnpm db:reset`      | Recreates the local database from migrations and seed                                                               |
| `pnpm db:status`     | Shows local Supabase status and keys                                                                                |
| `pnpm obs:start`     | Starts the optional local telemetry collector (Docker); see below                                                   |
| `pnpm obs:stop`      | Stops and removes it                                                                                                |
| `pnpm gen:module`    | Creates `src/modules/<name>/index.ts`; see below                                                                    |
| `pnpm db:schema`     | Regenerates `src/db/schema/` from the database (`drizzle-kit pull`); needs `DATABASE_MIGRATION_URL` in `.env.local` |

Notes on the database commands:

- The Supabase project id (`nextjs-starter`) is the same in every checkout, so
  two copies of this project cannot run local stacks at the same time.
  Stopping the stack saves its data to a backup volume shared by all
  checkouts (same project id), so after switching checkouts run
  `pnpm db:reset` before relying on the database.
- `pnpm db:status` lists some services (rest, imgproxy, pooler) as "Stopped
  services". That is expected: the Data API is disabled on purpose, and the
  app reaches Postgres through Drizzle (ADR 0003). The local pooler user is
  `app_backend.pooler-dev`.
- Never run `pnpm db:schema` with `--include-seed`, and never run
  `supabase db reset --linked`, against a cloud project: both can destroy or
  leak data.
- `src/db/schema/schema.ts` and `relations.ts` are generated: do not edit them.

## Tests

Three layers: unit (`pnpm test`), database/RLS (`pnpm test:db`) and E2E
(`pnpm test:e2e`). Unit tests alone do not catch behavioral regressions, so
keep `pnpm test:db` green too. Prerequisites, state reset and how to write
tests are in [tests/README.md](tests/README.md).

E2E needs the three `NEXT_PUBLIC_*` variables (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`) at build time.
`playwright.config.ts` sets them for its own server, so a plain
`pnpm test:e2e` works. If you build or start the app yourself, export them
first (the values in `.env.example` are fine). E2E uses port 3100, so it does
not collide with `pnpm dev`.

## Creating a module

```bash
pnpm gen:module billing   # creates src/modules/billing/index.ts
```

The name must be kebab-case. Only `index.ts` (the module's public API) is
created, with no subfolders, sample code or tests; an existing module is never
touched. Add subfolders when they have content.

## Local telemetry (optional)

Telemetry is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set. The app, the
tests and CI never need the collector. To inspect traces and logs locally
(Docker required):

```bash
pnpm obs:start   # Grafana LGTM on http://127.0.0.1:3001 (admin / admin)
# add the OTEL_* lines below to .env.local, then restart pnpm dev
pnpm obs:stop    # stops it and discards its data
```

The variables are all optional and validated at startup (the values below are
the local ones; `.env.example` documents them):

- `OTEL_EXPORTER_OTLP_ENDPOINT` (for example `http://127.0.0.1:4318`): turns
  telemetry on.
- `OTEL_EXPORTER_OTLP_PROTOCOL`: `http/protobuf` (default) or `http/json`.
- `OTEL_SERVICE_NAME`: defaults to `nextjs-starter`.

Details, ports and how to read traces and logs:
[docker/observability/README.md](docker/observability/README.md).

Limits worth knowing:

- Next.js prints the raw error (message and stack) of an unhandled server
  error to stdout before our error hook runs. Our structured logs never contain
  it, but in production it can reach the platform log, so never put personal
  data or secrets in error messages (ADR 0015, "Known limit, raw framework
  output").
- If a telemetry variable is invalid, `register()` fails but Next.js keeps the
  process alive: every request answers 500 and the log names the variable
  (never its value).

## The `/design` page

`/design` is a living showcase of the design system (`docs/design-system.md`):
tokens, components and patterns in light and dark panels. It is controlled by
`DESIGN_PAGE_ENABLED`:

- Unset: on in `pnpm dev`, off (404) in any production build.
- `true`/`false`/`1`/`0` overrides that default.
- Never set it on Vercel and never prefix it with `NEXT_PUBLIC_` (that would
  bake it into the build).
- Keep it off in real deployments: `/design` and the fault fixtures used by
  the tests are for development and CI only.

## Browser support (`browserslist` rule)

`package.json` has a `browserslist` (Chrome/Edge 123, Firefox 120, Safari
17.5). It is load-bearing: the single token file `src/app/globals.css` uses
CSS `light-dark()`. If the list is lowered, or removed so Next's default list
applies, lightningcss rewrites `light-dark()` into a polyfill that breaks the
theme (the side-by-side light/dark panels on `/design` stop working). Raising
the minimums is fine; do not lower them or replace them with the default.

## Troubleshooting

| Symptom                                                   | Cause and fix                                                                                                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `ERR_PNPM_UNSUPPORTED_ENGINE` on install                  | Wrong Node major. Run `nvm use` (Node 26) and install again, using `pnpm install --force` if the tree already exists.                          |
| `pnpm db:start` says it cannot connect to the Docker API  | Docker is not running. Start Docker Desktop, OrbStack or Colima.                                                                               |
| `pnpm db:start` fails on ports or container names         | Another local Supabase stack (or another checkout of this project) is running. Stop it with `pnpm db:stop` there.                              |
| App starts but Supabase calls fail                        | The anon key in `.env.local` is still the placeholder. Copy it from `pnpm db:status`.                                                          |
| `pnpm test:db` fails with a missing role or schema        | Run `pnpm db:start`, then `pnpm db:reset`.                                                                                                     |
| `pnpm db:schema` complains about `DATABASE_MIGRATION_URL` | Create `.env.local` from `.env.example` (see Setup).                                                                                           |
| E2E cannot launch a browser                               | Run `pnpm exec playwright install chromium`.                                                                                                   |
| `Skipping migration .gitkeep`-style warnings from the CLI | Harmless Supabase CLI output.                                                                                                                  |
| `pnpm dev` modifies `AGENTS.md`                           | This may happen: `next dev` writes an agent-rules block (see the note in `AGENTS.md`). Do not commit it by accident: `git checkout AGENTS.md`. |

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push; there are no
pull requests and no feature branches, only `main`. It runs the same commands
as local development:

- **Fast checks (blocking):** install, format check, lint, typecheck, unit
  tests, build.
- **Database and E2E (blocking):** local Supabase in Docker, migrations and
  seed, schema drift check, `pnpm test:db`, `pnpm test:e2e`.
- **Secret scan (blocking):** Gitleaks over the full git history.
- **Dependency audit (informational):** `pnpm audit`; a failure is shown but
  does not block.
- **Deploy to Vercel:** only on `main`, only when every blocking job is green.
  It builds with the Vercel CLI, deploys the prebuilt output to production and
  runs a post-deploy health check (`/api/health`).

How you notice a failure: the status badge at the top of this file turns red,
and GitHub emails the pusher when a run fails. A red blocking job prevents the
deploy.

Dependencies are updated manually. Dependabot covers GitHub Actions versions
only (npm updates are not enabled because its updater does not support
Node 26 yet).

Private-repository note: GitHub Actions minutes are limited on private
repositories. The Docker/E2E job is the longest; check your plan's allowance.

### Product Owner prerequisites (one-time, outside the code)

1. A GitHub repository for the project, with a remote on this checkout.
2. A Vercel project for the app.
3. **Connect your GitHub account in Vercel** (Vercel account settings, Git
   connections). Without it Vercel blocks the deployment and the deploy job
   hangs for about 15 minutes until its timeout.
4. A Vercel access token, and three GitHub repository secrets (Settings,
   Secrets and variables, Actions): `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID`. The deploy job checks that they exist before doing
   anything.
5. Do not set `DESIGN_PAGE_ENABLED` on Vercel. No cloud database exists yet,
   so `/api/health/db` answers 503 in production by design.

Details and rationale: `docs/adr/0004-env-and-secrets.md` and
`docs/adr/0009-ci-cd-pipeline.md`.

## Commit convention (suggested)

Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`,
`build:`, with an optional scope, for example `feat(db): add memberships
table`. Imperative mood, subject under about 72 characters. Never commit
`.env*` files (except `.env.example`) or secrets.

## If a secret is pushed

Removing it in a later commit is not enough: it stays in the git history and
anyone who cloned or saw it may have it. **Rotate the secret at its provider
immediately** (revoke the old one, create a new one, update GitHub secrets and
Vercel), then clean the history if needed. Gitleaks in CI fails the build
when it finds one.

## Documentation

- [`docs/architecture.md`](docs/architecture.md): structure, conventions,
  deployment.
- [`docs/design-system.md`](docs/design-system.md): tokens, components,
  accessibility rules.
- [`docs/adr/`](docs/adr/README.md): architecture decision records (index in
  `docs/adr/README.md`).
- [`tests/README.md`](tests/README.md): test layers and harness.
- `specs/`: epics, requirements and tasks.
