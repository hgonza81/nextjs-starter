# Review by architect — 002-platform-hardening — round 2 (final consistency read of spec.md, questions.md, ADRs 0012-0016, architecture.md)

## Summary
Spec and ADRs agree on D1-D17, C1, C2, limits (20/100/10,000, 1 MB, 200 chars), ports (3001), file paths and package names. Five ADR mismatches were fixed in the ADRs. Nothing in the spec contradicts the architecture; two small spec wording fixes remain.

## Concerns and gaps
- [fixed in ADR 0016] ADR allowed a `contains` filter with escaping; spec (D12, out of scope) is equality only. ADR and the architecture.md lint-table row now say equality only; strict integer parsing (`1e3`, `1.5`) added for PH-AC-75.
- [fixed in ADR 0015] Helper names `notFound`/`forbidden` collided with the Next.js functions the wrapper must pass through; renamed `notFoundError`/`forbiddenError`/`conflictError`/`validationError`.
- [fixed in ADR 0015] ADR said `ref = digest ?? new` for the wrapper too, contradicting spec section 11 and PH-AC-71 (wrapper codes unique per occurrence). Wrapper now always generates; digest is for pages and the hook.
- [fixed in ADR 0014] `upgrade-insecure-requests` removed: it is not in the spec and would risk breaking E2E on `next start` over http. `global-error` nonce fallback (script-free or hash) added, per PH-AC-61.
- [fixed in ADR 0013] Telemetry starts only with `OTEL_EXPORTER_OTLP_ENDPOINT` (ADR also mentioned per-signal endpoints, which the spec does not validate); logger never-throws rule and request-id source stated (PH-AC-70, 72).
- [minor, spec] PH-FR-24 lists the `docs/architecture.md` updates as "C1, C6, C8, C11, layout, ADR table"; the file also adds C13, C14, C15.
- [minor, spec] PH-FR-11 says "no OTLP endpoint variable"; ambiguous now that only one variable is supported.

## Proposals (spec.md edits for the PM; I did not edit spec.md)
1. Section 7, PH-FR-24: replace "(C1, C6, C8, C11, layout, ADR table)" with "(C1, C6, C8, C11, new C13 to C15, layout, ADR table)".
2. Section 7, PH-FR-11: replace "With no OTLP endpoint variable set" with "With `OTEL_EXPORTER_OTLP_ENDPOINT` unset".
3. Optional, section 5 D12 and PH-FR-20: add "page and page size are plain base-10 integers" (already implied by PH-AC-75).

## Questions for the client
None.

## Risks and assumptions
- ADR 0012 still carries "C1 awaits PO confirmation"; remove after approval.
- Spikes in spec section 12 remain the real risk (nonce in `global-error`, `sdk-node` under Turbopack/Node 26, Drizzle `cause` shape).
