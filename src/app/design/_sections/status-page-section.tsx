import { Sample, Section, ThemePair } from "@/app/design/_components/section";
import { StatusPage } from "@/components/layout/status-page";
import { Button } from "@/components/ui/button";

/**
 * The `StatusPage` samples (PH-FR-04). Embedded, because the real pages fill
 * the viewport and own the `main` landmark. The home action is a plain
 * anchor, as in `global-error`, so no router is needed.
 */
export function StatusPageSection() {
  return (
    <Section
      id="status-page"
      title="Status page"
      description="The one layout behind the 500, global error and 404 pages. The reference code block is omitted when there is no code."
    >
      <ThemePair>
        <Sample label="With reference code and two actions (500, global error)">
          <StatusPage
            isEmbedded
            title="Something went wrong"
            description="We hit an unexpected problem. You can try again, or come back in a few minutes."
            referenceCode="1234567890"
            actions={
              <>
                <Button>Try again</Button>
                <Button asChild variant="outline">
                  <a href="/design">Go to home page</a>
                </Button>
              </>
            }
          />
        </Sample>
        <Sample label="Without reference code, one action (404)">
          <StatusPage
            isEmbedded
            title="Page not found"
            description="The page you're looking for doesn't exist or may have moved."
            actions={
              <Button asChild>
                <a href="/design">Go to home page</a>
              </Button>
            }
          />
        </Sample>
      </ThemePair>
    </Section>
  );
}
