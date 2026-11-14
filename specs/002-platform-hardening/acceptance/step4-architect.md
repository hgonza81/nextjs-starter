# Step 4 architect check (PH-T-45)

Scope: ADR 0012, migration `20261113120000_set_updated_at_function.sql`, `tests/utils/schema-guard.ts`, `tests/db/schema-guard.test.ts`, `tests/db/set-updated-at.test.ts`. No shell: nothing was executed, review is by reading.

Verdict: PH-AC-33 satisfied after the ADR edits below. No unresolved must-fix in code. No code change is required for acceptance.

## Settled questions

1. **Guard vs ADR rule list.** The code had seven rules; the ADR listed five (no `ON DELETE` rule, which the Delete bullet and the spike did describe). MUST-FIX (docs, done): ADR 0012 now names all seven rules with their identifiers and states the two limits as accepted (ON DELETE enforced as "not NO ACTION", with the advice to write `RESTRICT` for a deliberate NO ACTION; plural names and `<singular>_id` not checked). Also removed the stale "C1, PO to confirm" and "if the PO rejects C1" text.
2. **Catalog queries and empty allowlist.** Queries are correct for the current schema (verified by reading against the spike; `public` is empty). Epic 003 conflict, decided: keep rule 1 strict, use the allowlist (done in ADR, section "Expected exceptions in epic 003"): `profiles` (id = `auth.users.id`, no default) and `memberships` (composite PK, no `id`) for `id-uuid-primary-key`. Granularity note: an entry exempts the whole rule for that table, which is acceptable for two tables. Additional conflict found in the epic 003 requirements that the user did not list: `profiles` and `memberships` have no `updated_at`, so rules 3 and 4 would fail too. Recorded in the ADR with a recommendation (profiles gets `updated_at` plus trigger; memberships allowlisted for both rules until `role` is added). The epic 003 spec must decide; this is a question for the client via the PM, not decided here. Also noted: `tenants.created_by` is a domain column (FK needs explicit ON DELETE and an index); `memberships.user_id` needs its own index.
3. **Trigger function security.** Correct: `SECURITY INVOKER`, `set search_path = ''`, body uses only `now()` and `new`, no grant (ADR 0003 default ACL), the test proves `authenticated` gets 42501 on a direct call while the trigger still fires. ADR now also states that only the `CREATE TRIGGER` role needs EXECUTE and that `now()` is the transaction start time (the migration comment already did).
4. **Drizzle pull omits triggers.** It was only in the spike notes. MUST-FIX (docs, done): stated in the Decision section ("Accepted limits") and in the `docs/architecture.md` guardrail table: the guard is the only automated check for the trigger.
5. **PH-FR-19 and existing tables.** `public` has no tables, so nothing needs migrating or allowlisting; the real-schema test passes with zero tables and `db reset` plus the drift check are unaffected. Satisfied.

## Edited
- `docs/adr/0012-database-conventions.md`: Delete bullet and consequences (C1 confirmed), trigger bullet, enforcement rewritten (7 rules), new "Accepted limits of the guard", new "Expected exceptions in epic 003".
- `docs/architecture.md`: C13 row and the ADR 0012 guardrail row.

## Notes (not blocking; optional fix-task proposals)
- N1 (proposal FIX-A, developer + tester, low priority): the trigger rule accepts `BEFORE UPDATE OF <cols>` and triggers with a `WHEN` clause, and disabled triggers (`tgenabled = 'D'`). Exact description: in `findConventionViolations`, add `and tgattr = ''::int2vector and tgqual is null and tgenabled <> 'D'` to the `pg_trigger` query, with three tester cases (UPDATE OF, WHEN, disabled) reporting `set-updated-at-trigger`. Currently documented in the ADR as a review rule, so skipping it is acceptable.
- N2: `fk-leading-index` treats a partial index as covering the FK; low risk, review rule.
- N3: `listTables` casts `oid::int`; an oid above 2^31 (very old database) would break the comparison. Irrelevant for a starter with a reset-able local DB; use `::bigint` if it ever matters.
- N4: tests are thorough (each rule has a pass and a fail fixture, allowlist partial and empty-reason, empty schema, harness cleanup).
