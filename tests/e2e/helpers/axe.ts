import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// The WCAG 2.2 AA rule set required by FND-NFR-03.
export const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
] as const;

/** Runs axe on the page (and the frames inside it) and expects zero violations. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS])
    .analyze();

  expect(results.violations).toEqual([]);
}
