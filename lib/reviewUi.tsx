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
    <div className="overlay" onClick={onCancel}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <label>Reason (shown to the applicant)</label>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        <div className="mf">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" disabled={busy || !reason.trim()} onClick={() => onSubmit(reason.trim())}>
            {busy ? "Saving…" : actionLabel}
          </button>
        </div>
        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 70; }
          .modal { width: 100%; max-width: 440px; padding: 22px; }
          h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
          textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; }
          textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        `}</style>
      </div>
    </div>
  );
}
