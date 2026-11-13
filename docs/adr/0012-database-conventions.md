# 0012. Database conventions

Status: Accepted (C1, hard delete and only `created_at`/`updated_at`, awaits the Product Owner's confirmation)
Date: 2026-11-13
Epic: 002-platform-hardening

## Context
Epic 003 and later add many tables. Keys, naming and audit columns are expensive to change once tables and data exist, and inconsistent conventions across modules are a recurring cost. There are no application tables yet, so nothing needs migrating. Local and CI Postgres is 17.

## Options considered
1. Identifier: (a) `uuid default gen_random_uuid()` (v4, built in); (b) UUIDv7 (`uuidv7()` needs Postgres 18); (c) `bigint` identity; (d) ULID as text.
2. Deletion and audit: (a) hard delete, only `created_at` and `updated_at`; (b) soft delete (`deleted_at`) on every table; (c) full audit columns (`created_by`, `updated_by`) on every table; (d) per-table decision with no convention.
3. Enforcement: (a) documentation only; (b) schema-guard test over the catalog with a named allowlist; (c) a custom migration linter.

## Decision
- **Id:** `id uuid primary key default gen_random_uuid()`. Matches `auth.users.id`, not enumerable, no extension. Rejected: bigint (enumeration, mismatch with auth ids), ULID/text (extra type, no gain), UUIDv7 (needs Postgres 18; switching later is a change of the default value only, so this door is cheap to revisit).
- **Naming:** `snake_case`; plural table names (`tenants`, `memberships`); singular columns; foreign keys `<singular>_id`; constraints and indexes use the Postgres defaults (`<table>_<cols>_{pkey,key,fkey,idx}`); RLS policies are sentences naming action and actor; functions are `snake_case` verbs; migration files `YYYYMMDDHHMMSS_description.sql` (existing).
- **Timestamps:** `created_at` and `updated_at`, both `timestamptz not null default now()`. Never `timestamp` without time zone.
- **Trigger:** one migration creates `public.set_updated_at()` (`language plpgsql`, `set search_path = ''`, SECURITY INVOKER, sets `new.updated_at = now()`). Each table adds `create trigger <table>_set_updated_at before update ... for each row execute function public.set_updated_at()`. Firing a trigger needs no EXECUTE grant, so the default-privilege revoke of ADR 0003 does not interfere (asserted in a test).
- **Delete (C1, PO to confirm):** hard delete everywhere. `ON DELETE` is chosen deliberately per foreign key and stated in the migration (children of a tenant `CASCADE`, otherwise `RESTRICT`). Only `created_at` and `updated_at` exist on every table; no `created_by`/`updated_by`. Seam: a nullable `deleted_at`, `created_by` or `updated_by` can be added to a single table later without a rewrite. Security-event auditing (sign-ins, role changes) is a future module, not a column convention.
- **Enforcement:** new rules in `tests/db/schema-guard.test.ts` (already catalog-based) for every `public` table: (1) `id uuid` primary key; (2) `created_at` and `updated_at` are `timestamptz not null default now()`; (3) a `BEFORE UPDATE` trigger calls `set_updated_at`; (4) snake_case identifiers; (5) every foreign-key column is the leading column of an index. Exceptions only through a named allowlist with a reason string; failures read "table X violates rule Y". The `tenant_id` rule belongs to epic 003 (seam: add it to the same test).

## Consequences
- Positive: one shape for every table; violations fail CI, not review; adding soft delete or audit later is additive per table.
- Negative: deleted data is unrecoverable and there is no per-row author trail until a module adds them. If the Product Owner rejects C1, this ADR is amended before any table exists (cheap now, costly across about 50 tables later).
- Revisit: UUIDv7 when the platform runs Postgres 18 and index locality matters; soft delete for a specific table when a module needs recovery.

## References
- Epic 002 `questions.md` (C1, D11); `reviews/round1/architect.md`.
- Postgres `gen_random_uuid()` is built in since 13; `uuidv7()` arrives in 18.
- ADR 0002, ADR 0003, ADR 0005.
