# Step 3 architect check (PH-T-39)

Scope: CSP and security headers (PH-FR-15, 16, PH-NFR-06). Reviewed `src/lib/csp.ts`, `src/proxy.ts`, `src/lib/zod-jitless.ts`, `src/app/layout.tsx`, `next.config.ts`, `live-form.tsx`, the E2E specs, ADR 0014, spec D10/C3. Static review only (no commands run).

Verdict: no unresolved must-fix. No code defect found. Code matches ADR 0014 (nonce CSP from the proxy, `connection()` in the root layout, scoped `/design/frames/` exception, static headers, HSTS production only, no CORS, body limit under `experimental`).

## Must-fix

None.

## Settled points (ADR 0014 amended where noted)

1. **`strict-dynamic` wording.** Correct as stated in the task: scripts inserted at run time by already-trusted code are trusted; the policy blocks parser-inserted scripts and inline scripts/handlers without the nonce. The `'self'` allow-list is ignored by CSP3 browsers under `strict-dynamic`. PH-AC-32 (as clarified in the spec change log) tests exactly the blocked cases. Now recorded in ADR 0014 ("Accepted limits"), with the consequence that no code may build script elements from user input.
2. **`/design/frames` exact-path edge.** `:path*` in the `SAMEORIGIN` source also matches `/design/frames`, while the proxy only treats `/design/frames/...` as framable, so that one path (404, no page) sends `X-Frame-Options: SAMEORIGIN` with `frame-ancestors 'none'`. Fails closed (CSP wins), dev/CI only. Decision: note, recorded in ADR. Optional alignment is fix-task proposal F-1 below.
3. **413 only in raw console output.** Acceptable. The hard assertions (non-2xx, action returns nothing, no payload/stack in response or structured log) do not use the raw line; only `statusCode: 413` does. Constraint "exactly one oversized post in the suite" is a test-suite rule already stated in the spec header; recorded in ADR. The `lines[at - 1]` heuristic is fragile to Next log format changes, but it fails loudly, which is the right direction.
4. **CSP gap review.** No gap needing a follow-up now. Accepted limits (all recorded in ADR 0014): `style-src 'unsafe-inline'` (CSS injection only, no script); `img-src data: blob:`; no `wss:` in `connect-src` (add only with Realtime); `frame-src`/`worker-src`/`manifest-src` falling back to `default-src 'self'` (intended); `/api/*` without CSP (JSON only; a route returning HTML/SVG would need its own); Permissions-Policy limited to three features; HSTS without preload, with `includeSubDomains` (confirm sibling subdomains serve HTTPS before the first production deploy); `form-action 'self'` (blocks native cross-origin form redirects; epic 003 OAuth must use Server Action/route redirect). Origin-less Server Action POST is accepted by Next: browsers always send `Origin` cross-site, no ambient cookie for non-browsers; epic 003 must keep the session cookie `SameSite=Lax` or stricter. Follow-ups are conditions on epic 003, not epic 002 tasks (see "Notes for epic 003").
5. **Proxy seams for epic 003.** Now recorded in ADR 0014 ("Proxy seams"): (a) session refresh must be composed with the CSP, because Supabase SSR's `setAll` recreates the response, and every recreated `NextResponse.next({ request })` must re-carry the CSP request headers and response header; (b) the matcher excludes `/api`, so a refresh for `/api` needs a split matcher rather than dropping the exclusion; (c) request id is not generated (only incoming `x-request-id`/`x-vercel-id` are read); the proxy can add one on Node; (d) rate limiting location unchanged. The Node runtime and request-header read were proven by the spike.
6. **Jitless convention.** The convention was already in the ADR Decision; now expanded in a Consequences bullet: first import in every client file that creates a Zod schema; any earlier import that builds a schema (notably `@/lib/env`) defeats it. Alternative recorded and not adopted: import once from `src/instrumentation-client.ts` (exists in Next 16, runs before hydration). Violation is caught by the PH-AC-78 fixture, so a miss is not silent.

## What T-56 must say in `docs/architecture.md`

- C14 currently says only "Nonce CSP from `src/proxy.ts`, all pages dynamic; other headers static; no CORS (ADR 0014)". Extend it (or add a convention row) with:
  - "Client files that create Zod schemas import `@/lib/zod-jitless` first (side-effect import), before any import that builds a schema, including `@/lib/env`. Enforced by the E2E CSP-violation fixture (PH-AC-78), not by lint (ADR 0014)."
  - "`/design/frames/*` is the only framable path; `/api/*` carries no CSP; a route that returns HTML needs its own CSP."
  - "Session refresh (epic 003) lives in `src/proxy.ts` and must preserve the CSP request and response headers (ADR 0014, Proxy seams)."
- Guardrail table row for ADR 0014: add "client form imports `zod-jitless` first (fixture catches a miss)".
- Folder tree already lists `proxy.ts`; add `src/lib/csp.ts` and `src/lib/zod-jitless.ts` if the tree shows `src/lib` files.

## Notes for epic 003 (no action now)

- Native cross-origin form posts and redirects are blocked by `form-action 'self'`.
- Add the Supabase Storage origin to `img-src`, and `wss:` to `connect-src`, only when those features arrive.
- Keep session cookies `SameSite=Lax` (Origin-less POST acceptance relies on it).
- If a client file imports `@/lib/env` (browser Supabase client), import `zod-jitless` first there too.

## Fix-task proposals

None required. Optional, low priority, only if the Product Owner wants exact alignment:

- **F-1 (optional) align `/design/frames` exact path.** In `next.config.ts`, change the two `X-Frame-Options` sources to `"/((?!design/frames/).*)"` (DENY) and `"/design/frames/:path+"` (SAMEORIGIN), so `/design/frames` (no trailing segment) gets `DENY` like the proxy's `frame-ancestors 'none'`. Add the exact path `/design/frames` to the headers check in `src/next-config.test.ts` expecting `DENY`. Not needed for safety (fails closed on a 404).
