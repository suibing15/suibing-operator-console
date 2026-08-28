"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const REQUIRED_PHRASE = "DELETE ALL DATA";

export default function FactoryReset({ operatorEmail, onClose }: { operatorEmail: string; onClose: () => void }) {
  const [step, setStep] = useState<"warn" | "confirm" | "done">("warn");
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doReset() {
    setErr(null);
    if (phrase !== REQUIRED_PHRASE) { setErr(`Type exactly "${REQUIRED_PHRASE}" to proceed.`); return; }
    setBusy(true);
    const { error } = await supabase.rpc("factory_reset_operational_data", {
      p_confirm_phrase: phrase, p_by: operatorEmail,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStep("done");
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && step !== "done") onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        {step === "warn" && (
          <>
            <div className="mh">
              <h3>⚠ Factory reset</h3>
              <button className="x" onClick={onClose} type="button">✕</button>
            </div>
            <p className="warnText">
              This permanently deletes <strong>every school, every invoice, every payment record, every prospect
              application, every job applicant, every job posting, and the entire activity log</strong>. There is no
              undo. Nothing can bring this back once it runs.
            </p>
            <p className="safeText">
              This does <strong>not</strong> touch your own login, your signature, your bank details, or your public
              showcase products and testimonials — only customer/operational data is wiped.
            </p>
            <p className="hint">
              Before running this, make sure you've exported a backup of anything you might still need — this tool
              does not do that for you automatically.
            </p>
            <button className="btn danger" type="button" onClick={() => setStep("confirm")} style={{ width: "100%", marginTop: 16 }}>
              I understand — continue
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div className="mh">
              <h3>Final confirmation</h3>
              <button className="x" onClick={onClose} type="button">✕</button>
            </div>
            <p className="warnText">Type <strong>{REQUIRED_PHRASE}</strong> exactly, then confirm below.</p>
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder={REQUIRED_PHRASE} autoFocus />
            {err && <div className="err">{err}</div>}
            <div className="mf">
              <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
              <button className="btn danger" type="button" onClick={doReset} disabled={busy || phrase !== REQUIRED_PHRASE}>
                {busy ? "Wiping data…" : "Permanently wipe all data"}
              </button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <div className="mh"><h3>✓ Done</h3></div>
            <p className="warnText">All operational data has been wiped. The console is now empty and ready for fresh use.</p>
            <button className="btn" type="button" onClick={onClose} style={{ width: "100%", marginTop: 16 }}>Close</button>
          </>
        )}

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.7); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 400; backdrop-filter: blur(3px); }
          .modal { width: 100%; max-width: 460px; padding: 26px; border: 2px solid var(--red); }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--red); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .warnText { font-size: 13.5px; color: var(--ink); line-height: 1.6; margin-bottom: 12px; }
          .safeText { font-size: 13px; color: var(--green); line-height: 1.6; margin-bottom: 12px; background: var(--green-soft); padding: 10px 12px; border-radius: 8px; }
          .hint { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin-bottom: 4px; }
          input { width: 100%; border: 2px solid var(--red); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: monospace; margin-top: 8px; box-sizing: border-box; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
        `}</style>
      </div>
    </div>
  );
}
