import { expect, test } from "./helpers/fixtures";

// PH-AC-78 (test mechanism): the base fixture fails any test that records a
// CSP violation unless it opts out with `allowCspViolations`.
//
// This test provokes a violation WITHOUT opting out and is wrapped in
// test.fail(): the suite is green only if the fixture really fails it. If the
// fixture stopped guarding, the test would pass and Playwright would report
// "expected to fail, but passed".
//
// Why document.write: a parser-inserted inline script without a nonce is
// blocked by the CSP (createElement scripts would be trusted by
// 'strict-dynamic').

test("PH-AC-78: the base fixture fails a test that records a CSP violation", async ({
  page,
  cspViolations,
}) => {
  test.fail();

  await page.goto("/");
  await page.evaluate(() => {
    document.write("<script>window.__inlineRan = true;</script>");
    document.close();
  });

  // Wait until the violation is recorded, so the fixture check cannot run early.
  await expect.poll(() => cspViolations.length).toBeGreaterThan(0);
});
