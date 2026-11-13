# 002 - Platform hardening: traceability check

Checkpoint: spec + tasks, before Product Owner approval (D17). Chain checked: PH-HR -> PH-FL -> PH-FR/NFR -> PH-AC -> PH-T -> test. Method: fresh product-manager instance; read `requirements.md`, `spec.md`, `tasks.md`, ADRs 0012-0016, `specs/README.md`, and the AC/BR/FL index of `flows.md`. Earlier flows-stage check (superseded): its 7 contradictions and the vague-criteria list are all resolved in spec sections 6 and 8 (AC-09/10/22/23/30/33/38/48/55/57 rewritten or dropped, BR-02/03/04 corrected, Q8 and wireframes decided).

**Verdict: ready for approval after the findings below are triaged. No blockers. 0 fixes made to spec/tasks (nothing was a plain typo or ID mismatch). 1 coverage gap, 4 ordering/self-containment issues, 2 sizing issues, 3 items for the Product Owner.**

## 1. Chain coverage

| Check | Result |
|-------|--------|
| Every PH-HR (01-12) has a PH-FL (HR-12 is cross-cutting) and at least one PH-FR/NFR | Yes (spec section 16) |
| Every PH-FR (01-24) and PH-NFR (01-06) has a build task and a verification task | Yes (tasks section 8). PH-NFR-06 is verified only by architect review (T-57) |
| Every task traces to a requirement | Yes. Acceptance (6), architect (7) and T-58 tasks trace to FR/NFR or the whole epic |
| Every PH-AC (01-78, 48 dropped) has a test level (spec 8) and a task | All but **PH-AC-76 unit half** (see F1) |
| Task count and assignee tally (25/20/7/6/1 = 59) | Correct |
| Spec limits vs ADRs 0012-0016 (page size 20/100, page cap 10,000, body limit 1 MB, ports 3001/3100+, UI on 127.0.0.1, `ref` regex, five error types, `src/lib/*` and `src/db/paginate.ts` paths, trigger settings) | Consistent, no contradictions found |
| Step order, spikes first, dependency before dependent | Consistent except F2 |

## 2. Findings

| # | Severity | Finding | Suggested action |
|---|----------|---------|------------------|
| F1 | Important | **PH-AC-76 unit test has no task.** Spec 8 lists "76 (gate)" at unit level (gate returns 404 when the flag is off; `assertFaultInjection()` is a no-op, required by PH-FR-23). T-06 has no tests and T-17 covers only the E2E half. | Add to T-17 (or T-13) the unit test of the gate and of the no-op, and list AC-76 unit in T-56 coverage. |
| F2 | Important | **Missing dependencies.** T-09 and T-10 acceptance use the fault routes from T-06 but do not list it in Dependencies (only reachable by sequential order). T-06 is also absent from the T-09 "Read first". | Add PH-T-06 to the Dependencies of T-09 and T-10. |
| F3 | Important | **Not self-contained for criteria text.** Tasks say "spec 8 (PH-AC-01 to 07...)", but the Given/When/Then of every unchanged criterion lives only in `flows.md` section 6, and the BR rules in `flows.md`. Only the tasks header mentions it; individual "Read first" lines do not. A fresh agent following only its task would miss the criteria text. | Add `flows.md` sections 5-6 (BR, AC) to the common read-first in tasks section 0. |
| F4 | Moderate | **PH-AC-16 trace id test and in-memory exporter.** Spec 10 and D14 add a dev-only in-memory exporter to test the trace id from the active span (PH-FR-09). No task adds the dependency or tests the trace id; T-13 omits it, T-02 only allows the OTel API package. | State in T-13 that AC-16 includes `trace_id`/`span_id` from an active span and allow the dev dependency there, or drop it from spec 10. |
| F5 | Moderate | **T-14 cites "11" for mapping.** PH-AC-11 is "no internals in responses" (hook/E2E, T-16/T-18), not mapping. Probably should read 12/13 only. | Remove "11 where it concerns mapping" from T-14. |
| F6 | Moderate | **Task size.** T-18 (nine behaviours, three E2E themes), T-06 (seam, six fixtures, form, redirect and notFound pages) and T-35 (seven test groups) are heavy for one fresh agent. T-01 has five spikes (acceptable, each is small). | Split T-18 into capture (08, 09, 10, 58, 60) and leakage/wrapper/request id (11, 64, 70); split T-06 into seam + gate and the fixtures; optionally split T-35 into headers/nonce and Server Action origin/size. New IDs would be added at the end or letter-suffixed; the orchestrator decides. |
| F7 | Minor | **Same-file parallel risk.** T-25 and T-23 both edit `package.json` (scripts vs dependencies) while marked parallel-capable; the rule in section 9 only names `instrumentation.node.ts`. | Keep sequential (default) or note it in section 9. |
| F8 | Minor | **T-06 critical path.** Critical path lists T-05 -> T-06, but T-06 depends only on T-04. Harmless. | Tidy wording. |

## 3. Scope check

Nothing beyond `requirements.md` and the Out of scope list was found in tasks. Items that are derived rather than literally requested, all already recorded as decisions in the spec:

- Global error page (C2), `StatusPage`, "Try again"/home links (D6): interpretation of PH-HR-01; C2 is listed for confirmation.
- Fault routes and `assertFaultInjection()` shipped in the app behind `DESIGN_PAGE_ENABLED` (PH-FR-23): a test seam, not in requirements; production code path in `src/app/layout.tsx`. Gate tested by AC-76 (see F1).
- CI smoke step for `gen:module` (PH-FR-22, T-52): derived from "lint boundary rules still applying".
- `X-Frame-Options`, startup failure on bad `OTEL_*` values, kebab-case names, ADR/doc updates: minor and justified by PH-HR-12.
- `requirements.md` section 4 and 5 still say wireframes are needed and ask whether the template generates tests; spec D13/D17 supersede. The Product Owner's record is not edited here.

## 4. Decisions for the Product Owner (before approving)

1. **C1** (hard delete, only `created_at`/`updated_at`) and **C2** (global error page): already listed at the top of the spec; ADR 0012 still says "awaits confirmation" and T-42 handles it.
2. **Per-request rendering for every page** (consequence of nonce CSP, D10): this is a product-visible, hard-to-reverse choice (static optimisation and CDN caching lost). It is recorded only as a revertible default; recommend promoting it to a confirmed decision next to C1 and C2, or accepting the fallback (static CSP) explicitly.
3. **Shipping fault routes in the production artifact** behind a flag (PH-FR-23): small, but it adds a code path to `src/app/layout.tsx`; confirm acceptance or choose the recorded fallback.

## 5. Not checkable yet

Tests, `acceptance/*.md` and `ac-coverage.md` do not exist; T-56 is the place where every PH-AC is mapped. Re-run this check as a short delta after any split of T-06/T-18/T-35 or other changes to tasks.md.
