# Specs

Each big block of functionality (an "epic") lives in its own numbered folder. Epics are built in numeric order; each depends on the previous ones.

| # | Epic | Summary | Status |
|---|------|---------|--------|
| 001 | [foundations](001-foundations/requirements.md) | Basic Next.js skeleton, Supabase database + CLI, Docker, frontend stack and design system, testing, CI/CD and security checks. Many decisions still open. | Done (see [final acceptance](001-foundations/acceptance/final.md)) |
| 002 | [auth-memberships](002-auth-memberships/requirements.md) | Sign-up, login, empty dashboard, tenants and memberships | High-level requirements (to be re-reviewed) |

## Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Product Owner (client)** | The user | Owns the product and every decision. Describes what they want in conversation, answers questions, approves each checkpoint. |
| **Orchestrator** | The main Claude session | Talks to the Product Owner, records the conversation, launches agents, collects their output, asks the Product Owner the questions that apply, and asks permission before every phase change. Does not make product decisions. |
| **Specialist agents** | Subagents in `.claude/agents/`: `product-manager`, `architect`, `developer`, `ui-ux-designer`, `tester` | Each works through its own lens, writes to files, and returns questions instead of deciding. |

## How we work (per epic)

The Product Owner approves every transition. The orchestrator **always asks before moving to the next phase**; nothing advances on its own.

```
1 Requirements → ✋ → 2 Review round → 3 Questions → 4 Second review → 5 Spec → ✋ → 6 Tasks → ✋ → 7 Implementation
```
(✋ = explicit approval from the Product Owner)

1. **High-level requirements** (`requirements.md`). The Product Owner and the orchestrator talk; the orchestrator (with the product-manager agent) records functional and non-functional requirements at a high level, as given, with nothing invented. Unknowns are marked `OPEN`.
   - ✋ When `requirements.md` is written, the orchestrator asks: *"Do you want to read it first, change anything, or shall I send it to the agents for review?"*
2. **Review round.** On approval, the orchestrator launches the agents (architect, developer, ui-ux-designer, tester, product-manager) in parallel. Each reads `requirements.md` through its own lens and writes `reviews/<agent>.md` in the format below: concerns, gaps, risks, proposals, and questions for the client.
3. **Questions to the Product Owner.** The orchestrator reads all reviews, consolidates and deduplicates the questions (grouped by topic, ordered by impact, each with options and a recommendation), records them in `questions.md`, and asks the Product Owner in conversation. The Product Owner answers; answers are recorded in `questions.md`. Hard-to-reverse architecture decisions become ADRs in `docs/adr/` (architect).
4. **Second review.** The orchestrator sends the answers back to the agents. They confirm, raise follow-ups, or flag conflicts. Repeat 3–4 only if real blockers remain; do not loop for polish.
5. **Spec** (`spec.md`). With the agents' final feedback, the product-manager merges requirements, answers, and feedback into the spec: scope, requirements with IDs and acceptance criteria, decisions taken (linking ADRs), design and test approach at the level needed, delivery order, and remaining risks. No separate plan document unless the epic is large.
   - ✋ The Product Owner reads the spec. The orchestrator asks: *"Is the spec approved? Shall I create the tasks?"*
6. **Tasks** (`tasks.md`). Small, ordered, traceable to requirements, each assigned to an agent role (see "Task execution"). 
   - ✋ The Product Owner reviews them. The orchestrator asks: *"Shall I start executing the tasks?"*
7. **Implementation.** Tasks are executed as described below, then accepted by the product-manager against the spec.

## Task execution

- **Every task is given to a new agent instance with a fresh context.** Never continue a previous agent's session for a new task.
- Consecutive tasks may go to the same role (e.g. three tasks in a row to `developer`), but each one is a **separate, new** agent invocation, run **sequentially** by default. Run tasks in parallel only if the task list marks them independent.
- Because the agent starts with no memory, each task in `tasks.md` must be **self-contained**: goal, related requirement IDs, acceptance criteria, files/docs to read first (spec, ADRs, design-system, relevant code), dependencies, what is out of scope for the task, and the expected output (code, tests, docs, commit).
- Hand-off between tasks happens through **files** (code, tests, docs, task status in `tasks.md`), never through conversation memory.
- The orchestrator updates the task status in `tasks.md` after each task (todo / in progress / done / blocked), reports results honestly, and surfaces blockers or questions to the Product Owner instead of letting an agent guess.
- Typical rhythm per task: `developer` implements → `tester` verifies (fresh agent) → `architect`/`ui-ux-designer` review when relevant → `product-manager` accepts against the acceptance criteria.

## Folder convention

```
specs/NNN-epic-name/
  requirements.md   # step 1: high-level requirements, as given by the Product Owner
  reviews/          # steps 2 and 4: one file per agent (architect.md, developer.md, ...)
  questions.md      # step 3: consolidated questions and the Product Owner's answers
  spec.md           # step 5: the approved specification
  tasks.md          # step 6: self-contained tasks with status
```

## Review file format (`reviews/<agent>.md`)

```
# Review by <agent> — <epic> — round N

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

Prefixed by epic and stage. High-level requirements: `FND-HR-01`. In the spec: `FND-FR-01`, `FND-NFR-01`. Tasks: `FND-T-01`. Never renumber; deprecate instead of reusing.

## Cross-cutting docs

Architecture, design system, and decisions are shared across epics and live in `docs/` (`docs/architecture.md`, `docs/design-system.md`, `docs/design/`, `docs/adr/`).
