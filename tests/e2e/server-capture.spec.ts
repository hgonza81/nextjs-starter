import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "./helpers/fixtures";
import {
  findLogEntries,
  findLogLinesContaining,
  readLogEntries,
} from "./helpers/server-log";

// PH-FR-05, PH-FR-09 (D5, D7): server-side capture by the onRequestError hook,
// asserted on the server log file that scripts/e2e-server.mts writes.
//
// Notes on what is asserted where:
// - The token in a fixture's thrown message is echoed in the page URL (HTML and
//   RSC payload), which is expected. It must be absent from the log ENTRIES
//   (the hook never logs messages). Next prints the raw error itself to the
//   server output; that framework output is not a logger entry and is not
//   asserted on.
// - Entries are matched by their digest where a digest is reachable, so tests
//   in parallel never see each other's entries.

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const HOOK_EVENT = "request.unhandled_error";
const ALLOWED_FIELDS = new Set([
  "routePath",
  "routeType",
  "method",
  "error_name",
  "error_code",
  "digest",
  "ts",
  "level",
  "event",
  "trace_id",
  "span_id",
  "request_id",
]);

function newToken(): string {
  return `t-${randomUUID()}`;
}

async function readReferenceCode(page: Page): Promise<string> {
  const code = page.locator("code");
  await expect(code).toHaveText(CODE_PATTERN);
  return (await code.textContent()) ?? "";
}

/** Waits until a failing page has been captured, so "no entry" checks are not premature. */
async function captureSentinel(page: Page): Promise<void> {
  await page.goto(`/design/errors/page-throw?token=${newToken()}`);
  const digest = await readReferenceCode(page);
  await expect
    .poll(async () => (await findLogEntries({ digest })).length)
    .toBe(1);
}

function countEntries(
  entries: Record<string, unknown>[],
  match: Record<string, unknown>,
): number {
  return entries.filter((entry) =>
    Object.entries(match).every(([key, value]) => entry[key] === value),
  ).length;
}

test.describe("pages", () => {
  test("PH-AC-08: the code on the 500 page equals the code in exactly one log entry, and the token is in neither the entry nor the HTML-visible message", async ({
    page,
  }) => {
    const token = newToken();

    const response = await page.goto(
      `/design/errors/page-throw?token=${token}`,
    );
    const code = await readReferenceCode(page);

    expect(response?.status()).toBe(500);
    await expect
      .poll(async () => (await findLogEntries({ digest: code })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest: code });
    expect(entry).toMatchObject({
      event: HOOK_EVENT,
      level: "error",
      routePath: "/design/errors/page-throw",
      routeType: "render",
      method: "GET",
      error_name: "Error",
    });
    expect(JSON.stringify(entry)).not.toContain(token);
    expect(JSON.stringify(entry)).not.toContain("Injected page fault");
    // The message is not rendered on the page (the token echo is only the URL).
    expect(await page.locator("body").innerText()).not.toContain(
      "Injected page fault",
    );
  });

  test("PH-AC-08: reloading the failing page logs a new entry with its own code, one per failure", async ({
    page,
  }) => {
    const token = newToken();
    await page.goto(`/design/errors/page-throw?token=${token}`);
    const first = await readReferenceCode(page);

    await page.goto(`/design/errors/page-throw?token=${token}`);
    const second = await readReferenceCode(page);

    for (const code of new Set([first, second])) {
      await expect
        .poll(async () => (await findLogEntries({ digest: code })).length)
        .toBe(first === second ? 2 : 1);
    }
  });

  test("PH-AC-58: a query string and an Authorization header never reach the log; only allowed fields are logged", async ({
    page,
  }) => {
    const token = newToken();
    const bearer = `Bearer secret-${randomUUID()}`;
    await page.setExtraHTTPHeaders({ Authorization: bearer });

    await page.goto(`/design/errors/page-throw?token=${token}&x=1`);
    const code = await readReferenceCode(page);

    await expect
      .poll(async () => (await findLogEntries({ digest: code })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest: code });
    const line = JSON.stringify(entry);
    expect(line).not.toContain(token);
    expect(line).not.toContain(bearer);
    expect(line).not.toContain("?");
    expect(line).not.toContain("Injected page fault");
    expect(
      Object.keys(entry ?? {}).filter((k) => !ALLOWED_FIELDS.has(k)),
    ).toEqual([]);
    // The token never appears in any structured entry, not only this one.
    expect(
      (await readLogEntries()).filter((e) => JSON.stringify(e).includes(token)),
    ).toEqual([]);
    expect(
      (await findLogLinesContaining(bearer)).filter((l) => l.startsWith("{")),
    ).toEqual([]);
  });

  test("PH-AC-60: a page that calls notFound() answers 404 and writes no entry", async ({
    page,
  }) => {
    const response = await page.goto("/design/errors/not-found-page");
    expect(response?.status()).toBe(404);

    await captureSentinel(page);

    expect(
      await findLogEntries({ routePath: "/design/errors/not-found-page" }),
    ).toEqual([]);
  });
});

// Serial: both tests count entries of the same route and type.
test.describe("route handler", () => {
  test.describe.configure({ mode: "serial" });

  test("PH-AC-10: a throwing route handler answers 500 with no internals and logs exactly one entry", async ({
    page,
    request,
  }) => {
    const token = newToken();
    const route = "/design/errors/route-throw";
    const before = countEntries(await readLogEntries(), {
      routePath: route,
      event: HOOK_EVENT,
    });

    const response = await request.get(`${route}?token=${token}`);
    const body = await response.text();

    expect(response.status()).toBe(500);
    for (const text of [body, JSON.stringify(response.headers())]) {
      expect(text).not.toContain("Injected route handler fault");
      expect(text).not.toContain(token);
      expect(text).not.toMatch(/\bat .*\.(js|ts|tsx):\d+/);
      expect(text).not.toContain("/src/app/");
    }
    await expect
      .poll(
        async () =>
          countEntries(await readLogEntries(), {
            routePath: route,
            event: HOOK_EVENT,
          }) - before,
      )
      .toBe(1);
    await captureSentinel(page);
    expect(
      countEntries(await readLogEntries(), {
        routePath: route,
        event: HOOK_EVENT,
      }) - before,
    ).toBe(1);
    const entries = await findLogEntries({ routePath: route });
    const entry = entries[entries.length - 1];
    expect(entry).toMatchObject({
      routeType: "route",
      method: "GET",
      error_name: "Error",
    });
    expect(JSON.stringify(entry)).not.toContain(token);
  });
});

// Serial among themselves. Entries are matched by a unique `x-request-id`, not
// by digest or whole-route counts: the digest of an action error is the same
// for every occurrence of the same message, and leakage-and-request-id.spec.ts
// triggers the same actions in parallel (PH-T-20).
test.describe("actions", () => {
  test.describe.configure({ mode: "serial" });
  const FORM = "/design/errors/form";

  test("PH-AC-09: an unwrapped action that throws logs exactly one hook entry and the caller gets a generic error", async ({
    page,
  }) => {
    const requestId = `req-ac09-${randomUUID()}`;
    await page.setExtraHTTPHeaders({ "x-request-id": requestId });
    await page.goto(FORM);

    await page.getByRole("button", { name: "Throwing action" }).click();

    // The error boundary shows Next's generic page with the digest.
    await expect(
      page.getByRole("heading", { level: 1, name: "Something went wrong" }),
    ).toBeVisible();
    await readReferenceCode(page);
    await expect
      .poll(
        async () => (await findLogEntries({ request_id: requestId })).length,
      )
      .toBe(1);
    const [entry] = await findLogEntries({ request_id: requestId });
    expect(entry).toMatchObject({
      event: HOOK_EVENT,
      level: "error",
      routePath: FORM,
      routeType: "action",
      method: "POST",
      error_name: "Error",
    });
    expect(entry?.digest).toBe(await readReferenceCode(page));
    expect(JSON.stringify(entry)).not.toContain("Injected action fault");
    expect(await page.locator("body").innerText()).not.toContain(
      "Injected action fault",
    );
    await captureSentinel(page);
    // The sentinel above carries the same request id (a render entry).
    expect(
      await findLogEntries({ request_id: requestId, routeType: "action" }),
    ).toHaveLength(1);
  });

  test("PH-AC-60: an action that calls redirect() navigates and writes no entry", async ({
    page,
  }) => {
    const requestId = `req-ac60-${randomUUID()}`;
    await page.setExtraHTTPHeaders({ "x-request-id": requestId });
    await page.goto(FORM);

    await page.getByRole("button", { name: "Redirecting action" }).click();
    await expect(page).toHaveURL(new RegExp(`${FORM}$`));
    await captureSentinel(page);

    expect(
      await findLogEntries({ request_id: requestId, routeType: "action" }),
    ).toEqual([]);
  });
});
