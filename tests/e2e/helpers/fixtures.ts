import { expect, test as base } from "@playwright/test";

// Base fixture for every E2E spec (PH-AC-78, test mechanism only).
//
// It records Content-Security-Policy violations in the page (the
// `securitypolicyviolation` event) and the browser's console messages about
// them, and fails the test if any was seen. Until the production CSP exists
// (PH-T-34) nothing can violate it, so the fixture is inert.
//
// A test that provokes violations on purpose opts out:
//   test.use({ allowCspViolations: true });
// and may read them with the `cspViolations` fixture.

type Options = {
  /** Set to true for tests that provoke a violation (PH-AC-32). */
  allowCspViolations: boolean;
};

type Fixtures = {
  /** Descriptions of the CSP violations seen so far in this test. */
  cspViolations: string[];
  cspGuard: void;
};

const VIOLATION_BINDING = "__reportCspViolation";

// Runs before any page script, in every frame, on every navigation.
function installViolationListener(binding: string): void {
  document.addEventListener("securitypolicyviolation", (event) => {
    const report = (
      window as unknown as Record<string, (text: string) => void>
    )[binding];
    report?.(`${event.violatedDirective} blocked ${event.blockedURI}`);
  });
}

export const test = base.extend<Options & Fixtures>({
  allowCspViolations: [false, { option: true }],

  cspViolations: async ({ context }, provide) => {
    const seen: string[] = [];
    await context.exposeBinding(
      VIOLATION_BINDING,
      (_source, description: string) => {
        seen.push(`event: ${description}`);
      },
    );
    await context.addInitScript(installViolationListener, VIOLATION_BINDING);
    // Chromium also prints a console error for each violation.
    context.on("console", (message) => {
      if (
        message.type() === "error" &&
        message.text().includes("Content Security Policy")
      ) {
        seen.push(`console: ${message.text()}`);
      }
    });
    await provide(seen);
  },

  cspGuard: [
    async ({ cspViolations, allowCspViolations }, provide) => {
      await provide();
      if (!allowCspViolations) {
        expect(cspViolations, "CSP violations during the test").toEqual([]);
      }
    },
    { auto: true },
  ],
});

export { expect };
export type { Locator, Page } from "@playwright/test";
