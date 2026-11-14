import type { NextConfig } from "next";

// FND-FR-03: loading the public env module here makes `next build` fail when a
// NEXT_PUBLIC_* variable is missing or invalid, because those values are
// inlined at build time. Relative path: the config is loaded outside the `@/`
// alias. Only the public module is safe here; `env.server.ts` imports
// `server-only`, which throws outside the Next.js server, so the server env is
// validated at start by `src/instrumentation.ts`.
import "./src/lib/env";

/** Static headers sent on every response, including `/api/*` (PH-FR-16, ADR 0014). */
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // HSTS only in production builds: over plain http on localhost it would be
  // meaningless, and a development build must never pin a browser to https.
  // No `preload`: preloading is a hard-to-undo opt-in (PH-FR-16).
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Do not advertise the framework (PH-FR-16).
  poweredByHeader: false,

  experimental: {
    // PH-FR-16, ADR 0014 (spike finding A and D): Server Action bodies over
    // 1 MB are rejected and the action does not run. Next answers 500 and logs
    // `statusCode: 413`. In this Next version the key lives under `experimental`.
    serverActions: { bodySizeLimit: "1mb" },
  },

  // No CORS headers are set anywhere: the app is same-origin only (PH-FR-16).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders,
      },
      // ADR 0014 (spike finding B): `/design` embeds its own pages from
      // `/design/frames/*` in same-origin iframes, so that path gets SAMEORIGIN
      // (and `frame-ancestors 'self'` from the proxy). The two sources below
      // must never overlap, otherwise both X-Frame-Options values are sent.
      {
        source: "/((?!design/frames(?:/|$)).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        source: "/design/frames/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
