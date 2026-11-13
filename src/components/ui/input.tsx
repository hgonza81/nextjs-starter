import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Single-line text input (design system 4.2). Use it inside FormField, which
 * wires the label, `aria-invalid` and `aria-describedby`. Text is 16px below
 * `md` so iOS Safari does not zoom on focus.
 *
 * The focus treatment is a `--ring` border plus a 2px outline with no offset
 * (an outline survives forced-colors mode). `aria-invalid` only changes the
 * border: the message and icon in FormField carry the meaning.
 */
export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-control w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground md:text-sm",
        "transition-colors duration-fast ease-standard placeholder:text-muted-foreground",
        "aria-invalid:border-destructive",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring",
        "read-only:bg-muted disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
