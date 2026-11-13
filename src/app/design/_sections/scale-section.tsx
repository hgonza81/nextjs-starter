import {
  Section,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";

const SPACING_STEPS = [
  { px: 4, utility: "1", barClass: "w-1" },
  { px: 8, utility: "2", barClass: "w-2" },
  { px: 12, utility: "3", barClass: "w-3" },
  { px: 16, utility: "4", barClass: "w-4" },
  { px: 24, utility: "6", barClass: "w-6" },
  { px: 32, utility: "8", barClass: "w-8" },
  { px: 48, utility: "12", barClass: "w-12" },
  { px: 64, utility: "16", barClass: "w-16" },
  { px: 20, utility: "5 (sizing only)", barClass: "w-5" },
  { px: 40, utility: "10 (sizing only)", barClass: "w-10" },
  { px: 44, utility: "11 (sizing only)", barClass: "w-11" },
  { px: 56, utility: "14 (sizing only)", barClass: "w-14" },
] as const;

const RADII = [
  { name: "sm", className: "rounded-sm" },
  { name: "md (controls)", className: "rounded-md" },
  { name: "lg (alert, toast)", className: "rounded-lg" },
  { name: "xl (card)", className: "rounded-xl" },
  { name: "full (pills)", className: "rounded-full" },
] as const;

const SHADOWS = [
  { name: "shadow-xs (card)", className: "shadow-xs" },
  { name: "shadow-sm", className: "shadow-sm" },
  { name: "shadow-md (toast, drawer)", className: "shadow-md" },
  { name: "shadow-lg (dialogs, reserved)", className: "shadow-lg" },
] as const;

const MOTION = [
  { name: "--duration-fast, 100ms (hover, press)", className: "duration-fast" },
  { name: "--duration-base, 150ms (default)", className: "duration-base" },
  { name: "--duration-slow, 250ms (drawer)", className: "duration-slow" },
] as const;

/** Section 4 of the content spec: spacing, radius, shadow and motion tokens. */
export function ScaleSection() {
  return (
    <Section
      id="scale"
      title="Spacing, radius, shadow and motion"
      description="The 4px spacing steps, the radius scale, the elevation roles and the motion tokens."
    >
      <ThemePair>
        <Subsection title="Spacing">
          <ul className="flex flex-col gap-2">
            {SPACING_STEPS.map((step) => (
              <li
                key={step.utility}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  aria-hidden
                  className={`h-3 shrink-0 rounded-sm bg-primary ${step.barClass}`}
                />
                <span>
                  {step.px}px, <code className="font-mono">{step.utility}</code>
                </span>
              </li>
            ))}
          </ul>
        </Subsection>
        <Subsection
          title="Radius"
          description="--radius is 0.625rem; the scale is derived from it."
        >
          <ul className="flex flex-wrap gap-4">
            {RADII.map((radius) => (
              <li
                key={radius.name}
                className="flex flex-col gap-2 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden
                  className={`size-14 border border-input bg-muted ${radius.className}`}
                />
                {radius.name}
              </li>
            ))}
          </ul>
        </Subsection>
        <Subsection
          title="Shadow and elevation"
          description="Shadows are stronger in dark; surfaces also rely on their border."
        >
          <ul className="flex flex-wrap gap-6">
            {SHADOWS.map((shadow) => (
              <li
                key={shadow.name}
                className="flex flex-col gap-2 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden
                  className={`size-14 rounded-lg border border-border bg-card ${shadow.className}`}
                />
                {shadow.name}
              </li>
            ))}
          </ul>
        </Subsection>
        <Subsection
          title="Motion"
          description="Hover a track to run the transition. Under prefers-reduced-motion it collapses to about zero (global rule in the token file)."
        >
          <ul className="flex flex-col gap-3">
            {MOTION.map((motion) => (
              <li
                key={motion.name}
                className="flex flex-col gap-1 text-xs text-muted-foreground"
              >
                <span className="group block rounded-full bg-muted">
                  <span
                    aria-hidden
                    className={`block h-3 w-8 rounded-full bg-primary transition-all ease-standard group-hover:w-full ${motion.className}`}
                  />
                </span>
                {motion.name}
              </li>
            ))}
          </ul>
        </Subsection>
      </ThemePair>
    </Section>
  );
}
