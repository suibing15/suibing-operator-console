"use client";
import { useState } from "react";

export type ReviewStatus = "pending" | "needs_correction" | "rejected" | "approved";

export const STATUS_BADGE: Record<ReviewStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "pend" },
  needs_correction: { label: "Needs correction", cls: "corr" },
  rejected: { label: "Rejected", cls: "rej" },
  approved: { label: "Approved", cls: "appr" },
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const b = STATUS_BADGE[status];
  return (
    <span className={`badge ${b.cls}`}>
      {b.label}
      <style jsx>{`
        .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 9px; border-radius: 999px; }
        .pend { background: #FBF0DC; color: var(--amber); }
        .corr { background: #FBF0DC; color: var(--amber); }
        .rej { background: var(--red-soft); color: var(--red); }
        .appr { background: var(--green-soft); color: var(--green); }
      `}</style>
    </span>
  );
}

// Small reason-prompt modal used for both "reject" and "request correction"
export function ReasonModal({ title, actionLabel, onCancel, onSubmit, busy }: {
  title: string; actionLabel: string; busy: boolean;
  onCancel: () => void; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="x" onClick={onCancel} type="button">✕</button>
        </div>
        <label>Reason (shown to the applicant)</label>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <div className="mf">
          <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn danger" type="button" disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}>
            {busy ? "Saving…" : actionLabel}
          </button>
        </div>
        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); }
          .modal { width: 100%; max-width: 440px; padding: 24px; box-shadow: 0 20px 60px rgba(15,20,32,0.35); }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; line-height: 1; padding: 2px; }
          .x:hover { color: var(--ink); }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
          textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; }
          textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        `}</style>
      </div>
    </div>
  );
}

// Lightweight success/error toast shown briefly after an action completes.
export function Toast({ kind, message, onDone }: { kind: "success" | "error"; message: string; onDone: () => void }) {
  useState(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  });
  return (
    <div className={`toast ${kind}`}>
      <span className="icon">{kind === "success" ? "✓" : "!"}</span>
      <span>{message}</span>
      <style jsx>{`
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 400;
          display: flex; align-items: center; gap: 10px; padding: 13px 20px; border-radius: 999px;
          font-size: 14px; font-weight: 600; box-shadow: 0 12px 32px rgba(15,20,32,0.25); color: #fff;
          animation: rise 0.25s ease-out; }
        .toast.success { background: var(--green); }
        .toast.error { background: var(--red); }
        .icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.25); font-size: 12px; }
        @keyframes rise { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}
