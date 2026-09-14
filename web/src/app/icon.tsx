import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#2a2f36",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#d4af37",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.6,
        }}
      >
        CN
      </div>
    ),
    { ...size }
  );
}
