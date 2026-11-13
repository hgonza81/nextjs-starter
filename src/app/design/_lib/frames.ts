import { z } from "zod";

import type { Theme } from "@/app/design/_lib/css-tokens";

/** Viewport widths the layouts are shown at (design system 2.7 and 12.2). */
export const FRAME_WIDTHS = [375, 768, 1280] as const;

export const FRAMES = [
  { slug: "auth", title: "Auth layout" },
  { slug: "app-shell", title: "App shell" },
  { slug: "loading", title: "Loading page" },
] as const;

export type FrameSlug = (typeof FRAMES)[number]["slug"];

/** URL of a frame page. The theme is optional: without it the frame follows the system. */
export function frameHref(slug: FrameSlug, theme?: Theme): string {
  const base = `/design/frames/${slug}`;
  return theme === undefined ? base : `${base}?theme=${theme}`;
}

const frameThemeSchema = z.enum(["light", "dark"]).optional().catch(undefined);

/** Reads the `theme` search param of a frame; anything unknown means "follow the system". */
export function parseFrameTheme(value: unknown): Theme | undefined {
  return frameThemeSchema.parse(value);
}
