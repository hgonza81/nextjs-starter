"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps, MouseEvent } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Client component: the loading guard installs an onClick handler, which a
// Server Component cannot render onto a host element (found in FND-T-31 when
// a server page used a Button).
//
// Hover and active are skipped while the button is disabled or loading
// (`aria-disabled`), so a busy button does not look clickable.
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap",
    "transition-colors duration-fast ease-standard focus-ring",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground not-disabled:not-aria-disabled:hover:bg-primary-hover not-disabled:not-aria-disabled:active:bg-primary-active",
        outline:
          "border border-input bg-background text-foreground not-disabled:not-aria-disabled:hover:bg-accent",
        ghost: "text-foreground not-disabled:not-aria-disabled:hover:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground not-disabled:not-aria-disabled:hover:bg-destructive-hover",
        link: "text-primary underline underline-offset-4 not-disabled:not-aria-disabled:hover:underline-offset-6",
      },
      size: {
        default: "h-control px-4",
        // Compact density: only differs from `default` from `md` up, where
        // --control-height-compact drops below the 44px touch minimum.
        sm: "h-control-compact px-3",
        // Square at control height; callers must pass `aria-label`.
        icon: "h-control aspect-square",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (for example a Next.js `Link`) as the button. */
    asChild?: boolean;
    /**
     * Loading state (design system 4.1): `aria-disabled` instead of `disabled`
     * so focus is kept, clicks and Enter are ignored (no double submit), and a
     * decorative Spinner precedes the label. The caller switches the label to
     * its progressive form ("Creating account...").
     */
    isLoading?: boolean;
  };

/**
 * Triggers an action. Use `type="submit"` only on a form's submit button; the
 * default is `type="button"` so a stray button never submits a form.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  isLoading = false,
  type = "button",
  onClick,
  children,
  ...props
}: ButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isLoading) {
      // Also stops the implicit form submission that Enter triggers through
      // a synthetic click on the submit button.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  }

  if (asChild) {
    return (
      <Slot.Root
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      type={type}
      aria-disabled={isLoading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      onClick={handleClick}
      {...props}
    >
      {isLoading ? <Spinner decorative /> : null}
      {children}
    </button>
  );
}
