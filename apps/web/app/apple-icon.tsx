import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3d55d9",
          borderRadius: 40,
          color: "#fff",
          fontSize: 110,
          fontWeight: 700,
        }}
      >
        W
      </div>
    ),
    { ...size },
  );
}
