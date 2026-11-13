# 002 — Platform hardening: flows

Stage: **2. Product refinement** (awaiting Product Owner approval).
Source: [requirements.md](requirements.md) (`PH-HR-NN`). Flow IDs: `PH-FL-NN`. Acceptance criteria IDs: `PH-AC-NN`.
Nothing here goes beyond the requirements; new ideas are in section 7.

## 1. Actors and goal

| Actor | Role in this epic |
|-------|-------------------|
| **End user** | Sees the 500, global error and 404 pages. The only actor with UI. |
| **Developer** | Writes modules from epic 003 on: uses the action wrapper, logger, pagination helper, module generator and database conventions; runs `pnpm dev` and optionally the local collector. |
| **Operator (developer in another role)** | Configures telemetry destinations through environment variables. |

Goal: after this epic every later module can be built without touching error handling, logging, telemetry, security headers, database conventions or folder structure again.

## 2. Flows

### PH-FL-01 Unexpected error in a page or layout (PH-HR-01, PH-HR-02)
1. A user opens a page; rendering a page or a nested layout throws.
2. The 500 page replaces the failed segment: friendly message plus a reference code (page chrome of the root layout stays).
3. The same reference code is written to the server log (PH-FL-04).
4. The user may retry (re-render the segment) or go to the home page (see Q4).
- Alt: the retry succeeds, the normal page shows and the error page disappears.
- Alt: the retry fails again, the 500 page shows again (a new or the same code; both acceptable if logged).
- Error: the failure happens in the **root layout**: PH-FL-02.
- Rule: no stack trace, message, SQL, path or env detail is ever shown (also in production builds; in development the Next.js dev overlay is out of our control).

### PH-FL-02 Failure in the root layout (PH-HR-01)
1. The root layout itself throws, so the normal 500 page cannot render.
2. The global error page renders a minimal, self-contained page (its own `html`/`body`) with the same message and reference code.
3. Server log carries the code (PH-FL-04).

### PH-FL-03 Page not found (PH-HR-01)
1. A user opens an unknown URL, or a page calls `notFound()`.
2. The 404 page shows a short message and a way back home. HTTP status is 404.
- Alt: a gated route (for example `/design*` when `DESIGN_PAGE_ENABLED` is off) shows the same 404 page.
- No reference code on 404 (it is not an error to investigate).

### PH-FL-04 Server-side error capture (PH-HR-02)
1. An unhandled error occurs in a page render, a server action or a route handler.
2. The `onRequestError` hook receives it and writes one structured log entry (PH-FL-06) with: event name, error class/code, route and kind, and the **same reference code** the user saw (when a page was shown).
3. For a route handler or action the response body contains only a generic message and the code, never internals.
- Alt: errors the application **handles** (typed errors, PH-FL-05) are not "unhandled": they are returned to the caller and logged at a lower level by the wrapper, not by this hook.
- Error: the logger itself fails; the request is not affected further (the user still gets the error page).

### PH-FL-05 Server action with the wrapper (PH-HR-03, PH-HR-10)
1. A developer writes an action by passing a Zod schema and a handler to the wrapper.
2. At runtime the wrapper parses the input; on success it runs the handler and returns `{ ok: true, data }`.
3. The UI renders `{ ok: false, error }` consistently (error type, message, field errors when validation).
- Alt, validation: input fails the schema, the handler does not run, result is `validation` error with per-field messages.
- Alt, domain errors: the handler returns or throws `not found`, `forbidden` or `conflict`; the wrapper converts them into the typed result.
- Alt, database errors: a unique violation becomes `conflict`; an RLS or permission violation becomes `forbidden`; a missing row is `not found`.
- Error, unknown: any other exception becomes `unexpected` with a reference code; the user sees a generic message; the wrapper logs it (PH-FL-06). Expected failures are never thrown to the user.

### PH-FL-06 Structured logging (PH-HR-04)
1. Code calls the single logging helper with an event name and allowed fields.
2. One JSON line is written with level, timestamp, event, fields, trace id and request id (when a request/trace exists).
- Alt: called outside a request (startup, scripts): trace and request ids are omitted, no error.
- Error/guard: a caller passes a forbidden field (email, token, password, body, connection string): it is not written (see rule BR-04).
- The existing ad hoc `console.error` calls (for example in `src/app/api/health/db/route.ts`) go through the helper.

### PH-FL-07 Telemetry destination by environment (PH-HR-05)
1. Operator sets OpenTelemetry environment variables (endpoint, protocol, service name); the app starts.
2. Traces, metrics and logs are exported to that destination.
- Alt, no variables: the app starts and runs normally; logs go to the console; nothing is exported and no error is shown.
- Error: destination configured but unreachable: the app keeps serving requests and does not crash or slow down noticeably; export failure is not shown to users.
- Error: an invalid telemetry variable value: fails at startup with a message naming the variable (same behavior as other env variables in ADR 0004).

### PH-FL-08 Local collector (PH-HR-06)
1. Developer runs a documented command to start the collector stack in Docker.
2. Developer runs `pnpm dev` with the documented environment variables, uses the app, and opens the collector UI to see traces and logs for those requests.
3. Developer runs a documented command to stop it.
- Alt: collector not running: app, tests and CI behave exactly as without it (PH-FL-07 no destination or unreachable).
- Alt: Docker not installed: only this optional flow is unavailable.

### PH-FL-09 Security headers and hardening (PH-HR-07)
1. Any page or route response includes the security headers (CSP, HSTS, frame ancestors, content-type options, referrer policy, permissions policy).
2. `X-Powered-By` is absent.
3. A cross-origin request to the app is refused by default (no permissive CORS headers).
4. A Server Action request with a body above the limit is rejected.
- Alt: a script or style that the policy does not allow is blocked by the browser; the app's own pages, Tailwind styles, shadcn components and Next.js scripts still work.
- Alt: development mode: policy may allow what the dev server needs (hot reload) but production responses carry the strict policy (Q2).

### PH-FL-10 Database convention applied to a new table (PH-HR-08)
1. A developer creates a migration for a new table following the documented conventions (id type, naming, `created_at`/`updated_at`, audit columns, delete policy).
2. The reusable trigger keeps `updated_at` current on update.
3. Automated checks fail the build if a table breaks an enforced convention (for example missing `created_at`/`updated_at` or trigger).
- Alt: a table that must legitimately deviate: the exception is explicit and documented, not silent.
- Error: a convention violation is reported by test or check with a message naming the table and the rule.

### PH-FL-11 Paginated, sorted and filtered list (PH-HR-09)
1. A module query passes page parameters, sort and filters to the helper.
2. The helper validates them, runs the query inside the caller's `withRls` transaction, and returns the rows for the page plus the information the table needs (total or next-page marker, per Q5).
- Alt, defaults: missing parameters use documented defaults (first page, default page size, default sort).
- Alt, empty result: returns an empty page, not an error.
- Error: invalid page, page size over the maximum, unknown sort field or filter field: rejected as a `validation` error (PH-FL-05); never passed to SQL.
- Error: page beyond the last page returns an empty page.

### PH-FL-12 Generate a module (PH-HR-11)
1. Developer runs `pnpm gen:module <name>`.
2. The command creates `src/modules/<name>/` with the agreed structure and a public `index.ts`, no business feature.
3. `pnpm lint` and `pnpm typecheck` pass on the result, and the boundary lint rules apply to the new folder.
- Error: name not kebab-case, empty, or already existing: the command stops with a clear message and changes nothing.
- Error: the folder exists: it is never overwritten.

## 3. User stories

| Flow | Story |
|------|-------|
| PH-FL-01 | As an end user, I want a friendly error page with a reference code when something breaks, so that I can report it without seeing technical details. |
| PH-FL-02 | As an end user, I want an error page even when the whole layout fails, so that I am never left with a blank or framework-default screen. |
| PH-FL-03 | As an end user, I want a clear "page not found" page, so that I know the address is wrong and can go back. |
| PH-FL-04 | As a developer, I want every unhandled server error logged with the code the user saw, so that I can find the cause from a user report. |
| PH-FL-05 | As a developer, I want one wrapper that validates, handles errors and logs, so that I do not repeat it in each action. |
| PH-FL-05 | As an end user, I want errors from forms shown consistently, so that I understand what to fix. |
| PH-FL-06 | As a developer, I want one structured, PII-free log helper, so that logs are searchable and safe. |
| PH-FL-07 | As an operator, I want telemetry destinations set only by environment variables, so that I can change them without code changes. |
| PH-FL-08 | As a developer, I want to see traces and logs locally with one command, so that I can debug requests. |
| PH-FL-09 | As an operator, I want standard security headers and hardened config by default, so that the app is safe from day one. |
| PH-FL-10 | As a developer, I want enforced database conventions and a reusable trigger, so that every table is consistent. |
| PH-FL-11 | As a developer, I want a pagination/sort/filter helper, so that every list module behaves the same. |
| PH-FL-12 | As a developer, I want `pnpm gen:module <name>`, so that each module starts with the agreed structure. |

## 4. Business rules (observable behavior)

| ID | Rule | HR |
|----|------|----|
| BR-01 | Error pages never display messages, stack traces, SQL, file paths, env names or connection strings. | 01 |
| BR-02 | The reference code on screen equals the code in the server log entry for that failure. It is non-guessable-free of personal data (contains no user data). | 01, 02 |
| BR-03 | The 404 page returns HTTP 404; error pages return HTTP 500 (or the Next.js error status). | 01 |
| BR-04 | Log entries never contain secrets, tokens, passwords, emails, request bodies, connection strings or full error objects (C8). Only event, error class/code, ids. | 04 |
| BR-05 | Every log entry is one JSON object and includes trace id and request id when available. | 04 |
| BR-06 | Application error types are exactly: validation, not found, forbidden, conflict, unexpected. | 03 |
| BR-07 | Expected failures are returned as `{ ok: false, error }`; they are not thrown to the user. Unknown exceptions become `unexpected`. | 03, 10 |
| BR-08 | Database errors map: duplicate key to conflict, RLS/permission violation to forbidden; others to unexpected (not found when no row where one is required). | 03 |
| BR-09 | With no OpenTelemetry destination variable set, the app runs normally and logs to the console. | 05 |
| BR-10 | A telemetry export failure never breaks or blocks a user request. | 05 |
| BR-11 | The local collector is optional: not needed by `pnpm dev`, tests, CI or build. | 06 |
| BR-12 | `X-Powered-By` is absent; the listed security headers are present on responses; cross-origin access is closed unless explicitly opened; Server Action body size has a documented limit. | 07 |
| BR-13 | Each convention in PH-HR-08 is documented, and recorded in an ADR when hard to reverse; enforced conventions are checked automatically. | 08 |
| BR-14 | List requests use a default page size and a maximum page size; sort and filter fields are an allow-list; invalid input returns `validation`. | 09 |
| BR-15 | The wrapper runs: parse input, handler, error mapping, logging, in that order, and the handler never runs on invalid input. | 10 |
| BR-16 | `gen:module` creates only structure and public API; it adds no sample business feature and never overwrites an existing folder. | 11 |

## 5. Screen and state inventory

All screens use the existing design system (`docs/design-system.md`); no new component is assumed. No loading state: they render statically.

| Screen | Serves | States |
|--------|--------|--------|
| **500 error page** (segment-level) | PH-FL-01 (HR-01) | default (message + reference code + actions); retry in progress; retry failed (shows again); reference code unavailable (code line omitted or fallback text, Q6); narrow/mobile and light/dark themes; no-permission: n/a |
| **Global error page** (root layout failure) | PH-FL-02 (HR-01) | default (self-contained, minimal styling because the root layout, tokens included, may be unavailable); reference code unavailable; light/dark follows browser preference |
| **404 page** | PH-FL-03 (HR-01) | default (message + link home); reached from unknown URL; reached from `notFound()`; reached from a gated route; no code shown |

## 6. Acceptance criteria (Given / When / Then)

**PH-HR-01 Error pages**
- PH-AC-01: Given a page whose render throws, When a user opens it, Then the 500 page shows a friendly message and a reference code, and no error message, stack trace or internal detail appears.
- PH-AC-02: Given a 500 page, When the user activates retry and the cause is fixed, Then the page renders normally; and When the cause persists, Then the 500 page shows again.
- PH-AC-03: Given the root layout throws, When a user opens any page, Then the global error page shows the same message and a reference code.
- PH-AC-04: Given an unknown URL, When a user opens it, Then the 404 page shows and the HTTP status is 404.
- PH-AC-05: Given `DESIGN_PAGE_ENABLED` is off, When a user opens `/design`, Then the same 404 page shows.
- PH-AC-06: Given the production build, When a failure occurs with a message containing a secret-like string, Then that string is not in the response HTML.
- PH-AC-07: Given the error pages, When checked with axe in light and dark themes, Then no violations are reported, the reference code is selectable text, and keyboard users can reach every action.

**PH-HR-02 Server-side error capture**
- PH-AC-08: Given a page failure, When the 500 page shows code X, Then exactly one server log entry contains code X.
- PH-AC-09: Given a server action throws an unexpected error, When it is called, Then the hook logs the error with a code and the caller gets a generic message with that code.
- PH-AC-10: Given a route handler throws, When it is called, Then the response is a generic error body with the code and no internals, and one log entry exists.
- PH-AC-11: Given an error with PII in its message, When logged by the hook, Then the entry holds only error class/code and ids (BR-04).

**PH-HR-03 Typed errors**
- PH-AC-12: Given the five error types, When any is created, Then it serializes to the typed result with type, safe message and optional field errors.
- PH-AC-13: Given a unique-key violation from the database, When translated, Then the result is `conflict`.
- PH-AC-14: Given an RLS or permission violation, When translated, Then the result is `forbidden`.
- PH-AC-15: Given an unrecognized database error, When translated, Then the result is `unexpected` with no database message exposed.

**PH-HR-04 Structured logging**
- PH-AC-16: Given a log call, When it runs inside a traced request, Then the output is one JSON line with trace id and request id.
- PH-AC-17: Given a log call outside a request, When it runs, Then it writes valid JSON without ids and does not throw.
- PH-AC-18: Given a call with a forbidden field (email, token, password, body, connection string), When it runs, Then that value is absent from the output.
- PH-AC-19: Given the codebase, When searched, Then no ad hoc `console.error` remains in `src` outside the logging helper.

**PH-HR-05 OpenTelemetry**
- PH-AC-20: Given no OpenTelemetry variables, When the app starts and serves a page, Then it works and logs appear in the console.
- PH-AC-21: Given a destination variable pointing at a test receiver, When a request is served, Then the receiver gets a trace for it.
- PH-AC-22: Given a destination that is unreachable, When requests are served, Then responses succeed and the app does not crash.
- PH-AC-23: Given an invalid telemetry variable value, When the app starts, Then startup fails with a message naming the variable.

**PH-HR-06 Local collector**
- PH-AC-24: Given Docker, When the documented start command runs and `pnpm dev` is used with the documented variables, Then a request's trace and log are visible in the collector UI.
- PH-AC-25: Given the collector is not running, When `pnpm dev`, `pnpm test` and `pnpm build` run, Then all pass as before.
- PH-AC-26: Given a running collector, When the documented stop command runs, Then its containers are removed or stopped.

**PH-HR-07 Security headers**
- PH-AC-27: Given a production build, When any page is requested, Then the response has the headers CSP, HSTS, frame ancestors protection, `X-Content-Type-Options`, referrer policy and permissions policy.
- PH-AC-28: Given any response, Then `X-Powered-By` is absent.
- PH-AC-29: Given a request with a foreign `Origin` header, When it hits a page or route, Then no `Access-Control-Allow-*` header permits it.
- PH-AC-30: Given a Server Action body over the documented limit, When submitted, Then it is rejected.
- PH-AC-31: Given the CSP, When the home page and `/design` load in a real browser (E2E), Then there are no CSP violations and styles and scripts work.
- PH-AC-32: Given a page that tries to load a script from an unlisted origin, Then the browser blocks it (policy proves enforcing).

**PH-HR-08 Database conventions**
- PH-AC-33: Given the conventions document and ADR(s), Then each decision (id type, timestamps, naming, delete policy, audit columns) is stated with its reason.
- PH-AC-34: Given a test table with the reusable trigger, When a row is updated, Then `updated_at` changes and `created_at` does not.
- PH-AC-35: Given a table in `public` that violates an enforced convention, When the database test suite runs, Then it fails naming the table and rule.
- PH-AC-36: Given `supabase db reset` and the drift check, Then both still pass.

**PH-HR-09 Pagination**
- PH-AC-37: Given N rows, When page 2 with size S is requested, Then the correct rows are returned in the requested order.
- PH-AC-38: Given a filter and a sort on allowed fields, When requested, Then results match and the order is stable for equal values.
- PH-AC-39: Given no parameters, Then the documented defaults apply.
- PH-AC-40: Given page size above the maximum, an unknown sort or filter field, or a negative page, Then a `validation` error is returned and no query runs.
- PH-AC-41: Given a page beyond the last, or no matching rows, Then an empty page is returned.
- PH-AC-42: Given RLS on the table, When the helper lists rows as two different users, Then each sees only their own rows (it runs in `withRls`).
- PH-AC-43: Given a hostile filter value (SQL-looking text), Then it is treated as data.

**PH-HR-10 Action wrapper**
- PH-AC-44: Given invalid input, When the wrapped action is called, Then the handler is not called and a `validation` error with field messages is returned.
- PH-AC-45: Given valid input and a successful handler, Then `{ ok: true, data }` is returned.
- PH-AC-46: Given the handler raises not found, forbidden or conflict, Then the matching typed result is returned.
- PH-AC-47: Given the handler throws an unknown error, Then `unexpected` with a reference code is returned and one structured log entry is written without PII.
- PH-AC-48: Given the wrapper's output, Then the UI helper or component renders all five error types consistently (as far as the epic ships a rendering convention; see Q7).

**PH-HR-11 Module template**
- PH-AC-49: Given a free name, When `pnpm gen:module billing` runs, Then `src/modules/billing/` exists with the agreed structure and `index.ts`, and lint and typecheck pass.
- PH-AC-50: Given the generated module, When another folder imports its internals by deep path, Then lint reports it (boundary rules apply).
- PH-AC-51: Given an existing module name, When the command runs, Then it fails with a message and changes no file.
- PH-AC-52: Given an invalid name (empty, uppercase, spaces, path characters), Then it fails with a message and creates nothing.
- PH-AC-53: Given the generated files, Then they contain no sample business feature.

**PH-HR-12 Quality bar**
- PH-AC-54: Given the epic is done, When CI runs, Then `fast`, `database-and-e2e` and `secret-scan` are green.
- PH-AC-55: Given each requirement PH-HR-01 to 11, Then it has at least one automated test where behavior is testable, and where not (collector commands, docs) a documented manual check.
- PH-AC-56: Given hard-to-reverse decisions (database conventions, CSP policy, telemetry approach), Then each has an ADR and `docs/architecture.md` lists them and the new conventions.
- PH-AC-57: Given the final diff, Then it contains nothing outside the requirements (no auth, rate limiting, email, jobs, cloud config).

## 7. Open questions

| # | Question | Kind | Options | Recommendation |
|---|----------|------|---------|----------------|
| Q1 | Local collector stack (HR-06) | default | A Grafana LGTM (traces, logs and metrics in one container); B Jaeger (traces only, logs separate) | **A**: the requirement says traces and logs; one container, one UI. Easy to swap, it is optional. |
| Q2 | CSP strictness (HR-07) | default | A strict nonce-based CSP in production, relaxed for dev only; B looser policy allowing inline scripts and styles everywhere | **A**, proved by E2E (PH-AC-31). If it breaks Next/Tailwind/shadcn in practice, the architect relaxes the minimum needed and records it in the ADR. Headers can be reverted in one config file. |
| Q3 | Database conventions (HR-08): soft delete and audit columns | **blocking** | Soft delete: A none (hard delete), B `deleted_at` on every table, C per table when needed. Audit: A only `created_at`/`updated_at`, B plus `created_by`/`updated_by` | **Soft delete A, audit A.** Smallest, simplest; adds no UI or query cost; B and C are product decisions about data recovery and traceability that are hard to retrofit. The id type, naming and trigger are technical: the architect proposes them in an ADR in review round 1 (recommend one id type, `snake_case` plural names), and the Product Owner confirms the ADR, nothing else needed. |
| Q4 | Error page actions (HR-01) | default | A "Try again" + "Go home"; B message and code only | **A**: nothing in the requirement forbids it and a dead end is poor. Trivial to remove. |
| Q5 | Pagination style (HR-09) | default | A offset (page and size, total count); B keyset (cursor) | **A**: fits the table pattern with page numbers and sorting by any column; keyset can be added later per list for very large tables. The architect records it in an ADR. |
| Q6 | Reference code (HR-01/02) | default | A reuse the framework error digest as the code; B generate our own id | **A**: the digest already ties the user-facing page to the server-side error. If the digest is unavailable, the page omits the code line. Architect confirms feasibility. |
| Q7 | Does the module template generate test files (open in requirements) | default | A structure and `index.ts` only; B also one placeholder test per module | **A**: the requirement says structure and public API, nothing else; tests come with the first real code. Easy to add later. |
| Q8 | Rendering typed errors in the UI (HR-03) | default | A the epic ships types and the typed result only; the first module renders them with existing Alert and FormField; B also ships a small shared renderer | **A**: PH-HR-03 asks for "typed result that the UI can render consistently", not a new component; a renderer can be added when epic 003 needs it. Remove PH-AC-48 if A is taken. |
| Q9 | Global error page in scope (HR-01) | default | A yes, minimal (Next.js needs it for root layout failures); B no, rely on segment 500 page | **A**: HR-01 says "instead of the framework default"; without it a root layout failure shows the default. Included as PH-FL-02. |

**Blocking for the Product Owner: Q3 only.** Everything else takes the recommended default if unanswered (logged in `questions.md`, revertible).
