import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/brand";

export const dynamic = "force-static";

// Full-bleed square so it also works as a maskable icon; the mark sits
// inside the 80% safe zone.
export async function GET() {
  return new ImageResponse(<AppIcon size={512} radius={0} />, { width: 512, height: 512 });
}
