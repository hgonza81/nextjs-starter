/**
 * Runs once when the Next.js server starts (`next dev`, `next start`). Loading
 * the env modules here makes a missing or invalid variable fail at startup
 * with a message naming it, instead of on the first request that uses it.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
    await import("@/lib/env.server");
  }
}
