import type { Metadata } from "next";

import { Section } from "@/app/design/_components/section";
import { ColorSection } from "@/app/design/_sections/color-section";
import { ComponentsSection } from "@/app/design/_sections/components-section";
import {
  DensitySection,
  IconsSection,
} from "@/app/design/_sections/density-icons-sections";
import { LayoutsSection } from "@/app/design/_sections/layouts-section";
import { PatternsSection } from "@/app/design/_sections/patterns-section";
import { ScaleSection } from "@/app/design/_sections/scale-section";
import { StatusPageSection } from "@/app/design/_sections/status-page-section";
import { TypographySection } from "@/app/design/_sections/typography-section";
import { TextLink } from "@/components/ui/text-link";

export const metadata: Metadata = { title: "Design system" };

const SECTION_LINKS = [
  { id: "how-to-read", label: "How to read this page" },
  { id: "color", label: "Color" },
  { id: "typography", label: "Typography" },
  { id: "scale", label: "Spacing, radius, shadow, motion" },
  { id: "density", label: "Density and targets" },
  { id: "icons", label: "Icons" },
  { id: "components", label: "Components" },
  { id: "layouts", label: "Layouts" },
  { id: "patterns", label: "Patterns" },
  { id: "status-page", label: "Status page" },
] as const;

/**
 * The `/design` showcase (FND-FR-17, design system section 12). The gate lives
 * in `layout.tsx`. Each section 2 to 9 shows its content in a light and a dark
 * panel side by side.
 */
export default function DesignPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Design system</h1>
        <nav aria-label="Sections">
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {SECTION_LINKS.map((link) => (
              <li key={link.id}>
                <TextLink href={`#${link.id}`}>{link.label}</TextLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <Section
        id="how-to-read"
        title="How to read this page"
        description="Every token and component of the design system, in light and dark side by side (stacked on small screens). Tokens come from the single token file."
      >
        <ul className="flex max-w-prose list-disc flex-col gap-2 ps-6 text-sm">
          <li>
            Static samples show the default, disabled, loading and invalid
            states.
          </li>
          <li>
            Hover, active (pressed) and focus-visible are live states and cannot
            be rendered statically: hover, press and Tab through the samples to
            see them. Automated tests exercise them with real interaction.
          </li>
          <li>
            Toasts and the mobile drawer render outside the panels, so they
            follow your system theme; the layouts are framed pages, each forced
            to the panel&apos;s theme.
          </li>
          <li>
            This page is not linked from the product and returns 404 in
            production.
          </li>
        </ul>
      </Section>

      <ColorSection />
      <TypographySection />
      <ScaleSection />
      <DensitySection />
      <IconsSection />
      <ComponentsSection />
      <LayoutsSection />
      <PatternsSection />
      <StatusPageSection />
    </main>
  );
}
