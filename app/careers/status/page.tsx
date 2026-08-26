"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Status = {
  form_number: string; job_title_snap: string; status: "pending" | "needs_correction" | "rejected" | "approved";
  reviewer_note: string | null; created_at: string; updated_at: string;
};

const STATUS_LABEL: Record<string, { label: string; tone: string; help: string }> = {
  pending: { label: "Pending review", tone: "amber", help: "We're reviewing your application. Check back soon." },
  needs_correction: { label: "Correction needed", tone: "amber", help: "Please review the note below and resubmit your details." },
  rejected: { label: "Not successful", tone: "red", help: "Your application was not successful this time." },
  approved: { label: "Approved", tone: "green", help: "Congratulations — we'll be in touch with an offer." },
};

export default function CareersStatus() {
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
    const { data, error } = await supabase.rpc("check_job_application_status", { p_form: form.trim().toUpperCase(), p_code: code.trim() });
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
      <div className="card box">
        <div className="brand">SUIBING <span>IT Services</span></div>
        <p className="sub">Check job application status</p>

        <label>Form number</label>
        <input value={form} onChange={(e) => setForm(e.target.value)} placeholder="JOB-2026-0847" />
        <label>Login ID</label>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" onKeyDown={(e) => e.key === "Enter" && check()} />
        {err && <div className="err">{err}</div>}
        <button className="btn" onClick={check} disabled={busy} style={{ width: "100%", marginTop: 14 }}>
          {busy ? "Checking…" : "Check status"}
        </button>

        {status && (
          <div className="result">
            <div className={`pill ${STATUS_LABEL[status.status].tone}`}>{STATUS_LABEL[status.status].label}</div>
            <div className="rRow"><span>Position</span><strong>{status.job_title_snap}</strong></div>
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
        <a href="/careers">View open positions</a>
        <span className="dot">·</span>
        <a href="/login">Operator sign-in</a>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

function ResubmitForm({ form, code, initial, onDone, onCancel }:
  { form: string; code: string; initial: Status; onDone: (s: Status) => void; onCancel: () => void }) {
  const [f, setF] = useState({ full_name: "", email: "", phone: "", cover_note: "", resume_url: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setErr(null);
    if (!f.full_name.trim() || !f.phone.trim()) { setErr("Full name and phone are required."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("resubmit_job_application", {
      p_form: form, p_code: code, p_full_name: f.full_name.trim(), p_email: f.email.trim() || null,
      p_phone: f.phone.trim(), p_cover_note: f.cover_note.trim() || null, p_resume_url: f.resume_url.trim() || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    if (!data) { setErr("Could not resubmit — this application may no longer need correction."); return; }
    const { data: fresh } = await supabase.rpc("check_job_application_status", { p_form: form, p_code: code });
    const row = Array.isArray(fresh) ? fresh[0] : fresh;
    onDone(row as Status);
  }

  return (
    <div className="wrap">
      <div className="card box">
        <div className="brand">SUIBING <span>IT Services</span></div>
        <p className="sub">Update your application — {form}</p>
        {initial.reviewer_note && (
          <div className="noteBox" style={{ marginBottom: 14 }}>
            <div className="noteLabel">What needs fixing</div>
            <div>{initial.reviewer_note}</div>
          </div>
        )}
        <label>Full name</label>
        <input value={f.full_name} onChange={(e) => up("full_name", e.target.value)} />
        <div className="two">
          <div><label>Phone number</label><input value={f.phone} onChange={(e) => up("phone", e.target.value)} /></div>
          <div><label>Email (optional)</label><input value={f.email} onChange={(e) => up("email", e.target.value)} /></div>
        </div>
        <label>CV / resume link (optional)</label>
        <input value={f.resume_url} onChange={(e) => up("resume_url", e.target.value)} />
        <label>Cover note</label>
        <textarea rows={4} value={f.cover_note} onChange={(e) => up("cover_note", e.target.value)} />
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
  .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; }
  .box { padding: 34px; width: 100%; max-width: 440px; }
  .brand { font-size: 24px; font-weight: 800; color: var(--navy); letter-spacing: -0.02em; }
  .brand span { font-weight: 400; }
  .sub { color: var(--muted); font-size: 13px; margin: 2px 0 20px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
  input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; background: #fff; }
  input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
  .result { margin-top: 20px; border-top: 1px solid var(--line); padding-top: 18px; }
  .pill { display: inline-block; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 4px 12px; border-radius: 999px; margin-bottom: 12px; }
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
