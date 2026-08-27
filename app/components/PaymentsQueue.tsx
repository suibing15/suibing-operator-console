"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Toast } from "@/lib/reviewUi";

type PaymentSubmission = {
  id: string;
  school_id: string;
  school_key: string;
  invoice_id: string | null;
  invoice_number: string | null;
  amount: number | null;
  payment_date: string | null;
  note: string | null;
  receipt_data: string;
  receipt_mimetype: string;
  receipt_filename: string;
  receipt_number: string | null;
  status: "pending" | "confirmed" | "rejected";
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type SchoolLite = { id: string; name: string };

const FILTERS: { key: string; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

export default function PaymentsQueue({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<PaymentSubmission[]>([]);
  const [schools, setSchools] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<PaymentSubmission | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasonFor, setReasonFor] = useState<"confirmed" | "rejected" | null>(null);
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase.from("payment_submissions").select("*").order("created_at", { ascending: false });
    if (error) { setLoadError(error.message); setRows([]); return; }
    setRows((data as PaymentSubmission[]) ?? []);
    const { data: sc, error: scErr } = await supabase.from("schools").select("id,name");
    if (scErr) { setLoadError(scErr.message); return; }
    const map: Record<string, string> = {};
    (sc as SchoolLite[] ?? []).forEach((s) => { map[s.id] = s.name; });
    setSchools(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  function receiptUrl(data: string, mimetype: string) {
    return `data:${mimetype};base64,${data}`;
  }

  async function downloadOfficialReceipt(p: PaymentSubmission, schoolMap: Record<string, string>) {
    if (!p.receipt_number || !p.reviewed_at) return;
    const { generateReceiptPdf } = await import("@/lib/receipt-of-payment");
    await generateReceiptPdf({
      receiptNumber: p.receipt_number,
      schoolName: schoolMap[p.school_id] ?? p.school_key,
      invoiceNumber: p.invoice_number,
      amount: p.amount ?? 0,
      paymentDate: p.payment_date ?? p.created_at,
      note: p.note,
      confirmedAt: p.reviewed_at,
    });
  }

  async function review(status: "confirmed" | "rejected") {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.rpc("review_payment_submission", {
      p_id: selected.id, p_status: status, p_reviewer_note: reason.trim() || null, p_by: operatorEmail,
    });
    setBusy(false);
    if (error) { setToast({ kind: "error", message: "Could not save: " + error.message }); return; }
    setToast({ kind: "success", message: status === "confirmed" ? "Payment confirmed" : "Payment rejected" });
    setSelected(null); setReasonFor(null); setReason("");
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

      {loadError && <div className="loadErr">Could not load payments: {loadError}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>School</th><th>Invoice</th><th>Amount</th><th>Date</th><th>Status</th><th>Submitted</th><th></th></tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={7} className="empty">Nothing here.</td></tr>
            ) : visible.map((p) => (
              <tr key={p.id} onClick={() => setSelected(p)}>
                <td data-label="School">{schools[p.school_id] ?? p.school_key}</td>
                <td className="mono" data-label="Invoice">{p.invoice_number ?? "—"}</td>
                <td data-label="Amount">{p.amount != null ? `NGN ${Number(p.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "—"}</td>
                <td data-label="Date">{p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-GB") : "—"}</td>
                <td data-label="Status"><span className={`badge ${p.status}`}>{p.status}</span></td>
                <td data-label="Submitted">{new Date(p.created_at).toLocaleDateString("en-GB")}</td>
                <td className="r" data-label=""><button className="mini" onClick={(e) => { e.stopPropagation(); setSelected(p); }}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && !reasonFor && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <div className="drawer card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="dh">
              <div>
                <h3>{schools[selected.school_id] ?? selected.school_key}</h3>
                <span className={`badge ${selected.status}`}>{selected.status}</span>
              </div>
              <button className="x" onClick={() => setSelected(null)} type="button">✕</button>
            </div>

            <div className="grid">
              <Field label="Invoice" value={selected.invoice_number ?? "General payment"} />
              <Field label="Amount" value={selected.amount != null ? `NGN ${Number(selected.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}` : "—"} />
              <Field label="Payment date" value={selected.payment_date ? new Date(selected.payment_date).toLocaleDateString("en-GB") : "—"} />
              <Field label="Submitted" value={new Date(selected.created_at).toLocaleString("en-GB")} />
            </div>

            {selected.note && (
              <div className="msgBox"><div className="l">Note from school</div><div>{selected.note}</div></div>
            )}
            {selected.reviewer_note && (
              <div className="msgBox note"><div className="l">Your review note</div><div>{selected.reviewer_note}</div></div>
            )}

            <a className="receiptBtn" href={receiptUrl(selected.receipt_data, selected.receipt_mimetype)} target="_blank" rel="noreferrer" download={selected.receipt_filename}>📄 View uploaded proof</a>

            {selected.status === "confirmed" && selected.receipt_number && (
              <button className="receiptBtn ok" type="button" onClick={() => downloadOfficialReceipt(selected, schools)}>
                ✓ Download official receipt ({selected.receipt_number})
              </button>
            )}

            {selected.status === "pending" && (
              <div className="actions">
                <button className="btn ok" type="button" onClick={() => setReasonFor("confirmed")}>Confirm payment</button>
                <button className="btn danger" type="button" onClick={() => setReasonFor("rejected")}>Reject</button>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && reasonFor && (
        <div className="overlay modalOverlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setReasonFor(null); setReason(""); } }}>
          <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mh">
              <h3>{reasonFor === "confirmed" ? "Confirm" : "Reject"} payment — {schools[selected.school_id] ?? selected.school_key}</h3>
              <button className="x" onClick={() => { setReasonFor(null); setReason(""); }} type="button">✕</button>
            </div>
            <label>Note (optional, shown to the school)</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            <div className="mf">
              <button className="btn ghost" type="button" onClick={() => { setReasonFor(null); setReason(""); }}>Cancel</button>
              <button className={reasonFor === "confirmed" ? "btn ok" : "btn danger"} type="button" disabled={busy} onClick={() => review(reasonFor)}>
                {busy ? "Saving…" : reasonFor === "confirmed" ? "Confirm payment" : "Reject payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} onDone={() => setToast(null)} />}

      <style jsx>{`
        .filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .loadErr { background: var(--red-soft); color: var(--red); padding: 12px 16px; border-radius: var(--radius-sm); font-size: 13.5px; margin-bottom: 14px; line-height: 1.5; }
        .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
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
        tr { cursor: pointer; }
        tr:hover td { background: var(--paper-2); }
        tr:last-child td { border-bottom: none; }
        .mono { font-variant-numeric: tabular-nums; font-size: 13px; color: var(--ink-2); }
        .r { text-align: right; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
        .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
        .badge.pending { background: #FBF0DC; color: var(--amber); }
        .badge.confirmed { background: var(--green-soft); color: var(--green); }
        .badge.rejected { background: var(--red-soft); color: var(--red); }

        .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.45); display: flex; justify-content: flex-end; z-index: 50; backdrop-filter: blur(1px); }
        .overlay.modalOverlay { justify-content: center; align-items: center; background: rgba(15,20,32,0.6); z-index: 300; padding: 20px; }
        .drawer { width: 100%; max-width: 560px; background: var(--paper-2); height: 100%; overflow-y: auto; padding: 26px; }
        .modal { width: 100%; max-width: 440px; padding: 24px; }
        .dh, .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 10px; }
        h3 { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
        .x { background: none; border: none; font-size: 18px; color: var(--muted); cursor: pointer; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .msgBox { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 12px; font-size: 13px; line-height: 1.5; }
        .msgBox.note { background: var(--navy-soft); border-color: transparent; }
        .l { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
        .receiptBtn { display: block; text-align: center; background: var(--navy); color: #fff; text-decoration: none; padding: 12px; border-radius: var(--radius-sm); font-weight: 600; font-size: 14px; margin: 16px 0; border: none; width: 100%; cursor: pointer; font-family: inherit; }
        .receiptBtn.ok { background: var(--green); margin-top: 0; }
        .actions { display: flex; gap: 10px; margin-top: 8px; }
        @media (max-width: 400px) { .grid { grid-template-columns: 1fr; } .drawer { padding: 18px; } }
        .actions .btn { flex: 1; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
        textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; }
        textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
        .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
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
