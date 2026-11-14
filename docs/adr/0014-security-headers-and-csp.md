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

## Spike outcome (PH-T-33, 2026-11-13)

Throwaway code (a `src/proxy.ts`, `await connection()` in the root layout, `poweredByHeader: false` and `experimental.serverActions.bodySizeLimit: '1mb'` in `next.config.ts`), reverted after the run. Next 16.4.6, Node 26.13.1, `pnpm build` then `next start --port 3300` (started and stopped by PID), driven with Playwright (Chromium) scripts and `curl`. Policy as in the Decision above. Every route builds as dynamic (`ƒ`).

**Confirmed (the Decision stands):**

1. **Nonce reaches every script.** In the HTML of `/`, every `<script>` (Next runtime chunks, `turbopack` runtime, the `noModule` polyfill, the inline bootstrap and RSC payload scripts) carries the request's nonce. Two requests to `/design` carried different nonces (PH-AC-66). In Chromium there were no `securitypolicyviolation` events on `/`, `/design`, a Link navigation (app-shell frame nav), the 404 page then its "Go to home page" Link, the 500 page and its "Try again" (router refresh), or a Sonner toast. Sanity: an inline `onclick` and a `fetch` to a foreign origin are blocked, so the policy is really enforced. Commands: `curl -si http://localhost:3300/ | grep -o '<script[^>]*>'`; Playwright script listening to `securitypolicyviolation`.
2. **`global-error` receives the nonce.** With `x-fault: root-layout` the root layout throws; the response is HTTP 500, its CSP header and its 11 `<script>` tags carry the nonce (it is server-rendered by Next from the request's CSP header), the page shows its title, styles apply and there are no violations. **Decision: no script-free or hash fallback is needed.** The `global-error` page keeps its current form (plain `<a href="/">` stays for the reason in its own comment). **The static-CSP fallback (option 2) is not needed.**
3. **The proxy runs on Node.** A response header set from the proxy reported `node v26.13.1`; it read the incoming `x-request-id` header (`curl -H 'x-request-id: abc123'` came back as `abc123`) and set response headers. Epic 003 can add session refresh to the same file.
4. **Foreign-origin Server Action is rejected.** Replaying a captured Server Action POST with `Origin: https://evil.example` (and `Origin: null`) returns 500 and the action does not run (server log: "does not match `origin` header ... Aborting the action", for fetch and for no-JS form posts). The same body with the real origin returns 200. A POST with no `Origin` header at all is accepted (documented Next behavior; browsers always send `Origin` on a cross-site POST). PH-AC-67 holds, but the status is 500, not a 4xx.
5. **UI stack under `style-src 'self' 'unsafe-inline'` and `connect-src 'self' <Supabase origin>`:** Radix inline styles, the Sonner toast and Tailwind work; a `fetch` to the Supabase origin is not blocked (only foreign origins are).
6. **Existing E2E under the throwaway CSP:** all 166 tests ran with the CSP-violation fixture active; 156 passed and 10 failed, all 10 for one reason (finding B below). After scoping `frame-ancestors` (finding B), those 10 passed (67 of 67 in the three affected spec files).

**Findings that change the plan (assumptions disproved, to be decided by the Product Owner before PH-T-34/35):**

- **A. Oversized Server Action returns HTTP 500, not 413 (PH-AC-30, PH-FR-16).** `serverActions.bodySizeLimit: '1mb'` is enforced and the action never runs: a 1 MB minus 20 KB payload returned 200 and a 1 MB plus 10 KB payload was rejected. But Next reports the rejection as an internal error: the log shows `Error: Body exceeded 1mb limit.` with `statusCode: 413` in the error object while the HTTP response is **500** (fetch actions and no-JS form posts alike). The Next source has an open TODO for this (`next/dist/server/app-render/action-handler.js`: "consider checking if the error is an `ApiError` and change status code so that we can respond with a 413"). Evidence: `grep -n "413" node_modules/next/dist/server/app-render/action-handler.js`, plus the Playwright replay. Options: (1) relax PH-AC-30 to "rejected, the action does not run, response is not 2xx (500 today; Next logs 413)" and assert the log line, recommended: simplest, matches the framework; (2) enforce 413 in `src/proxy.ts` from `Content-Length` on Server Action POSTs: extra code, does not cover chunked bodies, so the framework limit stays the real guard.
- **B. `/design` embeds its own pages in same-origin iframes (`/design/frames/*`), which `frame-ancestors 'none'` and `X-Frame-Options: DENY` block** (Chromium: "Framing 'http://localhost:3100/' violates ... frame-ancestors 'none'", 112 console errors, 10 E2E tests fail because the 18 frames never load). Fix verified: the proxy sets `frame-ancestors 'self'` only for paths under `/design/frames/`, and `'none'` everywhere else. The static `X-Frame-Options` must be scoped the same way (`SAMEORIGIN` for `/design/frames/:path*`, `DENY` for the rest, with non-overlapping `source` patterns in `headers()`), otherwise the frames stay blocked in browsers that honor it. This is a literal deviation from PH-FR-15 (`frame-ancestors 'none'`) and PH-FR-16 (`X-Frame-Options: DENY`) for one non-production-facing path (the frames only exist when the `/design` flag is on). Options: (1) scoped exception for `/design/frames/*` as above, recommended; (2) `'self'` / `SAMEORIGIN` everywhere (weaker clickjacking protection on every page); (3) drop the iframes from `/design` (changes the Epic 001 showcase and tests).
- **C. Zod's JIT probe triggers a CSP violation report.** Zod 4 probes `new Function("")` (in a try/catch) when a schema is created in the browser; under a CSP without `'unsafe-eval'` Chromium reports it (`script-src eval`, a `securitypolicyviolation` plus a console error) even though the throw is swallowed and zod falls back to its non-JIT path. It happened on `/design` because `live-form.tsx` (a client component) builds a Zod schema. Zod skips the probe when `jitless` is set (`node_modules/zod/v4/core/util.js`). Verified: a small module that runs `z.config({ jitless: true })`, imported **before** any schema creation in the client bundle (first import of the client file), removes the violation. No policy change; PH-T-34 must include that module (or equivalent) and the first client form of epic 003 must import it first. Note for later: also the Zod schemas in `src/lib/env.ts` are imported by client code and run at module load, so the module must be loaded ahead of them in any client entry that builds schemas.
- **D. `serverActions` is an `experimental` key in this Next version.** `bodySizeLimit` and `allowedOrigins` must be set as `experimental.serverActions` (per the Next docs for this version); `next build` prints an "Experiments (use with caution): serverActions" notice. The setting works (finding A). Consequence: PH-T-35 and the PH-AC-73 config test must read `nextConfig.experimental.serverActions.bodySizeLimit`, and the Decision text above ("`serverActions.bodySizeLimit`") means that key.

**Other notes:**

- The proxy matcher from the Next guide excludes `api`, `_next/static`, `_next/image`, `favicon.ico` and prefetches, so JSON routes such as `/api/health` do not carry a CSP (not needed for non-HTML); the static headers in `next.config.ts` still apply to them.
- Without `await connection()` in the root layout nothing is dynamic when the fault flag is off (`assertFaultInjection()` returns before reading headers), so PH-T-34 must add `connection()` as the Decision says.
- `tests/e2e/telemetry-config-startup.spec.ts` does not use the CSP-violation fixture (it has no browser page); every other spec does.

## References
- `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md` (nonces require dynamic rendering; Proxy sets the header)
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` (Node runtime default)
- `.../05-config/01-next-config-js/serverActions.md`, `poweredByHeader.md`
- Epic 002 `questions.md` (D10, D15).
