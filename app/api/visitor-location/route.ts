import { NextRequest, NextResponse } from "next/server";

async function tryLookup(
  url: string,
  isSuccess: (data: any) => boolean,
  extract: (data: any) => { city: string | null; country: string | null }
): Promise<{ city: string | null; country: string | null } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!isSuccess(data)) return null;
    const { city, country } = extract(data);
    if (!city && !country) return null;
    return { city: city || null, country: country || null };
  } catch {
    return null;
  }
}

// Resolves the caller's IP address to a coarse city/country using a free
// geolocation lookup — entirely server-side. The raw IP is used only for
// this one lookup and is never returned to the client or written
// anywhere; only the resolved city/country ever leaves this route.
// Tries two independent providers in sequence, since either one can be
// unreliable or rate-limited on its own.
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

    const primary = await tryLookup(`https://ipwho.is/${ip}?fields=success,city,country`, (d) => d.success === true, (d) => ({ city: d.city, country: d.country }));
    if (primary) return NextResponse.json(primary);

    const fallback = await tryLookup(`https://ipapi.co/${ip}/json/`, (d) => !d.error, (d) => ({ city: d.city, country: d.country_name }));
    if (fallback) return NextResponse.json(fallback);

    return NextResponse.json({ city: null, country: null });
  } catch {
    // Any failure (timeout, network issue, rate limit) degrades gracefully —
    // tracking continues without a location rather than breaking the page.
    return NextResponse.json({ city: null, country: null });
  }
}
