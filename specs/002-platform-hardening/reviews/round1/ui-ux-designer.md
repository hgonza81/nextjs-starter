# Review by ui-ux-designer — 002-platform-hardening — round 1 (requirements + flows; wireframes skipped, sketch below)

## Summary
The UI scope is three trivial static pages (500, global error, 404), fully covered by the existing design system (section 7.4 already prescribes them). No new tokens or visual values are needed. The one real design risk is `global-error`, which replaces the root layout and must be self-contained yet token-styled. I recommend one small shared layout component, `StatusPage`, so the three pages cannot drift.

## Concerns and gaps
- [important] `global-error` replaces the root layout, so it renders its own `<html lang="en">` and `<body>` and gets no `Toaster`, no `GeistSans` class and no providers (PH-FL-02, PH-HR-01). It can still import `./globals.css` and the Geist font class directly, so tokens, light/dark and font all work. Treat that as the rule (see "Global error constraints"). Without it the page would be unstyled or need raw values, which breaks the consistency rule 1.1.
- [important] Focus is lost when an error boundary swaps content in (the focused element is removed and focus falls to `body`). Keyboard and screen reader users get no cue that the page changed (PH-AC-07).
- [important] A retry that fails again re-renders an identical page, so a sighted user may think the button did nothing (PH-AC-02). Re-focusing the heading on every mount fixes this for assistive tech; see States.
- [minor] The flows say "page chrome of the root layout stays" (PH-FL-01). Today the root layout renders no chrome (only `Toaster`), so the 500 page is a plain centered block. Epic 003 will add the app shell inside route groups, not the root layout, so a root-level `error.tsx` will not show the shell. Fine for now; revisit in 003 if a signed-in error page should keep the sidebar.
- [minor] "Go home" target: there is no dashboard until 003. Use `/` and let 003 decide whether signed-in users go to the dashboard.
- [minor] Status codes: PH-AC-04 requires HTTP 404. If a page streams before calling `notFound()`, Next may already have sent 200. The developer should verify and, if needed, avoid streaming above `notFound()` calls. Likewise error pages may not be 500 after streaming starts (BR-03 already allows "the Next.js error status").
- [minor] PH-AC-48 and Q8: agree with default A; no renderer component now.

## Proposals

### 1. One shared layout: `StatusPage` (design-system addition, small)
`src/components/layout/status-page.tsx`, documented in design-system 5.x and 7.4 and listed on `/design`. Props: `title`, `description`, optional `referenceCode`, `actions` (slot). It is a plain presentational component with no Next.js `Link`, no hooks and no providers, so it is safe inside `global-error`. Used by `error.tsx`, `global-error.tsx` and `not-found.tsx`. This is the only addition. Per Definition of Done 1.2 it needs a `/design` entry and axe in both themes. Alternative if the PO prefers zero additions: three copies of the same markup (not recommended, drift risk).

### 2. Sketch (all three pages; 375px and 1280px differ only by outer padding)
Layout: full-height column (`min-h-dvh`), centered, `max-w-md`, `px-4 md:px-6`, `py-6 md:py-8`, background `bg-background` (same as home; no card, per 7.4 "plain block"). Content is centered text, gap 24 between groups. Wordmark is plain text, not a link (the primary action goes home).

```
500 error (error.tsx) and global error (same content)
+------------------------------------------------+
|                                                |
|                  Next.js Starter               |  Wordmark
|                                                |
|             Something went wrong               |  h1, text-2xl semibold (focus target)
|   We hit an unexpected problem. You can try    |  text-base, muted-foreground
|   again, or come back in a few minutes.        |
|                                                |
|          Reference code                        |  text-sm muted-foreground
|          [ 1234567890 ]                        |  font-mono text-sm, bg-muted rounded-md px-3 py-2, select-all
|   If it keeps happening, quote this code       |  text-sm muted-foreground
|   when you report it.                          |
|                                                |
|    [ Try again ]   [ Go to home page ]         |  primary + outline; stacked full width below sm, row from sm
+------------------------------------------------+

404 (not-found.tsx)                  no code, one action
+------------------------------------------------+
|                  Next.js Starter               |
|               Page not found                   |
|   The page you're looking for doesn't exist    |
|   or may have moved.                           |
|          [ Go to home page ]  (primary)        |
+------------------------------------------------+
```

### 3. Microcopy (sentence case, no blame, no jargon)
| Element | 500 and global error | 404 |
|---------|----------------------|-----|
| Document title | Something went wrong | Page not found |
| h1 | Something went wrong | Page not found |
| Description | We hit an unexpected problem. You can try again, or come back in a few minutes. | The page you're looking for doesn't exist or may have moved. |
| Code label | Reference code | none |
| Code hint | If it keeps happening, quote this code when you report it. | none |
| Primary button | Try again | Go to home page |
| Secondary button | Go to home page (outline) | none |

Never show error message, digest explanation, stack or path. "Try again" and "Go to home page" are verbs and match 7.4 (7.4 says "Go to dashboard"; update it to "Go to home page" until 003).

### 4. Reference code: display and copy
- Shown as `font-mono text-sm text-foreground` on a `bg-muted` pill, label above in `muted-foreground`. Real text, never an image; contrast of `foreground` on `muted` is above 4.5 in both themes.
- `select-all` (Tailwind utility) so one click or tap selects the whole code; native copy then works. No copy button, no toast, no clipboard API in this epic (an extra client interaction and state for a rarely used string; `suggestion`, not in scope unless approved). If the digest is missing, omit the entire code block (label, code and hint) rather than showing an empty label (Q6 default).
- Break rule: `break-all` on the code so a long value cannot overflow 375px.

### 5. States
| State | Behavior |
|-------|----------|
| Default | As sketched. |
| Retry in progress | None visible: `reset()` re-renders synchronously; no spinner (a flash of loading adds noise). |
| Retry failed | Same page again. Because the page re-mounts, the h1 is focused again, which re-announces the page to screen readers; the code may change. Acceptable per flows. |
| Code unavailable | Code block omitted. |
| 404 from unknown URL, `notFound()`, or gated `/design` | Identical page. |
| Long content / narrow | Text wraps; buttons stack full width below `sm`; no horizontal scroll at 375px. |
| Light / dark | Tokens only (`light-dark()`); no `dark:` utilities; follows system. |
| Loading, empty, disabled | n/a. |

### 6. Accessibility
- One `h1` per page; no other headings. Landmark: content wrapped in `<main>`; wordmark is inside it (no header or footer needed).
- Client-side error pages (`error.tsx`, `global-error.tsx`): on mount focus the `h1` (`tabIndex={-1}`, `focus-visible` ring not shown for programmatic focus is fine, but no `outline-none` removal of the shared ring). This announces "Something went wrong" and gives a sensible keyboard starting point. No `role="alert"` on the whole page (too noisy). `not-found` is a server render; no focus handling needed.
- Tab order: Try again, Go to home page. Buttons are real `button` and link elements; the home action is a link styled as a Button (`asChild`) and in `global-error` a plain `<a href="/">` (full reload, since the router may be broken).
- Targets 44px below `md`, 40px from `md` (existing Button). Focus ring is the shared utility.
- axe in light and dark for all three pages (PH-AC-07). Provide a way to trigger them in E2E (a dev-only route or env switch); the developer and tester decide, but it must not ship an always-on throwing route.

### 7. Global error constraints
- Must render its own `<html lang="en" className={GeistSans.variable}>` and `<body>`; it is a client component and receives `error` and `reset`.
- Import `./globals.css` and the Geist font class directly in the file: tokens, light/dark and font then apply as everywhere else. Do not use inline styles or raw colors. If the CSS itself fails, the browser falls back to default light and the page is still readable (semantic HTML, no layout dependence).
- Do not import `Toaster`, providers, the app shell, `next/link`, or anything that reads context or Supabase; keep `StatusPage` dependency-free for this reason. The `Wordmark` is plain text and is safe.
- Set the page title with a `<title>` element (metadata exports are not available in client components); `viewport` colorScheme is not inherited, so `globals.css` `color-scheme: light dark` is what applies.
- Same copy and look as `error.tsx` so users cannot tell which one they got; the reference code comes from `error.digest`.

## Questions for the client
1. Reference code: add a "Copy" button next to it?
   - Options: A no, select-all only / B copy button with toast
   - Recommendation: A, because it adds a client interaction nobody asked for and the code is short; easy to add later.
   - Impact if undecided: A applies by default.
2. Add the small shared `StatusPage` layout component to the design system?
   - Options: A yes / B three separate pages
   - Recommendation: A, because it keeps the three pages identical and is reusable for later "no access" or "maintenance" pages.
   - Impact if undecided: A applies by default.

## Risks and assumptions
- Assumes Next.js 16 `global-error` can import global CSS and a font class (standard in the App Router; the developer verifies against `node_modules/next/dist/docs/` per AGENTS.md).
- Assumes `error.digest` is present in production builds and absent in development; in development the Next.js overlay replaces our page, so the pages are verified on a production build.
- The design-system 7.4 text must be updated from "documented only" to "built in epic 002" with the copy above (design-system change only, no new tokens).
