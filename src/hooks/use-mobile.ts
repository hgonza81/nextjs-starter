import { useSyncExternalStore } from "react";

// 48rem is Tailwind's `md` breakpoint, where the sidebar becomes permanent
// (design system 2.7). Kept in rem so it matches the CSS breakpoint exactly.
const DESKTOP_QUERY = "(min-width: 48rem)";

function subscribe(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(DESKTOP_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getSnapshot(): boolean {
  return !window.matchMedia(DESKTOP_QUERY).matches;
}

// The server cannot know the viewport. Reporting "not mobile" is safe: the
// only consumer (the drawer) starts closed, and the permanent sidebar is
// hidden below `md` by CSS regardless of this value.
function getServerSnapshot(): boolean {
  return false;
}

/** True below the `md` breakpoint, where navigation is a drawer. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
