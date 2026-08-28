"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function BroadcastAdmin({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_broadcast_banner_admin").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setMessage(row.message ?? "");
        setLinkUrl(row.link_url ?? "");
        setLinkLabel(row.link_label ?? "");
        setIsActive(!!row.is_active);
        setUpdatedAt(row.updated_at ?? null);
      }
    });
  }, []);

  async function save(activate: boolean) {
    setErr(null); setMsg(null);
    if (activate && !message.trim()) { setErr("Enter a message before activating the banner."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("set_broadcast_banner", {
      p_message: message, p_link_url: linkUrl, p_link_label: linkLabel, p_is_active: activate,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setIsActive(activate);
    setMsg(activate ? "Banner is now live on all public pages." : "Banner turned off.");
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>Broadcast announcement</h3>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>
        <p className="hint">
          Shown as a bar at the top of the public website, application forms, and invoice lookup — not in the console
          or school portal.
          {isActive && <span className="liveTag"> ● Live now</span>}
        </p>

        <label>Message</label>
        <textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Our offices will be closed for Eid from 20–23 June." />

        <label>Link URL (optional)</label>
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />

        <label>Link label (optional)</label>
        <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Learn more" />

        {message.trim() && (
          <div className="preview">
            <div className="previewLabel">Preview</div>
            <div className="previewBar">
              <span>{message}</span>
              {linkUrl.trim() && <a>{linkLabel.trim() || "Learn more"} →</a>}
            </div>
          </div>
        )}

        {err && <div className="err">{err}</div>}
        {msg && <div className="msgOk">{msg}</div>}

        <div className="mf">
          {isActive ? (
            <button className="btn ghost" type="button" onClick={() => save(false)} disabled={busy}>
              {busy ? "…" : "Turn off"}
            </button>
          ) : (
            <button className="btn ghost" type="button" onClick={onClose}>Close</button>
          )}
          <button className="btn ok" type="button" onClick={() => save(true)} disabled={busy}>
            {busy ? "Saving…" : isActive ? "Update live banner" : "Post & activate"}
          </button>
        </div>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 480px; padding: 26px; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .hint { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin-bottom: 16px; }
          .liveTag { color: var(--green); font-weight: 700; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 6px; }
          input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; resize: vertical; }
          .preview { margin-top: 16px; }
          .previewLabel { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
          .previewBar { background: linear-gradient(90deg, #1F3864, #2E75B6); color: #fff; border-radius: 8px; padding: 10px 14px; font-size: 13px; font-weight: 600; display: flex; gap: 12px; align-items: center; justify-content: center; text-align: center; flex-wrap: wrap; }
          .previewBar a { color: #fff; text-decoration: underline; font-weight: 700; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
          .msgOk { color: var(--green); font-size: 13px; margin-top: 12px; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        `}</style>
      </div>
    </div>
  );
}
