# 001 — Foundations: questions for the Product Owner

Consolidated from the round 1 reviews (`reviews/`), regenerated after the reviews were redone. Duplicates merged; ordered by impact. Each question has a recommendation. Where agents disagreed, the disagreement is stated.

How to answer: write your choice after `Answer:` (e.g. "A", "accept recommendation", or your own text).

Sources: A = architect, D = developer, U = ui-ux-designer, T = tester, P = product-manager.

---

## Product Owner answers (recorded 2026-11-12)

The Product Owner accepted all recommendations below **except** the following, which override the recommended option:

- **Q4 (database approach): ORM is IN, not out.** The app is expected to be an MVP with ~50 tables and full CRUD, so install and set up all database-related libraries now: **Drizzle ORM** (+ drizzle-kit), `supabase-js`, `@supabase/ssr`, generated types and models. Stack: Next.js (frontend + backend), Supabase Auth, Drizzle for PostgreSQL access, PostgreSQL RLS for tenant isolation. Tenant isolation approach chosen by the PO: **ORM + RLS** — one centralized function runs every query inside a transaction in the user's security context (`SET LOCAL ROLE authenticated` plus `request.jwt.claims` set per transaction, only after the JWT and tenant are verified). Details (queries must use that same transaction, role grants, policies checking real membership) are for the architect to settle in an ADR. This reverses the earlier "no ORM" recommendation and goes beyond the original FND-HR-11 minimalism; it is a PO decision.
- **Q5 (CI/CD): deployment IS included.** GitHub Actions for CI **and** deployment to **Vercel**, plus a very simple "hello world" test so the pipeline is proven. The PO will decide when to push to GitHub; creating the GitHub repo is **not** a task. Workflows live in the repo.
- **Q6 (git workflow): no branches, no PRs, no hooks, no commitlint.** The PO works alone and commits to a single branch; the only requirement is that **the workflows run on every commit/push**, and the PO fixes failures afterwards. The pnpm / pinned versions part of Q6 is accepted.
- **Q13: Stripe is dropped.** FND-HR-11 no longer mentions billing; "keep it minimal" is superseded by the ORM decision above where they conflict.
- **Process:** the PO chose a **full second review round** before the spec.

---

## Hard-to-reverse decisions (will become ADRs)

### Q1. Code layering for a large app (A1, D, P5)
- A) **Domain modules** in `src/modules/*` with a public API (`index.ts`) and small files inside (actions, queries, schemas, components). No repository layer. Module folders `auth/users/tenants` are created in epic 002; 001 only defines the layout and conventions.
- B) Top-level technical layers (`services/`, `repositories/`, `models/`).
- C) Domain modules, each with internal services and repositories.
- **Recommendation: A.** Supabase + RLS already is the data-access and authorization layer; extra layers add boilerplate. Can evolve to C per module later.
- Answer:

### Q2. Enforce the structure automatically? (A6, D, T, P5)
- A) **Conventions doc + 2–3 lint rules that fail CI** (modules only via `index.ts`, `lib` cannot import `modules`, no import cycles), proven by a test that an illegal import is reported.
- B) Conventions doc and code review only.
- C) Full layered scaffold with example code.
- **Recommendation: A.** Unenforced rules erode in a large app; C builds code that does not exist yet.
- Answer:

### Q3. Local development topology, Docker, cloud (A2, A3, D2, P1)
- A) **Supabase local via CLI (Docker) + Next.js app on your machine. No cloud Supabase project yet.** Docker is a documented prerequisite (Docker Desktop, OrbStack or Colima).
- B) Everything in Docker Compose, including the app.
- C) Local plus a cloud project (staging/production) now.
- D) Cloud only.
- **Recommendation: A.** Fastest hot reload; disposable, resettable DB; the same flow runs in CI and is required for the RLS tests in 002.
- Answer:

### Q4. Database approach and Supabase wiring in this epic (A4, D7, P3, P4)
- A) **SQL migrations (Supabase CLI) + `supabase-js` + generated types, no ORM. In 001: base client factory, typed/validated env (`src/lib/env.ts`, `.env.example`) and a `/api/health` route proving the app reaches the local DB (no tables). Auth-aware SSR/cookie clients (`@supabase/ssr`) are created in 002.**
- B) Install libraries and generate types only; no clients, no health check.
- C) Also create the browser/server/middleware SSR clients now, unused until 002.
- D) Add an ORM (Drizzle/Prisma).
- **Recommendation: A.** Makes "wired" verifiable, fixes the single place clients are created, and keeps auth in 002. Agents split between A/B/C on how much to wire; all accept A. ORM is a hard-to-reverse dependency with no MVP need.
- Answer:

### Q5. CI platform and deployment (A5, D4, T2, P1)
- A) **GitHub Actions, CI only** (lint, typecheck, tests, build, security). No deployment now.
- B) A + preview/production deployment now (e.g. Vercel + Supabase cloud).
- C) Another platform, or local scripts only.
- **Recommendation: A.** Nothing to deploy yet; hosting choice is cheap to defer.
- **Blocker to confirm: the project is not a git repository yet. Will it be hosted on GitHub?**
- Answer:

---

## Tooling decisions

### Q6. Package manager, versions, git workflow (A, D1, D6)
- A) **pnpm, current stable Next.js, active-LTS Node, all pinned** (`packageManager`, `.nvmrc`/`engines`, lockfile). **Trunk-based git: short-lived branches + PRs, Conventional Commits.**
- B) npm (+ same git workflow). C) Git Flow.
- **Recommendation: A.**
- Answer:

### Q7. Lint/format, validation, forms, commit hooks (D3, D6)
- Lint/format: A) **ESLint + Prettier** / B) Biome. **Recommendation: A** (mature boundary-rule plugins).
- Validation: **Zod** (types inferred, schemas shared client/server).
- Forms: A) **React Hook Form + Zod resolver**, same schema reused in Server Actions / B) native `<form action>` + `useActionState` + Zod / C) decide in 002. **Recommendation: A.** Disagreement noted: the earlier draft favored B, but AUTH-FR-02 requires per-field errors and no request when client validation fails, which B handles worse.
- Commit hooks (Husky/lefthook + commitlint): A) **none; convention documented and checked in CI/review** / B) hooks now. **Recommendation: A** (less setup friction).
- Answer:

### Q8. Testing tools and what must exist at the end (D, T, P)
- Tools: **Vitest** (unit/integration) + **Playwright** (E2E) + `@axe-core/playwright` + Testing Library only where needed.
- Content: **one real passing smoke test per layer**: unit; integration/DB harness against local Supabase (anon, authenticated, service role; no app tables needed); E2E of the home page with axe check. Separate commands (`test`, `test:db`, `test:e2e`) so the fast one needs no Docker.
- RLS tests: A) **Vitest through the client** (revisit pgTAP later if policies get complex) / B) pgTAP only. **Recommendation: A.**
- Coverage: A) **report only, no threshold** / B) minimum threshold (e.g. 80%). **Recommendation: A.**
- Alternatives: Jest instead of Vitest; tooling without sample tests.
- Answer:

### Q9. Which CI checks block a merge (T1, D5, P6, A5) — agents disagree on dependency audit
- A) **Block: lint, typecheck, unit + integration, E2E smoke, build, secret scan (Gitleaks) and dependency audit (fail on high/critical, documented allowlist). Dependabot for updates; CodeQL non-blocking.** (tester)
- B) Block: lint, typecheck, tests, build, secret scan; dependency audit informational only. (developer, product-manager)
- C) Everything advisory at first.
- **Recommendation: B.** A leaked secret is never acceptable; audit findings are often unfixable noise outside our control and would block unrelated work. Gates are proven once to fail on bad input (lint error, type error, failing test, dummy secret).
- Answer:

---

## Frontend and design system

### Q10. UI stack and visual starting point (U1, U2, D1)
- A) **Tailwind CSS + shadcn/ui (Radix), Lucide icons, one `next/font` font; start from shadcn defaults with a neutral theme and one primary color. No purchased template.**
- B) Packaged library (MUI, Mantine, Chakra).
- C) Tailwind only, hand-built components.
- D) A paid/free SaaS template you already have.
- **Recommendation: A.** Accessible by default, token-driven, code owned in the repo. All agents converged.
- Answer:

### Q11. How much design system in this epic? (U, D8, P2)
- A) **Tokens (semantic colors, type, spacing, radius, motion, breakpoints; light/dark) + only the components epic 002 needs (Button, Input, Label, FormField with error, Password input, Alert, Card, Spinner, auth layout, app shell) + a tone guide in `docs/design-system.md`.**
- B) A + a living `/design` showcase page (the visible acceptance artifact for "beautiful and consistent").
- C) A fuller kit (tables, dialogs, toasts, navigation) now.
- D) Only pick the library and theme; no custom system yet.
- E) A + Storybook.
- **Recommendation: B.** Bounded by 002's needs; the showcase page is cheap and makes the design system checkable. Rule: no raw colors/spacing, add to the system first.
- Answer:

### Q12. Look and feel (U3, U4, U5)
- Dark mode: A) light only / B) **light + dark following the system setting, no toggle yet** / C) with a manual toggle. **Recommendation: B** (the toggle needs UI and persistence; add later).
- Brand: do you have a brand color, logo, product name? **Recommendation:** neutral default with one placeholder accent (calm blue/indigo), text-only wordmark, changeable in one place; friendly and concise copy tone.
- Accessibility/responsive: A) **WCAG 2.2 AA and mobile-first built into the base components now, automated axe check in E2E** / B) only verified per screen in 002. **Recommendation: A.**
- Language: English only, no i18n tooling (per AGENTS.md).
- Answer:

---

## Acceptance

### Q13. What does "foundations is done" mean? (P1, P7, D, T)
- A) **On a clean machine, following the README, within ~15 minutes: the app runs and shows the styled home page, local Supabase runs, `/api/health` reaches the DB, all three test layers pass locally and in CI, CI gates run on every PR, structure doc + boundary rule exist, ADRs recorded.**
- B) Lighter: app runs, DB runs, CI green; no onboarding-time check.
- C) Your own definition.
- **Recommendation: A.** Observable; proves the README works for the next developer.
- Also confirm: **FND-HR-11 (Stripe)** is reduced to a constraint, "no choice now that would require rework to add Stripe later; no Stripe code, packages or tables", and **FND-HR-09** is split into CI (this epic) and CD (deferred). **Recommendation: yes to both.**
- Answer:

---

## Shortcut

If you agree with all recommendations, write here: `Accept all recommendations` (plus any exceptions, and the GitHub answer in Q5).

Answer: Accept all recommendations, with the exceptions listed in "Product Owner answers" above (Q4 ORM in, Q5 deployment to Vercel, Q6 no branches/hooks, Q13 no Stripe).

---

## Round 2 confirmations (Product Owner, 2026-11-12)

The Product Owner answered "yes to all" to the following defaults proposed after the second review:

- The deploy job runs only after all blocking CI jobs pass; Vercel's own Git auto-deploy is disabled, only GitHub Actions deploys; only `VERCEL_*` secrets go to GitHub; the PO creates the Vercel project, token and secrets.
- The deployed hello-world test checks liveness only and does not touch a database (there is no cloud Supabase project). `/api/health/db` is separate and local-only.
- Migrations are SQL-first in the Supabase CLI folder; the Drizzle schema is generated from the database (`drizzle-kit pull`) with a CI drift check (architect's proposal, to be finalized in ADR 0002).
- The design system stays bounded (CRUD patterns documented only; Table, Dialog, Select etc. added by the first epic that needs them); `/design` is hidden in production.
- Next step: spec.md (product-manager) and ADRs 0001–0005 (architect). The PO then reviews and approves the spec before tasks are created.
