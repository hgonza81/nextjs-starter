import { Label as LabelPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type LabelProps = ComponentProps<typeof LabelPrimitive.Root> & {
  /**
   * Marks an optional field. Required is the default and is never marked
   * (design system 4.3).
   */
  isOptional?: boolean;
};

/**
 * Visible, programmatically associated name of a control. Keeps full contrast
 * when the control is disabled or invalid (the error text is the signal).
 */
export function Label({
  className,
  children,
  isOptional = false,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn("text-sm leading-5 font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {isOptional ? (
        <span className="font-normal text-muted-foreground"> (optional)</span>
      ) : null}
    </LabelPrimitive.Root>
  );
}
