import { headers } from "next/headers";

import { serverEnv } from "@/lib/env.server";

export const FAULT_HEADER = "x-fault";
export const ROOT_LAYOUT_FAULT = "root-layout";

/**
 * Pure decision for the root-layout fault (PH-FR-23): true only when the
 * showcase flag is on AND the request carries `x-fault: root-layout`.
 * Exported so the gate is unit-testable without Next.js or the env module.
 */
export function shouldInjectRootLayoutFault(
  isEnabled: boolean,
  faultHeader: string | null,
): boolean {
  return isEnabled && faultHeader === ROOT_LAYOUT_FAULT;
}

/**
 * Test-only seam called by the root layout (PH-FR-23, spec decision C4).
 * Lets the E2E suite make the root layout itself throw, which is the only way
 * to reach `global-error`. It ships in the production build but is inert unless
 * `DESIGN_PAGE_ENABLED` is on.
 *
 * When the flag is off it returns before reading request headers, so it does
 * not opt the whole app into dynamic rendering on its own account.
 *
 * @throws Error when the flag is on and the request has the fault header.
 */
export async function assertFaultInjection(): Promise<void> {
  if (!serverEnv.DESIGN_PAGE_ENABLED) {
    return;
  }
  const requestHeaders = await headers();
  if (
    shouldInjectRootLayoutFault(
      serverEnv.DESIGN_PAGE_ENABLED,
      requestHeaders.get(FAULT_HEADER),
    )
  ) {
    throw new Error("Injected root layout fault (PH-FR-23)");
  }
}
