-- FND-T-50 / FND-FR-08 / FND-FR-09 / FND-NFR-05 / ADR 0003 (open issues 1 and 2).
-- Hardening of the data foundation, in two parts.
--
-- 1. Bound query time for app_backend.
--    withRls() runs `SET LOCAL ROLE authenticated|anon`. Role-level settings
--    (ALTER ROLE ... SET) are applied when a session LOGS IN as that role, not on
--    SET ROLE, so the 8s/3s timeouts Supabase configures on authenticated/anon
--    never reach the app session. They must live on the login role itself.
--    Role-level settings are stored in the catalog and applied at connection
--    start, so they also hold behind the transaction pooler (no startup
--    parameters needed).
--      * statement_timeout 8s: same bound Supabase uses for authenticated.
--      * idle_in_transaction_session_timeout 10s: withRls transactions only wait
--        on the database; a transaction idle for 10s means a callback is stuck
--        (e.g. an external call, which ADR 0003 forbids) and it would pin the
--        single pooled connection (max: 1 per instance). Cancelling it frees the
--        connection and releases locks.
alter role app_backend set statement_timeout = '8s';
alter role app_backend set idle_in_transaction_session_timeout = '10s';

-- 2. No implicit EXECUTE on new functions.
--    Postgres grants EXECUTE on every new function to PUBLIC by default, and
--    Supabase adds explicit grants to anon, authenticated and service_role for
--    functions created by postgres in public. So any helper (notably epic 002
--    SECURITY DEFINER functions) would be callable by anon unless every
--    migration remembered to revoke. Make it explicit instead: a new function
--    is executable by its owner and service_role only; grant to authenticated
--    (or anon) in the same migration that creates the function.
--
--    The PUBLIC entry is the built-in default, not a schema-scoped one; a
--    schema-scoped `revoke ... from public` cannot remove it (schema defaults
--    are added on top of the global default). So that revoke is NOT scoped to a
--    schema and covers every schema where postgres creates functions; schemas
--    owned by Supabase services keep their own explicit default entries.
--    The same limitation as for tables applies: supabase_admin defaults cannot
--    be changed from postgres (it creates nothing in public in practice).
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
