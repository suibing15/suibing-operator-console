"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import WhatsAppButton from "@/app/components/WhatsAppButton";

type Session = { username: string; pin: string; fullName: string };

type TaskRow = {
  id: string; category: string; title: string; instructions: string | null;
  school_name: string | null; school_url: string | null;
  status: "assigned" | "in_progress" | "done" | "reviewed";
  updated_at: string; created_at: string;
};

type ThreadMsg = { id: string; sender: "staff" | "operator"; body: string; created_at: string };

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  assigned: { label: "Assigned", tone: "amber" },
  in_progress: { label: "In progress", tone: "navy" },
  done: { label: "Done — awaiting review", tone: "green" },
  reviewed: { label: "Reviewed", tone: "muted" },
};

const SESSION_KEY = "suibing_staff_session";

export default function StaffPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) : null;
    if (raw) { try { setSession(JSON.parse(raw)); } catch {} }
    setCheckedStorage(true);
  }, []);

  function onLogin(s: Session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setSession(s);
  }
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
  }

  if (!checkedStorage) return null;
  if (!session) return <StaffLogin onLogin={onLogin} />;
  return <StaffDashboard session={session} onLogout={logout} />;
}

function StaffLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login() {
    setErr(null);
    if (!username.trim() || !pin.trim()) { setErr("Enter your username and PIN."); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("staff_portal_login", { p_username: username.trim(), p_pin: pin.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { setErr("Incorrect username or PIN."); return; }
    onLogin({ username: username.trim(), pin: pin.trim(), fullName: row.full_name });
  }

  return (
    <div className="page">
      <a href="/" className="brandRow" title="Back to home">
        <img src="/logo.png" alt="Suibing IT Services" className="logo" />
        <div><div className="brandName">SUIBING</div><div className="brandSub">IT Services</div></div>
      </a>
      <div className="formCard card">
        <h2>Staff sign-in</h2>
        <p className="sub">Enter the username and PIN given to you by Suibing IT Services.</p>
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label>PIN</label>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
        {err && <div className="err">{err}</div>}
        <button className="btn ok" onClick={login} disabled={busy} style={{ width: "100%", marginTop: 16 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <WhatsAppButton />
      <style jsx>{`
        .page { min-height: 100vh; background: var(--paper); display: flex; flex-direction: column; align-items: center; padding: 40px 20px; }
        .brandRow { display: flex; align-items: center; gap: 10px; text-decoration: none; margin-bottom: 32px; }
        .logo { width: 40px; height: 40px; }
        .brandName { font-weight: 800; color: var(--navy); font-size: 15px; letter-spacing: 0.02em; }
        .brandSub { font-size: 11px; color: var(--muted); }
        .formCard { width: 100%; max-width: 380px; padding: 28px; }
        h2 { font-size: 19px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
        .sub { font-size: 13px; color: var(--muted); margin-bottom: 20px; line-height: 1.5; }
        label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 6px; }
        input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; box-sizing: border-box; }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
      `}</style>
    </div>
  );
}

function StaffDashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<TaskRow | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  async function loadTasks() {
    const { data } = await supabase.rpc("list_staff_tasks", { p_username: session.username, p_pin: session.pin });
    setTasks((data as TaskRow[]) ?? []);
  }
  useEffect(() => { loadTasks(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = (tasks ?? []).filter((t) => filterStatus === "all" || t.status === filterStatus);
  const openCount = (tasks ?? []).filter((t) => t.status === "assigned" || t.status === "in_progress").length;

  return (
    <div className="shell">
      <header className="top">
        <a href="/" className="brandRow"><img src="/logo.png" alt="" className="logo" /><span>SUIBING</span></a>
        <div className="topRight">
          <span className="who">Hi, {session.fullName}</span>
          <button className="link" onClick={() => setShowAccount(true)}>Account</button>
          <button className="link" onClick={onLogout}>Sign out</button>
        </div>
      </header>

      <main className="main">
        <div className="pageHead">
          <h1>Your tasks</h1>
          {openCount > 0 && <span className="pill navy">{openCount} open</span>}
        </div>

        <div className="filters">
          {["all", "assigned", "in_progress", "done", "reviewed"].map((s) => (
            <button key={s} className={filterStatus === s ? "chip on" : "chip"} onClick={() => setFilterStatus(s)}>
              {s === "all" ? "All" : STATUS_LABEL[s]?.label ?? s}
            </button>
          ))}
        </div>

        {tasks === null ? (
          <p className="muted">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="muted">No tasks in this view.</p>
        ) : (
          <div className="cardList">
            {visible.map((t) => (
              <div key={t.id} className="taskCard card" onClick={() => setSelected(t)}>
                <div className="taskTop">
                  <div>
                    <div className="taskTitle">{t.title}</div>
                    <div className="taskMeta">{t.category}{t.school_name ? ` · ${t.school_name}` : ""}</div>
                  </div>
                  <span className={`pill ${STATUS_LABEL[t.status]?.tone}`}>{STATUS_LABEL[t.status]?.label}</span>
                </div>
                <div className="taskDate">Updated {new Date(t.updated_at).toLocaleDateString("en-GB")}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <TaskDetail
          task={selected}
          session={session}
          onClose={() => setSelected(null)}
          onChanged={loadTasks}
        />
      )}

      {showAccount && <AccountModal session={session} onClose={() => setShowAccount(false)} />}

      <WhatsAppButton />
      <style jsx>{`
        .shell { min-height: 100vh; background: var(--paper); }
        .top { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; background: #fff; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 20; }
        .brandRow { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--navy); font-weight: 800; font-size: 14px; }
        .logo { width: 26px; height: 26px; }
        .topRight { display: flex; align-items: center; gap: 14px; }
        .who { font-size: 13px; color: var(--ink-2); }
        .link { background: none; border: none; font-size: 13px; font-weight: 600; color: var(--navy); cursor: pointer; }
        .main { max-width: 760px; margin: 0 auto; padding: 24px 20px 60px; }
        .pageHead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        h1 { font-size: 20px; font-weight: 700; color: var(--ink); }
        .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
        .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
        .muted { color: var(--muted); font-size: 13px; }
        .cardList { display: flex; flex-direction: column; gap: 10px; }
        .taskCard { padding: 16px; cursor: pointer; }
        .taskTop { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .taskTitle { font-size: 14.5px; font-weight: 700; color: var(--ink); }
        .taskMeta { font-size: 12.5px; color: var(--muted); margin-top: 2px; }
        .taskDate { font-size: 11.5px; color: var(--muted); margin-top: 10px; }
        .pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .pill.amber { background: #FBF0DC; color: var(--amber); }
        .pill.navy { background: var(--navy-soft); color: var(--navy); }
        .pill.green { background: var(--green-soft); color: var(--green); }
        .pill.muted { background: var(--paper-2); color: var(--muted); }
      `}</style>
    </div>
  );
}

function TaskDetail({
  task, session, onClose, onChanged,
}: { task: TaskRow; session: Session; onClose: () => void; onChanged: () => void }) {
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(task.status);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.rpc("get_task_thread", { p_username: session.username, p_pin: session.pin, p_task_id: task.id });
    setMessages((data as ThreadMsg[]) ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setTaskStatus(newStatus: "in_progress" | "done") {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("update_task_status", { p_username: session.username, p_pin: session.pin, p_task_id: task.id, p_status: newStatus });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStatus(newStatus);
    onChanged();
  }

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    setErr(null);
    const { error } = await supabase.rpc("reply_to_task_as_staff", { p_username: session.username, p_pin: session.pin, p_task_id: task.id, p_message: reply.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setReply("");
    load();
    onChanged();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dh">
          <div>
            <h3>{task.title}</h3>
            <div className="dhMeta">
              <span>{task.category}</span>
              <span className={`pill ${STATUS_LABEL[status]?.tone}`}>{STATUS_LABEL[status]?.label}</span>
            </div>
          </div>
          <button className="x" onClick={onClose}>✕</button>
        </div>

        {task.school_name && (
          <div className="schoolBox">
            <strong>{task.school_name}</strong>
            {task.school_url && <a href={task.school_url} target="_blank" rel="noreferrer">Open school portal ↗</a>}
          </div>
        )}

        {task.instructions && <div className="msgBox"><div className="l">Instructions</div><div>{task.instructions}</div></div>}

        {status !== "reviewed" && (
          <div className="statusActions">
            {status === "assigned" && (
              <button className="btn ok" disabled={busy} onClick={() => setTaskStatus("in_progress")}>Start — mark in progress</button>
            )}
            {(status === "assigned" || status === "in_progress") && (
              <button className="btn" disabled={busy} onClick={() => setTaskStatus("done")}>Mark done</button>
            )}
          </div>
        )}

        <div className="thread">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender}`}>
              <div className="bubbleSender">{m.sender === "staff" ? "You" : "Suibing"}</div>
              <div>{m.body}</div>
              <div className="bubbleTime">{new Date(m.created_at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </div>

        <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Leave a note or ask a question…" />
        {err && <div className="err">{err}</div>}
        <button className="btn ok" disabled={busy || !reply.trim()} onClick={send} style={{ width: "100%", marginTop: 10 }}>
          {busy ? "Sending…" : "Send"}
        </button>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.45); display: flex; justify-content: flex-end; z-index: 300; backdrop-filter: blur(1px); }
          .drawer { width: 100%; max-width: 560px; height: 100%; overflow-y: auto; padding: 24px; }
          .dh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
          .dhMeta { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: var(--ink-2); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
          .pill.amber { background: #FBF0DC; color: var(--amber); }
          .pill.navy { background: var(--navy-soft); color: var(--navy); }
          .pill.green { background: var(--green-soft); color: var(--green); }
          .pill.muted { background: var(--paper-2); color: var(--muted); }
          .schoolBox { background: var(--navy-soft); border-radius: var(--radius-sm); padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; }
          .schoolBox a { color: var(--navy); font-weight: 600; text-decoration: none; font-size: 12.5px; }
          .msgBox { background: var(--paper-2); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 14px; font-size: 13px; line-height: 1.5; }
          .l { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
          .statusActions { display: flex; gap: 8px; margin-bottom: 16px; }
          .statusActions .btn { flex: 1; }
          .thread { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; max-height: 280px; overflow-y: auto; }
          .bubble { border-radius: var(--radius-sm); padding: 10px 12px; font-size: 13px; max-width: 85%; }
          .bubble.staff { background: var(--navy); color: #fff; align-self: flex-end; }
          .bubble.operator { background: var(--paper-2); color: var(--ink); align-self: flex-start; }
          .bubbleSender { font-size: 10.5px; font-weight: 700; opacity: 0.7; margin-bottom: 2px; }
          .bubbleTime { font-size: 10px; opacity: 0.6; margin-top: 4px; }
          textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 13.5px; font-family: inherit; resize: vertical; box-sizing: border-box; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
        `}</style>
      </div>
    </div>
  );
}

function AccountModal({ session, onClose }: { session: Session; onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function change() {
    setErr(null);
    if (newPin.trim().length < 4) { setErr("New PIN must be at least 4 characters."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("change_staff_pin", { p_username: session.username, p_current_pin: currentPin.trim(), p_new_pin: newPin.trim() });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOk(true);
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh"><h3>Change PIN</h3><button className="x" onClick={onClose}>✕</button></div>
        {ok ? (
          <p className="okMsg">Your PIN has been changed.</p>
        ) : (
          <>
            <label>Current PIN</label>
            <input type="password" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} />
            <label>New PIN (at least 4 characters)</label>
            <input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
            {err && <div className="err">{err}</div>}
            <button className="btn ok" disabled={busy} onClick={change} style={{ width: "100%", marginTop: 14 }}>
              {busy ? "Saving…" : "Change PIN"}
            </button>
          </>
        )}
        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); }
          .modal { width: 100%; max-width: 380px; padding: 24px; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
          h3 { font-size: 16px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 6px; }
          input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; box-sizing: border-box; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
          .okMsg { color: var(--green); font-size: 13.5px; }
        `}</style>
      </div>
    </div>
  );
}
