import { ImageResponse } from "next/og";
import { BRAND, CardinalMark } from "@/lib/brand";

export const alt = "MyCreditCardinal: use the right card, every time.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
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
          fontFamily: "serif",
          color: BRAND.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <CardinalMark size={72} />
          <span style={{ fontSize: 34, fontFamily: "sans-serif", fontWeight: 600 }}>
            MyCreditCardinal
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: 1.02 }}>
          <span>Use the right card.</span>
          <span style={{ color: BRAND.red, fontStyle: "italic" }}>Every time.</span>
        </div>
        <div style={{ fontSize: 26, fontFamily: "sans-serif", color: "#57534e" }}>
          See which card to use for every purchase, and what a better wallet would earn.
        </div>
      </div>
    ),
    size
  );
}
