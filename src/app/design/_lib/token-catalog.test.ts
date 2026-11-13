import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/app/design/_lib/contrast";
import { parseTokenValues } from "@/app/design/_lib/css-tokens";
import { CONTRAST_PAIRS, TOKEN_GROUPS } from "@/app/design/_lib/token-catalog";

const tokens = parseTokenValues(
  readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8"),
);
const catalogued = new Set(
  TOKEN_GROUPS.flatMap((group) => group.tokens.map((entry) => entry.token)),
);

describe("/design token catalog", () => {
  it("FND-FR-17: lists every color token of globals.css and nothing else", () => {
    // `--color-*` entries are the Tailwind aliases of the same tokens.
    const declared = [...tokens.keys()].filter(
      (name) => !name.startsWith("--color-"),
    );

    expect([...catalogued].sort()).toEqual(declared.sort());
  });

  it("FND-FR-17: every contrast pair references known tokens", () => {
    for (const pair of CONTRAST_PAIRS) {
      expect(catalogued, pair.foreground).toContain(pair.foreground);
      expect(catalogued, pair.background).toContain(pair.background);
    }
  });

  it.each(["light", "dark"] as const)(
    "FND-NFR-03: every documented pair meets its WCAG threshold in the %s theme",
    (theme) => {
      for (const pair of CONTRAST_PAIRS) {
        const foreground = tokens.get(pair.foreground)?.[theme];
        const background = tokens.get(pair.background)?.[theme];
        const ratio =
          foreground === undefined || background === undefined
            ? undefined
            : contrastRatio(foreground, background);

        expect(
          ratio,
          `${pair.foreground} on ${pair.background} (${theme})`,
        ).toBeGreaterThanOrEqual(pair.minimum);
      }
    },
  );
});
