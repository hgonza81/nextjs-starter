# 0014. Security headers and CSP

Status: Accepted
Date: 2026-11-13
Epic: 002-platform-hardening

## Context
The app has no security headers. Epic 003 adds browser calls to Supabase Auth and user-supplied content paths, so a Content Security Policy must be in place before then. A nonce-based CSP in Next.js has structural consequences (a proxy file, dynamic rendering), so the choice is hard to reverse once pages depend on it.

## Options considered
1. **Nonce CSP via `src/proxy.ts`** (`script-src 'self' 'nonce-<n>' 'strict-dynamic'`): strongest XSS protection; forces dynamic rendering for every page and is incompatible with PPR.
2. **Static CSP in `next.config.ts`** with `'unsafe-inline'` scripts: keeps static rendering; weak XSS protection (docs "Without Nonces").
3. **Experimental SRI hashes:** experimental, may change. Rejected.
4. No CSP: rejected.

## Decision
Option 1.
- **Mechanism:** `src/proxy.ts` (Next 16 name for middleware; Node runtime by default, the `runtime` option is not allowed there) generates a nonce per request and sets the CSP on request and response, with the matcher from the docs (skips `_next/static`, images, prefetches). The policy string is built by a pure, unit-tested function in `src/lib`; the Supabase origin comes from `publicEnv`. The root layout calls `await connection()` so every page is dynamic. Epic 003 adds Supabase session refresh to the same file; rate limiting would also go here.
- **Policy:** `default-src 'self'`; `script-src 'self' 'nonce-<n>' 'strict-dynamic'` (plus `'unsafe-eval'` in development only); `style-src 'self' 'unsafe-inline'` (Radix renders inline `style` attributes that nonces do not cover and Sonner injects a `<style>` at runtime; nonce-only styles are fragile for little gain; XSS protection lives in `script-src`); `img-src 'self' blob: data:`; `font-src 'self'`; `connect-src 'self' <Supabase origin>` (plus `ws:` in development for HMR); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `frame-ancestors 'none'`. No `upgrade-insecure-requests`: E2E and `next start` run over plain http on localhost, and HSTS already covers production.
- **Static headers in `next.config.ts` `headers()`:** `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(), microphone=(), geolocation=()`; `X-Frame-Options: DENY` (legacy, alongside `frame-ancestors`); `Strict-Transport-Security: max-age=63072000; includeSubDomains` in production only, no `preload`.
- **Hardening:** `poweredByHeader: false`; no CORS headers are ever set (a test asserts it); `serverActions.bodySizeLimit: '1mb'` stated explicitly (the default, so the limit is documented); `allowedOrigins` unset (Next compares `Origin` with `Host`). The body limit covers Server Actions only; route handlers that read bodies enforce their own cap.
- **Fallback (recorded):** if E2E shows the nonce approach is unworkable (error pages, `global-error`), use option 2, a static CSP in `next.config.ts`, and note the relaxation here.

## Consequences
- Positive: strict script policy, no inline-script XSS; Supabase Auth from the browser works because `connect-src` names its origin.
- Negative: no static rendering anywhere (accepted: the app is authenticated and mostly dynamic from epic 003); `style-src 'unsafe-inline'` remains; headers and CSP must be tested on `next build && next start`, not in dev.
- The "renders statically" line in PH-FL-03 is dropped (D15).
- **`global-error`:** if it does not receive the nonce, it stays script-free (plain `<a href="/">`) or uses a hash; the outcome is recorded here (PH-AC-61).
- **Spikes:** whether `global-error` (its own document) receives the nonce; the proxy running on Node; static 404 and error pages proven under the CSP by E2E.
- Revisit: drop `'unsafe-inline'` styles if the UI stack stops needing it; add `report-to` when observability needs it.

## References
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` (nonces require dynamic rendering; Proxy sets the header)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (Node runtime default)
- `.../05-config/01-next-config-js/serverActions.md`, `poweredByHeader.md`
- Epic 002 `questions.md` (D10, D15).
