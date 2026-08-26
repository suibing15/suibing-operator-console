"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatusBadge, ReasonModal, ReviewStatus } from "@/lib/reviewUi";

type Applicant = {
  id: string;
  form_number: string;
  job_title_snap: string | null;
  status: ReviewStatus;
  full_name: string;
  email: string | null;
  phone: string;
  cover_note: string | null;
  resume_url: string | null;
  reviewer_note: string | null;
  created_at: string;
};

const FILTERS: { key: ReviewStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "needs_correction", label: "Needs correction" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function JobsQueue({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<Applicant[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [selected, setSelected] = useState<Applicant | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"reject" | "correct" | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("job_applicants").select("*").order("created_at", { ascending: false });
    setRows((data as Applicant[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function approve(a: Applicant) {
    setBusy(true);
    const { error } = await supabase.rpc("approve_job_application", { p_id: a.id, p_by: operatorEmail });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setSelected(null);
    load();
  }

  async function reject(reason: string) {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("reject_job_application", { p_id: selected.id, p_reason: reason, p_by: operatorEmail });
    setBusy(false);
    if (error) { alert("Could not reject: " + error.message); return; }
    setModal(null); setSelected(null);
    load();
  }

  async function requestCorrection(reason: string) {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_job_correction", { p_id: selected.id, p_reason: reason, p_by: operatorEmail });
    setBusy(false);
    if (error) { alert("Could not request correction: " + error.message); return; }
    setModal(null); setSelected(null);
    load();
  }

  async function deleteApplicant(a: Applicant, reasonLabel: string) {
    if (!confirm(`Delete "${a.full_name}" (${a.form_number})? ${reasonLabel}`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_stale_job_application", { p_id: a.id, p_by: operatorEmail });
    setBusy(false);
    if (error) { alert("Could not delete: " + error.message); return; }
    setSelected(null);
    load();
  }

  return (
    <div>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? "chip on" : "chip"} onClick={() => setFilter(f.key)}>
            {f.label}{f.key === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Form #</th><th>Applicant</th><th>Position</th><th>Status</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={6} className="empty">Nothing here.</td></tr>
            ) : visible.map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.form_number}</td>
                <td><button className="name" onClick={() => setSelected(a)}>{a.full_name}</button></td>
                <td>{a.job_title_snap ?? "—"}</td>
                <td><StatusBadge status={a.status} /></td>
                <td>{new Date(a.created_at).toLocaleDateString("en-GB")}</td>
                <td className="r"><button className="mini" onClick={() => setSelected(a)}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ApplicantDrawer
          a={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={() => setModal("reject")}
          onCorrect={() => setModal("correct")}
          onDelete={deleteApplicant}
        />
      )}

      {modal === "reject" && selected && (
        <ReasonModal title={`Reject "${selected.full_name}"`} actionLabel="Reject" busy={busy}
          onCancel={() => setModal(null)} onSubmit={reject} />
      )}
      {modal === "correct" && selected && (
        <ReasonModal title={`Request correction — "${selected.full_name}"`} actionLabel="Request correction" busy={busy}
          onCancel={() => setModal(null)} onSubmit={requestCorrection} />
      )}

      <style jsx>{`
        .filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--line); }
        td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .mono { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--ink-2); }
        .name { background: none; border: none; color: var(--navy); font-weight: 600; cursor: pointer; padding: 0; font-size: 14px; }
        .r { text-align: right; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
      `}</style>
    </div>
  );
}

function ApplicantDrawer({ a, busy, onClose, onApprove, onReject, onCorrect, onDelete }: {
  a: Applicant; busy: boolean; onClose: () => void;
  onApprove: (a: Applicant) => void; onReject: () => void; onCorrect: () => void;
  onDelete: (a: Applicant, reasonLabel: string) => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer card" onClick={(e) => e.stopPropagation()}>
        <div className="dh">
          <div>
            <h3>{a.full_name}</h3>
            <span className="mono">{a.form_number}</span>
            <StatusBadge status={a.status} />
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="grid">
          <Field label="Position" value={a.job_title_snap ?? "—"} />
          <Field label="Phone" value={a.phone} />
          <Field label="Email" value={a.email ?? "—"} />
          <Field label="Submitted" value={new Date(a.created_at).toLocaleString("en-GB")} />
        </div>

        {a.resume_url && (
          <a className="resumeLink" href={a.resume_url} target="_blank" rel="noreferrer">View CV / resume ↗</a>
        )}

        {a.cover_note && (
          <div className="msgBox">
            <div className="l">Cover note</div>
            <div>{a.cover_note}</div>
          </div>
        )}

        {a.reviewer_note && (
          <div className="msgBox note">
            <div className="l">Your previous note to them</div>
            <div>{a.reviewer_note}</div>
          </div>
        )}

        {a.status === "approved" && (
          <div className="approveBox card">
            <h4>Next step</h4>
            <p className="hint">This applicant is approved. Generate their offer of appointment from the Offer Letters section (coming next).</p>
          </div>
        )}

        <div className="actions">
          {(a.status === "pending" || a.status === "needs_correction") && (
            <>
              <button className="btn ok" disabled={busy} onClick={() => onApprove(a)}>{busy ? "Saving…" : "Approve"}</button>
              <button className="btn ghost" onClick={onCorrect}>Request correction</button>
              <button className="btn danger" onClick={onReject}>Reject</button>
            </>
          )}
          {(a.status === "rejected" || a.status === "needs_correction") && (
            <button className="btn ghost" onClick={() => onDelete(a, "For when no response has been received.")}>Delete (no response)</button>
          )}
          {a.status === "approved" && (
            <button className="btn ghost" onClick={() => onDelete(a, "Hiring process is complete for this candidate.")}>Delete (process complete)</button>
          )}
        </div>
      </div>
      <style jsx>{`
        .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.4); display: flex; justify-content: flex-end; z-index: 50; }
        .drawer { width: 100%; max-width: 560px; background: var(--paper-2); height: 100%; overflow-y: auto; padding: 24px; }
        .dh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; gap: 10px; }
        h3 { font-size: 19px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
        .mono { font-size: 12px; color: var(--muted); margin-right: 8px; font-variant-numeric: tabular-nums; }
        .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .resumeLink { display: inline-block; font-size: 13px; color: var(--navy); font-weight: 600; margin-bottom: 12px; }
        .msgBox { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 12px; font-size: 13px; line-height: 1.5; }
        .msgBox.note { background: #FBF0DC; border-color: transparent; }
        .l { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
        .approveBox { padding: 16px; margin: 16px 0; }
        h4 { font-size: 14px; font-weight: 700; margin-bottom: 8px; }
        .hint { font-size: 12px; color: var(--muted); line-height: 1.4; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
      `}</style>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="f card">
      <span className="l">{label}</span><span className="v">{value}</span>
      <style jsx>{`
        .f { padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
        .l { font-size: 11px; color: var(--muted); }
        .v { font-size: 14px; font-weight: 600; color: var(--ink); }
      `}</style>
    </div>
  );
}
