/** WCAG 2.2 relative luminance and contrast ratio for sRGB hex colors. */

const HEX_COLOR = /^#([0-9a-f]{6})$/i;

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Returns the luminance of `#rrggbb`, or `undefined` for any other syntax. */
export function relativeLuminance(hex: string): number | undefined {
  const match = HEX_COLOR.exec(hex.trim());
  if (match?.[1] === undefined) {
    return undefined;
  }
  const rgb = Number.parseInt(match[1], 16);
  const red = channelToLinear((rgb >> 16) & 0xff);
  const green = channelToLinear((rgb >> 8) & 0xff);
  const blue = channelToLinear(rgb & 0xff);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/**
 * Contrast ratio (1 to 21) between two `#rrggbb` colors, or `undefined` when
 * either is not a plain hex color (for example the translucent overlay).
 */
export function contrastRatio(
  firstHex: string,
  secondHex: string,
): number | undefined {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  if (first === undefined || second === undefined) {
    return undefined;
  }
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
