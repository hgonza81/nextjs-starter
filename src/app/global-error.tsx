"use client";

import { GeistSans } from "geist/font/sans";
import { useEffect, useRef } from "react";

import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * The global error page (PH-FR-02, PH-AC-03): replaces the root layout when it
 * fails, so it brings its own `html`/`body`, stylesheet and font, and cannot
 * rely on any provider. The home action is a plain anchor (no router needed).
 * Script-free of its own: it only needs the hydration Next.js already ships
 * (ADR 0014, global-error nonce note).
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [error]);

  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        {/* React hoists <title> to the head; `metadata` is not allowed here. */}
        <title>Something went wrong</title>
        <StatusPage
          titleRef={titleRef}
          title="Something went wrong"
          description="We hit an unexpected problem. You can try again, or come back in a few minutes."
          referenceCode={readDigest(error)}
          actions={
            <>
              <Button onClick={() => retry()}>Try again</Button>
              <Button asChild variant="outline">
                {/* Plain anchor on purpose: the root layout is gone, so the router may be unusable and a full load is the safe recovery. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/">Go to home page</a>
              </Button>
            </>
          }
        />
      </body>
    </html>
  );
}

/** Returns the digest only when it is a non-empty string. */
function readDigest(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return undefined;
  }
  const { digest } = error;
  return typeof digest === "string" && digest !== "" ? digest : undefined;
}
