import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * The shared text-link style (design system 4.10): always underlined so a link
 * is not identified by color alone. A link navigates; an action is a Button.
 */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        "rounded-sm text-primary underline decoration-1 underline-offset-4",
        "transition-colors duration-fast ease-standard hover:text-primary-hover hover:decoration-2",
        "focus-ring",
        className,
      )}
      {...props}
    />
  );
}
