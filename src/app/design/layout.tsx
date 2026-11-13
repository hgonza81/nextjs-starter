import type { Metadata } from "next";
import type { ReactNode } from "react";

import { gateDesignPage } from "@/app/design/_lib/gate";
import { serverEnv } from "@/lib/env.server";

// FND-FR-17: the flag is read per request, so a production build serves or
// hides the showcase according to the runtime environment instead of the
// build environment. Without this, Next.js would prerender these routes and
// bake the build-time flag value into static HTML.
export const dynamic = "force-dynamic";

// Never indexed (design system 12.1).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Gate for `/design` and every route below it (including `/design/frames/*`),
 * so a route added later is gated without remembering to do it. The flag does
 * not change during the life of the process, so the usual caveat about
 * layouts not re-rendering on navigation does not apply here.
 */
export default function DesignLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  gateDesignPage(serverEnv.DESIGN_PAGE_ENABLED);
  return children;
}
