# Review by product-manager — 002-platform-hardening — round 1 (requirements + flows; no wireframes yet)

## Summary
flows.md is faithful to requirements.md and respects the Out of scope list: no cloud, email, jobs, storage, rate limiting, auth or production telemetry destination appears. The biggest issues are (1) the reference-code design (digest reuse, Q6) does not hold up against PH-AC-08/09/47 and BR-02, (2) a few additions beyond the requirements (HTTP bodies with codes on route handlers, a third screen, retry/home actions) that should be named as such, and (3) several vague or conditional acceptance criteria. Independent check of existing facts: `withRls`, `DESIGN_PAGE_ENABLED`, `/api/health/db` ad hoc `console.error`, and CI jobs `fast`, `database-and-e2e`, `secret-scan` all exist in the repo.

## Concerns and gaps
- [important] **Reference code design is inconsistent (PH-HR-01/02, BR-02, Q6, PH-AC-08/09/47).** Q6 A reuses the Next.js digest, but (a) errors caught by the action wrapper (PH-FL-05 `unexpected`) never reach the hook and have no digest, so the wrapper needs its own code generator; (b) a digest is derived from the error, so repeated occurrences can share a code, which makes "exactly one log entry contains code X" (PH-AC-08) fragile. Needs one stated rule: where the code comes from in each path, and whether it is unique per occurrence. BR-02 is also garbled ("non-guessable-free of personal data").
- [important] **Hook vs wrapper overlap for server actions (PH-FL-04/05, PH-AC-09 vs PH-AC-47).** Both say an unexpected action error is logged and returns a generic message plus code. State which path applies to wrapped actions (wrapper) and which to unwrapped ones (hook); otherwise two logs per failure or none.
- [important] **Response body with code on route handlers/actions is beyond PH-HR-02.** HR-02 only requires logging with the code. PH-FL-04 step 3 and PH-AC-10 add a custom response body, which is extra scope and may need custom code in Next.js. Either record it as an approved addition or relax to "generic response, no internals".
- [important] **"Global error page" interpretation (Q9).** Reasonable and justified by "instead of the framework default", but it is a third screen; requirements section 4 says "only one (and 404)". It is also a screen with a technical constraint: it renders without the root layout (no tokens/Tailwind), and under a strict CSP its inline styles may be blocked. Keep it in scope (Q9 A) but (a) confirm explicitly with the Product Owner as an interpretation, (b) add a CSP-vs-error-pages criterion (PH-AC-31 only covers home and `/design`), (c) note that Next.js renders it only in production builds, so its test must run on a production build.
- [important] **Nonce-based CSP vs "render statically" (Q2 A vs section 5).** A nonce CSP forces dynamic rendering of every page. Section 5 says screens "render statically". Contradiction; architect to confirm and the trade-off (dynamic rendering for all pages) should be visible to the Product Owner in Q2. Also "reverted in one config file" is unverified if the CSP lives in request-time code.
- [important] **"Agreed structure" of a module is never defined (PH-HR-11, PH-FL-12, PH-AC-49).** Untestable until `docs/architecture.md`/an ADR states the folder layout. Also unclear whether the boundary lint config enumerates modules (then the generator must edit it, which is unstated).
- [important] **Wireframes conflict.** requirements.md section 4 says wireframes are needed; `specs/README.md` (commit 2386f45) says epics with only trivial pages skip wireframes/walkthrough/Figma and use an ASCII sketch in the designer's review. Orchestrator must state which applies; recommendation: skip, per README (three simple static pages).
- [important] **Q8 leaves a dangling criterion and story.** PH-AC-48 and the story "errors from forms shown consistently" are conditional on Q8. Conditional criteria are not testable. Resolve Q8 before approving flows.md; with Q8 A delete PH-AC-48 and reword the story to "result shape is plain, serializable and field-keyed".
- [important] **Filtering scope is undefined (PH-HR-09, PH-FL-11, PH-AC-38/43).** "Filtered" could mean equality only, contains, ranges, search. Each is a different amount of work. Add a question (below).
- [important] **Existing tables vs enforced conventions (PH-HR-08, PH-AC-35/36).** Not stated whether tables created in 001 (and their migrations) must comply or be listed as documented exceptions. Also AC-33 only checks that documents exist, and the list of *enforced* conventions is not stated.
- [minor] **Test fixtures must not ship.** PH-AC-34, 42, 32 need a test table/page. State they are created inside tests only, so they do not violate PH-AC-35 or add public routes.
- [minor] **Metrics and logs export untested (PH-HR-05).** PH-AC-21 only asserts traces. Which metrics are expected is not stated; either add criteria for logs and metrics or state a minimal expectation.
- [minor] **Vague wording.** "does not slow down noticeably" (PH-FL-07, AC-22); "or the Next.js error status" (BR-03); "documented limit" without a value (HR-07, AC-30); "refused" in PH-FL-09 step 3 vs "no Access-Control-Allow-* header" in PH-AC-29 (pick one: the testable one); PH-AC-57 "nothing outside the requirements" is a review checklist, not an automatable criterion; request-id source not defined (BR-05); "stable order for equal values" needs a stated tiebreaker.
- [minor] **Missing criteria for stated behavior.** BR-03 (500 status on error pages); BR-08 "not found" mapping (AC-13/14/15 cover only conflict, forbidden, unexpected); PH-FL-04 "logger fails" path; PH-FL-10 documented-exception path; PH-FL-08 Docker-not-installed (fine as manual).
- [minor] **BR-04 vs PH-AC-18.** BR-04 is an allow-list ("only event, error class/code, ids"); AC-18 tests a deny-list by field name. A forbidden value under an innocent key is not caught. Pick the allow-list (safer) and test that.
- [minor] **Small additions not asked for** (all low-risk, listed so the Product Owner sees them): "Try again / Go home" actions and the home link on 404 (Q4 covers error page only, not 404); axe, dark theme and selectable code (AC-07), justified only by HR-12 "same bar as 001"; fail-at-startup on invalid telemetry variable (consistent with ADR 0004); "Operator" actor (just a role for env configuration).

## Proposals
- Define the reference code rule in one sentence in flows.md: error pages and hook use the framework digest when present; wrapper and any path without a digest generate their own id; one log entry per occurrence includes the code. Architect to confirm.
- Move the response-body-with-code requirement to Q list (default: generic body, no code on route handlers) or mark as accepted addition.
- Add AC: error pages (500, global, 404) render correctly under the production CSP; production build used.
- Add AC: BR-03 status codes; BR-08 not-found mapping; logs and metrics reach the test receiver (or state they are not asserted).
- Replace PH-AC-57 by an acceptance-time checklist item owned by the product-manager.
- Suggestion (not in scope unless approved): none new. Everything proposed above only clarifies existing scope.

## Questions for the client
1. Filter capability of the list helper (PH-HR-09).
   - Options: A equality filters on allow-listed fields only / B equality plus text "contains" / C also ranges and search
   - Recommendation: A, because the requirement gives no use case yet; richer filters are added by the first module that needs them.
   - Impact if undecided: default A, easy to extend later (low impact, reversible).
2. Do tables from epic 001 have to follow the new conventions?
   - Options: A yes, migrate them in this epic / B no, list them as documented exceptions until touched
   - Recommendation: depends on what exists; the architect states which tables are affected. If none are real business tables, A at no cost.
   - Impact if undecided: AC-35 cannot be written. Ask the architect first; escalate only if migration is non-trivial.
3. Route handler and unwrapped action responses: include the reference code in the response body?
   - Options: A yes (as PH-AC-10) / B generic response only, code only in logs
   - Recommendation: B, because HR-02 asks only for logging and A may need custom response code per handler.
   - Impact if undecided: default B (reversible).
4. Confirm the global error page as an interpretation of PH-HR-01 (Q9) and skipping wireframes per README.
   - Options: A both yes / B no global page / C wireframes wanted
   - Recommendation: A.
   - Impact if undecided: low.

## Risks and assumptions
- Assumption: the Next.js digest is available to the error page and `onRequestError` for all unhandled paths (architect to verify against `node_modules/next/dist/docs/`, since this Next.js version differs from training data).
- Assumption: Grafana LGTM runs acceptably on a developer laptop; it is optional so the risk is contained.
- Risk: strict CSP is the likeliest source of rework (Tailwind, shadcn, Next scripts, global error page inline styles); keep the ADR fallback (relax the minimum) already in Q2.
- Risk: the epic has 12 requirements and no UI; it is large for "hardening". Delivery order in the spec should be walking-skeleton first: logger + error pages + wrapper, then OTel/collector, then headers, then DB conventions, pagination, generator.
- Q3 (soft delete and audit columns) agreed as the single blocking Product Owner decision. Id type is technical but hard to reverse, so it must be an ADR the Product Owner confirms, as Q3 already says.
