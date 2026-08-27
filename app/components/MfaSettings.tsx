"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Factor = { id: string; friendly_name?: string; factor_type: string; status: string };

export default function MfaSettings({ onClose }: { onClose: () => void }) {
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [step, setStep] = useState<"list" | "enroll-qr" | "enroll-verify" | "backup-codes">("list");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  async function loadFactors() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) { setErr(error.message); return; }
    setFactors((data?.totp as Factor[]) ?? []);
  }
  useEffect(() => { loadFactors(); }, []);

  async function startEnroll() {
    setErr(null); setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Suibing Console Authenticator",
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep("enroll-qr");
  }

  async function verifyEnroll() {
    if (!factorId) return;
    setErr(null);
    if (code.trim().length !== 6) { setErr("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true);
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr) { setBusy(false); setErr(chErr.message); return; }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId, challengeId: challenge.id, code: code.trim(),
    });
    setBusy(false);
    if (verErr) { setErr(verErr.message); return; }

    // Generate one-time backup codes locally, shown once. These are not
    // verified by Supabase (TOTP MFA has no built-in backup-code concept),
    // so we store them, hashed, in a small table for the operator to use
    // as an emergency password-reset-style fallback if they lose their
    // authenticator device.
    const codes = Array.from({ length: 8 }, () => genBackupCode());
    setBackupCodes(codes);
    await supabase.rpc("store_mfa_backup_codes", { p_codes: codes });

    setCode("");
    setStep("backup-codes");
    loadFactors();
  }

  async function removeFactor(id: string) {
    if (!confirm("Remove the authenticator app? You will only need your password to sign in afterward.")) return;
    setErr(null); setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    loadFactors();
  }

  function genBackupCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("").replace(/(.{5})/, "$1-");
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>Authenticator app (MFA)</h3>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>

        {step === "list" && (
          <>
            <p className="hint">
              Add an extra layer of security. Once enabled, sign-in with email + password will also ask for a
              6-digit code from Google Authenticator (or any TOTP app). This is optional — you can remove it any time.
            </p>
            {err && <div className="err">{err}</div>}
            {factors === null ? (
              <p className="hint">Loading…</p>
            ) : factors.filter((f) => f.status === "verified").length === 0 ? (
              <button className="btn ok" type="button" onClick={startEnroll} disabled={busy} style={{ width: "100%" }}>
                {busy ? "Starting…" : "Enable authenticator app"}
              </button>
            ) : (
              <div className="factorList">
                {factors.filter((f) => f.status === "verified").map((f) => (
                  <div key={f.id} className="factorRow">
                    <span>✓ {f.friendly_name || "Authenticator app"} — active</span>
                    <button className="mini danger" type="button" onClick={() => removeFactor(f.id)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {step === "enroll-qr" && (
          <>
            <p className="hint">Scan this QR code with Google Authenticator (or any TOTP app), then enter the 6-digit code it shows.</p>
            {qrCode && <div className="qrWrap" dangerouslySetInnerHTML={{ __html: qrCode }} />}
            {secret && <p className="secretText">Can't scan? Enter this key manually: <code>{secret}</code></p>}
            <label>6-digit code</label>
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000" onKeyDown={(e) => e.key === "Enter" && verifyEnroll()} />
            {err && <div className="err">{err}</div>}
            <div className="mf">
              <button className="btn ghost" type="button" onClick={() => { setStep("list"); setErr(null); }}>Cancel</button>
              <button className="btn ok" type="button" onClick={verifyEnroll} disabled={busy}>{busy ? "Verifying…" : "Verify & activate"}</button>
            </div>
          </>
        )}

        {step === "backup-codes" && (
          <>
            <p className="hint okText">✓ Authenticator app activated.</p>
            <p className="hint">Save these one-time backup codes somewhere safe. Each can be used once to sign in if you lose access to your authenticator app. They will not be shown again.</p>
            <div className="codesGrid">
              {backupCodes.map((c) => <code key={c}>{c}</code>)}
            </div>
            <button className="btn" type="button" onClick={() => { setStep("list"); onClose(); }} style={{ width: "100%", marginTop: 16 }}>
              I've saved these — Done
            </button>
          </>
        )}

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 440px; padding: 24px; margin: 20px 0; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .hint { font-size: 13px; color: var(--muted); line-height: 1.55; margin-bottom: 14px; }
          .hint.okText { color: var(--green); font-weight: 600; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin: 10px 0; }
          .factorList { display: flex; flex-direction: column; gap: 8px; }
          .factorRow { display: flex; justify-content: space-between; align-items: center; background: var(--green-soft); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13.5px; color: var(--green); font-weight: 600; }
          .mini { border: none; border-radius: 6px; padding: 5px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
          .mini.danger { background: var(--red); color: #fff; }
          .qrWrap { display: flex; justify-content: center; margin: 14px 0; background: #fff; padding: 12px; border-radius: 10px; border: 1px solid var(--line); }
          .qrWrap :global(svg) { width: 180px; height: 180px; }
          .secretText { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 14px; word-break: break-all; }
          .secretText code { background: var(--paper-2); padding: 2px 6px; border-radius: 4px; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
          input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 18px; letter-spacing: 4px; text-align: center; font-family: monospace; box-sizing: border-box; }
          input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
          .codesGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: var(--paper-2); padding: 14px; border-radius: 10px; }
          .codesGrid code { font-size: 13px; text-align: center; padding: 6px; background: #fff; border-radius: 6px; border: 1px solid var(--line); }
        `}</style>
      </div>
    </div>
  );
}
