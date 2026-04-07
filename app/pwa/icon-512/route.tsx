import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<CardinalIcon />, { width: 512, height: 512 });
}

function CardinalIcon() {
  return (
    <div
      style={{
        width: 512,
        height: 512,
        background: "#0f1219",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 96,
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
            fontSize: 280,
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
            fontSize: 60,
            fontWeight: 600,
            letterSpacing: 6,
            fontFamily: "sans-serif",
            marginTop: -12,
          }}
        >
          CC
        </span>
      </div>
    </div>
  );
}
