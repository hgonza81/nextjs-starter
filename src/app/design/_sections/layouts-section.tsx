import {
  Sample,
  Section,
  ThemeGrid,
  ThemePanel,
  THEMES,
} from "@/app/design/_components/section";
import type { Theme } from "@/app/design/_lib/css-tokens";
import { FRAME_WIDTHS, FRAMES, frameHref } from "@/app/design/_lib/frames";

const FRAME_HEIGHT = 640;

function FramePreview({
  slug,
  title,
  width,
  theme,
}: {
  slug: (typeof FRAMES)[number]["slug"];
  title: string;
  width: number;
  theme: Theme;
}) {
  const label = `${title}, ${width}px wide, ${theme} theme`;

  return (
    <Sample label={`${title} at ${width}px`}>
      {/*
        The frame has a fixed width, so the page never overflows: the wrapper
        scrolls instead, and is focusable so keyboard users can scroll it.
      */}
      <div
        role="group"
        aria-label={`${label} (scrollable)`}
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-lg border border-border focus-ring"
      >
        <iframe
          title={label}
          src={frameHref(slug, theme)}
          width={width}
          height={FRAME_HEIGHT}
          loading="lazy"
          className="block max-w-none"
        />
      </div>
    </Sample>
  );
}

/**
 * Section 8 of the content spec. The auth layout and the app shell are
 * viewport-based, so they are embedded as iframes of fixed widths that load
 * the frame routes. PageHeader appears inside the app shell frame.
 */
export function LayoutsSection() {
  return (
    <Section
      id="layouts"
      title="Layouts"
      description="The real auth layout, app shell (with PageHeader) and loading page, each in a frame of a fixed width (375, 768 and 1280px) so the layout reacts to its own viewport. At 375px, open the drawer with the Open navigation button inside the app shell frame. The shell sample has a very long company name and two nav groups. The themes are stacked so each frame has the full page width; a frame wider than the page scrolls horizontally."
    >
      <ThemeGrid isStacked>
        {THEMES.map((theme) => (
          <ThemePanel key={theme} theme={theme}>
            {FRAMES.map(({ slug, title }) =>
              FRAME_WIDTHS.map((width) => (
                <FramePreview
                  key={`${slug}-${width}`}
                  slug={slug}
                  title={title}
                  width={width}
                  theme={theme}
                />
              )),
            )}
          </ThemePanel>
        ))}
      </ThemeGrid>
    </Section>
  );
}
