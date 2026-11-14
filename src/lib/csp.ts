/**
 * Content Security Policy builder (PH-FR-15, ADR 0014).
 *
 * Pure on purpose: the nonce, path, Supabase origin and environment come in as
 * arguments, so the policy is unit-testable without Next.js or `process.env`.
 */

/** Same-origin pages the `/design` showcase embeds in iframes (dev/CI only). */
const FRAMABLE_PATH_PREFIX = "/design/frames/";

export type CspOptions = {
  /** Per-request nonce, unique and unguessable. */
  readonly nonce: string;
  /** Request pathname; decides `frame-ancestors`. */
  readonly pathname: string;
  /** `NEXT_PUBLIC_SUPABASE_URL`; only its origin goes into `connect-src`. */
  readonly supabaseUrl: string;
  /** Adds `'unsafe-eval'` (React dev tooling) and `ws:` (HMR). Never in production. */
  readonly isDevelopment: boolean;
};

/** True for paths allowed to be framed by this same origin. */
export function isFramablePath(pathname: string): boolean {
  return pathname.startsWith(FRAMABLE_PATH_PREFIX);
}

/**
 * Builds the `Content-Security-Policy` header value.
 *
 * `style-src` keeps `'unsafe-inline'` because Radix renders inline `style`
 * attributes and Sonner injects a `<style>` at runtime; XSS protection lives
 * in `script-src` (nonce + `strict-dynamic`). No `upgrade-insecure-requests`:
 * E2E and `next start` run over plain http, and HSTS covers production.
 */
export function buildCsp(options: CspOptions): string {
  const { nonce, pathname, supabaseUrl, isDevelopment } = options;
  const supabaseOrigin = new URL(supabaseUrl).origin;

  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (isDevelopment) scriptSrc.push("'unsafe-eval'");

  const connectSrc = ["'self'", supabaseOrigin];
  if (isDevelopment) connectSrc.push("ws:");

  const directives: readonly (readonly string[])[] = [
    ["default-src", "'self'"],
    ["script-src", ...scriptSrc],
    ["style-src", "'self'", "'unsafe-inline'"],
    ["img-src", "'self'", "blob:", "data:"],
    ["font-src", "'self'"],
    ["connect-src", ...connectSrc],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", isFramablePath(pathname) ? "'self'" : "'none'"],
  ];

  return directives.map((parts) => parts.join(" ")).join("; ");
}
