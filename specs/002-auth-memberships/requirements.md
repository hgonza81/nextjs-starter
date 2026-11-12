# 002 — Auth and Memberships: requirements

Stage: **1. Requirements** (first draft written before the review-round process existed; it contains more detail than high-level requirements and will be re-reviewed by all agents, then rewritten as `spec.md`).
Depends on: 001-foundations. Note: **Supabase Auth** (setup and client wiring) belongs to this epic, not to foundations.

## 1. Goal

Let a person sign up (creating their user and first company), log in, and land on an empty dashboard, with the multi-tenant model properly laid down so it can grow (invitations, Stripe billing, etc.) without rebuilding the foundation.

## 2. Scope

### In scope
- Sign-up screen (user data + company name).
- Login screen (email + password).
- Empty dashboard, accessible only with a session.
- Data model: profiles, tenants, memberships.
- Modules: `auth`, `users`, `tenants`.

### Out of scope (explicitly, for later)
- Forgot password / reset.
- Inviting users to a company.
- Company switcher (top right) and default company.
- Admin screen.
- Payments / Stripe.
- Roles and advanced permissions.
- Social login / SSO.
- Profile editing.

> Note: the data model already allows a user to belong to several tenants (see §5), but in this epic each sign-up creates exactly one tenant and the UI does not expose multi-tenant membership.

## 3. Users and the tenant concept

- **Tenant** = company. Named `tenant` in code and database, "company" in the UI.
- A person who signs up creates their user **and** their first company in the same step.
- A user can belong to N tenants (N:M through membership). Sharing an email domain does not imply belonging to the same tenant.

## 4. Functional requirements

| ID | Requirement | Acceptance criteria |
|----|-------------|---------------------|
| AUTH-FR-01 | **Sign-up**: form with first name, last name, email, password, confirm password, and company name. | All fields required. Valid submission creates the user, tenant, and membership, and signs the user in. |
| AUTH-FR-02 | **Sign-up validation**: valid email format; password and confirmation identical; password at least 8 characters; company name 2 to 100 characters. | Each error is shown next to its field. Nothing is sent to the server if client validation fails; the server validates again. |
| AUTH-FR-03 | **Unique email**: an existing email cannot be registered again. | A clear error is shown; no partial data is created. |
| AUTH-FR-04 | **Atomic creation**: user, profile, tenant, and membership are created together or not at all. | If any step fails, no orphan records remain. |
| AUTH-FR-05 | **Login** with email and password. | Valid → redirect to dashboard. Invalid → generic message ("Incorrect email or password") without revealing which part failed. |
| AUTH-FR-06 | **Empty dashboard** on a protected route. | Without a session, redirects to login. With a session, shows an empty screen (minimal structure and a sign-out option). |
| AUTH-FR-07 | **Sign out**. | After signing out, the dashboard is no longer accessible. |
| AUTH-FR-08 | **Session redirects**: a signed-in user visiting login or sign-up is sent to the dashboard. | Verifiable by E2E test. |
| AUTH-FR-09 | **Immutable email**: the email used to authenticate cannot be changed. | No UI or endpoint to change it; the profile does not duplicate the email, it is read from Supabase Auth. |
| AUTH-FR-10 | **User data**: first name and last name (separate fields) are stored in addition to the email. | Verifiable in the profiles table. |

## 5. Data model (minimal)

Only these tables (besides Supabase's `auth.users`):

- `profiles`: `id` (= `auth.users.id`), `first_name`, `last_name`, `created_at`.
- `tenants`: `id`, `name`, `created_by`, `created_at`.
- `memberships`: `tenant_id`, `user_id`, `created_at`. Composite PK (`tenant_id`, `user_id`).

No roles for now. A role (e.g. `owner`) is added as a column on `memberships` when invitations are implemented.

## 6. Modularization

- `auth`: sign-up, login, logout, session, route protection.
- `users`: profile (first and last name).
- `tenants`: tenant creation and memberships.

## 7. Non-functional requirements

| ID | Requirement |
|----|-------------|
| AUTH-NFR-01 | **Security**: RLS enabled on all tables; a user only sees tenants where they have a membership. Isolation is enforced in the database. |
| AUTH-NFR-02 | **Security**: passwords handled exclusively by Supabase Auth; never stored or logged. Session in httpOnly cookies. |
| AUTH-NFR-03 | **Validation** on client and server with a shared schema. |
| AUTH-NFR-04 | **Accessibility**: WCAG AA on forms (labels, focus, associated errors, keyboard). |
| AUTH-NFR-05 | **Responsive**: usable on mobile. |
| AUTH-NFR-06 | **Quality**: automated tests for validation, RLS, and E2E sign-up and login; lint and typecheck with no errors. |
| AUTH-NFR-07 | **Extensibility**: adding Stripe, roles, or invitations must not require restructuring existing tables or modules. |

## 8. Open decisions (client input needed)

1. **Email confirmation**: enabled? *Recommendation:* disabled (simpler); can be turned on with a Supabase switch later. No emails are sent today.
2. **Final "validator"**: mentioned as a last task. Interpreted as a final quality review (tests + acceptance checklist). Or did you mean validating that the email is a company email (rejecting gmail, etc.)? The latter is not in scope.
