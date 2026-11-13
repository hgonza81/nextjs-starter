import { LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";

import { frameHref, type FrameSlug } from "@/app/design/_lib/frames";
import type { Theme } from "@/app/design/_lib/css-tokens";
import { AppShell } from "@/components/layout/app-shell";
import type { NavGroup } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";

const COMPANY_NAME =
  "Northwind Traders International Holdings and Logistics Cooperative, Limited";

// Items point at the other frames so a click never leaves the showcase.
function buildNavGroups(theme: Theme | undefined): readonly NavGroup[] {
  const icon = <LayoutDashboard className="size-5" aria-hidden />;
  return [
    {
      label: "Company",
      items: [
        { href: frameHref("app-shell", theme), label: "Dashboard", icon },
        { href: frameHref("loading", theme), label: "Reports", icon },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: frameHref("auth", theme), label: "Sign-in preview", icon },
      ],
    },
  ];
}

/**
 * The real AppShell with a very long company name, two nav groups and a
 * stand-in user menu. `activePath` is the override that marks an item active
 * although the browser path is a frame route (design system 5.2).
 */
export function SampleShell({
  activeFrame,
  theme,
  children,
}: {
  activeFrame: FrameSlug;
  theme: Theme | undefined;
  children: ReactNode;
}) {
  return (
    <AppShell
      companyName={COMPANY_NAME}
      navGroups={buildNavGroups(theme)}
      userMenu={
        <Button variant="outline" size="sm">
          User menu
        </Button>
      }
      activePath={frameHref(activeFrame)}
    >
      {children}
    </AppShell>
  );
}
