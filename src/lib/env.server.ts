import "server-only";

import { z } from "zod";

import { formatEnvError } from "@/lib/env";

// An empty value (e.g. a blank variable on Vercel) counts as "not set".
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
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
 * SUPABASE_SERVICE_ROLE_KEY is deliberately not defined: nothing consumes it.
 */
const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    DATABASE_URL: optionalUrl,
    DATABASE_MIGRATION_URL: optionalUrl,
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
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_MIGRATION_URL: process.env.DATABASE_MIGRATION_URL,
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
