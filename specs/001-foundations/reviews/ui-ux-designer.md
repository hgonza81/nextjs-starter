# Review by ui-ux-designer — 001-foundations — round 1

## Summary
The UI requirements (FND-HR-04, FND-HR-05) are fully open, which is fine at this stage, but they are the foundation of every screen in epic 002 (sign-up, login, dashboard). The biggest gap is that nothing states how visual consistency is enforced (tokens, shared components, theming). My recommendation is a small, token-driven system on Tailwind CSS plus shadcn/ui (Radix primitives), documented in `docs/design-system.md`, with only the components epic 002 needs.

## Concerns and gaps
- [important] FND-HR-04: UI library, styling approach, and starting point are undecided. Epic 002 screens (forms with validation, password field, alerts, an app shell with sign-out) depend on them. Late choice means rework.
- [important] FND-HR-05: "Design system" has no defined scope. Without a boundary it can grow speculatively, which conflicts with FND-HR-11. It needs a minimal definition: tokens plus base components needed by epic 002.
- [important] Consistency enforcement is not stated (FND-HR-05, FND-HR-10). If developers can use raw colors, spacing, or one-off components, the system will drift. Needs a rule and ideally lint or review support.
- [important] Accessibility is only a requirement in epic 002 (AUTH-NFR-04). Building it into the base components (focus ring, labels, error association, target size, contrast) in epic 001 is far cheaper than retrofitting.
- [minor] Dark mode is unmentioned. Retrofitting it later is costly if colors are not semantic tokens from the start.
- [minor] Responsiveness is only in epic 002 (AUTH-NFR-05). Breakpoints, container widths, and the layouts (auth layout, app shell) should be defined once in foundations.
- [minor] No mention of font, icon set, or brand color (name, logo). These are taste decisions that block a finished look but not the technical setup.
- [minor] No mention of a way to see components in isolation (living page or Storybook). Not needed now.

## Proposals
- **Stack**: Tailwind CSS plus shadcn/ui (accessible Radix primitives; code is copied into the repo and owned; theming via CSS variables). Icons: Lucide. Font: one font via `next/font`. Verify current versions and Tailwind/Next compatibility in official docs when the spec is written.
- **Starting point**: no purchased or third-party full template. Start from shadcn/ui defaults with a neutral theme and one primary color, so there is nothing to strip out and no lock-in.
- **Design system scope for this epic** (`docs/design-system.md`, kept small):
  - Tokens: semantic color roles (background, foreground, muted, border, primary, destructive, ring, plus success/warning/info), type scale, 4px spacing scale, radius, shadow, motion, breakpoints. Defined as CSS variables, mapped into the Tailwind theme.
  - Light and dark themes via the same semantic tokens (dark values defined now; a user toggle is a separate decision).
  - Base components only what epic 002 needs: Button, Input, Label, FormField (label, control, hint, error), Password input with show/hide, Alert, Card, Spinner/Skeleton, Auth layout, App shell (header, content, sign-out). Avatar/user menu only if the spec asks.
  - Patterns: form validation timing, error messages, loading, empty state (the empty dashboard), content and tone rules.
- **Consistency enforcement**: rule "no raw color/spacing values and no one-off components; add to the system first", checked in design review; optionally a lint rule against arbitrary Tailwind values and hex colors (architect/developer to judge feasibility).
- **Accessibility baseline**: WCAG 2.2 AA built into base components; contrast checked for both themes; optional automated a11y checks (e.g. axe in E2E tests) coordinated with the tester.
- **Responsive**: mobile-first, with a single auth layout and app shell defined once.
- suggestion (not in scope unless approved): a living component page or Storybook, visual regression tests, a logo and illustrations. Revisit when screens multiply.

## Questions for the client
1. Which UI approach do you want?
   - Options: A) Tailwind CSS + shadcn/ui (Radix) / B) A packaged component library (e.g. MUI, Mantine) / C) Tailwind only, hand-built components
   - Recommendation: A, because it is accessible by default, the code is owned (no lock-in), theming is token-driven, and it is the most common choice for Next.js SaaS starters.
   - Impact if undecided: blocks the design system, all epic 002 screens, and component work.
2. What is the visual starting point?
   - Options: A) shadcn/ui defaults with a neutral theme and our own primary color / B) A paid or free SaaS template / C) A fully custom look
   - Recommendation: A, because it is minimal, has no lock-in, and is easy to restyle through tokens.
   - Impact if undecided: delays tokens and layouts; a template chosen later may force rework.
3. Brand color, tone, and logo: do you have a brand color or logo?
   - Options: A) I provide them / B) You pick a sensible default (e.g. a calm blue or indigo primary, friendly and concise tone, text-only wordmark) and I change it later / C) Other
   - Recommendation: B, because tokens make a later change cheap and it does not block work.
   - Impact if undecided: none technically; the default is used.
4. Dark mode?
   - Options: A) Light only / B) Light and dark following the system setting / C) Light and dark with a user toggle
   - Recommendation: B, because defining both token sets now is cheap; a toggle needs UI and persistence and can come later.
   - Impact if undecided: A means retrofitting later if needed; C adds a small piece of UI beyond the current scope.
5. Should accessibility (WCAG 2.2 AA) and responsive behavior be required from the base components in this epic, rather than only in epic 002?
   - Options: A) Yes, built into the base components now / B) Only verified per screen in epic 002
   - Recommendation: A, because it avoids rework and costs almost nothing when done at component level.
   - Impact if undecided: risk of inaccessible base components that must be reopened later.

## Risks and assumptions
- Assumes the epic 002 screens (sign-up, login, empty dashboard with sign-out) define the minimum component set; if the spec adds screens, the system grows accordingly.
- Risk: design system scope creep. Mitigation: add components only when a screen needs them.
- Risk: Tailwind and shadcn/ui versions and Next.js compatibility change quickly; to be verified in current official docs at spec time.
- Assumption: UI copy is English only (per AGENTS.md); i18n is not required now, but copy is kept in one consistent voice so it can be extracted later.
- Assumption: the UI term for a tenant is "company", as in epic 002.

---

# Review by ui-ux-designer — 001-foundations — round 2

## Summary
My round 1 recommendations were accepted (Tailwind + shadcn/ui, tokens plus the epic 002 component set, a `/design` showcase page, light/dark following the system, WCAG 2.2 AA in base components), so I raise no new blocker on them. The new fact is the PO's expectation of ~50 tables with full CRUD: that makes data-heavy screens (tables, create/edit forms, delete confirmations, feedback, deep navigation) the dominant UI of the product. My recommendation is to keep the 001 build bounded as accepted, but to **decide now the few things that are hard to change later** (app shell navigation structure, form and feedback conventions, table approach) as documented patterns, and to build the heavier components only when the first CRUD screen needs them.

## Concerns and gaps
- [important] Scope tension with the accepted Q11 (option B, "only what epic 002 needs"). With 50 CRUD tables, Table, Dialog/AlertDialog, Toast, Select, Dropdown menu, Tabs, Pagination, Badge, and Empty state will certainly be needed. Building them all in 001 would be speculative (and 001 is now already larger because of the ORM and Vercel decisions); building none and leaving the conventions undecided means each CRUD epic invents its own, which is exactly the drift the design system exists to prevent.
- [important] The app shell is the hard-to-change piece. Epic 002 only needs a header with sign-out, but a 50-table app needs a navigation structure (sidebar with grouped entries, collapsible on mobile, breadcrumbs, a place for the company name/switcher). If the 002 shell is header-only, it will be reworked when navigation arrives, touching every page. The shell layout should be designed for growth now, even if only one nav item is rendered.
- [important] Conflict between "no speculative work" (FND-HR-11) and the PO's CRUD expectation. The PO already overrode minimalism for the ORM. I read the same intent for the UI: prepare conventions, not components. I flag it so the PO confirms the boundary (see Proposals) rather than assume.
- [important] Form stack integration. Q7 accepted React Hook Form + Zod. FormField must be built on that (shadcn's Form/Field primitives wrap RHF), with the same Zod schema as the Server Actions. CRUD forms will be much more varied than auth forms (select, textarea, checkbox, date, multi-field validation, server-side field errors). FormField should therefore be designed generically from the start (control-agnostic, error and hint slots, `aria-describedby` wiring), not only for text inputs.
- [important] Table strategy is a long-lived decision. Server-side pagination, sorting, filtering, and URL-synced state across 50 tables should be one reusable pattern, not 50 variants. Choosing the data-table approach (e.g. shadcn Table plus TanStack Table, with state in the URL search params) is worth an ADR-level decision before the first CRUD epic, but implementation can wait.
- [minor] Feedback conventions are undefined: toast for success of a mutation, inline alert for form-level errors, field-level errors inline, confirm dialog for destructive actions. Without a rule, each module picks differently.
- [minor] The `/design` page: it must be excluded or protected in production (it is a dev/acceptance artifact), and it should render every component in every state in both themes, so that the axe check in E2E covers the whole system at once. It will also need to grow with each added component (a Definition of Done item for any new component).
- [minor] Dark mode mechanics. shadcn defaults use a `.dark` class. "Following the system" with no toggle means mapping `prefers-color-scheme` to the same tokens (or a tiny script), and it should not flash on load. A later toggle should then be an addition, not a rewrite. Verify the current Tailwind and shadcn approach in official docs at spec time.
- [minor] Density and scale. Data-heavy admin screens need a defined default density (row height, table text size 14px, 44px touch targets on mobile versus compact on desktop) and rules for very long text, truncation, and empty tables. Cheap to define as tokens now, costly to retrofit.
- [minor] Long-lived consistency enforcement (lint against raw hex/arbitrary values) matters more at 50 tables; keep it as an architect/developer feasibility check, not a blocker.

## Proposals
- **Keep Q11 option B as the 001 build scope** (tokens, light/dark, the epic 002 components, `/design` page), and add a **documented-only** layer in `docs/design-system.md` ("Patterns for CRUD", decisions without code), so that conventions exist before the first CRUD screen:
  - Navigation: app shell with a sidebar (collapsible to a drawer on mobile), top bar with company name and user menu, page header (title, description, primary action on the right), breadcrumbs for depth of 2 or more. Built in 001/002 as the shell structure with a single nav item.
  - Page templates: list page (header, filters, table, pagination), detail page, create/edit form page (or dialog for small forms), settings page.
  - Table pattern: server-side pagination/sort/filter, state in URL params, skeleton loading rows, empty state with a primary action, row actions in a dropdown, a defined mobile fallback (horizontal scroll inside the container or card list).
  - Forms: validation timing, server field errors mapped to fields, dirty-state guard, one primary action, cancel always available.
  - Feedback: toast for mutation success (Sonner via shadcn), inline Alert for form-level errors, AlertDialog for destructive actions with the item named in the copy, undo where cheap.
  - Content rules for CRUD verbs: Create, Save changes, Delete (never "Remove" for deletion), plural/singular entity naming from the spec glossary.
- **Build on demand, not now**: Table/DataTable, Dialog/AlertDialog, Toast, Select, Dropdown menu, Tabs, Pagination, Badge, Textarea, Checkbox, Breadcrumb. shadcn/ui adds them by copying the component from the CLI, so on-demand cost is low and they inherit the same tokens. The rule: the epic that first needs a component adds it to the system and to `/design` before using it.
- **Small exception worth doing in 001 (PO to confirm):** install and theme the toast provider (Sonner) and mount it once in the root layout, because the mount point is global and cheap; and design the app shell with the sidebar structure now. Everything else waits.
- **Definition of Done for any component**: built from tokens only, all states, both themes, keyboard operable, listed on `/design`, passes the axe check. This is the scalable form of the accessibility decision.
- **`/design` page**: available in development and in CI/E2E, not linked from the product navigation, disabled (404) in production unless the PO prefers it public.
- **Density tokens**: define default control heights and table row height tokens now (e.g. comfortable 40px, compact 32px desktop; 44px touch targets on mobile).
- **ADR candidate for the architect**: data table and URL-state approach, decided in the first CRUD epic, not in 001.

## Questions for the client
No blocking questions. Two confirmations with recommended defaults, which do not block work:
1. Confirm the scope boundary for the design system given ~50 CRUD tables?
   - Options: A) Keep 001 as accepted (epic 002 components and `/design`) plus documented CRUD patterns and the sidebar-ready app shell and toast provider; heavier components are added by the first epic that needs them / B) Build the full CRUD kit (table, dialogs, toasts, dropdowns, tabs, pagination) now / C) Keep strictly to epic 002 with no CRUD patterns documented.
   - Recommendation: A, because it removes the expensive-to-change decisions without building unused components.
   - Impact if undecided: A is used. B enlarges 001 and risks components designed without a real screen; C risks inconsistent CRUD screens.
2. Should `/design` be hidden in production?
   - Options: A) Dev/CI only / B) Public.
   - Recommendation: A.
   - Impact if undecided: A is used.

## Risks and assumptions
- Assumption: CRUD screens are standard admin patterns (lists, forms, detail pages), not dashboards or charts; charts/analytics components are out of scope until a spec asks.
- Risk: documented patterns drift from the real components if not kept in sync. Mitigation: the first CRUD epic must update the patterns section and `/design` as part of its Definition of Done.
- Risk: 001 grows because of the ORM and Vercel decisions; the design scope above is deliberately small to compensate. Flagging that the epic may be split by the product-manager if it becomes too large.
- Risk: designing the sidebar shell before having real navigation content may need small adjustments. Accepted, as it is cheaper than reworking every page.
- Assumption: versions and compatibility (Tailwind, shadcn/ui, Next.js, Sonner, TanStack Table) are verified in official docs at spec time.
- Assumption: still English only, no i18n, and the UI term for a tenant is "company".
