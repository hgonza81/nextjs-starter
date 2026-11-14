# Notes from epic 002 for the epic 003 review

Recorded at the step 4 architect check of epic 002 (see `specs/002-platform-hardening/acceptance/step4-architect.md` and ADR 0012, section "Expected exceptions in epic 003"). They are inputs for the 003 review round and questions, not decisions.

1. **Table conventions.** ADR 0012 requires every `public` table to have an `id uuid` primary key with default `gen_random_uuid()`, `created_at` and `updated_at` (`timestamptz`, `not null`, default `now()`) and a `BEFORE UPDATE` trigger using `public.set_updated_at()`. The schema guard enforces it.
2. **`profiles`** (`id` = `auth.users.id`): the id has no default, so it needs an allowlist entry for `id-uuid-primary-key`. The current requirements give it no `updated_at`; the architect recommends adding `updated_at` and the trigger.
3. **`memberships`** (composite primary key `(tenant_id, user_id)`): needs allowlist entries for `id-uuid-primary-key`, and, as long as it has no `updated_at`, for the `updated_at` and trigger rules (until a `role` column is added). The 003 spec must decide whether to add `updated_at`; this is a question for the Product Owner.
4. **Foreign keys** need an explicit `ON DELETE` (not NO ACTION) and an index whose first column is the FK column. `tenants.created_by` is a domain column, and `memberships.user_id` needs its own index.
5. **Proxy and CSP** (ADR 0014): session refresh in `src/proxy.ts` must keep the CSP headers on every response it recreates; session cookies must be SameSite=Lax or stricter; OAuth must start from a Server Action or a route redirect (`form-action 'self'`); client forms must import `@/lib/zod-jitless` first.
6. **Errors and actions** (ADR 0015): use `defineAction`; database access goes through it; route handlers that touch the database must catch and log through `logger.exception`.

## Added by the final architect read of epic 002 (PH-T-60)

Details and reasons are in `specs/002-platform-hardening/acceptance/architect-final.md`.

7. **CI must exercise Auth.** Remove `gotrue` from the reduced Supabase stack exclusion list in the `database-and-e2e` job (docs/architecture.md, "Reduced Supabase stack"); the drift check only protects once tables exist.
8. **Authenticated action wrapper.** Add `defineAuthedAction` (or a context argument) next to `defineAction`; it resolves a `VerifiedContext` through `supabase.auth.getUser()` and the membership check before the handler. Nothing enforces that actions use `defineAction`; consider a lint rule for `"use server"` files, or make it a review item.
9. **`tenant_id` guard rule.** Add the rule to `findConventionViolations` in `tests/utils/schema-guard.ts` (seam named in ADR 0012). Existing rules 1 to 7 apply to every new table, including the allowlist entries listed above.
10. **Session refresh in `src/proxy.ts`** must be composed with the CSP (one function, every recreated `NextResponse.next({ request })` carries the CSP request and response headers). If `/api` routes need a session, split the matchers; do not drop the `api` CSP exclusion silently.
11. **Error mapping and enumeration.** `fromDbError` maps `23505` to `conflict`, so a unique constraint on a globally unique value (slug, email) reveals that the value exists. Sign-up and login messages must stay generic regardless (use cases decide; do not forward the mapped message for credentials or email). Cross-tenant rows stay `not_found` through `requireRow`.
12. **Rate limiting** lives in `src/proxy.ts` or the action wrapper (decision of 003; seam recorded in ADR 0014).
13. **Request id.** Only an incoming `x-request-id` or `x-vercel-id` is read; the proxy may generate one if 003 needs correlation outside Vercel.
14. **CSP additions only when a feature needs them:** Supabase Storage origin in `img-src`, `wss:` in `connect-src` for Realtime. OAuth and magic-link flows start from a Server Action or route handler redirect (`form-action 'self'`). Session cookie stays `SameSite=Lax` or stricter.
15. **Client forms** import `@/lib/zod-jitless` first, also in any client file that imports `@/lib/env` (the E2E CSP fixture catches a miss). Alternative if error-prone: one import from `src/instrumentation-client.ts`.
16. **Supabase client factories** do not exist yet; 003 chooses their location (ADR 0001 and 0004 name `src/lib/supabase/`) and records it. `lib` may not import `modules` or `db`.
17. **Deployment.** Confirm sibling subdomains serve HTTPS before the first production deploy (HSTS `includeSubDomains`); keep `DESIGN_PAGE_ENABLED` off (fault routes and the `x-fault` seam ship in the build).
18. **Lists.** Use the record form of `filters` for every uuid or enum column; `paginate` counts are READ COMMITTED-approximate; `columns` must include `id`.
