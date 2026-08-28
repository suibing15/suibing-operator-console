"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const DISMISS_KEY = "suibing_broadcast_dismissed_message";

export default function BroadcastBar() {
  const [data, setData] = useState<{ message: string; link_url: string | null; link_label: string | null } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase.rpc("get_broadcast_banner").then(({ data: rows }) => {
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (row?.message) {
        setData(row);
        // Dismissal is remembered per exact message — if the operator posts
        // a new one, it shows again even if an earlier one was dismissed.
        const dismissedMsg = typeof window !== "undefined" ? sessionStorage.getItem(DISMISS_KEY) : null;
        setDismissed(dismissedMsg === row.message);
      }
    });
  }, []);

  if (!data || dismissed) return null;

  function dismiss() {
    if (typeof window !== "undefined" && data) sessionStorage.setItem(DISMISS_KEY, data.message);
    setDismissed(true);
  }

  return (
    <div className="bbar">
      <div className="bbarInner">
        <span className="bbarText">{data.message}</span>
        {data.link_url && (
          <a href={data.link_url} target="_blank" rel="noopener noreferrer" className="bbarLink">
            {data.link_label || "Learn more"} →
          </a>
        )}
      </div>
      <button className="bbarClose" onClick={dismiss} aria-label="Dismiss">✕</button>
      <style jsx>{`
        .bbar {
          position: sticky; top: 0; z-index: 500;
          background: linear-gradient(90deg, #1F3864, #2E75B6);
          color: #fff;
          padding: 10px 44px 10px 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13.5px;
          box-shadow: 0 2px 10px rgba(15,20,32,0.15);
        }
        .bbarInner {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap; justify-content: center; text-align: center;
        }
        .bbarText { font-weight: 600; }
        .bbarLink {
          color: #fff; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap;
        }
        .bbarClose {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: rgba(255,255,255,0.15); border: none; color: #fff; width: 22px; height: 22px;
          border-radius: 50%; cursor: pointer; font-size: 12px; line-height: 1; display: flex; align-items: center; justify-content: center;
        }
        .bbarClose:hover { background: rgba(255,255,255,0.28); }
        @media (max-width: 560px) {
          .bbar { padding: 10px 40px 10px 12px; }
          .bbarText { font-size: 12.5px; }
        }
      `}</style>
    </div>
  );
}
