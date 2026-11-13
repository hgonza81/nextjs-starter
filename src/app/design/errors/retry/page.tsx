import { readToken } from "@/app/design/errors/_lib";

// Per-token request counts, kept in module memory on purpose: the fixture needs
// state that survives between a failed request and the retry that follows it.
const requestCountByToken = new Map<string, number>();

/**
 * Fault fixture (PH-FR-23): fails on the first request for a token and renders
 * on every later one, so a test can click "Try again" and see recovery.
 */
export default async function RetryTogglePage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ token?: string | string[] }> }>) {
  const token = readToken((await searchParams).token);
  const previousCount = requestCountByToken.get(token) ?? 0;
  requestCountByToken.set(token, previousCount + 1);

  if (previousCount === 0) {
    throw new Error(`Injected retry fault (token: ${token})`);
  }
  return <p>Recovered after retry (token: {token})</p>;
}
