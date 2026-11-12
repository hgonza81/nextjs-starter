import type { NextConfig } from "next";

// FND-FR-03: loading the public env module here makes `next build` fail when a
// NEXT_PUBLIC_* variable is missing or invalid, because those values are
// inlined at build time. Relative path: the config is loaded outside the `@/`
// alias. Only the public module is safe here; `env.server.ts` imports
// `server-only`, which throws outside the Next.js server, so the server env is
// validated at start by `src/instrumentation.ts`.
import "./src/lib/env";

const nextConfig: NextConfig = {};

export default nextConfig;
