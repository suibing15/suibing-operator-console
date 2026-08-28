"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WhatsAppButton from "@/app/components/WhatsAppButton";
import BroadcastBar from "@/app/components/BroadcastBar";

type Status = {
  form_number: string; request_type: string; product: string; org_name: string;
  status: "pending" | "needs_correction" | "rejected" | "approved";
  reviewer_note: string | null; created_at: string; updated_at: string;
};

const STATUS_LABEL: Record<string, { label: string; tone: string; help: string }> = {
  pending: { label: "Pending review", tone: "amber", help: "We're reviewing your application. Check back soon." },
  needs_correction: { label: "Correction needed", tone: "amber", help: "Please review the note below and resubmit your details." },
  rejected: { label: "Not approved", tone: "red", help: "Your application was not approved this time." },
  approved: { label: "Approved", tone: "green", help: "You're approved — we'll be in touch with next steps." },
};

export default function ApplyStatus() {
  const [form, setForm] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  async function check() {
    setErr(null); setStatus(null);
    if (!form.trim() || !code.trim()) { setErr("Enter both your form number and login ID."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("check_prospect_status", { p_form: form.trim().toUpperCase(), p_code: code.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setErr("No application found for that form number and login ID."); return; }
    setStatus(row as Status);
  }

  if (status && editing) {
    return <ResubmitForm form={form.trim().toUpperCase()} code={code.trim()} initial={status}
      onDone={(s) => { setStatus(s); setEditing(false); }} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className="wrap">
      <BroadcastBar />
      <div className="card box">
        <div className="brand"><img src="/logo.png" alt="Suibing IT Services" className="logo" />SUIBING <span>IT Services</span></div>
        <p className="sub">Check application status</p>

        <label>Form number</label>
        <input value={form} onChange={(e) => setForm(e.target.value)} placeholder="SBG-2026-0847" />
        <label>Login ID</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" onKeyDown={(e) => e.key === "Enter" && check()} />
        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={check} disabled={busy} style={{ width: "100%", marginTop: 14 }}>
          {busy ? "Checking…" : "Check status"}
        </button>

        {status && (
          <div className="result">
            <div className={`pill ${STATUS_LABEL[status.status].tone}`}>{STATUS_LABEL[status.status].label}</div>
            <div className="rRow"><span>Organisation</span><strong>{status.org_name}</strong></div>
            <div className="rRow"><span>Type</span><strong>{status.request_type === "new" ? "New signup" : "Update request"}</strong></div>
            <div className="rRow"><span>Submitted</span><strong>{new Date(status.created_at).toLocaleDateString("en-GB")}</strong></div>
            <p className="help">{STATUS_LABEL[status.status].help}</p>
            {status.reviewer_note && (
              <div className="noteBox">
                <div className="noteLabel">Note from Suibing IT Services</div>
                <div>{status.reviewer_note}</div>
              </div>
            )}
            {status.status === "needs_correction" && (
              <button className="btn" onClick={() => setEditing(true)} style={{ width: "100%", marginTop: 14 }}>
                Edit &amp; resubmit
              </button>
            )}
          </div>
        )}
      </div>
      <div className="links">
        <a href="/apply">New application</a>
        <span className="dot">·</span>
        <a href="/login">Operator sign-in</a>
      </div>
      <WhatsAppButton />
      <style jsx>{styles}</style>
    </div>
  );
}

function ResubmitForm({ form, code, initial, onDone, onCancel }:
  { form: string; code: string; initial: Status; onDone: (s: Status) => void; onCancel: () => void }) {
  const [f, setF] = useState({ org_name: initial.org_name, contact_person: "", contact_email: "", contact_phone: "", message: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr(null);
    if (!f.org_name.trim() || !f.contact_person.trim() || !f.contact_phone.trim()) {
      setErr("Organisation name, contact person, and phone are required."); return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("resubmit_prospect", {
      p_form: form, p_code: code, p_org_name: f.org_name.trim(), p_contact_person: f.contact_person.trim(),
      p_contact_email: f.contact_email.trim() || null, p_contact_phone: f.contact_phone.trim(),
      p_message: f.message.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (!data) { setErr("Could not resubmit — this application may no longer need correction."); return; }
    const { data: fresh } = await supabase.rpc("check_prospect_status", { p_form: form, p_code: code });
    const row = Array.isArray(fresh) ? fresh[0] : fresh;
    onDone(row as Status);
  }

  return (
    <div className="wrap">
      <BroadcastBar />
      <div className="card box">
        <div className="brand"><img src="/logo.png" alt="Suibing IT Services" className="logo" />SUIBING <span>IT Services</span></div>
        <p className="sub">Update your application — {form}</p>
        {initial.reviewer_note && (
          <div className="noteBox" style={{ marginBottom: 14 }}>
            <div className="noteLabel">What needs fixing</div>
            <div>{initial.reviewer_note}</div>
          </div>
        )}
        <label>School / organisation name</label>
        <input value={f.org_name} onChange={(e) => up("org_name", e.target.value)} />
        <div className="two">
          <div><label>Contact person</label><input value={f.contact_person} onChange={(e) => up("contact_person", e.target.value)} /></div>
          <div><label>Phone number</label><input value={f.contact_phone} onChange={(e) => up("contact_phone", e.target.value)} /></div>
        </div>
        <label>Email (optional)</label>
        <input value={f.contact_email} onChange={(e) => up("contact_email", e.target.value)} />
        <label>Updated details</label>
        <textarea rows={4} value={f.message} onChange={(e) => up("message", e.target.value)} />
        {err && <div className="err">{err}</div>}
        <div className="row2">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Resubmit"}</button>
        </div>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; background: var(--paper-2); }
  .box { padding: 34px; width: 100%; max-width: 440px; opacity: 0; animation: sbScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; transition: box-shadow 0.3s ease; box-shadow: 0 4px 24px rgba(20,28,45,0.06); }
  .box:hover { box-shadow: 0 10px 36px rgba(20,28,45,0.1); }
  .brand { font-size: 22px; font-weight: 800; color: var(--navy); letter-spacing: -0.02em; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .logo { width: 34px; height: 34px; border-radius: 8px; }
  .brand span { font-weight: 400; }
  .sub { color: var(--muted); font-size: 13px; margin: 2px 0 20px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
  input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; background: #fff; }
  input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
  .result { margin-top: 20px; border-top: 1px solid var(--line); padding-top: 18px; animation: sbFadeUp 0.4s ease-out; }
  .pill { display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; animation: sbScaleIn 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
  .pill.amber { background: #FBF0DC; color: var(--amber); }
  .pill.red { background: var(--red-soft); color: var(--red); }
  .pill.green { background: var(--green-soft); color: var(--green); }
  .rRow { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; }
  .rRow span { color: var(--muted); }
  .rRow strong { color: var(--ink); font-weight: 600; }
  .help { font-size: 13px; color: var(--ink-2); margin-top: 10px; line-height: 1.5; }
  .noteBox { background: var(--paper-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; margin-top: 12px; font-size: 13px; line-height: 1.5; }
  .noteLabel { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
  .row2 { display: flex; gap: 10px; margin-top: 16px; }
  .row2 .btn { flex: 1; }
  .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
  .links a { color: var(--navy); text-decoration: none; font-weight: 600; }
  .links a:hover { text-decoration: underline; }
  .links .dot { color: var(--muted); }
`;
