"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, type NavGroup } from "@/components/layout/nav";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type AppShellNavProps = {
  groups: readonly NavGroup[];
  /** Overrides the browser path (used where the shell is shown out of place). */
  activePath?: string;
};

/** The `<nav aria-label="Main">` landmark of the shell (design system 5.2). */
export function AppShellNav({ groups, activePath }: AppShellNavProps) {
  const pathname = usePathname();
  const currentPath = activePath ?? pathname;

  return (
    <nav aria-label="Main" className="flex flex-col gap-6">
      {groups.map((group, groupIndex) => (
        <SidebarGroup key={group.label ?? groupIndex}>
          {group.label ? (
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          ) : null}
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isNavItemActive(currentPath, item.href)}
                >
                  <Link href={item.href}>
                    {item.icon}
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </nav>
  );
}
