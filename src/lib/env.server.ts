import "server-only";

import { z } from "zod";

import { formatEnvError } from "@/lib/env";

// An empty value (e.g. a blank variable on Vercel) counts as "not set".
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

// Boolean-like switch. Blank counts as "not set" (same reason as above).
// Anything outside this list fails at startup instead of being read as "off".
const optionalSwitch = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(["true", "false", "1", "0"]).optional(),
);

/**
 * Server-only environment, ADR 0004. `server-only` makes any client import a
 * build error, so these values cannot reach the browser bundle.
 *
 * Database variables are required in development and test, and optional in
 * production until a cloud database exists (no cloud DB in epic 001). When the
 * cloud DB arrives, tighten this and update `.env.example` and the README.
 * Code that needs the database must call `requireDatabaseUrl` so a missing
 * value fails at use time with a clear message.
 *
 * DESIGN_PAGE_ENABLED (FND-FR-17) switches the `/design` showcase. It is read
 * at request time by a dynamic route, so one build can serve either setting.
 * When unset it is on only in `next dev` (NODE_ENV=development) and off
 * everywhere else, including every Vercel deployment, so production returns
 * 404 without any configuration. It is deliberately not `NEXT_PUBLIC_`: that
 * would inline the value into the bundle at build time.
 *
 * SUPABASE_SERVICE_ROLE_KEY is deliberately not defined: nothing consumes it.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: optionalUrl,
    DATABASE_MIGRATION_URL: optionalUrl,
    DESIGN_PAGE_ENABLED: optionalSwitch,
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV === "production") return;
    for (const name of ["DATABASE_URL", "DATABASE_MIGRATION_URL"] as const) {
      if (env[name] === undefined) {
        context.addIssue({
          code: "custom",
          path: [name],
          message: `Required when NODE_ENV is ${env.NODE_ENV}`,
        });
      }
    }
  })
  .transform((env) => ({
    ...env,
    DESIGN_PAGE_ENABLED:
      env.DESIGN_PAGE_ENABLED === undefined
        ? env.NODE_ENV === "development"
        : env.DESIGN_PAGE_ENABLED === "true" || env.DESIGN_PAGE_ENABLED === "1",
  }));

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
    DESIGN_PAGE_ENABLED: process.env.DESIGN_PAGE_ENABLED,
  });
  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }
  return result.data;
}

/** Validated server-only environment. Import from server code only. */
export const serverEnv: ServerEnv = parseServerEnv();

/**
 * Returns `DATABASE_URL` or throws naming the variable. For the database
 * module: in production the variable is optional at startup but mandatory the
 * moment a query needs it.
 */
export function requireDatabaseUrl(): string {
  if (serverEnv.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is required to access the database.");
  }
  return serverEnv.DATABASE_URL;
}
