"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import BroadcastBar from "@/app/components/BroadcastBar";

type InvoiceRow = {
  invoice_number: string;
  line_items: { description: string; qty: number; unit_price: number }[];
  currency: string;
  subtotal: number;
  total: number;
  notes: string | null;
  status: "issued" | "paid" | "cancelled";
  issued_at: string;
};

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  issued: { label: "Awaiting payment", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvoiceStatus() {
  const [schoolKey, setSchoolKey] = useState("");
  const [email, setEmail] = useState("");
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingNum, setDownloadingNum] = useState<string | null>(null);

  async function lookup() {
    setErr(null); setInvoices(null);
    if (!schoolKey.trim() || !email.trim()) { setErr("Enter both your school key and contact email."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("list_school_invoices", {
      p_school_key: schoolKey.trim().toLowerCase(), p_email: email.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const rows = (data as InvoiceRow[]) ?? [];
    if (rows.length === 0) { setErr("No invoices found — check your school key and email, or that an invoice has been issued yet."); return; }
    setInvoices(rows);
  }

  async function download(inv: InvoiceRow) {
    setDownloadingNum(inv.invoice_number);
    const { data } = await supabase.rpc("get_school_invoice", {
      p_school_key: schoolKey.trim().toLowerCase(), p_email: email.trim(), p_invoice_number: inv.invoice_number,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      const { generateInvoicePdf } = await import("@/lib/invoice");
      await generateInvoicePdf({
        invoiceNumber: row.invoice_number,
        schoolName: row.school_name,
        schoolKey: schoolKey.trim().toLowerCase(),
        currency: row.currency,
        lineItems: (row.line_items as any[]).map((li) => ({ description: li.description, qty: li.qty, unitPrice: li.unit_price })),
        subtotal: row.subtotal,
        total: row.total,
        notes: row.notes,
        issuedAt: row.issued_at,
      });
    }
    setDownloadingNum(null);
  }

  return (
    <div className="page">
      <BroadcastBar />
      <div className="split">
        <aside className="panel">
          <div className="panelInner">
            <a href="/" className="brandRow anim-1" title="Back to home">
              <img src="/logo.png" alt="Suibing IT Services" className="logo" />
              <div>
                <div className="brandName">SUIBING</div>
                <div className="brandSub">IT Services</div>
              </div>
            </a>
            <h1 className="anim-2">Your invoices, whenever you need them.</h1>
            <p className="tagline anim-3">Look up and download any invoice issued to your school — registration, subscription renewals, or custom work.</p>
            <ul className="points anim-4">
              <li><span className="dot">🔑</span>No password to remember — just your school key and email</li>
              <li><span className="dot">📄</span>Every invoice is a properly branded PDF</li>
              <li><span className="dot">💬</span>Questions? Contact us directly, details below</li>
            </ul>
            <div className="corpline anim-5">
              SUIBING LIMITED (RC 9801555)<br />
              trading as Suibing IT Services<br />
              suibing15@gmail.com · +234 706 859 5598
            </div>
          </div>
        </aside>

        <main className="formSide">
          <div className="formCard wide anim-card">
            <h2>Find your invoices</h2>
            <p className="sub">Enter your school key and the contact email on file with us.</p>

            <label>School key</label>
            <input value={schoolKey} onChange={(e) => setSchoolKey(e.target.value)} placeholder="e.g. brightfuture" />
            <label>Contact email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" onKeyDown={(e) => e.key === "Enter" && lookup()} />

            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={lookup} disabled={busy} style={{ width: "100%", marginTop: 16 }}>
              {busy ? "Searching…" : "Find invoices"}
            </button>

            {invoices && (
              <div className="invList">
                {invoices.map((inv, i) => (
                  <div key={inv.invoice_number} className="invCard" style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className="invHead">
                      <div>
                        <div className="invNum">{inv.invoice_number}</div>
                        <div className="invDate">{new Date(inv.issued_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                      </div>
                      <span className={`pill ${STATUS_LABEL[inv.status].tone}`}>{STATUS_LABEL[inv.status].label}</span>
                    </div>
                    <div className="invTotal">{fmtMoney(inv.total, inv.currency)}</div>
                    <button className="btn ghost" type="button" disabled={downloadingNum === inv.invoice_number}
                      onClick={() => download(inv)} style={{ width: "100%", marginTop: 10 }}>
                      {downloadingNum === inv.invoice_number ? "Preparing PDF…" : "⬇ Download PDF"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="links">
            <a href="/apply">Apply for school services</a>
            <span className="dot2">·</span>
            <a href="/login">Operator sign-in</a>
          </div>
        </main>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page { min-height: 100vh; background: var(--paper-2); }
  .split { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; }
  @media (max-width: 900px) { .split { grid-template-columns: 1fr; } }

  .panel { background: linear-gradient(160deg, var(--navy) 0%, #14213d 100%); color: #fff; display: flex; align-items: center; padding: 48px; position: relative; overflow: hidden; }
  .panel::before { content: ""; position: absolute; width: 400px; height: 400px; border-radius: 50%; background: rgba(255,255,255,0.04); top: -120px; right: -120px; animation: sbFloat 9s ease-in-out infinite; }
  .panel::after { content: ""; position: absolute; width: 300px; height: 300px; border-radius: 50%; background: rgba(255,255,255,0.03); bottom: -100px; left: -80px; animation: sbFloat 11s ease-in-out infinite reverse; }
  .panelInner { position: relative; max-width: 440px; margin: 0 auto; }
  .brandRow { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; text-decoration: none; transition: opacity 0.15s; } .brandRow:hover { opacity: 0.8; }
  .logo { width: 44px; height: 44px; border-radius: 10px; }
  .brandName { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
  .brandSub { font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 500; }
  h1 { font-size: 30px; font-weight: 800; line-height: 1.25; margin-bottom: 16px; letter-spacing: -0.01em; }
  .tagline { font-size: 15px; color: rgba(255,255,255,0.78); line-height: 1.6; margin-bottom: 32px; }
  .points { list-style: none; display: flex; flex-direction: column; gap: 14px; margin-bottom: 48px; }
  .points li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.88); line-height: 1.5; }
  .points .dot { font-size: 15px; line-height: 1; flex-shrink: 0; }
  .corpline { font-size: 11.5px; color: rgba(255,255,255,0.5); line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.12); }

  .anim-1, .anim-2, .anim-3, .anim-4, .anim-5 { opacity: 0; animation: sbFadeUp 0.6s ease-out forwards; }
  .anim-1 { animation-delay: 0.05s; }
  .anim-2 { animation-delay: 0.15s; }
  .anim-3 { animation-delay: 0.25s; }
  .anim-4 { animation-delay: 0.35s; }
  .anim-5 { animation-delay: 0.45s; }

  .formSide { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; gap: 18px; }
  .formCard { background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 4px 24px rgba(20,28,45,0.06); padding: 36px; width: 100%; max-width: 440px; transition: box-shadow 0.3s ease; }
  .formCard:hover { box-shadow: 0 10px 36px rgba(20,28,45,0.1); }
  .formCard.wide { max-width: 480px; }
  .anim-card { opacity: 0; animation: sbScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; }
  h2 { font-size: 21px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .sub { color: var(--muted); font-size: 13.5px; margin: 4px 0 22px; line-height: 1.5; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 14px 0 6px; }
  input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; font-size: 14px; font-family: inherit; background: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
  input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  .err { background: var(--red-soft); color: var(--red); padding: 10px 13px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; animation: sbFadeUp 0.25s ease-out; }
  .invList { display: flex; flex-direction: column; gap: 12px; margin-top: 22px; padding-top: 20px; border-top: 1px solid var(--line); }
  .invCard { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px 16px; opacity: 0; animation: sbFadeUp 0.4s ease-out forwards; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
  .invCard:hover { border-color: var(--navy); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(20,28,45,0.08); }
  .invHead { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .invNum { font-weight: 700; color: var(--ink); font-size: 14px; }
  .invDate { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .invTotal { font-size: 18px; font-weight: 700; color: var(--navy); }
  .pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 10px; border-radius: 999px; }
  .pill.amber { background: #FBF0DC; color: var(--amber); }
  .pill.green { background: var(--green-soft); color: var(--green); }
  .pill.red { background: var(--red-soft); color: var(--red); }
  .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
  .links a { color: var(--navy); text-decoration: none; font-weight: 600; transition: color 0.15s; }
  .links a:hover { text-decoration: underline; color: var(--navy-2); }
  .dot2 { color: var(--muted); }
`;
