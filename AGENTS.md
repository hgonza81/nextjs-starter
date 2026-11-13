# AGENTS.md

## Language rule (MANDATORY)

**Everything in this project must be written in English.** No exceptions. This includes:

- Source code, identifiers, comments, and commit messages
- UI text, labels, validation and error messages
- Documentation (specs, plans, tasks, architecture, ADRs, design system, READMEs)
- Tests and test descriptions
- Database objects (tables, columns, migrations)
- Task descriptions, plans, and agent output written to files

The user may talk to you in Spanish; you may reply to them in Spanish in chat, but any file or artifact you create must be in English.

## Project

SaaS starter built with Next.js (App Router, strict TypeScript) and Supabase (Auth + Postgres). Multi-tenant: a **tenant** is a company; users belong to tenants through **memberships**.

## Workflow

Work is organized in epics under `specs/NNN-epic-name/` (see `specs/README.md`, which defines the full process and the review file format). Each epic goes through these phases in order: high-level requirements (`requirements.md`) → product refinement (`flows.md`) → ASCII wireframes (`wireframes.md`) and guided walkthrough with the client → expert review round 1 (`reviews/round1/`) → client answers (`questions.md`) → Figma design (`figma.md`) → expert review round 2 (`reviews/round2/`) → `spec.md` → `tasks.md` → implementation. Wireframes, the guided walkthrough and Figma apply only to epics with functional screens. The client approves at ✋ checkpoints (requirements, flows, wireframes, answers, Figma, spec, tasks); reviews, consolidation, document updates and task execution run automatically. The flow is not strictly linear: if feedback changes scope, flows or screens, go back only to the affected step. The full process is in `specs/README.md`.

Roles: the user is the **Product Owner (client)** and owns every decision; the main Claude session is the **orchestrator** (talks to the user, launches agents, consolidates questions, asks permission at every ✋ checkpoint and chains the automatic steps); the subagents are the specialists. Never make a decision that belongs to the Product Owner: ask, with options and a recommendation. Decisions are recorded (ADRs for architecture).

Task execution: **each task is run by a new agent instance with a fresh context** (never continue a previous agent's session for a new task), sequentially by default. Tasks in `tasks.md` are therefore self-contained, and hand-off happens through files, not conversation memory.

Git workflow (applies to every task, so `tasks.md` does not need to repeat it): single branch `main`, no feature branches, no PRs. **Each completed task ends with exactly one local commit** (plain descriptive message; Conventional Commits suggested, e.g. `feat(db): ...`; the task ID in the commit body, e.g. `Task: FND-T-12`), made only after lint, typecheck and the existing tests pass. **Commits must NOT contain `Co-Authored-By` trailers or any other mention of Claude, Copilot or any AI tool, so that no AI appears as a GitHub contributor** (the commit author is the Product Owner's configured git identity; the same applies to PR descriptions and generated files). **Agents never run `git push`**; only the orchestrator pushes, when the Product Owner has authorized it. Workflows run on every push; a failing run is fixed afterwards.

Cross-cutting docs live in `docs/`: architecture (`docs/architecture.md`), design system (`docs/design-system.md`), and architecture decisions in `docs/adr/` (see its README). Every hard-to-reverse architecture decision must have an ADR.

Do not add functionality beyond what the epic's requirements/spec state.

## Subagents (`.claude/agents/`)

- `product-manager`: specs, requirements, scope, tasks
- `architect`: architecture, data model, RLS, ADRs
- `ui-ux-designer`: design system, screens, accessibility
- `developer`: implementation
- `tester`: automated tests and acceptance verification

Delegate each task to the agent that owns that kind of work.

## Structure

Modules live in `src/modules/{auth,users,tenants}`; each exposes a public API through `index.ts` and must not import another module's internals.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
