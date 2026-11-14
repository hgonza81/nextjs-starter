import { randomUUID } from "node:crypto";

import type { APIResponse, Page, Request } from "@playwright/test";

import { expect, test } from "./helpers/fixtures";
import {
  findLogEntries,
  findLogLinesContaining,
  readLogLines,
} from "./helpers/server-log";

// PH-FR-16, PH-AC-30 (relaxed) and PH-AC-67 (ADR 0014, "Spike outcome"):
// Server Action body size limit and origin check, on the production build.
//
// Posts go through the real fault fixture form (/design/errors/form), so the
// Server Action id is genuine. The action itself does nothing observable, so
// "the action does not run" is proved by the response: a rejected post gets the
// framework's error (an `E{digest}` row with no action result), and the server
// log names the framework's rejection (body limit 413, or the origin error)
// instead of any output of the action. Log entries are matched by the digest
// returned in that very response, never by whole-log counts, so parallel tests
// do not see each other's entries. Caveat: the digest of a body-limit error is
// the same for every oversized post (it hashes the message), so exactly ONE
// test in the suite may send an oversized body.

const FORM_PATH = "/design/errors/form";
// Limit is 1 MB (experimental.serverActions.bodySizeLimit): 1 MiB = 1_048_576.
const JUST_UNDER_LIMIT_CHARS = 1_000_000;
const OVER_LIMIT_CHARS = 1_100_000;
const ANSI = /\u001b\[[0-9;]*m/g;

type Captured = { request: Request; status: number; body: string };

/** Fills the payload field with `chars` characters and submits the form. */
async function submitPayload(page: Page, chars: number): Promise<Captured> {
  await page.goto(FORM_PATH);
  // Wait for hydration, so the submit is a Server Action fetch (Next-Action
  // header) and not a plain form navigation.
  // Set in the page: Playwright's `fill` with a megabyte is slow under load.
  await page.getByLabel("Payload").evaluate((field, size) => {
    (field as HTMLTextAreaElement).value = "x".repeat(size);
  }, chars);
  const requestSeen = page.waitForRequest(
    (request) => request.method() === "POST",
  );
  const responseSeen = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send payload" }).click();
  const [request, response] = await Promise.all([requestSeen, responseSeen]);
  return { request, status: response.status(), body: await response.text() };
}

function digestOf(body: string): string {
  const match = /"digest":"([^"]+)"/.exec(body);
  expect(match, `an error digest in the response body: ${body}`).not.toBeNull();
  return match?.[1] ?? "";
}

/** The Next error line printed right before the `digest:` line of one error. */
async function framework413Lines(digest: string): Promise<string[]> {
  const lines = (await readLogLines()).map((line) => line.replace(ANSI, ""));
  const at = lines.findIndex((line) => line.includes(`digest: '${digest}'`));
  return at > 0 ? [lines[at - 1] ?? ""] : [];
}

/** Replays the captured Server Action post, with the given Origin (or none). */
async function replayAction(
  page: Page,
  captured: Request,
  origin: string | null,
): Promise<APIResponse> {
  const headers = { ...captured.headers() };
  delete headers["origin"];
  delete headers["content-length"];
  if (origin !== null) headers["origin"] = origin;
  return page.request.post(captured.url(), {
    headers,
    data: captured.postDataBuffer() ?? undefined,
  });
}

test.describe("body size limit", () => {
  test("PH-AC-30: a Server Action body just under 1 MB is accepted (200, no error row)", async ({
    page,
  }) => {
    const { status, body } = await submitPayload(page, JUST_UNDER_LIMIT_CHARS);

    expect(status).toBe(200);
    expect(body).not.toContain('"digest"');
    expect(body).not.toMatch(/^1:E/m);
  });

  test("PH-AC-30: a Server Action body over 1 MB is rejected with a non-2xx response before the action runs, and the log shows statusCode 413 without leaking the payload", async ({
    page,
  }) => {
    const { status, body } = await submitPayload(page, OVER_LIMIT_CHARS);

    // Neither the payload nor a stack trace nor the limit text is exposed.
    expect(body.length).toBeLessThan(1_000);
    expect(body).not.toContain("xxxxxxxx");
    expect(body).not.toMatch(/Body exceeded|bodySizeLimit|\bat\s+\S+\s+\(/);
    // Not a literal 413: Next answers 500 and logs the 413 (spike PH-T-33).
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).not.toBe(200);
    const digest = digestOf(body);
    // The only result is the framework's error: the action returned nothing.
    expect(body).toMatch(/^1:E\{"digest":"[^"]+"\}$/m);

    await expect
      .poll(async () => (await framework413Lines(digest)).join("\n"))
      .toMatch(/statusCode:\s*413/);
    await expect
      .poll(async () => (await findLogEntries({ digest })).length)
      .toBe(1);
    const [entry] = await findLogEntries({ digest });
    expect(entry).toMatchObject({
      event: "request.unhandled_error",
      routeType: "action",
      method: "POST",
    });
  });
});

test.describe("origin check", () => {
  test("PH-AC-67: a Server Action post with a foreign Origin is rejected and the action does not run", async ({
    page,
  }) => {
    const marker = randomUUID();
    await page.goto(FORM_PATH);
    await page.getByLabel("Payload").fill(`small-${marker}`);
    const requestSeen = page.waitForRequest(
      (request) => request.method() === "POST",
    );
    await page.getByRole("button", { name: "Send payload" }).click();
    const captured = await requestSeen;

    const response = await replayAction(page, captured, "https://evil.example");
    const body = await response.text();

    expect(response.status()).toBeGreaterThanOrEqual(400);
    const digest = digestOf(body);
    expect(body).toMatch(/^1:E\{"digest":"[^"]+"\}$/m);
    expect(body).not.toContain(marker);
    expect(body).not.toMatch(/evil\.example|x-forwarded-host|\bat\s+\S+\s+\(/);
    await expect
      .poll(async () => (await findLogEntries({ digest })).length)
      .toBe(1);
    // The payload never reaches the log either.
    expect(await findLogLinesContaining(marker)).toEqual([]);
  });

  test("PH-AC-67: a Server Action post with Origin null is rejected", async ({
    page,
  }) => {
    await page.goto(FORM_PATH);
    await page.getByLabel("Payload").fill("small");
    const requestSeen = page.waitForRequest(
      (request) => request.method() === "POST",
    );
    await page.getByRole("button", { name: "Send payload" }).click();
    const captured = await requestSeen;

    const response = await replayAction(page, captured, "null");

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(digestOf(await response.text())).not.toBe("");
  });

  test("PH-AC-67: a post from the app's own origin is accepted (control for the foreign-origin test)", async ({
    page,
    baseURL,
  }) => {
    await page.goto(FORM_PATH);
    await page.getByLabel("Payload").fill("small");
    const requestSeen = page.waitForRequest(
      (request) => request.method() === "POST",
    );
    await page.getByRole("button", { name: "Send payload" }).click();
    const captured = await requestSeen;

    const response = await replayAction(page, captured, baseURL ?? "");

    expect(response.status()).toBe(200);
  });

  test("PH-AC-67: a post with no Origin header is accepted (documented Next behavior, ADR 0014)", async ({
    page,
  }) => {
    await page.goto(FORM_PATH);
    await page.getByLabel("Payload").fill("small");
    const requestSeen = page.waitForRequest(
      (request) => request.method() === "POST",
    );
    await page.getByRole("button", { name: "Send payload" }).click();
    const captured = await requestSeen;

    const response = await replayAction(page, captured, null);

    expect(response.status()).toBe(200);
  });
});
