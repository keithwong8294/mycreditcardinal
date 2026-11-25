import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND, CardinalMark } from "@/lib/brand";

export const alt = "MyCreditCardinal: use the right card, every time.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same faces as the site (Instrument Serif + Outfit). Satori can't read
// woff2, so the TTFs are checked in under assets/fonts.
const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

export default async function OGImage() {
  const [serif, serifItalic, sans, sansSemi] = await Promise.all([
    font("InstrumentSerif-Regular.ttf"),
    font("InstrumentSerif-Italic.ttf"),
    font("Outfit-Regular.ttf"),
    font("Outfit-SemiBold.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BRAND.paper,
          padding: "72px 80px",
          fontFamily: "Outfit",
          color: BRAND.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <CardinalMark size={72} />
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em" }}>MyCreditCardinal</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Instrument Serif",
            fontSize: 104,
            lineHeight: 0.98,
            letterSpacing: "-0.02em",
          }}
        >
          <span>Use the right card.</span>
          <span style={{ color: BRAND.red, fontStyle: "italic" }}>Every time.</span>
        </div>
        <div style={{ fontSize: 28, color: "#57534e" }}>
          See which card to use for every purchase, and what a better wallet would earn.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serif, style: "normal", weight: 400 },
        { name: "Instrument Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Outfit", data: sans, style: "normal", weight: 400 },
        { name: "Outfit", data: sansSemi, style: "normal", weight: 600 },
      ],
    }
  );
}
