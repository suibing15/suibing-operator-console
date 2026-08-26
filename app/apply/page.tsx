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
            <h1 className="anim-2">School software and services, built for Nigerian schools.</h1>
            <p className="tagline anim-3">Records, examinations, fees, and more — one company, one point of contact, from setup through to support.</p>
            <ul className="points anim-4">
              <li><span className="dot" />Free onboarding training on every new subscription</li>
              <li><span className="dot" />Your data stays yours — export any time, on your terms</li>
              <li><span className="dot" />Direct support from the people who build the software</li>
            </ul>
            <div className="corpline anim-5">
              SUIBING LIMITED (RC 9801555)<br />
              trading as Suibing IT Services
            </div>
          </div>
        </aside>

        <main className="formSide">
          {result ? (
            <div className="formCard anim-card">
              <div className="check">✓</div>
              <h2>Application received</h2>
              <p className="lead">Save these details — you'll need both to check your status or make changes.</p>
              <div className="ticket">
                <div className="tRow"><span>Form number</span><strong>{result.form_number}</strong></div>
                <div className="tRow"><span>Login ID</span><strong>{result.login_code}</strong></div>
              </div>
              <p className="note">Write these down or take a screenshot now — they will not be shown again.</p>
              <a className="btn" href="/apply/status" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 18 }}>
                Go to status check
              </a>
            </div>
          ) : (
            <div className="formCard anim-card">
              <h2>Apply for a service</h2>
              <p className="sub">Tell us what you need — we'll review and get back to you.</p>

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
              <button className="btn" onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 16 }}>
                {busy ? "Submitting…" : "Submit application"}
              </button>
            </div>
          )}

          <div className="links anim-links">
            <a href="/apply/status">Already applied? Check status</a>
            <span className="dot2">·</span>
            <a href="/careers">Careers</a>
            <span className="dot2">·</span>
            <a href="/invoices">Check invoices</a>
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
  .brandRow { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
  .logo { width: 44px; height: 44px; border-radius: 10px; }
  .brandName { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
  .brandSub { font-size: 12px; color: rgba(255,255,255,0.65); font-weight: 500; }
  h1 { font-size: 30px; font-weight: 800; line-height: 1.25; margin-bottom: 16px; letter-spacing: -0.01em; }
  .tagline { font-size: 15px; color: rgba(255,255,255,0.78); line-height: 1.6; margin-bottom: 32px; }
  .points { list-style: none; display: flex; flex-direction: column; gap: 14px; margin-bottom: 48px; }
  .points li { display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.88); line-height: 1.5; }
  .points .dot { width: 6px; height: 6px; border-radius: 50%; background: #6DD3A8; margin-top: 7px; flex-shrink: 0; }
  .corpline { font-size: 11.5px; color: rgba(255,255,255,0.5); line-height: 1.6; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.12); }

  .anim-1, .anim-2, .anim-3, .anim-4, .anim-5 { opacity: 0; animation: sbFadeUp 0.6s ease-out forwards; }
  .anim-1 { animation-delay: 0.05s; }
  .anim-2 { animation-delay: 0.15s; }
  .anim-3 { animation-delay: 0.25s; }
  .anim-4 { animation-delay: 0.35s; }
  .anim-5 { animation-delay: 0.45s; }

  .formSide { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; gap: 18px; }
  .formCard { background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 4px 24px rgba(20,28,45,0.06); padding: 36px; width: 100%; max-width: 440px; transition: box-shadow 0.3s ease, transform 0.3s ease; }
  .formCard:hover { box-shadow: 0 10px 36px rgba(20,28,45,0.1); }
  .anim-card { opacity: 0; animation: sbScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; }
  .anim-links { opacity: 0; animation: sbFadeIn 0.5s ease-out 0.5s forwards; }
  h2 { font-size: 21px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .sub { color: var(--muted); font-size: 13.5px; margin: 4px 0 22px; line-height: 1.5; }
  .check { width: 44px; height: 44px; border-radius: 50%; background: var(--green-soft); color: var(--green); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; margin-bottom: 14px; animation: sbPulseRing 1.8s ease-out 0.4s 2; }
  .lead { font-size: 14px; color: var(--ink-2); margin-bottom: 18px; line-height: 1.5; }
  .toggle { display: flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 20px; }
  .seg { flex: 1; background: #fff; border: none; padding: 11px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; transition: all 0.15s; }
  .seg.on { background: var(--navy); color: #fff; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 14px 0 6px; }
  input, select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; font-size: 14px; font-family: inherit; background: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .err { background: var(--red-soft); color: var(--red); padding: 10px 13px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; animation: sbFadeUp 0.25s ease-out; }
  .ticket { background: var(--navy-soft); border-radius: var(--radius-sm); padding: 18px; margin: 14px 0; }
  .tRow { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; font-size: 14px; }
  .tRow span { color: var(--ink-2); }
  .tRow strong { color: var(--navy); font-size: 17px; letter-spacing: 0.02em; }
  .note { font-size: 12px; color: var(--muted); line-height: 1.5; }
  .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
  .links a { color: var(--navy); text-decoration: none; font-weight: 600; transition: color 0.15s; }
  .links a:hover { text-decoration: underline; color: var(--navy-2); }
  .dot2 { color: var(--muted); }
`;
