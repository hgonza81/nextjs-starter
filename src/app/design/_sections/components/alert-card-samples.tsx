import {
  Sample,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";

const VARIANTS = ["info", "success", "warning", "destructive"] as const;

const LONG_TEXT =
  "We could not finish this request because the service took too long to answer. Nothing was changed. Check your connection and try again in a few minutes, or contact support if it keeps happening.";

/** Design system 4.6. Alerts are static: no hover, focus or loading state. */
export function AlertSamples() {
  return (
    <Subsection
      title="Alert"
      description="Persistent, inline and never the only place a message appears."
    >
      <ThemePair>
        <Sample label="Four variants, with a title">
          <div className="flex flex-col gap-3">
            {VARIANTS.map((variant) => (
              <Alert key={variant} variant={variant}>
                <AlertTitle>{variant} with title</AlertTitle>
                <AlertDescription>
                  A short description of what happened.
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </Sample>
        <Sample label="Four variants, without a title">
          <div className="flex flex-col gap-3">
            {VARIANTS.map((variant) => (
              <Alert key={variant} variant={variant}>
                <AlertDescription>{variant} without a title.</AlertDescription>
              </Alert>
            ))}
          </div>
        </Sample>
        <Sample label="With a link">
          <div className="flex flex-col gap-3">
            {VARIANTS.map((variant) => (
              <Alert key={variant} variant={variant}>
                <AlertDescription>
                  A {variant} notice with a link.{" "}
                  <TextLink href="#components">Read more</TextLink>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </Sample>
        <Sample label="Long text (wraps)">
          <Alert variant="destructive">
            <AlertTitle>The request could not be completed</AlertTitle>
            <AlertDescription>{LONG_TEXT}</AlertDescription>
          </Alert>
        </Sample>
      </ThemePair>
    </Subsection>
  );
}

/** Design system 4.7. Cards are static. */
export function CardSamples() {
  return (
    <Subsection
      title="Card"
      description="Header, content and footer parts; the title is a real heading."
    >
      <ThemePair>
        <Sample label="Header, content and footer">
          <Card>
            <CardHeader>
              <CardTitle as="h3">Company details</CardTitle>
              <CardDescription>
                Shown on invoices and in the app header.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">Northwind Traders</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Cancel</Button>
              <Button>Save changes</Button>
            </CardFooter>
          </Card>
        </Sample>
        <Sample label="Long title and content (wrap, never widen the card)">
          <Card>
            <CardHeader>
              <CardTitle as="h3">
                Northwind Traders International Holdings and Logistics
                Cooperative, Limited
              </CardTitle>
              <CardDescription>
                An unusually long description that goes on for a while to prove
                it wraps inside the card.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm break-words">
                averyveryverylongunbrokenwordthatwouldnormallyforcethecardtobewiderthanitscontainerifnotwrapped
              </p>
            </CardContent>
          </Card>
        </Sample>
      </ThemePair>
    </Subsection>
  );
}
