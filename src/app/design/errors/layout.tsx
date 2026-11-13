import type { ReactNode } from "react";

import { gateDesignPage } from "@/app/design/_lib/gate";
import { serverEnv } from "@/lib/env.server";

/**
 * Gate for every fault fixture under `/design/errors/*` (PH-FR-23). The parent
 * `/design` layout already denies when the flag is off; this repeats the check
 * on purpose so the fixtures stay hidden even if the parent gate is moved. The
 * fixtures never touch the database.
 */
export default function DesignErrorsLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  gateDesignPage(serverEnv.DESIGN_PAGE_ENABLED);
  return children;
}
