import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state for a page in the app shell (design system 5.2): a skeleton
 * page header and a skeleton card. The region is the one place that tells
 * assistive technology about the loading: `aria-busy` plus a single hidden
 * "Loading..." (the skeleton blocks themselves are hidden).
 */
export function PageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading...</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Card className="gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </Card>
    </div>
  );
}
