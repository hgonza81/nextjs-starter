-- PH-T-42 / PH-FR-17 / PH-FR-18 / ADR 0012.
-- Reusable BEFORE UPDATE trigger function that keeps updated_at truthful.
--
-- Each table's own migration attaches it:
--   create trigger set_updated_at before update on public.<table>
--     for each row execute function public.set_updated_at();
-- This migration creates no table and no trigger.
--
-- The value is always overwritten, so a client-supplied updated_at is ignored.
-- now() is the transaction start time: an update in the same transaction as the
-- insert leaves updated_at = created_at (ADR 0012, spike outcome).
--
-- SECURITY INVOKER with an empty search_path: the body only uses now() and
-- `new`, so nothing needs resolving; do not add unqualified object references.
-- No grant execute: the function is not meant to be called directly, and the
-- trigger fires for any role that can update the table (ADR 0012, spike).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
