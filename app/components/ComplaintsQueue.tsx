"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Toast } from "@/lib/reviewUi";

type Complaint = {
  id: string; school_id: string; school_key: string; subject: string; status: string;
  created_at: string; updated_at: string;
};
type Message = { id: string; sender: "school" | "operator"; body: string; by_email: string | null; created_at: string };
type SchoolLite = { id: string; name: string };

const FILTERS: { key: string; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

export default function ComplaintsQueue({ operatorEmail }: { operatorEmail: string }) {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [schools, setSchools] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("open");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("complaints").select("*").order("updated_at", { ascending: false });
    setRows((data as Complaint[]) ?? []);
    const { data: sc } = await supabase.from("schools").select("id,name");
    const map: Record<string, string> = {};
    (sc as SchoolLite[] ?? []).forEach((s) => { map[s.id] = s.name; });
    setSchools(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const openCount = rows.filter((r) => r.status === "open").length;

  return (
    <div>
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.key} className={filter === f.key ? "chip on" : "chip"} onClick={() => setFilter(f.key)}>
            {f.label}{f.key === "open" && openCount > 0 ? ` (${openCount})` : ""}
          </button>
        ))}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>School</th><th>Subject</th><th>Status</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={5} className="empty">Nothing here.</td></tr>
            ) : visible.map((c) => (
              <tr key={c.id} onClick={() => setSelected(c)}>
                <td data-label="School">{schools[c.school_id] ?? c.school_key}</td>
                <td data-label="Subject">{c.subject}</td>
                <td data-label="Status"><span className={`badge ${c.status}`}>{c.status}</span></td>
                <td data-label="Updated">{new Date(c.updated_at).toLocaleString("en-GB")}</td>
                <td className="r" data-label=""><button className="mini" onClick={(e) => { e.stopPropagation(); setSelected(c); }}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ComplaintDrawer
          complaint={selected}
          schoolName={schools[selected.school_id] ?? selected.school_key}
          operatorEmail={operatorEmail}
          onClose={() => setSelected(null)}
          onChanged={(msg) => { setToast({ kind: "success", message: msg }); load(); }}
        />
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} onDone={() => setToast(null)} />}

      <style jsx>{`
        .filters { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
        .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
        .table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--line); }
        td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        tr { cursor: pointer; }
        tr:hover td { background: var(--paper-2); }
        tr:last-child td { border-bottom: none; }
        .r { text-align: right; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
        .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
        .badge.open { background: #FBF0DC; color: var(--amber); }
        .badge.resolved { background: var(--green-soft); color: var(--green); }

        @media (max-width: 640px) {
          table, thead, tbody, th, td, tr { display: block; }
          thead { display: none; }
          .table-wrap { overflow-x: visible; }
          tr { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); margin-bottom: 10px; padding: 12px 14px; }
          td { border-bottom: none; padding: 6px 0; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
          td[data-label]::before { content: attr(data-label); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); flex-shrink: 0; }
          td[data-label=""]::before { display: none; }
          td.r { justify-content: flex-end; }
          td.empty { display: block; text-align: center; }
        }
      `}</style>
    </div>
  );
}

function ComplaintDrawer({ complaint, schoolName, operatorEmail, onClose, onChanged }: {
  complaint: Complaint; schoolName: string; operatorEmail: string; onClose: () => void; onChanged: (msg: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState(complaint.status);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("complaint_messages")
      .select("*")
      .eq("complaint_id", complaint.id)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) ?? []);
  }, [complaint.id]);

  useEffect(() => { load(); }, [load]);

  async function sendReply(markResolved: boolean) {
    setErr(null);
    if (!reply.trim()) { setErr("Enter a reply."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("reply_to_complaint_as_operator", {
      p_complaint_id: complaint.id, p_message: reply.trim(), p_by: operatorEmail, p_mark_resolved: markResolved,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setReply("");
    if (markResolved) setStatus("resolved");
    load();
    onChanged("Reply sent");
  }

  async function toggleStatus() {
    const next = status === "open" ? "resolved" : "open";
    setBusy(true);
    const { error } = await supabase.rpc("set_complaint_status", { p_complaint_id: complaint.id, p_status: next, p_by: operatorEmail });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStatus(next);
    onChanged(next === "resolved" ? "Marked resolved" : "Reopened");
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="drawer card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dh">
          <div>
            <h3>{complaint.subject}</h3>
            <span className="school">{schoolName}</span>
            <span className={`badge ${status}`}>{status}</span>
          </div>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>

        <div className="threadList">
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.sender === "operator" ? "mine" : "theirs"}`}>
              <div className="bubbleSender">{m.sender === "operator" ? (m.by_email || "You") : schoolName}</div>
              <div className="bubbleBody">{m.body}</div>
              <div className="bubbleTime">{new Date(m.created_at).toLocaleString("en-GB")}</div>
            </div>
          ))}
        </div>

        <div className="replyBox">
          <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type a reply…" />
          {err && <div className="err">{err}</div>}
          <div className="replyActions">
            <button className="btn ghost" type="button" onClick={toggleStatus} disabled={busy}>
              {status === "open" ? "Mark resolved (no reply)" : "Reopen"}
            </button>
            <button className="btn ok" type="button" onClick={() => sendReply(false)} disabled={busy}>{busy ? "Sending…" : "Send reply"}</button>
          </div>
          {status === "open" && (
            <button className="btn" type="button" onClick={() => sendReply(true)} disabled={busy} style={{ width: "100%", marginTop: 8 }}>
              Send reply & mark resolved
            </button>
          )}
        </div>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.45); display: flex; justify-content: flex-end; z-index: 50; backdrop-filter: blur(1px); }
          .drawer { width: 100%; max-width: 560px; background: var(--paper-2); height: 100%; overflow-y: auto; padding: 26px; display: flex; flex-direction: column; }
          .dh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 10px; }
          h3 { font-size: 18px; font-weight: 700; color: var(--ink); margin-bottom: 6px; }
          .school { font-size: 12.5px; color: var(--muted); margin-right: 10px; }
          .x { background: none; border: none; font-size: 18px; color: var(--muted); cursor: pointer; }
          .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
          .badge.open { background: #FBF0DC; color: var(--amber); }
          .badge.resolved { background: var(--green-soft); color: var(--green); }
          .threadList { display: flex; flex-direction: column; gap: 12px; flex: 1; margin-bottom: 16px; }
          .bubble { max-width: 85%; padding: 10px 14px; border-radius: 12px; background: #fff; border: 1px solid var(--line); }
          .bubble.mine { align-self: flex-end; background: var(--navy); color: #fff; border: none; }
          .bubbleSender { font-size: 10.5px; font-weight: 700; text-transform: uppercase; opacity: 0.7; margin-bottom: 3px; }
          .bubbleBody { font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; }
          .bubbleTime { font-size: 10px; opacity: 0.6; margin-top: 4px; }
          .replyBox { border-top: 1px solid var(--line); padding-top: 14px; }
          .replyBox textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; resize: vertical; box-sizing: border-box; }
          .replyActions { display: flex; gap: 10px; margin-top: 10px; }
          .replyActions .btn { flex: 1; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
        `}</style>
      </div>
    </div>
  );
}
