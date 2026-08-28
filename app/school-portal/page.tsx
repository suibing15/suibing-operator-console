"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { fileToBase64, receiptDataUrl } from "@/lib/receipts";
import WhatsAppButton from "@/app/components/WhatsAppButton";

type Session = { schoolKey: string; pin: string; name: string };

type Profile = {
  school_id: string; name: string; school_key: string; status: string;
  blocked_reason: string | null; portal_warning: string | null; plan: string; paid_until: string | null;
  students_count: number; records_count: number; counts_updated: string | null;
};

type InvoiceRow = {
  invoice_number: string; invoice_type: string;
  line_items: { description: string; qty: number; unit_price: number }[];
  currency: string; subtotal: number; total: number; notes: string | null;
  status: string; issued_at: string;
};

type PaymentRow = {
  id: string; invoice_number: string | null; amount: number | null; payment_date: string | null;
  note: string | null; receipt_data: string; receipt_mimetype: string; receipt_filename: string;
  status: string; reviewer_note: string | null; receipt_number: string | null; created_at: string;
};

type ActivityRow = { event: string; detail: string | null; amount: number | null; at: string };

const TYPE_LABEL: Record<string, string> = {
  subscription: "Subscription", hosting: "Hosting", storage: "Storage",
  domain: "Domain", custom: "Custom work", other: "Other",
};
const INV_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  issued: { label: "Awaiting payment", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};
const PAY_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  pending: { label: "Under review", tone: "amber" },
  confirmed: { label: "Confirmed", tone: "green" },
  rejected: { label: "Rejected", tone: "red" },
};

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SESSION_KEY = "suibing_school_session";

export default function SchoolPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
    if (raw) {
      try { setSession(JSON.parse(raw)); } catch {}
    }
    setCheckedStorage(true);
  }, []);

  function onLogin(s: Session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (!checkedStorage) return null;
  if (!session) return <PortalLogin onLogin={onLogin} />;
  return <PortalDashboard session={session} onLogout={logout} />;
}

function PortalLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const [schoolKey, setSchoolKey] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotKey, setForgotKey] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  async function login() {
    setErr(null);
    if (!schoolKey.trim() || !pin.trim()) { setErr("Enter your school key and PIN."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("school_portal_login", {
      p_school_key: schoolKey.trim().toLowerCase(), p_pin: pin.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setErr("Incorrect school key or PIN."); return; }
    onLogin({ schoolKey: schoolKey.trim().toLowerCase(), pin: pin.trim(), name: row.name });
  }

  async function requestReset() {
    setErr(null);
    if (!forgotKey.trim()) { setErr("Enter your school key first."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("request_pin_reset", { p_school_key: forgotKey.trim().toLowerCase() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setForgotSent(true);
  }

  return (
    <div className="page">
      <div className="split">
        <aside className="panel">
          <div className="panelInner">
            <div className="brandRow anim-1">
              <img src="/logo.png" alt="Suibing IT Services" className="logo" />
              <div>
                <div className="brandName">SUIBING</div>
                <div className="brandSub">IT Services</div>
              </div>
            </div>
            <h1 className="anim-2">Your school's account, in one place.</h1>
            <p className="tagline anim-3">View invoices, submit payment receipts, and track your account activity — all in your own private portal.</p>
            <ul className="points anim-4">
              <li><span className="dot">📊</span>See every invoice, filtered by type</li>
              <li><span className="dot">🧾</span>Upload payment receipts directly</li>
              <li><span className="dot">📅</span>Track your account activity by date</li>
            </ul>
            <div className="corpline anim-5">
              SUIBING LIMITED (RC 9801555)<br />
              trading as Suibing IT Services
            </div>
          </div>
        </aside>
        <main className="formSide">
          <div className="formCard anim-card">
            <h2>School portal sign-in</h2>
            <p className="sub">Enter the school key and PIN given to you by Suibing IT Services.</p>
            <label>School key</label>
            <input value={schoolKey} onChange={(e) => setSchoolKey(e.target.value)} placeholder="e.g. brightfuture" />
            <label>PIN</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" onKeyDown={(e) => e.key === "Enter" && login()} />
            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={login} disabled={busy} style={{ width: "100%", marginTop: 16 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className="forgotLink" onClick={() => { setForgotOpen((v) => !v); setForgotSent(false); setErr(null); }}>
              {forgotOpen ? "Hide" : "Forgot your PIN?"}
            </button>
            {forgotOpen && (
              <div className="forgotBox">
                {forgotSent ? (
                  <p className="forgotOk">Request sent — Suibing IT Services will reach out to reset your PIN.</p>
                ) : (
                  <>
                    <label>Confirm your school key</label>
                    <input value={forgotKey} onChange={(e) => setForgotKey(e.target.value)} placeholder="e.g. brightfuture" />
                    <button type="button" className="btn ghost" onClick={requestReset} disabled={busy} style={{ width: "100%", marginTop: 10 }}>
                      {busy ? "Sending…" : "Request PIN reset"}
                    </button>
                  </>
                )}
              </div>
            )}
            <p className="note">Don't have portal access yet? Contact Suibing IT Services to have it set up.</p>
          </div>
          <div className="links anim-links">
            <a href="/invoices">Check invoices by email instead</a>
            <span className="dot2">·</span>
            <a href="/login">Operator sign-in</a>
          </div>
        </main>
      </div>
      <WhatsAppButton />
      <style jsx>{styles}</style>
    </div>
  );
}

function PortalDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tab, setTab] = useState<"invoices" | "payments" | "activity" | "complaints" | "account" | "guide">("invoices");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    const { data } = await supabase.rpc("school_portal_login", { p_school_key: session.schoolKey, p_pin: session.pin });
    const row = Array.isArray(data) ? data[0] : data;
    setProfile((row as Profile) ?? null);
    setLoading(false);
  }

  useEffect(() => { loadProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function dismissWarning() {
    await supabase.rpc("dismiss_portal_warning", { p_school_key: session.schoolKey, p_pin: session.pin });
    loadProfile();
  }

  if (loading) return <div className="dashWrap"><p className="loadingMsg">Loading your account…</p><style jsx>{dashStyles}</style></div>;
  if (!profile) return (
    <div className="dashWrap">
      <p className="loadingMsg">Session expired or access was revoked. <button className="linkBtn" onClick={onLogout}>Sign in again</button></p>
      <style jsx>{dashStyles}</style>
    </div>
  );

  return (
    <div className="dashWrap">
      <header className="dashHeader">
        <div className="brand"><img src="/logo.png" alt="" className="logoSm" />SUIBING <span>School Portal</span></div>
        <div className="who">{profile.name} <button className="linkBtn" onClick={onLogout}>Sign out</button></div>
      </header>

      {profile.status === "disabled" && (
        <div className="blockedBanner">
          <strong>⚠ Your access is currently paused.</strong>
          <p>{profile.blocked_reason || "No reason was provided. Please contact us for details."}</p>
          <p className="contactLine">Contact Suibing IT Services: suibing15@gmail.com · +234 706 859 5598</p>
        </div>
      )}

      {profile.portal_warning && (
        <div className="warningBanner">
          <strong>Notice from Suibing IT Services</strong>
          <p>{profile.portal_warning}</p>
          <button className="btn ghost small" onClick={dismissWarning}>Dismiss</button>
        </div>
      )}

      <div className="statsStrip">
        <div className="statCard">
          <span className="statLabel">Students tracked</span>
          <span className="statValue">{profile.students_count.toLocaleString()}</span>
        </div>
        <div className="statCard">
          <span className="statLabel">Records on file</span>
          <span className="statValue">{profile.records_count.toLocaleString()}</span>
        </div>
        <div className="statCard statUpdated">
          <span className="statLabel">Last updated</span>
          <span className="statValueSmall">
            {profile.counts_updated
              ? new Date(profile.counts_updated).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
              : "Not yet updated"}
          </span>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "invoices" ? "tab on" : "tab"} onClick={() => setTab("invoices")}>Invoices</button>
        <button className={tab === "payments" ? "tab on" : "tab"} onClick={() => setTab("payments")}>Submit Payment</button>
        <button className={tab === "activity" ? "tab on" : "tab"} onClick={() => setTab("activity")}>Activity</button>
        <button className={tab === "complaints" ? "tab on" : "tab"} onClick={() => setTab("complaints")}>Support</button>
        <button className={tab === "account" ? "tab on" : "tab"} onClick={() => setTab("account")}>Account</button>
        <button className={tab === "guide" ? "tab on" : "tab"} onClick={() => setTab("guide")}>? Guide</button>
      </div>

      {tab === "invoices" && <InvoicesTab session={session} />}
      {tab === "payments" && <PaymentsTab session={session} />}
      {tab === "activity" && <ActivityTab session={session} />}
      {tab === "complaints" && <ComplaintsTab session={session} />}
      {tab === "account" && <AccountTab session={session} />}
      {tab === "guide" && <GuideTab />}

      <WhatsAppButton />
      <style jsx>{dashStyles}</style>
    </div>
  );
}

function InvoicesTab({ session }: { session: Session }) {
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("list_school_invoices_portal", { p_school_key: session.schoolKey, p_pin: session.pin })
      .then(({ data }) => setInvoices((data as InvoiceRow[]) ?? []));
  }, [session]);

  const visible = invoices?.filter((i) => filterType === "all" || i.invoice_type === filterType) ?? [];

  async function download(inv: InvoiceRow) {
    setDownloading(inv.invoice_number);
    const { generateInvoicePdf } = await import("@/lib/invoice");
    await generateInvoicePdf({
      invoiceNumber: inv.invoice_number,
      schoolName: session.name,
      schoolKey: session.schoolKey,
      currency: inv.currency,
      lineItems: inv.line_items.map((li) => ({ description: li.description, qty: li.qty, unitPrice: li.unit_price })),
      subtotal: inv.subtotal,
      total: inv.total,
      notes: inv.notes,
      issuedAt: inv.issued_at,
    });
    setDownloading(null);
  }

  return (
    <div className="tabPanel">
      <div className="filterRow">
        {["all", "subscription", "hosting", "storage", "domain", "custom", "other"].map((t) => (
          <button key={t} className={filterType === t ? "chip on" : "chip"} onClick={() => setFilterType(t)}>
            {t === "all" ? "All" : TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      {invoices === null ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="muted">No invoices in this category yet.</p>
      ) : (
        <div className="cardList">
          {visible.map((inv) => (
            <div key={inv.invoice_number} className="rowCard">
              <div className="rowTop">
                <div>
                  <div className="rowTitle">{inv.invoice_number}</div>
                  <div className="rowSub">{TYPE_LABEL[inv.invoice_type] ?? inv.invoice_type} · {new Date(inv.issued_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                </div>
                <span className={`pill ${INV_STATUS_LABEL[inv.status]?.tone ?? "amber"}`}>{INV_STATUS_LABEL[inv.status]?.label ?? inv.status}</span>
              </div>
              <div className="rowTotal">{fmtMoney(inv.total, inv.currency)}</div>
              <button className="btn ghost" disabled={downloading === inv.invoice_number} onClick={() => download(inv)} style={{ width: "100%", marginTop: 8 }}>
                {downloading === inv.invoice_number ? "Preparing…" : "⬇ Download PDF"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ session }: { session: Session }) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);

  async function loadPayments() {
    const { data } = await supabase.rpc("list_school_payments", { p_school_key: session.schoolKey, p_pin: session.pin });
    setPayments((data as PaymentRow[]) ?? []);
  }
  useEffect(() => { loadPayments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function downloadOfficialReceipt(p: PaymentRow, sess: Session) {
    if (!p.receipt_number) return;
    const { data } = await supabase.rpc("get_payment_receipt", {
      p_school_key: sess.schoolKey, p_pin: sess.pin, p_receipt_number: p.receipt_number,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;
    const { generateReceiptPdf } = await import("@/lib/receipt-of-payment");
    await generateReceiptPdf({
      receiptNumber: row.receipt_number,
      schoolName: row.school_name,
      invoiceNumber: row.invoice_number,
      amount: row.amount,
      paymentDate: row.payment_date,
      note: row.note,
      confirmedAt: row.confirmed_at,
    });
  }

  async function submit() {
    setErr(null); setMsg(null);
    if (!file) { setErr("Please attach your payment receipt (image or PDF)."); return; }
    if (!amount.trim() || parseFloat(amount) <= 0) { setErr("Enter a valid amount."); return; }
    setBusy(true);
    try {
      const { data, mimetype, filename } = await fileToBase64(file);
      const { error } = await supabase.rpc("submit_payment", {
        p_school_key: session.schoolKey, p_pin: session.pin,
        p_invoice_number: invoiceNumber.trim() || null,
        p_amount: parseFloat(amount), p_payment_date: paymentDate, p_note: note.trim() || null,
        p_receipt_data: data, p_receipt_mimetype: mimetype, p_receipt_filename: filename,
      });
      if (error) throw new Error(error.message);
      setMsg("Payment submitted for review. We'll confirm it shortly.");
      setInvoiceNumber(""); setAmount(""); setNote(""); setFile(null);
      loadPayments();
    } catch (e: any) {
      setErr(e?.message || "Could not submit payment.");
    }
    setBusy(false);
  }

  return (
    <div className="tabPanel">
      <div className="formBox card">
        <h3>Submit a payment</h3>
        <label>Invoice number (optional, if this payment is for a specific invoice)</label>
        <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-2026-0483" />
        <div className="two">
          <div><label>Amount paid (NGN)</label><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
          <div><label>Payment date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
        </div>
        <label>Note (optional)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid via OPay transfer" />
        <label>Receipt (image or PDF)</label>
        <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {err && <div className="err">{err}</div>}
        {msg && <div className="msgOk">{msg}</div>}
        <button className="btn ok" onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
          {busy ? "Uploading…" : "Submit payment"}
        </button>
      </div>

      <h3 className="sectionTitle">Your submitted payments</h3>
      {payments === null ? (
        <p className="muted">Loading…</p>
      ) : payments.length === 0 ? (
        <p className="muted">No payments submitted yet.</p>
      ) : (
        <div className="cardList">
          {payments.map((p) => (
            <div key={p.id} className="rowCard">
              <div className="rowTop">
                <div>
                  <div className="rowTitle">{p.invoice_number || "General payment"}</div>
                  <div className="rowSub">{p.payment_date ? new Date(p.payment_date).toLocaleDateString("en-GB") : new Date(p.created_at).toLocaleDateString("en-GB")}</div>
                </div>
                <span className={`pill ${PAY_STATUS_LABEL[p.status]?.tone ?? "amber"}`}>{PAY_STATUS_LABEL[p.status]?.label ?? p.status}</span>
              </div>
              {p.amount != null && <div className="rowTotal">NGN {Number(p.amount).toLocaleString("en-NG", { minimumFractionDigits: 2 })}</div>}
              {p.note && <div className="rowNote">{p.note}</div>}
              {p.reviewer_note && <div className="rowNote reviewer"><strong>Note from Suibing:</strong> {p.reviewer_note}</div>}
              <div className="receiptRow">
                <a className="receiptLink" href={receiptDataUrl(p.receipt_data, p.receipt_mimetype)} target="_blank" rel="noreferrer" download={p.receipt_filename}>View my uploaded proof ↗</a>
                {p.status === "confirmed" && p.receipt_number && (
                  <button
                    className="btn ok"
                    type="button"
                    onClick={() => downloadOfficialReceipt(p, session)}
                    style={{ marginTop: 8 }}
                  >
                    ⬇ Download official receipt ({p.receipt_number})
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({ session }: { session: Session }) {
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  async function load() {
    const { data } = await supabase.rpc("list_school_activity_portal", {
      p_school_key: session.schoolKey, p_pin: session.pin,
      p_from: dateFrom || null, p_to: dateTo || null,
    });
    setActivity((data as ActivityRow[]) ?? []);
  }
  useEffect(() => { load(); }, [dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="tabPanel">
      <div className="dateFilterRow">
        <div><label>From</label><input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><label>To</label><input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        {(dateFrom || dateTo) && <button className="btn ghost small" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</button>}
      </div>
      {activity === null ? (
        <p className="muted">Loading…</p>
      ) : activity.length === 0 ? (
        <p className="muted">No activity in this range.</p>
      ) : (
        <div className="cardList">
          {activity.map((a, i) => (
            <div key={i} className="rowCard slim">
              <div className="rowTop">
                <span className="evPill">{a.event.replace(/_/g, " ")}</span>
                <span className="rowSub">{new Date(a.at).toLocaleString("en-GB")}</span>
              </div>
              {a.detail && <div className="rowNote">{a.detail}{a.amount != null ? ` · NGN ${Number(a.amount).toLocaleString("en-NG")}` : ""}</div>}
            </div>
          ))}
        </div>
      )}
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
  .brandRow { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; }
  .brandName { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
  .brandSub { font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 500; }
  h1 { font-size: 28px; font-weight: 800; line-height: 1.25; margin-bottom: 16px; letter-spacing: -0.01em; }
  .tagline { font-size: 15px; color: rgba(255,255,255,0.78); line-height: 1.6; margin-bottom: 32px; }
  .points { list-style: none; display: flex; flex-direction: column; gap: 14px; margin-bottom: 48px; }
  .points li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.88); line-height: 1.5; }
  .points .dot { font-size: 15px; line-height: 1; flex-shrink: 0; }
  .corpline { font-size: 11.5px; color: rgba(255,255,255,0.5); line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.12); }
  .anim-1, .anim-2, .anim-3, .anim-4, .anim-5 { opacity: 0; animation: sbFadeUp 0.6s ease-out forwards; }
  .anim-1 { animation-delay: 0.05s; } .anim-2 { animation-delay: 0.15s; } .anim-3 { animation-delay: 0.25s; } .anim-4 { animation-delay: 0.35s; } .anim-5 { animation-delay: 0.45s; }
  .formSide { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; gap: 18px; }
  .formCard { background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 4px 24px rgba(20,28,45,0.06); padding: 36px; width: 100%; max-width: 420px; }
  .anim-card { opacity: 0; animation: sbScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; }
  .anim-links { opacity: 0; animation: sbFadeIn 0.5s ease-out 0.5s forwards; }
  h2 { font-size: 21px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .sub { color: var(--muted); font-size: 13.5px; margin: 4px 0 22px; line-height: 1.5; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 14px 0 6px; }
  input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; font-size: 14px; font-family: inherit; background: #fff; box-sizing: border-box; }
  input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  .err { background: var(--red-soft); color: var(--red); padding: 10px 13px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
  .note { font-size: 12px; color: var(--muted); line-height: 1.5; margin-top: 14px; text-align: center; }
  .forgotLink { display: block; width: 100%; text-align: center; background: none; border: none; color: var(--navy); font-size: 12.5px; font-weight: 600; cursor: pointer; margin-top: 12px; }
  .forgotLink:hover { text-decoration: underline; }
  .forgotBox { margin-top: 10px; padding: 12px; background: var(--paper-2); border-radius: var(--radius-sm); }
  .forgotBox label { display: block; font-size: 11.5px; font-weight: 600; color: var(--ink-2); margin-bottom: 5px; }
  .forgotBox input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 8px 10px; font-size: 13px; box-sizing: border-box; }
  .forgotOk { font-size: 12.5px; color: var(--green); line-height: 1.5; margin: 0; }
  .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
  .links a { color: var(--navy); text-decoration: none; font-weight: 600; }
  .links a:hover { text-decoration: underline; }
  .dot2 { color: var(--muted); }
`;

type ComplaintRow = { id: string; subject: string; status: string; created_at: string; updated_at: string; message_count: number };
type ComplaintMessage = { id: string; sender: "school" | "operator"; body: string; created_at: string };

function ComplaintsTab({ session }: { session: Session }) {
  const [complaints, setComplaints] = useState<ComplaintRow[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const { data } = await supabase.rpc("list_school_complaints", { p_school_key: session.schoolKey, p_pin: session.pin });
    setComplaints((data as ComplaintRow[]) ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (openId) {
    return <ComplaintThread session={session} complaintId={openId} onBack={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="tabPanel">
      <div className="filterRow" style={{ justifyContent: "space-between" }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>Support & complaints</h3>
        <button className="btn ok" onClick={() => setShowNew(true)}>New complaint</button>
      </div>
      {showNew && <NewComplaintForm session={session} onClose={() => setShowNew(false)} onSubmitted={(id) => { setShowNew(false); load(); setOpenId(id); }} />}
      {complaints === null ? (
        <p className="muted">Loading…</p>
      ) : complaints.length === 0 ? (
        <p className="muted">No complaints submitted yet. If something isn't working right, let us know using "New complaint" above.</p>
      ) : (
        <div className="cardList">
          {complaints.map((c) => (
            <div key={c.id} className="rowCard" style={{ cursor: "pointer" }} onClick={() => setOpenId(c.id)}>
              <div className="rowTop">
                <div>
                  <div className="rowTitle">{c.subject}</div>
                  <div className="rowSub">{c.message_count} message{c.message_count !== 1 ? "s" : ""} · Updated {new Date(c.updated_at).toLocaleDateString("en-GB")}</div>
                </div>
                <span className={`pill ${c.status === "open" ? "amber" : "green"}`}>{c.status === "open" ? "Open" : "Resolved"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewComplaintForm({ session, onClose, onSubmitted }: { session: Session; onClose: () => void; onSubmitted: (id: string) => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!subject.trim() || !message.trim()) { setErr("Enter a subject and describe the issue."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_complaint", {
      p_school_key: session.schoolKey, p_pin: session.pin, p_subject: subject.trim(), p_message: message.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSubmitted(data as string);
  }

  return (
    <div className="formBox card" style={{ marginBottom: 16 }}>
      <h3>New complaint</h3>
      <label>Subject</label>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Invoice amount looks wrong" />
      <label>Describe the issue</label>
      <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
      {err && <div className="err">{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
        <button className="btn ok" onClick={submit} disabled={busy} style={{ flex: 1 }}>{busy ? "Sending…" : "Submit"}</button>
      </div>
    </div>
  );
}

function ComplaintThread({ session, complaintId, onBack }: { session: Session; complaintId: string; onBack: () => void }) {
  const [messages, setMessages] = useState<ComplaintMessage[] | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc("get_complaint_thread", {
      p_school_key: session.schoolKey, p_pin: session.pin, p_complaint_id: complaintId,
    });
    setMessages((data as ComplaintMessage[]) ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function sendReply() {
    setErr(null);
    if (!reply.trim()) { setErr("Enter a message."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("reply_to_complaint_as_school", {
      p_school_key: session.schoolKey, p_pin: session.pin, p_complaint_id: complaintId, p_message: reply.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setReply("");
    load();
  }

  return (
    <div className="tabPanel">
      <button className="btn ghost small" onClick={onBack} style={{ marginBottom: 14 }}>← Back to all complaints</button>
      <div className="threadBox card">
        {messages === null ? (
          <p className="muted">Loading…</p>
        ) : (
          <div className="threadList">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.sender === "school" ? "mine" : "theirs"}`}>
                <div className="bubbleSender">{m.sender === "school" ? "You" : "Suibing IT Services"}</div>
                <div className="bubbleBody">{m.body}</div>
                <div className="bubbleTime">{new Date(m.created_at).toLocaleString("en-GB")}</div>
              </div>
            ))}
          </div>
        )}
        <div className="replyBox">
          <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" />
          {err && <div className="err">{err}</div>}
          <button className="btn ok" onClick={sendReply} disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {busy ? "Sending…" : "Send reply"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GuideTab() {
  const steps: { title: string; body: string }[] = [
    { title: "Check what you owe", body: "Open Invoices to see every bill from Suibing IT Services, whether it's paid, pending, or overdue, and download a PDF copy any time." },
    { title: "Pay an invoice", body: "Open Submit Payment, select the invoice, upload a screenshot or photo of your payment receipt, and confirm. We'll review it and mark it as paid." },
    { title: "See your student/record counts", body: "The numbers at the top of your dashboard always show exactly what's currently tracked for your school, updated automatically." },
    { title: "Report a problem or ask a question", body: "Open Support and click New complaint. Describe the issue, and we'll reply right there — you'll see our response the next time you check that tab." },
    { title: "Everything we've done for your account", body: "Open Activity to see a full history: invoices issued, payments confirmed, and anything else we've updated for you." },
    { title: "Change your PIN", body: "Open Account, enter your current PIN, then set a new one. Keep it somewhere safe — we can never see or recover it for you." },
    { title: "Forgot your PIN?", body: "On the sign-in screen, tap \"Forgot your PIN?\", confirm your school key, and we'll be notified to help you reset it." },
  ];
  return (
    <div className="tabPanel">
      <p className="guideIntro">A quick guide to everything you can do here.</p>
      <div className="cardList">
        {steps.map((s, i) => (
          <div key={i} className="rowCard guideCard">
            <div className="guideNum">{i + 1}</div>
            <div>
              <div className="rowTitle">{s.title}</div>
              <div className="rowSub" style={{ marginTop: 4 }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ marginTop: 16, textAlign: "center" }}>
        Still stuck? Use the WhatsApp button in the corner — we're happy to help.
      </p>
    </div>
  );
}

function AccountTab({ session }: { session: Session }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function changePin() {
    setErr(null); setMsg(null);
    if (!currentPin.trim()) { setErr("Enter your current PIN."); return; }
    if (newPin.trim().length < 4) { setErr("New PIN must be at least 4 characters."); return; }
    if (newPin.trim() !== confirmPin.trim()) { setErr("New PIN and confirmation do not match."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("change_school_pin", {
      p_school_key: session.schoolKey, p_current_pin: currentPin.trim(), p_new_pin: newPin.trim(),
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("PIN updated. Use your new PIN next time you sign in.");
    setCurrentPin(""); setNewPin(""); setConfirmPin("");
  }

  return (
    <div className="tabPanel">
      <div className="formBox card">
        <h3>Change your PIN</h3>
        <label>Current PIN</label>
        <input type="password" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
        <label>New PIN (min. 4 characters)</label>
        <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
        <label>Confirm new PIN</label>
        <input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && changePin()} />
        {err && <div className="err">{err}</div>}
        {msg && <div className="msgOk">{msg}</div>}
        <button className="btn ok" onClick={changePin} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
          {busy ? "Updating…" : "Update PIN"}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 14 }}>School key: <strong>{session.schoolKey}</strong></p>
    </div>
  );
}

const dashStyles = `
  .threadBox { padding: 18px; }
  .threadList { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; margin-bottom: 16px; }
  .bubble { max-width: 80%; padding: 10px 14px; border-radius: 12px; }
  .bubble.mine { align-self: flex-end; background: var(--navy); color: #fff; }
  .bubble.theirs { align-self: flex-start; background: var(--paper-2); color: var(--ink); }
  .bubbleSender { font-size: 10.5px; font-weight: 700; text-transform: uppercase; opacity: 0.7; margin-bottom: 3px; }
  .bubbleBody { font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; }
  .bubbleTime { font-size: 10px; opacity: 0.6; margin-top: 4px; }
  .replyBox { border-top: 1px solid var(--line); padding-top: 14px; }
  .replyBox textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; resize: vertical; box-sizing: border-box; }
  .dashWrap { min-height: 100vh; background: var(--paper-2); padding: 24px; }
  .loadingMsg { text-align: center; padding: 60px 20px; color: var(--muted); font-size: 14px; }
  .linkBtn { background: none; border: none; color: var(--navy); font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; margin-left: 4px; }
  .dashHeader { display: flex; justify-content: space-between; align-items: center; max-width: 900px; margin: 0 auto 20px; padding-bottom: 18px; border-bottom: 1px solid var(--line); }
  .brand { font-size: 17px; font-weight: 800; color: var(--navy); display: flex; align-items: center; gap: 10px; }
  .brand span { font-weight: 500; color: var(--ink-2); }
  .logoSm { width: 28px; height: 28px; border-radius: 6px; }
  .who { font-size: 13px; color: var(--muted); }
  .blockedBanner { max-width: 900px; margin: 0 auto 16px; background: var(--red-soft); border-radius: var(--radius-sm); padding: 16px 18px; }
  .blockedBanner strong { color: var(--red); font-size: 14px; display: block; margin-bottom: 6px; }
  .blockedBanner p { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 4px; }
  .contactLine { font-weight: 600; }
  .warningBanner { max-width: 900px; margin: 0 auto 16px; background: #FBF0DC; border-radius: var(--radius-sm); padding: 16px 18px; }
  .warningBanner strong { color: var(--amber); font-size: 14px; display: block; margin-bottom: 6px; }
  .warningBanner p { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 10px; }
  .statsStrip { max-width: 900px; margin: 0 auto 20px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .statCard { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
  .statLabel { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
  .statValue { font-size: 24px; font-weight: 800; color: var(--navy); }
  .statValueSmall { font-size: 14px; font-weight: 700; color: var(--ink); }
  .statCard.statUpdated { background: var(--paper-2); }
  @media (max-width: 560px) { .statsStrip { grid-template-columns: 1fr; } }
  .tabs { max-width: 900px; margin: 0 auto 20px; display: flex; gap: 4px; border-bottom: 1px solid var(--line); }
  .tab { background: none; border: none; padding: 10px 16px; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .tab.on { color: var(--navy); border-bottom-color: var(--navy); }
  .tabPanel { max-width: 900px; margin: 0 auto; }
  .filterRow { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
  .chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
  .muted { color: var(--muted); font-size: 14px; }
  .cardList { display: flex; flex-direction: column; gap: 12px; }
  .rowCard { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 16px; transition: box-shadow 0.2s; }
  .guideIntro { font-size: 13.5px; color: var(--ink-2); margin-bottom: 16px; }
  .guideCard { display: flex; gap: 14px; align-items: flex-start; }
  .guideNum { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--navy); color: #fff; font-size: 12.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .rowCard:hover { box-shadow: 0 4px 16px rgba(20,28,45,0.06); }
  .rowCard.slim { padding: 12px 16px; }
  .rowTop { display: flex; justify-content: space-between; align-items: flex-start; }
  .rowTitle { font-weight: 700; color: var(--ink); font-size: 14px; }
  .rowSub { font-size: 12px; color: var(--muted); margin-top: 2px; }
  .rowTotal { font-size: 18px; font-weight: 700; color: var(--navy); margin-top: 6px; }
  .rowNote { font-size: 13px; color: var(--ink-2); margin-top: 8px; line-height: 1.4; }
  .rowNote.reviewer { background: var(--navy-soft); padding: 8px 10px; border-radius: 6px; }
  .receiptLink { display: inline-block; font-size: 13px; color: var(--navy); font-weight: 600; margin-top: 10px; }
  .receiptRow { display: flex; flex-direction: column; align-items: flex-start; }
  .pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
  .pill.amber { background: #FBF0DC; color: var(--amber); }
  .pill.green { background: var(--green-soft); color: var(--green); }
  .pill.red { background: var(--red-soft); color: var(--red); }
  .evPill { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; background: var(--navy-soft); color: var(--navy); }
  .formBox { padding: 20px; margin-bottom: 24px; }
  .formBox h3 { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 12px; }
  .sectionTitle { font-size: 15px; font-weight: 700; color: var(--ink); margin: 24px 0 12px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
  input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; background: #fff; box-sizing: border-box; }
  input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
  .msgOk { color: var(--green); font-size: 13px; margin-top: 10px; }
  .dateFilterRow { display: flex; gap: 10px; align-items: end; margin-bottom: 16px; }
  .btn.small { padding: 7px 12px; font-size: 12px; }
  @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
`;
