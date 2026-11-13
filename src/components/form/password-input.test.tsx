// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { PasswordInput } from "@/components/form/password-input";

afterEach(cleanup);

describe("PasswordInput", () => {
  it("FND-FR-16: starts masked with a 'Show password' toggle", () => {
    render(
      <PasswordInput aria-label="Password" autoComplete="current-password" />,
    );

    expect(screen.getByLabelText("Password").getAttribute("type")).toBe(
      "password",
    );
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("FND-FR-16: the toggle reveals and re-masks the value and renames itself", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" autoComplete="new-password" />);
    const input = screen.getByLabelText("Password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input.getAttribute("type")).toBe("text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input.getAttribute("type")).toBe("password");
  });

  it("FND-FR-16: the toggle works from the keyboard and points to the input", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="Password" autoComplete="new-password" />);
    const input = screen.getByLabelText("Password");

    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.tab();
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(document.activeElement).toBe(toggle);
    expect(toggle.getAttribute("aria-controls")).toBe(input.id);

    await user.keyboard("{Enter}");
    expect(input.getAttribute("type")).toBe("text");
    await user.keyboard(" ");
    expect(input.getAttribute("type")).toBe("password");
    expect(document.activeElement).toBe(toggle);
  });

  it("FND-FR-16: the toggle never has type submit", () => {
    render(<PasswordInput aria-label="Password" autoComplete="new-password" />);

    expect(
      screen
        .getByRole("button", { name: "Show password" })
        .getAttribute("type"),
    ).toBe("button");
  });
});
