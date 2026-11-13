import type { Metadata } from "next";

import { FrameTheme } from "@/app/design/_components/frame-theme";
import { SampleShell } from "@/app/design/_components/sample-shell";
import { parseFrameTheme } from "@/app/design/_lib/frames";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Design: app shell frame" };

/** The real AppShell and PageHeader with sample slot content, for an iframe. */
export default async function AppShellFramePage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string | string[] }>;
}) {
  const theme = parseFrameTheme((await searchParams).theme);

  return (
    <FrameTheme theme={theme}>
      <SampleShell activeFrame="app-shell" theme={theme}>
        <PageHeader
          title="Quarterly revenue and subscription report for every region"
          description="Sample page header with a description and two actions."
          actions={
            <>
              <Button variant="outline">Export</Button>
              <Button>New report</Button>
            </>
          }
        />
        <div className="flex flex-col gap-6">
          <Alert variant="info">
            <AlertTitle>Sample content</AlertTitle>
            <AlertDescription>
              The shell, top bar and page header are the real components.
            </AlertDescription>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Content area</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pages render inside the main landmark.
              </p>
            </CardContent>
          </Card>
        </div>
      </SampleShell>
    </FrameTheme>
  );
}
