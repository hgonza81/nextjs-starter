import "server-only";

import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { fromDbError } from "@/lib/db-error";
import {
  AppError,
  type ActionError,
  type Result,
  fieldErrorsFromZod,
} from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Server Action wrapper (PH-FR-08, D8, ADR 0015). Returns a plain `Result<T>`.
 *
 * Order: parse input, run handler, then on a throw: `unstable_rethrow` (so
 * `redirect()`, `notFound()` and dynamic-rendering signals pass through and
 * are not logged as errors), `AppError` passthrough, database mapping, and
 * finally `unexpected` with a fresh `ref`.
 *
 * Failures are logged here and only here: a wrapped action returns a result
 * instead of throwing, so the `onRequestError` hook never sees them (PH-AC-64).
 * There is no authentication inside; that is epic 003.
 */

type DefineActionConfig<Schema extends z.ZodType, Output> = {
  /** Stable action name, used as the `action` log field. */
  readonly name: string;
  readonly schema: Schema;
  readonly handler: (input: z.output<Schema>) => Promise<Output>;
};

const UNEXPECTED_MESSAGE = "Something went wrong.";
const INVALID_INPUT_MESSAGE = "Some of the submitted data is not valid.";
const REF_LENGTH = 8;

/** 8 hex characters: unique per occurrence, no personal data (PH-AC-71). */
const newRef = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, REF_LENGTH);

const failure = (error: ActionError): Result<never> => ({ ok: false, error });

const toActionError = (error: AppError): ActionError => ({
  type: error.type,
  message: error.message,
  ...(error.fieldErrors === undefined
    ? {}
    : { fieldErrors: error.fieldErrors }),
});

/**
 * Wraps a handler into a Server Action.
 *
 * @returns an async function taking untrusted `input` (validated with
 * `schema`; the handler never runs on invalid input) and resolving to a
 * `Result`. It rejects only for Next.js control-flow signals.
 */
export function defineAction<Schema extends z.ZodType, Output>(
  config: DefineActionConfig<Schema, Output>,
): (input: unknown) => Promise<Result<Output>> {
  const { name, schema, handler } = config;

  return async (input) => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors = fieldErrorsFromZod(parsed.error);
      return failure({
        type: "validation",
        message: INVALID_INPUT_MESSAGE,
        fieldErrors,
      });
    }

    try {
      return { ok: true, data: await handler(parsed.data) };
    } catch (thrown) {
      unstable_rethrow(thrown);

      const mapped = thrown instanceof AppError ? thrown : fromDbError(thrown);

      if (mapped.type !== "unexpected") {
        await logger.warn("action.failed", {
          action: name,
          error_type: mapped.type,
        });
        return failure(toActionError(mapped));
      }

      const ref = newRef();
      await logger.exception("action.unexpected_error", thrown, {
        action: name,
        ref,
      });
      return failure({ type: "unexpected", message: UNEXPECTED_MESSAGE, ref });
    }
  };
}
