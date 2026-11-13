import type { ReactNode } from "react";

import type { Theme } from "@/app/design/_lib/css-tokens";

/**
 * Forces the theme of a frame page when `?theme=` is given, with the same
 * `data-theme` mechanism as the panels on `/design`. Without a theme the page
 * follows the system. Portals (the mobile drawer) render outside this wrapper
 * and follow the system theme.
 */
export function FrameTheme({
  theme,
  children,
}: {
  theme: Theme | undefined;
  children: ReactNode;
}) {
  return theme === undefined ? (
    children
  ) : (
    <div data-theme={theme}>{children}</div>
  );
}
