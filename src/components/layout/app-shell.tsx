import type { ReactNode } from "react";

import { Wordmark } from "@/components/brand/wordmark";
import { AppShellNav } from "@/components/layout/app-shell-nav";
import type { NavGroup } from "@/components/layout/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const MAIN_CONTENT_ID = "main-content";

type AppShellProps = {
  /** Plain text in epic 001; truncates with an ellipsis when long. */
  companyName: string;
  navGroups: readonly NavGroup[];
  /**
   * The user menu slot, right side of the top bar. Epic 002 puts a ghost
   * "Log out" Button here (design system 5.2).
   */
  userMenu?: ReactNode;
  /** Overrides the browser path for the active nav item (showcase, tests). */
  activePath?: string;
  /** The page: normally a `PageHeader` followed by the content. */
  children: ReactNode;
};

/**
 * The layout of every signed-in page (design system 5.2): permanent sidebar
 * from `md`, drawer below, sticky top bar, `main` content area. It holds no
 * data and no auth: callers pass everything in through props and slots.
 */
export function AppShell({
  companyName,
  navGroups,
  userMenu,
  activePath,
  children,
}: AppShellProps) {
  return (
    <SidebarProvider>
      {/* First focusable element; visible only while focused. */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-md focus:not-sr-only focus:fixed focus:px-4 focus:py-2 focus:top-4 focus:left-4 focus:z-toast focus-ring"
      >
        Skip to main content
      </a>
      <Sidebar drawerTitle="Navigation">
        <SidebarHeader closeLabel="Close navigation">
          <Wordmark />
        </SidebarHeader>
        <SidebarContent>
          <AppShellNav groups={navGroups} activePath={activePath} />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-sticky flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:px-6 lg:px-8">
          <SidebarTrigger aria-label="Open navigation" />
          <p className="min-w-0 flex-1 truncate font-medium">{companyName}</p>
          {userMenu ? <div className="shrink-0">{userMenu}</div> : null}
        </header>
        <main
          id={MAIN_CONTENT_ID}
          // Focus target of the skip link; the region itself is not interactive.
          tabIndex={-1}
          className="w-full max-w-7xl flex-1 px-4 py-6 outline-none md:px-6 md:py-8 lg:px-8"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
