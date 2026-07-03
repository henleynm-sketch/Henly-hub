import { NextResponse } from "next/server";
import { getBrandingConfig } from "@/lib/branding";

export const dynamic = "force-dynamic";

// Serves the CEO-configured background image bytes, or redirects to the bundled
// sample when none is set / the feature is disabled.
export async function GET(request: Request) {
  const cfg = await getBrandingConfig();
  if (cfg.backgroundEnabled && cfg.backgroundData && cfg.backgroundMime) {
    const bytes = Buffer.from(cfg.backgroundData, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": cfg.backgroundMime,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  }
  return NextResponse.redirect(new URL("/branding/sample-bg.jpg", request.url));
}
