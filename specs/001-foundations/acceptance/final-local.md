# Final acceptance, local part: 001 foundations (FND-T-44)

Acceptor: product-manager. Date: 2026-11-12. Scope: spec section 13 items 1-8 and 10, every FND-FR and FND-NFR, scope check against spec section 3.

## Verdict

**Epic 001 is "Done pending PO push".** Definition of Done items 1-8 and 10 are met. Item 9 (FND-FR-23 formal green run, FND-FR-25 real deploy, FND-FR-26 gate-failure proofs) waits for the PO's push and Vercel setup (T-45 to T-48). No requirement is "not met". Two are "partially" (FND-FR-24 Dependabot scope, FND-FR-17 production 404 only simulated until T-46). No scope creep found.

## Method and limits

- I have no shell and ran no command. Evidence is the earlier acceptance records (`acceptance/step-1.md`, `step-2.md`, `step-3-4.md`, `step-5-6.md`, `step-7.md`, `step-8.md`), the verification reports (`verification/`), and these facts reported to me by the orchestrator and tester:
  - On HEAD `d5f5afc` (orchestrator): `pnpm lint`, `pnpm typecheck`, `pnpm format:check` clean; `pnpm test` 242/242 in 16 files; git tree clean.
  - Tester T-40/T-42: `pnpm test:db` 212/212 (twice), `pnpm test:e2e` 110/110; fresh clone to running Supabase about 20 s and to the styled home page about 46 s (Docker images cached); no README errors.
  - Architect T-43: ADRs 0001-0011 consistent with the code, no divergences.
- Statuses: met / partially / not met / deferred / pending PO push.

## Requirement checklist

| ID | Status | Evidence |
|----|--------|----------|
| FND-FR-01 | Met | `acceptance/step-1.md`; `src/` has only app, db, lib, components, hooks and instrumentation; no auth/users/tenants/billing; typecheck clean on d5f5afc; E2E home test |
| FND-FR-02 | Met | `acceptance/step-1.md` (packageManager, engines `>=26.13.1 <27`, `.nvmrc`, lockfile, `engineStrict`, exact versions); lint/typecheck/format:check clean on d5f5afc |
| FND-FR-03 | Met | `acceptance/step-1.md` (env.ts/env.server.ts, fail-fast, build fails on bad public vars after T-49); server-only bundle sentinel test (`acceptance/step-3-4.md`); `pnpm test` 242/242 |
| FND-FR-04 | Met | `acceptance/step-1.md`; Gitleaks green on real runner (`acceptance/step-5-6.md`) |
| FND-FR-05 | Met | `acceptance/step-2.md`, `step-3-4.md` (T-53 automated checks, Data API off); README commands verified by T-42 dry run |
| FND-FR-06 | Met | `acceptance/step-3-4.md` (schema entry only, no tables after `db:reset`; note N1: no dedicated assertion, guard plus command evidence) |
| FND-FR-07 | Met | `acceptance/step-3-4.md`, CI half in `acceptance/step-5-6.md` (drift check ran green on real runner); near-vacuous with 0 tables, meaningful in epic 002 |
| FND-FR-08 | Met | `acceptance/step-3-4.md` (role migration, T-50 timeouts and default privileges, T-51 catalog tests); `test:db` 212/212 |
| FND-FR-09 | Met | `acceptance/step-3-4.md` (function and tests) plus lint half in `acceptance/step-8.md` |
| FND-FR-10 | Met | `acceptance/step-3-4.md` (items 1-9 each with tests and mutation proofs); `test:db` 212/212 twice |
| FND-FR-11 | Met | `acceptance/step-2.md` (liveness), `step-3-4.md` (db route, no-leak test T-53). Note N3: the 200 against a real DB is automated only with a mocked `@/db`, plus manual T-19 evidence |
| FND-FR-12 | Met | `acceptance/step-8.md` (rules a-f, illegal and legal tests, single-path exception); `pnpm lint` and `pnpm test` clean |
| FND-FR-13 | Met | `acceptance/step-8.md`; T-43 architect check of `docs/architecture.md` |
| FND-FR-14 | Met | `acceptance/step-7.md` (Tailwind, shadcn/Radix, Lucide, one font via `geist`, accent in one token file, no unused components) |
| FND-FR-15 | Met | `acceptance/step-7.md` (tokens, light/dark follow system, no flash E2E, axe contrast); `browserslist` floor documented |
| FND-FR-16 | Met | `acceptance/step-7.md` (components, app shell, Sonner mounted once; M4 partial, accepted) |
| FND-FR-17 | Partially | Met locally in E2E (`design-gate.spec.ts`, production-mode start returns 404, axe zero) per `acceptance/step-7.md`. The check on the real deployed URL is owed to T-46 |
| FND-FR-18 | Met | `acceptance/step-7.md`; `docs/design-system.md`; no Table/Dialog/etc. code; raw-value check in `src/design-consistency.test.ts` |
| FND-FR-19 | Met | `pnpm test` 242/242 (no Docker), `test:db` 212/212, `test:e2e` 110/110; test README (T-40) |
| FND-FR-20 | Met | `acceptance/step-3-4.md`, `step-7.md` (unit, DB, E2E with axe on `/` and `/design`) |
| FND-FR-21 | Met | `acceptance/step-3-4.md` (harness, factories, matrix pattern); `test:db` passes twice in a row |
| FND-FR-22 | Met | `acceptance/step-3-4.md` (schema guard, proven by throwaway table test) |
| FND-FR-23 | Pending PO push (design accepted) | Workflow files and `actionlint` accepted in `acceptance/step-5-6.md`; earlier real runs were green (`acceptance/step-5-6.md` cites runs `43336680336` and `43339244913`). Formal green on the final commit is T-45. README badge delivered by T-41 per tasks table, not independently re-checked by me |
| FND-FR-24 | Partially | Gitleaks blocking and green on the runner, audit informational, `.github/dependabot.yml` exists, secret note in README (T-41). Dependabot covers github-actions only (npm entry dropped, T-55); npm updates are manual. Dummy-secret failure in real CI is T-47. Needs PO confirmation (see below) |
| FND-FR-25 | Pending PO push | `ci.yml`, `vercel.json`, three-secret inventory, job graph, simulated smoke test accepted in `acceptance/step-5-6.md`. Real deploy and post-deploy check are T-46. Until `VERCEL_TOKEN` exists the deploy job is skipped green (J1), so a green run does not mean deployed |
| FND-FR-26 | Pending PO push | Test README "Gate failure proofs" section is a stub; filled by T-47 |
| FND-FR-27 | Met | README (T-41, fixed by T-63 after the dry run), `docs/architecture.md`, test README (T-40), `docs/design-system.md`, ADRs 0001-0011 (spec asked for 0001-0005); T-42 dry run, T-43 consistency check |
| FND-NFR-01 | Met | Tester T-42: Supabase running about 20 s, styled home page about 46 s from clone (Docker images cached; first image download excluded as the spec allows); no README errors. The 15-minute budget is far exceeded in margin |
| FND-NFR-02 | Met | `acceptance/step-3-4.md` (role flags, no BYPASSRLS, fail-closed outside `withRls`, no service-role key anywhere) |
| FND-NFR-03 | Met | `acceptance/step-7.md` (axe zero on `/` and `/design`, light and dark); E2E 110/110 |
| FND-NFR-04 | Met | `acceptance/step-7.md` (no horizontal page scroll at 375 and 1280; M4 is scroll inside `/design` frames only, accepted) |
| FND-NFR-05 | Met | `acceptance/step-5-6.md` (Gitleaks blocking, history clean, demo JWT handled narrowly); `.env.example` placeholders; bundle sentinel test |
| FND-NFR-06 | Met | `acceptance/step-5-6.md` (pins, actions by SHA, Gitleaks hash). Trade-off: Vercel CLI transitive dependencies are not lockfile-pinned (accepted for MVP) |
| FND-NFR-07 | Met | `acceptance/step-5-6.md`: `fast` job needs no Docker and runs independently of `database-and-e2e` |

Summary: 34 IDs (27 FR, 7 NFR). Met 29, partially 2 (FR-17, FR-24), pending PO push 3 (FR-23, FR-25, FR-26).

## Definition of Done

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Clean machine, README, within about 15 min | Met | T-42: about 46 s to styled home page, Supabase about 20 s |
| 2 | `/api/health/db` reaches local DB; `/api/health` is the only deployed smoke target | Met | FR-11 row; `ci.yml` smoke target |
| 3 | DB stack, schema command, migration workflow with drift check | Met | FR-06, FR-07 |
| 4 | `withRls` and `app_backend`; FR-10 tests pass incl. no-leak | Met | `test:db` 212/212 twice |
| 5 | One real test per level; fast one without Docker | Met | 242 unit, 212 DB, 110 E2E |
| 6 | Design system minimum; `/design` 404 in production | Met locally; production URL check in T-46 | FR-14 to FR-18 |
| 7 | Conventions and lint rules with tests | Met | `acceptance/step-8.md`; sign-off given here |
| 8 | Workflows exist, pass `actionlint`, same checks pass locally | Met | `acceptance/step-5-6.md`; lint/typecheck/format/test clean on d5f5afc |
| 9 | After push: CI green, deployed, smoke test, gate failures proven | Pending PO push | T-45 to T-48 |
| 10 | ADRs, architecture, design system, README, test README exist | Met | FR-27 row; T-43 |

## Scope-creep check (against spec section 3)

| Out-of-scope item | Finding |
|-------------------|---------|
| Auth, users, tenants, memberships | None in `src/` (acceptance records steps 1, 3-4, 8); no `src/modules` folder |
| App tables, module schemas, real-table policies | None; throwaway tables only inside tests |
| Verified-JWT/tenant `VerifiedContext` construction | Type and function only |
| Auth-aware SSR clients, middleware | None created |
| Cloud Supabase, email, Stripe/billing | None (grep in step-3-4: no Stripe) |
| `supabase gen types`, service-role key | None |
| Branches, PRs, hooks, Husky, commitlint | None |
| Components beyond epic 002's needs | None in `src/components/ui` (step-7) |
| Storybook, visual regression, dark toggle, i18n | None |
| App Dockerfile | None |
| pgTAP, coverage threshold, ZAP, CodeQL | None |
| Sample business features | None |

Additions beyond the literal spec, all judged inside intent and recorded in the acceptance files: T-50 to T-53 (role hardening, tests, `db:schema` safety), T-54 to T-57 (deploy fixes, Dependabot scope, Vercel preset), T-58 to T-60, T-61 (lint gap), T-62 (ADRs 0006-0011, required by AGENTS.md), the `sql.raw` and `process.env` lint checks (PO accepted), about 45 mutation tests (test-only), `src/instrumentation.ts`, `server-only`, the skip-safe deploy preflight (J1). Nothing in production code beyond the spec. Housekeeping owed: the approved `spec.md` change log should mention T-50 to T-57 (recommended in step-3-4 and step-5-6; not done by me as this task covers only the files below).

## Gaps and open items (honest list)

1. **Pending PO push (DoD 9):** formal green CI on the final commit, real Vercel deploy and post-deploy check (and check that the deploy job is not skipped), `/design` 404 on the deployed URL, gate-failure proofs (T-45 to T-48). Until all three `VERCEL_*` secrets exist, every push ends green with a skipped deploy.
2. **Dependabot is github-actions only** (FR-24, D11): npm updates are manual; only informational `pnpm audit` flags them. Needs PO confirmation.
3. **Drift check is near-vacuous** with zero tables; becomes real in epic 002.
4. **FR-11 against a real database** is automated only with a mocked `@/db` plus manual evidence; a DB-level test could be added in epic 002.
5. **Stale status row:** `tasks.md` still shows T-42 as `todo` although the tester reported it done and T-63 and T-43 depend on it. The orchestrator should correct it.
6. **Optional, deferred by design:**
   - `minimumReleaseAgeExclude` entries removable after 2026-11-13 07:06 UTC.
   - Lint hardening with `import/no-restricted-paths` (and relative `../db` gap, N1/N2 of step 8) at the start of epic 002 (`docs/architecture.md` Known gaps).
   - GitHub Environment `production` restricted to `main` before real users; also revisit health check after promote (J2) and the unlocked Vercel CLI dependencies.
   - Manual VoiceOver pass before epic 002 forms.
   - Epic 002 items from step 7: `isAnnounced` on form-level Alert, sign-out ghost vs outline, wordmark link, PageHeader with several actions.
   - Epic 002 CI items: remove `gotrue` from the `-x` list, replace `NEXT_PUBLIC_APP_URL`.
   - Anon key choice `ANON_KEY` vs `PUBLISHABLE_KEY`, decided in epic 002.
   - Realtime and Storage left enabled locally.

## Retrospective

- Worked: a fresh agent per task with file hand-off, and an independent verification plus acceptance after each step, caught real defects early (role timeouts, `db:schema` safety, Vercel project errors, env-split wording).
- Worked: the onboarding dry run (T-42) found README gaps that the author could not see.
- Change: no-shell acceptance sessions repeated "confirmation re-runs" for the orchestrator each step; give the acceptor a shell or fold those runs into the verification task.
- Change: update the spec change log whenever the orchestrator authorizes fix tasks (T-50 to T-57), so spec and task list do not drift.
- Change: keep `tasks.md` status rows current as work finishes (T-42 stale); the fix-task IDs (T-49+) out of order made the table harder to read.
- Change: for pending-push work, create the GitHub repository and Vercel setup earlier so deploy risks surface before the end.

## Decisions for the Product Owner

- Confirm github-actions-only Dependabot as acceptable (recommended: accept; npm updates manual).
- Push to GitHub and finish Vercel setup (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) to unlock T-45 to T-48.
- Optional: approve adding T-50 to T-57 to the spec change log (recommended yes).
