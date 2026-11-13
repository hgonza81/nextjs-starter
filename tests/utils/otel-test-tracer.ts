/**
 * Dev-only tracing helper for unit tests (PH-AC-16, trace_id / span_id).
 *
 * Wires a real tracer provider to an in-memory exporter and installs a minimal
 * AsyncLocalStorage context manager, so `trace.getActiveSpan()` works across
 * `await` exactly as it does under the production SDK. Nothing here ships:
 * `@opentelemetry/sdk-trace` is a devDependency (ADR 0010).
 */
import { AsyncLocalStorage } from "node:async_hooks";

import {
  type Context,
  type ContextManager,
  ROOT_CONTEXT,
  context,
  trace,
} from "@opentelemetry/api";
import {
  TracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace";

class AsyncLocalStorageContextManager implements ContextManager {
  private readonly storage = new AsyncLocalStorage<Context>();

  active(): Context {
    return this.storage.getStore() ?? ROOT_CONTEXT;
  }

  with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    ctx: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    return this.storage.run(ctx, () => fn.call(thisArg, ...args));
  }

  bind<T>(_ctx: Context, target: T): T {
    return target;
  }

  enable(): this {
    return this;
  }

  disable(): this {
    this.storage.disable();
    return this;
  }
}

export type TestTracing = {
  readonly exporter: InMemorySpanExporter;
  /** Runs `fn` inside an active span and returns the span's ids. */
  withActiveSpan<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<{ traceId: string; spanId: string }>;
  /** Uninstalls the context manager and global tracer provider. */
  shutdown(): Promise<void>;
};

export function installTestTracing(): TestTracing {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });
  const contextManager = new AsyncLocalStorageContextManager();
  context.setGlobalContextManager(contextManager);
  trace.setGlobalTracerProvider(provider);
  const tracer = provider.getTracer("logger-test");

  return {
    exporter,
    async withActiveSpan(name, fn) {
      return tracer.startActiveSpan(name, async (span) => {
        try {
          await fn();
          const { traceId, spanId } = span.spanContext();
          return { traceId, spanId };
        } finally {
          span.end();
        }
      });
    },
    async shutdown() {
      await provider.shutdown();
      context.disable();
      trace.disable();
    },
  };
}
