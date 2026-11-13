import { CircleAlert, CircleCheck } from "lucide-react";

import {
  Section,
  Subsection,
  ThemeGrid,
  ThemePanel,
  THEMES,
} from "@/app/design/_components/section";
import { contrastRatio } from "@/app/design/_lib/contrast";
import type { Theme, TokenValues } from "@/app/design/_lib/css-tokens";
import { readTokenValues, TOKEN_FILE } from "@/app/design/_lib/read-tokens";
import {
  CONTRAST_PAIRS,
  TOKEN_GROUPS,
  type ContrastPair,
  type SwatchToken,
} from "@/app/design/_lib/token-catalog";
import { cn } from "@/lib/utils";

const SWATCH_CLASS_BY_TOKEN = new Map(
  TOKEN_GROUPS.flatMap((group) =>
    group.tokens.map((entry) => [entry.token, entry.swatchClass] as const),
  ),
);

function TokenSwatch({
  entry,
  values,
}: {
  entry: SwatchToken;
  values: TokenValues | undefined;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "size-10 shrink-0 rounded-md border border-border",
          entry.swatchClass,
        )}
      />
      <div className="min-w-0 text-sm">
        <code className="font-mono break-all">{entry.token}</code>
        <p className="text-xs break-all text-muted-foreground">
          Light {values?.light ?? "unknown"}, dark {values?.dark ?? "unknown"}
        </p>
      </div>
    </li>
  );
}

function PairSample({ pair }: { pair: ContrastPair }) {
  if (pair.minimum === 4.5) {
    return (
      <span
        aria-hidden
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-md border border-border text-sm font-medium",
          pair.sampleClass,
        )}
      >
        Aa
      </span>
    );
  }
  // A 3:1 pair is a UI boundary or indicator, so it is drawn as a bar.
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md border border-border",
        SWATCH_CLASS_BY_TOKEN.get(pair.background),
      )}
    >
      <span
        className={cn(
          "h-1 w-6 rounded-full",
          SWATCH_CLASS_BY_TOKEN.get(pair.foreground),
        )}
      />
    </span>
  );
}

function ContrastRow({
  pair,
  theme,
  tokens,
}: {
  pair: ContrastPair;
  theme: Theme;
  tokens: ReadonlyMap<string, TokenValues>;
}) {
  const foreground = tokens.get(pair.foreground)?.[theme];
  const background = tokens.get(pair.background)?.[theme];
  const ratio =
    foreground === undefined || background === undefined
      ? undefined
      : contrastRatio(foreground, background);
  const passes = ratio !== undefined && ratio >= pair.minimum;
  const MarkIcon = passes ? CircleCheck : CircleAlert;

  return (
    <li className="flex items-center gap-3">
      <PairSample pair={pair} />
      <div className="min-w-0 text-sm">
        <p className="break-words">
          <code className="font-mono">{pair.foreground}</code> on{" "}
          <code className="font-mono">{pair.background}</code>
        </p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MarkIcon
            className={cn(
              "size-4 shrink-0",
              passes ? "text-success" : "text-destructive",
            )}
            aria-hidden
          />
          {ratio === undefined ? "n/a" : `${ratio.toFixed(2)}:1`}, needs{" "}
          {pair.minimum}:1: {passes ? "pass" : "FAIL"}
        </p>
      </div>
    </li>
  );
}

/** Section 2 of the content spec: every color token and its contrast pairs. */
export async function ColorSection() {
  const tokens = await readTokenValues();

  return (
    <Section
      id="color"
      title="Color"
      description={
        <>
          Every color token with its light and dark value, read live from{" "}
          <code className="font-mono">{TOKEN_FILE}</code>, followed by the
          measured contrast of each documented pair (4.5:1 for text, 3:1 for
          component boundaries and focus indicators).
        </>
      }
    >
      <ThemeGrid>
        {THEMES.map((theme) => (
          <ThemePanel key={theme} theme={theme}>
            {TOKEN_GROUPS.map((group) => (
              <Subsection key={group.title} title={group.title}>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {group.tokens.map((entry) => (
                    <TokenSwatch
                      key={entry.token}
                      entry={entry}
                      values={tokens.get(entry.token)}
                    />
                  ))}
                </ul>
              </Subsection>
            ))}
            <Subsection title="Contrast pairs">
              <ul className="flex flex-col gap-3">
                {CONTRAST_PAIRS.map((pair) => (
                  <ContrastRow
                    key={`${pair.foreground}-${pair.background}-${pair.minimum}`}
                    pair={pair}
                    theme={theme}
                    tokens={tokens}
                  />
                ))}
              </ul>
            </Subsection>
          </ThemePanel>
        ))}
      </ThemeGrid>
    </Section>
  );
}
