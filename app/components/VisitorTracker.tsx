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
// anonymous — no IP, no device fingerprint, just a random per-tab
// session id (reset on every new browser session) plus the path and
// referrer. Never blocks or slows the page; any failure is ignored.
export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    supabase.rpc("log_page_view", {
      p_path: pathname,
      p_referrer: typeof document !== "undefined" ? document.referrer || null : null,
      p_session_id: sessionId,
    }).then(() => {}, () => {});
  }, [pathname]);

  return null;
}
