# Architecture Decision Records (ADR)

Every architecture decision that is hard to reverse is recorded here, one file per decision: `NNNN-short-title.md` (e.g. `0001-multi-tenancy-model.md`).

Owner: `architect` agent. Decisions are proposed, reviewed by the client, and then marked Accepted.

## Rules

- Numbered sequentially, never renumbered or deleted. To change a decision, write a new ADR and mark the old one `Superseded by NNNN`.
- Status: `Proposed` | `Accepted` | `Superseded by NNNN`.
- Written in English.
- Keep them short: context, options, decision, consequences.

## Template

See [0000-template.md](0000-template.md).

## Index

| # | Title | Status |
|---|-------|--------|
| [0001](0001-code-structure-and-layering.md) | Code structure and layering | Accepted |
| [0002](0002-supabase-local-first-and-migrations.md) | Supabase local-first and SQL-first migrations | Accepted |
| [0003](0003-drizzle-rls-data-access.md) | Data access with Drizzle and RLS through `withRls` | Accepted |
| [0004](0004-env-and-secrets.md) | Environment variables and secrets | Accepted |
| [0005](0005-tenant-isolation-direction.md) | Tenant isolation direction | Accepted |
