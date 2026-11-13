# Final acceptance: 001 foundations (FND-T-48)

Acceptor: product-manager. Date: 2026-11-13. This file supersedes the "pending PO push" rows of [final-local.md](final-local.md); every other row of that file stands unchanged.

## Verdict

**Epic 001 is Done.** The Product Owner confirmed on 2026-11-13 that the Vercel dashboard has no environment variables, so the last conditional sub-check is closed. Definition of Done items 1-8 and 10 were met in final-local.md. Item 9 is now met with evidence (below), including the sub-check that the Vercel project has no database or service-role environment variables, which the Product Owner confirmed in the dashboard. No requirement is "not met". No scope creep found.

## Method and limits

- I have no shell and ran nothing. Evidence is the facts the orchestrator verified on `origin/main` (HEAD `cc4aa95`, all pushed), the T-45 to T-47 and T-64 execution notes in `tasks.md`, and the "Gate failure proofs" section of `tests/README.md`.

## Requirements whose status changed

| ID | Previous | Final | Evidence |
|----|----------|-------|----------|
| FND-FR-17 | Partially | Met | T-46: `GET /design*` returns 404 on the deployed URL (10/10 formal E2E against `https://project-v7n6g.vercel.app`); `/api/health` is 200. Local evidence unchanged (`acceptance/step-7.md`) |
| FND-FR-23 | Pending PO push | Met | CI run 43361816626 (commit `1f990fb`): all blocking jobs green. Run 43365790603 (commit `27ad4b2`) green again after the gate proofs. T-45 done |
| FND-FR-24 | Partially | Met, with accepted trade-off | Gitleaks blocking and green; dummy-secret failure proven in real CI (T-47 case 4); `pnpm audit` informational and red in every run (3 known advisories, see gaps), non-blocking by design. Dependabot covers github-actions only (D11); the PO accepted this, so npm updates are manual |
| FND-FR-25 | Pending PO push | Met | Run 43361816626: Deploy ran only after blocking jobs, deployed prebuilt with Vercel CLI pinned 65.14.0 (T-64), post-deploy health check passed. Run 43365790603 deploys green too. T-46: `/api/health` 200; `/api/health/db` 503 "unavailable" with no connection details; no Vercel Git auto-deploy. Sub-check not verified: see "Conditional" |
| FND-FR-26 | Pending PO push | Met | T-47: all five cases proven and recorded in `tests/README.md` ("Gate failure proofs"): lint, typecheck, test, secret scan (each: red job observed, Deploy skipped) and failing post-deploy hello-world (runs 43363308177, 43363938024, 43364322005, 43364785782, 43365201080). Each throwaway commit reverted; final run green |

Honest note on case 5: the deploy happened and only the "Post-deploy health check" step turned red. The gate detects a broken deployed app but cannot prevent that deploy; this is how the spec's post-deploy check works, and it is documented in `tests/README.md`.

## Summary count

34 IDs (27 FR, 7 NFR): Met 34 (FR-24 with the accepted github-actions-only Dependabot trade-off; FR-25 with the conditional sub-check below).

## Definition of Done item 9

| Part | Status | Evidence |
|------|--------|----------|
| Workflows run on push, CI green | Met | Runs 43361816626 and 43365790603 |
| Deployed to Vercel | Met | Deploy job green, alias `https://project-v7n6g.vercel.app` |
| Hello-world smoke test passes on the deployed URL | Met | Post-deploy health check passed; T-46 `/api/health` 200 |
| `/design` is 404 in production | Met | T-46, 10/10 E2E on the deployed URL |
| Gates shown to fail on bad input once | Met | T-47, five cases |
| No database or service-role variables on Vercel (FND-FR-03, T-46 item 6) | **Conditional** | Only partly verifiable without a token: the deployed app reports the DB unavailable and leaks nothing, and the deploy job passes only public variables. The dashboard check is the PO's |

Items 1-8 and 10: unchanged, Met (final-local.md).

## Conditional (needs the Product Owner)

- Closed: the Product Owner confirmed in the Vercel dashboard (Project > Settings > Environment Variables) that there are no environment variables, so no `DATABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` or `DATABASE_MIGRATION_URL` entries exist.

## Decisions already taken by the PO

- github-actions-only Dependabot accepted (FR-24, D11).
- ADR 0007 accepted; `minimumReleaseAge` set explicitly (ADR 0010).
- Add T-50 to T-57 (and T-61 to T-64) to the spec change log: done in this task, minimally.

## Gaps and follow-ups (none block the epic)

1. `pnpm audit` job is red in all runs with 3 known advisories: esbuild via drizzle-kit (moderate), minimatch via shadcn / eslint-config-next (moderate), deepmerge via shadcn (low, no patch). Informational by design; triage before epic 002 or when patches exist.
2. `minimumReleaseAgeExclude` entries removable after 2026-11-13 07:06 UTC.
3. `import/no-restricted-paths` hardening at the start of epic 002 (`docs/architecture.md` Known gaps).
4. GitHub Environment `production` restricted to `main` before real users; revisit the health check after promote (J2) and the unlocked Vercel CLI dependencies.
5. Manual VoiceOver pass before epic 002 forms.
6. Anon key choice (`ANON_KEY` vs `PUBLISHABLE_KEY`) in epic 002.
7. Drift check is near-vacuous with zero tables; FR-11 against a real DB is automated only with a mocked `@/db`; other epic 002 carry-overs are listed in final-local.md.

## Retrospective additions

- Worked: creating the GitHub and Vercel setup surfaced real deploy risks (release-age gate vs Vercel CLI, T-64), as the earlier retrospective predicted.
- Change: tasks.md status rows for pending-push tasks were updated late; update the row when the work finishes.
