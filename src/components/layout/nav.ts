import type { ReactNode } from "react";

/** One navigation entry of the app shell. */
export type NavItem = {
  href: string;
  label: string;
  /** A rendered, decorative icon, for example `<LayoutDashboard aria-hidden />`. */
  icon: ReactNode;
};

/** A labelled (or unlabelled) run of items; groups let the sidebar grow. */
export type NavGroup = {
  label?: string;
  items: readonly NavItem[];
};

/**
 * Whether `href` is the current page or an ancestor of it, so a section stays
 * highlighted on its detail pages. The root link only matches the root itself,
 * otherwise it would be active everywhere. Query strings and hashes are
 * ignored; a trailing slash does not matter.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  const current = normalizePath(pathname);
  const target = normalizePath(href);

  if (target === "/") {
    return current === "/";
  }
  return current === target || current.startsWith(`${target}/`);
}

function normalizePath(path: string): string {
  const withoutSuffix = path.split(/[?#]/, 1)[0] ?? "";
  return withoutSuffix.length > 1 && withoutSuffix.endsWith("/")
    ? withoutSuffix.slice(0, -1)
    : withoutSuffix;
}
