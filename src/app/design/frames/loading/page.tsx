import type { Metadata } from "next";

import { FrameTheme } from "@/app/design/_components/frame-theme";
import { SampleShell } from "@/app/design/_components/sample-shell";
import { parseFrameTheme } from "@/app/design/_lib/frames";
import { PageSkeleton } from "@/components/layout/page-skeleton";

export const metadata: Metadata = { title: "Design: loading page frame" };

/** A loading page: the app shell around PageSkeleton, for an iframe. */
export default async function LoadingFramePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string | string[] }>;
}) {
  const theme = parseFrameTheme((await searchParams).theme);

  return (
    <FrameTheme theme={theme}>
      <SampleShell activeFrame="loading" theme={theme}>
        <PageSkeleton />
      </SampleShell>
    </FrameTheme>
  );
}
