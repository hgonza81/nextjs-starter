"use server";

import { notFound, redirect } from "next/navigation";

import { areFaultFixturesDisabled } from "@/app/design/errors/_lib";

// Server Actions are public POST endpoints, so each one gates itself instead of
// relying on the `/design/errors` layout (PH-FR-23).
function assertFixturesEnabled(): void {
  if (areFaultFixturesDisabled()) {
    notFound();
  }
}

/** Fault fixture: an UNWRAPPED action that throws (the wrapped one is PH-T-12). */
export async function throwingAction(formData: FormData): Promise<void> {
  assertFixturesEnabled();
  const token = formData.get("token");
  throw new Error(
    `Injected action fault (token: ${typeof token === "string" ? token : "none"})`,
  );
}

/**
 * Fault fixture for PH-AC-30 and 67: accepts a large field and does nothing
 * with it. The framework's body size limit (1 MB) rejects oversized posts with
 * 413 before this function runs; a foreign `Origin` is rejected the same way.
 */
export async function oversizedBodyAction(formData: FormData): Promise<void> {
  assertFixturesEnabled();
  formData.get("payload");
}

/** Fault fixture: an action that redirects (expected, not an error). */
export async function redirectAction(): Promise<void> {
  assertFixturesEnabled();
  redirect("/design/errors/form");
}
