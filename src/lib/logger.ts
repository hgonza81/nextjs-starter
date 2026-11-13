import "server-only";

import {
  isSpanContextValid,
  logs,
  SeverityNumber,
  trace,
} from "@opentelemetry/api";
import { headers } from "next/headers";

/**
 * Structured, PII-free logger (PH-FR-09, ADR 0013, ADR 0015). One call writes
 * one JSON line: `{ ...fields, ts, level, event, trace_id?, span_id?, request_id? }`.
 *
 * The same entry is also emitted as an OpenTelemetry log record (PH-FR-12):
 * body is the event, attributes are the entry fields, severity follows the
 * level, and the SDK attaches the active trace and span. Without a started SDK
 * the logs API is a no-op. Both outputs share one sanitized entry, so the
 * redaction rules cannot diverge.
 *
 * Why own code and not a library: the surface is tiny and the privacy rules
 * (typed primitive fields, key deny-list, errors reduced to name/code/digest)
 * are the point, not the transport.
 *
 * The methods return a promise because reading the request id needs the async
 * `headers()` API. The promise never rejects, so callers may ignore it; they
 * need to `await` only when they must be sure the line was written.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Only primitives: objects and `Error` instances can smuggle in PII. */
export type LogFieldValue = string | number | boolean | null;
export type LogFields = Readonly<Record<string, LogFieldValue>>;

/** Receives one finished JSON line (no trailing newline). */
export type LogSink = (line: string) => void;

export type LoggerOptions = {
  readonly sink?: LogSink;
  /** Returns the incoming request id, or undefined when there is none. */
  readonly readRequestId?: () => Promise<string | undefined>;
  readonly now?: () => Date;
};

export type Logger = {
  debug(event: string, fields?: LogFields): Promise<void>;
  info(event: string, fields?: LogFields): Promise<void>;
  warn(event: string, fields?: LogFields): Promise<void>;
  error(event: string, fields?: LogFields): Promise<void>;
  /**
   * Logs a caught error at level `error`. Only `error_name`, `error_code` and
   * `digest` are recorded: never the message or stack, which can carry SQL
   * text, parameters or user data.
   */
  exception(event: string, error: unknown, fields?: LogFields): Promise<void>;
};

const MAX_STRING_LENGTH = 200;
const REDACTED = "[redacted]";
// Backstop for mistakes: a value under a key that looks sensitive is replaced.
const DENIED_KEY =
  /email|token|password|secret|authorization|cookie|body|dsn|url|key/i;
// Depth of the `cause` chain searched for a SQLSTATE (Drizzle wraps the driver
// error one level down, ADR 0015 spike).
const MAX_CAUSE_DEPTH = 3;
const SEVERITY_BY_LEVEL: Readonly<Record<LogLevel, SeverityNumber>> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};
const OTEL_LOGGER_NAME = "nextjs-starter";
const REQUEST_ID_HEADERS = ["x-request-id", "x-vercel-id"] as const;

const truncate = (value: string): string =>
  value.length > MAX_STRING_LENGTH ? value.slice(0, MAX_STRING_LENGTH) : value;

const sanitizeValue = (value: LogFieldValue): LogFieldValue => {
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
};

const sanitizeFields = (fields: LogFields): LogFields => {
  const result: Record<string, LogFieldValue> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = DENIED_KEY.test(key) ? REDACTED : sanitizeValue(value);
  }
  return result;
};

const readString = (source: unknown, property: string): string | undefined => {
  if (typeof source !== "object" || source === null) return undefined;
  const value: unknown = Reflect.get(source, property);
  return typeof value === "string" && value !== "" ? value : undefined;
};

/** First string `code` along the `cause` chain (e.g. a Postgres SQLSTATE). */
const findErrorCode = (error: unknown): string | undefined => {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    const code = readString(current, "code");
    if (code !== undefined) return code;
    if (typeof current !== "object" || current === null) return undefined;
    current = Reflect.get(current, "cause");
  }
  return undefined;
};

const reduceError = (error: unknown): LogFields => {
  const reduced: Record<string, LogFieldValue> = {
    error_name: truncate(readString(error, "name") ?? "UnknownError"),
  };
  const code = findErrorCode(error);
  if (code !== undefined) reduced.error_code = truncate(code);
  const digest = readString(error, "digest");
  if (digest !== undefined) reduced.digest = truncate(digest);
  return reduced;
};

const writeToStdout: LogSink = (line) => {
  process.stdout.write(`${line}\n`);
};

// Outside a request (scripts, startup, tests) `headers()` throws; that simply
// means there is no request id. The id is read, never generated (PH-AC-70).
const readRequestIdFromNext = async (): Promise<string | undefined> => {
  try {
    const incoming = await headers();
    for (const name of REQUEST_ID_HEADERS) {
      const value = incoming.get(name);
      if (value) return value;
    }
  } catch {
    // No request scope.
  }
  return undefined;
};

/**
 * Picks the request id (`x-request-id`, then `x-vercel-id`) out of a plain
 * header dictionary, ignoring every other header. For callers that receive the
 * headers as an argument instead of through `headers()`, e.g. `onRequestError`
 * (where `headers()` is not readable for route handlers, PH-T-63). Node
 * lowercases incoming header names; an array value uses its first element.
 */
export function pickRequestId(
  incoming: Readonly<Record<string, string | string[] | undefined>>,
): string | undefined {
  for (const name of REQUEST_ID_HEADERS) {
    const raw = incoming[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) return value;
  }
  return undefined;
}

const readTraceIds = (): LogFields => {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext === undefined || !isSpanContextValid(spanContext)) return {};
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
};

type LogEntry = Readonly<Record<string, LogFieldValue>>;

/**
 * Emits the entry through the OpenTelemetry logs API. Never throws: a failing
 * exporter or provider must not affect the request (PH-AC-72), nor the stdout
 * line, which is written independently.
 */
const emitToOpenTelemetry = (
  level: LogLevel,
  event: string,
  entry: LogEntry,
  timestamp: Date,
): void => {
  try {
    logs.getLogger(OTEL_LOGGER_NAME).emit({
      timestamp,
      severityNumber: SEVERITY_BY_LEVEL[level],
      severityText: level,
      body: event,
      attributes: { ...entry },
    });
  } catch {
    // Intentionally ignored, see above.
  }
};

/** Builds a logger; tests inject the sink, the clock and the request id source. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? writeToStdout;
  const readRequestId = options.readRequestId ?? readRequestIdFromNext;
  const now = options.now ?? (() => new Date());

  const emit = async (
    level: LogLevel,
    event: string,
    fields: LogFields,
  ): Promise<void> => {
    // PH-AC-72: nothing in here may ever affect the request, so every failure
    // (sink, header read, serialization) is swallowed on purpose.
    try {
      const requestId = await readRequestId();
      const timestamp = now();
      const entry = {
        ...sanitizeFields(fields),
        ts: timestamp.toISOString(),
        level,
        event: truncate(event),
        ...readTraceIds(),
        ...(requestId === undefined ? {} : { request_id: truncate(requestId) }),
      };
      // The OTel emit comes first so a throwing sink cannot skip it.
      emitToOpenTelemetry(level, entry.event, entry, timestamp);
      sink(JSON.stringify(entry));
    } catch {
      // Intentionally ignored, see above.
    }
  };

  return {
    debug: (event, fields = {}) => emit("debug", event, fields),
    info: (event, fields = {}) => emit("info", event, fields),
    warn: (event, fields = {}) => emit("warn", event, fields),
    error: (event, fields = {}) => emit("error", event, fields),
    exception: (event, error, fields = {}) =>
      emit("error", event, { ...fields, ...reduceError(error) }),
  };
}

/** The application logger: JSON lines on stdout. */
export const logger: Logger = createLogger();
