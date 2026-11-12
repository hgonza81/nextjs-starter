# 0005. Tenant isolation direction

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations (direction for 002-auth-memberships)

## Context
A tenant is a company; users belong to N tenants through memberships (AGENTS.md). Epic 001 creates no tables, but its choices (ORM, roles, `withRls`, env) must not contradict the isolation strategy of epic 002. The isolation model is a one-way door. Stripe/billing was dropped by the PO (Q13); nothing here accommodates it beyond not blocking it.

## Options considered
1. **Shared database, shared schema, `tenant_id` discriminator, enforced by RLS.** Pros: simplest, cheapest, works with Supabase Auth and Drizzle, one migration path. Cons: a policy mistake leaks across tenants; mitigated by tests.
2. **Schema per tenant.** Pros: stronger separation. Cons: migrations multiply, poor fit with Drizzle and ~50 tables, operational cost.
3. **Database per tenant.** Pros: strongest isolation. Cons: cost and complexity unjustified for an MVP.
4. **Application-level filtering only.** Violates the rule that RLS enforces isolation. Rejected.

## Decision
Option 1 is the declared direction for epic 002, to be detailed in that epic's spec and ADRs:
- Every tenant-owned table has `tenant_id` (UUID, NOT NULL, indexed, FK to `tenants`) and RLS enabled with policies based on real membership.
- Membership checks use `SECURITY DEFINER` helper functions with a fixed `search_path`, non-recursive, with the columns they use indexed.
- The active tenant is explicit request context conveyed per request (mechanism decided in 002), validated server-side on every request against `memberships`, then passed to `withRls` as `app.current_tenant` (selector only, ADR 0003). It is never inferred from "the user's only tenant".
- Tenant, membership and profile creation are one atomic unit (database function or trigger).
- Authorization lives in RLS and is re-checked in server code; UI and middleware redirects are not security boundaries.
- Cross-tenant tests (user A cannot read/insert/update/delete tenant B rows) are mandatory; epic 001 provides the harness and throwaway-table tests, epic 002 applies them to real tables.
- Migrations: UUID primary keys, `created_at timestamptz`, explicit `ON DELETE`, constraints in the database (ADR 0002).

Triggers to revisit (schema- or database-per-tenant): compliance or contractual isolation requirements, or a single tenant's scale that harms others.

Seams for deferred features: roles and invitations attach through nullable columns or new tables on `memberships`; billing, if ever added, attaches to `tenants` via a separate table and route handlers in a new module with no change to existing modules.

## Consequences
- Positive: consistent with ADR 0001-0004; epic 002 starts without rework.
- Negative: isolation correctness depends on policy quality and `withRls`; policy repetition across many tables needs standard templates (to be designed in 002).
- Revisit per the triggers above.

## References
- AGENTS.md; specs/001-foundations/reviews/architect.md (round 1 and 2); ADR 0003.
