// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("Button", () => {
  it("FND-FR-16: calls onClick when idle", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await userEvent.setup().click(screen.getByRole("button", { name: "Save" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("FND-FR-16: loading keeps focus, sets aria-disabled and ignores clicks", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Creating account…
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Creating account…" });

    await user.tab();
    await user.click(button);
    await user.keyboard("{Enter}");

    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("FND-FR-16: loading blocks the form submission an Enter keypress would trigger", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: { preventDefault: () => void }) =>
      event.preventDefault(),
    );
    render(
      <form onSubmit={onSubmit}>
        <input aria-label="Name" />
        <Button type="submit" isLoading>
          Saving…
        </Button>
      </form>,
    );

    await user.type(screen.getByLabelText("Name"), "x{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("FND-FR-16: defaults to type button so it never submits a form by accident", () => {
    render(<Button>Cancel</Button>);

    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });
});
