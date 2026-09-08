import { NextRequest, NextResponse } from "next/server";

// Resolves the caller's IP address to a coarse city/country using a free
// geolocation lookup — entirely server-side. The raw IP is used only for
// this one lookup and is never returned to the client or written
// anywhere; only the resolved city/country ever leaves this route.
export async function GET(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

    // Local/dev requests have no real public IP — return unknown rather
    // than querying a lookup service with an empty or private address.
    if (!ip || ip.startsWith("127.") || ip.startsWith("::1") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
      return NextResponse.json({ city: null, country: null });
    }

    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return NextResponse.json({ city: null, country: null });

    const data = await res.json();
    if (data.status !== "success") return NextResponse.json({ city: null, country: null });

    return NextResponse.json({ city: data.city || null, country: data.country || null });
  } catch {
    // Any failure (timeout, network issue, rate limit) degrades gracefully —
    // tracking continues without a location rather than breaking the page.
    return NextResponse.json({ city: null, country: null });
  }
}
