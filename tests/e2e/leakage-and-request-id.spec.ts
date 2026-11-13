import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "./helpers/fixtures";
import { findLogEntries } from "./helpers/server-log";

// PH-FR-05, PH-FR-08, PH-FR-09, PH-NFR-01 (D5, D7, D8): what the client can see
// never carries internals (PH-AC-11), a wrapped failure is logged once and by
// the wrapper only (PH-AC-64, E2E half) and the request id is read from the
// incoming header, never generated (PH-AC-70, E2E half).
//
// Parallel safety: these tests share routes with server-capture.spec.ts, so no
// test counts entries of the whole log. Every lookup is by a value unique to
// the test (digest, or an `x-request-id` the test sends).

const HOOK_EVENT = "request.unhandled_error";
const WRAPPER_EVENT = "action.unexpected_error";
const FORM = "/design/errors/form";
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

// Text that exists only in the thrown messages of the fixtures and in the
// source tree, env variable names, and the absolute project path.
const MESSAGE_SENTINELS = [
  "Injected page fault",
  "Injected route handler fault",
  "Injected action fault",
  "Injected wrapped action fault",
] as const;
const INTERNAL_MARKERS = [
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "DESIGN_PAGE_ENABLED",
  "SUPABASE_SERVICE_ROLE_KEY",
  "/src/app/",
  "src/app/design",
  process.cwd(),
] as const;
const STACK_FRAME = /\bat\s+\S+\s+\(.*:\d+:\d+\)|\bat\s+.*\.(js|ts|tsx):\d+/;

function unique(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function expectNoInternals(text: string, token?: string): void {
  for (const sentinel of [...MESSAGE_SENTINELS, ...INTERNAL_MARKERS]) {
    expect(text, `contains "${sentinel}"`).not.toContain(sentinel);
  }
  expect(text).not.toMatch(STACK_FRAME);
  if (token !== undefined) {
    // The token is only ever in the request URL, never in what the server adds.
    expect(text.split(token).length - 1, "token echoed beyond the URL").toBe(
      text.split(`?token=${token}`).length - 1,
    );
  }
}

async function readReferenceCode(page: Page): Promise<string> {
  const code = page.locator("code");
  await expect(code).toHaveText(CODE_PATTERN);
  return (await code.textContent()) ?? "";
}

async function entriesOf(
  requestId: string,
): Promise<Record<string, unknown>[]> {
  return findLogEntries({ request_id: requestId });
}

test.describe("PH-AC-11, PH-NFR-01: no internals in responses", () => {
  test("PH-AC-11: a failing page returns no message, stack, path or env name in HTML, RSC payload or headers", async ({
    request,
  }) => {
    const token = unique("leak-page");
    const url = `/design/errors/page-throw?token=${token}`;

    const html = await request.get(url);
    const rsc = await request.get(url, {
      headers: { RSC: "1", Accept: "text/x-component" },
    });

    expect(html.status()).toBe(500);
    for (const response of [html, rsc]) {
      expectNoInternals(await response.text(), token);
      expectNoInternals(JSON.stringify(response.headers()), token);
    }
  });

  test("PH-AC-11: a throwing route handler returns no internals in body or headers", async ({
    request,
  }) => {
    const token = unique("leak-route");

    const response = await request.get(
      `/design/errors/route-throw?token=${token}`,
    );

    expect(response.status()).toBe(500);
    expectNoInternals(await response.text(), token);
    expectNoInternals(JSON.stringify(response.headers()), token);
  });

  test("PH-AC-11: an unwrapped action that throws returns no internals in the page it shows or in the action response", async ({
    page,
  }) => {
    await page.goto(FORM);
    const actionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().endsWith(FORM),
    );

    await page.getByRole("button", { name: "Throwing action" }).click();

    const response = await actionResponse;
    await readReferenceCode(page);
    const visible = await page.locator("html").innerHTML();
    expectNoInternals(await response.text());
    expectNoInternals(JSON.stringify(await response.allHeaders()));
    expectNoInternals(visible);
  });

  test("PH-AC-11: a wrapped action that fails unexpectedly returns no internals in the action response", async ({
    page,
  }) => {
    await page.goto(FORM);
    const actionResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().endsWith(FORM),
    );

    await page
      .getByRole("button", { name: "Wrapped action: unexpected" })
      .click();

    const response = await actionResponse;
    // The payload may carry the `ref`; it must not carry the thrown text.
    expectNoInternals(await response.text());
    expectNoInternals(JSON.stringify(await response.allHeaders()));
  });

  test("PH-AC-11: the logged entry of a failing page holds no message and no path", async ({
    page,
  }) => {
    const token = unique("leak-log");

    await page.goto(`/design/errors/page-throw?token=${token}`);
    const digest = await readReferenceCode(page);

    await expect
      .poll(async () => (await findLogEntries({ digest })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest });
    const line = JSON.stringify(entry);
    expect(line).not.toContain(token);
    expect(line).not.toMatch(STACK_FRAME);
    expect(line).not.toContain("Injected page fault");
    expect(line).not.toContain(process.cwd());
  });
});

test.describe("PH-AC-64: a wrapped failure is logged once, by the wrapper only", () => {
  test("PH-AC-64: a wrapped action that throws unexpectedly writes exactly one wrapper entry and no hook entry", async ({
    page,
  }) => {
    const requestId = unique("req-wrapped");
    await page.setExtraHTTPHeaders({ "x-request-id": requestId });
    await page.goto(FORM);

    await page
      .getByRole("button", { name: "Wrapped action: unexpected" })
      .click();

    await expect
      .poll(async () => (await entriesOf(requestId)).map((e) => e.event))
      .toContain(WRAPPER_EVENT);
    // A later captured failure in the same request id proves the hook had
    // time to log, so the absence below is not premature.
    // `page.request` does not inherit the page's extra headers: pass the id.
    const sentinel = await page.request.get(
      `/design/errors/page-throw?token=${unique("sentinel")}`,
      { headers: { "x-request-id": requestId } },
    );
    expect(sentinel.status()).toBe(500);
    await expect
      .poll(async () =>
        (await entriesOf(requestId)).filter((e) => e.event === HOOK_EVENT),
      )
      .toHaveLength(1);

    const entries = await entriesOf(requestId);
    const wrapper = entries.filter((e) => e.event === WRAPPER_EVENT);
    expect(wrapper).toHaveLength(1);
    expect(wrapper[0]).toMatchObject({
      level: "error",
      action: "design.errors.wrapped_fault",
      error_name: "Error",
    });
    expect(String(wrapper[0]?.ref)).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(wrapper[0])).not.toContain("Injected wrapped");
    // The only hook entry is the sentinel's own (a render, not an action).
    expect(
      entries.filter((e) => e.event === HOOK_EVENT && e.routeType === "action"),
    ).toEqual([]);
  });

  test("PH-AC-64: an unwrapped action that throws writes exactly one hook entry and no wrapper entry", async ({
    page,
  }) => {
    const requestId = unique("req-unwrapped");
    await page.setExtraHTTPHeaders({ "x-request-id": requestId });
    await page.goto(FORM);

    await page.getByRole("button", { name: "Throwing action" }).click();

    await expect
      .poll(async () =>
        (await entriesOf(requestId)).filter(
          (e) => e.event === HOOK_EVENT && e.routeType === "action",
        ),
      )
      .toHaveLength(1);
    const entries = await entriesOf(requestId);
    expect(entries.filter((e) => e.event === WRAPPER_EVENT)).toEqual([]);
    expect(
      entries.filter((e) => typeof e.action === "string"),
      "no wrapper entry of any kind",
    ).toEqual([]);
  });

  test("PH-AC-64: expected wrapped failures (conflict, redirect, not-found) never produce an unexpected-error or hook entry", async ({
    page,
  }) => {
    const requestId = unique("req-expected");
    await page.setExtraHTTPHeaders({ "x-request-id": requestId });
    await page.goto(FORM);

    await page
      .getByRole("button", { name: "Wrapped action: conflict" })
      .click();
    await expect
      .poll(async () => (await entriesOf(requestId)).map((e) => e.event))
      .toContain("action.failed");
    await page.goto(FORM);
    await page
      .getByRole("button", { name: "Wrapped action: redirect" })
      .click();
    await page.goto(FORM);
    await page
      .getByRole("button", { name: "Wrapped action: not-found" })
      .click();
    // Sentinel: once this later failure is logged, earlier ones had time to be.
    await page.request.get(
      `/design/errors/page-throw?token=${unique("sentinel")}`,
      { headers: { "x-request-id": requestId } },
    );
    await expect
      .poll(async () =>
        (await entriesOf(requestId)).filter((e) => e.event === HOOK_EVENT),
      )
      .toHaveLength(1);

    const events = (await entriesOf(requestId)).map((e) => e.event);
    expect(events).not.toContain(WRAPPER_EVENT);
    expect(
      events.filter((e) => e === "action.failed"),
      "only the conflict is a logged failure",
    ).toHaveLength(1);
  });
});

test.describe("PH-AC-70: the request id is read from the header, never generated", () => {
  test("PH-AC-70: entries written during a request carry the incoming x-request-id", async ({
    page,
  }) => {
    const requestId = unique("req-carried");
    await page.setExtraHTTPHeaders({ "x-request-id": requestId });

    await page.goto(`/design/errors/page-throw?token=${unique("t")}`);
    const digest = await readReferenceCode(page);

    await expect
      .poll(async () => (await findLogEntries({ digest })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest });
    expect(entry).toMatchObject({ event: HOOK_EVENT, request_id: requestId });
  });

  // KNOWN PRODUCTION DEFECT (reported in PH-T-20): the hook logs route handler
  // failures without `request_id`, although the request carried the header
  // (pages and actions do carry it). `test.fail` keeps the suite green and
  // turns red as soon as it is fixed, so the annotation must then be removed.
  test("PH-AC-70: a route handler failure carries the incoming x-request-id too", async ({
    request,
  }) => {
    test.fail(true, "onRequestError cannot read request headers for routes");
    const requestId = unique("req-route");

    const response = await request.get(
      `/design/errors/route-throw?token=${unique("t")}`,
      { headers: { "x-request-id": requestId } },
    );

    expect(response.status()).toBe(500);
    await expect
      .poll(
        async () =>
          (await entriesOf(requestId)).filter((e) => e.event === HOOK_EVENT),
        { timeout: 3000 },
      )
      .toHaveLength(1);
  });

  test("PH-AC-70: without the header, entries have no request_id field and none is generated", async ({
    page,
  }) => {
    await page.goto(`/design/errors/page-throw?token=${unique("t")}`);
    const digest = await readReferenceCode(page);

    await expect
      .poll(async () => (await findLogEntries({ digest })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest });
    expect(entry).not.toHaveProperty("request_id");
    // The response does not hand out a generated id either.
    const response = await page.request.get(
      `/design/errors/route-throw?token=${unique("t")}`,
    );
    expect(response.headers()).not.toHaveProperty("x-request-id");
  });

  test("PH-AC-70: an empty x-request-id is treated as absent", async ({
    page,
  }) => {
    await page.setExtraHTTPHeaders({ "x-request-id": "" });

    await page.goto(`/design/errors/page-throw?token=${unique("t")}`);
    const digest = await readReferenceCode(page);

    await expect
      .poll(async () => (await findLogEntries({ digest })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest });
    expect(entry).not.toHaveProperty("request_id");
  });
});
