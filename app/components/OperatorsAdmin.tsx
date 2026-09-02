"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Operator = { email: string; full_name: string | null; created_at: string };

export default function OperatorsAdmin({ currentEmail, onClose }: { currentEmail: string; onClose: () => void }) {
  const [operators, setOperators] = useState<Operator[] | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc("list_operators");
    setOperators((data as Operator[]) ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    setErr(null); setMsg(null);
    if (!email.trim()) { setErr("Enter an email address."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("add_operator", { p_email: email.trim(), p_full_name: fullName.trim(), p_by: currentEmail });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(`${email.trim()} can now sign in as an operator, once they have (or create) a Supabase account with that email.`);
    setEmail(""); setFullName("");
    load();
  }

  async function remove(opEmail: string) {
    setErr(null); setMsg(null);
    setBusy(true);
    const { error } = await supabase.rpc("remove_operator", { p_email: opEmail, p_by: currentEmail });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(`${opEmail} removed.`);
    load();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>Operators</h3>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>
        <p className="hint">
          Anyone listed here can sign into this console, once they also have a real Supabase login with the same
          email. Adding an email here alone doesn't create their password — they'll need to set one via "Forgot
          password" on the login screen, or you can share credentials with them directly.
        </p>

        <div className="list">
          {operators === null ? (
            <p className="muted">Loading…</p>
          ) : operators.length === 0 ? (
            <p className="muted">No operators found.</p>
          ) : operators.map((o) => (
            <div key={o.email} className="row">
              <div>
                <div className="rowEmail">{o.email}</div>
                {o.full_name && <div className="rowName">{o.full_name}</div>}
              </div>
              {o.email.toLowerCase() === currentEmail.toLowerCase() ? (
                <span className="youTag">You</span>
              ) : (
                <button className="removeBtn" type="button" disabled={busy} onClick={() => remove(o.email)}>Remove</button>
              )}
            </div>
          ))}
        </div>

        <label>Add operator — email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        <label>Name (optional)</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />

        {err && <div className="err">{err}</div>}
        {msg && <div className="msgOk">{msg}</div>}

        <button className="btn ok" type="button" onClick={add} disabled={busy} style={{ width: "100%", marginTop: 12 }}>
          {busy ? "Adding…" : "Add operator"}
        </button>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 480px; padding: 26px; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .hint { font-size: 12.5px; color: var(--muted); line-height: 1.5; margin-bottom: 16px; }
          .list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 18px; }
          .row { display: flex; justify-content: space-between; align-items: center; background: var(--paper-2); border-radius: 8px; padding: 10px 12px; }
          .rowEmail { font-size: 13.5px; font-weight: 600; color: var(--ink); }
          .rowName { font-size: 12px; color: var(--muted); margin-top: 1px; }
          .youTag { font-size: 11px; font-weight: 700; color: var(--navy); background: var(--navy-soft); padding: 3px 9px; border-radius: 999px; }
          .removeBtn { background: none; border: none; color: var(--red); font-size: 12px; font-weight: 600; cursor: pointer; }
          .removeBtn:disabled { opacity: 0.5; cursor: not-allowed; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 6px; }
          input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; box-sizing: border-box; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
          .msgOk { color: var(--green); font-size: 13px; margin-top: 12px; }
        `}</style>
      </div>
    </div>
  );
}
