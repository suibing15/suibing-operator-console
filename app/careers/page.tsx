"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WhatsAppButton from "@/app/components/WhatsAppButton";

type Job = { id: string; title: string; description: string | null };
type Result = { form_number: string; login_code: string };

export default function Careers() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [applyTo, setApplyTo] = useState<Job | null>(null);

  useEffect(() => {
    supabase.rpc("list_open_jobs").then(({ data }) => setJobs((data as Job[]) ?? []));
  }, []);

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
            <h1 className="anim-2">Build software that reaches real classrooms.</h1>
            <p className="tagline anim-3">We're a small, hands-on team building school management, examination, and records software used by real schools every day.</p>
            <ul className="points anim-4">
              <li><span className="dot" />Direct, close-knit team — no bureaucracy</li>
              <li><span className="dot" />Work on products already in daily production use</li>
              <li><span className="dot" />Based in Kano, Nigeria</li>
            </ul>
            <div className="corpline anim-5">
              SUIBING LIMITED (RC 9801555)<br />
              trading as Suibing IT Services
            </div>
          </div>
        </aside>

        <main className="formSide">
          {applyTo ? (
            <ApplyForm job={applyTo} onBack={() => setApplyTo(null)} />
          ) : (
            <div className="formCard wide anim-card">
              <h2>Open positions</h2>
              <p className="sub">Current opportunities at Suibing IT Services.</p>

              {jobs === null ? (
                <p className="muted">Loading…</p>
              ) : jobs.length === 0 ? (
                <div className="emptyState">
                  <div className="emptyIcon">💼</div>
                  <p>There are no open positions right now.</p>
                  <p className="muted small">Please check back later, or follow up directly using the contact details below.</p>
                </div>
              ) : (
                <div className="jobs">
                  {jobs.map((j, i) => (
                    <div key={j.id} className="job jobAnim" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                      <h3>{j.title}</h3>
                      {j.description && <p>{j.description}</p>}
                      <button className="btn" onClick={() => setApplyTo(j)}>Apply for this role</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="links anim-links">
            <a href="/careers/status">Already applied? Check status</a>
            <span className="dot2">·</span>
            <a href="/apply">Apply for school services</a>
            <span className="dot2">·</span>
            <a href="/invoices">Check invoices</a>
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
      <div className="formCard">
        <div className="check">✓</div>
        <h2>Application received</h2>
        <p className="lead">Save these details — you'll need both to check your status.</p>
        <div className="ticket">
          <div className="tRow"><span>Form number</span><strong>{result.form_number}</strong></div>
          <div className="tRow"><span>Login ID</span><strong>{result.login_code}</strong></div>
        </div>
        <p className="note">Write these down or screenshot now — they will not be shown again.</p>
        <a className="btn" href="/careers/status" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 18 }}>
          Go to status check
        </a>
      </div>
    );
  }

  return (
    <div className="formCard">
      <button className="back" onClick={onBack} type="button">← Back to positions</button>
      <h2>{job.title}</h2>
      <p className="sub">Submit your application below.</p>

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
      <button className="btn" onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 16 }}>
        {busy ? "Submitting…" : "Submit application"}
      </button>
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
  .formCard { background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 4px 24px rgba(20,28,45,0.06); padding: 36px; width: 100%; max-width: 440px; position: relative; transition: box-shadow 0.3s ease; }
  .formCard:hover { box-shadow: 0 10px 36px rgba(20,28,45,0.1); }
  .formCard.wide { max-width: 520px; }
  .anim-card { opacity: 0; animation: sbScaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards; }
  .anim-links { opacity: 0; animation: sbFadeIn 0.5s ease-out 0.5s forwards; }
  .back { background: none; border: none; color: var(--navy); font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 16px; padding: 0; }
  .back:hover { text-decoration: underline; }
  h2 { font-size: 21px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .sub { color: var(--muted); font-size: 13.5px; margin: 4px 0 22px; line-height: 1.5; }
  .muted { color: var(--muted); font-size: 14px; }
  .muted.small { font-size: 12.5px; }
  .check { width: 44px; height: 44px; border-radius: 50%; background: var(--green-soft); color: var(--green); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; margin-bottom: 14px; animation: sbPulseRing 1.8s ease-out 0.4s 2; }
  .lead { font-size: 14px; color: var(--ink-2); margin-bottom: 18px; line-height: 1.5; }
  .emptyState { text-align: center; padding: 30px 10px; animation: sbFadeIn 0.4s ease-out; }
  .emptyIcon { font-size: 32px; margin-bottom: 12px; }
  .emptyState p { font-size: 14px; color: var(--ink-2); margin-bottom: 4px; }
  .jobs { display: flex; flex-direction: column; gap: 12px; }
  .job { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 18px; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
  .jobAnim { opacity: 0; animation: sbFadeUp 0.45s ease-out forwards; }
  .job:hover { border-color: var(--navy); transform: translateY(-2px); box-shadow: 0 8px 20px rgba(20,28,45,0.08); }
  .job h3 { font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
  .job p { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 14px; }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 14px 0 6px; }
  input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; font-size: 14px; font-family: inherit; background: #fff; transition: border-color 0.15s, box-shadow 0.15s; }
  input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
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
