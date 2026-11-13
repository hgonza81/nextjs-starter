# Acceptance record: step 7, design system (FND-T-28 to FND-T-34, FND-T-58, FND-T-59)

Task: FND-T-35. Acceptor: product-manager. Date: 2026-11-12.
Scope: FND-FR-14 to FND-FR-18, FND-FR-20 (accessibility part), FND-NFR-03, FND-NFR-04, FND-HR-05, decisions D12 to D14, the Won't-do list (spec section 3), Definition of Done item 6.
Repository state inspected: working tree on `main`. Build and test commits known from the execution notes: `3971521` (T-29), `0dc5c71` (T-30), `9295816` (T-31), `ed81093` (T-32), `0cb97bd` (T-33), `ddfccad` (T-58). T-34 (review) and T-59 (document touch-ups) were committed by the orchestrator; I could not read git objects, so I did not confirm their hashes.

## Method and limits

- Evidence is my own inspection of the files on disk (listed per row) plus the independent T-33 test suite, the T-34 design review (`reviews/design-review-step-7.md`) and the execution notes of T-29 to T-34 and T-58 in `tasks.md`.
- **Limit: this acceptor session had NO shell and the directory is not seen as a git repository by my tools.** I ran no command, no test, no build, no `git log`. The numbers (171 unit tests, 110 E2E tests passing twice, lint 0/0) come from the T-58 notes, not from my own run. I did not look at the app in a browser.
- Commands I could not run, for the orchestrator:
  - C1: `pnpm lint && pnpm typecheck && pnpm format:check && pnpm build` (expect rc 0; lint 0 errors and 0 warnings).
  - C2: `pnpm test` (expect 171 tests in 15 files, Docker not needed; includes `src/design-consistency.test.ts`).
  - C3: `pnpm test:e2e`, twice in a row (expect 110 passed, no retries; the two Playwright projects `chromium` and `design-gate-off`).
  - C4: the raw-values grep: `grep -rnE 'dark:\S|#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|oklch\(|\[#|-\[[0-9]|ring-3|ring-ring/|\b(bg|text|border|ring|outline|fill|stroke)-(white|black|gray|slate|zinc|neutral|stone|red|blue|green|yellow|orange|indigo|violet|sky|amber|emerald)\b|style=' src/components src/app --include='*.tsx'` (expect only `style={toasterStyle}` in `src/components/ui/sonner.tsx`; I ran the equivalent search with my Grep tool and got exactly that one hit).
  - C5: AI-trailer scan: `git log --format=%B | grep -iE "co-authored|claude|copilot|anthropic"` (expect nothing).
  - C6: `git status --short` (expect `docs/design-system.md` and this file to be the only step 7 leftovers if T-59 is not yet committed; `tasks.md` and `.vscode/` must not be staged by me or in this commit).
  - C7 (production gate, local): build, then `next start` with `DESIGN_PAGE_ENABLED` unset: `/design`, `/design/frames/auth`, `/design/frames/app-shell`, `/design/frames/loading` return 404; `/` and `/api/health` return 200. (`design-gate.spec.ts` on port 3101 automates this inside C3.)
- This file is left **uncommitted** (no shell). Suggested commit by the orchestrator: scope `docs(spec)`, body `Task: FND-T-35`, no trailers.

## Per requirement

| Requirement | Criterion | Evidence | Verdict |
|-------------|-----------|----------|---------|
| FND-FR-14 | Tailwind + shadcn/ui on Radix, Lucide, one font, neutral theme, one placeholder accent, text-only wordmark, accent changeable in one place | `package.json`: `tailwindcss` and `@tailwindcss/postcss` 4.3.5 (Tailwind v4), `radix-ui` 1.8.1 (no `@base-ui`), `lucide-react` 1.72.0, `geist` 1.9.2 (one font, `GeistSans` in `src/app/layout.tsx`). `src/app/globals.css`: BRAND block holds `--primary: light-dark(#4f46e5, #818cf8)` (indigo) and `--ring` follows it; `src/components/brand/wordmark.tsx` is a text component with `PRODUCT_NAME`. `src/app/page.tsx` uses tokens. No template in the repo | Accepted. Note N1 (font via the `geist` package) |
| FND-FR-14 | No purchased template, no unused components in `src/components/ui` | Listing of `src/components/ui`: alert, button, card, input, label, sheet, sidebar, skeleton, sonner, spinner, text-link. Each has a consumer: `sheet` is imported only by `sidebar` (line 13), `sidebar` only by the shell (`app-shell.tsx`, `app-shell-nav.tsx`); the others by form, layout, `/design` | Accepted |
| FND-FR-14 | Changing the accent in the token file changes it app-wide | Review by reading: no component references a hex value (grep C4 clean); all use role utilities mapped in `@theme inline`. T-29 verified it; `design-theme.spec.ts` reads tokens from `globals.css` and checks they resolve in the browser | Accepted |
| FND-FR-15 | Tokens as semantic CSS variables in the Tailwind theme: color roles incl. success, warning, info, destructive, ring; type scale; 4px spacing; radius; shadow; motion; breakpoints; density | One token file `src/app/globals.css` (Tailwind v4 CSS-first, palette reset `--color-*: initial`, `@theme inline` mapping, density switch at 48rem, `duration-*`, `z-*`, `h-control`, `focus-ring`). Documented in `docs/design-system.md` section 2. Contrast: `src/app/design/_lib/token-catalog.test.ts` and `contrast.test.ts` enforce every documented pair in both themes (incl. new `--foreground` on `--canvas`) | Accepted |
| FND-FR-15 | Dark OS setting: dark tokens on first paint, no light flash; no toggle | `light-dark()` plus `:root { color-scheme: light dark }` and `viewport.colorScheme` (no `dark:`, no `next-themes`, no theme script). `tests/e2e/design-theme.spec.ts` (6): tokens resolve to file values, dark first paint works with JavaScript disabled, server HTML has no theme script/class, first-paint background is dark (rgb 10,10,10), `data-theme="dark"` panel resolves dark tokens. No toggle component exists (search of `src` finds none) | Accepted |
| FND-FR-15 | Contrast meets WCAG 2.2 AA in both themes | Exact-tool contrast tests (above) plus axe in both themes (FR-20 row). Tightest pairs: `muted-foreground` on `sidebar-accent` 5.04, `input` on `card` 3.27 (non-text, threshold 3) | Accepted |
| FND-FR-16 | Components: Button, Input, Label, FormField, Password input, Alert, Card, Spinner/Skeleton, auth layout, app shell with growth (drawer on mobile, top bar with company placeholder and user-menu slot, page header, one nav item) | Files: `ui/{button,input,label,alert,card,spinner,skeleton,text-link}.tsx`, `form/{form-field,password-input}.tsx`, `layout/{auth-layout,app-shell,app-shell-nav,page-header,page-skeleton,nav}.tsx`. Unit tests: `form-field.test.tsx` (7), `password-input.test.tsx` (4), `button.test.tsx` (4), `nav.test.ts` (5). Shell takes `companyName`, `navGroups`, `userMenu` slot, `activePath` as props; no auth code | Accepted |
| FND-FR-16 | Built from tokens only, all states, both themes, keyboard operable | C4 grep clean (only `style={toasterStyle}`, CSS variables only); `src/design-consistency.test.ts` guards it. States on `/design` (default, disabled, loading, invalid, live form). Keyboard: `design-live-states.spec.ts` (6), `design-form-field.spec.ts` (7), `design-app-shell.spec.ts` (8 plus the T-58 additions) | Accepted. Note N2 (hover/active/focus are live, not static) |
| FND-FR-16 | FormField error associated with its control (`aria-describedby`, `aria-invalid`) | `form-field.tsx`; `form-field.test.tsx`; E2E `design-form-field.spec.ts` (`aria-invalid`, `aria-describedby` to the `aria-live="polite"` error, `aria-required`, focus on first invalid field on submit) | Accepted |
| FND-FR-16 | App shell renders at 375px and 1280px with no horizontal page scroll; keyboard opens/closes the drawer | `design-layout.spec.ts` (2), `design-app-shell.spec.ts`: drawer opens by keyboard, dialog "Navigation", focus inside, Tab and Shift+Tab trapped, Escape returns focus to the hamburger, resizing across `md` closes it; skip link at 375 and 1280. Designer review confirmed the code path | Accepted |
| FND-FR-16 | Toast provider mounted once; no other toast usage | `src/app/layout.tsx` mounts `<Toaster />` once (read). `design-toast.spec.ts` (4): exactly one Sonner region on `/` and `/design`; a trigger shows one toast in the polite live region. Only `/design` triggers toasts | Accepted |
| FND-FR-17 | `/design` renders every component in every state in both themes; not linked from product navigation | `src/app/design/page.tsx` plus `_sections/*` (typography, color, scale, components, density/icons, layouts, patterns), each in light and dark panels; frame routes under `design/frames/*`. No link from `/`, shell or auth layout (the only `/design` hrefs are inside the showcase's own frames). Designer review: "strong as a living reference". M4 see below | Accepted with note (M4) |
| FND-FR-17 | Available in development and CI/E2E; 404 in production | Flag `DESIGN_PAGE_ENABLED` in `src/lib/env.server.ts` (Zod, unset = on only in `NODE_ENV=development`), `.env.example` line 26 (commented), `playwright.config.ts` sets it `true` for the main server; `src/app/design/layout.tsx` gates via `gateDesignPage` (`_lib/gate.ts`, `gate.test.ts`), `force-dynamic`. Vercel: no flag set, deploy job untouched, so all `/design*` routes 404 there. E2E: `design-gate.spec.ts` (9) runs against a second production server started WITHOUT the flag (6 gated paths 404, `/` and `/api/health` stay 200); mutation record in `tests/README.md` (removing the gate makes it red) | Accepted. The check against the real deployed URL is owed to T-46 |
| FND-FR-17 | Axe passes with zero violations on `/design` | `design-a11y.spec.ts` (58): `/design` at 375 and 1280 in both OS schemes with all 18 frames loaded, and each frame route at 375/768/1280, both schemes, with no `?theme`, `light`, `dark` | Accepted |
| FND-FR-18 | `docs/design-system.md` documents tokens, components, consistency rule, component DoD, tone guide ("company"), documented-only CRUD patterns | Document read by section search: tokens (2), components and states (4), layouts (5), `/design` spec (12), tone and microcopy (8), CRUD patterns (10, marked documented only), maintenance (13), change log; T-59 added 10 touch-ups (canvas, geist, browserslist note, ellipsis, drawer width, deviation table 12.4, change-log entry) | Accepted with note (N3, N4) |
| FND-FR-18 | No Table, Dialog, Select, Dropdown, Tabs, Pagination, Badge, Textarea, Checkbox, Breadcrumb code | Listing of `src/components/**` and a search of `src` for those paths: none. The only dialog-like code is `ui/sheet.tsx`, used solely by `ui/sidebar.tsx` (the shell's internal dependency, as the brief allows). Tooltip, Separator, Input-in-sidebar from shadcn's sidebar set were not added | Accepted |
| FND-FR-18 | Lint or review check against raw hex and arbitrary values, if feasible | Done as a Vitest check, `src/design-consistency.test.ts` (runs in `pnpm test`, includes detector self-tests, proven red by two temporary violations in T-32). Not an ESLint rule; the spec says the check is optional and not a blocker | Accepted |
| FND-FR-20 (a11y part) | E2E axe check on `/` and `/design` | `tests/e2e/home.spec.ts` (axe wcag2a/2aa/21a/21aa/22aa, light and dark) and `design-a11y.spec.ts` (above); mutation proofs in `tests/README.md` | Accepted |
| FND-NFR-03 | axe zero violations on `/` and `/design` in light and dark | As above; plus the designer's keyboard, focus-order, heading, target-size and forced-colors review ("Accessibility beyond axe"), and developer walkthroughs in T-30 to T-32 | Accepted. Limits in "What automated checks cannot prove" |
| FND-NFR-04 | No horizontal page scroll at 375px and 1280px on `/` and `/design` | `home.spec.ts` (375 and 1280), `design-layout.spec.ts` (`/design`); frames also asserted 0px overflow in the T-32 verification | Accepted |
| FND-HR-05 | Beautiful and consistent | Designer verdict pass with no blocker; the single Important finding (dark auth page elevation, I1) was fixed in T-58 and covered by `design-auth-canvas.spec.ts` (canvas rgb 10,10,10, card rgb 23,23,23 in dark). Whether it is "beautiful" is the PO's judgment on `/design` | Accepted, subject to the PO's look at `/design` |
| DoD item 6 | Tokens, 002's components, app shell, `/design` in place; home page uses them; `/design` 404 in production | All rows above | Accepted; production proof on the deployed URL deferred to T-46 |

## Do the PO's design decisions show in code and docs?

| Decision | Where it shows | Verdict |
|----------|----------------|---------|
| D12: Tailwind v4 + shadcn/ui on Radix (not Base UI) | `package.json` has `radix-ui`, no `@base-ui*`; `components.json` is radix-nova (T-29 note); `sidebar.tsx` and `label.tsx` import from `radix-ui` | Met |
| D12: Lucide, one font | `lucide-react`; only `GeistSans` loaded; no second font import in `src` | Met |
| D12: neutral theme, one placeholder accent, text-only wordmark | BRAND block in `globals.css`; `Wordmark` is text | Met |
| D12: no purchased template | None present; components hand-written from the document | Met |
| D14: light and dark follow the system, no toggle | `light-dark()`, `viewport.colorScheme`, no toggle component or `next-themes` | Met |
| D14: WCAG 2.2 AA and mobile-first built in | Contrast tests, axe E2E, 44px targets below `md`, `scroll-padding-top` for sticky bar, reduced-motion rule | Met |
| D13: bounded system (only 002's components plus a sidebar-ready shell and one Sonner provider) | Component listing above; one `Toaster` | Met |
| D13: `/design` hidden in production | Gate plus E2E; Vercel flag absent | Met (real URL: T-46) |
| D13: CRUD patterns documented only | `docs/design-system.md` section 10; no table or pagination code; Won't-do items absent | Met |

## Scope gate

- No `/login`, `/signup` or `/dashboard` route: `src/app` contains only `page.tsx`, `layout.tsx`, `api/health*`, and `design/*`. Met.
- No auth, `supabase-js`, DB or module code in layouts, components or `/design`: my search for `supabase`, `@/db`, `@/modules`, `createClient`, `getUser` and `"use server"` in `layout.tsx`, `page.tsx`, `design/**` and `components/**` found no match. Met.
- No forbidden public component (list above). `Sheet` is the shell's internal dependency only. Met.
- `Wordmark` in the shell is not a link and the sign-out and company-name slots are props only: nothing speculative added.
- **T-58 and T-59 are inside the spec's intent.** T-58 fixes review findings against FND-FR-14 to 17 and the tone rule of FR-18 (I1, M1, M2, M3, M5) and the partial M4; it added no component, no dependency and explicitly excluded M6 and the suggestions. Its two test edits were forced by the ellipsis copy change and are explained in the notes. T-59 only aligns the document to what was built (FR-18). Both accepted. The shell sample group rename to "Company" and the removal of the "Add project" action reduce, not add, scope.
- Other unrequested extras found: none. The `/design` frame routes and the `activePath` prop exist to satisfy FR-17 and FR-16 (showing the viewport-based shell without a product route); accepted.

## Deviations accepted in the design review

| # | Deviation | My decision |
|---|-----------|-------------|
| 1 | Password toggle covers the 1px input border | Accept with note (documented in 4.5 and 12.4) |
| 2 | Focused and invalid input keeps destructive border plus ring outline | Accept with note |
| 3 | Button loading does not hold `min-width`; use `w-full` on submit buttons | Accept with note; epic 002 must use `w-full` on its submit buttons |
| 4 | Skeleton is not a region component; `PageSkeleton` owns `aria-busy` | Accept with note |
| 5 | Drawer `w-72 max-w-5/6` (83%) instead of 85% | Accept |
| 6 | No desktop sidebar collapse, no Ctrl/Cmd+B | Accept (document decision) |
| 7 | Muted auth background | Change was required (I1); done with `--canvas`; accept the card on mobile |
| 8 | Drawer title "Navigation", close label "Close navigation" | Accept, final |
| 9 | Sign-out as a plain ghost "Log out" | Accept with note; the ghost vs outline choice is revisited in epic 002's design phase (optional PO question Q1, default A ghost) |
| 10 | Empty state as a pattern, not a component | Accept until a second screen needs it |
| 11 | Geist through the `geist` package instead of `next/font/google` | Accept; better (pinned, offline build). It still satisfies FR-14 "one `next/font`" in spirit because the package uses `next/font/local` |
| 12 | Colors as hex | Accept |
| 13 | Hover, active, focus-visible live rather than static on `/design` | Accept; stated on the page and tested with real interaction |
| M4 | 1280px frames scroll about 120px inside their panel on `/design` | **Accept as the one partial item.** The page says so, the layouts are covered by E2E, and the fix needs a wider container or an inline style the consistency rule forbids. Revisit only if it bothers the PO |

## Accessibility evidence and its limits

Evidence: axe (wcag2a, 2aa, 21a, 21aa, 22aa) zero violations on `/` and `/design` at 375 and 1280, and on every frame route at 375/768/1280, in both OS color schemes (`home.spec.ts`, `design-a11y.spec.ts`); exact contrast tests on every documented token pair; keyboard walkthroughs by the developer (T-30, T-31, T-32) and automated for the drawer, FormField, password toggle, skip link and live states (T-33); the designer's review (focus order, headings, color-only information, 44/40/32px targets, motion, forced colors).

What automated checks cannot prove (so a human should know): axe finds roughly a third of WCAG issues; screen-reader announcements (live error region, toast, drawer dialog) were not heard by anyone; the designer judged hover, active and live focus from code and E2E assertions, not by eye; no WebKit or Firefox runs (Chromium only); reduced motion and toast auto-dismiss are not E2E-tested; forced-colors mode loses the nav active bar (surface and weight remain, designer: acceptable for 001); the auth layout has no skip link (one `main`, fine). Recommendation (not a requirement): one manual pass with VoiceOver on `/design` and the mobile drawer before epic 002 ships real forms.

## Dependencies added in step 7

| Dependency | Version | Justified? |
|------------|---------|-----------|
| `tailwindcss`, `@tailwindcss/postcss` (dev) | 4.3.5 | Yes, FR-14 |
| `radix-ui` | 1.8.1 | Yes, shadcn/Radix decision D12 (Slot, Dialog for the drawer, Label) |
| `lucide-react` | 1.72.0 | Yes, D12 |
| `geist` | 1.9.2 | Yes. One font, pinned, no build-time network fetch; deviation 11 |
| `class-variance-authority` | 0.7.1 | Yes, Button/Alert variants |
| `cn` | 0.5.2 | Justified: what the radix-nova style uses in place of clsx + tailwind-merge (`src/lib/utils.ts` re-exports it). It is a small, less common package published by the shadcn org; the architect should confirm its provenance during T-36/T-43 |
| `sonner` | 2.0.8 | Yes, FR-16 toast provider |
| `shadcn` | 4.23.0 (runtime dependency) | Needed because `globals.css` does `@import "shadcn/tailwind.css"` for `data-open`/`data-closed` variants. Justified but heavy for a CSS file (it is the CLI package). Option for later: vendor the few lines and drop the package. Not a blocker; note N5 |
| `tw-animate-css` | 1.4.0 | Yes, Sheet/drawer and Sonner animation utilities |
| `react-hook-form`, `@hookform/resolvers`, `zod` | already present (7.92.0, 7.0.6, 4.6.7) | FormField is specified on them (FR-16); `@hookform/resolvers` already had its release-age exclusion before step 7 |
| `jsdom` 31.0.0, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2, `@testing-library/user-event` 14.6.10 (dev) | exact | Yes, component unit tests (FormField, Password input, Button) |

`minimumReleaseAgeExclude: "@testing-library/user-event@14.6.10"` was added automatically by pnpm and committed in T-30. Accepted as a dev-only, one-version exception (the other two entries, `@hookform/resolvers` and `prettier`, are of the same kind). Maintenance rule: remove the entry once the release has aged past the policy; the architect reviews it in T-36/T-43. Nothing was added in T-58 or T-59.

**`browserslist` constraint (maintenance rule).** `package.json` sets `chrome >= 123`, `edge >= 123`, `firefox >= 120`, `safari >= 17.5`. This is load-bearing: with Next's default list, lightningcss rewrote `light-dark()` into a polyfill resolved at `:root`, which broke the side-by-side `data-theme` panels. Raising the minimums is fine; lowering them breaks the token file and the `/design` theme panels (the T-29 note and the review say "raising"; the real risk is lowering the list or replacing it with the default; the documented text should say the list must stay at or above these versions). It is recorded in `docs/design-system.md` section 0.2; it is **not yet** in `docs/architecture.md` or any README (owed to T-36 and T-41).

## Notes

- N1: Font is delivered by the `geist` package, not `next/font/google` (document updated in T-59).
- N2: Hover, active and focus-visible are demonstrated live, not as static samples.
- N3: Document housekeeping, minor: the change-log entry for T-59 is dated 2026-11-13 while the review is dated 2026-11-12; section 12.4 sits before 12.3 in `docs/design-system.md`. Cosmetic; a later docs pass can fix both.
- N4: `tasks.md` still shows T-59 as `todo` and has no Execution note for it (and the table has no note for T-35). The orchestrator updates the status and adds the note after committing T-59. I did not edit `tasks.md`.
- N5: `shadcn` as a runtime dependency (see table).
- N6: PageHeader switches layout at `md` (the review text said `sm`); the document was aligned in T-59. With several actions each goes full width below `md` and they stack one per row; epic 002 should check this when it adds a second action.
- N7: Epic 002 reminders from the review: the form-level error Alert needs `isAnnounced` or it is silent; submit buttons use `w-full`; the name-pair row is a layout recipe (`grid sm:grid-cols-2 gap-6`).

## Open points owed to later tasks

| Point | Owner |
|-------|-------|
| Add the design system pointer, the `DESIGN_PAGE_ENABLED` flag, the `env.server.ts` split note and the `browserslist` rule (do not lower it; `light-dark()` output) to `docs/architecture.md`; confirm `cn` provenance; review the `minimumReleaseAgeExclude` entry; fix `lib/supabase/` listing | T-36 (architect), repeated in T-43 |
| Boundary lint rules (ESLint) must not break the design files; any lint rule for raw values is optional and not planned; `tests/` and the `/design` frame routes are not special for the boundary rules | T-37, T-38 |
| Test README finishing pass: add the T-33 design suite section ordering, tidy stale paragraphs, document the `E2E_BASE_URL` command for the gate test | T-40 |
| Project README: `DESIGN_PAGE_ENABLED` (on in dev, absent on Vercel), `/design` URL, `browserslist` rule, Playwright browser install | T-41 |
| Fresh-clone walkthrough: a new developer reaches `/design` and runs the E2E | T-42 |
| Vercel flag handling and project hygiene review, and the deploy job unchanged | T-43 (architect review of the deploy path) |
| Real check that `https://project-v7n6g.vercel.app/design` (and the 3 frame routes) return 404 and `/`, `/api/health` return 200: `E2E_BASE_URL=<url> pnpm exec playwright test tests/e2e/health.spec.ts tests/e2e/design-gate.spec.ts` | T-46 |
| Final epic acceptance checklist over every requirement, and DoD item 6 sign-off | T-48 (T-44, T-45, T-47 are the CI, deploy and bad-input proofs; they do not own design items) |
| Epic 002 (not a 001 task): sign-out ghost vs outline decision (PO question Q1), shell wordmark link to the dashboard (S3), PageHeader with several actions, `isAnnounced` on form-level alerts | Epic 002 design phase |

## Verdict

**Step 7 accepted, with notes. No rejected items.** FR-14, FR-15, FR-16, FR-17, FR-18, the accessibility part of FR-20, NFR-03 and NFR-04 each have a build task and an automated or reviewed verification. Partial: M4 (1280px frames scroll about 120px inside `/design`), accepted. Deferred by design: the check of the 404 gate on the real deployed URL (T-46), architecture and README entries (T-36, T-41). Caveat: my verdict rests on file inspection and the reports; the orchestrator's runs of C1 to C7 must pass before step 7 is closed.

PO decisions: none required. Optional (default applied): the top-bar sign-out as ghost (default) or outline, which can wait for epic 002. The PO may also want to look at `/design` once, because "beautiful" is the PO's judgment.

## Orchestrator addendum (command checks run after the acceptance, 2026-11-13)

The product-manager had no shell, so the orchestrator ran the commands on the PO's machine (Node 26.13.1, pnpm 12.18.0):

| Check | Result |
|-------|--------|
| `pnpm lint`, `typecheck`, `format:check`, `build` | pass (lint 0 errors, 0 warnings) |
| `pnpm test` | 171 passed |
| raw-values grep over `src/components` and `src/app` | no hits (the documented `style={toasterStyle}` exception only) |
| AI-trailer scan of the history | 0 matches |
| `pnpm test:e2e` | **finding:** 3 consecutive runs failed (2, 2 and 4 of 110) at "all 18 layout iframes load" in `design-a11y.spec.ts`; the agents had seen 110/110 |

**Finding and resolution (FND-T-60, commit 64d99b0):** the helper only set `frame.loading = "eager"`, which in Chromium does not reliably start the navigation of iframes already deferred as lazy; under load some frames stayed on `about:blank`. It is a test-helper defect, not a page defect (lazy loading is intended for real users). The helper now re-assigns each `src` to force the navigation and counts a frame as loaded only when it is complete, its path equals its `src`, its title matches `/^Design: .+ frame$/` and it has content; a mutation (one frame pointed at a 404 route) turns the test red naming the frames. Stability: the spec with `--repeat-each=10` passed 580 of 580 at 4 and 8 workers, and five consecutive full runs passed 110 of 110. After the fix the orchestrator re-ran `pnpm test:e2e` three times on the PO's machine: **110 passed each (26.2 s, 27.2 s, 27.1 s)**.

**Production evidence for FND-FR-17 (the deployed gate):** `E2E_BASE_URL=https://project-v7n6g.vercel.app pnpm exec playwright test tests/e2e/health.spec.ts tests/e2e/design-gate.spec.ts` passed 10 of 10 against the deployed site (all `/design*` paths return 404, `/` and `/api/health` unaffected). T-46 formalizes it on the final commit.

The acceptance verdict stands: **step 7 accepted with notes, no rejected items.**
