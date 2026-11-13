import { LayoutDashboard } from "lucide-react";

import { FieldSample } from "@/app/design/_components/field-sample";
import { Sample, Section, ThemePair } from "@/app/design/_components/section";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Section 9 of the content spec: the patterns built from the components. */
export function PatternsSection() {
  return (
    <Section
      id="patterns"
      title="Patterns"
      description="Recipes made only from the components above."
    >
      <ThemePair>
        <Sample label="Empty state (a pattern, not a component)">
          <Card className="items-center text-center">
            <LayoutDashboard
              className="size-6 text-muted-foreground"
              aria-hidden
            />
            <div className="flex flex-col gap-2">
              <h4 className="text-lg font-semibold">Your dashboard is empty</h4>
              <p className="max-w-xs text-sm text-muted-foreground">
                Add your first project to see it here.
              </p>
            </div>
            <Button>Add project</Button>
          </Card>
        </Sample>
        <Sample label="Form-level error Alert above the first field">
          <form noValidate className="flex flex-col gap-6">
            <Alert variant="destructive">
              <AlertDescription>
                We could not log you in. Check your email and password and try
                again.
              </AlertDescription>
            </Alert>
            <FieldSample label="Email" defaultValue="name@company.com" />
            <Button className="w-full">Log in</Button>
          </form>
        </Sample>
        <Sample label="Skeleton loading page">
          <PageSkeleton />
        </Sample>
      </ThemePair>
    </Section>
  );
}
