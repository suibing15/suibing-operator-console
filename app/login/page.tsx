"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, isConfigured } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import WhatsAppButton from "@/app/components/WhatsAppButton";

export default function Login() {
  const router = useRouter();
  const { email: sessionEmail, isOperator, loading } = useAuth();
  const [mode, setMode] = useState<"magic" | "password">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // MFA challenge step, shown after password succeeds if the account has MFA enabled
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);

  useEffect(() => {
    if (!loading && sessionEmail && isOperator) {
      router.replace("/console");
    }
  }, [loading, sessionEmail, isOperator, router]);

  async function sendMagicLink() {
    setErr(null);
    if (!isConfigured) { setErr("Console not configured. Set environment variables."); return; }
    if (!email.trim()) { setErr("Enter your operator email."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/console` : undefined },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }

  async function signInWithPassword() {
    setErr(null);
    if (!isConfigured) { setErr("Console not configured. Set environment variables."); return; }
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); setErr(error.message); return; }

    // Check whether this account has an active MFA factor requiring step-up.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setBusy(false);
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (totp) {
        setMfaFactorId(totp.id);
        setNeedsMfa(true);
        return;
      }
    }
    router.replace("/console");
  }

  async function verifyMfaCode() {
    setErr(null);
    if (!mfaFactorId) return;
    if (useBackupCode) {
      if (!mfaCode.trim()) { setErr("Enter a backup code."); return; }
      setBusy(true);
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) { setBusy(false); setErr("Session expired. Please sign in again."); return; }
      const { data: ok, error } = await supabase.rpc("redeem_mfa_backup_code", { p_user_id: uid, p_code: mfaCode.trim() });
      setBusy(false);
      if (error) { setErr(error.message); return; }
      if (!ok) { setErr("Invalid or already-used backup code."); return; }
      router.replace("/console");
      return;
    }
    if (mfaCode.trim().length !== 6) { setErr("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
    if (chErr) { setBusy(false); setErr(chErr.message); return; }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode.trim(),
    });
    setBusy(false);
    if (verErr) { setErr(verErr.message); return; }
    router.replace("/console");
  }

  return (
    <div className="wrap">
      <div className="card box">
        <div className="brand"><img src="/logo.png" alt="Suibing IT Services" className="logo" />SUIBING <span>Bucket</span></div>
        <p className="sub">Operator Console</p>

        <div className="toggle">
          <button type="button" className={mode === "password" ? "seg on" : "seg"} onClick={() => { setMode("password"); setErr(null); setSent(false); }}>Password</button>
          <button type="button" className={mode === "magic" ? "seg on" : "seg"} onClick={() => { setMode("magic"); setErr(null); setSent(false); }}>Magic link</button>
        </div>

        {mode === "magic" ? (
          sent ? (
            <p className="ok">Check your email for a secure sign-in link.</p>
          ) : (
            <>
              <label>Operator email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                onKeyDown={(e) => e.key === "Enter" && sendMagicLink()} />
              {err && <div className="err">{err}</div>}
              <button className="btn" onClick={sendMagicLink} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
                {busy ? "Sending…" : "Send sign-in link"}
              </button>
            </>
          )
        ) : needsMfa ? (
          <>
            <label>{useBackupCode ? "Backup code" : "6-digit code from your authenticator app"}</label>
            <input
              value={mfaCode}
              onChange={(e) => setMfaCode(useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={useBackupCode ? "XXXXX-XXXXX" : "000000"}
              onKeyDown={(e) => e.key === "Enter" && verifyMfaCode()}
              style={{ textAlign: "center", fontSize: 18, letterSpacing: useBackupCode ? 1 : 4, fontFamily: "monospace" }}
            />
            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={verifyMfaCode} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              className="linkBtn"
              onClick={() => { setUseBackupCode((v) => !v); setMfaCode(""); setErr(null); }}
              style={{ marginTop: 12 }}
            >
              {useBackupCode ? "Use authenticator app instead" : "Use a backup code instead"}
            </button>
          </>
        ) : (
          <>
            <label>Operator email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            <label style={{ marginTop: 12 }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && signInWithPassword()} />
            {err && <div className="err">{err}</div>}
            <button className="btn" onClick={signInWithPassword} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="note">No password set yet? Sign in with Magic link once, then set a password from the console.</p>
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
        <span className="dot">·</span>
        <a href="/school-portal">School portal</a>
      </div>
      <WhatsAppButton />
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
        .sub { color: var(--muted); font-size: 13px; margin: 2px 0 22px; text-align: center; }
        .toggle { display: flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden; margin-bottom: 18px; }
        .seg { flex: 1; background: #fff; border: none; padding: 9px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .seg.on { background: var(--navy); color: #fff; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
        input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; font-size: 14px; }
        input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
        .ok { color: var(--green); font-size: 14px; line-height: 1.6; }
        .note { font-size: 12px; color: var(--muted); margin-top: 14px; line-height: 1.5; text-align: center; }
        .linkBtn { display: block; width: 100%; background: none; border: none; color: var(--navy); font-size: 12.5px; font-weight: 600; cursor: pointer; text-align: center; }
        .linkBtn:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
