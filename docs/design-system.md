# Design system

Single source of truth for the visual language and UI components of this product. Written before any component is built (task FND-T-28, epic 001-foundations). It is bounded by the epic 002 screens (sign-up, login, empty dashboard with sign-out), plus a sidebar-ready app shell and one toast provider. Everything else is either a documented-only pattern (section 10) or listed as a future component (section 11).

Requirement trace: FND-FR-14 to FND-FR-18, FND-NFR-03, FND-NFR-04; decisions D12, D13, D14.

## 0. Status and assumptions

### 0.1 Product Owner decisions this document builds on (not reopened)

- Tailwind CSS + shadcn/ui (Radix primitives) + Lucide icons + one `next/font` font. shadcn defaults, neutral theme, one placeholder accent (calm indigo), text-only wordmark, no purchased template.
- Light and dark themes that follow the system setting. No toggle.
- WCAG 2.2 AA and mobile-first built into the base components.
- English only. The UI term for a tenant is "company".
- CRUD patterns are documented only; heavier components are added by the first epic that needs them.

### 0.2 Versions assumed (verified against official docs on 2026-11-12; the developer pins exact versions in FND-T-29)

| Piece | Assumed | Source and note |
|-------|---------|-----------------|
| Next.js / React | 16.4.6 / 19.3.1 (already pinned in `package.json`) | App Router, Server Components by default |
| Tailwind CSS | v4.x (docs show v4.3). CSS-first config: `@import "tailwindcss"`, `@theme`, `@theme inline`. No `tailwind.config.js`. | tailwindcss.com/docs/theme |
| shadcn/ui CLI | `shadcn@latest` (CLI v4 series). **Important: since July 2026 `shadcn init` pre-selects Base UI. We use Radix, so init must be run with `-b radix`** (`pnpm dlx shadcn@latest init -b radix`). | ui.shadcn.com changelog, "Base UI as the Default" |
| Radix | Via shadcn's unified `radix-ui` package (changelog, February 2026). Developer confirms what `init -b radix` installs. | |
| Toast | **Sonner** through shadcn's `sonner` component (`pnpm dlx shadcn@latest add sonner`), mounted once in the root layout. shadcn also ships a newer "Toast" component, but it is for Base UI projects only; we do not use it. | ui.shadcn.com/docs/components/radix/sonner |
| Font | **Geist** (variable) from the `geist` package (`geist/font/sans`, which uses `next/font/local` over a bundled variable woff2), exposed as a CSS variable. Not `next/font/google`: that fetches the font at build time, so a build or an E2E run would fail offline, while the package version is pinned in the lockfile and the build is reproducible. No Inter fallback is needed. | nextjs.org/docs/app/api-reference/components/font |
| Icons | `lucide-react`, current release | |
| Forms | React Hook Form 7.92.0, Zod 4.6.7, `@hookform/resolvers` 7.0.6 (already pinned) | |
| Sonner | Latest release, pinned by the developer | |
| Browsers | Evergreen browsers from mid-2024 onward. The tightest constraint is CSS `light-dark()` (Baseline 2024). **`browserslist` rule:** `package.json` sets the minimums `chrome >= 123`, `edge >= 123`, `firefox >= 120`, `safari >= 17.5`. They must stay at or above the `light-dark()` baseline. Raising them is fine; lowering them breaks the native `light-dark()` output, because lightningcss then rewrites it into a polyfill resolved at `:root`, which breaks the `data-theme` panels on `/design` (and any future per-subtree theming). | developer.mozilla.org, `light-dark()` |

### 0.3 Where UI code lives

| Path | Content |
|------|---------|
| `src/app/globals.css` | **The one token file** (all design tokens, Tailwind `@theme` mapping, reduced-motion rule, shared utilities). |
| `src/components/ui/` | shadcn-owned primitives we actually use: Button, Input, Label, Alert, Card, Skeleton, Sonner, and the internals the Sidebar needs (see 6.1). No unused components. |
| `src/components/form/` | FormField, PasswordInput (built on `ui/` primitives and React Hook Form). |
| `src/components/layout/` | AuthLayout, AppShell, PageHeader. |
| `src/components/brand/wordmark.tsx` | Wordmark and the product name constant (the one place to rebrand the name). |
| `src/app/design/` | The `/design` showcase page (section 9). |

`docs/architecture.md` does not list `src/components/` yet; the architect adds it in FND-T-36. Module-specific components (for example the sign-up form) live in `src/modules/<name>/components/` and are assembled only from the components above.

## 1. Principles and rules

1. **Usability first, beauty in service of it.** A first-time user understands a screen in seconds. Beauty comes from clarity, restraint, spacing and consistency, not decoration.
2. **Consistency is the product.** Same problem, same pattern, everywhere.
3. **Design for all states**: default, hover, focus, active, disabled, loading, error, success, empty, and edge content (very long names, no data).
4. **Accessible by default** (WCAG 2.2 AA), built into the base components.
5. **Minimal for an MVP**, but built so future screens are cheap.

### 1.1 The consistency rule

> **No raw color or spacing values and no one-off components. Add to the system first.**

Concretely, in application and component code:

- No color literals (`#fff`, `rgb()`, `hsl()`, `oklch()`) anywhere except the token file `src/app/globals.css`.
- No Tailwind palette colors (`bg-blue-500`, `text-gray-600`). The token file resets the default color namespace (`--color-*: initial`) so they do not even generate; only role colors exist (`bg-primary`, `text-muted-foreground`, ...).
- No arbitrary Tailwind values for color, spacing, size, radius, or shadow (`p-[13px]`, `bg-[#123]`, `w-[327px]`). Arbitrary references to a token variable are allowed only where this document names them (`h-(--control-height)`).
- Spacing uses only the steps in 2.4.
- No `dark:` utilities in components (see 2.1: theming is done entirely by tokens).
- No opacity modifiers on role colors (`bg-primary/50`); use a role token. Element-level `opacity-50` for disabled is allowed.
- No inline `style` for color or spacing.
- UI is assembled only from the components in this document. If a screen needs something new, the component is specified here, built, and added to `/design` first.

Enforcement: design review (FND-T-34) plus, if feasible, an automated check (a script or ESLint rule) for the patterns above. FND-T-32 decides feasibility; it is not a blocker (FND-FR-18).

### 1.2 Component Definition of Done

A component (new or changed) is done only when:

1. Built from tokens only (rule 1.1); no raw values, no `dark:`.
2. All applicable states exist and are styled: default, hover, focus-visible, active, disabled, loading, error/invalid.
3. It works in both themes.
4. It is operable by keyboard alone, with a visible focus ring and logical focus order.
5. It is listed on `/design` with every variant and state.
6. It passes the axe check in E2E (zero violations) in light and dark.
7. Its section in this document is added or updated (anatomy, states, keyboard, ARIA, tokens).

## 2. Foundations (tokens)

### 2.1 Theming mechanism

The theme follows the system setting with **no JavaScript, no class, and no flash on first paint**. Every theme-dependent token is declared once with CSS `light-dark()`, and the root declares `color-scheme: light dark`.

Illustrative shape (the developer writes the real file in FND-T-29):

```css
:root { color-scheme: light dark; --background: light-dark(#ffffff, #0a0a0a); /* ... */ }
@theme inline { --color-background: var(--background); /* ... */ }
```

Why this and not shadcn's default (`.dark` class plus `next-themes`):

- One declaration per token instead of two parallel blocks that can drift.
- No theme provider and no hydration or flash concerns; the browser resolves the value before paint.
- Native controls and scrollbars follow `color-scheme` automatically.
- `/design` can show light and dark **side by side** by wrapping a panel in `data-theme="light"` or `data-theme="dark"`, which only sets `color-scheme` on that panel (the page's own theme still follows the system).
- A future manual toggle is an addition, not a rewrite: set `color-scheme` on `<html>` from a class or attribute. No token changes.

Consequences for the developer when adapting shadcn output (FND-T-29/T-30):

- Delete the generated `@custom-variant dark (&:is(.dark *))` and the `.dark { ... }` token block; replace shadcn's oklch values with the values in 2.2.
- Remove every `dark:` utility from copied components and express it with a token instead.
- Do not install `next-themes`. The shadcn Sonner wrapper reads the theme through `next-themes`; replace that with `theme="system"` and token-based styling (see 4.9).
- Add `colorScheme: "light dark"` to the root layout `viewport` export (Next.js supports it) so the canvas has the right color before CSS applies. Verify in the Next.js docs when implementing.
- Verify in FND-T-29 that Tailwind utilities on role colors resolve in both themes (for example `bg-primary`, `border-input`).

### 2.2 Color

Naming follows shadcn: a base token is a surface and `-foreground` is the text/icon color placed on it. Values are sRGB hex. The neutral tokens are the shadcn neutral grays expressed as hex (they equal oklch `L 0 0`; shown in the third column).

**Terminology warning.** In shadcn, `--accent` means a neutral hover surface. The product's brand color (the "placeholder accent" the PO mentioned) is `--primary`. This document uses "brand accent" for `--primary` and never for `--accent`.

#### Neutral and surface roles

| Token | Light | Dark | oklch L | Use |
|-------|-------|------|---------|-----|
| `--background` | `#ffffff` | `#0a0a0a` | 1.0 / 0.145 | Page background |
| `--foreground` | `#0a0a0a` | `#fafafa` | 0.145 / 0.985 | Default text |
| `--card` | `#ffffff` | `#171717` | 1.0 / 0.205 | Card, input-on-card surface |
| `--card-foreground` | `#0a0a0a` | `#fafafa` | | Text on card |
| `--popover` | `#ffffff` | `#171717` | | Toast, drawer, future menus |
| `--popover-foreground` | `#0a0a0a` | `#fafafa` | | |
| `--canvas` | `#f5f5f5` | `#0a0a0a` | 0.97 / 0.145 | Page background behind a card (the auth page). Declared as `light-dark(#f5f5f5, #0a0a0a)` |
| `--muted` | `#f5f5f5` | `#262626` | 0.97 / 0.269 | Quiet surfaces, skeleton, disabled/read-only fill |
| `--muted-foreground` | `#636363` | `#a1a1a1` | 0.50 / 0.708 | Secondary text, hints, placeholders |
| `--accent` | `#f5f5f5` | `#262626` | | Neutral hover surface (ghost button, nav hover). **Not the brand color.** |
| `--accent-foreground` | `#0a0a0a` | `#fafafa` | | Text on the hover surface |
| `--border` | `#e5e5e5` | `#2e2e2e` | 0.922 / 0.30 | Decorative dividers and card borders only |
| `--input` | `#8c8c8c` | `#696969` | 0.64 / 0.52 | Border of form controls (must reach 3:1; see below) |
| `--overlay` | `rgb(10 10 10 / 0.5)` | `rgb(0 0 0 / 0.7)` | | Scrim behind the mobile drawer |

`--canvas` exists because `--muted` cannot be a page background: in dark it is lighter (`#262626`) than `--card` (`#171717`), so a card on it would look sunken. **Elevation rule:** in dark the card is lighter than the canvas (`#171717` on `#0a0a0a`); in light the card is white on `#f5f5f5` and is separated by its `border-border` and `shadow-xs`. Use `bg-canvas` only for a full-page background behind a Card; never for a component surface.

`--muted-foreground` is deliberately darker than shadcn's default (0.556) because the default falls to 4.34:1 on `--muted`, below AA. `--input` is deliberately darker than `--border` because WCAG 1.4.11 requires the boundary that identifies a form control to reach 3:1. `--border` stays light because it is decorative and never the only cue for a control.

#### Brand accent (placeholder calm indigo) and focus

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--primary` | `#4f46e5` | `#818cf8` | Primary button fill, links, active nav indicator |
| `--primary-hover` | `#4338ca` | `#a5b4fc` | Primary hover |
| `--primary-active` | `#3730a3` | `#c7d2fe` | Primary pressed |
| `--primary-foreground` | `#ffffff` | `#0a0a0a` | Text/icon on primary |
| `--ring` | `var(--primary)` | `var(--primary)` | Focus ring (derived; never set separately) |

In dark mode the primary is a light indigo with dark text, the same inversion shadcn's neutral theme uses, because white text on a mid-tone indigo would fail 4.5:1.

#### Semantic status roles

Each status has four tokens: a solid color (icon, border, button fill), the text color on that solid, a subtle tinted surface, and the text color on the subtle surface.

| Role | Token | Light | Dark |
|------|-------|-------|------|
| Destructive | `--destructive` | `#b91c1c` | `#f87171` |
| | `--destructive-hover` | `#991b1b` | `#fca5a5` |
| | `--destructive-foreground` | `#ffffff` | `#0a0a0a` |
| | `--destructive-subtle` | `#fef2f2` | `#450a0a` |
| | `--destructive-subtle-foreground` | `#991b1b` | `#fca5a5` |
| Success | `--success` | `#15803d` | `#4ade80` |
| | `--success-foreground` | `#ffffff` | `#0a0a0a` |
| | `--success-subtle` | `#f0fdf4` | `#052e16` |
| | `--success-subtle-foreground` | `#166534` | `#86efac` |
| Warning | `--warning` | `#b45309` | `#fbbf24` |
| | `--warning-foreground` | `#ffffff` | `#0a0a0a` |
| | `--warning-subtle` | `#fffbeb` | `#451a03` |
| | `--warning-subtle-foreground` | `#92400e` | `#fcd34d` |
| Info | `--info` | `#0369a1` | `#38bdf8` |
| | `--info-foreground` | `#ffffff` | `#0a0a0a` |
| | `--info-subtle` | `#f0f9ff` | `#082f49` |
| | `--info-subtle-foreground` | `#075985` | `#7dd3fc` |

Info is sky blue, not indigo, so it is not confused with the brand accent.

#### Sidebar roles (app shell)

| Token | Light | Dark |
|-------|-------|------|
| `--sidebar` | `#fafafa` | `#171717` |
| `--sidebar-foreground` | `#0a0a0a` | `#fafafa` |
| `--sidebar-accent` (hover / active item surface) | `#ebebeb` | `#262626` |
| `--sidebar-accent-foreground` | `#0a0a0a` | `#fafafa` |
| `--sidebar-border` | `#e5e5e5` | `#2e2e2e` |
| `--sidebar-ring` | `var(--ring)` | `var(--ring)` |

shadcn's `--sidebar-primary*` tokens are not defined; the active item uses `--primary` for its indicator.

#### Contrast check (WCAG 2.2 AA)

Ratios are WCAG relative-luminance contrast on the final hex values. **They were computed by hand (the author had no shell); treat them as reviewed estimates accurate to about plus or minus 0.1.** The developer re-verifies with a tool in FND-T-29, and axe on `/design` (FND-T-33) is the automated proof. Thresholds: normal text 4.5:1, UI components and focus indicators 3:1.

| Pair (foreground on background) | Needs | Light | Dark |
|---------------------------------|-------|-------|------|
| `foreground` on `background` | 4.5 | 19.8 | 18.9 |
| `foreground` on `canvas` | 4.5 | 18.2 | 18.9 |
| `card-foreground` on `card` | 4.5 | 19.8 | 17.2 |
| `muted-foreground` on `background` | 4.5 | 6.0 | 7.6 |
| `muted-foreground` on `card` | 4.5 | 6.0 | 6.9 |
| `muted-foreground` on `muted` / `accent` | 4.5 | 5.5 | 5.8 |
| `foreground` on `accent` | 4.5 | 18.2 | 14.5 |
| `muted-foreground` on `sidebar` | 4.5 | 5.7 | 6.9 |
| `muted-foreground` on `sidebar-accent` | 4.5 | 5.0 | 5.8 |
| `primary-foreground` on `primary` | 4.5 | 6.3 | 6.6 |
| `primary-foreground` on `primary-hover` | 4.5 | 7.9 | 9.9 |
| `primary-foreground` on `primary-active` | 4.5 | 9.9 | 13.3 |
| `primary` as link text on `background` | 4.5 | 6.3 | 6.6 |
| `primary` as link text on `card` / `muted` | 4.5 | 6.3 / 5.8 | 6.0 / 5.1 |
| `ring` (focus indicator) on `background` | 3 | 6.3 | 6.6 |
| `ring` on `card` | 3 | 6.3 | 6.0 |
| `input` (control border) on `background` | 3 | 3.4 | 3.6 |
| `input` on `card` | 3 | 3.4 | 3.3 |
| `destructive-foreground` on `destructive` | 4.5 | 6.5 | 7.2 |
| `destructive-foreground` on `destructive-hover` | 4.5 | 8.3 | 10.4 |
| `destructive` as text on `background` / `muted` | 4.5 | 6.5 / 5.9 | 7.2 / 5.5 |
| `destructive-subtle-foreground` on `destructive-subtle` | 4.5 | 7.6 | 8.5 |
| `success-foreground` on `success` | 4.5 | 5.0 | 11.4 |
| `success-subtle-foreground` on `success-subtle` | 4.5 | 6.8 | 10.6 |
| `warning-foreground` on `warning` | 4.5 | 5.0 | 11.9 |
| `warning-subtle-foreground` on `warning-subtle` | 4.5 | 6.8 | 10.4 |
| `info-foreground` on `info` | 4.5 | 5.9 | 9.2 |
| `info-subtle-foreground` on `info-subtle` | 4.5 | 7.1 | 8.3 |
| `destructive` / `success` / `warning` / `info` (alert border, icon) on `background` | 3 | 5.0 to 6.5 | 7.2 to 11.9 |
| `border` on `background` (decorative, no requirement) | n/a | 1.3 | 1.5 |

Lowest passing margins to watch: `muted-foreground` on `sidebar-accent` (light, 5.0), `success` and `warning` solids with white text (light, 5.0), `input` on `card` (dark, 3.3).

**Changing the brand accent: contrast checklist.** After editing the brand block (2.9), these must still hold in both themes: `primary-foreground` on `primary`, `-hover` and `-active` at 4.5 or more; `primary` on `background`, `card` and `muted` at 4.5 or more (it is used as link text); `ring` on `background` and `card` at 3 or more. A new accent is accepted only if all are met.

Disabled controls are exempt from contrast by WCAG, but they are never the only place information appears.

### 2.3 Typography

- **One font:** Geist (variable, weights 400 to 600 used), imported from the `geist` package (`geist/font/sans`, `next/font/local` over a bundled variable woff2) once in the root layout, exposed as `--font-geist-sans` and mapped to `--font-sans` and Tailwind `font-sans`. It is not loaded with `next/font/google` because that needs a network fetch at build time; the package is pinned in the lockfile. Fallback stack ends in `system-ui, sans-serif` (handled by `next/font`).
- **Code:** no second font download; `font-mono` uses the system stack `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- **Scale** (the Tailwind v4 defaults, kept as the product scale):

| Step | Size / line height | Utility |
|------|--------------------|---------|
| 12 | 12 / 16 | `text-xs` |
| 14 | 14 / 20 | `text-sm` |
| 16 | 16 / 24 | `text-base` |
| 18 | 18 / 28 | `text-lg` |
| 20 | 20 / 28 | `text-xl` |
| 24 | 24 / 32 | `text-2xl` |
| 30 | 30 / 36 | `text-3xl` |
| 36 | 36 / 40 | `text-4xl` |

- **Weights:** 400 (`font-normal`), 500 (`font-medium`: labels, buttons, nav), 600 (`font-semibold`: headings). No 700 or above.

| Role | Style |
|------|-------|
| Display (home heading) | `text-3xl` then `md:text-4xl`, semibold, `tracking-tight` |
| Page title (h1 in app and auth) | `text-2xl`, semibold, `tracking-tight` |
| Section / card title (h2) | `text-lg`, semibold |
| Subsection (h3) | `text-base`, semibold |
| Body | `text-base`, normal |
| UI text (labels, buttons, nav, table cells, hints, errors) | `text-sm`; labels and buttons `font-medium` |
| Caption | `text-xs`, `text-muted-foreground`; metadata only, never essential information |
| Code | `font-mono text-sm` |

Rules: one `h1` per page; heading levels never skip. **Text inputs use 16px on small screens and 14px from `md` up** (below 16px, iOS Safari zooms the page on focus). Prose lines stay under about 70 characters (forms and auth card are narrow by design).

### 2.4 Spacing

4px base: Tailwind's default `--spacing: 0.25rem` stays. Allowed steps:

| Use | Steps (px) | Tailwind |
|-----|-----------|----------|
| Padding, margin, gap | 4, 8, 12, 16, 24, 32, 48, 64 | `1, 2, 3, 4, 6, 8, 12, 16` |
| Sizing only (heights, icons, fixed widths) | adds 20, 40, 44, 56 | `5, 10, 11, 14` |

Defaults:

| Context | Value |
|---------|-------|
| Page horizontal padding | 16 (`px-4`), 24 from `md`, 32 from `lg` |
| Page vertical padding | 24 (`py-6`), 32 from `md` |
| Gap between page sections | 24 (`gap-6`), 32 from `md` |
| Card padding | 24 (`p-6`); gap between card parts 24 |
| Gap between form fields | 24 (`gap-6`) |
| Label to control; control to hint or error | 8 (`gap-2`) |
| Gap between inline icon and text | 8 |
| Gap between buttons in a row | 12 |
| Top bar height | 56 (`h-14`) |

### 2.5 Radius, borders, shadow, z-index

Radius base `--radius: 0.625rem` (shadcn default); the derived scale (sm, md, lg, xl) comes from `@theme inline` as in shadcn. Roles: controls (button, input) `rounded-md`; alert and toast `rounded-lg`; card `rounded-xl`; avatars and pills `rounded-full`.

Borders: 1px (`border`). Controls use `border-input`; cards, dividers and the sidebar use `border-border`.

Shadows (neutral black, color via `light-dark()` so they are stronger in dark): `--shadow-xs` (card), `--shadow-sm`, `--shadow-md` (toast, drawer, future popovers), `--shadow-lg` (reserved for dialogs). In dark theme surfaces rely on their border and lighter fill, not on shadow.

| Elevation | Treatment |
|-----------|-----------|
| Page | flat |
| Raised (card) | `border-border` + `shadow-xs` |
| Overlay (toast, drawer) | `border-border` + `shadow-md` |

Z-index tokens: `--z-sticky: 10` (top bar), `--z-overlay: 40` (drawer scrim), `--z-drawer: 50`, `--z-toast: 100`. No other z-index values.

### 2.6 Motion

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | 100ms | Hover and press color changes |
| `--duration-base` | 150ms | Default (focus, toast, alert) |
| `--duration-slow` | 250ms | Drawer open and close |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | All transitions |

Motion is subtle and functional: color transitions on interactive elements, fade and 8px slide for toasts, slide for the drawer, a spinning icon for loading, a soft pulse on skeletons. Nothing decorative, nothing that loops except loading indicators.

**Reduced-motion rule (global, in the token file):** under `prefers-reduced-motion: reduce`, transitions and animations are effectively disabled (duration about 0), the drawer and toasts appear and disappear without sliding (a fade is acceptable), the skeleton does not pulse (static `--muted` block), and the Spinner is a static icon. Loading is never communicated by motion alone: every loading state also has a text or accessible-name change.

### 2.7 Breakpoints and layout

Mobile-first. Tailwind v4 default breakpoints, unchanged:

| Name | Min width | What changes |
|------|-----------|--------------|
| base | 0 | Single column, 44px controls, drawer navigation, 16px page padding |
| `sm` | 640px | Two-column name fields |
| `md` | 768px | **Sidebar becomes permanent**, hamburger hidden, controls 40px, input text 14px, page padding 24 |
| `lg` | 1024px | Page padding 32 |
| `xl` | 1280px | Reference desktop width for tests |
| `2xl` | 1536px | Content stops growing (max width) |

Test widths for the E2E no-horizontal-scroll checks (FND-NFR-04): **375px and 1280px**.

Containers:

| Container | Width |
|-----------|-------|
| Auth card | `max-w-md` (448px), centered |
| App content area | fluid up to `max-w-7xl` (1280px), left aligned next to the sidebar |
| Form page body (future CRUD) | `max-w-2xl` (672px) |
| Sidebar | `--sidebar-width: 16rem` (256px); mobile drawer `w-72` (18rem), never wider than 5/6 of the viewport (`max-w-5/6`, about 83%) |

Page templates in epic 001: auth layout (5.1), app shell (5.2), home page (5.3).

### 2.8 Density and target sizes

Two densities, plus the touch rule. Tokens are CSS variables that change at `md`, consumed through two utilities declared in the token file (`h-control`, `h-control-compact`):

| Token | Below `md` (touch) | `md` and up |
|-------|-------------------|-------------|
| `--control-height` (default, "comfortable") | 44px | **40px** |
| `--control-height-compact` | 44px | **32px** |
| `--row-height` (table row, comfortable; future) | 48px | 48px |
| `--row-height-compact` (table row, compact; future) | 48px | 40px |

Rules: comfortable is the default everywhere; compact is opt-in (`size="sm"` on Button, for dense toolbars and tables) and only from `md` up. **On touch widths everything interactive is at least 44px**, including the show/hide password button and nav items. Anywhere else the WCAG 2.2 minimum is 24 by 24px (2.5.8); nothing is ever smaller than that, including icon buttons. Table text is `text-sm`.

### 2.9 The single place to change the accent and the wordmark

**Accent.** Edit only the "BRAND" block at the top of the token file `src/app/globals.css`: `--primary`, `--primary-hover`, `--primary-active`, `--primary-foreground` (light and dark values). `--ring`, link color, the active nav indicator and the loading spinner derive from them. Nothing else in the codebase may reference a hex value. After editing, run the contrast checklist in 2.2 and the axe check on `/design`.

**Wordmark.** The wordmark is plain text, not an image. Edit only `src/components/brand/wordmark.tsx`, which exports the product name constant and the `Wordmark` component (name set in `font-semibold tracking-tight`, `text-foreground`). The root layout `<title>` and the home heading read the same constant. Today the placeholder name is "Next.js Starter".

## 3. Iconography

- One set: **Lucide** (`lucide-react`). Named imports only.
- Sizes: 16 (`size-4`, inside `text-sm` text, compact buttons, inline errors), 20 (`size-5`, default in buttons, nav, alerts), 24 (`size-6`, empty states).
- Stroke width: Lucide default (2) everywhere; never changed per use.
- Color: inherits `currentColor`; status icons use the status token.
- Decorative icons have `aria-hidden="true"`. An icon-only control must have an accessible name (`aria-label`) and, where the label is not obvious, a visible tooltip is a future addition (Tooltip is not specified here).
- Icons never carry meaning alone: status is also expressed by text.

Icons used by epic 001 components: `Eye`, `EyeOff` (password), `Info`, `CircleCheck`, `TriangleAlert`, `CircleAlert` (alerts and inline errors), `LoaderCircle` (spinner), `Menu` and `X` (drawer), `LayoutDashboard` (the one nav item and the empty-state example).

## 4. Components

Shared rules for every interactive component:

- **Focus ring** (the shared `focus-ring` utility, defined once in the token file): a 2px solid `--ring` **outline** with `2px` offset (outline offset 0 plus a `--ring` border on text inputs). An outline, not a box-shadow, so it survives Windows forced-colors mode. Never removed without replacement; never relies on `:focus` (use `:focus-visible`); never at reduced opacity.
- **Disabled**: `opacity-50`, `cursor-not-allowed`, no hover effect, native `disabled` attribute where possible.
- **Transitions** use the motion tokens; only color properties.
- **Targets** follow 2.8.
- Every component accepts `className` for layout only (margin, width); never to override colors or spacing.

State vocabulary: default, hover, focus-visible, active (pressed), disabled, loading, error/invalid, read-only.

### 4.1 Button

**Purpose.** Triggers an action. One primary button per screen or form.

**Anatomy.** `[leading icon] label [trailing icon]`. Padding `px-4` (comfortable) or `px-3` (compact), gap 8, `rounded-md`, `text-sm font-medium`, height from `--control-height`.

**Variants**

| Variant | Fill and text | Use |
|---------|---------------|-----|
| `default` (primary) | `bg-primary`, `text-primary-foreground` | The main action |
| `outline` | `bg-background`, `border-input`, `text-foreground` | Secondary actions (for example Cancel) |
| `ghost` | transparent, `text-foreground` | Tertiary and toolbar actions |
| `destructive` | `bg-destructive`, `text-destructive-foreground` | Irreversible or harmful actions |
| `link` | `text-primary`, underlined | Inline action that looks like a link |

There is no `secondary` variant: `outline` covers it.

**Sizes.** `default` (comfortable), `sm` (compact, `md`+ only), `icon` (square at control height; requires `aria-label`).

**States**

| State | Treatment |
|-------|-----------|
| Default | As per variant |
| Hover | `default`: `bg-primary-hover`. `destructive`: `bg-destructive-hover`. `outline` and `ghost`: `bg-accent`. `link`: underline offset grows. |
| Focus-visible | Shared focus ring |
| Active (pressed) | `default`: `bg-primary-active`. Others keep hover treatment. No scale or movement. |
| Disabled | `disabled`, `opacity-50`, `cursor-not-allowed` |
| Loading | See below |

**Loading.** The button gets `aria-disabled="true"` (not the `disabled` attribute, so focus is not lost), ignores clicks and Enter (prevents double submit), shows a Spinner (decorative) before the label, and the label changes to the progressive form ("Creating account…", with the ellipsis character). **Width:** `min-width` is not held (that would need an arbitrary value), so the width of a content-sized button may change when the spinner is added and the label changes. Form submit buttons use `w-full`, where it does not matter; if a content-sized loading button appears in a later epic, add a width token then. The surrounding form sets `aria-busy="true"`.

**Keyboard.** Enter and Space activate. Navigation uses a link element styled as a button (`asChild` with the Next.js link); actions use a real `button`. `type="submit"` only on the form's submit button; every other button is `type="button"`.

**ARIA.** Native semantics. Icon-only: `aria-label`. Loading: `aria-disabled`.

**Tokens.** `primary*`, `destructive*`, `input`, `accent`, `background`, `ring`, `--control-height*`, radius, motion.

**Do.** Verb labels ("Create account", "Log in"). Full width (`w-full`) in auth forms. **Don't.** Two primary buttons on one screen; "Submit" or "OK" as labels; disabled primary as the only validation feedback.

### 4.2 Input

**Purpose.** Single-line text entry for text, email, name, company name. (Password uses 4.5.)

**Anatomy.** One bordered box, height `--control-height`, `px-3`, `rounded-md`, `border-input`, `bg-background`, text `foreground`, placeholder `muted-foreground`. Font size 16px below `md`, 14px from `md`.

**States**

| State | Treatment |
|-------|-----------|
| Default | `border-input` |
| Hover | no change (the cursor shows the text caret) |
| Focus-visible | `border-ring` + 2px `--ring` outline (offset 0) |
| Disabled | `disabled`, `opacity-50`, `bg-muted`, `cursor-not-allowed` |
| Read-only | `bg-muted`, normal opacity, focusable |
| Invalid (`aria-invalid="true"`) | `border-destructive`; the message and icon in FormField carry the meaning, not the color |
| Focused and invalid | The destructive border is kept (the field stays visibly invalid) and the 2px `--ring` outline is shown, so focus is still visible |
| Loading | n/a (the form shows loading on the button) |

**Attributes (per field type, set by the caller; documented so the developer need no guesswork)**

| Field | `type` | `autoComplete` | Other |
|-------|--------|----------------|-------|
| First name | `text` | `given-name` | |
| Last name | `text` | `family-name` | |
| Email | `email` | `email` | `inputMode="email"`, `autoCapitalize="none"`, `spellCheck={false}` |
| Company name | `text` | `organization` | |
| Password (login) | password | `current-password` | |
| Password (sign-up, confirm) | password | `new-password` | |

**Keyboard.** Standard; Enter in any field submits the form (the form has one submit button).

**ARIA.** Always paired with a Label (`htmlFor`/`id`). Invalid state through `aria-invalid`; hint and error through `aria-describedby`. Both are wired by FormField (4.4); a bare Input is used only inside FormField.

**Tokens.** `input`, `background`, `foreground`, `muted`, `muted-foreground`, `destructive`, `ring`, `--control-height`, radius.

**Don't.** Placeholder as the label; placeholder-only hints; blocking paste anywhere (WCAG 3.3.8).

### 4.3 Label

**Purpose.** Visible, programmatically associated name for a control.

**Anatomy.** `text-sm font-medium text-foreground`, line height 20. Optional-field marker: the suffix " (optional)" in `text-muted-foreground font-normal`. **Required is the default and is not marked** (no asterisks); only optional fields are marked.

**States.** Default. Disabled control: label stays full contrast (it must stay readable). Invalid: label color does not change (the error text is the signal).

**ARIA.** Rendered as `<label for>`; clicking it focuses the control. Never replaced by `aria-label` when a visible label can exist.

**Tokens.** `foreground`, `muted-foreground`.

### 4.4 FormField

**Purpose.** The single way a labeled control with help and error text is assembled. **Control-agnostic**: it wires accessibility for any control (Input now; Select, Textarea, Checkbox later) without knowing what the control is.

**Built on.** shadcn's `Field`, `FieldLabel`, `FieldDescription`, `FieldError` primitives (which provide the layout, the `data-invalid` state and the error list handling) plus React Hook Form (`Controller`/`useController`) with a Zod resolver. The shadcn Field docs do not document `aria-describedby` wiring, so **FormField itself must guarantee it** (below).

**Anatomy (top to bottom)**

```
Label  (optional)
[ control ..................... ]
hint text (muted)
(!) error text (destructive)
```

Vertical gap 8 between parts. Hint is always visible when provided (for example password requirements must be readable before the user fails). The error appears below the hint and both stay visible; error copy must therefore say what to fix and not just repeat the hint.

**Contract (what FormField provides; the control receives these as props)**

| Provided to the control | Value |
|-------------------------|-------|
| `id` | Generated or given; the Label's `htmlFor` points to it |
| `name`, `value`, `onChange`, `onBlur`, `ref` | From React Hook Form |
| `aria-invalid` | `true` when the field has an error, otherwise absent |
| `aria-describedby` | Space-separated ids: `<id>-hint` if a hint exists, `<id>-error` when an error is shown |
| `aria-required` | `true` unless the field is marked optional (native `required` is not used; forms use `noValidate` so validation messages are ours) |

The error container `<id>-error` is always in the DOM and carries `aria-live="polite"`, so errors that appear on blur are announced. On a failed submit, focus moves to the first invalid control (React Hook Form default) and its description (the error) is read.

**Error presentation.** `CircleAlert` icon (16, `aria-hidden`) + message, `text-sm text-destructive`. Icon plus text, never color alone. The control shows its invalid border (4.2).

**Validation timing (the form pattern, 7.1).** React Hook Form `mode: "onTouched"`: validate on first blur of a field, then on every change once it has been touched; validate all on submit. Never on every keystroke before the first blur. A dependent field is re-validated when its partner changes (confirm password when password changes, if the confirm field was touched).

**States.** Default, filled, focused (control state), hinted, invalid (hint plus error), disabled (passes to control), submitting (the form is `aria-busy`; controls stay editable only until submit starts, then read-only to avoid mid-flight edits).

**Keyboard.** Tab order is label (not focusable), control, any in-control button (password toggle). Enter submits.

**Tokens.** `foreground`, `muted-foreground`, `destructive`, spacing 8 and 24.

**Edge content.** Long error text wraps; it never truncates. Long labels wrap. Hint and error use `break-words`.

**Do.** One FormField per control; same layout on every form. **Don't.** Build a one-off label plus input group; show an error without an icon; put the error above the control.

### 4.5 Password input

**Purpose.** Password entry with show/hide. Used on login and sign-up (twice).

**Anatomy.** An Input (4.2) with a trailing icon button inside the right edge. The button is a ghost icon button positioned at the top right that fills the full control height and therefore sits over the input's 1px border (44px square below `md`, 40px square from `md`; it has the same radius as the input, so only its hover surface overlaps the border), `Eye` when hidden and `EyeOff` when shown. The input has right padding equal to the button width so text never runs under it.

**Behavior**

| Item | Rule |
|------|------|
| Initial | Masked (`type="password"`). |
| Toggle | Click or Enter or Space on the button flips between `password` and `text`. Focus stays on the button; the caret position in the input is preserved. |
| Reset | Returns to masked on unmount and after a successful submit; it is not persisted. |
| Paste and autofill | Always allowed; password managers must work (WCAG 3.3.8 Accessible Authentication). |
| `autoComplete` | **Required prop**, one of `current-password` or `new-password`; no default, so it cannot be forgotten. |

**States.** The same as Input, plus the toggle's own hover (`bg-accent`), focus-visible (shared ring), and active states. Disabled disables both. Invalid applies to the input (border) as usual.

**Keyboard.** Tab goes input, then toggle. The toggle is `type="button"` so Enter in the input never triggers it and still submits the form.

**ARIA.** The toggle's accessible name is "Show password" when masked and "Hide password" when visible (the name changes; no `aria-pressed`, to avoid a double announcement), `aria-controls` points to the input id. The icon is `aria-hidden`. The change of type is not announced beyond the name change.

**Tokens.** Those of Input plus `accent`, `muted-foreground` (icon color; 5.5 or more on the control background).

**Don't.** Auto-hide on a timer; auto-reveal; disable paste; use a custom strength meter in 001 (requirements are shown as a visible hint instead).

### 4.6 Alert

**Purpose.** An inline, persistent message about the state of a page or a form. Not a toast (7.2).

**Anatomy.** A bordered, tinted row: status icon (20) at the left, optional title (`text-sm font-medium`), description (`text-sm`), optional actions below. No dismiss button in 001 (alerts disappear when the condition does; a form-level error clears on the next submit).

**Variants**

| Variant | Icon | Surface and border | Text and icon |
|---------|------|--------------------|---------------|
| `info` | `Info` | `info-subtle`, border `info` | `info-subtle-foreground` |
| `success` | `CircleCheck` | `success-subtle`, border `success` | `success-subtle-foreground` |
| `warning` | `TriangleAlert` | `warning-subtle`, border `warning` | `warning-subtle-foreground` |
| `destructive` | `CircleAlert` | `destructive-subtle`, border `destructive` | `destructive-subtle-foreground` |

Padding `p-4`, gap 12, `rounded-lg`, 1px border.

**States.** Static; no hover or focus (it is not interactive unless it contains a link or button, which then use their own states). Loading and disabled: n/a.

**ARIA.** `destructive` and `warning` used for a result the user must notice immediately (a failed submit) render with `role="alert"` (assertive); `info` and `success` use `role="status"` (polite). An Alert that is present on first render and not the result of an action (a page notice) has no live role. The status is always also conveyed by the icon and the text, never color alone.

**Tokens.** The four-token set of the status plus radius and spacing.

**Edge content.** Long descriptions wrap; an alert may contain a link (Link style, 4.10) as its action.

**Do.** Put a form-level error at the top of the form, above the first field. **Don't.** Stack more than one alert; use an alert for a success that the user already sees (use a toast).

### 4.7 Card

**Purpose.** A bordered container that groups related content. The auth form sits in a card.

**Anatomy.** `Card` (container), `CardHeader` (title and description), `CardContent`, `CardFooter`. Container: `bg-card text-card-foreground`, `border-border`, `rounded-xl`, `shadow-xs`, `p-6`, gap 24. `CardTitle` renders a real heading and takes the heading level as a prop (the auth card uses `h1`; other cards `h2`); `CardDescription` is `text-sm text-muted-foreground`.

**States.** Static only. (Interactive cards are not specified; if a card must be clickable, the first epic that needs it adds a variant here.)

**Edge content.** Long titles wrap; content never forces the card wider than its container (`min-w-0`).

**Tokens.** `card`, `card-foreground`, `border`, `muted-foreground`, radius `xl`, `shadow-xs`.

### 4.8 Spinner and Skeleton

**Spinner.** The `LoaderCircle` icon with a rotation animation, sizes 16 (default inside buttons), 20, 24. Color `currentColor`. Inside a button it is `aria-hidden` (the label change communicates the state). Standalone (page or section loading) it has `role="status"` and an accessible name "Loading". Under reduced motion it is static (2.6).

**Skeleton.** A `bg-muted` block with `rounded-md` and a soft pulse; the shape mimics the content it replaces. Use a skeleton, not a spinner, when the layout of what is loading is known (a page header and a card, later table rows). The region wrapper (`PageSkeleton`, or any future loading region) owns `aria-busy="true"` and the single visually hidden "Loading…" text; the skeleton blocks are `aria-hidden`. A bare Skeleton must never be used outside such a region. Skeletons never flash for fast loads: show only if loading exceeds about 300ms (the developer may use Suspense timing; no extra code in 001).

**States.** Pulsing (normal), static (reduced motion). Tokens: `muted`, `foreground`, radius, motion.

### 4.9 Toast provider (Sonner)

**Purpose.** A short, non-blocking confirmation after an action, plus rare non-critical info. Rules for when to use it are in 7.2.

**Mounting.** `Toaster` from `src/components/ui/sonner` is rendered **exactly once**, in the root layout, as a sibling after the page content. No other toast library, no second `Toaster`. Calls are `toast.success(...)`, `toast.error(...)`, `toast.info(...)`, `toast.warning(...)` from `sonner`, made from client components (for example after a Server Action returns).

**Adaptation of the shadcn wrapper.** The shadcn `sonner` file reads the theme from `next-themes`; here it uses `theme="system"` and styles through tokens only: background `popover`, text `popover-foreground`, border `border`, radius `lg`, shadow `md`; status icons use the Lucide set (3) colored with `success`, `warning`, `info`, `destructive`; the `richColors` option is off. Defaults: bottom-right on `md` and up (Sonner's mobile layout on small screens), `closeButton` on, about 5 seconds, 3 visible at once.

**Anatomy.** Icon, message (one line preferred, two max), optional single action button ("Undo"), close button.

**States.** Entering, visible, hovered (the timer pauses), focused (pauses), swiped or closed, exiting. Under reduced motion it fades without sliding.

**Keyboard and ARIA.** Sonner renders one polite live region for the toasts and supports focusing the region with its hotkey (default Alt+T; verify in the pinned version) and closing with the close button. Toasts auto-dismiss, so **a toast is never the only place where important information appears** (WCAG 2.2.1): errors that block progress use an inline Alert instead.

**Tokens.** `popover*`, `border`, status solids, `--shadow-md`, `--z-toast`, motion, radius.

### 4.10 Link (text link)

Not a separate shadcn component, but a shared style so inline links look the same everywhere (login to sign-up, in alerts, in the footer text). `text-primary`, underlined (always, so the link is not identified by color alone), `underline-offset-4`, hover `text-primary-hover` and thicker underline, shared focus ring. Uses the Next.js `Link`. External links open in the same tab unless the spec says otherwise. A link navigates; an action is a Button (4.1).

### 4.11 State coverage summary

| Component | default | hover | focus-visible | active | disabled | loading | invalid/error | read-only |
|-----------|:------:|:-----:|:-------------:|:------:|:--------:|:-------:|:-------------:|:---------:|
| Button | yes | yes | yes | yes | yes | yes | n/a | n/a |
| Input | yes | n/a | yes | n/a | yes | n/a | yes | yes |
| Label | yes | n/a | n/a | n/a | yes | n/a | n/a | n/a |
| FormField | yes | n/a | via control | n/a | via control | via form | yes | via control |
| Password input | yes | toggle | yes | toggle | yes | n/a | yes | n/a |
| Alert (4 variants) | yes | n/a | n/a | n/a | n/a | n/a | destructive | n/a |
| Card | yes | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| Spinner / Skeleton | yes | n/a | n/a | n/a | n/a | is the loading state | n/a | n/a |
| Toast | yes (5 types) | pause | close button | n/a | n/a | n/a | error type | n/a |
| Auth layout | yes | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| App shell | yes | nav item | nav item, trigger | nav item | n/a | skeleton | n/a | n/a |

## 5. Layouts

### 5.1 Auth layout

**Purpose.** The one layout for sign-up and login (and later reset flows): a focused, distraction-free card.

```
375px (mobile)                         1280px (desktop)
+-----------------------+   +--------------------------------------------------+
|        Wordmark       |   |                                                  |
|                       |   |                    Wordmark                      |
| +-------------------+ |   |                                                  |
| | h1 Title          | |   |          +--------------------------+            |
| | description       | |   |          | h1 Title                 |            |
| |                   | |   |          | description              |            |
| | [ form fields ]   | |   |          |                          |            |
| |                   | |   |          | [ form fields ]          |            |
| | [ Primary  full ] | |   |          |                          |            |
| |                   | |   |          | [ Primary          full ]|            |
| | alt-link line     | |   |          |                          |            |
| +-------------------+ |   |          | alt-link line            |            |
+-----------------------+   |          +--------------------------+            |
                            +--------------------------------------------------+
```

- **Background:** the page uses `bg-canvas` (not `bg-muted`) behind the card, so the card is lighter than the page in dark and separated by its border and `shadow-xs` in light (elevation rule in 2.2). The card is shown on the canvas at every width, including 375px.
- A full-height column (`min-h-dvh`), content centered horizontally; on desktop also near the vertical center (slightly above center, `py-12`), on mobile top aligned with `py-8` so the keyboard does not hide the form.
- Wordmark above the card, centered, links to `/`. The card is `max-w-md`, full width on mobile with `px-4` outside it.
- The card title is the page `h1`; a short description is optional. Below the form, one alternative-action line ("Already have an account? Log in") in `text-sm text-muted-foreground` with a Link.
- Landmarks: the card area is the `<main>`. No navigation, no footer in 001.
- Form-level errors use an Alert at the top of the card content; field errors are inline.

### 5.2 App shell

**Purpose.** The layout for every signed-in page. Designed for growth (about 50 CRUD tables): a sidebar for navigation, a top bar for context, a content area with a page header. Only one nav item is rendered in 001. The shell is not routed to a product page in epic 001; it is shown on `/design`. Epic 002 uses it for the dashboard.

```
Desktop >= 768px
+-----------+------------------------------------------------------------+
| Wordmark  | Top bar (h-14): [Company name placeholder]    [user menu slot] |
|           +------------------------------------------------------------+
| nav       | Page header                                                |
| [icon]    |  h1 Title                              [primary action slot]|
|  Dashboard|  description (muted)                                        |
|           |                                                            |
| (room for |  Content area  (max-w-7xl, p-6 md:p-8)                     |
|  groups)  |                                                            |
+-----------+------------------------------------------------------------+
 sidebar 256px, fixed, full height; content scrolls independently

Mobile < 768px                       Drawer open
+-----------------------+            +----------------+------------------+
| [=] Company name [slot]|           | Wordmark   [X] | (scrim, --overlay)|
+-----------------------+            | nav            |                  |
| h1 Title              |            | [icon] Dashboard|                 |
| description           |            +----------------+                  |
| [primary action]      |             18rem, slides from left, focus trapped
| content               |
+-----------------------+
```

**Parts**

| Part | Spec |
|------|------|
| Wordmark in the sidebar | Plain text in 001, not a link (there is no product page to link to yet). Epic 002 links it to the dashboard (the auth layout wordmark links to `/`). |
| Sidebar | Built on shadcn `Sidebar` with `collapsible="offcanvas"`. Permanent at `md` and up; below `md` it renders as a drawer (shadcn uses a Sheet) opened by the hamburger. Background `sidebar`, right border `sidebar-border`. Header: Wordmark. Content: nav groups (group label `text-xs font-medium text-muted-foreground`, items below). Width 16rem. No desktop collapse control and no Ctrl/Cmd+B shortcut in 001 (a hidden, unexplained state); a future epic can add them. |
| Nav item | Icon (20) + label (`text-sm font-medium`), height 44px on touch and 40px from `md`, `rounded-md`, `px-3`. Hover `sidebar-accent`. **Active item**: `aria-current="page"`, `sidebar-accent` surface, `font-semibold`, and a 2px `--primary` indicator on the left edge (not color alone: weight and surface also change). Focus-visible: shared ring. One item in 001: "Dashboard" (`LayoutDashboard`). |
| Top bar | `h-14`, sticky (`--z-sticky`), `bg-background`, bottom border. Left: hamburger (`md:hidden`, icon button, `aria-label="Open navigation"`) then the **company name placeholder** (text, `font-medium`, truncates with ellipsis on overflow, `min-w-0`). Right: **user menu slot** (a named slot that epic 002 fills). In 001 the slot is empty; on `/design` it shows a stand-in outline button. |
| Page header | Title (`h1`, page-title role), optional description (`text-sm text-muted-foreground`), actions slot on the right. **The mobile breakpoint is `md`, not `sm`:** below `md` the actions wrap below the title and each action (direct child) is full width (`*:w-full`); from `md` the row layout applies and each action is auto width (`md:*:w-auto`). The component enforces this, so callers do not add `w-full`. With several actions, each is full width and they stack one per row below `md`. Bottom spacing 24. |
| Content area | `main` landmark, `max-w-7xl`, page padding per 2.4. |
| Skip link | First focusable element in the shell: "Skip to main content", visible on focus, jumps to `main`. |

**States.** Drawer closed/open (open traps focus, `Escape` and scrim click close, focus returns to the hamburger); nav item default, hover, focus, active, current; content loading (a skeleton page header and a skeleton card, 4.8); long company name (truncated); no nav items beyond the one (the sidebar still shows structure and has room to grow).

**Keyboard.** Skip link, then sidebar items in order, then top bar controls, then content (DOM order = visual order). Hamburger opens the drawer; inside it Tab cycles; Escape closes and returns focus. The sticky top bar must never cover the focused element: the page sets `scroll-padding-top` of at least the top bar height plus 16px (WCAG 2.4.11 Focus Not Obscured).

**ARIA.** `<nav aria-label="Main">` for the sidebar; the top bar is a `<header>`; the drawer has a dialog role and a label ("Navigation") provided by the Sheet (title "Navigation", close label "Close navigation", open label "Open navigation": final copy); `aria-current="page"` on the current item.

**Company name and user menu.** The company name is plain text in 001 (the switcher is out of scope for epic 002). The user menu slot is a slot, not a component: **epic 002's sign-out is a plain ghost Button labeled "Log out" placed in the slot**, because Dropdown menu and Avatar are not in the 001 component list. When a profile menu with several items is needed, the epic that needs it adds Dropdown menu and Avatar here first.

**Tokens.** `sidebar*`, `background`, `border`, `primary`, `foreground`, `muted-foreground`, `--z-*`, `--shadow-md` (drawer), `--overlay`, `--duration-slow`.

### 5.3 Home page

`/` keeps its known heading (the product name, `h1`), now styled with the system: a centered column (`max-w-md`), display type, and one muted sentence below ("A multi-tenant SaaS starter." is a placeholder). No navigation, no buttons. It exists so the theme, font, dark mode and axe check can be verified on a real page (FND-NFR-03).

## 6. Components used by the shell (dependencies, not separate specs)

### 6.1 Allowed dependency components

The shadcn Sidebar installs internal dependencies (Sheet for the mobile drawer, Separator, Tooltip, Skeleton, the `use-mobile` hook). They are part of the app shell, not independent components: no other screen may use Sheet, Tooltip or Separator directly until they are specified here. If the developer prefers not to pull Tooltip, the Sidebar can be configured without icon-collapse tooltips; the rule "no unused components in `src/components/ui`" (FND-FR-14) is then satisfied by removing what the shell does not import.

### 6.2 Developer notes for FND-T-29 to FND-T-31

- `shadcn init -b radix`, neutral base, CSS variables on; then overwrite the generated tokens with section 2 (and delete `.dark` and the dark custom variant).
- Add only: `button`, `input`, `label`, `alert`, `card`, `skeleton`, `sonner`, `sidebar` (and its pulled dependencies). FormField and PasswordInput are project components, not shadcn output.
- A Spinner is a small project component (Lucide icon plus animation), not a shadcn one.
- shadcn's newer Button/Input classes use translucent focus rings (`ring-[3px] ring-ring/50`) and `dark:` variants; both violate the rules in 1.1 and 4 and must be replaced with the shared `focus-ring` utility and tokens.

## 7. Patterns in use by epic 002

### 7.1 Forms and validation

| Rule | Behavior |
|------|----------|
| Layout | One column, visible labels, 24px between fields. Name fields may share a row from `sm`. Primary button full width at the bottom. |
| Timing | Validate on first blur of each field, then on change; all fields on submit. Never on every keystroke before the first blur. React Hook Form `mode: "onTouched"`. |
| Schema | One Zod schema shared by the client form and the Server Action (AUTH-NFR-03); client validation blocks sending; the server validates again. |
| Error placement | Field errors under the field (4.4). Form-level errors (wrong credentials, server failure, anything not tied to a field) in an Alert at the top of the form. |
| On failed submit | Focus moves to the first invalid field; if the error is form-level, the Alert has `role="alert"` and the button is re-enabled. |
| Submitting | Primary button loading state (4.1), form `aria-busy`, no double submit. |
| Requirements | Shown before failure as hints (password length). |
| Server field errors | A Server Action result may carry per-field messages; they are set on the matching fields and shown exactly like client errors. |
| Success | Navigation to the next screen; no success message on the form itself. |
| Security | Wrong credentials say "Incorrect email or password" without saying which. Autocomplete attributes and paste are never disabled. |

### 7.2 Feedback: toast vs inline Alert vs dialog

| Situation | Use |
|-----------|-----|
| A field is invalid | Inline FormField error |
| A form-level failure (bad credentials, server error) | Alert (destructive) at the top of the form |
| A page-level condition that persists | Alert (info or warning) at the top of the content |
| A mutation succeeded and the user stays on a page that shows the result | Toast (success) |
| A background or row-level action failed and there is no form | Toast (error), with a retry action if useful |
| An irreversible or destructive action needs confirmation | AlertDialog (documented only, section 10.6) |
| Anything the user must not miss | Never only a toast |

### 7.3 Loading and empty states

- **Loading:** skeleton when the layout is known (page header, card, later table rows); Spinner only for an indeterminate wait in a small area or a button. Region has `aria-busy`.
- **Empty state (a pattern, not a component, in 001):** a centered block inside the content area or a Card: a 24px Lucide icon in `text-muted-foreground`, a title (`text-lg font-semibold`), one sentence of explanation (`text-sm text-muted-foreground`, max about 50 characters per line), and at most one primary action. It says what is missing and what to do next. The epic 002 empty dashboard uses it. If a second screen needs the same block, the owning epic promotes it to a component here and on `/design`.

```
+---------------------------------------------+
|                    [icon]                   |
|             Your dashboard is empty         |
|   Things you add to your company will       |
|   show up here.                             |
|               [ optional action ]           |
+---------------------------------------------+
```

### 7.4 Error pages (documented only, not built in epic 001)

404 and unexpected-error pages use the auth-layout pattern (wordmark, centered card or plain block): an h1 ("Page not found" / "Something went wrong"), one sentence, one Button ("Go to dashboard" / "Try again"). Built by the first epic that needs a custom one.

## 8. Content and tone

### 8.1 Voice

Friendly, clear, concise, human, no jargon. Talk to the person ("you", "your company"). Contractions are fine. Calm, never cute: no exclamation marks except rare celebratory moments, no emoji, no "oops", no blame.

### 8.2 Rules

| Topic | Rule |
|-------|------|
| Capitalization | Sentence case everywhere (titles, buttons, labels, nav). Product name and proper nouns excepted. |
| Buttons and links | Start with a verb: "Create account", "Log in", "Log out", "Save changes". Never "Submit", "OK", "Click here". Loading form: verb in progressive tense plus the single ellipsis character "…" (never three dots "..."), in loading labels and the hidden "Loading…" text alike: "Creating account…". |
| Terminology | **"company"** is the UI term for a tenant. Never "tenant", "workspace" or "organization" in UI copy. Use "account" for the person's login ("Create your account"), "email" (not "e-mail"), "Log in" and "Log out" (verbs) and "login" only as a noun if ever needed. |
| Errors | Formula: **what happened plus how to fix it**; never blame ("You entered..." becomes "Enter..."). Specific to the field. No codes or technical terms. |
| Hints | Only where they prevent an error (password length). Short, a fragment with a full stop. |
| Placeholders | Do not repeat the label. Used only for format examples (`name@company.com`), never for required information. Most fields have none. |
| Empty states | State what is missing, then the next step. |
| Success | Past tense, short: "Company created." |
| Numbers and dates | Digits for numbers. Dates as "Nov 12, 2026". |
| Security copy | Never reveal whether an account exists except where the spec explicitly requires it (see the note under 8.3). |

### 8.3 Microcopy for the epic 002 forms

These are the defaults the designer proposes for the epic 002 design phase; epic 002 may refine them with its wireframes.

**Sign-up screen**

| Element | Copy |
|---------|------|
| Page title (h1) | Create your account |
| Description | Set up your account and your company in one step. |
| First name | Label: First name. Error empty: Enter your first name. |
| Last name | Label: Last name. Error empty: Enter your last name. |
| Email | Label: Email. Placeholder: `name@company.com`. Error empty: Enter your email address. Error format: Enter a valid email address, like name@company.com. |
| Password | Label: Password. Hint: At least 8 characters. Error empty: Enter a password. Error short: Use at least 8 characters. |
| Confirm password | Label: Confirm password. Error empty: Confirm your password. Error mismatch: Passwords don't match. Check both and try again. |
| Company name | Label: Company name. Error empty: Enter your company name. Error length: Use 2 to 100 characters. |
| Show / hide | Accessible names: Show password, Hide password |
| Submit | Create account; loading: Creating account… |
| Email already registered (AUTH-FR-03) | Error under Email: An account with this email already exists. Log in instead. (with "Log in" as a Link) |
| Server error | Alert: We couldn't create your account. Try again in a moment. |
| Alternative action | Already have an account? Log in |

Note on AUTH-FR-03: the spec requires a clear "email exists" error. That tells an attacker the account exists, which conflicts with the principle of not leaking account existence. The designer follows the spec; the security trade-off belongs to epic 002's review and the Product Owner.

**Login screen**

| Element | Copy |
|---------|------|
| Page title (h1) | Log in to your account |
| Email | Label: Email. Error empty: Enter your email address. Error format: Enter a valid email address, like name@company.com. |
| Password | Label: Password. Error empty: Enter your password. |
| Submit | Log in; loading: Logging in… |
| Wrong credentials (AUTH-FR-05) | Alert (destructive): Incorrect email or password. Check your details and try again. |
| Server error | Alert: We couldn't log you in. Try again in a moment. |
| Alternative action | New here? Create an account |

**Dashboard (empty) and sign-out**

| Element | Copy |
|---------|------|
| Page title (h1) | Dashboard |
| Empty state title | Your dashboard is empty |
| Empty state text | Things you add to your company will show up here. |
| Nav item | Dashboard |
| Company name slot | The company name, or "Your company" as the placeholder |
| Sign-out button | Log out |
| Session expired (redirect to login) | Alert (info) on login: Your session expired. Log in again to continue. |

**Generic**

| Situation | Copy |
|-----------|------|
| Network failure | We couldn't reach the server. Check your connection and try again. |
| Unexpected failure | Something went wrong on our side. Try again in a moment. |
| Required field marker | none (required is the default); optional fields: "(optional)" after the label |

Wording decision to confirm: the epic 002 requirements say "sign out"; this document uses "Log out" to pair with "Log in". If the Product Owner prefers "Sign out", change it here and in 8.2.

## 9. Accessibility standards (WCAG 2.2 AA)

Built into the base components; verified by axe in E2E and by design review.

| Area | Standard |
|------|----------|
| Contrast | Text 4.5:1, large text and UI components 3:1, both themes (table in 2.2) |
| Focus | Visible 2px outline ring on every interactive element, never removed; focus never hidden by the sticky top bar (2.4.11); logical order equals visual order |
| Keyboard | Everything operable without a mouse; no keyboard traps (the drawer traps focus only while open and Escape closes it); Enter submits forms |
| Targets | 44px minimum on touch widths, 24px absolute minimum (2.5.8) |
| Labels and names | Every control has a visible, programmatically associated label; icon-only controls have `aria-label` |
| Errors | `aria-invalid`, `aria-describedby`, a live region for field errors, focus to the first invalid field, icon plus text (never color alone) |
| Authentication | No paste blocking, `autocomplete` always set, no cognitive tests (3.3.8); password re-entry on sign-up is allowed as an exception to ensure correctness (3.3.7) |
| Structure | One `h1` per page, no skipped levels, landmarks (`header`, `nav`, `main`), skip link in the app shell, `lang="en"` |
| Motion | Respect `prefers-reduced-motion` (2.6); no flashing; no auto-moving content other than loading indicators |
| Color | Information is never conveyed by color alone (alerts have icons and text, active nav has weight and surface and an indicator, links are underlined) |
| Zoom and reflow | Layout works at 320px width and 200% zoom without horizontal scroll; text is rem-based |
| Toasts | Auto-dismissing; never the only copy of important information; pause on hover and focus |
| Forced colors | Focus is an outline, borders are real borders, so controls remain visible in forced-colors mode |

## 10. CRUD patterns (documented only, not implemented in epic 001)

> **Status of this whole section: documented only, not implemented in epic 001.** No component, route or code for anything below is built in epic 001. These are conventions decided now (because they are costly to change later) so that the first CRUD epic and every later one follow the same patterns. The first epic that needs one of them builds it, adds it to this document's component section and to `/design`, and updates this section if reality differs. The data-table and URL-state approach is an ADR candidate for the architect in that epic.

### 10.1 Navigation (documented only)

- App shell as in 5.2. Sidebar items grouped by area (group label above the items), ordered by frequency of use; one item per top-level list page. Active item uses `aria-current="page"`.
- Depth of two or more levels (detail, edit): a breadcrumb trail above the page header (the Breadcrumb component arrives with the first epic that needs it), plus a clear "back" through the breadcrumb or a Cancel. Depth of one has no breadcrumb.
- The company name in the top bar is a switcher in the future (out of scope for now).
- Mobile: the sidebar is the drawer; the top bar and page header stack.
- Page title (`h1`) always matches the nav item or the entity being shown.

### 10.2 Page templates (documented only)

```
List page                          Detail page
+--------------------------+       +--------------------------+
| Breadcrumb (depth >= 2)  |       | Breadcrumb               |
| h1 Customers   [New customer]|   | h1 Acme Inc   [Edit] [Delete]|
| description              |       | description / status     |
| [search] [filters]       |       | +----------+ +---------+ |
| +----------------------+ |       | | Card:    | | Card:   | |
| | Table (10.3)         | |       | | details  | | related | |
| +----------------------+ |       | +----------+ +---------+ |
| Pagination               |       +--------------------------+
+--------------------------+

Create / edit form page            Settings page
+--------------------------+       +--------------------------+
| Breadcrumb               |       | h1 Settings              |
| h1 New customer          |       | Card: section title      |
| +----------------------+ |       |   form rows              |
| | FormField ...        | |       |   [Save changes]         |
| | (max-w-2xl)          | |       | Card: Danger zone        |
| +----------------------+ |       |   [Delete company]       |
| [Cancel]  [Create customer]|     +--------------------------+
+--------------------------+
```

- A small form may use a dialog instead of a page (Dialog is a future component); a form with more than about 6 fields, or one that needs room to explain, is a page.
- Create and edit share one form component; only the title and submit label differ ("Create customer" / "Save changes").
- Destructive actions live in the detail page header or a Danger zone card, never as the primary action of a form.

### 10.3 Table pattern (documented only)

| Topic | Decision |
|-------|----------|
| Data loading | **Server-side** pagination, sorting and filtering (Drizzle through `withRls`); never load all rows to the client. |
| URL state | The URL is the source of truth: `?page=2&size=25&sort=-created_at&q=acme&status=active`. `page` is 1-based; `size` is 10, 25 or 50 (default 25); `sort=name` ascending and `sort=-name` descending; `q` is free-text search; each filter is its own parameter. Defaults are omitted from the URL. Parameters are parsed with Zod; invalid values fall back to defaults. Changing a filter, search or sort resets `page` to 1. Search input updates the URL after about 300ms; page changes and sort add a history entry, typing in search replaces it. Pages are shareable and the back button works. |
| Rendering | The list page is a Server Component reading `searchParams`; controls are small client components that update the URL. |
| Structure | A real `<table>` with a caption or `aria-label`, `th scope`, sortable column headers that are buttons with `aria-sort`, a leading "primary" column (the name) that is the link to the detail page. |
| Density | Row height from `--row-height` (48 comfortable, 40 compact from `md`), `text-sm`, numbers right-aligned with tabular numerals, dates "Nov 12, 2026". |
| Long text | Primary column wraps up to two lines then truncates with an ellipsis (full text on the detail page); other cells truncate to one line. No information exists only in a truncated cell. |
| Row actions | One actions menu button at the row end with the accessible name "Actions for {name}" (Dropdown menu, a future component); the row's main action is the name link. |
| Loading | Skeleton rows (as many as the page size, up to 10) with `aria-busy` on the table region; header and toolbar stay. |
| Empty | Two distinct states. **No data yet:** empty-state pattern (7.3) with a primary action ("Create your first customer"). **No results for these filters:** "No results for these filters." with a "Clear filters" button. |
| Pagination | `<nav aria-label="Pagination">`, previous and next buttons, current page `aria-current="page"`, summary "Showing 26 to 50 of 134", disabled at the ends. |
| Error | Alert (destructive) above the table with a retry button: "We couldn't load customers. Try again." |
| Mobile fallback | Below `md` each row becomes a card (primary value as title, up to three key-value pairs, the actions menu), so there is no horizontal page scroll (FND-NFR-04). A wide read-only table may scroll horizontally inside its own container only with a reason noted in the epic's design. |

### 10.4 Forms in CRUD (documented only)

- Everything in 7.1 applies. Additional controls (Select, Textarea, Checkbox, date) are future components that plug into FormField without changing it.
- **Server field errors:** the Server Action returns `{ ok: false, error: { fieldErrors: { name: ["..."] }, formError?: "..." } }`; field errors are set on the matching fields (`setError(name, { type: "server", message })`), the first one is focused; `formError` goes to the top Alert.
- **Dirty-state guard:** a form with unsaved changes warns before leaving (browser `beforeunload` and an in-app AlertDialog "Discard changes?" with "Keep editing" and "Discard changes").
- **Actions row:** primary action and Cancel; DOM order is Cancel then primary, aligned right from `sm`, stacked full width on mobile with the primary last (the order follows reading and tab order). Cancel always available and never destructive. One primary per form.
- Primary label is "Create {entity}" when creating and "Save changes" when editing; loading "Saving…".

### 10.5 Feedback choice (documented only)

The decision table in 7.2 applies to all CRUD flows. Additional rules: a successful create or edit navigates to the detail or list page and shows a success toast there ("Customer created."); a successful delete returns to the list with a toast, with "Undo" when the delete is soft and reversible; failed deletes show an error toast with a retry action.

### 10.6 Destructive actions (documented only)

Confirmation uses AlertDialog (a future component): title "Delete {name}?", body that states the consequence ("This permanently deletes {name} and its data. This can't be undone."), buttons "Cancel" (outline, receives initial focus) and "Delete {entity}" (destructive). No typed confirmation unless the consequence is severe (deleting a company), where the person types the company name. Never a native `confirm()`.

### 10.7 CRUD verbs and naming (documented only)

| Intent | Verb | Notes |
|--------|------|-------|
| Make a new record | **Create** (submit: "Create customer"); the entry action in the page header is "New customer" | "Add" only for attaching an existing thing to another ("Add member to team") |
| Change a record | **Edit** (entry action), **Save changes** (submit) | Never "Update" as a button |
| Destroy a record | **Delete** | Never "Remove" for destroying |
| Detach without destroying | **Remove** ("Remove member") | The record continues to exist |
| Leave without saving | **Cancel** | |
| View | the name is the link; no "View" button | |

Entity names come from the spec glossary: singular for the single record ("New customer"), plural for lists and navigation ("Customers"), sentence case, and "company" wherever the tenant is meant.

## 11. Future components (NOT specified here)

These will certainly be needed by CRUD epics but are **not specified or built in epic 001**. The first epic that needs one adds its specification to section 4, builds it from tokens, and lists it on `/design` before use (shadcn's CLI adds them cheaply and they inherit the same tokens):

Table (and a data-table wrapper), Dialog and AlertDialog, Select, Dropdown menu, Tabs, Pagination, Badge, Textarea, Checkbox, Breadcrumb.

Also not specified: Avatar, Tooltip as a standalone component, Sheet as a standalone component, charts, a dark-mode toggle, Storybook, illustrations and a logo image.

## 12. The `/design` showcase page (content spec and gating)

**Purpose.** The living, checkable acceptance artifact of this document: every token and every component in every state, in both themes, on one page, covered by one axe run (FND-FR-17, FND-NFR-03).

### 12.1 Gating rule

- `GET /design` renders in development and in CI/E2E and returns **404 in the production build** (the Vercel deploy). The switch is an explicit server-side flag read through `src/lib/env.ts` (on locally and in CI, absent on Vercel; the name and wiring are decided in FND-T-32 and documented in `.env.example`). The page calls Next.js `notFound()` when the flag is off, so the 404 is the real not-found response.
- Not linked from any product navigation, the home page or the shell. Marked `noindex` (robots metadata). Not in any sitemap.
- The gate must not affect `/api/health` or any other route.
- Checked in E2E against a production-mode start with the flag off (FND-T-33).

### 12.2 Page structure

A single scrolling page with an in-page section list at the top (anchors) and these sections, in order. The page itself uses the app's normal tokens and follows the system theme.

1. **How to read this page**: one paragraph, the legend, and the note that hover, active and focus-visible states are live (hover, press and Tab through them); static states are shown as samples.
2. **Color**: every token of 2.2 as a swatch with its name, light and dark values and, for foreground/background pairs, the measured contrast and the pass mark.
3. **Typography**: the full scale and every role with sample text, weights, and the font name.
4. **Spacing, radius, shadow, motion**: the spacing steps as bars, the radius scale, the elevation roles, and the motion tokens (a demo that respects reduced motion).
5. **Density and targets**: comfortable, compact and touch control heights side by side.
6. **Icons**: the icon set subset in use, in its three sizes.
7. **Components**: one subsection per component, each rendering the full matrix:
   - Button: all variants by sizes by states (default, disabled, loading; hover, active, focus-visible live), icon button, with and without icons, full width.
   - Input: default, filled, with placeholder, focused (live), invalid, disabled, read-only, long value.
   - Label: normal, optional marker, long label.
   - FormField: with hint, with error, with hint and error, optional, disabled, long error text, and a working React Hook Form example that shows blur validation and `aria-describedby`.
   - Password input: masked, visible, invalid, disabled; a live toggle.
   - Alert: the four variants with and without title, with a link, with long text.
   - Card: header, content, footer, with long title and content.
   - Spinner and Skeleton: three sizes; the skeleton shapes of a page header and a card; a reduced-motion note.
   - Toast: buttons that fire each of the toast types, one with an action, to prove the single provider.
   - Link: default, hover (live), in running text, inside an alert.
8. **Layouts**: the auth layout in a framed 375px preview and a framed desktop preview (an embedded frame or a scaled container, so the page itself keeps no horizontal scroll); the app shell the same way (desktop, mobile closed, mobile drawer open as a static sample plus a live drawer on the real page at mobile width).
9. **Patterns**: the empty-state recipe, a form-level error Alert on a form, a skeleton loading page.
10. **Both themes**: each of sections 2 to 9 is shown **twice side by side** (stacked on mobile): a panel with `data-theme="light"` and one with `data-theme="dark"` (these set only `color-scheme`, see 2.1). Overlays that render in a portal (the drawer, toasts) follow the page theme, not the panel; the E2E run covers them by running the whole page under both emulated system themes.

Every component added later is added to section 7 as part of its Definition of Done (1.2).

### 12.4 Known limits and accepted deviations (design review FND-T-34)

**M4 note.** The Layouts section stacks the light and dark panels in one column, but the page container is `max-w-7xl` (usable panel width about 1160px), so the 1280px frames still scroll horizontally about 120px inside their panel. Showing them fully would need a wider `/design` container or frame scaling (which needs an inline style or arbitrary value that rule 1.1 forbids). Accepted; the page says that a frame wider than the page scrolls, and the layouts are also covered by E2E tests.

**Accepted deviations (decisions of the review):**

| Deviation | Decision |
|-----------|----------|
| Password toggle covers the 1px input border (4.5) | Accept with note. An exact fit needs a `calc()` or a new utility for little gain. |
| Focused and invalid input keeps the destructive border plus the ring outline (4.2) | Accept with note. |
| Button loading does not hold `min-width` (4.1) | Accept with note: use `w-full` on submit buttons. |
| Skeleton is not a region component (4.8) | Accept with note: the region wrapper owns `aria-busy`. |
| Drawer `w-72 max-w-5/6` (83%) instead of 85% (2.7) | Accept. |
| No desktop sidebar collapse and no Ctrl/Cmd+B (5.2) | Accept. |
| Drawer copy "Navigation" and "Close navigation" (5.2) | Accept, final. |
| Sign-out as a plain ghost "Log out" button (5.2) | Accept with note: epic 002's design phase may choose ghost or outline once it sees it in place. |
| Empty state as a pattern, not a component (7.3) | Accept until a second screen needs it. |
| Geist from the `geist` package (0.2, 2.3) | Accept. |
| Colors as hex (2.2) | Accept. |
| Hover, active and focus-visible are live, not static, on `/design` | Accept; stated on the page and tested with real interaction. |
| Shell wordmark is not a link (5.2) | Deferred to epic 002. |

### 12.3 Checks the page must support

Zero axe violations in light and dark; no horizontal page scroll at 375px and 1280px; the 404 gate; exactly one toast provider; FormField's error exposes `aria-invalid` and `aria-describedby`; the keyboard path to the mobile drawer (FND-FR-15 to FND-FR-17, FND-NFR-03, FND-NFR-04; tests in FND-T-33).

## 13. Maintenance

- This document and `/design` change together; a component is not done until both are updated.
- The first CRUD epic must update section 10 and `/design` as part of its Definition of Done (risk R9 in the spec).
- Tone and microcopy in 8.3 are defaults; epic 002's design phase may refine them and updates this document when it does.
- Token changes happen only in `src/app/globals.css`, and the contrast table in 2.2 is re-checked when they do.

## Change log

| Date | Change |
|------|--------|
| 2026-11-12 | First version (FND-T-28). |
| 2026-11-13 | Aligned with the implementation after the design review (FND-T-59): Geist via the `geist` package (0.2, 2.3); `browserslist` note (0.2); `--canvas` token, elevation rule and contrast pair (2.2, 5.1); drawer `w-72 max-w-5/6` (2.7); Button loading width rule (4.1); focused-and-invalid Input (4.2); password toggle anatomy (4.5); skeleton region rule and ellipsis character (4.8, 8.2); PageHeader action rule at `md`, final drawer copy and shell wordmark note (5.2); known limits and accepted deviations (12.4). |
