# 001 — Foundations: high-level requirements

Stage: **1. High-level requirements** (as given by the client; not yet reviewed).
Next: review round by all agents.

Items marked `OPEN` are not decided. They are intentionally left for the review round and the client's answers.

## Goal

Have a working, basic **Next.js** application skeleton and a local database in place, with the tooling, libraries, and development workflow chosen deliberately, so that feature epics can start on a solid base.

## High-level requirements

| ID | Requirement | Type | Notes |
|----|-------------|------|-------|
| FND-HR-01 | A basic **Next.js** web application with a minimal skeleton: **no users, no tenants, no memberships, no business features**. | Functional | |
| FND-HR-02 | A **database** using **Supabase** (Postgres), with the Supabase **CLI** set up for local development. | Functional | No tables yet. Authentication is **not** part of this epic (it belongs to epic 002). Local vs cloud: `OPEN`. |
| FND-HR-03 | Install and wire the **client library/libraries** needed to talk to the database from the application. | Functional | Which libraries and how they are organized: `OPEN`. |
| FND-HR-04 | Choose the **frontend stack**: UI library, styling approach, and design template/starting point. | Functional | **No choices are made yet.** Options and recommendations come out of the review round. `OPEN` |
| FND-HR-05 | Define a **design system** so the application is beautiful and consistent from the start. | Functional | Scope, tokens, and base components: `OPEN`. |
| FND-HR-06 | Choose and set up the remaining **libraries and tools** (validation, forms, linting/formatting, package manager, etc.). | Functional | `OPEN` |
| FND-HR-07 | Set up **Docker** for the local development environment as needed (e.g. for local Supabase). | Functional | What runs in Docker, and whether the app itself does: `OPEN`. |
| FND-HR-08 | Set up **automated testing tooling** (unit, integration, end-to-end) from the start. | Non-functional | Tools and test strategy: `OPEN`. |
| FND-HR-09 | Set up **CI/CD** and the **development workflow** with automated checks: lint, typecheck, tests, build, and **security checks** (e.g. dependency and secret scanning). | Non-functional | Platform, which checks run when, branching and commit conventions, and whether CD/deployment is included now: `OPEN`. |
| FND-HR-10 | The code is **modular**, readable, maintainable, and testable. The application will grow into a **large** one, so the structure must stay clear: responsibilities clearly separated (e.g. UI, business logic/services, data access/repositories, models/types, validation), with **no huge folders full of code**. | Non-functional | Next.js itself only prescribes routing (`app/`); the rest of the organization is our choice. Folder structure, layering (services/repositories/models or alternatives), module boundaries, naming conventions, and how they are enforced (e.g. lint rules): `OPEN`, for the architect and developer to propose in the review round. |
| FND-HR-11 | Keep it **minimal**: only what is needed, nothing speculative. Billing (Stripe) must be easy to add later. | Non-functional | |

## Out of scope for this epic

- Authentication, and any user, tenant, membership, sign-up, or login functionality (epic 002).
- Any database tables.
- Billing and email sending.

## Open questions for the client (before the review round)

None at this stage. Everything marked `OPEN` is left on purpose for the review round.
