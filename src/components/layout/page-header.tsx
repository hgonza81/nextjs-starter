import type { ReactNode } from "react";

type PageHeaderProps = {
  /** The page `h1`: one per page. */
  title: string;
  description?: string;
  /**
   * Primary action slot. It wraps below the title on mobile; pass `w-full` on
   * a primary Button there if it should span the screen.
   */
  actions?: ReactNode;
};

/** Title row at the top of a page in the app shell (design system 5.2). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>
      ) : null}
    </div>
  );
}
