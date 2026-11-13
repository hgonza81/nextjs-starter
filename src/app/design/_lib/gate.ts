import { notFound } from "next/navigation";

/**
 * The single gate of the `/design` showcase (FND-FR-17).
 *
 * Pure on purpose: the flag is injected, so the decision is unit-testable
 * without the env module. `deny` defaults to Next.js `notFound()`, which sends
 * the real 404 response (a redirect or a custom message would reveal that the
 * page exists).
 *
 * @param isEnabled value of `serverEnv.DESIGN_PAGE_ENABLED`
 * @param deny called when the page is disabled; must not return
 */
export function gateDesignPage(
  isEnabled: boolean,
  deny: () => never = notFound,
): void {
  if (!isEnabled) {
    deny();
  }
}
