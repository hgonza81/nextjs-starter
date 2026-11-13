# Specs

Each big block of functionality (an "epic") lives in its own numbered folder. Epics are built in numeric order; each depends on the previous ones.

| # | Epic | Summary | Status |
|---|------|---------|--------|
| 001 | [foundations](001-foundations/requirements.md) | Basic Next.js skeleton, Supabase database + CLI, Docker, frontend stack and design system, testing, CI/CD and security checks. Many decisions still open. | Done (see [final acceptance](001-foundations/acceptance/final.md)) |
| 002 | [platform-hardening](002-platform-hardening/requirements.md) | Foundations that remain before the first module: error handling, structured logging and OpenTelemetry, security headers, database conventions, module scaffold. No cloud. | High-level requirements (step 1, awaiting Product Owner approval) |
| 003 | [auth-memberships](003-auth-memberships/requirements.md) | Sign-up, login, empty dashboard, tenants and memberships | High-level requirements (to be re-reviewed under the new workflow; depends on 002) |

> **Renumbering note (2026-11-13):** auth and memberships was first planned as epic 002 and is now epic 003. Mentions of "epic 002" in the epic 001 documents, ADRs 0001-0011 and older code comments mean what is now 003-auth-memberships. They are left as written to preserve history.

## Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Product Owner (client)** | The user | Owns the product and every decision. Describes what they want in conversation, answers questions, approves each checkpoint. |
| **Orchestrator** | The main Claude session | Talks to the Product Owner, records the conversation, launches agents, collects their output, asks the Product Owner the questions that apply, chains the automatic steps, and asks permission at every ✋ checkpoint. Does not make product decisions. |
| **Specialist agents** | Subagents in `.claude/agents/`: `product-manager`, `architect`, `developer`, `ui-ux-designer`, `tester` | Each works through its own lens, writes to files, and returns questions instead of deciding. |

## How we work (per epic)

**Screen steps only for epics with functional screens.** Steps 3, 4 and 7 (wireframes, guided walkthrough, Figma) apply only when the epic delivers screens with functionality (forms, flows, dashboards). An epic with no UI, or only trivial pages (for example an error page), skips them: the `ui-ux-designer` adds a short ASCII sketch to its round 1 review or to the spec, and the orchestrator states in chat that the steps were skipped. The Product Owner can always ask for them.

Two control levels: **✋ checkpoints** are decisions that belong to the Product Owner; the orchestrator never advances past them without explicit approval. **Automatic steps** are chained by the orchestrator without asking, and reported afterwards. The process is not strictly linear: if feedback changes scope, flows or screens, go back to the affected step and re-do only what changed.

```
1 Requirements ✋ → 2 Product refinement ✋ → 3 Wireframes (ASCII) → 4 Guided walkthrough ✋
  → 5 Expert review, round 1 (auto) → 6 Questions ✋ → 7 Figma design ✋ (needs Figma connector with write access)
  → 8 Expert review, round 2 (auto) → 9 Spec ✋ → 10 Tasks ✋ → 11 Implementation (auto, gated)
```

1. **High-level requirements** (`requirements.md`). The Product Owner and the orchestrator talk; the orchestrator (with the `product-manager` agent) records functional and non-functional requirements at a high level, as given, with nothing invented. Unknowns are marked `OPEN`.
   - ✋ *"Do you want to read it first, change anything, or shall I move to product refinement?"*
2. **Product refinement** (`flows.md`, by `product-manager`). Turns the requirements into what the designer needs: actors, step-by-step flows (happy, alternative and error paths), user stories, business rules, a screen and state inventory (empty, loading, error, success), and acceptance criteria in Given/When/Then, with IDs (`AUTH-FL-01`). Adds nothing beyond the requirements: new ideas go to open questions. The orchestrator surfaces the open questions to the Product Owner.
   - ✋ The Product Owner approves `flows.md`.
3. **Wireframes** (`wireframes.md`, by `ui-ux-designer`). ASCII wireframes, one section per screen, with all states, navigation between screens and the requirement/flow IDs they cover. Built on `docs/design-system.md`.
4. **Guided walkthrough** (orchestrator with the Product Owner, in chat). The orchestrator presents the screens one by one: the wireframe, what the user sees and can do, where each action leads, and asks for feedback after each screen ("anything missing?", "does this order work?"). Feedback is applied to `wireframes.md` (`v2`, `v3`...); only changed screens are re-presented.
   - ✋ The Product Owner closes the wireframes.
5. **Expert review, round 1** (automatic). The orchestrator launches `architect`, `developer`, `ui-ux-designer`, `tester` and `product-manager` in parallel. Each reviews `requirements.md` + `flows.md` + `wireframes.md` through its own lens and writes `reviews/round1/<agent>.md` (format below). The `tester` also drafts acceptance cases from the flows. Before moving on, a fresh `product-manager` instance runs the **traceability check** (see below).
6. **Questions to the Product Owner.** The orchestrator consolidates and deduplicates the questions (grouped by topic, ordered by impact, each with options and a recommendation), records them in `questions.md`, and asks in conversation. **Default rule:** a low-impact, easy-to-reverse question that the Product Owner leaves unanswered takes the recommended option and is logged under "Decisions taken by default" in `questions.md`, where the Product Owner can revert it. Blocking or hard-to-reverse questions are never defaulted. Hard-to-reverse architecture decisions become ADRs in `docs/adr/` (`architect`). If answers change flows or wireframes, return to step 2 or 3 for the affected parts only.
   - ✋ The Product Owner confirms the answers.
7. **Figma design** (`ui-ux-designer`, `figma.md`). The same screens in Figma, using the tokens and components of `docs/design-system.md`, with links and notes on what changed from the wireframes recorded in `figma.md`. Requires the Figma connector with write access: the orchestrator tests it on a sample frame at the start of the first epic that reaches this step. If it can only read, `ui-ux-designer` produces precise design specifications and the Product Owner's design team builds the Figma; this does not change the rest of the flow. An HTML prototype is an exception, used only for a complex interaction when the Product Owner asks or the designer justifies it.
   - ✋ The Product Owner reviews the Figma and approves it.
8. **Expert review, round 2** (automatic). The agents review the final design and the answers (`reviews/round2/<agent>.md`): fidelity to the flows, accessibility, technical feasibility, conflicts. Repeat only if real blockers remain; do not loop for polish.
9. **Spec** (`spec.md`). The `product-manager` merges requirements, flows, answers, design and review feedback into the spec: scope, requirements with IDs and acceptance criteria, decisions taken (linking ADRs), design and test approach at the level needed, delivery order, and remaining risks. No separate plan document unless the epic is large. The `tester` turns the acceptance criteria into failing automated acceptance tests when the first implementation task needs them (listed in `tasks.md`).
   - ✋ *"Is the spec approved? Shall I create the tasks?"*
10. **Tasks** (`tasks.md`). Small, ordered, traceable to requirements, each assigned to an agent role (see "Task execution").
    - ✋ *"Shall I start executing the tasks?"*
11. **Implementation.** Tasks run as described below, then are accepted by the `product-manager` against the spec.

### Traceability check

Before each ✋ from step 4 onward, a fresh `product-manager` instance checks the chain requirement → flow → screen → (Figma) → spec → task → test and writes a short report (`traceability.md`): gaps, contradictions, and anything that is not traceable to a requirement the Product Owner approved. The orchestrator fixes or reports the findings before asking for approval.

### What is never automatic

Product decisions and scope changes, the spec, `git push`, and hard-to-reverse architecture decisions (ADRs). These always go to the Product Owner.

## Task execution

- **Every task is given to a new agent instance with a fresh context.** Never continue a previous agent's session for a new task.
- Consecutive tasks may go to the same role (e.g. three tasks in a row to `developer`), but each one is a **separate, new** agent invocation, run **sequentially** by default. Run tasks in parallel only if the task list marks them independent.
- Because the agent starts with no memory, each task in `tasks.md` must be **self-contained**: goal, related requirement IDs, acceptance criteria, files/docs to read first (spec, ADRs, design-system, relevant code), dependencies, what is out of scope for the task, and the expected output (code, tests, docs, commit).
- Hand-off between tasks happens through **files** (code, tests, docs, task status in `tasks.md`), never through conversation memory.
- The orchestrator updates the task status in `tasks.md` after each task (todo / in progress / done / blocked), reports results honestly, and surfaces blockers or questions to the Product Owner instead of letting an agent guess.
- Typical rhythm per task: `developer` implements → `tester` verifies (fresh agent) → `architect`/`ui-ux-designer` review when relevant → `product-manager` accepts against the acceptance criteria. Lint, typecheck and tests are automatic gates before each commit.
- **Batch reporting:** the orchestrator runs tasks without asking between them and reports to the Product Owner every few tasks (what was done, doubts raised, how to try it). It stops and asks immediately if a gate fails twice in a row, or if a decision touches the product, scope or design.

## Folder convention

```
specs/NNN-epic-name/
  requirements.md   # step 1: high-level requirements, as given by the Product Owner
  flows.md          # step 2: flows, stories, rules, screen/state inventory, acceptance criteria
  wireframes.md     # steps 3-4: ASCII wireframes, versioned (v1, v2...)
  reviews/
    round1/         # step 5: one file per agent (architect.md, developer.md, ...)
    round2/         # step 8
  questions.md      # step 6: consolidated questions, answers, decisions taken by default
  figma.md          # step 7: Figma links and changes from the wireframes
  traceability.md   # traceability check report (updated at each checkpoint)
  spec.md           # step 9: the approved specification
  tasks.md          # step 10: self-contained tasks with status
```

## Review file format (`reviews/round<N>/<agent>.md`)

```
# Review by <agent> — <epic> — round N (1: requirements + flows + wireframes; 2: design and answers)

## Summary
Two or three lines: overall impression and the biggest issue.

## Concerns and gaps
- [blocker | important | minor] Concern, why it matters, which requirement it touches.

## Proposals
- Suggested approach or addition, with the reason. Mark anything beyond the stated requirements as "suggestion (not in scope unless approved)".

## Questions for the client
1. Question
   - Options: A / B / C
   - Recommendation: X, because ...
   - Impact if undecided: ...

## Risks and assumptions
- ...
```

Rules for reviews: be concrete and brief; proportionate to an MVP; do not decide for the Product Owner; keep your questions focused (the orchestrator deduplicates); never expand scope silently.

## Requirement IDs

Prefixed by epic and stage. High-level requirements: `FND-HR-01`. Flows: `FND-FL-01`. In the spec: `FND-FR-01`, `FND-NFR-01`. Tasks: `FND-T-01`. Never renumber; deprecate instead of reusing.

## Cross-cutting docs

Architecture, design system, and decisions are shared across epics and live in `docs/` (`docs/architecture.md`, `docs/design-system.md`, `docs/design/`, `docs/adr/`).
