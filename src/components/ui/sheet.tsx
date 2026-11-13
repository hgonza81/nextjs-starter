"use client";

import { Dialog as SheetPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Left-anchored drawer built on the Radix Dialog (focus trap, Escape, scrim
 * click and focus return come from Radix; callers render their own close
 * control with `SheetClose`). Internal dependency of the app
 * shell (design system 6.1): no other screen uses it until it is specified.
 */
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

type SheetContentProps = ComponentProps<typeof SheetPrimitive.Content> & {
  /** Accessible name of the dialog (design system 5.2: "Navigation"). */
  title: string;
};

export function SheetContent({
  title,
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-overlay bg-overlay duration-slow ease-standard data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
      <SheetPrimitive.Content
        // No visible description: the title names the dialog, and Radix would
        // otherwise warn about a missing description.
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-drawer flex w-72 max-w-5/6 flex-col border-r border-border bg-popover text-popover-foreground shadow-md",
          "duration-slow ease-standard data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left",
          className,
        )}
        {...props}
      >
        <SheetPrimitive.Title className="sr-only">{title}</SheetPrimitive.Title>
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export { Sheet, SheetClose, SheetTrigger };
