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
| [0006](0006-ui-stack-and-design-system-boundary.md) | UI stack and design-system boundary | Accepted |
| [0007](0007-theming-mechanism-and-browser-floor.md) | Theming mechanism and browser support floor | Accepted |
| [0008](0008-test-strategy-and-tooling.md) | Test strategy and tooling | Accepted |
| [0009](0009-ci-cd-pipeline.md) | CI/CD pipeline | Accepted |
| [0010](0010-toolchain-pinning-and-supply-chain.md) | Toolchain pinning and dependency supply chain | Accepted |
| [0011](0011-validation-and-forms.md) | Validation and forms: Zod and React Hook Form | Accepted |
| [0012](0012-database-conventions.md) | Database conventions | Accepted |
| [0013](0013-observability.md) | Observability: OpenTelemetry NodeSDK, logger, local collector | Accepted |
| [0014](0014-security-headers-and-csp.md) | Security headers and CSP | Accepted |
| [0015](0015-error-model-and-action-wrapper.md) | Error model, Result type and action wrapper | Accepted |
| [0016](0016-pagination.md) | Pagination | Accepted |
