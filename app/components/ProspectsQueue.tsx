"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatusBadge, ReasonModal, ReviewStatus } from "@/lib/reviewUi";

type Prospect = {
  id: string;
  form_number: string;
  request_type: "new" | "update";
  product: string;
  status: ReviewStatus;
  org_name: string;
  contact_person: string;
  contact_email: string | null;
  contact_phone: string;
  message: string | null;
  existing_school_id: string | null;
  reviewer_note: string | null;
  created_at: string;
};

type School = { id: string; name: string; school_key: string };

const FILTERS: { key: ReviewStatus | "all"; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "needs_correction", label: "Needs correction" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function ProspectsQueue({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<Prospect[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [filter, setFilter] = useState<ReviewStatus | "all">("pending");
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"reject" | "correct" | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("prospects").select("*").order("created_at", { ascending: false });
    setRows((data as Prospect[]) ?? []);
    const { data: sc } = await supabase.from("schools").select("id,name,school_key").order("name");
    setSchools((sc as School[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  async function approve(p: Prospect, schoolKey?: string) {
    setBusy(true);
    const { error } = await supabase.rpc("approve_prospect", {
      p_id: p.id, p_by: operatorEmail,
      p_school_key: p.request_type === "new" ? (schoolKey ?? "").trim().toLowerCase() : null,
      p_plan: "standard",
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setSelected(null);
    load();
  }

  async function reject(reason: string) {
    if (!selected) return;
    setBusy(true);
    await supabase.rpc("reject_prospect", { p_id: selected.id, p_reason: reason, p_by: operatorEmail });
    setBusy(false);
    setModal(null); setSelected(null);
    load();
  }

  async function requestCorrection(reason: string) {
    if (!selected) return;
    setBusy(true);
    await supabase.rpc("request_prospect_correction", { p_id: selected.id, p_reason: reason, p_by: operatorEmail });
    setBusy(false);
    setModal(null); setSelected(null);
    load();
  }

  async function deleteStale(p: Prospect) {
    if (!confirm(`Delete "${p.org_name}" (${p.form_number})? This is for when no response has been received. The event will be logged permanently.`)) return;
    setBusy(true);
    await supabase.rpc("delete_stale_prospect", { p_id: p.id, p_by: operatorEmail });
    setBusy(false);
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
            <tr><th>Form #</th><th>Organisation</th><th>Type</th><th>Product</th><th>Status</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="empty">Nothing here.</td></tr>
            ) : visible.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.form_number}</td>
                <td><button className="name" onClick={() => setSelected(p)}>{p.org_name}</button></td>
                <td>{p.request_type === "new" ? "New" : "Update"}</td>
                <td>{p.product}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{new Date(p.created_at).toLocaleDateString("en-GB")}</td>
                <td className="r"><button className="mini" onClick={() => setSelected(p)}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProspectDrawer
          p={selected}
          schools={schools}
          busy={busy}
          onClose={() => setSelected(null)}
          onApprove={approve}
          onReject={() => setModal("reject")}
          onCorrect={() => setModal("correct")}
          onDeleteStale={deleteStale}
        />
      )}

      {modal === "reject" && (
        <ReasonModal title={`Reject "${selected?.org_name}"`} actionLabel="Reject" busy={busy}
          onCancel={() => setModal(null)} onSubmit={reject} />
      )}
      {modal === "correct" && (
        <ReasonModal title={`Request correction — "${selected?.org_name}"`} actionLabel="Request correction" busy={busy}
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

function ProspectDrawer({ p, schools, busy, onClose, onApprove, onReject, onCorrect, onDeleteStale }: {
  p: Prospect; schools: School[]; busy: boolean; onClose: () => void;
  onApprove: (p: Prospect, schoolKey?: string) => void;
  onReject: () => void; onCorrect: () => void; onDeleteStale: (p: Prospect) => void;
}) {
  const [schoolKey, setSchoolKey] = useState("");
  const [linkExisting, setLinkExisting] = useState(p.existing_school_id ?? "");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="drawer card" onClick={(e) => e.stopPropagation()}>
        <div className="dh">
          <div>
            <h3>{p.org_name}</h3>
            <span className="mono">{p.form_number}</span>
            <StatusBadge status={p.status} />
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="grid">
          <Field label="Type" value={p.request_type === "new" ? "New signup" : "Update request"} />
          <Field label="Product" value={p.product} />
          <Field label="Contact" value={p.contact_person} />
          <Field label="Phone" value={p.contact_phone} />
          <Field label="Email" value={p.contact_email ?? "—"} />
          <Field label="Submitted" value={new Date(p.created_at).toLocaleString("en-GB")} />
        </div>

        {p.message && (
          <div className="msgBox">
            <div className="l">Request details</div>
            <div>{p.message}</div>
          </div>
        )}

        {p.reviewer_note && (
          <div className="msgBox note">
            <div className="l">Your previous note to them</div>
            <div>{p.reviewer_note}</div>
          </div>
        )}

        {(p.status === "pending" || p.status === "needs_correction") && (
          <div className="approveBox card">
            <h4>Approve</h4>
            {p.request_type === "new" ? (
              <>
                <label>School key (short, unique, lowercase — e.g. "brightfuture")</label>
                <input value={schoolKey} onChange={(e) => setSchoolKey(e.target.value)} placeholder="school-key" />
                <p className="hint">This creates a new active school record and deletes this application, keeping the history in the activity log.</p>
              </>
            ) : (
              <>
                <label>Existing school this update applies to</label>
                <select value={linkExisting} onChange={(e) => setLinkExisting(e.target.value)}>
                  <option value="">— select —</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.school_key})</option>)}
                </select>
                <p className="hint">Approving logs this request on the selected school's activity history. You'll apply the actual change yourself.</p>
              </>
            )}
            <button
              className="btn ok"
              disabled={busy || (p.request_type === "new" ? !schoolKey.trim() : !linkExisting)}
              onClick={() => onApprove(p, p.request_type === "new" ? schoolKey : undefined)}
              style={{ width: "100%", marginTop: 10 }}
            >
              {busy ? "Approving…" : "Approve"}
            </button>
          </div>
        )}

        <div className="actions">
          {(p.status === "pending" || p.status === "needs_correction") && (
            <>
              <button className="btn ghost" onClick={onCorrect}>Request correction</button>
              <button className="btn danger" onClick={onReject}>Reject</button>
            </>
          )}
          {(p.status === "rejected" || p.status === "needs_correction") && (
            <button className="btn ghost" onClick={() => onDeleteStale(p)}>Delete (no response)</button>
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
        .msgBox { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 12px; font-size: 13px; line-height: 1.5; }
        .msgBox.note { background: #FBF0DC; border-color: transparent; }
        .l { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
        .approveBox { padding: 16px; margin: 16px 0; }
        h4 { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 5px; }
        input, select { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 14px; background: #fff; }
        .hint { font-size: 12px; color: var(--muted); margin-top: 8px; line-height: 1.4; }
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
