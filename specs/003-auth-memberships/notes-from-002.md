# Notes from epic 002 for the epic 003 review

Recorded at the step 4 architect check of epic 002 (see `specs/002-platform-hardening/acceptance/step4-architect.md` and ADR 0012, section "Expected exceptions in epic 003"). They are inputs for the 003 review round and questions, not decisions.

1. **Table conventions.** ADR 0012 requires every `public` table to have an `id uuid` primary key with default `gen_random_uuid()`, `created_at` and `updated_at` (`timestamptz`, `not null`, default `now()`) and a `BEFORE UPDATE` trigger using `public.set_updated_at()`. The schema guard enforces it.
2. **`profiles`** (`id` = `auth.users.id`): the id has no default, so it needs an allowlist entry for `id-uuid-primary-key`. The current requirements give it no `updated_at`; the architect recommends adding `updated_at` and the trigger.
3. **`memberships`** (composite primary key `(tenant_id, user_id)`): needs allowlist entries for `id-uuid-primary-key`, and, as long as it has no `updated_at`, for the `updated_at` and trigger rules (until a `role` column is added). The 003 spec must decide whether to add `updated_at`; this is a question for the Product Owner.
4. **Foreign keys** need an explicit `ON DELETE` (not NO ACTION) and an index whose first column is the FK column. `tenants.created_by` is a domain column, and `memberships.user_id` needs its own index.
5. **Proxy and CSP** (ADR 0014): session refresh in `src/proxy.ts` must keep the CSP headers on every response it recreates; session cookies must be SameSite=Lax or stricter; OAuth must start from a Server Action or a route redirect (`form-action 'self'`); client forms must import `@/lib/zod-jitless` first.
6. **Errors and actions** (ADR 0015): use `defineAction`; database access goes through it; route handlers that touch the database must catch and log through `logger.exception`.
