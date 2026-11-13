import type { Metadata } from "next";

import Link from "next/link";

import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * The 404 page (PH-FR-03): unknown URLs, `notFound()` and gated `/design*`
 * routes all land here. No reference code: nothing failed on the server.
 */
export default function NotFound() {
  return (
    <StatusPage
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      actions={
        <Button asChild>
          <Link href="/">Go to home page</Link>
        </Button>
      }
    />
  );
}
