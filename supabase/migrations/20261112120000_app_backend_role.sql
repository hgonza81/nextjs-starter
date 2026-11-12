-- FND-T-11 / FND-FR-08 / ADR 0003: fail-closed runtime login role.
--
-- app_backend is the role the Next.js server connects as (DATABASE_URL). It can
-- do nothing on its own: it owns no object, has no table privileges, and does
-- not inherit the privileges of the roles it may switch to. Application code
-- must run inside withRls(), which issues SET LOCAL ROLE authenticated|anon;
-- a query run without that switch fails with "permission denied" instead of
-- leaking data.
--
-- The password is deliberately NOT set here (no secret in migrations):
--   * local: supabase/seed.sql sets a non-secret local-only value;
--   * cloud: set manually (ALTER ROLE app_backend PASSWORD ...) when the
--     cloud project is created.
-- Until a password is set the role cannot log in with one.

-- Idempotent: db reset starts from an empty database, but guard anyway.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_backend') then
    create role app_backend
      with login nosuperuser nocreatedb nocreaterole noreplication
           nobypassrls noinherit;
  end if;
end
$$;

-- Membership only to SET ROLE (Postgres 16+ syntax; local and cloud run 17).
-- INHERIT FALSE: app_backend never picks up authenticated/anon privileges
-- implicitly; SET TRUE: it may switch to them explicitly.
grant authenticated to app_backend with inherit false, set true;
grant anon to app_backend with inherit false, set true;

-- Supabase installs default privileges that auto-grant every new public table
-- and sequence to anon and authenticated. Remove them so each table migration
-- (epic 002) grants explicitly and anon gets nothing by default.
-- Only the postgres role is covered: it runs migrations and so owns every table
-- we create. The same rule for supabase_admin is not permitted from postgres
-- (SQLSTATE 42501) and supabase_admin creates nothing in public.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
