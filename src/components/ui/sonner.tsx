"use client";

import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Adapted from the shadcn wrapper (design system 4.9): no `next-themes`, the
// theme follows the system through `theme="system"` and the color tokens, and
// status icons use Lucide colored with the status roles.
const toasterStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius-lg)",
  // Beats Sonner's own stylesheet value.
  zIndex: "var(--z-toast)",
  fontFamily: "inherit",
} as CSSProperties; // Sonner reads custom properties that CSSProperties does not list.

/** Mount exactly once, in the root layout. Call `toast.*` from client code. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-right"
      closeButton
      duration={5000}
      visibleToasts={3}
      style={toasterStyle}
      toastOptions={{
        // `!` because Sonner's unlayered stylesheet would beat a layered
        // Tailwind utility; this keeps the shadow on the design-system token.
        classNames: { toast: "shadow-md!" },
      }}
      icons={{
        success: <CircleCheck className="size-4 text-success" aria-hidden />,
        info: <Info className="size-4 text-info" aria-hidden />,
        warning: <TriangleAlert className="size-4 text-warning" aria-hidden />,
        error: <CircleAlert className="size-4 text-destructive" aria-hidden />,
        loading: <LoaderCircle className="size-4 animate-spin" aria-hidden />,
      }}
      {...props}
    />
  );
}
