# Design review, step 7 (FND-T-34)

**Reviewer:** ui-ux-designer. **Date:** 2026-11-12.
**Scope:** FND-FR-14 to FND-FR-18, FND-NFR-03, FND-NFR-04, FND-HR-05 (beautiful and consistent).
**Method:** code review of `src/app/globals.css`, `src/components/{ui,form,layout,brand}/*`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/design/**`, and visual review of the developers' screenshots (scratchpad). I could not run the app: hover, active and live focus were judged from code and the E2E assertions, not seen. Contrast was judged from the token values in `globals.css`; the exact ratios are enforced by `token-catalog.test.ts`.

## Summary (verdict)

**Pass, with one important fix and a short list of minor ones. No blockers.**

The implementation follows the document closely: one token file with `light-dark()`, no `dark:`, no raw colors or arbitrary values (my grep found only the documented `style={toasterStyle}` and two `(--sidebar-width)` references, both token references), a shared `focus-ring`, a global reduced-motion rule, correct FormField ARIA wiring, a well-built drawer and a consistent look in both themes. The screenshots read as calm, aligned and polished: consistent 24px rhythm in the card and form, a clear hierarchy in the shell, and the drawer and toast look right in dark.

The one thing that visually breaks the "beautiful and consistent" bar is the **dark auth page** (I1). Everything else is polish or documentation drift.

## Findings

### Blocker
None.

### Important

**I1. Dark auth layout inverts the elevation.** Evidence: `t31/_scratch_auth-dark-1280.png`, `auth-layout.tsx:36` (`bg-muted`). In light, a white card sits on a `#f5f5f5` page (card lighter than page, correct). In dark, `--muted` is `#262626` and `--card` is `#171717`, so the card is darker than the page behind it: it looks sunken, and it contradicts the rule in the doc (2.5) that dark surfaces get lighter as they rise. It is also the screen every new user sees first.
**Fix:** add one canvas token to the token file, `--canvas: light-dark(#f5f5f5, #0a0a0a)` (same as `--muted` light, same as `--background` dark), map it as `--color-canvas`, and use `bg-canvas` in `AuthLayout` instead of `bg-muted`. Add the row to design-system 2.2 (surface roles) and 5.1. Contrast is unaffected (text is inside the card). Add `--canvas` to `token-catalog` if it lists tokens.

### Minor

**M1. Skip link loses its padding when focused.** Evidence: `t31/skip-focused-1280.png` (text touches the border); `app-shell.tsx:49`. `focus:not-sr-only` resets padding to 0 and beats `px-4 py-2`. **Fix:** use `focus:px-4 focus:py-2` (and keep `focus-ring`). The 2px outline plus the border also reads as a double edge; dropping `border border-border` on the focused state is fine.

**M2. `/design` skips a heading level.** Evidence: `patterns-section.tsx:26` renders an `h4` directly under the section `h2` (no `h3`). The doc says heading levels never skip. **Fix:** make it an `h3` (or wrap the patterns in `Subsection`). Check the same in other sections with `grep "<h4"`.

**M3. `/design` copy does not match the tone guide and microcopy table (the page is the reference, so it must).** (a) Loading labels use three dots ("Saving...", `button-samples.tsx:45`) while 8.2 says the ellipsis character "Saving…". The same applies to the sr-only "Loading..." in `page-skeleton.tsx:13` and the document's own 4.8. Pick one and make doc and code agree; recommendation: the single character everywhere. (b) The form-level error sample says "We could not log you in. Check your email and password and try again." but 8.3 says "Incorrect email or password. Check your details and try again." (c) The empty-state sample says "Add your first project" with an "Add project" button: "project" is not in the glossary and the epic 002 empty dashboard has no action. Use 8.3's "Your dashboard is empty" with the muted sentence from the doc, and show the action as an optional second sample.

**M4. The 1280px frames are shown in a half-width panel.** Evidence: `layouts-section.tsx` and `sec-layouts.png`: at a 1280px viewport each theme panel is about 600px, so the 1280 frame is a horizontally scrolled window onto a desktop layout, and you never see the whole shell. 18 frames plus 18 focusable scroll wrappers also make the Tab path long. **Fix (cheap):** render the Layouts section as one column per theme stacked (not `lg:grid-cols-2`) for the 1280 frames, or scale frames with a wrapper. At minimum add a sentence saying the 1280 frame scrolls. Not a blocker; the layouts are also covered by the E2E tests.

**M5. PageHeader does not make the mobile primary action full width by itself.** `page-header.tsx` leaves `w-full` to the caller (the sample passes it). The doc (5.2) says "full-width primary on mobile". Left to callers it will drift between pages. **Fix:** wrap actions in a container that makes a single child button full width below `sm` (for example `[&>*]:w-full sm:[&>*]:w-auto`), or document it as a rule in 5.2 and the TSDoc. Prefer the component fix.

**M6. Wordmark in the app-shell sidebar is plain text, not a link.** `app-shell.tsx:55`. On the auth layout it links to `/`. Users expect the logo to go home. This is not a requirement for 001 (there is no product page to link to) and the right target is epic 002's dashboard; add as a suggestion (S3).

**M7. Documented but unverified by a human: hover and active states.** Code is right (`not-disabled:not-aria-disabled:` guards, tokens per variant). The E2E mutation table covers color assertions. No action.

## Decision on each flagged deviation

| # | Deviation | Decision | Reason and exact action |
|---|-----------|----------|-------------------------|
| 1 | Password toggle covers the 1px input border (`password-input.tsx:42`) | **Accept with note** | The button is the same radius as the input, so only the hover surface overlaps the 1px border; the idle look in `sec-components.png` is clean. An exact fit would need a `calc()` or a new utility for little gain. Doc 4.5: change "control height minus the border" to "fills the control height and sits over the border". Optional later: a `h-control-inner` utility. |
| 2 | Focused and invalid input keeps the destructive border while the ring outline shows | **Accept with note** | Correct priority: the field stays visibly invalid while focused, and focus is carried by the 2px ring outline (visible in `sec-components.png`, dark invalid password). The invalid meaning is also in the message and icon. Add one line to 4.2 States: "Focused and invalid: destructive border plus the focus outline". |
| 3 | Button loading does not hold min-width | **Accept with note** | Auth buttons are full width, where it does not matter, and the progressive label is the signal. Update 4.1: "Width may change for content-sized buttons; use `w-full` on form submit buttons". If a content-sized loading button appears in 002+, add a width token then. |
| 4 | Skeleton is not a region component | **Accept with note** | The aria-busy region rule is implemented in `PageSkeleton`, which is the only consumer in 001 and is on `/design`. Update 4.8: "the region wrapper (`PageSkeleton`, or any future loading region) owns `aria-busy` and the single hidden text; a bare Skeleton must never be used outside such a region". |
| 5 | Drawer `w-72 max-w-5/6` (83%) instead of 85% | **Accept** | Equivalent intent, no arbitrary value. Update 2.7: "mobile drawer 18rem, never wider than 5/6 of the viewport". |
| 6 | No desktop collapse control, no Ctrl/Cmd+B | **Accept** | Already the document's decision (5.2). |
| 7 | Muted auth background and card shown on mobile | **Accept the card on mobile; change the background (see I1)** | The card on a muted page looks right at 375px (`_scratch_auth-light-375.png`). Replace `bg-muted` with the new `bg-canvas` token. Add the canvas to doc 5.1. |
| 8 | Drawer title "Navigation", close label "Close navigation" | **Accept** | Clear, consistent with "Open navigation" and `nav aria-label="Main"`. Mark as final in 5.2. |
| 9 | Sign-out as a plain ghost "Log out" button | **Accept with note** | Matches the document and keeps the slot simple. The screenshot shows it is legible and aligned, but it has low affordance (reads as text). Epic 002's design phase should decide between `ghost` and `outline` once it sees it in place (question Q1 below is only about this if the PO cares). |
| 10 | Empty state as a pattern | **Accept** | Epic 002 has exactly one use. Promote to a component when a second screen needs it (doc 7.3 already says so). See M3(c) for the sample copy. |
| 11 | Geist via the `geist` package, not `next/font/google` | **Accept** | Better than the document: pinned version, no build-time network fetch, same font. Update 0.2 and 2.3 to name the `geist` package and drop the Inter fallback sentence. |
| 12 | Colors in hex | **Accept** | Already documented in 2.2 (hand-written hex plus oklch L for neutrals). No change. |
| 13 | (T-30 item 5) Hover, active, focus-visible not static on `/design` | **Accept** | Stated on the page ("How to read this page") and tested with real interaction. |

## Conformance spot-check against section 4 (code vs document)

- **Button:** variants, sizes, loading (`aria-disabled`, click guard, decorative spinner, hover and active suppressed), default `type="button"`, `asChild`. Conforms apart from deviation 3. Destructive has no distinct active color; the doc says others keep hover, so this is correct.
- **Input:** 16px below `md`, 14px from `md`, focus border plus outline offset 0, read-only and disabled fills. Conforms.
- **Label, FormField:** `htmlFor`/`id`, `aria-required`, `aria-invalid`, `aria-describedby` with hint and error ids, always-present `aria-live="polite"` error container, icon plus text, `break-words`. Conforms exactly.
- **Password input:** autocomplete required, toggle `type="button"`, name flips, `aria-controls`, disabled passes to both, right padding equals toggle width, icon `aria-hidden`. Conforms.
- **Alert:** four variants, role by `isAnnounced`, icon plus text. Conforms. Note for epic 002: the form-level error Alert must be rendered with `isAnnounced` or it is silent (the default is no role, as documented).
- **Card, Spinner, TextLink:** conform (always-underlined links; `CardTitle as="h1"`).
- **Sidebar and shell:** `nav aria-label="Main"`, `aria-current`, active item by surface, weight and 2px bar (not color alone), skip link first, sticky top bar with `scroll-padding-top` of 4.5rem, company name truncates (`app-shell` screenshots), hamburger `md:hidden`, drawer is a labelled dialog with focus trap and focus return (tested). Conforms.
- **Tokens and rules:** no `dark:`, no palette classes (palette reset), no opacity modifiers on role colors, z-index and durations only via tokens. Reduced motion is global in the token file, and the Sheet and Sonner animations are covered by `!important`. Focus visibility: every interactive component uses `focus-ring` or the Input equivalent.

## Copy and tone

Good: home sentence, "Create your account", "Already have an account? Log in", "Open navigation", "Skip to main content", "Show password"/"Hide password", sentence case, verb buttons ("Create account", "Log out"). Issues are the three in M3. The `aria-label`s on the `/design` icon buttons ("Open navigation, ghost variant") are fine for a showcase but they would be misleading if copied; use a neutral demo label such as "Menu, ghost variant". Nothing in the product uses "tenant", "workspace" or "organization" except the shell sample group label **"Workspace"** and "Sign-in preview" (screenshot `sec-layouts.png`): rename the group to "Company" or "Main" so the page never contradicts the glossary.

## The `/design` page as a living reference

Strong: tokens read live from the token file (cannot drift), contrast ratio and pass/fail shown for every documented pair, every component in default, disabled, loading, invalid and live-form states in both themes side by side, layouts in real frames, patterns, clear "how to read this page" legend that honestly says which states are live. A new developer can find any token or component from the section nav in one click.
Gaps: (1) the honest limit that hover/active/focus are live only; acceptable. (2) M2, M3, M4 above. (3) No "do and don't" on the page; fine, that is in the document. (4) No link from the page to `docs/design-system.md`; add one sentence in the legend ("Rules and anatomy: docs/design-system.md"). Nothing blocks 002.

## Accessibility beyond axe

- **Focus order and reading order:** skip link, sidebar items, top bar, content (DOM order equals visual order, as the document requires). The mobile drawer traps focus and returns it to the hamburger. Good.
- **Headings:** one `h1` per page, correct levels everywhere except M2. On the app shell, the company name in the top bar is a `<p>`, not a heading: correct.
- **Color-only information:** none found. Invalid has icon plus text; the active nav has weight, surface and bar; links are underlined; alerts have an icon.
- **Targets:** 44px below `md`, 40px from `md`, compact 32px (above the 24px minimum). Password toggle and hamburger are 44px at 375px. Good.
- **Contrast margins (token values):** tightest are `muted-foreground` on `sidebar-accent` 5.0 (light) and `input` on `card` 3.3 (dark); all pass with the documented margins. The `canvas` change (I1) does not alter them. Placeholder text uses `muted-foreground` (passes). Disabled controls are exempt.
- **Motion:** only color transitions, drawer slide, toast, skeleton pulse and spinner; all collapse under reduced motion. Nothing loops except loading indicators.
- **Forced colors:** outline-based focus survives. The active nav bar (a pseudo-element background) would disappear in forced-colors mode, but the surface and font weight remain the fallback; acceptable for 001.
- **One more:** the auth layout has no skip link; with one `main` and a form right after the wordmark this is fine.

## Questions for the PO

**Q1 (optional, can be decided in epic 002's design phase).** Should the sign-out control in the top bar be a plain ghost "Log out" button (as documented) or an outline button?
- A. Ghost (recommended): calm, matches the document, and it is the quietest option for a rarely used action.
- B. Outline: more discoverable, slightly heavier.
Recommendation: A, revisit with the real dashboard in epic 002.

No other real questions: the product-name, accent and font defaults stay as approved.

## Suggestions (not in scope unless approved)

- **S1.** Add a content-width hint token (`max-w-prose` already used) to the document if forms pages appear in 002.
- **S2.** For epic 002's dashboard empty state: use the pattern in 7.3 inside the shell with no action (the spec has none) and "Log out" in the top bar slot; the shell, `PageHeader`, empty-state pattern and ghost button already cover it. Nothing is missing from the system for sign-up, login or the empty dashboard (all fields, hint, error, password toggle, form-level Alert, toast and the two layouts exist). A **name-pair row** (first and last name side by side from `sm`) is a layout recipe documented in 7.1 only; the 002 developer can use a `grid sm:grid-cols-2 gap-6` wrapper, and the designer can add a one-line snippet to 7.1.
- **S3.** Link the shell wordmark to the dashboard in epic 002 (it needs a route).
- **S4.** A simple `/design` anchor for "Tokens changed? Check here" with a link to the contrast-check section, to support the "change the accent in one place" story.
- **S5 (later, as screens multiply).** Tooltip for icon-only buttons, Dropdown menu plus Avatar for the user menu, an EmptyState component, a Dialog/AlertDialog for destructive confirmations, and a manual theme toggle (no token change needed). Already listed in the document as future components.

## Documentation touch-ups for `docs/design-system.md` (to match what was built)

I did not edit the document (the task allowed only this file). The orchestrator or a follow-up `docs(design)` task should apply:
1. 0.2 and 2.3: font is the `geist` package (`geist/font/sans`), no `next/font/google`, no Inter fallback.
2. 2.2 and 5.1: add `--canvas` (after I1) and note the auth page uses it.
3. 2.7: drawer is `w-72`, `max-w-5/6`.
4. 4.1 loading: width may change for content-sized buttons; use `w-full` on submit.
5. 4.2 states: focused and invalid = destructive border plus focus outline.
6. 4.5 anatomy: toggle fills the control height over the border.
7. 4.8 skeleton: the region wrapper owns `aria-busy` and the hidden text.
8. 5.2: drawer title and close labels final; `PageHeader` actions rule (after M5); wordmark in the shell is not a link in 001.
9. 8.2 and 4.8: standardize the ellipsis character (M3a).
10. Add the browserslist note from T-29 (raising minimum browser versions would break native `light-dark()` and the side-by-side theme panels) to section 0.2.

## Acceptance for FND-T-35

Criteria for FND-FR-14 to 18 and FND-NFR-03/04 are met by the implementation. Recommended before epic 002 starts: fix I1 (one token, one class, one doc line) and the minor items M1, M2, M3, M5 in a single small fix task; M4, M6 and the doc touch-ups can ride along or be deferred. I list no unresolved blocker.
