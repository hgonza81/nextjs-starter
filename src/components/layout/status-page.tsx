import type { ReactNode, Ref } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";

type StatusPageProps = {
  /** The page heading (an `h1`, or an `h3` when embedded). */
  title: string;
  description: string;
  /**
   * Opaque code the user can quote when reporting a problem (for example an
   * error digest). When absent, the whole code block is omitted.
   */
  referenceCode?: string;
  /** Action slot: Buttons or links. Stacked full width below `sm`, a row from `sm`. */
  actions: ReactNode;
  /**
   * Ref to the heading, so a client error page can focus it on mount. This
   * component stays hook-free; the focus effect belongs to the caller.
   */
  titleRef?: Ref<HTMLHeadingElement>;
  /**
   * Renders as a block inside another page (the `/design` samples): a `div`
   * instead of the `main` landmark, no full-height layout, and an `h3` so the
   * host page keeps one `h1` and a valid heading order.
   */
  isEmbedded?: boolean;
};

/**
 * One full-page status screen for the 500, global error and 404 pages
 * (design system 7.4). Presentational on purpose: no `next/link`, hooks or
 * providers, so it is safe inside `global-error`, which replaces the root
 * layout and cannot rely on any context.
 */
export function StatusPage({
  title,
  description,
  referenceCode,
  actions,
  titleRef,
  isEmbedded = false,
}: StatusPageProps) {
  const Container = isEmbedded ? "div" : "main";
  const Heading = isEmbedded ? "h3" : "h1";

  return (
    <Container
      className={cn(
        "mx-auto flex w-full max-w-md flex-col items-center gap-6 bg-background px-4 py-6 text-center md:px-6 md:py-8",
        !isEmbedded && "min-h-dvh justify-center",
      )}
    >
      <Wordmark className="text-xl" />
      <div className="flex flex-col gap-2">
        {/* tabIndex -1: focusable by script only, never a Tab stop. */}
        <Heading
          ref={titleRef}
          tabIndex={-1}
          className="text-2xl font-semibold tracking-tight break-words focus-ring"
        >
          {title}
        </Heading>
        <p className="text-base text-muted-foreground">{description}</p>
      </div>
      {referenceCode ? (
        <div className="flex max-w-full flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">Reference code</p>
          <code className="max-w-full rounded-md bg-muted px-3 py-2 font-mono text-sm break-all text-foreground select-all">
            {referenceCode}
          </code>
          <p className="text-sm text-muted-foreground">
            If it keeps happening, quote this code when you report it.
          </p>
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-3 *:w-full sm:w-auto sm:flex-row sm:*:w-auto">
        {actions}
      </div>
    </Container>
  );
}
