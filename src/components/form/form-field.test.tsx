// @vitest-environment jsdom
import { zodResolver } from "@hookform/resolvers/zod";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { FormField } from "@/components/form/form-field";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
});
type Values = z.infer<typeof schema>;

function TestForm({
  hint,
  isOptional,
}: {
  hint?: string;
  isOptional?: boolean;
}) {
  const { control } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  return (
    <form noValidate>
      <FormField
        control={control}
        name="email"
        label="Email"
        hint={hint}
        isOptional={isOptional}
      >
        {(field) => <Input {...field} />}
      </FormField>
    </form>
  );
}

afterEach(cleanup);

describe("FormField", () => {
  it("FND-FR-16: associates the label with the control", () => {
    render(<TestForm />);

    expect(screen.getByLabelText("Email")).toBeTruthy();
  });

  it("FND-FR-16: has no aria-invalid and no description before any error or hint", () => {
    render(<TestForm />);
    const input = screen.getByLabelText("Email");

    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });

  it("FND-FR-16: does not validate before the first blur", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    const input = screen.getByLabelText("Email");

    await user.type(input, "not-an-email");

    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("FND-FR-16: exposes the error through aria-invalid and aria-describedby after blur", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    const input = screen.getByLabelText("Email");

    await user.type(input, "not-an-email");
    await user.tab();

    expect(input.getAttribute("aria-invalid")).toBe("true");
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).not.toBeNull();
    const errorRegion = document.getElementById(errorId ?? "");
    expect(errorRegion?.textContent).toBe("Enter a valid email address.");
    expect(errorRegion?.getAttribute("aria-live")).toBe("polite");
  });

  it("FND-FR-16: lists the hint before the error in aria-describedby", async () => {
    const user = userEvent.setup();
    render(<TestForm hint="Use your work email." />);
    const input = screen.getByLabelText("Email");

    expect(input.getAttribute("aria-describedby")).toMatch(/-hint$/);

    await user.type(input, "x");
    await user.tab();

    const [hintId, errorId] = (
      input.getAttribute("aria-describedby") ?? ""
    ).split(" ");
    expect(document.getElementById(hintId ?? "")?.textContent).toBe(
      "Use your work email.",
    );
    expect(errorId).toMatch(/-error$/);
  });

  it("FND-FR-16: clears the error once the value becomes valid", async () => {
    const user = userEvent.setup();
    render(<TestForm />);
    const input = screen.getByLabelText("Email");

    await user.type(input, "x");
    await user.tab();
    await user.type(input, "@example.com");

    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("FND-FR-16: marks required fields with aria-required and optional ones with a suffix", () => {
    const { unmount } = render(<TestForm />);
    expect(screen.getByLabelText("Email").getAttribute("aria-required")).toBe(
      "true",
    );
    unmount();

    render(<TestForm isOptional />);
    const input = screen.getByLabelText(/Email/);
    expect(input.hasAttribute("aria-required")).toBe(false);
    expect(screen.getByText("(optional)")).toBeTruthy();
  });
});
