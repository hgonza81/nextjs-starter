import {
  Sample,
  Subsection,
  ThemePair,
} from "@/app/design/_components/section";
import { ToastTriggers } from "@/app/design/_components/toast-triggers";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";

/** Design system 4.8. */
export function SpinnerSkeletonSamples() {
  return (
    <Subsection
      title="Spinner and Skeleton"
      description="Under prefers-reduced-motion the spinner is static and the skeleton does not pulse. Loading is never shown by motion alone: standalone spinners are named Loading and skeleton regions carry one hidden Loading… text."
    >
      <ThemePair>
        <Sample label="Spinner sizes: sm (16), md (20), lg (24)">
          <div className="flex items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
          </div>
        </Sample>
        <Sample label="Skeleton shapes: page header, then card">
          <div aria-busy="true" className="flex flex-col gap-4">
            <span className="sr-only">Loading…</span>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border p-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </Sample>
      </ThemePair>
    </Subsection>
  );
}

/** Design system 4.9. One provider, mounted in the root layout. */
export function ToastSamples() {
  return (
    <Subsection
      title="Toast (Sonner)"
      description="These buttons fire each toast type through the single provider in the root layout. Toasts follow the page theme, not the panel."
    >
      <ThemePair>
        <Sample label="Triggers">
          <ToastTriggers />
        </Sample>
      </ThemePair>
    </Subsection>
  );
}

/** Design system 4.10. Hover is a live state. */
export function LinkSamples() {
  return (
    <Subsection
      title="Link"
      description="Always underlined. Hover and focus-visible are live."
    >
      <ThemePair>
        <Sample label="Default">
          <p className="text-sm">
            <TextLink href="#components">A standalone link</TextLink>
          </p>
        </Sample>
        <Sample label="In running text">
          <p className="max-w-prose text-base">
            Already have an account?{" "}
            <TextLink href="#components">Log in</TextLink> to continue where you
            left off.
          </p>
        </Sample>
        <Sample label="Inside an alert">
          <Alert variant="info">
            <AlertDescription>
              Your trial ends soon.{" "}
              <TextLink href="#components">See plans</TextLink>
            </AlertDescription>
          </Alert>
        </Sample>
      </ThemePair>
    </Subsection>
  );
}
