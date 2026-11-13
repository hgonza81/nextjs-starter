import type { ReactNode } from "react";

type PageHeaderProps = {
  /** The page `h1`: one per page. */
  title: string;
  description?: string;
  /**
   * Primary action slot. It wraps below the title on mobile, where each
   * direct child (a Button) is full width; from `md` up it sits to the right
   * at its natural width.
   */
  actions?: ReactNode;
};

/** Title row at the top of a page in the app shell (design system 5.2). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight break-words">
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-3 *:w-full md:*:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
