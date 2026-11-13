import {
  Section,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";

const SCALE = [
  { step: "12 / 16", utility: "text-xs", className: "text-xs" },
  { step: "14 / 20", utility: "text-sm", className: "text-sm" },
  { step: "16 / 24", utility: "text-base", className: "text-base" },
  { step: "18 / 28", utility: "text-lg", className: "text-lg" },
  { step: "20 / 28", utility: "text-xl", className: "text-xl" },
  { step: "24 / 32", utility: "text-2xl", className: "text-2xl" },
  { step: "30 / 36", utility: "text-3xl", className: "text-3xl" },
  { step: "36 / 40", utility: "text-4xl", className: "text-4xl" },
] as const;

const WEIGHTS = [
  { name: "Regular 400", className: "font-normal" },
  { name: "Medium 500", className: "font-medium" },
  { name: "Semibold 600", className: "font-semibold" },
] as const;

const ROLES = [
  {
    role: "Display",
    className: "text-3xl font-semibold tracking-tight md:text-4xl",
    sample: "Next.js Starter",
  },
  {
    role: "Page title (h1)",
    className: "text-2xl font-semibold tracking-tight",
    sample: "Create your account",
  },
  {
    role: "Section or card title (h2)",
    className: "text-lg font-semibold",
    sample: "Company details",
  },
  {
    role: "Subsection (h3)",
    className: "text-base font-semibold",
    sample: "Billing contact",
  },
  {
    role: "Body",
    className: "text-base",
    sample: "Plain body text for paragraphs.",
  },
  {
    role: "UI text (labels, buttons, hints)",
    className: "text-sm font-medium",
    sample: "Email address",
  },
  {
    role: "Caption",
    className: "text-xs text-muted-foreground",
    sample: "Metadata only, never essential.",
  },
  {
    role: "Code",
    className: "font-mono text-sm",
    sample: "DESIGN_PAGE_ENABLED=true",
  },
] as const;

/** Section 3 of the content spec: the type scale, weights and roles. */
export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="One font, Geist (variable, loaded once in the root layout), with the system monospace stack for code. Text inputs are 16px below md and 14px from md."
    >
      <ThemePair>
        <Subsection title="Scale">
          <ul className="flex flex-col gap-3">
            {SCALE.map((entry) => (
              <li key={entry.utility} className="min-w-0">
                <p className={entry.className}>The quick brown fox</p>
                <p className="text-xs text-muted-foreground">
                  {entry.step},{" "}
                  <code className="font-mono">{entry.utility}</code>
                </p>
              </li>
            ))}
          </ul>
        </Subsection>
        <Subsection title="Weights">
          <ul className="flex flex-col gap-2">
            {WEIGHTS.map((entry) => (
              <li key={entry.name} className={entry.className}>
                {entry.name}
              </li>
            ))}
          </ul>
        </Subsection>
        <Subsection title="Roles">
          <ul className="flex flex-col gap-4">
            {ROLES.map((entry) => (
              <li key={entry.role} className="min-w-0">
                <p className={entry.className}>{entry.sample}</p>
                <p className="text-xs text-muted-foreground">{entry.role}</p>
              </li>
            ))}
          </ul>
        </Subsection>
      </ThemePair>
    </Section>
  );
}
