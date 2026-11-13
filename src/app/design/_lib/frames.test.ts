import { describe, expect, it } from "vitest";

import { frameHref, parseFrameTheme } from "@/app/design/_lib/frames";

describe("frame helpers", () => {
  it("FND-FR-17: builds a frame URL with and without a theme", () => {
    expect(frameHref("auth")).toBe("/design/frames/auth");
    expect(frameHref("app-shell", "dark")).toBe(
      "/design/frames/app-shell?theme=dark",
    );
  });

  it.each(["light", "dark"])("FND-FR-17: accepts the theme %s", (theme) => {
    expect(parseFrameTheme(theme)).toBe(theme);
  });

  it.each([undefined, "", "sepia", ["dark", "light"], 3])(
    "FND-FR-17: treats %j as follow-the-system",
    (value) => {
      expect(parseFrameTheme(value)).toBeUndefined();
    },
  );
});
