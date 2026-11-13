# 0007. Theming mechanism and browser support floor

Status: Accepted
Date: 2026-11-12
Epic: 001-foundations

## Context
The PO decided light and dark themes that follow the system setting, with no toggle (questions.md Q12 B, spec D14). The mechanism was chosen by the ui-ux-designer and architect in `docs/design-system.md` 2.1 and implemented in FND-T-29; the browser support it implies was accepted by the PO afterwards (see Decision follow-up). Architecture.md previously called the mechanism a two-way door. It is recorded here because it sets a browser floor that is a product-visible support policy, and because the build breaks if the floor is lowered.

## Options considered
1. **CSS `light-dark()` per token, `color-scheme: light dark` on `:root`, no JavaScript, no class.** Pros: one declaration per token (no two blocks that drift), no flash on first paint, no provider, native controls follow `color-scheme`, `/design` can show both themes side by side with `data-theme` panels, a future manual toggle only sets `color-scheme`. Cons: requires Baseline 2024 browsers.
2. **shadcn default: `.dark` class on `<html>` plus `next-themes`.** Pros: widest browser support. Cons: two parallel token blocks, a provider and hydration/flash concerns, `dark:` utilities scattered in components.
3. **`prefers-color-scheme` media query with duplicated token blocks.** Pros: no JavaScript, wide support. Cons: duplicated tokens that can drift.

## Decision
Option 1 (design-system.md 2.1, FND-FR-15; verified by E2E: dark first paint works with JavaScript disabled, no theme script or class in server HTML). Consequences enforced in the repo:
- No `dark:` utilities, no `.dark` block, no `next-themes`; `viewport.colorScheme = "light dark"`.
- **`browserslist` floor** in `package.json`: `chrome >= 123`, `edge >= 123`, `firefox >= 120`, `safari >= 17.5`. Do not lower it or replace it with Next's default list: lightningcss would polyfill `light-dark()` into a rule resolved at `:root`, which breaks per-subtree theming (`data-theme` panels, any future toggle). Raising it is fine (architecture.md, Design system; ADR 0004 amendment).

## Consequences
- Positive: smallest theming surface, no flash, cheap toggle later.
- Negative: browsers older than the floor (about mid-2024) are not supported. This is the point that needs the PO.
- Revisit if analytics or a customer require older browsers: then switch to option 2 or 3 by editing only `globals.css`, since components use semantic tokens.

## Decision follow-up
The Product Owner accepted the browser floor of Chrome/Edge 123, Firefox 120 and Safari 17.5 (roughly mid-2024 and later) on 2026-11-12, so this ADR is Accepted.

## References
- `docs/design-system.md` 2.1 and 0.2, `docs/architecture.md` (Design system), `docs/adr/0004-env-and-secrets.md` (amendment FND-T-36), `specs/001-foundations/acceptance/step-7.md` (D14 met).
- MDN, CSS `light-dark()` (Baseline 2024).
