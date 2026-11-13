import { describe, expect, it, vi } from "vitest";

import { gateDesignPage } from "@/app/design/_lib/gate";

describe("gateDesignPage", () => {
  it("FND-FR-17: lets the page render when the flag is on", () => {
    const deny = vi.fn<() => never>();

    gateDesignPage(true, deny);

    expect(deny).not.toHaveBeenCalled();
  });

  it("FND-FR-17: denies the page when the flag is off", () => {
    const deny = vi.fn<() => never>(() => {
      throw new Error("denied");
    });

    expect(() => gateDesignPage(false, deny)).toThrow("denied");
    expect(deny).toHaveBeenCalledOnce();
  });

  it("FND-FR-17: by default a disabled page throws the Next.js not-found signal", () => {
    expect(() => gateDesignPage(false)).toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
  });
});
