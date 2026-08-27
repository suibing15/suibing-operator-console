"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatusBadge, ReasonModal, Toast, ReviewStatus } from "@/lib/reviewUi";

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
  offer_role: string | null;
  offer_employment_type: string | null;
  offer_start_date: string | null;
  offer_salary: string | null;
  offer_reporting_to: string | null;
  offer_additional_terms: string | null;
  offer_issued_by: string | null;
  offer_issued_at: string | null;
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
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

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
    if (error) { setToast({ kind: "error", message: "Could not approve: " + error.message }); return; }
    setSelected(null);
    setToast({ kind: "success", message: `${a.full_name} approved` });
    load();
  }

  async function reject(reason: string) {
    if (!selected) return;
    const name = selected.full_name;
    setBusy(true);
    const { error } = await supabase.rpc("reject_job_application", { p_id: selected.id, p_reason: reason, p_by: operatorEmail });
    setBusy(false);
    if (error) { setToast({ kind: "error", message: "Could not reject: " + error.message }); return; }
    setModal(null); setSelected(null);
    setToast({ kind: "success", message: `${name} rejected` });
    load();
  }

  async function requestCorrection(reason: string) {
    if (!selected) return;
    const name = selected.full_name;
    setBusy(true);
    const { error } = await supabase.rpc("request_job_correction", { p_id: selected.id, p_reason: reason, p_by: operatorEmail });
    setBusy(false);
    if (error) { setToast({ kind: "error", message: "Could not request correction: " + error.message }); return; }
    setModal(null); setSelected(null);
    setToast({ kind: "success", message: `Correction requested from ${name}` });
    load();
  }

  async function deleteApplicant(a: Applicant, reasonLabel: string) {
    if (!confirm(`Delete "${a.full_name}" (${a.form_number})? ${reasonLabel}`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_stale_job_application", { p_id: a.id, p_by: operatorEmail });
    setBusy(false);
    if (error) { setToast({ kind: "error", message: "Could not delete: " + error.message }); return; }
    setSelected(null);
    setToast({ kind: "success", message: `${a.full_name} deleted` });
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
              <tr><td colSpan={6} className="empty">No applicants in this view.</td></tr>
            ) : visible.map((a) => (
              <tr key={a.id} onClick={() => setSelected(a)}>
                <td className="mono" data-label="Form #">{a.form_number}</td>
                <td data-label="Applicant">
                  <div className="nameCell">
                    <div className="avatarSm">{a.full_name.slice(0, 1).toUpperCase()}</div>
                    <span className="name">{a.full_name}</span>
                  </div>
                </td>
                <td data-label="Position">{a.job_title_snap ?? "—"}</td>
                <td data-label="Status"><StatusBadge status={a.status} /></td>
                <td data-label="Submitted">{new Date(a.created_at).toLocaleDateString("en-GB")}</td>
                <td className="r" data-label=""><button className="mini" onClick={(e) => { e.stopPropagation(); setSelected(a); }}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && !modal && (
        <ApplicantDrawer
          a={selected}
          busy={busy}
          operatorEmail={operatorEmail}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={() => setModal("reject")}
          onCorrect={() => setModal("correct")}
          onDelete={deleteApplicant}
          onOfferSaved={load}
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

      {toast && <Toast kind={toast.kind} message={toast.message} onDone={() => setToast(null)} />}

      <style jsx>{`
        .filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; transition: all 0.15s; }
        .chip:hover { border-color: var(--navy); color: var(--navy); }
        .chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
        .table-wrap { overflow-x: auto; }
        @media (max-width: 640px) {
          table, thead, tbody, th, td, tr { display: block; }
          thead { display: none; }
          .table-wrap { overflow-x: visible; }
          tr { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); margin-bottom: 10px; padding: 12px 14px; cursor: pointer; }
          td { border-bottom: none; padding: 6px 0; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
          td[data-label]::before { content: attr(data-label); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); flex-shrink: 0; }
          td[data-label=""]::before { display: none; }
          td.r { justify-content: flex-end; }
          td.empty { display: block; text-align: center; }
        }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--line); }
        td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        tr { cursor: pointer; transition: background 0.1s; }
        tr:hover td { background: var(--paper-2); }
        tr:last-child td { border-bottom: none; }
        .mono { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--ink-2); }
        .nameCell { display: flex; align-items: center; gap: 10px; }
        .avatarSm { width: 26px; height: 26px; border-radius: 50%; background: var(--navy-soft); color: var(--navy); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px; flex-shrink: 0; }
        .name { color: var(--ink); font-weight: 600; font-size: 14px; }
        .r { text-align: right; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .empty { text-align: center; color: var(--muted); padding: 36px; font-size: 13px; }
      `}</style>
    </div>
  );
}

function ApplicantDrawer({ a, busy, onClose, onApprove, onReject, onCorrect, onDelete, operatorEmail, onOfferSaved }: {
  a: Applicant; busy: boolean; onClose: () => void;
  onApprove: (a: Applicant) => void; onReject: () => void; onCorrect: () => void;
  onDelete: (a: Applicant, reasonLabel: string) => void;
  operatorEmail: string; onOfferSaved: () => void;
}) {
  const hasOffer = !!a.offer_issued_at;
  const [editingOffer, setEditingOffer] = useState(!hasOffer);
  const [offer, setOffer] = useState({
    role: a.offer_role ?? a.job_title_snap ?? "",
    employmentType: a.offer_employment_type ?? "Full-time",
    startDate: a.offer_start_date ?? "",
    salary: a.offer_salary ?? "",
    reportingTo: a.offer_reporting_to ?? "",
    additionalTerms: a.offer_additional_terms ?? "",
  });
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerErr, setOfferErr] = useState<string | null>(null);
  const up = (k: string, v: string) => setOffer((p) => ({ ...p, [k]: v }));

  async function saveOffer() {
    setOfferErr(null);
    if (!offer.role.trim() || !offer.startDate.trim() || !offer.salary.trim() || !offer.reportingTo.trim()) {
      setOfferErr("Role, start date, compensation, and reporting-to are required.");
      return;
    }
    setSavingOffer(true);
    const { error } = await supabase.rpc("save_job_offer", {
      p_id: a.id, p_role: offer.role.trim(), p_employment_type: offer.employmentType.trim(),
      p_start_date: offer.startDate.trim(), p_salary: offer.salary.trim(),
      p_reporting_to: offer.reportingTo.trim(), p_additional_terms: offer.additionalTerms.trim() || null,
      p_by: operatorEmail,
    });
    setSavingOffer(false);
    if (error) { setOfferErr(error.message); return; }
    setEditingOffer(false);
    onOfferSaved();
  }

  async function download() {
    const { generateOfferLetterPdf } = await import("@/lib/offerLetter");
    await generateOfferLetterPdf(
      {
        fullName: a.full_name, role: offer.role, startDate: offer.startDate, salary: offer.salary,
        employmentType: offer.employmentType, reportingTo: offer.reportingTo,
        additionalTerms: offer.additionalTerms, issuedBy: a.offer_issued_by ?? operatorEmail,
      },
      a.form_number
    );
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dh">
          <div className="dhLeft">
            <div className="avatar">{a.full_name.slice(0, 1).toUpperCase()}</div>
            <div>
              <h3>{a.full_name}</h3>
              <div className="dhMeta"><span className="mono">{a.form_number}</span><StatusBadge status={a.status} /></div>
            </div>
          </div>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>

        <div className="grid">
          <Field label="Position" value={a.job_title_snap ?? "—"} />
          <Field label="Phone" value={a.phone} />
          <Field label="Email" value={a.email ?? "—"} />
          <Field label="Submitted" value={new Date(a.created_at).toLocaleString("en-GB")} />
        </div>

        {a.resume_url && (
          <a className="resumeLink" href={a.resume_url} target="_blank" rel="noreferrer">📄 View CV / resume</a>
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
          <div className="offerBox card">
            <div className="offerHead">
              <h4>Offer of appointment</h4>
              {hasOffer && !editingOffer && (
                <button className="mini" type="button" onClick={() => setEditingOffer(true)}>Edit</button>
              )}
            </div>

            {editingOffer ? (
              <>
                <div className="two">
                  <div><label>Role / title</label><input value={offer.role} onChange={(e) => up("role", e.target.value)} /></div>
                  <div>
                    <label>Employment type</label>
                    <select value={offer.employmentType} onChange={(e) => up("employmentType", e.target.value)}>
                      <option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option>
                    </select>
                  </div>
                </div>
                <div className="two">
                  <div><label>Start date</label><input value={offer.startDate} onChange={(e) => up("startDate", e.target.value)} placeholder="1 September 2026" /></div>
                  <div><label>Compensation</label><input value={offer.salary} onChange={(e) => up("salary", e.target.value)} placeholder="NGN 150,000 / month" /></div>
                </div>
                <label>Reporting to</label>
                <input value={offer.reportingTo} onChange={(e) => up("reportingTo", e.target.value)} />
                <label>Additional terms (optional)</label>
                <textarea rows={3} value={offer.additionalTerms} onChange={(e) => up("additionalTerms", e.target.value)} />
                {offerErr && <div className="err">{offerErr}</div>}
                <div className="row2">
                  {hasOffer && <button className="btn ghost" type="button" onClick={() => setEditingOffer(false)}>Cancel</button>}
                  <button className="btn ok" type="button" disabled={savingOffer} onClick={saveOffer}>
                    {savingOffer ? "Saving…" : hasOffer ? "Save changes" : "Issue offer"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="offerSummary">
                  <div><span>Role</span><strong>{offer.role}</strong></div>
                  <div><span>Start date</span><strong>{offer.startDate}</strong></div>
                  <div><span>Compensation</span><strong>{offer.salary}</strong></div>
                  <div><span>Reporting to</span><strong>{offer.reportingTo}</strong></div>
                </div>
                <p className="hint">Issued {a.offer_issued_at ? new Date(a.offer_issued_at).toLocaleString("en-GB") : ""} by {a.offer_issued_by}. The candidate can also download this from their own status page.</p>
                <button className="btn" type="button" onClick={download} style={{ width: "100%", marginTop: 10 }}>⬇ Download offer letter (PDF)</button>
              </>
            )}
          </div>
        )}

        <div className="actions">
          {(a.status === "pending" || a.status === "needs_correction") && (
            <>
              <button className="btn ok" type="button" disabled={busy} onClick={() => onApprove(a)}>{busy ? "Saving…" : "Approve"}</button>
              <button className="btn ghost" type="button" onClick={onCorrect}>Request correction</button>
              <button className="btn danger" type="button" onClick={onReject}>Reject</button>
            </>
          )}
          {(a.status === "rejected" || a.status === "needs_correction") && (
            <button className="btn ghost" type="button" onClick={() => onDelete(a, "For when no response has been received.")}>Delete (no response)</button>
          )}
          {a.status === "approved" && (
            <button className="btn ghost" type="button" onClick={() => onDelete(a, "Hiring process is complete for this candidate.")}>Delete (process complete)</button>
          )}
        </div>
      </div>
      <style jsx>{`
        .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.45); display: flex; justify-content: flex-end; z-index: 50; backdrop-filter: blur(1px); }
        .drawer { width: 100%; max-width: 580px; background: var(--paper-2); height: 100%; overflow-y: auto; padding: 26px; box-shadow: -8px 0 30px rgba(20,28,45,0.15); }
        .dh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 10px; }
        .dhLeft { display: flex; gap: 12px; align-items: center; }
        .avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; flex-shrink: 0; }
        h3 { font-size: 19px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
        .dhMeta { display: flex; align-items: center; gap: 8px; }
        .mono { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .x { background: none; border: none; font-size: 18px; color: var(--muted); cursor: pointer; line-height: 1; }
        .x:hover { color: var(--ink); }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .resumeLink { display: inline-block; font-size: 13px; color: var(--navy); font-weight: 600; margin-bottom: 12px; text-decoration: none; }
        .resumeLink:hover { text-decoration: underline; }
        .msgBox { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 12px; font-size: 13px; line-height: 1.5; }
        .msgBox.note { background: #FBF0DC; border-color: transparent; }
        .l { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
        .offerBox { padding: 18px; margin: 18px 0; border: 1px solid var(--line-strong); }
        .offerHead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        h4 { font-size: 14px; font-weight: 700; color: var(--ink); }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 5px 11px; font-size: 12px; font-weight: 600; cursor: pointer; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 10px 0 5px; }
        input, select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 14px; font-family: inherit; background: #fff; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
        textarea { resize: vertical; }
        .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
        .row2 { display: flex; gap: 10px; margin-top: 14px; }
        .row2 .btn { flex: 1; }
        .offerSummary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
        .offerSummary div { display: flex; flex-direction: column; gap: 2px; }
        .offerSummary span { font-size: 11px; color: var(--muted); }
        .offerSummary strong { font-size: 13px; color: var(--ink); }
        .hint { font-size: 12px; color: var(--muted); margin-top: 10px; line-height: 1.4; }
        .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px; }
        @media (max-width: 400px) { .grid { grid-template-columns: 1fr; } .drawer { padding: 18px; } }
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
