import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MyCreditCardinal – Stop leaving rewards on the table.";
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
          alignItems: "flex-start",
          justifyContent: "center",
          background: "#0f1219",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "#059669",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: "700",
              color: "#ffffff",
            }}
          >
            M
          </div>
          <span
            style={{
              fontSize: "26px",
              fontWeight: "600",
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            MyCreditCardinal
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "700",
            color: "#ffffff",
            lineHeight: "1.1",
            letterSpacing: "-1.5px",
            marginBottom: "24px",
            maxWidth: "900px",
          }}
        >
          Stop leaving rewards{" "}
          <span style={{ color: "#059669" }}>on the table.</span>
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: "24px",
            color: "rgba(255,255,255,0.5)",
            fontWeight: "400",
            maxWidth: "700px",
            lineHeight: "1.5",
          }}
        >
          Find the best credit card for every purchase. Simulate your household
          spend and maximize every dollar.
        </div>

        {/* Bottom tags */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "56px",
          }}
        >
          {["Card Explorer", "Spend Simulator", "AI Optimizer"].map((tag) => (
            <div
              key={tag}
              style={{
                padding: "8px 18px",
                borderRadius: "100px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)",
                fontSize: "16px",
                fontWeight: "500",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
