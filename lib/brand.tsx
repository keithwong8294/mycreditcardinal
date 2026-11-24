/**
 * MyCreditCardinal brand mark ("C2"): a C whose top terminal is a cardinal
 * head (crest, black mask, orange beak) with a darker wing inside the curve.
 *
 * Plain SVG elements only, so it renders both in React and in next/og
 * ImageResponse (favicons, PWA icons, social cards).
 */

export const BRAND = {
  red: "#b3261e",
  redDark: "#7a1712",
  ink: "#1c1917",
  beak: "#f29e4c",
  paper: "#f6f3ee",
} as const;

const RING = "M40 13.5 A 22 22 0 1 0 50 47";
const WING = "M15 17 C7 24 5 36 10 46 L17 52 L15 46 L20 49 L16.5 42 C13 34 13.5 25 15 17Z";
const HEAD = "M36 10 L24 1 L38 5.5 L33 -1 L45 6.5 C50 7.5 53 11 53.5 14 L52 22 C48 26 42 26 39 23 Z";
const MASK = "M42 11 C46 9 51 10 53.5 14 L52.5 22 C49 24 45 23 43 20 C41.5 17 41 13.5 42 11Z";
const BEAK = "M52.5 13.5 L61.5 18 L52 22.5Z";

export type MarkVariant = "color" | "on-dark" | "mono";

interface MarkProps {
  size?: number;
  variant?: MarkVariant;
  /** Mono only: shape color and eye color. */
  color?: string;
  eye?: string;
  title?: string;
}

export function CardinalMark({
  size = 32,
  variant = "color",
  color = BRAND.red,
  eye = "#fff",
  title,
}: MarkProps) {
  const body = variant === "on-dark" ? "#fff" : variant === "mono" ? color : BRAND.red;
  const detailed = variant !== "mono";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -2 64 66"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={RING} fill="none" stroke={body} strokeWidth={10} />
      {detailed && <path d={WING} fill={variant === "on-dark" ? "#d9d4cc" : BRAND.redDark} />}
      <path d={HEAD} fill={body} />
      {detailed && <path d={MASK} fill={BRAND.ink} />}
      <path d={BEAK} fill={detailed ? BRAND.beak : body} />
      <circle cx={46.8} cy={14.6} r={2} fill={detailed ? "#fff" : eye} />
    </svg>
  );
}

/** Square app icon: white mark on brand red. `radius` 0 for maskable icons. */
export function AppIcon({ size, radius }: { size: number; radius: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: BRAND.red,
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CardinalMark size={Math.round(size * 0.68)} variant="mono" color="#fff" eye={BRAND.red} />
    </div>
  );
}
