import { z } from "zod";

/**
 * Public (browser-safe) environment, ADR 0004.
 *
 * Only values that are safe to expose may use the `NEXT_PUBLIC_` prefix. Never
 * add a service-role key, database URL or password here. Server-only variables
 * live in `env.server.ts`, which cannot be bundled for the browser.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Formats a Zod error so every message names the offending variable.
 * Values are never included, to keep secrets out of logs.
 */
export function formatEnvError(error: z.ZodError): string {
  const lines = error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );
  return `Invalid environment variables:\n${lines.join("\n")}\nSee .env.example.`;
}

function parsePublicEnv(): PublicEnv {
  // Next.js inlines NEXT_PUBLIC_ values only for literal `process.env.NAME`
  // reads, so each variable is referenced explicitly (no spreading process.env).
  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}

/** Validated public environment. Safe to import from client code. */
export const publicEnv: PublicEnv = parsePublicEnv();
