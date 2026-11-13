import { LoaderCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const spinnerVariants = cva("shrink-0 animate-spin", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-5",
      lg: "size-6",
    },
  },
  defaultVariants: { size: "sm" },
});

type SpinnerProps = VariantProps<typeof spinnerVariants> & {
  /**
   * True when the surrounding UI already says that something is loading (for
   * example the label of a loading Button). The icon is then hidden from
   * assistive technology. Standalone spinners leave this false.
   */
  decorative?: boolean;
  /** Layout only (margin, width). */
  className?: string;
};

/**
 * Indeterminate loading indicator (design system 4.8). Standalone it is a
 * polite `status` region named "Loading"; under reduced motion the global rule
 * in the token file makes it static.
 */
export function Spinner({ size, decorative = false, className }: SpinnerProps) {
  const icon = (
    <LoaderCircle
      className={cn(spinnerVariants({ size }), className)}
      aria-hidden
    />
  );

  if (decorative) {
    return icon;
  }

  return (
    <span role="status" className="inline-flex">
      {icon}
      <span className="sr-only">Loading</span>
    </span>
  );
}
