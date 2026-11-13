"use client";

import { useForm } from "react-hook-form";

import { FormField } from "@/components/form/form-field";
import { PasswordInput } from "@/components/form/password-input";
import { Input } from "@/components/ui/input";

type FieldSampleProps = {
  label: string;
  hint?: string;
  /** Renders the invalid state with this message (set from outside, as a server error would be). */
  error?: string;
  isOptional?: boolean;
  isDisabled?: boolean;
  defaultValue?: string;
  placeholder?: string;
  kind?: "text" | "password";
};

type SampleValues = { value: string };

/**
 * A static FormField state for `/design`. FormField needs a React Hook Form
 * `control`, so each sample owns a tiny form; `errors` puts it into the
 * invalid state without any user interaction.
 */
export function FieldSample({
  label,
  hint,
  error,
  isOptional,
  isDisabled = false,
  defaultValue = "",
  placeholder,
  kind = "text",
}: FieldSampleProps) {
  const { control } = useForm<SampleValues>({
    defaultValues: { value: defaultValue },
    // Static samples must not steal focus or scroll the page on load.
    shouldFocusError: false,
    errors:
      error === undefined
        ? undefined
        : { value: { type: "manual", message: error } },
  });

  return (
    <FormField
      control={control}
      name="value"
      label={label}
      hint={hint}
      isOptional={isOptional}
    >
      {(field) =>
        kind === "password" ? (
          <PasswordInput
            {...field}
            autoComplete="new-password"
            disabled={isDisabled}
          />
        ) : (
          <Input {...field} placeholder={placeholder} disabled={isDisabled} />
        )
      }
    </FormField>
  );
}
