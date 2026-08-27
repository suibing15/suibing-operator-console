"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Posting = { id: string; title: string; description: string | null; is_open: boolean; created_at: string };

export default function JobPostings() {
  const [rows, setRows] = useState<Posting[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("job_postings").select("*").order("created_at", { ascending: false });
    setRows((data as Posting[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(p: Posting) {
    setBusy(true);
    await supabase.from("job_postings").update({ is_open: !p.is_open }).eq("id", p.id);
    setBusy(false);
    load();
  }

  return (
    <div>
      <div className="bar">
        <h2>Job postings</h2>
        <button className="btn" onClick={() => setShowAdd(true)}>New posting</button>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>Title</th><th>Visible on /careers</th><th>Created</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="empty">No postings yet.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.id}>
                <td data-label="Title">
                  <div className="title">{p.title}</div>
                  {p.description && <div className="desc">{p.description}</div>}
                </td>
                <td data-label="Visible on /careers"><span className={`badge ${p.is_open ? "on" : "off"}`}>{p.is_open ? "Open" : "Closed"}</span></td>
                <td data-label="Created">{new Date(p.created_at).toLocaleDateString("en-GB")}</td>
                <td className="r" data-label="">
                  <button className={`mini ${p.is_open ? "danger" : "ok"}`} disabled={busy} onClick={() => toggle(p)}>
                    {p.is_open ? "Close" : "Open"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && <AddPosting onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load(); }} />}

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .table-wrap { overflow-x: auto; }
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
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); padding: 10px 14px; border-bottom: 1px solid var(--line); }
        td { padding: 11px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        .title { font-weight: 600; color: var(--ink); }
        .desc { font-size: 12px; color: var(--muted); margin-top: 2px; max-width: 420px; }
        .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 3px 9px; border-radius: 999px; }
        .badge.on { background: var(--green-soft); color: var(--green); }
        .badge.off { background: var(--paper-2); color: var(--muted); }
        .r { text-align: right; }
        .mini { border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; color: #fff; }
        .mini.ok { background: var(--green); }
        .mini.danger { background: var(--red); }
        .empty { text-align: center; color: var(--muted); padding: 30px; }
      `}</style>
    </div>
  );
}

function AddPosting({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [openNow, setOpenNow] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr(null);
    if (!title.trim()) { setErr("Title is required."); return; }
    setBusy(true);
    const { error } = await supabase.from("job_postings").insert({
      title: title.trim(), description: description.trim() || null, is_open: openNow,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="mh"><h3>New job posting</h3><button className="x" onClick={onClose}>✕</button></div>
        <label>Job title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Developer" />
        <label>Description</label>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="chk"><input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} /> Make visible on /careers immediately</label>
        {err && <div className="err">{err}</div>}
        <div className="mf">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={save} disabled={busy}>{busy ? "Saving…" : "Create posting"}</button>
        </div>
        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(20,28,45,0.4); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 60; }
          .modal { width: 100%; max-width: 460px; padding: 24px; }
          .mh { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
          h3 { font-size: 18px; font-weight: 700; }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
          label.chk { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-top: 14px; }
          label.chk input { width: auto; }
          input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 10px 12px; font-size: 14px; font-family: inherit; }
          textarea { resize: vertical; }
          input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 10px; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        `}</style>
      </div>
    </div>
  );
}
