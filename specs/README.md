# Specs

Each big block of functionality (an "epic") lives in its own numbered folder. Epics are built in numeric order; each depends on the previous ones.

| # | Epic | Summary | Status |
|---|------|---------|--------|
| 001 | [foundations](001-foundations/requirements.md) | Basic Next.js skeleton, Supabase database + CLI, Docker, frontend stack and design system, testing, CI/CD and security checks. Many decisions still open. | Done (see [final acceptance](001-foundations/acceptance/final.md)) |
| 002 | [platform-hardening](002-platform-hardening/requirements.md) | Foundations that remain before the first module: error handling, structured logging and OpenTelemetry, security headers, database conventions, module scaffold. No cloud. | Spec and 62 tasks approved; in implementation (step 1) |
| 003 | [auth-memberships](003-auth-memberships/requirements.md) | Sign-up, login, empty dashboard, tenants and memberships | High-level requirements (to be re-reviewed under the simplified workflow; depends on 002) |

> **Renumbering note (2026-11-13):** auth and memberships was first planned as epic 002 and is now epic 003. Mentions of "epic 002" in the epic 001 documents, ADRs 0001-0011 and older code comments mean what is now 003-auth-memberships. They are left as written to preserve history.

## Roles

| Role | Who | Responsibility |
|------|-----|----------------|
| **Product Owner (client)** | The user | Owns the product and every decision. Describes what they want in conversation, answers questions, approves each checkpoint. |
| **Orchestrator** | The main Claude session | Talks to the Product Owner, records the conversation, launches agents, collects their output, asks the Product Owner the questions that apply, chains the automatic steps, and asks permission at every ✋ checkpoint. Does not make product decisions. |
| **Specialist agents** | Subagents in `.claude/agents/`: `product-manager`, `architect`, `developer`, `ui-ux-designer`, `tester` | Each works through its own lens, writes to files, and returns questions instead of deciding. |

## How we work (per epic)

Two control levels: **✋ checkpoints** are decisions that belong to the Product Owner; the orchestrator never advances past them without explicit approval. **Automatic steps** are chained by the orchestrator without asking, and reported afterwards. The process is not strictly linear: if feedback changes scope, flows or screens, go back to the affected step and re-do only what changed.

**Principle: process effort is proportional to risk.** The goal is good decisions made early and cheaply, not documents. Every review, report and ADR must earn its cost.

### When the screen steps apply

Steps 3 (ASCII wireframes) and 6 (Figma) run only for **a new user-facing screen with functionality or a substantial change (about half or more) of an existing one**, and only when the screen is **not obvious**: two developers could reasonably implement it in different ways (non-trivial layout or interaction, a pattern not yet in `docs/design-system.md`). They do not run for epics with no UI, small tweaks, trivial pages (500, 404), or screens that repeat an existing pattern. In those cases `flows.md` lists the screen's states and the design-system components it uses, and the orchestrator states in chat that the screen steps were skipped. The Product Owner can always ask for them.

### Steps

```
1 Requirements ✋ → 2 Flows ✋ → 3 ASCII wireframes + walkthrough ✋ (screens only)
  → 4 Review (auto, text only) → 5 Questions ✋ → 6 Figma ✋ (screens only)
  → 7 Spec ✋ → 8 Tasks ✋ → 9 Implementation (auto, gated) → 10 Verification and acceptance
```

1. **High-level requirements** (`requirements.md`). The Product Owner and the orchestrator talk; the orchestrator (with the `product-manager` agent) records functional and non-functional requirements at a high level, as given, with nothing invented. Unknowns are marked `OPEN`.
   - ✋ *"Do you want to read it first, change anything, or shall I move to flows?"*
2. **Flows** (`flows.md`, by `product-manager`). Turns the requirements into: actors, step-by-step flows (happy, alternative and error paths), business rules, a screen and state inventory (empty, loading, error, success), and acceptance criteria in Given/When/Then, with IDs (`AUTH-FL-01`). It also states which screens need steps 3 and 6, by the rule above. Adds nothing beyond the requirements: new ideas go to open questions.
   - ✋ The Product Owner approves `flows.md` and the list of screens that get a design.
3. **ASCII wireframes and walkthrough** (`wireframes.md`, by `ui-ux-designer`; screens only). One section per screen, with all states, navigation and the requirement/flow IDs covered, built on `docs/design-system.md`. The orchestrator presents the screens one by one in chat and applies the Product Owner's feedback (`v2`, `v3`...), re-presenting only changed screens. **No agent reviews the wireframes: the Product Owner is the reviewer.**
   - ✋ The Product Owner closes the wireframes. They are the structural contract.
4. **Review** (automatic, one round, on text only: requirements, flows, approved wireframes). The orchestrator launches the reviewers in parallel; each writes `reviews/<agent>.md` (format below).
   - `architect` and `tester`: always.
   - `product-manager`: only if the epic touches product scope or rules.
   - `developer`: only if there is unusual technical risk.
   - `ui-ux-designer`: not a reviewer here (see principle: no agent reviews design).
   - Each reviewer reports **blockers and important findings only, at most about 8, no "minor" items**. Anything else is dropped or goes to `backlog.md`.
   - The `tester` also drafts Given/When/Then acceptance cases from the flows.
5. **Questions** (`questions.md`). The orchestrator consolidates and deduplicates the findings into questions (grouped by topic, ordered by impact, each with options and a recommendation) and asks in conversation. **Default rule:** a low-impact, easy-to-reverse question left unanswered takes the recommended option and is logged under "Decisions taken by default", where the Product Owner can revert it. Blocking or hard-to-reverse questions are never defaulted. Answers that change flows or wireframes are applied to those files now, while changes are cheap. An **ADR** is written (`architect`) only for a hard-to-reverse decision that had real alternatives; conventions and facts go in `docs/architecture.md`.
   - ✋ The Product Owner confirms the answers.
6. **Figma** (`figma.md`, by `ui-ux-designer`; screens only). The approved wireframes, rendered visually with the tokens and components of `docs/design-system.md`; changes from the wireframes are recorded in `figma.md`. Requires the Figma connector with write access: the orchestrator tests it on a sample frame at the start of the first epic that reaches this step. If it can only read, `ui-ux-designer` produces precise design specifications and the Product Owner's design team builds the Figma. **No agent reviews the Figma: the Product Owner reviews the visual result.** A second review round happens only if the Figma or the answers changed scope or structure in a material way.
   - ✋ The Product Owner approves the Figma.
7. **Spec** (`spec.md`, by `product-manager`). Merges requirements, flows, answers, design and review feedback: scope, requirements with IDs and acceptance criteria, decisions taken (linking ADRs), design and test approach at the level needed, delivery order, and remaining risks. No separate plan document unless the epic is large.
   - ✋ *"Is the spec approved? Shall I create the tasks?"*
8. **Tasks** (`tasks.md`). Small, ordered, traceable to requirements, each assigned to an agent role (see "Task execution"). Keep each task short (about 5 to 10 lines) with a clear done criterion; do not log execution narratives in this file.
   - ✋ *"Shall I start executing the tasks?"*
9. **Implementation.** Tasks run as described below.
10. **Verification and acceptance.** See "Verification".

### Traceability check

Once, before the ✋ of step 7 (spec), a fresh `product-manager` instance checks the chain requirement → flow → screen → (Figma) → spec → task → test and writes a short report (`traceability.md`): gaps, contradictions, and anything not traceable to a requirement the Product Owner approved. The orchestrator fixes or reports the findings before asking for approval. It is not repeated at every checkpoint.

### Verification

- **Security-critical steps** (RLS and data access, authentication, deploy and CI gates): one focused verification by a fresh `tester` instance, with a shell, after the step is implemented.
- **End of epic:** one single acceptance document `acceptance.md` (a table of requirement ID, evidence, verdict: met / partially / not met / deferred), written by the `product-manager`. The acceptor must have shell access and re-run the key commands itself; evidence taken only from another agent's notes is marked as such.
- **If the epic has UI:** the `ui-ux-designer` compares the implemented screens against the Product Owner's approved wireframes/Figma and the design system once, at the end.
- No per-step acceptance documents, no per-step verification documents outside the first bullet.

### Findings, backlog and scope

- A new finding during implementation or verification becomes a task in the current epic **only if it is a blocker** (the epic cannot meet a requirement, or it is a security issue). Everything else goes to `backlog.md` in the epic folder, with a one-line description, and is considered when planning a later epic.
- Fix tasks added during execution are listed in the spec change log in the same commit that adds them.
- Do not write documentation that duplicates another document; do not make docs-only commits to update status (see Task execution).

### What is never automatic

Product decisions and scope changes, the spec, `git push`, and hard-to-reverse architecture decisions (ADRs). These always go to the Product Owner.

## Task execution

- **Every task is given to a new agent instance with a fresh context.** Never continue a previous agent's session for a new task.
- Consecutive tasks may go to the same role (e.g. three tasks in a row to `developer`), but each one is a **separate, new** agent invocation, run **sequentially** by default. Run tasks in parallel only if the task list marks them independent.
- Because the agent starts with no memory, each task in `tasks.md` must be **self-contained**: goal, related requirement IDs, acceptance criteria, files/docs to read first (spec, ADRs, design-system, relevant code), dependencies, what is out of scope for the task, and the expected output (code, tests, docs, commit).
- Hand-off between tasks happens through **files** (code, tests, docs, task status in `tasks.md`), never through conversation memory.
- The task's status in `tasks.md` is set to done **in the same commit** that completes the task (never a separate docs-only commit). The orchestrator reports results honestly, and surfaces blockers or questions to the Product Owner instead of letting an agent guess.
- Typical rhythm per task: `developer` implements → the task's own tests and gates (lint, typecheck, tests) must pass before the commit. A fresh `tester` or an `architect` review is added only for security-critical tasks (see "Verification"). Acceptance happens at the end of the epic, not per task.
- **Batch reporting:** the orchestrator runs tasks without asking between them and reports to the Product Owner every few tasks (what was done, doubts raised, how to try it). It stops and asks immediately if a gate fails twice in a row, or if a decision touches the product, scope or design.

## Folder convention

```
specs/NNN-epic-name/
  requirements.md   # step 1: high-level requirements, as given by the Product Owner
  flows.md          # step 2: flows, rules, screen/state inventory, acceptance criteria
  wireframes.md     # step 3: ASCII wireframes, versioned (v1, v2...); screens only
  reviews/          # step 4: one file per reviewer (architect.md, tester.md, ...)
  questions.md      # step 5: consolidated questions, answers, decisions taken by default
  figma.md          # step 6: Figma links and changes from the wireframes; screens only
  traceability.md   # single traceability check before the spec
  spec.md           # step 7: the approved specification
  tasks.md          # step 8: short self-contained tasks with status
  acceptance.md     # step 10: single end-of-epic acceptance table
  backlog.md        # non-blocking findings for later epics
```

## Review file format (`reviews/<agent>.md`)

```
# Review by <agent> — <epic>

## Summary
Two or three lines: overall impression and the biggest issue.

## Concerns and gaps
- [blocker | important] Concern, why it matters, which requirement it touches. At most about 8 per review; no minor items.

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

Rules for reviews: review text only (never visual design); be concrete and brief; proportionate to an MVP; do not decide for the Product Owner; keep your questions focused (the orchestrator deduplicates); never expand scope silently.

## Requirement IDs

Prefixed by epic and stage. High-level requirements: `FND-HR-01`. Flows: `FND-FL-01`. In the spec: `FND-FR-01`, `FND-NFR-01`. Tasks: `FND-T-01`. Never renumber; deprecate instead of reusing.

## Cross-cutting docs

Architecture, design system, and decisions are shared across epics and live in `docs/` (`docs/architecture.md`, `docs/design-system.md`, `docs/design/`, `docs/adr/`).
