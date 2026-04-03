import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cardGradient(colorJson: string[]): string {
  if (colorJson.length >= 3)
    return `linear-gradient(135deg, ${colorJson[0]}, ${colorJson[1]}, ${colorJson[2]})`;
  if (colorJson.length === 2)
    return `linear-gradient(135deg, ${colorJson[0]}, ${colorJson[1]})`;
  return "linear-gradient(135deg, #1a1a2e, #2d2d5e)";
}

/** Parse a hex color string to [r, g, b] (0–255). Returns null for invalid input. */
function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

/**
 * Returns true if the card gradient colors are light enough to warrant dark text.
 * Averages the perceived luminance of all color stops; threshold > 160.
 */
export function isLightBackground(colorJson: string[]): boolean {
  if (colorJson.length === 0) return false;
  let total = 0;
  let count = 0;
  for (const hex of colorJson) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    // Perceived luminance (weighted average)
    total += 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    count++;
  }
  if (count === 0) return false;
  return total / count > 160;
}
