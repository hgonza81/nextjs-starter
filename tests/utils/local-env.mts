/**
 * Environment for the DB test project. The defaults are the local Supabase
 * values from `.env.example` (LOCAL ONLY, not secrets), so `pnpm test:db` needs
 * no `.env.local`. Real environment variables win, which lets CI override them.
 *
 * Safety: `assertLocalDatabase` refuses any host other than loopback, so the
 * suite can never run against a shared or cloud database by accident.
 */
const LOCAL_DEFAULTS = {
  DATABASE_URL:
    "postgresql://app_backend:app_backend_local_password@127.0.0.1:54322/postgres",
  DATABASE_MIGRATION_URL:
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-test-anon-key",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
} as const;

export type LocalTestEnv = Record<keyof typeof LOCAL_DEFAULTS, string>;

export function resolveLocalTestEnv(
  source: NodeJS.ProcessEnv = process.env,
): LocalTestEnv {
  const resolved = { ...LOCAL_DEFAULTS } as LocalTestEnv;
  for (const name of Object.keys(LOCAL_DEFAULTS) as (keyof LocalTestEnv)[]) {
    const value = source[name];
    if (value !== undefined && value !== "") resolved[name] = value;
  }
  return resolved;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function assertLocalDatabase(label: string, url: string): void {
  const host = new URL(url).hostname;
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `${label} points at "${host}", which is not the local machine. ` +
        "The DB tests create and drop tables and must only run against the " +
        "local Supabase stack (pnpm db:start).",
    );
  }
}
