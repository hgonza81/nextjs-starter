"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { areFaultFixturesDisabled } from "@/app/design/errors/_lib";
import { defineAction } from "@/lib/action";
import { conflictError } from "@/lib/errors";

// Server Actions are public POST endpoints, so each one gates itself instead of
// relying on the `/design/errors` layout (PH-FR-23).
function assertFixturesEnabled(): void {
  if (areFaultFixturesDisabled()) {
    notFound();
  }
}

/** Fault fixture: an UNWRAPPED action that throws (the wrapped one is `wrappedFaultAction`). */
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

const wrappedFaultSchema = z.object({
  token: z.string().min(1),
  mode: z.enum(["unexpected", "conflict", "redirect", "not-found"]),
});

const wrappedFault = defineAction({
  name: "design.errors.wrapped_fault",
  schema: wrappedFaultSchema,
  handler: async ({ token, mode }) => {
    switch (mode) {
      case "unexpected":
        throw new Error(`Injected wrapped action fault (token: ${token})`);
      case "conflict":
        throw conflictError("Injected conflict.");
      case "redirect":
        redirect("/design/errors/form");
      case "not-found":
        notFound();
      default: {
        const unreachable: never = mode;
        return unreachable;
      }
    }
  },
});

/**
 * Fault fixture for the wrapper (PH-FR-08, PH-AC-47, 59, 64): runs a
 * `defineAction` handler in the chosen `mode`. The gate runs before the
 * wrapper so a disabled fixture never parses input. The result is discarded
 * because a form action cannot return data; tests read the server log.
 */
export async function wrappedFaultAction(formData: FormData): Promise<void> {
  assertFixturesEnabled();
  await wrappedFault({
    token: formData.get("token"),
    mode: formData.get("mode"),
  });
}
