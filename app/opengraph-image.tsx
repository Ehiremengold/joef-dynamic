import { ImageResponse } from "next/og";

export const alt =
  "Joef Dynamic College — private school in Ikoyi, Lagos, Nursery to SS3";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#232d5e",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              width: "18px",
              height: "44px",
              background: "#d42027",
              borderRadius: "4px",
            }}
          />
          <div
            style={{
              color: "#ffffff",
              fontSize: "30px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            Joef Dynamic College
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              color: "#ffffff",
              fontSize: "88px",
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-3px",
            }}
          >
            Raising dynamic minds.
          </div>
          <div
            style={{
              marginTop: "24px",
              color: "#eac95e",
              fontSize: "34px",
              fontWeight: 600,
            }}
          >
            Private school in Ikoyi, Lagos · Nursery to SS3
          </div>
        </div>

        <div
          style={{
            display: "flex",
            color: "rgba(255,255,255,0.75)",
            fontSize: "26px",
          }}
        >
          Blended British &amp; Nigerian curriculum · Admissions open 2026/2027
        </div>
      </div>
    ),
    { ...size }
  );
}
