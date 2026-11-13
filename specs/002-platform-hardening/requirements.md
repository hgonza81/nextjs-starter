# 002 — Platform hardening: requirements

Stage: **1. Requirements** (awaiting Product Owner approval).
Depends on: 001-foundations. Next epic: 003-auth-memberships.
IDs: `PH-HR-NN` (high-level requirements). Unknowns are marked `OPEN`.

## 1. Goal

Finish the technical foundations that every module will need, so that from epic 003 onward the work is only about the module itself: errors, logging and tracing, security headers, database conventions and a module template. Nothing in this epic needs a cloud service.

## 2. Scope

### In scope
- Error handling: an error page for unexpected failures, a not-found page, and server-side error capture.
- Structured logging and OpenTelemetry, with a local collector to inspect traces and logs in development.
- Security headers and basic hardening of the Next.js configuration.
- Database conventions and a pagination helper for the future CRUD modules.
- A module template and a reusable server action wrapper.

### Out of scope (explicitly, for later: parking lot)
- Cloud Supabase project, pooler, running migrations from CD, preview or staging environments.
- A production destination for traces and logs (Grafana Cloud, Sentry, Datadog, etc.). There is no production yet.
- Email sending, background jobs, file storage, feature flags (added when a module needs them).
- Rate limiting (decided in 003, where login uses it).
- CodeQL and license scanning, date/currency utilities, basic SEO metadata.
- Authentication, users, tenants, memberships (epic 003).
- Table and Dialog components (added by the first epic that needs them).

## 3. High-level requirements

| ID | Requirement |
|----|-------------|
| PH-HR-01 | **Error pages.** An unexpected error in a page or layout shows a simple 500 page with a short friendly message and a reference code, instead of the framework default. A `not-found` page handles 404. The page never shows internal details. |
| PH-HR-02 | **Server-side error capture.** Every unhandled server error (pages, server actions, route handlers) is logged with the reference code shown to the user, through the Next.js `onRequestError` hook. |
| PH-HR-03 | **Typed application errors.** A small set of application error types (validation, not found, forbidden, conflict, unexpected) and a typed result for server actions that the UI can render consistently. Database errors such as a duplicate key or an RLS violation are translated to these types. |
| PH-HR-04 | **Structured logging.** One logging helper writes structured JSON logs without personal data (convention C8 of `docs/architecture.md`), carries the trace and request identifiers, and replaces the current ad hoc `console.error` calls. |
| PH-HR-05 | **OpenTelemetry installed.** Traces, metrics and logs are emitted through OpenTelemetry. Where they go is set only by environment variables. With no destination configured, the app runs normally and logs to the console. |
| PH-HR-06 | **Local collector.** An optional local observability stack in Docker (candidates: Grafana LGTM or Jaeger) lets a developer see traces and logs from `pnpm dev`, started and stopped with documented commands. It is not required to run the app or the tests. `OPEN`: exact stack. |
| PH-HR-07 | **Security headers and hardening.** Security headers are set on responses (content security policy, HSTS, frame ancestors, content-type options, referrer policy, permissions policy), `X-Powered-By` is removed, cross-origin access is closed by default and Server Action body size is limited. `OPEN`: strictness of the content security policy given Tailwind, shadcn and Next.js. |
| PH-HR-08 | **Database conventions.** Documented and enforced conventions for migrations and tables: id type, `created_at` and `updated_at` (with a reusable trigger), naming, soft delete or not, audit columns. `OPEN`: each decision (ADR). |
| PH-HR-09 | **Pagination and filtering helper.** A server-side helper for paginated, sorted and filtered list queries, usable by any module and consistent with the table pattern in `docs/design-system.md`. `OPEN`: offset or keyset pagination. |
| PH-HR-10 | **Server action wrapper.** A reusable wrapper combines input validation (Zod), error handling (PH-HR-03) and logging (PH-HR-04) in one place so modules do not repeat them. |
| PH-HR-11 | **Module template.** A command that creates a new module folder with the agreed structure and public API (`pnpm gen:module <name>`), with the lint boundary rules still applying. It adds no sample business feature. |
| PH-HR-12 | **Same quality bar as 001.** Each piece has automated tests where behavior can be tested, the new decisions are recorded as ADRs where hard to reverse, `docs/architecture.md` is updated, and the CI gates stay green. Nothing beyond what is stated here is added. |

## 4. Screens

Only one: the 500 error page (and the 404 page). They use the existing design system and need wireframes in `wireframes.md`; there is no other UI in this epic.

## 5. Open questions (to be refined)

- Local collector stack (PH-HR-06).
- Content security policy strictness (PH-HR-07).
- Database convention decisions (PH-HR-08) and pagination style (PH-HR-09).
- Whether the module template should also generate test files.
