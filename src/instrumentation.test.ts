import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestError } from "@/instrumentation";

vi.mock("server-only", () => ({}));

const log = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  exception: vi.fn(),
}));
// The hook builds its own logger so it can read the request id from its
// `request.headers` argument (PH-T-63); the fake keeps the injected reader.
const createLogger = vi.hoisted(() => vi.fn());
vi.mock("@/lib/logger", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/logger")>()),
  createLogger,
}));

/**
 * PH-FR-05, PH-AC-11/58/60 (unit half): the `onRequestError` hook with fakes.
 * The E2E halves (real requests, real log lines) live in the E2E suite.
 */

type HookArgs = Parameters<typeof onRequestError>;

const makeRequest = (overrides: Record<string, unknown> = {}): HookArgs[1] =>
  ({
    path: "/orders/42?token=x",
    method: "POST",
    headers: { authorization: "Bearer secret-value", cookie: "sid=abc" },
    ...overrides,
  }) as HookArgs[1];

const makeContext = (overrides: Record<string, unknown> = {}): HookArgs[2] =>
  ({
    routerKind: "App Router",
    routePath: "/orders/[id]",
    routeType: "render",
    renderSource: "react-server-components",
    revalidateReason: undefined,
    ...overrides,
  }) as HookArgs[2];

const entryCount = () =>
  Object.values(log).reduce((sum, fn) => sum + fn.mock.calls.length, 0);

beforeEach(() => {
  vi.clearAllMocks();
  createLogger.mockReturnValue(log);
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PH-AC-58: only allowed fields are logged", () => {
  it("PH-AC-58: logs one exception entry with route pattern, route type and method only", async () => {
    const error = new Error("secret message");

    await onRequestError(error, makeRequest(), makeContext());

    expect(entryCount()).toBe(1);
    expect(log.exception).toHaveBeenCalledExactlyOnceWith(
      "request.unhandled_error",
      error,
      { routePath: "/orders/[id]", routeType: "render", method: "POST" },
    );
  });

  it("PH-AC-58: never puts the path, query string, headers or message into the fields", async () => {
    await onRequestError(
      new Error("secret message"),
      makeRequest(),
      makeContext(),
    );

    const [, , fields] = log.exception.mock.calls[0] as [
      string,
      unknown,
      Record<string, unknown>,
    ];
    const serialized = JSON.stringify(fields);
    expect(Object.keys(fields).sort()).toEqual([
      "method",
      "routePath",
      "routeType",
    ]);
    expect(serialized).not.toContain("token=x");
    expect(serialized).not.toContain("/orders/42");
    expect(serialized).not.toContain("Bearer");
    expect(serialized).not.toContain("secret");
  });

  it("PH-AC-58: does not read request.path or the error message, and reads only the request id headers", async () => {
    const reads: string[] = [];
    const headerKeysRead: string[] = [];
    const headers = new Proxy<Record<string, string>>(
      { "x-request-id": "req-1", authorization: "Bearer secret-value" },
      {
        get(target, key) {
          headerKeysRead.push(String(key));
          return Reflect.get(target, key);
        },
      },
    );
    const request = Object.defineProperties(
      { method: "GET", headers },
      Object.getOwnPropertyDescriptors({
        get path() {
          reads.push("path");
          return "/x?token=x";
        },
      }),
    ) as HookArgs[1];
    const error = Object.defineProperty(new Error("x"), "message", {
      get() {
        reads.push("message");
        return "secret message";
      },
    });

    await onRequestError(error, request, makeContext());
    const [options] = createLogger.mock.calls[0] as [
      { readRequestId: () => Promise<string | undefined> },
    ];
    const requestId = await options.readRequestId();

    expect(reads).toEqual([]);
    expect(requestId).toBe("req-1");
    expect(headerKeysRead).not.toContain("authorization");
    expect(headerKeysRead.every((key) => key.startsWith("x-"))).toBe(true);
  });
});

describe("PH-AC-11: route types and methods are passed through", () => {
  it.each([
    ["route", "GET"],
    ["action", "POST"],
    ["render", "GET"],
  ])("PH-AC-11: logs routeType %s for method %s", async (routeType, method) => {
    await onRequestError(
      new Error("boom"),
      makeRequest({ method }),
      makeContext({ routeType }),
    );

    expect(log.exception).toHaveBeenCalledWith(
      "request.unhandled_error",
      expect.any(Error),
      expect.objectContaining({ routeType, method }),
    );
  });
});

describe("PH-AC-60: no entry unless the hook is called with an error", () => {
  it("PH-AC-60: writes nothing when the hook is not invoked (Next skips it for redirect and notFound)", () => {
    // Next does not call the hook for redirect()/notFound() (ADR 0015 spike),
    // so the hook has no filter; the real behavior is proven end to end.
    expect(entryCount()).toBe(0);
  });

  it("PH-AC-60: writes nothing outside the nodejs runtime", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await onRequestError(new Error("boom"), makeRequest(), makeContext());

    expect(entryCount()).toBe(0);
  });
});

describe("PH-FR-05: the hook never throws", () => {
  it("PH-FR-05: resolves when the logger throws synchronously", async () => {
    log.exception.mockImplementationOnce(() => {
      throw new Error("sink down");
    });

    await expect(
      onRequestError(new Error("boom"), makeRequest(), makeContext()),
    ).resolves.toBeUndefined();
  });

  it("PH-FR-05: resolves when the logger rejects", async () => {
    log.exception.mockRejectedValueOnce(new Error("sink down"));

    await expect(
      onRequestError(new Error("boom"), makeRequest(), makeContext()),
    ).resolves.toBeUndefined();
  });

  it("PH-FR-05: resolves when the thrown value is not an Error", async () => {
    await expect(
      onRequestError("a string", makeRequest(), makeContext()),
    ).resolves.toBeUndefined();
    expect(log.exception).toHaveBeenCalledTimes(1);
  });
});
