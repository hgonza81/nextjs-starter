"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";

/**
 * The 500 page (PH-FR-01): shown when a page or nested layout fails to render.
 * Only the opaque digest is displayed, never the message or stack
 * (PH-NFR-01). The digest equals the one in the server log (PH-AC-01, BR-02).
 * The prop is `retry`, not `reset`, in this Next.js version.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // PH-NFR-04: move focus to the heading so screen reader and keyboard users
  // land on the new content. Runs again when a retry fails with a new error.
  useEffect(() => {
    titleRef.current?.focus();
  }, [error]);

  return (
    <>
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
              <Link href="/">Go to home page</Link>
            </Button>
          </>
        }
      />
    </>
  );
}

/** Returns the digest only when it is a non-empty string; client-thrown values may be anything. */
function readDigest(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return undefined;
  }
  const { digest } = error;
  return typeof digest === "string" && digest !== "" ? digest : undefined;
}
