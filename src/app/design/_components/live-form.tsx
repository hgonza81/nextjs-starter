"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FormField } from "@/components/form/form-field";
import { PasswordInput } from "@/components/form/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const liveFormSchema = z.object({
  email: z.email("Enter a valid email address, for example name@company.com."),
  password: z.string().min(12, "Use at least 12 characters."),
});

type LiveFormValues = z.infer<typeof liveFormSchema>;

/**
 * The working React Hook Form example (design system 12.2): validation runs
 * on the first blur of a field (`onTouched`), then on every change, and a
 * failed submit moves focus to the first invalid control.
 */
export function LiveForm() {
  const { control, handleSubmit } = useForm<LiveFormValues>({
    resolver: zodResolver(liveFormSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={handleSubmit(() => {
        toast.success("The form is valid.");
      })}
    >
      <FormField
        control={control}
        name="email"
        label="Email"
        hint="Tab out of the empty field to see blur validation."
      >
        {(field) => (
          <Input
            {...field}
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </FormField>
      <FormField
        control={control}
        name="password"
        label="Password"
        hint="At least 12 characters."
      >
        {(field) => <PasswordInput {...field} autoComplete="new-password" />}
      </FormField>
      <Button type="submit">Check form</Button>
    </form>
  );
}
