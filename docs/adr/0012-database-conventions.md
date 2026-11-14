# 0012. Database conventions

Status: Accepted (C1, hard delete and only `created_at`/`updated_at`, confirmed by the Product Owner on 2026-11-13)
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
- **Trigger:** one migration creates `public.set_updated_at()` (`language plpgsql`, `set search_path = ''`, SECURITY INVOKER, sets `new.updated_at = now()`). Each table adds `create trigger <table>_set_updated_at before update ... for each row execute function public.set_updated_at()`. Firing a trigger needs no EXECUTE grant (only the role that runs `CREATE TRIGGER`, the migration owner, needs it), so the default-privilege revoke of ADR 0003 does not interfere and `authenticated` cannot call the function directly (both asserted in a test). `now()` is the transaction start time: an update in the same transaction as the insert leaves `updated_at = created_at`; the value is always overwritten, so a client-supplied `updated_at` is ignored.
- **Delete (C1, confirmed by the Product Owner on 2026-11-13):** hard delete everywhere. `ON DELETE` is chosen deliberately per foreign key and stated in the migration (children of a tenant `CASCADE`, otherwise `RESTRICT`). Only `created_at` and `updated_at` exist on every table; no `created_by`/`updated_by`. Seam: a nullable `deleted_at`, `created_by` or `updated_by` can be added to a single table later without a rewrite. Security-event auditing (sign-ins, role changes) is a future module, not a column convention.
- **Enforcement:** rules in `tests/db/schema-guard.test.ts` (catalog-based, `findConventionViolations`) for every `public` table: (1) `id-uuid-primary-key`: `id uuid default gen_random_uuid()` and a primary key of exactly `(id)`; (2) `created-at-timestamptz` and (3) `updated-at-timestamptz`: `timestamptz not null default now()`; (4) `set-updated-at-trigger`: a `BEFORE UPDATE` row trigger executing `public.set_updated_at()`; (5) `snake-case-identifiers` for table and column names; (6) `fk-explicit-on-delete`: every foreign key has an `ON DELETE` action other than NO ACTION (`CASCADE`, `RESTRICT`, `SET NULL` or `SET DEFAULT`); (7) `fk-leading-index`: the FK columns lead an index. Exceptions only through `CONVENTION_ALLOWLIST`, one entry per table and rule with a non-empty reason (an entry exempts that whole rule for that table); failures read "table X violates rule Y". The `tenant_id` rule belongs to epic 003 (seam: add it to the same test).
- **Accepted limits of the guard:**
  - Rule 6 is "not NO ACTION": Postgres stores the same value for an omitted clause and for an explicit `ON DELETE NO ACTION`, so the two cannot be told apart. A deliberate NO ACTION must be written as `RESTRICT` or allowlisted with a reason.
  - Plural table names and `<singular>_id` FK column names are not checked (no pluralisation oracle in the catalog); they stay review rules. Only snake_case is enforced.
  - **Drizzle pull omits triggers.** `pnpm db:schema` / the drift check mirror tables, defaults and policies but silently drop triggers, so the drift check can never notice a missing `set_updated_at` trigger. Rule 4 of the schema guard is the only automated check; it is also not a runtime check (a trigger disabled with `ALTER TABLE ... DISABLE TRIGGER`, or one declared `UPDATE OF <columns>` or with a `WHEN` clause, is not detected: review rule).

## Consequences
- Positive: one shape for every table; violations fail CI, not review; adding soft delete or audit later is additive per table.
- Negative: deleted data is unrecoverable and there is no per-row author trail until a module adds them (C1 was confirmed by the Product Owner; reversing it later is additive per table, not a rewrite).
- Revisit: UUIDv7 when the platform runs Postgres 18 and index locality matters; soft delete for a specific table when a module needs recovery.

## Expected exceptions in epic 003
The strict rules stay (no refinement of rule 1: only two tables are affected, and a documented allowlist entry is cheaper than a second rule shape). The epic 003 migration author adds these entries to `CONVENTION_ALLOWLIST` in the same task, each with a reason:

| Table (per epic 003 requirements) | Rule | Reason |
|---|---|---|
| `profiles` | `id-uuid-primary-key` | `id` is `auth.users.id`: it has no default, and it is a foreign key to `auth.users (id)` with `ON DELETE CASCADE`. The primary key is still exactly `(id)`, but the allowlist exempts the whole rule. |
| `memberships` | `id-uuid-primary-key` | Junction table: composite primary key `(tenant_id, user_id)`, no `id` column. `user_id` needs its own index (the primary key leads only with `tenant_id`) for rule 7. |

Conflicts the requirements leave open (epic 003 spec decides; do not allowlist silently): the epic 003 column lists have no `updated_at` for `profiles` or `memberships`, so rules 3 and 4 fail unless the columns and the trigger are added. Recommendation: `profiles` gets `updated_at` and the trigger (names are editable); `memberships` rows are immutable until the `role` column arrives, so allowlist `updated-at-timestamptz` and `set-updated-at-trigger` for it with that reason and remove both entries when `role` is added. `tenants.created_by` is a domain column, not the audit convention (C1); its FK needs an explicit `ON DELETE` (rule 6) and an index (rule 7).

## Spike outcome
PH-T-41, run on the local Postgres 17.11 against the real role setup (migrations 20261112120000 and 20261112130000). Throwaway function and tables were created as `postgres`, exercised as `app_backend` with `set local role authenticated` (what `withRls` does), then dropped; `pnpm db:reset` restored the migrations-only state. No assumption of this ADR was disproved.

1. **`gen_random_uuid()` default: confirmed.** Insert as `authenticated` without an id returns a generated uuid; no extension and no grant needed. Consequence: the id rule stands.
2. **`set_updated_at()` as `SECURITY INVOKER`, `set search_path = ''`: confirmed.** The function created by `postgres` gets the ADR 0003 default ACL (`postgres` and `service_role` only, no PUBLIC, no anon/authenticated). As `authenticated`, `has_function_privilege(..., 'execute')` is false and a direct `select public.set_updated_at()` fails with `permission denied for function`, yet an `UPDATE` on the table fires the trigger and succeeds. Consequence: the migration needs NO `grant execute`; keeping the default is also good, since the function is not meant to be called directly. The body uses only `now()` and `new`, so the empty `search_path` is safe (do not add unqualified object references).
3. **Clock: `now()` is correct, tests must use separate transactions.** `now()` equals `transaction_timestamp()`. Inside one transaction, insert then update leaves `updated_at = created_at` (and `updated_at <> clock_timestamp()` even after `pg_sleep`). Across two transactions `updated_at > created_at`. The client-supplied `updated_at = '2000-01-01'` was overwritten by the trigger. A no-op update (`set name = name`) did not error. Decision: keep `now()` (a row's `updated_at` then matches the transaction that changed it, and `created_at` default uses the same clock); PH-AC-34 tests must commit between insert and update (or compare against `clock_timestamp()` bounds, not `now()`).
4. **`pnpm db:schema` and the drift check: no drift.** With the function alone, the generated `schema.ts` is byte-identical (git diff empty; drizzle-kit pull ignores functions). With a table plus trigger, the table, defaults (`defaultRandom()`, `defaultNow()`) and policies are mirrored and the trigger is silently omitted. Consequence: the trigger is invisible to the drift check, so only the schema guard (rule 3) can catch a missing trigger; the drift check needs no change for T-42. It also writes a random `0000_*.sql`, which the wrapper already deletes.
5. **Catalog queries for the guard (T-43), all verified against throwaway tables.**
   - `public` is empty today (`\dt public.*` returns 0 rows), so no existing table needs an allowlist entry.
   - Tables: `pg_class` with `relnamespace = 'public'::regnamespace` and `relkind in ('r','p')` (includes partitioned tables, as the existing guard does).
   - Id and timestamps: `pg_attribute` left joined to `pg_attrdef`; `format_type(atttypid, atttypmod)` gives `uuid` / `timestamp with time zone`, `attnotnull`, and `pg_get_expr(adbin, adrelid)` gives exactly `gen_random_uuid()` and `now()`. Primary key: `pg_constraint` with `contype = 'p'` and `conkey` must be exactly the `id` column.
   - Trigger: `pg_trigger` with `not tgisinternal`; `tgtype & 2` (BEFORE), `& 16` (UPDATE), `& 1` (ROW) and `tgfoid::regprocedure = 'set_updated_at()'` (the regprocedure prints schema-less because `public` is on the search path; compare via `tgfoid = 'public.set_updated_at()'::regprocedure` to be exact). `information_schema.triggers` also works but only shows triggers on tables the role owns or can access and cannot tell the function schema reliably; prefer `pg_trigger`.
   - Naming: names not matching `^[a-z][a-z0-9_]*$` are found with a regex on `pg_class.relname` and `pg_attribute.attname` (an unquoted `Id` is folded to `id`; only quoted identifiers such as `"CamelCol"` are detectable). Plural table names and the `<singular>_id` FK naming are NOT reliably checkable from the catalog (no pluralisation oracle); the guard should check snake_case only, and plural/FK naming stays a review rule (as PH-AC-35 lists only snake_case).
   - Foreign keys: `pg_constraint` `contype = 'f'`, `conkey`, `confdeltype`. Caveat: `confdeltype = 'a'` (NO ACTION) is what Postgres stores both for an omitted clause and for an explicit `ON DELETE NO ACTION`, so "explicit ON DELETE" can only be enforced as "not `a`", i.e. `c`, `r`, `n` or `d`. This matches the ADR (`CASCADE` or `RESTRICT`); anything else needs an allowlist reason. FK-leading-index: `exists (select 1 from pg_index i where i.indrelid = k.conrelid and i.indkey[0] = k.conkey[1])` (for composite FKs compare the whole key prefix).

## References
- Epic 002 `questions.md` (C1, D11); `reviews/round1/architect.md`.
- Postgres `gen_random_uuid()` is built in since 13; `uuidv7()` arrives in 18.
- ADR 0002, ADR 0003, ADR 0005.
