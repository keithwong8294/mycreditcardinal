import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own corner mask, so the icon is a full square.
export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={180} radius={0} />, { ...size });
}
