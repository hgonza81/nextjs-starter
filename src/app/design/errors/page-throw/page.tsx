import { readToken } from "@/app/design/errors/_lib";

/**
 * Fault fixture (PH-FR-23): a page whose render throws. The message carries the
 * per-test token from `?token=` so the test can match the logged error. Gated
 * by the `/design/errors` layout.
 */
export default async function ThrowingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ token?: string | string[] }>;
}>): Promise<never> {
  const { token } = await searchParams;
  throw new Error(`Injected page fault (token: ${readToken(token)})`);
}
