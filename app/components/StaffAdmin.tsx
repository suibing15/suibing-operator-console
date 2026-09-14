"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type StaffRow = {
  id: string; username: string; full_name: string; email: string | null;
  phone: string | null; status: "active" | "suspended"; created_at: string;
};

export default function StaffAdmin({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null);
  const [resetPin, setResetPin] = useState("");

  async function load() {
    const { data } = await supabase.rpc("list_staff");
    setRows((data as StaffRow[]) ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setUsername(""); setPin(""); setFullName(""); setEmail(""); setPhone("");
    setErr(null); setMsg(null); setShowAdd(false);
  }

  async function add() {
    setErr(null); setMsg(null);
    if (!username.trim() || !fullName.trim()) { setErr("Username and full name are required."); return; }
    if (pin.trim().length < 4) { setErr("PIN must be at least 4 characters."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("add_staff", {
      p_username: username.trim(), p_pin: pin.trim(), p_full_name: fullName.trim(),
      p_email: email.trim() || null, p_phone: phone.trim() || null, p_applicant_id: null, p_by: operatorEmail,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(`${fullName.trim()} added. Share the username and PIN with them to sign in at the staff portal.`);
    resetForm();
    load();
  }

  async function doResetPin() {
    if (!resetTarget) return;
    if (resetPin.trim().length < 4) { setErr("PIN must be at least 4 characters."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("reset_staff_pin", { p_staff_id: resetTarget.id, p_new_pin: resetPin.trim(), p_by: operatorEmail });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg(`PIN reset for ${resetTarget.full_name}.`);
    setResetTarget(null); setResetPin("");
    load();
  }

  async function toggleStatus(s: StaffRow) {
    const next = s.status === "active" ? "suspended" : "active";
    await supabase.rpc("set_staff_status", { p_staff_id: s.id, p_status: next, p_by: operatorEmail });
    load();
  }

  async function remove(s: StaffRow) {
    if (!confirm(`Remove ${s.full_name} as staff? This deletes their account and all assigned tasks. This cannot be undone.`)) return;
    await supabase.rpc("delete_staff", { p_staff_id: s.id, p_by: operatorEmail });
    load();
  }

  return (
    <div>
      <div className="bar">
        <h2>Staff</h2>
        <button className="btn ok" onClick={() => setShowAdd(true)}>+ Add staff</button>
      </div>
      <p className="intro">
        People you've brought on to work on specific schools — entering exam questions, e-reportsheet data, and
        similar tasks. They sign in with a username and PIN at the staff portal, fully separate from your own
        operator login and from school accounts.
      </p>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Username</th><th>Contact</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="empty">No staff yet.</td></tr>
            ) : rows.map((s) => (
              <tr key={s.id}>
                <td data-label="Name">{s.full_name}</td>
                <td data-label="Username" className="mono">{s.username}</td>
                <td data-label="Contact">{s.email || s.phone || "—"}</td>
                <td data-label="Status"><span className={`pill ${s.status === "active" ? "green" : "amber"}`}>{s.status}</span></td>
                <td className="r" data-label="">
                  <div className="rowActions">
                    <button className="mini" onClick={() => setResetTarget(s)}>Reset PIN</button>
                    <button className="mini" onClick={() => toggleStatus(s)}>{s.status === "active" ? "Suspend" : "Reactivate"}</button>
                    <button className="mini danger" onClick={() => remove(s)}>Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) resetForm(); }}>
          <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mh"><h3>Add staff</h3><button className="x" onClick={resetForm}>✕</button></div>
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. amina.k" />
            <label>PIN (at least 4 characters)</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} />
            <label>Email (optional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
            <label>Phone (optional)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            {err && <div className="err">{err}</div>}
            <button className="btn ok" disabled={busy} onClick={add} style={{ width: "100%", marginTop: 14 }}>
              {busy ? "Adding…" : "Add staff"}
            </button>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setResetTarget(null); setErr(null); } }}>
          <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mh"><h3>Reset PIN — {resetTarget.full_name}</h3><button className="x" onClick={() => setResetTarget(null)}>✕</button></div>
            <label>New PIN (at least 4 characters)</label>
            <input type="password" value={resetPin} onChange={(e) => setResetPin(e.target.value)} />
            {err && <div className="err">{err}</div>}
            <button className="btn ok" disabled={busy} onClick={doResetPin} style={{ width: "100%", marginTop: 14 }}>
              {busy ? "Saving…" : "Reset PIN"}
            </button>
          </div>
        </div>
      )}

      {msg && <div className="msgOk" style={{ marginTop: 14 }}>{msg}</div>}

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .intro { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 18px; max-width: 640px; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--line); }
        td { padding: 10px 12px; border-bottom: 1px solid var(--line); }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
        .mono { font-variant-numeric: tabular-nums; color: var(--ink-2); }
        .r { text-align: right; }
        .rowActions { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: 6px; padding: 5px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
        .mini.danger { background: var(--red-soft); color: var(--red); }
        .pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
        .pill.green { background: var(--green-soft); color: var(--green); }
        .pill.amber { background: #FBF0DC; color: var(--amber); }
        .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
        .modal { width: 100%; max-width: 440px; padding: 24px; }
        .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
        h3 { font-size: 16px; font-weight: 700; color: var(--ink); }
        .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 6px; }
        input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; box-sizing: border-box; }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
        .msgOk { color: var(--green); font-size: 13px; }
      `}</style>
    </div>
  );
}
