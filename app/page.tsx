"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import ProspectsQueue from "@/app/components/ProspectsQueue";
import JobsQueue from "@/app/components/JobsQueue";
import JobPostings from "@/app/components/JobPostings";

type School = {
  id: string;
  school_key: string;
  name: string;
  contact_person: string | null;
  contact_email: string | null;
  app_url: string | null;
  plan: string;
  status: "active" | "disabled";
  registered_on: string;
  paid_until: string | null;
  students_count: number;
  records_count: number;
  counts_updated: string | null;
  notes: string | null;
};

type Activity = {
  id: string;
  school_id: string;
  event: string;
  detail: string | null;
  amount: number | null;
  at: string;
  by_email: string | null;
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtNaira = (n: number) => "NGN " + n.toLocaleString("en-NG");

export default function Console() {
  const { email, isOperator, loading, signOut } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"schools" | "prospects" | "jobs" | "postings">("schools");
  const [pendingProspects, setPendingProspects] = useState(0);
  const [pendingApplicants, setPendingApplicants] = useState(0);

  const load = useCallback(async () => {
    const { data } = await supabase.from("schools").select("*").order("name");
    setSchools((data as School[]) ?? []);
  }, []);

  useEffect(() => {
    if (isOperator) load();
  }, [isOperator, load]);

  useEffect(() => {
    if (!isOperator) return;
    async function loadCounts() {
      const { count: pc } = await supabase.from("prospects").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { count: jc } = await supabase.from("job_applicants").select("id", { count: "exact", head: true }).eq("status", "pending");
      setPendingProspects(pc ?? 0);
      setPendingApplicants(jc ?? 0);
    }
    loadCounts();
  }, [isOperator, tab]);

  if (loading) return <Center>Loading…</Center>;
  if (!isConfigured) return <Center>Console not configured. Set Supabase environment variables.</Center>;
  if (!email) return <Redirect />;
  if (!isOperator) return <Center>This account is not an operator. <button className="btn ghost" onClick={signOut} style={{ marginLeft: 12 }}>Sign out</button></Center>;

  const active = schools.filter((s) => s.status === "active").length;
  const overdue = schools.filter((s) => s.paid_until && new Date(s.paid_until) < new Date()).length;
  const totalStudents = schools.reduce((a, s) => a + (s.students_count || 0), 0);

  async function toggleStatus(s: School) {
    const next = s.status === "active" ? "disabled" : "active";
    const verb = next === "disabled" ? "disable" : "re-enable";
    if (!confirm(`Are you sure you want to ${verb} "${s.name}"? Their data is preserved; only access changes.`)) return;
    setBusy(true);
    await supabase.from("schools").update({ status: next }).eq("id", s.id);
    await supabase.from("activity_log").insert({
      school_id: s.id, school_key: s.school_key,
      event: next === "disabled" ? "disabled" : "enabled",
      detail: next === "disabled" ? "Access paused (non-payment or operator action)" : "Access restored",
      by_email: email,
    });
    setBusy(false);
    load();
    if (selected?.id === s.id) setSelected({ ...s, status: next });
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><img src="/logo.png" alt="Suibing IT Services" className="logo" />SUIBING <span>Bucket</span> · Operator Console</div>
        <div className="who">{email} <button className="link" onClick={signOut}>Sign out</button></div>
      </header>

      <div className="stats">
        <Stat label="Schools" value={schools.length.toString()} />
        <Stat label="Active" value={active.toString()} />
        <Stat label="Overdue" value={overdue.toString()} tone={overdue ? "warn" : undefined} />
        <Stat label="Total students" value={totalStudents.toLocaleString()} />
      </div>

      <div className="tabs">
        <button className={tab === "schools" ? "tab on" : "tab"} onClick={() => setTab("schools")}>Schools</button>
        <button className={tab === "prospects" ? "tab on" : "tab"} onClick={() => setTab("prospects")}>
          Prospects{pendingProspects > 0 ? <span className="dot">{pendingProspects}</span> : null}
        </button>
        <button className={tab === "jobs" ? "tab on" : "tab"} onClick={() => setTab("jobs")}>
          Job applicants{pendingApplicants > 0 ? <span className="dot">{pendingApplicants}</span> : null}
        </button>
        <button className={tab === "postings" ? "tab on" : "tab"} onClick={() => setTab("postings")}>Job postings</button>
      </div>

      {tab === "schools" && (
        <>
          <div className="bar">
            <h2>Registered schools</h2>
            <button className="btn" onClick={() => setShowAdd(true)}>Add school</button>
          </div>

          <div className="card table-wrap">
            <table>
              <thead>
                <tr><th>School</th><th>Status</th><th className="r">Students</th><th className="r">Records</th><th>Paid until</th><th></th></tr>
              </thead>
              <tbody>
                {schools.length === 0 ? (
                  <tr><td colSpan={6} className="empty">No schools yet. Click “Add school”.</td></tr>
                ) : schools.map((s) => {
                  const od = s.paid_until && new Date(s.paid_until) < new Date();
                  return (
                    <tr key={s.id}>
                      <td>
                        <button className="name" onClick={() => setSelected(s)}>{s.name}</button>
                        <div className="key">{s.school_key}</div>
                      </td>
                      <td>
                        <span className={`badge ${s.status}`}>{s.status}</span>
                      </td>
                      <td className="r tab-nums">{s.students_count}</td>
                      <td className="r tab-nums">{s.records_count}</td>
                      <td className={od ? "overdue" : ""}>{fmtDate(s.paid_until)}{od && " ⚠"}</td>
                      <td className="r">
                        <button className={`mini ${s.status === "active" ? "danger" : "ok"}`} onClick={() => toggleStatus(s)} disabled={busy}>
                          {s.status === "active" ? "Disable" : "Enable"}
                        </button>
                        <button className="mini" onClick={() => setSelected(s)}>Manage</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "prospects" && email && <ProspectsQueue operatorEmail={email} />}
      {tab === "jobs" && email && <JobsQueue operatorEmail={email} />}
      {tab === "postings" && <JobPostings />}

      {selected && (
        <SchoolDrawer
          school={selected}
          operatorEmail={email}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
      {showAdd && (
        <AddSchool operatorEmail={email} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />
      )}

      <style jsx>{`
        .shell { max-width: 1080px; margin: 0 auto; padding: 24px 20px 60px; }
        .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
        .brand { font-size: 18px; font-weight: 800; color: var(--navy); display: flex; align-items: center; gap: 10px; }
        .logo { width: 30px; height: 30px; border-radius: 7px; }
        .brand span { font-weight: 400; }
        .who { font-size: 13px; color: var(--muted); }
        .link { background: none; border: none; color: var(--navy); font-weight: 600; cursor: pointer; margin-left: 8px; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 22px; }
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid var(--line); }
        .tab { position: relative; background: none; border: none; padding: 10px 16px; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 6px; }
        .tab.on { color: var(--navy); border-bottom-color: var(--navy); }
        .tab .dot { background: var(--red); color: #fff; font-size: 11px; font-weight: 700; border-radius: 999px; padding: 1px 7px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); font-weight: 600; padding: 14px 14px 12px; border-bottom: 1px solid var(--line); }
        td { padding: 13px 14px; border-bottom: 1px solid var(--line); color: var(--ink); vertical-align: middle; }
        .r { text-align: right; }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
        .name { background: none; border: none; font-weight: 600; color: var(--navy); cursor: pointer; font-size: 14px; padding: 0; }
        .name:hover { text-decoration: underline; }
        .key { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
        .badge.active { background: var(--green-soft); color: var(--green); }
        .badge.disabled { background: var(--red-soft); color: var(--red); }
        .overdue { color: var(--red); font-weight: 600; }
        .mini { border: 1px solid var(--line-strong); background: #fff; border-radius: 7px; padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; margin-left: 6px; color: var(--ink-2); }
        .mini.danger { color: var(--red); border-color: var(--red); }
        .mini.ok { color: var(--green); border-color: var(--green); }
        @media (max-width: 720px) { .stats { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="card s">
      <span className="l">{label}</span>
      <span className="v" style={{ color: tone === "warn" ? "var(--red)" : "var(--ink)" }}>{value}</span>
      <style jsx>{`
        .s { padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
        .l { font-size: 12px; color: var(--muted); }
        .v { font-size: 26px; font-weight: 700; }
      `}</style>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", padding: 20, textAlign: "center" }}>{children}</div>;
}
function Redirect() {
  useEffect(() => { window.location.href = "/login"; }, []);
  return <Center>Redirecting to sign in…</Center>;
}

// ---------- School drawer: details, payment, activity, PDF ----------
function SchoolDrawer({ school, operatorEmail, onClose, onChanged }: {
  school: School; operatorEmail: string; onClose: () => void; onChanged: () => void;
}) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [amount, setAmount] = useState("10000");
  const [months, setMonths] = useState("3");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    const { data } = await supabase.from("activity_log").select("*").eq("school_id", school.id).order("at", { ascending: false });
    setActivity((data as Activity[]) ?? []);
  }, [school.id]);

  useEffect(() => { loadActivity(); }, [loadActivity]);

  async function recordPayment() {
    setMsg(null);
    const amt = parseFloat(amount), m = parseInt(months);
    if (isNaN(amt) || amt <= 0) { setMsg("Enter a valid amount."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("record_payment", {
      p_school: school.id, p_amount: amt, p_months: m, p_by: operatorEmail,
    });
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setMsg(`Payment recorded. New paid-until: ${fmtDate(data as string)}.`);
    loadActivity();
    onChanged();
  }

  async function generatePdf() {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const NAVY: [number, number, number] = [27, 42, 74];
    const W = doc.internal.pageSize.getWidth();
    // border
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.6);
    doc.roundedRect(10, 10, W - 20, doc.internal.pageSize.getHeight() - 20, 3, 3, "S");
    // header
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
    doc.text("SUIBING Bucket", W / 2, 26, { align: "center" });
    doc.setFontSize(12); doc.text("School Activity Report", W / 2, 34, { align: "center" });
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(18, 39, W - 18, 39);
    // school info
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 48, 62);
    let y = 50;
    const info: [string, string][] = [
      ["School", school.name],
      ["Key", school.school_key],
      ["Status", school.status],
      ["Contact", `${school.contact_person ?? "—"} (${school.contact_email ?? "—"})`],
      ["Registered", fmtDate(school.registered_on)],
      ["Paid until", fmtDate(school.paid_until)],
      ["Students", String(school.students_count)],
      ["Records", String(school.records_count)],
    ];
    info.forEach(([k, v]) => { doc.setFont("helvetica", "bold"); doc.text(`${k}:`, 18, y); doc.setFont("helvetica", "normal"); doc.text(String(v), 55, y); y += 6.5; });

    autoTable(doc, {
      startY: y + 4,
      head: [["Date", "Event", "Detail", "Amount"]],
      body: activity.map((a) => [
        new Date(a.at).toLocaleString("en-GB"),
        a.event.replace(/_/g, " "),
        a.detail ?? "",
        a.amount != null ? fmtNaira(Number(a.amount)) : "",
      ]),
      margin: { left: 18, right: 18 },
      styles: { fontSize: 9, cellPadding: 2.5, lineColor: [223, 228, 236], lineWidth: 0.1 },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 246, 250] },
    });
    doc.setFontSize(7.5); doc.setTextColor(150, 158, 168);
    doc.text(`Generated ${new Date().toLocaleDateString("en-GB")} · SUIBING Bucket`, W / 2, doc.internal.pageSize.getHeight() - 13, { align: "center" });
    doc.save(`SUIBING_${school.school_key}_activity.pdf`);
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="dh">
          <div>
            <h3>{school.name}</h3>
            <span className={`badge ${school.status}`}>{school.status}</span>
            <span className="k">{school.school_key}</span>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        <div className="grid">
          <Field label="Students" value={String(school.students_count)} />
          <Field label="Records" value={String(school.records_count)} />
          <Field label="Registered" value={fmtDate(school.registered_on)} />
          <Field label="Paid until" value={fmtDate(school.paid_until)} />
          <Field label="Contact" value={school.contact_person ?? "—"} />
          <Field label="Email" value={school.contact_email ?? "—"} />
        </div>
        {school.app_url && <a className="url" href={school.app_url} target="_blank" rel="noreferrer">{school.app_url}</a>}

        <div className="pay card">
          <h4>Record a payment (manual)</h4>
          <div className="pay-row">
            <div>
              <label>Amount (NGN)</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            </div>
            <div>
              <label>Extends by (months)</label>
              <select value={months} onChange={(e) => setMonths(e.target.value)}>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
              </select>
            </div>
            <button className="btn ok" onClick={recordPayment} disabled={busy}>{busy ? "Saving…" : "Record"}</button>
          </div>
          {msg && <div className="msg">{msg}</div>}
        </div>

        <InvoiceBox school={school} operatorEmail={operatorEmail} onIssued={loadActivity} />

        <div className="act-head">
          <h4>Activity history</h4>
          <button className="btn ghost" onClick={generatePdf}>Generate PDF report</button>
        </div>
        <div className="acts">
          {activity.length === 0 ? <p className="none">No activity yet.</p> : activity.map((a) => (
            <div key={a.id} className="act">
              <div className="act-top">
                <span className={`ev ev-${a.event}`}>{a.event.replace(/_/g, " ")}</span>
                <span className="at">{new Date(a.at).toLocaleString("en-GB")}</span>
              </div>
              {a.detail && <div className="det">{a.detail}{a.amount != null ? ` · ${fmtNaira(Number(a.amount))}` : ""}</div>}
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.4); display: flex; justify-content: flex-end; z-index: 50; }
        .drawer { width: 100%; max-width: 560px; background: var(--paper-2); height: 100%; overflow-y: auto; padding: 24px; }
        .dh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
        h3 { font-size: 20px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
        .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
        .badge.active { background: var(--green-soft); color: var(--green); }
        .badge.disabled { background: var(--red-soft); color: var(--red); }
        .k { font-size: 12px; color: var(--muted); margin-left: 10px; }
        .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
        .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .url { display: inline-block; font-size: 13px; color: var(--navy); margin-bottom: 18px; word-break: break-all; }
        .pay { padding: 16px; margin-bottom: 18px; }
        h4 { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
        .pay-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
        label { display: block; font-size: 12px; color: var(--ink-2); font-weight: 600; margin-bottom: 5px; }
        input, select { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 14px; background: #fff; }
        .msg { margin-top: 10px; font-size: 13px; color: var(--green); }
        .act-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .acts { display: flex; flex-direction: column; gap: 8px; }
        .none { color: var(--muted); font-size: 13px; }
        .act { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 11px 13px; }
        .act-top { display: flex; justify-content: space-between; align-items: center; }
        .ev { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; background: var(--navy-soft); color: var(--navy); }
        .ev-payment_recorded { background: var(--green-soft); color: var(--green); }
        .ev-disabled { background: var(--red-soft); color: var(--red); }
        .at { font-size: 12px; color: var(--muted); }
        .det { font-size: 13px; color: var(--ink-2); margin-top: 5px; }
        @media (max-width: 560px) { .grid { grid-template-columns: 1fr 1fr; } .pay-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

// ---------- Invoice generator ----------
type LineItem = { description: string; qty: string; unitPrice: string };

function InvoiceBox({ school, operatorEmail, onIssued }: { school: School; operatorEmail: string; onIssued: () => void }) {
  const [items, setItems] = useState<LineItem[]>([{ description: "", qty: "1", unitPrice: "" }]);
  const [notes, setNotes] = useState("Payment due within 7 days. Bank transfer details available on request.");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function updateItem(i: number, field: keyof LineItem, value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }
  function addItem() { setItems((prev) => [...prev, { description: "", qty: "1", unitPrice: "" }]); }
  function removeItem(i: number) { setItems((prev) => prev.filter((_, idx) => idx !== i)); }

  const total = items.reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    return sum + q * p;
  }, 0);

  async function issueAndDownload() {
    setErr(null); setMsg(null);
    const cleanItems = items
      .filter((it) => it.description.trim() && parseFloat(it.unitPrice) > 0)
      .map((it) => ({ description: it.description.trim(), qty: parseFloat(it.qty) || 1, unit_price: parseFloat(it.unitPrice) || 0 }));
    if (cleanItems.length === 0) { setErr("Add at least one line item with a description and price."); return; }

    setBusy(true);
    const { data, error } = await supabase.rpc("create_invoice", {
      p_school_id: school.id, p_line_items: cleanItems, p_notes: notes.trim() || null, p_by: operatorEmail,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;

    const { generateInvoicePdf } = await import("@/lib/invoice");
    await generateInvoicePdf({
      invoiceNumber: row.invoice_number,
      schoolName: school.name,
      currency: "NGN",
      lineItems: cleanItems.map((c: any) => ({ description: c.description, qty: c.qty, unitPrice: c.unit_price })),
      subtotal: row.total,
      total: row.total,
      notes,
      issuedAt: new Date().toISOString(),
    });

    setMsg(`Invoice ${row.invoice_number} issued and downloaded. ${school.name} can also download it from their own invoice status page.`);
    setItems([{ description: "", qty: "1", unitPrice: "" }]);
    onIssued();
  }

  return (
    <div className="inv card">
      <h4>Generate invoice</h4>
      <div className="invItems">
        {items.map((it, i) => (
          <div className="invRow" key={i}>
            <input className="invDesc" placeholder="Description (e.g. Registration fee)" value={it.description}
              onChange={(e) => updateItem(i, "description", e.target.value)} />
            <input className="invQty" placeholder="Qty" value={it.qty}
              onChange={(e) => updateItem(i, "qty", e.target.value.replace(/[^0-9.]/g, ""))} />
            <input className="invPrice" placeholder="Unit price (NGN)" value={it.unitPrice}
              onChange={(e) => updateItem(i, "unitPrice", e.target.value.replace(/[^0-9.]/g, ""))} />
            {items.length > 1 && <button className="invRemove" type="button" onClick={() => removeItem(i)}>✕</button>}
          </div>
        ))}
      </div>
      <button className="btn ghost small" type="button" onClick={addItem}>+ Add line item</button>

      <label>Payment terms / notes</label>
      <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <div className="invTotal">
        <span>Total</span>
        <strong>NGN {total.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
      </div>

      {err && <div className="err">{err}</div>}
      {msg && <div className="msg">{msg}</div>}

      <button className="btn ok" onClick={issueAndDownload} disabled={busy} style={{ width: "100%", marginTop: 10 }}>
        {busy ? "Generating…" : "Issue invoice & download PDF"}
      </button>

      <style jsx>{`
        .inv { padding: 16px; margin-bottom: 18px; }
        h4 { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
        .invItems { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
        .invRow { display: grid; grid-template-columns: 1fr 60px 130px 26px; gap: 8px; align-items: center; }
        .invDesc, .invQty, .invPrice { border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 13px; background: #fff; }
        .invDesc:focus, .invQty:focus, .invPrice:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
        .invRemove { background: var(--red-soft); color: var(--red); border: none; border-radius: 6px; width: 26px; height: 30px; font-size: 12px; cursor: pointer; }
        .btn.small { padding: 6px 12px; font-size: 12px; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 14px 0 5px; }
        textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13px; font-family: inherit; resize: vertical; background: #fff; }
        textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
        .invTotal { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 14px; }
        .invTotal span { color: var(--muted); }
        .invTotal strong { color: var(--navy); font-size: 17px; }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
        .msg { margin-top: 10px; font-size: 13px; color: var(--green); line-height: 1.4; }
        @media (max-width: 560px) { .invRow { grid-template-columns: 1fr; } }
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

// ---------- Add school ----------
function AddSchool({ operatorEmail, onClose, onDone }: { operatorEmail: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ school_key: "", name: "", contact_person: "", contact_email: "", app_url: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr(null);
    if (!f.school_key.trim() || !f.name.trim()) { setErr("Key and name are required."); return; }
    setBusy(true);
    const { data, error } = await supabase.from("schools").insert({
      school_key: f.school_key.trim().toLowerCase(),
      name: f.name.trim(),
      contact_person: f.contact_person.trim() || null,
      contact_email: f.contact_email.trim() || null,
      app_url: f.app_url.trim() || null,
    }).select().single();
    if (error) { setBusy(false); setErr(error.message.includes("duplicate") ? "That school key already exists." : error.message); return; }
    await supabase.from("activity_log").insert({
      school_id: (data as any).id, school_key: f.school_key.trim().toLowerCase(),
      event: "registered", detail: "School registered on SUIBING Bucket", by_email: operatorEmail,
    });
    setBusy(false);
    onDone();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="mh"><h3>Add school</h3><button className="x" onClick={onClose}>✕</button></div>
        <label>School key (short, unique, e.g. "assalam")</label>
        <input value={f.school_key} onChange={(e) => up("school_key", e.target.value)} />
        <label>School name</label>
        <input value={f.name} onChange={(e) => up("name", e.target.value)} />
        <div className="two">
          <div><label>Contact person</label><input value={f.contact_person} onChange={(e) => up("contact_person", e.target.value)} /></div>
          <div><label>Contact email</label><input value={f.contact_email} onChange={(e) => up("contact_email", e.target.value)} /></div>
        </div>
        <label>App URL</label>
        <input value={f.app_url} onChange={(e) => up("app_url", e.target.value)} placeholder="https://..." />
        {err && <div className="err">{err}</div>}
        <div className="mf">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Add school"}</button>
        </div>
        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 60; }
          .modal { width: 100%; max-width: 460px; padding: 24px; }
          .mh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
          h3 { font-size: 18px; font-weight: 700; }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
          input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; }
          input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        `}</style>
      </div>
    </div>
  );
}
