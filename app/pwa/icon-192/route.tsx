import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<CardinalIcon />, { width: 192, height: 192 });
}

function CardinalIcon() {
  return (
    <div
      style={{
        width: 192,
        height: 192,
        background: "#0f1219",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 36,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#059669",
            fontSize: 100,
            fontWeight: 700,
            lineHeight: 1,
            fontFamily: "sans-serif",
          }}
        >
          M
        </span>
        <span
          style={{
            color: "#059669",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 2,
            fontFamily: "sans-serif",
            marginTop: -4,
          }}
        >
          CC
        </span>
      </div>
    </div>
  );
}
