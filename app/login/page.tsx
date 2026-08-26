"use client";
import { useState } from "react";
import { supabase, isConfigured } from "@/lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setErr(null);
    if (!isConfigured) { setErr("Console not configured. Set environment variables."); return; }
    if (!email.trim()) { setErr("Enter your operator email."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  return (
    <div className="wrap">
      <div className="card box">
        <div className="brand"><img src="/logo.png" alt="Suibing IT Services" className="logo" />SUIBING <span>Bucket</span></div>
        <p className="sub">Operator Console</p>
        {sent ? (
          <p className="ok">Check your email for a secure sign-in link.</p>
        ) : (
          <>
            <label>Operator email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
              onKeyDown={(e) => e.key === "Enter" && send()} />
            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={send} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
              {busy ? "Sending…" : "Send sign-in link"}
            </button>
          </>
        )}
      </div>
      <div className="links">
        <a href="/apply">Apply for a school service</a>
        <span className="dot">·</span>
        <a href="/apply/status">Check application status</a>
        <span className="dot">·</span>
        <a href="/careers">Careers</a>
        <span className="dot">·</span>
        <a href="/invoices">Check invoices</a>
      </div>
      <style jsx>{`
        .wrap { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; gap: 16px; }
        .links { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; justify-content: center; font-size: 13px; }
        .links a { color: var(--navy); text-decoration: none; font-weight: 600; }
        .links a:hover { text-decoration: underline; }
        .links .dot { color: var(--muted); }
        .box { padding: 34px; width: 100%; max-width: 380px; }
        .brand { font-size: 22px; font-weight: 800; color: var(--navy); letter-spacing: -0.02em; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .logo { width: 34px; height: 34px; border-radius: 8px; }
        .brand span { font-weight: 400; }
        .sub { color: var(--muted); font-size: 13px; margin: 2px 0 22px; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
        input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; font-size: 14px; }
        input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
        .ok { color: var(--green); font-size: 14px; line-height: 1.6; }
      `}</style>
    </div>
  );
}
