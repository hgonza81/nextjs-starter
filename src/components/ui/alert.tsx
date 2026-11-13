import { cva, type VariantProps } from "class-variance-authority";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "flex items-start gap-3 rounded-lg border p-4 text-sm",
  {
    variants: {
      variant: {
        info: "border-info bg-info-subtle text-info-subtle-foreground",
        success:
          "border-success bg-success-subtle text-success-subtle-foreground",
        warning:
          "border-warning bg-warning-subtle text-warning-subtle-foreground",
        destructive:
          "border-destructive bg-destructive-subtle text-destructive-subtle-foreground",
      },
    },
  },
);

type AlertVariant = NonNullable<VariantProps<typeof alertVariants>["variant"]>;

const alertIcons = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleAlert,
} satisfies Record<AlertVariant, LucideIcon>;

type AlertProps = Omit<ComponentProps<"div">, "role"> & {
  variant: AlertVariant;
  /**
   * Announce the alert when it appears as the RESULT of an action (a failed
   * submit): `destructive` and `warning` use `role="alert"` (assertive), `info`
   * and `success` use `role="status"` (polite). A page notice that is present
   * on first render leaves this false and has no live role (design system 4.6).
   */
  isAnnounced?: boolean;
};

/** Inline, persistent message about the state of a page or form. */
export function Alert({
  variant,
  isAnnounced = false,
  className,
  children,
  ...props
}: AlertProps) {
  const Icon = alertIcons[variant];
  const isUrgent = variant === "destructive" || variant === "warning";
  const role = isAnnounced ? (isUrgent ? "alert" : "status") : undefined;

  return (
    <div
      role={role}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1 break-words">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("font-medium", className)} {...props} />;
}

export function AlertDescription({
  className,
  ...props
}: ComponentProps<"div">) {
  return <div className={className} {...props} />;
}
