"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const SESSION_KEY = "suibing_visitor_session";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

// Silently logs a page view for basic traffic stats. Deliberately
// avoids storing anything that identifies an individual device or
// person: no IP address is ever stored (only used momentarily,
// server-side, to resolve a coarse city/country), no device
// fingerprint — just a random per-tab session id (reset on every new
// browser session) plus the path, referrer, and resolved location.
// Never blocks or slows the page; any failure is ignored.
export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;

    (async () => {
      let city: string | null = null;
      let country: string | null = null;
      try {
        const res = await fetch("/api/visitor-location");
        if (res.ok) {
          const loc = await res.json();
          city = loc.city ?? null;
          country = loc.country ?? null;
        }
      } catch {
        // Location is a nice-to-have — proceed without it if this fails.
      }
      supabase.rpc("log_page_view", {
        p_path: pathname,
        p_referrer: typeof document !== "undefined" ? document.referrer || null : null,
        p_session_id: sessionId,
        p_city: city,
        p_country: country,
      }).then(() => {}, () => {});
    })();
  }, [pathname]);

  return null;
}
