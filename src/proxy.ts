import { type NextRequest, NextResponse } from "next/server";
import { buildCsp } from "@/lib/csp";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Per-request nonce CSP (PH-FR-15, ADR 0014).
 *
 * The CSP goes on the request headers too: Next reads the nonce from there
 * and stamps it on its own scripts during server rendering. The proxy is UX
 * and hardening, not an auth boundary. Epic 003 adds session refresh here.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    pathname: request.nextUrl.pathname,
    supabaseUrl: publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    isDevelopment: serverEnv.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Excludes `api`: JSON routes carry no CSP (documented limit, ADR 0014).
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
