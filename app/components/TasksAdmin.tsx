"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type StaffRow = { id: string; full_name: string; username: string; status: string };
type TaskRow = {
  id: string; staff_id: string; category: string; title: string; instructions: string | null;
  school_name: string | null; school_url: string | null;
  status: "assigned" | "in_progress" | "done" | "reviewed"; updated_at: string; created_at: string;
};
type ThreadMsg = { id: string; sender: "staff" | "operator"; body: string; created_at: string };

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  assigned: { label: "Assigned", tone: "amber" },
  in_progress: { label: "In progress", tone: "navy" },
  done: { label: "Done", tone: "green" },
  reviewed: { label: "Reviewed", tone: "muted" },
};

export default function TasksAdmin({ operatorEmail }: { operatorEmail: string }) {
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterStaff, setFilterStaff] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<TaskRow | null>(null);

  async function loadAll() {
    const [s, t, c] = await Promise.all([
      supabase.rpc("list_staff"),
      supabase.from("tasks").select("*").order("updated_at", { ascending: false }),
      supabase.rpc("list_task_categories"),
    ]);
    setStaff(((s.data as StaffRow[]) ?? []).filter((x) => x.status === "active"));
    setTasks((t.data as TaskRow[]) ?? []);
    setCategories(((c.data as { name: string }[]) ?? []).map((r) => r.name));
  }
  useEffect(() => { loadAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const staffName = (id: string) => staff.find((s) => s.id === id)?.full_name ?? "(removed staff)";
  const visible = tasks.filter((t) =>
    (filterStaff === "" || t.staff_id === filterStaff) && (filterStatus === "all" || t.status === filterStatus)
  );

  return (
    <div>
      <div className="bar">
        <h2>Tasks</h2>
        <button className="btn ok" onClick={() => setShowAdd(true)} disabled={staff.length === 0}>+ Assign task</button>
      </div>
      {staff.length === 0 && <p className="hint">Add a staff member first, from the Staff tab, before assigning tasks.</p>}

      <div className="filters">
        <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
          <option value="">All staff</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead><tr><th>Task</th><th>Staff</th><th>School</th><th>Category</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={6} className="empty">No tasks in this view.</td></tr>
            ) : visible.map((t) => (
              <tr key={t.id} onClick={() => setSelected(t)}>
                <td data-label="Task">{t.title}</td>
                <td data-label="Staff">{staffName(t.staff_id)}</td>
                <td data-label="School">{t.school_name || "—"}</td>
                <td data-label="Category">{t.category}</td>
                <td data-label="Status"><span className={`pill ${STATUS_LABEL[t.status]?.tone}`}>{STATUS_LABEL[t.status]?.label}</span></td>
                <td data-label="Updated">{new Date(t.updated_at).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddTaskModal
          staff={staff}
          categories={categories}
          operatorEmail={operatorEmail}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadAll(); }}
        />
      )}

      {selected && (
        <TaskDrawer
          task={selected}
          staffName={staffName(selected.staff_id)}
          operatorEmail={operatorEmail}
          onClose={() => setSelected(null)}
          onChanged={loadAll}
        />
      )}

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .hint { font-size: 13px; color: var(--muted); margin-bottom: 14px; }
        .filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .filters select { border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 7px 10px; font-size: 13px; background: #fff; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--line); }
        td { padding: 10px 12px; border-bottom: 1px solid var(--line); cursor: pointer; }
        tr:hover td { background: var(--paper-2); }
        .empty { text-align: center; color: var(--muted); padding: 30px; cursor: default; }
        .pill { font-size: 10.5px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
        .pill.amber { background: #FBF0DC; color: var(--amber); }
        .pill.navy { background: var(--navy-soft); color: var(--navy); }
        .pill.green { background: var(--green-soft); color: var(--green); }
        .pill.muted { background: var(--paper-2); color: var(--muted); }
      `}</style>
    </div>
  );
}

function AddTaskModal({
  staff, categories, operatorEmail, onClose, onSaved,
}: { staff: StaffRow[]; categories: string[]; operatorEmail: string; onClose: () => void; onSaved: () => void }) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [category, setCategory] = useState(categories[0] ?? "General");
  const [customCategory, setCustomCategory] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolUrl, setSchoolUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!staffId) { setErr("Choose a staff member."); return; }
    if (!title.trim()) { setErr("Enter a task title."); return; }
    const finalCategory = category === "__new__" ? customCategory.trim() : category;
    if (!finalCategory) { setErr("Enter a category name."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("create_task", {
      p_staff_id: staffId, p_category: finalCategory, p_title: title.trim(),
      p_instructions: instructions.trim() || null, p_school_name: schoolName.trim() || null,
      p_school_url: schoolUrl.trim() || null, p_by: operatorEmail,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onSaved();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh"><h3>Assign task</h3><button className="x" onClick={onClose}>✕</button></div>

        <label>Staff member</label>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>

        <label>Category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          <option value="__new__">+ New category…</option>
        </select>
        {category === "__new__" && (
          <input placeholder="New category name" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} style={{ marginTop: 8 }} />
        )}

        <label>Task title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Enter Term 1 exam questions" />

        <label>Instructions</label>
        <textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What exactly should they do?" />

        <label>School name (optional)</label>
        <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Assalam International Academic School" />

        <label>School portal link (optional)</label>
        <input value={schoolUrl} onChange={(e) => setSchoolUrl(e.target.value)} placeholder="https://..." />

        {err && <div className="err">{err}</div>}
        <button className="btn ok" disabled={busy} onClick={save} style={{ width: "100%", marginTop: 14 }}>
          {busy ? "Assigning…" : "Assign task"}
        </button>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 480px; padding: 24px; max-height: 90vh; overflow-y: auto; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
          h3 { font-size: 16px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 6px; }
          input, select, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; background: #fff; }
          textarea { resize: vertical; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
        `}</style>
      </div>
    </div>
  );
}

function TaskDrawer({
  task, staffName, operatorEmail, onClose, onChanged,
}: { task: TaskRow; staffName: string; operatorEmail: string; onClose: () => void; onChanged: () => void }) {
  const [messages, setMessages] = useState<ThreadMsg[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(task.status);

  async function load() {
    const { data } = await supabase.from("task_messages").select("*").eq("task_id", task.id).order("created_at", { ascending: true });
    setMessages((data as ThreadMsg[]) ?? []);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(markReviewed: boolean) {
    if (!reply.trim() && !markReviewed) return;
    setBusy(true);
    if (reply.trim()) {
      await supabase.rpc("reply_to_task_as_operator", { p_task_id: task.id, p_message: reply.trim(), p_by: operatorEmail, p_mark_reviewed: markReviewed });
    } else if (markReviewed) {
      await supabase.rpc("set_task_status_as_operator", { p_task_id: task.id, p_status: "reviewed", p_by: operatorEmail });
    }
    setBusy(false);
    setReply("");
    if (markReviewed) setStatus("reviewed");
    load();
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete task "${task.title}"? This cannot be undone.`)) return;
    await supabase.rpc("delete_task", { p_task_id: task.id, p_by: operatorEmail });
    onChanged();
    onClose();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dh">
          <div>
            <h3>{task.title}</h3>
            <div className="dhMeta">
              <span>{staffName}</span>
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

        <div className="thread">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender}`}>
              <div className="bubbleSender">{m.sender === "operator" ? "You" : staffName}</div>
              <div>{m.body}</div>
              <div className="bubbleTime">{new Date(m.created_at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </div>

        <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply or leave feedback…" />
        <div className="actions">
          <button className="btn ghost" disabled={busy} onClick={() => send(true)}>Mark reviewed</button>
          <button className="btn ok" disabled={busy || !reply.trim()} onClick={() => send(false)}>Send</button>
        </div>
        <button className="btn danger" onClick={remove} style={{ width: "100%", marginTop: 10 }}>Delete task</button>

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
          .thread { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; max-height: 300px; overflow-y: auto; }
          .bubble { border-radius: var(--radius-sm); padding: 10px 12px; font-size: 13px; max-width: 85%; }
          .bubble.operator { background: var(--navy); color: #fff; align-self: flex-end; }
          .bubble.staff { background: var(--paper-2); color: var(--ink); align-self: flex-start; }
          .bubbleSender { font-size: 10.5px; font-weight: 700; opacity: 0.7; margin-bottom: 2px; }
          .bubbleTime { font-size: 10px; opacity: 0.6; margin-top: 4px; }
          textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 13.5px; font-family: inherit; resize: vertical; box-sizing: border-box; }
          .actions { display: flex; gap: 8px; margin-top: 10px; }
          .actions .btn { flex: 1; }
        `}</style>
      </div>
    </div>
  );
}
