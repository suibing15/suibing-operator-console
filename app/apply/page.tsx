"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const PRODUCTS = [
  { value: "bucket", label: "SUIBING Bucket (school records)" },
  { value: "ssms", label: "SSMS (school management + CBT)" },
  { value: "ledger", label: "SuibingLedger (fees, admission, report sheets)" },
  { value: "e_examiner", label: "E-Examiner Contract" },
  { value: "tracker", label: "Tracker (personal expense tracking)" },
  { value: "website", label: "Website development" },
  { value: "app", label: "App development for business" },
  { value: "custom", label: "Custom / bespoke work" },
];

type Result = { form_number: string; login_code: string };

export default function Apply() {
  const [requestType, setRequestType] = useState<"new" | "update">("new");
  const [f, setF] = useState({
    product: "bucket", org_name: "", contact_person: "",
    contact_email: "", contact_phone: "", message: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setErr(null);
    if (!f.org_name.trim() || !f.contact_person.trim() || !f.contact_phone.trim()) {
      setErr("School/organisation name, contact person, and phone number are required.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_prospect", {
      p_request_type: requestType,
      p_product: f.product,
      p_org_name: f.org_name.trim(),
      p_contact_person: f.contact_person.trim(),
      p_contact_email: f.contact_email.trim() || null,
      p_contact_phone: f.contact_phone.trim(),
      p_message: f.message.trim() || null,
      p_existing_school_id: null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    setResult(row as Result);
  }

  if (result) {
    return (
      <div className="wrap">
        <div className="card box">
          <div className="brand">SUIBING <span>IT Services</span></div>
          <h1>Application received</h1>
          <p className="lead">Please save these details — you'll need both to check your status or make changes.</p>
          <div className="ticket">
            <div className="tRow"><span>Form number</span><strong>{result.form_number}</strong></div>
            <div className="tRow"><span>Login ID</span><strong>{result.login_code}</strong></div>
          </div>
          <p className="note">We recommend writing these down or taking a screenshot now — they will not be shown again.</p>
          <a className="btn" href="/apply/status" style={{ display: "inline-block", textDecoration: "none", marginTop: 16 }}>
            Go to status check
          </a>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="card box">
        <div className="brand">SUIBING <span>IT Services</span></div>
        <p className="sub">Apply for a school service, or request an update</p>

        <div className="toggle">
          <button className={requestType === "new" ? "seg on" : "seg"} onClick={() => setRequestType("new")}>New signup</button>
          <button className={requestType === "update" ? "seg on" : "seg"} onClick={() => setRequestType("update")}>Update / add service</button>
        </div>

        <label>Product / service</label>
        <select value={f.product} onChange={(e) => up("product", e.target.value)}>
          {PRODUCTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <label>School / organisation name</label>
        <input value={f.org_name} onChange={(e) => up("org_name", e.target.value)} />

        <div className="two">
          <div>
            <label>Contact person</label>
            <input value={f.contact_person} onChange={(e) => up("contact_person", e.target.value)} />
          </div>
          <div>
            <label>Phone number</label>
            <input value={f.contact_phone} onChange={(e) => up("contact_phone", e.target.value)} placeholder="+234..." />
          </div>
        </div>

        <label>Email (optional)</label>
        <input value={f.contact_email} onChange={(e) => up("contact_email", e.target.value)} placeholder="you@example.com" />

        <label>{requestType === "new" ? "Tell us about your school and what you need" : "What update or addition would you like?"}</label>
        <textarea rows={4} value={f.message} onChange={(e) => up("message", e.target.value)} />

        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 14 }}>
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </div>
      <div className="links">
        <a href="/apply/status">Already applied? Check status</a>
        <span className="dot">·</span>
        <a href="/login">Operator sign-in</a>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; }
  .box { padding: 34px; width: 100%; max-width: 460px; }
  .brand { font-size: 24px; font-weight: 800; color: var(--navy); letter-spacing: -0.02em; }
  .brand span { font-weight: 400; }
  .sub { color: var(--muted); font-size: 13px; margin: 2px 0 20px; }
  h1 { font-size: 20px; font-weight: 700; color: var(--ink); margin: 14px 0 6px; }
  .lead { font-size: 14px; color: var(--ink-2); margin-bottom: 18px; line-height: 1.5; }
  .toggle { display: flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 18px; }
  .seg { flex: 1; background: #fff; border: none; padding: 10px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
  .seg.on { background: var(--navy); color: #fff; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
  input, select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; background: #fff; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
  .ticket { background: var(--navy-soft); border-radius: var(--radius-sm); padding: 16px; margin: 10px 0; }
  .tRow { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 14px; }
  .tRow span { color: var(--ink-2); }
  .tRow strong { color: var(--navy); font-size: 16px; letter-spacing: 0.02em; }
  .note { font-size: 12px; color: var(--muted); line-height: 1.5; }
  .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
  .links a { color: var(--navy); text-decoration: none; font-weight: 600; }
  .links a:hover { text-decoration: underline; }
  .links .dot { color: var(--muted); }
`;
