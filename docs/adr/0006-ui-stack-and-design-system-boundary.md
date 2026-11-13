# 0006. UI stack and design-system boundary

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
The app is expected to grow to about 50 tables with full CRUD, so the UI foundation must be accessible, token-driven and cheap to extend. The Product Owner (PO) decided the stack (questions.md Q10, Q11, Q12 "accept all recommendations"; spec decisions D12, D13, D14; round 2: the system stays bounded). Replacing a component library later touches every screen, so this is a one-way door.

## Options considered
1. **Tailwind CSS + shadcn/ui on Radix, Lucide, one `next/font` font, components copied into the repo.** Pros: accessible primitives, code owned in the repo, token-driven, no runtime theme library. Cons: we maintain the copied components.
2. **Packaged library (MUI, Mantine, Chakra).** Pros: more components out of the box. Cons: heavier, harder to theme to our tokens, library upgrades drive our UI. Rejected by the PO (Q10 A).
3. **Tailwind only, hand-built components.** Pros: no third-party primitives. Cons: re-implements focus management, dialogs and drawers, with accessibility risk. Rejected (Q10).
4. **A purchased or existing SaaS template.** Rejected by the PO (Q10, FND-FR-14).
5. **shadcn on Base UI instead of Radix.** `shadcn init` pre-selects Base UI since July 2026 (design-system.md 0.2). Not chosen: the PO decision names Radix.

## Decision
Option 1, with these specifics (all implemented in epic 001):
- Tailwind CSS v4 (CSS-first, no `tailwind.config.js`), shadcn/ui on Radix (`radix-ui` package, `components.json` style `radix-nova`; no `@base-ui*`), `lucide-react`, one font: `geist` (bundled variable font through `next/font/local`, so builds and E2E work offline; `next/font/google` was rejected for that reason).
- **One token file**, `src/app/globals.css`. The Tailwind palette is reset (`--color-*: initial`), so only semantic role colors exist. The brand accent is one block in that file; the wordmark and product name are one component.
- **Bounded system** (PO Q11 B and round 2): only the components epic 002 needs (Button, Input, Label, FormField, PasswordInput, Alert, Card, Spinner/Skeleton, auth layout, sidebar-ready app shell, one Sonner toast provider). CRUD patterns (table, forms, feedback) are documented in `docs/design-system.md`, not coded. Each later epic adds components when it needs them and lists them on `/design`.
- **Owned components, no unused ones.** Components under `src/components/ui` are hand-adapted from the design document; each has a consumer. `cn` (shadcn's `clsx` + `tailwind-merge` replacement) provides the class helper.
- **Consistency rule** (design-system.md 1.1): no raw colors, no arbitrary Tailwind values, no one-off components. Enforced by `src/design-consistency.test.ts` (runs in `pnpm test`), not by ESLint (FND-FR-18 allows this), plus design review.
- **`/design` showcase** renders every component in every state in both themes, is not linked from the product, and is gated by `DESIGN_PAGE_ENABLED` (ADR 0004 amendment): on in development and E2E, 404 in production.
- WCAG 2.2 AA and mobile-first are built into the base components and checked by axe in E2E (ADR 0008). English only, no i18n tooling.
- Toasts use Sonner through shadcn's `sonner` wrapper (shadcn's own Toast is for Base UI only); `next-themes` is not installed (ADR 0007).

## Consequences
- Positive: accessible primitives with no theme provider, one place to rebrand, code we can change, a checkable consistency rule.
- Negative: we own and maintain the copied components; `shadcn` stays a runtime dependency only because `globals.css` imports `shadcn/tailwind.css` (architecture.md, Dependency notes).
- Revisit if the Radix-based shadcn line stops being maintained, or if a component set far beyond the bounded list is needed and building it ourselves costs more than adopting a library.

## References
- Specs: `specs/001-foundations/questions.md` (Q10, Q11, Q12, round 2), `spec.md` (D12 to D14, FND-FR-14 to FND-FR-18).
- `docs/design-system.md` (sections 0 to 2, 12), `specs/001-foundations/acceptance/step-7.md` (D12 to D14 verified as met).
- shadcn/ui changelog and docs (Base UI default, unified `radix-ui` package), as cited in design-system.md 0.2.
