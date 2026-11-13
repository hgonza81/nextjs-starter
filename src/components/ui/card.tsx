import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Bordered container that groups related content (design system 4.7). */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xs",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

type CardTitleProps = ComponentProps<"h2"> & {
  /** Heading level: the auth card uses `h1`, other cards `h2` (the default). */
  as?: "h1" | "h2" | "h3";
};

export function CardTitle({
  as: Heading = "h2",
  className,
  ...props
}: CardTitleProps) {
  return (
    <Heading
      className={cn("text-lg font-semibold break-words", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-w-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props} />
  );
}
