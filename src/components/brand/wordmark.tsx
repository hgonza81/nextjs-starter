import { cn } from "@/lib/utils";

/**
 * The product name: the one place to rebrand it (design system 2.9). The root
 * layout `<title>` and the home heading read this constant too.
 */
export const PRODUCT_NAME = "Next.js Starter";

type WordmarkProps = {
  /** Layout only (margin, width); never colors or spacing overrides. */
  className?: string;
};

/** Text-only wordmark: plain text, no image, so it follows the theme tokens. */
export function Wordmark({ className }: WordmarkProps) {
  return (
    <span
      className={cn("font-semibold tracking-tight text-foreground", className)}
    >
      {PRODUCT_NAME}
    </span>
  );
}
