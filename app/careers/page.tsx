"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Job = { id: string; title: string; description: string | null };
type Result = { form_number: string; login_code: string };

export default function Careers() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [applyTo, setApplyTo] = useState<Job | null>(null);

  useEffect(() => {
    supabase.rpc("list_open_jobs").then(({ data }) => setJobs((data as Job[]) ?? []));
  }, []);

  if (applyTo) return <ApplyForm job={applyTo} onBack={() => setApplyTo(null)} />;

  return (
    <div className="wrap">
      <div className="card box">
        <div className="brand">SUIBING <span>IT Services</span></div>
        <p className="sub">Careers</p>

        {jobs === null ? (
          <p className="muted">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="muted">There are no open positions right now. Please check back later.</p>
        ) : (
          <div className="jobs">
            {jobs.map((j) => (
              <div key={j.id} className="job">
                <h3>{j.title}</h3>
                {j.description && <p>{j.description}</p>}
                <button className="btn" onClick={() => setApplyTo(j)}>Apply</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="links">
        <a href="/careers/status">Already applied? Check status</a>
        <span className="dot">·</span>
        <a href="/login">Operator sign-in</a>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

function ApplyForm({ job, onBack }: { job: Job; onBack: () => void }) {
  const [f, setF] = useState({ full_name: "", email: "", phone: "", cover_note: "", resume_url: "" });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const up = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setErr(null);
    if (!f.full_name.trim() || !f.phone.trim()) { setErr("Full name and phone number are required."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_job_application", {
      p_job_id: job.id, p_full_name: f.full_name.trim(), p_email: f.email.trim() || null,
      p_phone: f.phone.trim(), p_cover_note: f.cover_note.trim() || null, p_resume_url: f.resume_url.trim() || null,
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
          <p className="lead">Save these details — you'll need both to check your status.</p>
          <div className="ticket">
            <div className="tRow"><span>Form number</span><strong>{result.form_number}</strong></div>
            <div className="tRow"><span>Login ID</span><strong>{result.login_code}</strong></div>
          </div>
          <p className="note">Write these down or screenshot now — they will not be shown again.</p>
          <a className="btn" href="/careers/status" style={{ display: "inline-block", textDecoration: "none", marginTop: 16 }}>
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
        <p className="sub">Applying for: {job.title}</p>

        <label>Full name</label>
        <input value={f.full_name} onChange={(e) => up("full_name", e.target.value)} />
        <div className="two">
          <div><label>Phone number</label><input value={f.phone} onChange={(e) => up("phone", e.target.value)} placeholder="+234..." /></div>
          <div><label>Email (optional)</label><input value={f.email} onChange={(e) => up("email", e.target.value)} /></div>
        </div>
        <label>CV / resume link (optional)</label>
        <input value={f.resume_url} onChange={(e) => up("resume_url", e.target.value)} placeholder="https://..." />
        <label>Cover note</label>
        <textarea rows={4} value={f.cover_note} onChange={(e) => up("cover_note", e.target.value)} />
        {err && <div className="err">{err}</div>}
        <div className="row2">
          <button className="btn ghost" onClick={onBack}>Back</button>
          <button className="btn" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button>
        </div>
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
  .muted { color: var(--muted); font-size: 14px; }
  .jobs { display: flex; flex-direction: column; gap: 12px; }
  .job { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 16px; }
  .job h3 { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
  .job p { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 12px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
  input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; background: #fff; }
  input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
  textarea { resize: vertical; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
  .ticket { background: var(--navy-soft); border-radius: var(--radius-sm); padding: 16px; margin: 10px 0; }
  .tRow { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 14px; }
  .tRow span { color: var(--ink-2); }
  .tRow strong { color: var(--navy); font-size: 16px; letter-spacing: 0.02em; }
  .note { font-size: 12px; color: var(--muted); line-height: 1.5; }
  .row2 { display: flex; gap: 10px; margin-top: 16px; }
  .row2 .btn { flex: 1; }
  .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
  .links a { color: var(--navy); text-decoration: none; font-weight: 600; }
  .links a:hover { text-decoration: underline; }
  .links .dot { color: var(--muted); }
`;
