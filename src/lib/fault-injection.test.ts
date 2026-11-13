import { beforeEach, describe, expect, it, vi } from "vitest";

// PH-AC-76 (unit half): the fault seam and the /design/errors gate can never
// be active when DESIGN_PAGE_ENABLED is off.

vi.mock("server-only", () => ({}));

const env = vi.hoisted(() => ({ DESIGN_PAGE_ENABLED: false }));
vi.mock("@/lib/env.server", () => ({ serverEnv: env }));

const headerGet = vi.hoisted(() => vi.fn<(name: string) => string | null>());
const headersMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: headersMock }));

import DesignErrorsLayout from "@/app/design/errors/layout";
import {
  assertFaultInjection,
  shouldInjectRootLayoutFault,
} from "@/lib/fault-injection";

beforeEach(() => {
  env.DESIGN_PAGE_ENABLED = false;
  headerGet.mockReset();
  headersMock.mockReset();
  headersMock.mockResolvedValue({ get: headerGet });
});

describe("shouldInjectRootLayoutFault", () => {
  it.each([
    { enabled: true, header: "root-layout", expected: true },
    { enabled: true, header: null, expected: false },
    { enabled: true, header: "other", expected: false },
    { enabled: true, header: "ROOT-LAYOUT", expected: false },
    { enabled: false, header: "root-layout", expected: false },
    { enabled: false, header: null, expected: false },
  ])(
    "PH-AC-76: flag $enabled with header $header gives $expected",
    ({ enabled, header, expected }) => {
      expect(shouldInjectRootLayoutFault(enabled, header)).toBe(expected);
    },
  );
});

describe("assertFaultInjection", () => {
  it("PH-AC-76: is a no-op with the flag off, even with the fault header, and never reads headers", async () => {
    headerGet.mockReturnValue("root-layout");

    await expect(assertFaultInjection()).resolves.toBeUndefined();
    expect(headersMock).not.toHaveBeenCalled();
  });

  it("PH-AC-76: is a no-op with the flag on and no fault header", async () => {
    env.DESIGN_PAGE_ENABLED = true;
    headerGet.mockReturnValue(null);

    await expect(assertFaultInjection()).resolves.toBeUndefined();
    expect(headerGet).toHaveBeenCalledWith("x-fault");
  });

  it("PH-AC-76: is a no-op with the flag on and a different fault value", async () => {
    env.DESIGN_PAGE_ENABLED = true;
    headerGet.mockReturnValue("something-else");

    await expect(assertFaultInjection()).resolves.toBeUndefined();
  });

  it("PH-AC-76: throws only with the flag on and x-fault: root-layout", async () => {
    env.DESIGN_PAGE_ENABLED = true;
    headerGet.mockReturnValue("root-layout");

    await expect(assertFaultInjection()).rejects.toThrow(
      /Injected root layout/,
    );
  });
});

describe("/design/errors layout gate", () => {
  it("PH-AC-76: answers 404 (Next.js not-found signal) when the flag is off", () => {
    env.DESIGN_PAGE_ENABLED = false;

    expect(() => DesignErrorsLayout({ children: null })).toThrow(
      /NEXT_HTTP_ERROR_FALLBACK;404/,
    );
  });

  it("PH-AC-76: renders its children when the flag is on", () => {
    env.DESIGN_PAGE_ENABLED = true;

    expect(DesignErrorsLayout({ children: "child" })).toBe("child");
  });
});
