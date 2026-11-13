import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder block that mimics the shape of the content being loaded (design
 * system 4.8). It is hidden from assistive technology; the loading REGION that
 * contains skeletons must carry `aria-busy="true"` and one visually hidden
 * "Loading…" text. Size it with layout utilities (`h-4 w-48`).
 */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
