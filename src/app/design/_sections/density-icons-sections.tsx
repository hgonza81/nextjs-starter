import {
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Info,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  Sample,
  Section,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Section 5 of the content spec: comfortable, compact and touch heights. */
export function DensitySection() {
  return (
    <Section
      id="density"
      title="Density and targets"
      description="Below md every control is 44px for touch. From md the default (comfortable) height is 40px and the compact height is 32px. Resize the window across 768px to see them change."
    >
      <ThemePair>
        <Sample label="Comfortable: --control-height (h-control), 44px below md, 40px from md">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default button</Button>
            <Input
              aria-label="Comfortable input sample"
              placeholder="Default input"
              className="max-w-xs"
            />
          </div>
        </Sample>
        <Sample label="Compact: --control-height-compact (h-control-compact), 44px below md, 32px from md">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Compact button</Button>
            <Input
              aria-label="Compact input sample"
              placeholder="Compact input"
              className="h-control-compact max-w-xs"
            />
          </div>
        </Sample>
        <Sample label="Icon button: square at control height">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation sample"
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          </div>
        </Sample>
      </ThemePair>
    </Section>
  );
}

const ICONS = [
  { name: "Eye", Icon: Eye },
  { name: "EyeOff", Icon: EyeOff },
  { name: "Info", Icon: Info },
  { name: "CircleCheck", Icon: CircleCheck },
  { name: "TriangleAlert", Icon: TriangleAlert },
  { name: "CircleAlert", Icon: CircleAlert },
  { name: "LoaderCircle", Icon: LoaderCircle },
  { name: "Menu", Icon: Menu },
  { name: "X", Icon: X },
  { name: "LayoutDashboard", Icon: LayoutDashboard },
] as const;

/** Section 6 of the content spec: the Lucide subset in its three sizes. */
export function IconsSection() {
  return (
    <Section
      id="icons"
      title="Icons"
      description="Lucide only, default stroke. Sizes: 16 (size-4), 20 (size-5, default) and 24 (size-6). Decorative icons are hidden from assistive technology."
    >
      <ThemePair>
        <Subsection title="Icons in use">
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ICONS.map(({ name, Icon }) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <Icon className="size-4" aria-hidden />
                <Icon className="size-5" aria-hidden />
                <Icon className="size-6" aria-hidden />
                <code className="font-mono">{name}</code>
              </li>
            ))}
          </ul>
        </Subsection>
      </ThemePair>
    </Section>
  );
}
