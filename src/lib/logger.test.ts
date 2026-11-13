/**
 * PH-FR-09 / PH-NFR-01: the structured logger. Requirement ids in the names
 * point at spec section 8 (PH-AC-16, 17, 18, 70, 72).
 */
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { installTestTracing } from "../../tests/utils/otel-test-tracer";
import { createLogger, type LoggerOptions } from "./logger";

const FIXED = new Date("2026-01-02T03:04:05.678Z");

type Entry = Record<string, unknown>;

function setup(options: LoggerOptions = {}) {
  const lines: string[] = [];
  const log = createLogger({
    sink: (line) => lines.push(line),
    readRequestId: async () => undefined,
    now: () => FIXED,
    ...options,
  });
  const entries = (): Entry[] => lines.map((l) => JSON.parse(l) as Entry);
  return { log, lines, entries };
}

describe("PH-AC-16: one JSON line with the required fields", () => {
  it("PH-AC-16: writes exactly one parseable JSON line per call with ts, level and event", async () => {
    const { log, lines, entries } = setup();

    await log.info("user.signed_in", { attempt: 1 });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("\n");
    expect(entries()[0]).toEqual({
      attempt: 1,
      ts: "2026-01-02T03:04:05.678Z",
      level: "info",
      event: "user.signed_in",
    });
  });

  it.each(["debug", "info", "warn", "error"] as const)(
    "PH-AC-16: the %s method records its own level",
    async (level) => {
      const { log, entries } = setup();

      await log[level]("evt");

      expect(entries()[0]).toMatchObject({ level, event: "evt" });
    },
  );

  it("PH-AC-16: omits trace_id and span_id when no span is active", async () => {
    const { log, entries } = setup();

    await log.info("evt");

    expect(entries()[0]).not.toHaveProperty("trace_id");
    expect(entries()[0]).not.toHaveProperty("span_id");
  });

  describe("with an active span", () => {
    const tracing = installTestTracing();
    afterEach(() => {
      tracing.exporter.reset();
    });
    afterAll(() => tracing.shutdown());

    it("PH-AC-16: carries trace_id and span_id of the active span, even after an await", async () => {
      const { log, entries } = setup({
        readRequestId: async () => {
          await Promise.resolve();
          return undefined;
        },
      });

      const ids = await tracing.withActiveSpan("test-span", () =>
        log.info("evt"),
      );

      expect(entries()[0]).toMatchObject({
        trace_id: ids.traceId,
        span_id: ids.spanId,
      });
      expect(ids.traceId).toMatch(/^[0-9a-f]{32}$/);
      expect(ids.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(tracing.exporter.getFinishedSpans()).toHaveLength(1);
    });

    it("PH-AC-16: omits the ids again once the span has ended", async () => {
      const { log, entries } = setup();
      await tracing.withActiveSpan("test-span", async () => {});

      await log.info("evt");

      expect(entries()[0]).not.toHaveProperty("trace_id");
    });
  });
});

describe("PH-AC-17: typed fields and redaction", () => {
  it.each([
    ["string", "text"],
    ["number", 42],
    ["boolean", true],
    ["null", null],
  ])("PH-AC-17: keeps a %s field as its JSON type", async (_label, value) => {
    const { log, entries } = setup();

    await log.info("evt", { value });

    expect(entries()[0]?.value).toBe(value);
  });

  it("PH-AC-17: turns a non-finite number into null", async () => {
    const { log, entries } = setup();

    await log.info("evt", { a: Number.NaN, b: Number.POSITIVE_INFINITY });

    expect(entries()[0]).toMatchObject({ a: null, b: null });
  });

  it.each([
    "email",
    "userEmail",
    "access_token",
    "password",
    "client_secret",
    "authorization",
    "cookie",
    "requestBody",
    "dsn",
    "databaseUrl",
    "apiKey",
    "EMAIL",
  ])("PH-AC-17: redacts the value of the denied key %s", async (key) => {
    const { log, lines } = setup();

    await log.info("evt", { [key]: "sensitive-value-123" });

    expect(lines[0]).not.toContain("sensitive-value-123");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ [key]: "[redacted]" });
  });

  it("PH-AC-17: does not redact keys that merely look harmless", async () => {
    const { log, entries } = setup();

    await log.info("evt", { route: "/health", status: 200 });

    expect(entries()[0]).toMatchObject({ route: "/health", status: 200 });
  });
});

describe("PH-AC-17: truncation at 200 characters", () => {
  it("PH-AC-17: leaves a string of exactly 200 characters intact", async () => {
    const { log, entries } = setup();

    await log.info("evt", { note: "a".repeat(200) });

    expect(entries()[0]?.note).toBe("a".repeat(200));
  });

  it("PH-AC-17: truncates a string of 201 characters to 200", async () => {
    const { log, entries } = setup();

    await log.info("evt", { note: "a".repeat(201) });

    expect(entries()[0]?.note).toBe("a".repeat(200));
  });

  it("PH-AC-17: truncates a long event name and a long request id", async () => {
    const { log, entries } = setup({
      readRequestId: async () => "r".repeat(500),
    });

    await log.info("e".repeat(500));

    expect(entries()[0]?.event).toBe("e".repeat(200));
    expect(entries()[0]?.request_id).toBe("r".repeat(200));
  });
});

describe("PH-AC-18: errors are reduced to name, code and digest", () => {
  it("PH-AC-18: records error_name, error_code and digest only", async () => {
    const { log, entries } = setup();
    const error = Object.assign(new TypeError("secret SQL text: pw=hunter2"), {
      code: "23505",
      digest: "abc123",
    });

    await log.exception("db.failed", error, { op: "insert" });

    expect(entries()[0]).toEqual({
      op: "insert",
      error_name: "TypeError",
      error_code: "23505",
      digest: "abc123",
      ts: "2026-01-02T03:04:05.678Z",
      level: "error",
      event: "db.failed",
    });
  });

  it("PH-AC-18: never writes the message or the stack", async () => {
    const { log, lines } = setup();
    const error = new Error("SELECT * FROM users WHERE email = 'a@b.c'");

    await log.exception("evt", error);

    expect(lines[0]).not.toContain("SELECT");
    expect(lines[0]).not.toContain("a@b.c");
    expect(lines[0]).not.toContain("stack");
    expect(lines[0]).not.toContain("logger.test");
  });

  it("PH-AC-18: finds a SQLSTATE one level down the cause chain", async () => {
    const { log, entries } = setup();
    const error = new Error("Failed query", {
      cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
    });

    await log.exception("evt", error);

    expect(entries()[0]).toMatchObject({
      error_name: "Error",
      error_code: "23505",
    });
  });

  it("PH-AC-18: gives up on a cause chain deeper than the search limit", async () => {
    const { log, entries } = setup();
    const deep = Object.assign(new Error("deep"), { code: "XX000" });
    const error = new Error("a", {
      cause: new Error("b", {
        cause: new Error("c", { cause: new Error("d", { cause: deep }) }),
      }),
    });

    await log.exception("evt", error);

    expect(entries()[0]).not.toHaveProperty("error_code");
  });

  it.each([
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 7],
    ["a plain object", { message: "x" }],
  ])(
    "PH-AC-18: reduces %s to UnknownError without leaking it",
    async (_l, thrown) => {
      const { log, entries, lines } = setup();

      await log.exception("evt", thrown);

      expect(entries()[0]).toMatchObject({ error_name: "UnknownError" });
      expect(lines[0]).not.toContain("boom");
    },
  );

  it("PH-AC-18: ignores a non-string code", async () => {
    const { log, entries } = setup();

    await log.exception("evt", Object.assign(new Error("x"), { code: 500 }));

    expect(entries()[0]).not.toHaveProperty("error_code");
  });
});

describe("PH-AC-70: request id", () => {
  it("PH-AC-70: carries request_id from the injected source", async () => {
    const { log, entries } = setup({ readRequestId: async () => "req-42" });

    await log.info("evt");

    expect(entries()[0]?.request_id).toBe("req-42");
  });

  it("PH-AC-70: omits request_id when the source has none (it is never generated)", async () => {
    const { log, entries } = setup({ readRequestId: async () => undefined });

    await log.info("evt");

    expect(entries()[0]).not.toHaveProperty("request_id");
  });

  it("PH-AC-70: omits request_id outside a request scope with the default source", async () => {
    const lines: string[] = [];
    const log = createLogger({ sink: (l) => lines.push(l), now: () => FIXED });

    await log.info("evt");

    expect(JSON.parse(lines[0] ?? "{}")).not.toHaveProperty("request_id");
  });
});

describe("PH-AC-72: the logger never affects the caller", () => {
  it("PH-AC-72: a throwing sink does not reject or throw", async () => {
    const log = createLogger({
      sink: () => {
        throw new Error("disk full");
      },
      readRequestId: async () => undefined,
    });

    await expect(log.info("evt")).resolves.toBeUndefined();
    await expect(log.exception("evt", new Error("x"))).resolves.toBeUndefined();
  });

  it("PH-AC-72: a rejecting request id source does not reject", async () => {
    const { log, lines } = setup({
      readRequestId: async () => {
        throw new Error("no headers");
      },
    });

    await expect(log.info("evt")).resolves.toBeUndefined();
    expect(lines).toHaveLength(0);
  });

  it("PH-AC-72: a field that cannot be serialized does not throw", async () => {
    const { log } = setup();
    const circular = {
      toJSON: () => {
        throw new Error("nope");
      },
    };

    await expect(
      log.info("evt", { circular } as never),
    ).resolves.toBeUndefined();
  });
});
