import { CircleCheck, LayoutDashboard, Menu } from "lucide-react";

import {
  Sample,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";
import { Button } from "@/components/ui/button";

const VARIANTS = [
  "default",
  "outline",
  "ghost",
  "destructive",
  "link",
] as const;
const SIZES = ["default", "sm"] as const;

/** Design system 4.1. Hover, active and focus-visible are live states. */
export function ButtonSamples() {
  return (
    <Subsection
      title="Button"
      description="Every variant at both sizes in the default, disabled and loading states. Hover, press and Tab through any of them to see the live states."
    >
      <ThemePair>
        {SIZES.map((size) => (
          <Sample
            key={size}
            label={`Size ${size}${size === "sm" ? " (compact from md up)" : ""}`}
          >
            <div className="flex flex-col gap-3">
              {VARIANTS.map((variant) => (
                <div
                  key={variant}
                  className="flex flex-wrap items-center gap-3"
                >
                  <Button variant={variant} size={size}>
                    {variant}
                  </Button>
                  <Button variant={variant} size={size} disabled>
                    {variant} disabled
                  </Button>
                  <Button variant={variant} size={size} isLoading>
                    Saving...
                  </Button>
                </div>
              ))}
            </div>
          </Sample>
        ))}
        <Sample label="Icon buttons (variants, then disabled)">
          <div className="flex flex-wrap items-center gap-3">
            {VARIANTS.filter((variant) => variant !== "link").map((variant) => (
              <Button
                key={variant}
                variant={variant}
                size="icon"
                aria-label={`Open navigation, ${variant} variant`}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            ))}
            <Button
              variant="outline"
              size="icon"
              aria-label="Open navigation, disabled"
              disabled
            >
              <Menu className="size-5" aria-hidden />
            </Button>
          </div>
        </Sample>
        <Sample label="With leading and trailing icons">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <LayoutDashboard className="size-5" aria-hidden />
              Leading icon
            </Button>
            <Button variant="outline">
              Trailing icon
              <CircleCheck className="size-5" aria-hidden />
            </Button>
          </div>
        </Sample>
        <Sample label="Full width (auth forms)">
          <Button className="w-full">Create account</Button>
        </Sample>
      </ThemePair>
    </Subsection>
  );
}
