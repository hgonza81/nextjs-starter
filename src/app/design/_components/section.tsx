import type { ReactNode } from "react";

import type { Theme } from "@/app/design/_lib/css-tokens";
import { cn } from "@/lib/utils";

const THEMES = ["light", "dark"] as const satisfies readonly Theme[];

type SectionProps = {
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
};

/** A top-level `/design` section: an `h2` landmark region with an anchor id. */
export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      id={id}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <h2
          id={`${id}-heading`}
          className="text-xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A named block inside a section (one component, one pattern): an `h3`. */
export function Subsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * One theme panel. `data-theme` only sets `color-scheme` on the panel
 * (globals.css), so every `light-dark()` token resolves for that theme while
 * the page itself keeps following the system. Not a landmark: a `group`, so
 * the duplicated panels create no duplicate landmarks.
 */
export function ThemePanel({
  theme,
  children,
}: {
  theme: Theme;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={`${theme === "light" ? "Light" : "Dark"} theme`}
      data-theme={theme}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border p-4 md:p-6"
    >
      <p className="text-xs font-medium text-muted-foreground uppercase">
        {theme} theme
      </p>
      {children}
    </div>
  );
}

/**
 * Side by side from `lg` up, stacked below it (design system 12.2). With
 * `isStacked` the panels stay in one column at every width, for content that
 * needs the full page width (the 1280px layout frames).
 */
export function ThemeGrid({
  isStacked = false,
  children,
}: {
  isStacked?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("grid items-start gap-6", !isStacked && "lg:grid-cols-2")}
    >
      {children}
    </div>
  );
}

/** The same content in a light and a dark panel. */
export function ThemePair({ children }: { children: ReactNode }) {
  return (
    <ThemeGrid>
      {THEMES.map((theme) => (
        <ThemePanel key={theme} theme={theme}>
          {children}
        </ThemePanel>
      ))}
    </ThemeGrid>
  );
}

/** A labeled sample: a small caption naming the state above the sample. */
export function Sample({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export { THEMES };
