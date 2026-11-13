"use client";

import { CircleAlert } from "lucide-react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Everything FormField hands to its control (design system 4.4): the React
 * Hook Form field plus the accessibility wiring. Spread it on the control.
 */
export type FormFieldControlProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = ControllerRenderProps<TValues, TName> & {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  "aria-required"?: true;
};

type FormFieldProps<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
> = {
  control: Control<TValues>;
  name: TName;
  label: string;
  /** Always visible when given, for example password requirements. */
  hint?: ReactNode;
  /** Marks the field "(optional)"; required is the default and is unmarked. */
  isOptional?: boolean;
  /** Layout only (margin, width). */
  className?: string;
  /** Renders the control, for example `(field) => <Input {...field} />`. */
  children: (field: FormFieldControlProps<TValues, TName>) => ReactNode;
};

/**
 * The single way a labeled control with hint and error is assembled. It is
 * control-agnostic: it connects any control to React Hook Form and guarantees
 * the ARIA wiring.
 *
 * - The Label's `htmlFor` and the control's `id` match.
 * - `aria-invalid` is set only while the field has an error.
 * - `aria-describedby` lists `<id>-hint` when a hint exists and `<id>-error`
 *   while an error is shown.
 * - The error container is always in the DOM with `aria-live="polite"`, so an
 *   error that appears on blur is announced.
 *
 * Forms must use `noValidate` and `mode: "onTouched"` (design system 7.1).
 */
export function FormField<
  TValues extends FieldValues,
  TName extends FieldPath<TValues>,
>({
  control,
  name,
  label,
  hint,
  isOptional = false,
  className,
  children,
}: FormFieldProps<TValues, TName>) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message;
        const hasError = errorMessage !== undefined;
        const describedBy = [
          hint !== undefined ? hintId : null,
          hasError ? errorId : null,
        ]
          .filter((value) => value !== null)
          .join(" ");

        return (
          <div className={cn("flex flex-col", className)}>
            <Label htmlFor={id} isOptional={isOptional} className="mb-2">
              {label}
            </Label>
            {children({
              ...field,
              id,
              ...(hasError ? { "aria-invalid": true as const } : {}),
              ...(describedBy !== ""
                ? { "aria-describedby": describedBy }
                : {}),
              ...(isOptional ? {} : { "aria-required": true as const }),
            })}
            {hint !== undefined ? (
              <p
                id={hintId}
                className="mt-2 text-sm break-words text-muted-foreground"
              >
                {hint}
              </p>
            ) : null}
            {/* Margins live on the inner row so the empty live region adds no gap. */}
            <div id={errorId} aria-live="polite">
              {hasError ? (
                <p className="mt-2 flex items-start gap-2 text-sm break-words text-destructive">
                  <span className="flex h-5 shrink-0 items-center">
                    <CircleAlert className="size-4" aria-hidden />
                  </span>
                  <span>{errorMessage}</span>
                </p>
              ) : null}
            </div>
          </div>
        );
      }}
    />
  );
}
