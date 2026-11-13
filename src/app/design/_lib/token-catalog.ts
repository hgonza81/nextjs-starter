/**
 * What `/design` displays for color: the tokens grouped as in design system
 * 2.2 and the foreground/background pairs with their WCAG thresholds.
 *
 * Tailwind only generates classes it finds as complete strings, so each
 * swatch and sample lists its utility classes literally here instead of
 * building them from the token name. The values themselves are never listed:
 * they are read from `globals.css` (see css-tokens.ts), and
 * token-catalog.test.ts fails when the two lists drift.
 */

export type SwatchToken = {
  readonly token: string;
  /** Background utility that paints the token. */
  readonly swatchClass: string;
};

export type TokenGroup = {
  readonly title: string;
  readonly tokens: readonly SwatchToken[];
};

export const TOKEN_GROUPS: readonly TokenGroup[] = [
  {
    title: "Neutral and surface roles",
    tokens: [
      { token: "--background", swatchClass: "bg-background" },
      { token: "--foreground", swatchClass: "bg-foreground" },
      { token: "--card", swatchClass: "bg-card" },
      { token: "--card-foreground", swatchClass: "bg-card-foreground" },
      { token: "--popover", swatchClass: "bg-popover" },
      { token: "--popover-foreground", swatchClass: "bg-popover-foreground" },
      { token: "--muted", swatchClass: "bg-muted" },
      { token: "--muted-foreground", swatchClass: "bg-muted-foreground" },
      { token: "--accent", swatchClass: "bg-accent" },
      { token: "--accent-foreground", swatchClass: "bg-accent-foreground" },
      { token: "--border", swatchClass: "bg-border" },
      { token: "--input", swatchClass: "bg-input" },
      { token: "--overlay", swatchClass: "bg-overlay" },
    ],
  },
  {
    title: "Brand accent and focus",
    tokens: [
      { token: "--primary", swatchClass: "bg-primary" },
      { token: "--primary-hover", swatchClass: "bg-primary-hover" },
      { token: "--primary-active", swatchClass: "bg-primary-active" },
      { token: "--primary-foreground", swatchClass: "bg-primary-foreground" },
      { token: "--ring", swatchClass: "bg-ring" },
    ],
  },
  {
    title: "Status roles",
    tokens: [
      { token: "--destructive", swatchClass: "bg-destructive" },
      { token: "--destructive-hover", swatchClass: "bg-destructive-hover" },
      {
        token: "--destructive-foreground",
        swatchClass: "bg-destructive-foreground",
      },
      { token: "--destructive-subtle", swatchClass: "bg-destructive-subtle" },
      {
        token: "--destructive-subtle-foreground",
        swatchClass: "bg-destructive-subtle-foreground",
      },
      { token: "--success", swatchClass: "bg-success" },
      { token: "--success-foreground", swatchClass: "bg-success-foreground" },
      { token: "--success-subtle", swatchClass: "bg-success-subtle" },
      {
        token: "--success-subtle-foreground",
        swatchClass: "bg-success-subtle-foreground",
      },
      { token: "--warning", swatchClass: "bg-warning" },
      { token: "--warning-foreground", swatchClass: "bg-warning-foreground" },
      { token: "--warning-subtle", swatchClass: "bg-warning-subtle" },
      {
        token: "--warning-subtle-foreground",
        swatchClass: "bg-warning-subtle-foreground",
      },
      { token: "--info", swatchClass: "bg-info" },
      { token: "--info-foreground", swatchClass: "bg-info-foreground" },
      { token: "--info-subtle", swatchClass: "bg-info-subtle" },
      {
        token: "--info-subtle-foreground",
        swatchClass: "bg-info-subtle-foreground",
      },
    ],
  },
  {
    title: "Sidebar roles",
    tokens: [
      { token: "--sidebar", swatchClass: "bg-sidebar" },
      { token: "--sidebar-foreground", swatchClass: "bg-sidebar-foreground" },
      { token: "--sidebar-accent", swatchClass: "bg-sidebar-accent" },
      {
        token: "--sidebar-accent-foreground",
        swatchClass: "bg-sidebar-accent-foreground",
      },
      { token: "--sidebar-border", swatchClass: "bg-sidebar-border" },
      { token: "--sidebar-ring", swatchClass: "bg-sidebar-ring" },
    ],
  },
];

type ContrastPairBase = {
  readonly foreground: string;
  readonly background: string;
};

/**
 * Text pair, 4.5:1 (WCAG 2.2 AA). `sampleClass` renders "Aa" on the
 * background.
 */
type TextContrastPair = ContrastPairBase & {
  readonly minimum: 4.5;
  readonly sampleClass: string;
};

/**
 * UI component or focus indicator pair, 3:1. No `sampleClass`: it is drawn as
 * a bar, because rendering low-contrast "text" would be a real axe violation.
 */
type ComponentContrastPair = ContrastPairBase & { readonly minimum: 3 };

export type ContrastPair = TextContrastPair | ComponentContrastPair;

/** The pairs of the contrast table in design system 2.2. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  {
    foreground: "--foreground",
    background: "--background",
    minimum: 4.5,
    sampleClass: "text-foreground bg-background",
  },
  {
    foreground: "--card-foreground",
    background: "--card",
    minimum: 4.5,
    sampleClass: "text-card-foreground bg-card",
  },
  {
    foreground: "--muted-foreground",
    background: "--background",
    minimum: 4.5,
    sampleClass: "text-muted-foreground bg-background",
  },
  {
    foreground: "--muted-foreground",
    background: "--card",
    minimum: 4.5,
    sampleClass: "text-muted-foreground bg-card",
  },
  {
    foreground: "--muted-foreground",
    background: "--muted",
    minimum: 4.5,
    sampleClass: "text-muted-foreground bg-muted",
  },
  {
    foreground: "--foreground",
    background: "--accent",
    minimum: 4.5,
    sampleClass: "text-foreground bg-accent",
  },
  {
    foreground: "--muted-foreground",
    background: "--sidebar",
    minimum: 4.5,
    sampleClass: "text-muted-foreground bg-sidebar",
  },
  {
    foreground: "--muted-foreground",
    background: "--sidebar-accent",
    minimum: 4.5,
    sampleClass: "text-muted-foreground bg-sidebar-accent",
  },
  {
    foreground: "--primary-foreground",
    background: "--primary",
    minimum: 4.5,
    sampleClass: "text-primary-foreground bg-primary",
  },
  {
    foreground: "--primary-foreground",
    background: "--primary-hover",
    minimum: 4.5,
    sampleClass: "text-primary-foreground bg-primary-hover",
  },
  {
    foreground: "--primary-foreground",
    background: "--primary-active",
    minimum: 4.5,
    sampleClass: "text-primary-foreground bg-primary-active",
  },
  {
    foreground: "--primary",
    background: "--background",
    minimum: 4.5,
    sampleClass: "text-primary bg-background",
  },
  {
    foreground: "--primary",
    background: "--card",
    minimum: 4.5,
    sampleClass: "text-primary bg-card",
  },
  {
    foreground: "--primary",
    background: "--muted",
    minimum: 4.5,
    sampleClass: "text-primary bg-muted",
  },
  {
    foreground: "--ring",
    background: "--background",
    minimum: 3,
  },
  {
    foreground: "--ring",
    background: "--card",
    minimum: 3,
  },
  {
    foreground: "--input",
    background: "--background",
    minimum: 3,
  },
  {
    foreground: "--input",
    background: "--card",
    minimum: 3,
  },
  {
    foreground: "--destructive-foreground",
    background: "--destructive",
    minimum: 4.5,
    sampleClass: "text-destructive-foreground bg-destructive",
  },
  {
    foreground: "--destructive-foreground",
    background: "--destructive-hover",
    minimum: 4.5,
    sampleClass: "text-destructive-foreground bg-destructive-hover",
  },
  {
    foreground: "--destructive",
    background: "--background",
    minimum: 4.5,
    sampleClass: "text-destructive bg-background",
  },
  {
    foreground: "--destructive",
    background: "--muted",
    minimum: 4.5,
    sampleClass: "text-destructive bg-muted",
  },
  {
    foreground: "--destructive-subtle-foreground",
    background: "--destructive-subtle",
    minimum: 4.5,
    sampleClass: "text-destructive-subtle-foreground bg-destructive-subtle",
  },
  {
    foreground: "--success-foreground",
    background: "--success",
    minimum: 4.5,
    sampleClass: "text-success-foreground bg-success",
  },
  {
    foreground: "--success-subtle-foreground",
    background: "--success-subtle",
    minimum: 4.5,
    sampleClass: "text-success-subtle-foreground bg-success-subtle",
  },
  {
    foreground: "--warning-foreground",
    background: "--warning",
    minimum: 4.5,
    sampleClass: "text-warning-foreground bg-warning",
  },
  {
    foreground: "--warning-subtle-foreground",
    background: "--warning-subtle",
    minimum: 4.5,
    sampleClass: "text-warning-subtle-foreground bg-warning-subtle",
  },
  {
    foreground: "--info-foreground",
    background: "--info",
    minimum: 4.5,
    sampleClass: "text-info-foreground bg-info",
  },
  {
    foreground: "--info-subtle-foreground",
    background: "--info-subtle",
    minimum: 4.5,
    sampleClass: "text-info-subtle-foreground bg-info-subtle",
  },
  {
    foreground: "--success",
    background: "--background",
    minimum: 3,
  },
  {
    foreground: "--warning",
    background: "--background",
    minimum: 3,
  },
  {
    foreground: "--info",
    background: "--background",
    minimum: 3,
  },
];
