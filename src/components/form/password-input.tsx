"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  ComponentProps<typeof Input>,
  "type" | "autoComplete"
> & {
  /** Required with no default so it cannot be forgotten (password managers). */
  autoComplete: "current-password" | "new-password";
};

/**
 * Password entry with a show/hide toggle (design system 4.5). Masked on first
 * render and on every mount; the choice is never persisted and nothing is
 * revealed or hidden automatically. Paste and autofill are never blocked.
 */
export function PasswordInput({ id, className, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOff : Eye;

  return (
    <div className="relative">
      {/* Right padding equals the toggle width (44px, 40px from md). */}
      <Input
        id={inputId}
        type={isVisible ? "text" : "password"}
        className={cn("pe-11 md:pe-10", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0 right-0 text-muted-foreground"
        // The accessible name changes instead of aria-pressed, so the change
        // is not announced twice.
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-controls={inputId}
        disabled={props.disabled}
        onClick={() => setIsVisible((current) => !current)}
      >
        <Icon className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
