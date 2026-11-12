# Review by product-manager — 001-foundations — round 1

## Summary
The requirements are clear in intent (skeleton, local Supabase, tooling, design system, tests, CI, modular structure) and the boundary with 002 is mostly clean. The biggest issue is that almost every requirement is `OPEN` and none has a "done" test, so as written the epic cannot be accepted. There is also a risk that FND-HR-04/05/10 grow into speculative, over-built work for an app that currently has no features.

## Concerns and gaps
- [important] No acceptance criteria or definition of done for the epic. FND-HR-01..11 describe intentions ("beautiful", "modular", "solid base"), not verifiable outcomes. Touches all FND-HR.
- [important] FND-HR-02 vs. FND-HR-03: "no tables yet" and "no auth" means there is nothing to prove the DB connection works. Without a minimal end-to-end check (e.g. a health check that reaches local Supabase), "wired" is untestable.
- [important] Boundary with 002 is blurry on three points: (a) the Supabase client libraries for SSR/cookies are auth-adjacent (which package and which clients are created here vs. in 002?); (b) the `src/modules/{auth,users,tenants}` structure in AGENTS.md is created by whom, since FND-HR-10 asks for structure but FND-HR-01 forbids users/tenants; (c) the first migration and RLS conventions (who owns the migrations folder setup vs. the first table?).
- [important] FND-HR-05 (design system) is unbounded. "Tokens and base components" can mean 5 or 50 components. Risk of building components nobody uses yet. Should be limited to what 002 screens need (forms, buttons, inputs, layout, an empty dashboard shell).
- [important] FND-HR-10 (modularity "for a large app") invites speculative layering (services/repositories/models for code that does not exist). Needs a cap: define conventions and enforcement, with at most one trivial example, not empty folder trees.
- [important] FND-HR-11 says "Billing (Stripe) must be easy to add later" but this is untestable and a source of speculation. Needs to be reduced to "no decision made now that blocks it" and nothing more.
- [minor] FND-HR-09 mixes CI (checks) and CD (deployment) and "development workflow" (branching, commits). CD and hosting target are probably separable and can be deferred. Note the project is not yet a git repository (environment shows no git), so branching/commit conventions and CI platform depend on where the repo is hosted.
- [minor] FND-HR-08 asks for unit, integration, and E2E tooling "from the start". E2E and integration tooling with no features can only be proven with a trivial smoke test; the scope of those sample tests is undefined.
- [minor] FND-HR-06 "etc." is vague; list closed set of categories (package manager, lint/format, validation, forms, env var handling).
- [minor] Env/config handling (`.env.example`, typed/validated env vars, no secrets committed) is not mentioned, yet is needed by FND-HR-02/03/09 (secret scanning).
- [minor] Docker scope (FND-HR-07) is unclear: "Supabase CLI already uses Docker" so the requirement may already be satisfied implicitly; whether the app itself is containerized is a separate choice that may be unnecessary for MVP.
- [minor] No developer-onboarding criterion ("new developer can run the app in N minutes"), which is the natural success measure for a starter.

## Proposals
- Define the epic's Definition of Done as a short checklist (proposed, for the client to confirm):
  1. On a clean machine, following the README, a developer gets the app and local Supabase running with documented commands in under 15 minutes.
  2. The home page renders using the chosen design system.
  3. A health/smoke route or script proves the app reaches local Supabase (no tables needed).
  4. One sample test per level (unit, integration, E2E) runs green locally and in CI.
  5. CI runs lint, typecheck, tests, build, and dependency + secret scanning on every pull request, and fails on violations.
  6. A documented structure/conventions page exists and at least one automated rule enforces module boundaries.
  7. Architecture decisions are recorded as ADRs.
- Keep the design system to a "minimum viable" set: tokens (color, type, spacing, radius), plus only the components 002 needs (button, input, label/field error, card, form layout, app shell). Anything else is "added when a feature needs it". Suggestion (not in scope unless approved).
- Draw the 001/002 line explicitly: 001 delivers the Supabase CLI project, migrations folder and the plain database client setup; 002 delivers Supabase Auth wiring (cookie/session clients), the three modules, and the first migration. Module folders for auth/users/tenants are created in 002, 001 only defines the convention and boundary-enforcement rule.
- Rewrite FND-HR-11 as a constraint: "no dependency or structure choice is made that would require rework to add Stripe later"; no Stripe code, packages, or tables.
- Split FND-HR-09 into CI (in this epic) and CD/deployment (candidate to defer). Suggestion (not in scope unless approved).
- Add an explicit Won't-do list: no sample business features, no component library beyond what 002 needs, no deployment pipeline, no Storybook or other extras unless chosen.
- Suggested delivery order (walking skeleton first, each step demonstrable): (1) Next.js skeleton + package manager + lint/format/typecheck; (2) local Supabase CLI + Docker + DB connectivity smoke check; (3) CI with lint/typecheck/build; (4) test tooling with one sample test per level, added to CI; (5) security scanning in CI; (6) design system minimum and styled home page; (7) structure conventions doc + boundary lint rule; (8) README/onboarding and final acceptance.

## Questions for the client
1. Is deployment (CD, hosting target) part of this epic?
   - Options: A) Yes, set up a deploy pipeline now / B) No, CI only; deployment in a later epic / C) Only document the intended target
   - Recommendation: B, because no features exist to deploy and the choice of host is cheap to defer.
   - Impact if undecided: CI/CD tasks cannot be sized; risk of adding a hosting dependency prematurely.
2. How far should the design system go in this epic?
   - Options: A) Tokens + the minimal components needed by epic 002 screens / B) Tokens + a broader general-purpose component set / C) Only pick a UI library and theme, no custom design system yet
   - Recommendation: A, because it matches "beautiful and consistent from the start" without building unused components.
   - Impact if undecided: Design and component work is unbounded; epic cannot be accepted.
3. Is a "walking skeleton" proof required for the database (no tables)?
   - Options: A) Yes, a health check that reaches local Supabase, plus one test / B) No, only the CLI project and installed client library
   - Recommendation: A, because it makes FND-HR-02/03 verifiable at almost no cost.
   - Impact if undecided: "Wired" cannot be accepted objectively.
4. Where does the line with epic 002 fall for Supabase client setup and module folders?
   - Options: A) 001 only installs/configures the base database client and conventions; Auth-aware clients and `auth/users/tenants` modules are created in 002 / B) 001 also creates the Supabase SSR/cookie clients and empty module folders
   - Recommendation: A, because it keeps 001 free of auth concerns as stated in FND-HR-02 and avoids empty speculative structure.
   - Impact if undecided: Duplicate or conflicting work between 001 and 002.
5. What is the minimum bar for "modular/enforced" (FND-HR-10)?
   - Options: A) A written conventions doc plus automated lint/boundary rule / B) Conventions doc only / C) Full layered scaffold (services, repositories, models) with example code
   - Recommendation: A, because enforcement keeps the structure clear as the app grows without scaffolding code that does not exist yet.
   - Impact if undecided: Either too little guardrail for a large app or speculative empty layers.
6. Which security checks are mandatory gates (fail the build) versus informational?
   - Options: A) Dependency audit and secret scan both block merges / B) Secret scan blocks, dependency audit is informational / C) Both informational at first
   - Recommendation: B, because audit findings are often unfixable noise for an MVP while a leaked secret is never acceptable.
   - Impact if undecided: CI may be flaky or too lax.
7. Should a "new developer onboarding in N minutes" criterion be part of the definition of done?
   - Options: A) Yes, 15 minutes from clone to running app and tests / B) Yes with a different time / C) No
   - Recommendation: A, because it is the most meaningful success measure for a starter.
   - Impact if undecided: No objective way to judge the DX of the starter.

## Risks and assumptions
- Assumption: the repository will be hosted on a platform with a CI service (e.g. GitHub); the project is currently not under git, which must be resolved before CI work.
- Assumption: the client is "local Supabase first"; a cloud project is created later (FND-HR-02 is OPEN).
- Risk: over-building (design system, layering, tooling) before any feature exists; mitigated by the DoD checklist and Won't-do list.
- Risk: library choices (UI, forms, validation, test tools) are hard to reverse once 002 builds on them; the architect should record ADRs, and the client should confirm them before the spec.
- Risk: leaving the 001/002 boundary vague produces rework in 002; resolve via Question 4.
- Risk: Docker requirement on developer machines (Supabase CLI needs it) affects onboarding time and CI runtime; to be documented.

---

# Review by product-manager — 001-foundations — round 2

## Summary
I confirm all accepted round 1 positions (pnpm/pinned versions, domain modules with lint enforcement, local Supabase via CLI, ESLint/Prettier, Zod, React Hook Form, Vitest/Playwright with one smoke test per layer, Tailwind + shadcn/ui, design system limited to 002's needs plus a showcase page, light/dark by system, WCAG 2.2 AA). The PO overrides (Drizzle ORM and all DB libraries now, GitHub Actions CI plus Vercel deployment, no branches/PRs/hooks, Stripe dropped) are valid PO decisions and are recorded as such; they enlarge the epic, so FND-HR-02, 03, 09, 10, 11 must be reworded and the 001/002 boundary redrawn. There are no blockers, only three defaults the spec will adopt unless the PO objects.

## Concerns and gaps
- [important] FND-HR-03 now means "install and set up" a full DB stack (Drizzle, drizzle-kit, supabase-js, @supabase/ssr, generated types) with zero tables. Without a bounded definition of "set up", the scope is open-ended and untestable. Touches FND-HR-03.
- [important] The 001/002 boundary for the ORM, schema and RLS function must be explicit, otherwise 001 and 002 duplicate or conflict. The centralized "run every query in a transaction under the user's security context" function (SET LOCAL ROLE authenticated + request.jwt.claims) can be built and tested in 001 against plain SQL (e.g. `select current_user, auth.uid()`), but its input (a verified JWT and verified tenant) only exists once auth and memberships exist (002). Policies that check real membership need the memberships table (002). Touches FND-HR-03, FND-HR-10.
- [important] Two migration mechanisms now coexist: Supabase CLI SQL migrations (RLS, roles, functions) and drizzle-kit (schema). If both generate migrations, ordering and ownership conflict. The architect must settle one source of truth in an ADR before the spec. Touches FND-HR-02, FND-HR-03.
- [important] Deployment vs. database: Vercel will deploy an app with no cloud Supabase project (Q3 chose local only). A `/api/health` that reaches the DB would fail in production. The "hello world" deploy proof must therefore not depend on the database. Touches FND-HR-02, FND-HR-09.
- [important] CI/CD cannot be verified by the team until the PO pushes to GitHub (not a task) and creates the Vercel project and secrets (PO prerequisite). Acceptance of workflow criteria therefore has to be split: "workflow files exist, are valid, and run the same commands locally" (verifiable now) vs. "green on GitHub and deployed" (verified by the PO after the first push). Touches FND-HR-09.
- [minor] "No branches/PRs": round 1 DoD item 5 said "on every pull request"; now it is "on every push". The "gates are proven to fail on bad input" check (lint error, type error, failing test, dummy secret) can only be proven after the first push, or locally via the same commands.
- [minor] Deploy ordering with "fix failures afterwards": if deploy runs even when checks fail, a broken build can reach production. A default is needed (see Proposals). With a single user and no production traffic the risk is low.
- [minor] Q1 A ("no repository layer") is still accepted but Drizzle changes the shape: queries live inside module files and must all go through the central transaction function. Where the Drizzle schema lives (per module vs. central) is an architect decision; 001 must not create schemas for modules that do not exist yet.
- [minor] FND-HR-11 minimalism is gone where it conflicts with the ORM decision, but "nothing speculative" still protects the rest: no sample business features, no tables, no Stripe/billing mention, email still out of scope.
- [minor] @supabase/ssr: PO says install and set up; auth-aware cookie/session handling is auth work. Needs a precise line.

## Proposals
**Boundary 001 vs. 002 (ORM, schema, RLS function)** (replaces my round 1 proposal 30 where it conflicts):

| Item | 001 | 002 |
|------|-----|-----|
| Supabase CLI project, `supabase/` folder, local stack, migrations folder | Yes | Adds first migrations |
| Packages: drizzle-orm, drizzle-kit, supabase-js, @supabase/ssr, postgres driver | Installed and configured (drizzle config, DB connection from validated env) | Uses them |
| Drizzle schema / app tables | None (empty schema entry point only) | Defines tables (tenants, memberships, ...) |
| Generated types | Command and pipeline in place (documented), output may be near-empty | Regenerated with tables |
| Centralized RLS-context function (transaction, SET LOCAL ROLE, jwt claims) | Implemented with the claims as an input argument; proven by an integration test with no app tables (role is `authenticated`, `auth.uid()` equals the claim, settings do not leak outside the transaction) | Wires it to the verified JWT and verified tenant; adds policies that check real membership; RLS tests on real tables |
| Supabase clients (supabase-js base factory) | Base server factory plus `/api/health` | Auth-aware SSR/cookie clients, middleware/session handling using @supabase/ssr |
| Auth, modules `auth/users/tenants`, tenants, memberships | No (convention and boundary rule only) | Yes |

**Rewritten requirements (proposed wording, IDs unchanged; to be carried into the spec as FND-FR/NFR):**

| ID | Proposed wording |
|----|------------------|
| FND-HR-02 | A **local** Supabase (Postgres) development environment is set up through the Supabase CLI (requires Docker, documented as a prerequisite), with a migrations folder and documented start/stop/reset commands. No application tables, no authentication, no cloud Supabase project in this epic. |
| FND-HR-03 | The **database access stack** is installed, configured and proven working: Drizzle ORM and drizzle-kit, `supabase-js`, `@supabase/ssr`, a typed and validated environment configuration, and a type-generation command. A single centralized function runs database work inside a transaction in the user's security context (role `authenticated` plus JWT claims set per transaction), and its behavior is proven by an automated test. The app can reach the local database through a health check. Application tables, policies on real tables, and the verification of the JWT and tenant are out of this epic (epic 002). |
| FND-HR-09 | **CI and CD** run on GitHub Actions on every push to the single working branch. CI runs lint, typecheck, tests (unit, integration, E2E smoke), build, and a secret scan (blocking) plus a dependency audit (informational). CD deploys the application to Vercel after CI passes, and a simple "hello world" smoke test against the deployed URL proves the pipeline. Workflows live in the repository. There are no branches, pull requests, git hooks, or commit-message tooling; a failing run is fixed afterwards. Creating the GitHub repository and the Vercel project and secrets is a Product Owner action, not a task. |
| FND-HR-10 | The code is modular, readable, maintainable and testable, organized as domain modules with a public API and no repository layer, with the conventions documented and enforced by automated lint rules (proven by a test that an illegal import is reported). The structure must stay clear as the app grows to about 50 tables with full CRUD: no huge folders. Module folders for auth/users/tenants are created in 002. |
| FND-HR-11 | Keep the epic to what is stated here: no sample business features, no application tables, no speculative layers. Billing is not mentioned or prepared. Where this conflicts with an explicit Product Owner decision (e.g. the ORM and full database stack), the Product Owner decision prevails. |

Out-of-scope list in the spec: authentication and any user/tenant/membership functionality, any application tables, RLS policies on real tables, JWT/tenant verification, email sending, cloud Supabase project, Stripe/billing (simply absent), branch/PR workflow and commit hooks, Storybook, components beyond 002's needs, creating the GitHub repo.

**Updated Definition of Done (proposed):**
1. Clean machine, following the README, within about 15 minutes: Docker prerequisite met, `pnpm install`, local Supabase started, app running and showing the styled home page.
2. `/api/health` reaches the local database (no tables) and reports status; it is not used as the deployed smoke test.
3. Database stack in place: Drizzle and drizzle-kit configured, types command works, one documented migration workflow (single source of truth per the ADR).
4. The centralized RLS-context function exists and an integration test proves: role is `authenticated`, `auth.uid()` matches the supplied claim, and context does not leak after the transaction ends.
5. One passing sample test per level (unit, integration/DB, E2E with axe on the home page); separate commands, the fast one without Docker.
6. Design system minimum (tokens + 002's components + `/design` showcase) is in place and the home page uses it.
7. Conventions doc plus lint rules enforce module boundaries; a test shows an illegal import is reported.
8. GitHub Actions workflow files exist for CI and deploy; the same checks pass locally with the documented commands (verifiable by the team now).
9. After the PO's first push and Vercel setup: workflows run on push, CI is green, the app is deployed to Vercel, and the hello-world smoke test passes against the deployed URL. Gates (lint, type, test, secret) are shown to fail on bad input once.
10. ADRs recorded (layering, enforcement, local topology, ORM + RLS transaction approach, migration source of truth, test strategy, CI/CD, UI stack).

Items 1 to 8 and 10 are accepted by the team; item 9 is accepted by the PO after the push (the epic can be "done pending PO push" until then).

**What the spec should contain (beyond the standard structure):**
- Glossary: security context, RLS context function, migration source of truth, smoke test (health vs. deployed hello world).
- Decisions section linking the ADRs and recording the PO overrides with date (ORM in, Vercel deploy, no branches/hooks, Stripe dropped).
- The 001/002 boundary table above, so 002's requirements can be re-reviewed against it.
- Delivery order (walking skeleton first), updated: (1) Next.js skeleton + pnpm + lint/format/typecheck; (2) local Supabase + Docker + env + `/api/health`; (3) Drizzle + libraries + migration workflow + RLS-context function with its integration test; (4) test tooling with one sample per level; (5) CI workflow (lint, typecheck, tests, build, secret scan, audit); (6) Vercel deploy job + hello-world smoke test; (7) design system minimum + styled home + showcase; (8) conventions doc + boundary lint rule; (9) README/onboarding and final acceptance. Steps 5 and 6 can be prepared before the repo exists but verified only after the PO pushes.
- Explicit PO prerequisites list: GitHub repo and first push, Vercel project, GitHub secrets (Vercel token and IDs), a note that the project is not yet a git repo and `git init` is part of the PO's setup (or a developer step if the PO asks).
- Commit convention: single branch, plain descriptive messages (Conventional Commits only as a suggestion, no tooling).
- Parking lot: cloud Supabase project and production database, pgTAP, toggle for dark mode, Storybook, Dependabot/CodeQL tuning, branch protection.

## Questions for the client
No real blockers. The spec will adopt the following defaults unless the PO objects (they can be confirmed together with spec approval):
1. Deployed hello-world test does not touch the database (the deployed app has no cloud Supabase yet); `/api/health` DB check runs locally and in CI only.
   - Recommendation: yes, because a cloud project is out of scope per Q3.
2. Deploy job runs only after CI passes (even though there are no PRs or branches).
   - Recommendation: yes, because it is free and avoids shipping a broken build; failures are still fixed afterwards.
3. `@supabase/ssr` is installed in 001 but the auth-aware clients and session handling are created in 002.
   - Recommendation: yes, as it keeps auth out of 001; the architect can still pre-create thin factories if the ADR requires it.

## Risks and assumptions
- Assumption: the PO will push to GitHub and set up Vercel before epic acceptance; until then CI/CD acceptance is partial.
- Risk: scope growth versus round 1 (ORM stack, RLS function, CD). Mitigated by the boundary table and the Won't-do list; any new request is a change to scope needing PO approval.
- Risk: the RLS-context function is security-critical and hard to reverse; it needs an ADR and the test in DoD item 4. A wrong design is expensive once 50 tables use it. Architect to specify that all queries must use the same transaction and that claims are only set after verification (verification itself is 002).
- Risk: dual migration tooling (Supabase CLI and drizzle-kit) causes drift; ADR must fix a single source of truth.
- Risk: with no branches, hooks or PRs, bad commits reach the trunk and deploy; accepted by the PO, partially mitigated by deploy-after-CI.
- Risk: library choices made for a ~50-table app before any feature exists could prove wrong; mitigated by ADRs, but the PO owns this trade-off.
- Assumption: type generation with no tables produces little output; the pipeline, not the content, is what is accepted in 001.
