"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ActivityRow = {
  id: string; school_id: string | null; school_key: string | null; event: string; detail: string | null;
  amount: number | null; at: string; by_email: string | null; is_new: boolean;
};

const EVENT_ICON: Record<string, string> = {
  payment_confirmed: "✅", payment_rejected: "⚠️", payment_submitted: "💳",
  complaint_submitted: "🎫", complaint_reply: "🎫", complaint_resolved: "✔️",
  portal_pin_reset_requested: "🔑", portal_pin_changed_by_school: "🔑",
  document_sent: "📄", invoices_deleted_by_school: "🗑️",
  operator_added: "👤", operator_removed: "👤", factory_reset: "⚠️",
};

function eventLabel(event: string): string {
  return event.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function NotificationBell({ schoolNames }: { schoolNames: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  async function loadUnread() {
    const { data } = await supabase.rpc("get_unread_activity_count");
    setUnread(typeof data === "number" ? data : 0);
  }

  async function loadItems() {
    const { data } = await supabase.rpc("get_recent_activity", { p_limit: 30 });
    setItems((data as ActivityRow[]) ?? []);
  }

  useEffect(() => {
    loadUnread();
    const interval = setInterval(loadUnread, 60000); // refresh the badge every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      loadItems();
      if (unread > 0) {
        await supabase.rpc("mark_activity_seen");
        setUnread(0);
      }
    }
  }

  return (
    <div className="bellWrap" ref={boxRef}>
      <button className="bellBtn" onClick={toggle} aria-label="Notifications">
        🔔
        {unread > 0 && <span className="bellBadge">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <>
          <div className="bellBackdrop" onClick={() => setOpen(false)} />
          <div className="bellPanel">
            <div className="bellHead">
              Recent activity
              <button className="bellCloseMobile" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="bellList">
              {items === null ? (
                <p className="bellMuted">Loading…</p>
              ) : items.length === 0 ? (
                <p className="bellMuted">Nothing yet.</p>
              ) : items.map((it) => (
                <div key={it.id} className={`bellItem ${it.is_new ? "new" : ""}`}>
                  <span className="bellIcon">{EVENT_ICON[it.event] ?? "🔔"}</span>
                  <div className="bellItemBody">
                    <div className="bellItemTitle">
                      {eventLabel(it.event)}
                      {it.school_id && <span className="bellSchool"> · {schoolNames[it.school_id] ?? it.school_key}</span>}
                    </div>
                    {it.detail && <div className="bellItemDetail">{it.detail}</div>}
                    <div className="bellItemTime">{new Date(it.at).toLocaleString("en-GB")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .bellWrap { position: relative; }
        .bellBtn { position: relative; background: none; border: none; font-size: 19px; cursor: pointer; padding: 6px; }
        .bellBadge { position: absolute; top: 0; right: 0; background: var(--red); color: #fff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 999px; min-width: 16px; text-align: center; }
        .bellPanel {
          position: absolute; top: 100%; right: 0; margin-top: 8px; width: 340px; max-width: 90vw; max-height: 440px;
          background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm);
          box-shadow: 0 12px 32px rgba(15,20,32,0.18); z-index: 250; display: flex; flex-direction: column;
        }
        @media (max-width: 640px) {
          .bellPanel {
            position: fixed; top: auto; bottom: 0; left: 0; right: 0; margin-top: 0;
            width: 100%; max-width: 100%; max-height: 70vh;
            border-radius: 14px 14px 0 0; border: none;
            box-shadow: 0 -8px 28px rgba(15,20,32,0.22);
          }
        }
        .bellHead { font-size: 13px; font-weight: 700; color: var(--ink); padding: 12px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; }
        .bellCloseMobile { display: none; background: none; border: none; font-size: 15px; color: var(--muted); cursor: pointer; }
        .bellBackdrop { display: none; }
        @media (max-width: 640px) {
          .bellBackdrop { display: block; position: fixed; inset: 0; background: rgba(15,20,32,0.5); z-index: 240; }
          .bellCloseMobile { display: block; }
        }
        .bellList { overflow-y: auto; flex: 1; }
        .bellMuted { color: var(--muted); font-size: 13px; padding: 20px 14px; text-align: center; }
        .bellItem { display: flex; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); }
        .bellItem.new { background: var(--navy-soft); }
        .bellIcon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
        .bellItemTitle { font-size: 12.5px; font-weight: 600; color: var(--ink); }
        .bellSchool { font-weight: 400; color: var(--ink-2); }
        .bellItemDetail { font-size: 12px; color: var(--ink-2); margin-top: 2px; line-height: 1.4; }
        .bellItemTime { font-size: 10.5px; color: var(--muted); margin-top: 3px; }
      `}</style>
    </div>
  );
}
