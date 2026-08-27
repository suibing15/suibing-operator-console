"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Toast } from "@/lib/reviewUi";
import { compressImage } from "@/lib/imageCompress";

type Testimonial = {
  id: string;
  school_name: string;
  quote: string | null;
  person_name: string | null;
  media_type: "image" | "video_link";
  media_path: string | null;
  media_mimetype: string | null;
  video_url: string | null;
  display_order: number;
  is_active: boolean;
};

function publicMediaUrl(path: string) {
  return supabase.storage.from("testimonials-media").getPublicUrl(path).data.publicUrl;
}

export default function TestimonialsManager() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [editing, setEditing] = useState<Testimonial | "new" | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("testimonials").select("*").order("display_order", { ascending: true });
    setItems((data as Testimonial[]) ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(t: Testimonial) {
    const { error } = await supabase.from("testimonials").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) { setToast({ kind: "error", message: error.message }); return; }
    load();
  }

  async function move(t: Testimonial, dir: -1 | 1) {
    const idx = items.findIndex((x) => x.id === t.id);
    const swapWith = items[idx + dir];
    if (!swapWith) return;
    await supabase.from("testimonials").update({ display_order: swapWith.display_order }).eq("id", t.id);
    await supabase.from("testimonials").update({ display_order: t.display_order }).eq("id", swapWith.id);
    load();
  }

  async function remove(t: Testimonial) {
    if (!confirm(`Remove the testimonial from "${t.school_name}"? This can't be undone.`)) return;
    if (t.media_path) {
      await supabase.storage.from("testimonials-media").remove([t.media_path]);
    }
    const { error } = await supabase.from("testimonials").delete().eq("id", t.id);
    if (error) { setToast({ kind: "error", message: error.message }); return; }
    setToast({ kind: "success", message: "Testimonial removed" });
    load();
  }

  return (
    <div>
      <div className="bar">
        <h2>Testimonials</h2>
        <button className="btn" onClick={() => setEditing("new")}>Add testimonial</button>
      </div>
      <p className="hint">Photos are uploaded and compressed automatically. For video, paste a link (e.g. Google Drive share link or YouTube) — video files are not uploaded directly.</p>

      <div className="grid">
        {items.length === 0 ? (
          <p className="empty">No testimonials yet. Click "Add testimonial".</p>
        ) : items.map((t, i) => (
          <div key={t.id} className="tCard card">
            <div className="tMedia">
              {t.media_type === "image" && t.media_path ? (
                <img src={publicMediaUrl(t.media_path)} alt="" />
              ) : (
                <div className="videoPlaceholder">🎬 Video link</div>
              )}
            </div>
            <div className="tBody">
              <div className="tSchool">{t.school_name}</div>
              {t.person_name && <div className="tPerson">{t.person_name}</div>}
              {t.quote && <div className="tQuote">"{t.quote}"</div>}
              <div className="tMeta">
                <button className={`pill ${t.is_active ? "on" : "off"}`} onClick={() => toggleActive(t)}>
                  {t.is_active ? "Visible" : "Hidden"}
                </button>
                <div className="tActions">
                  <button className="iconBtn" disabled={i === 0} onClick={() => move(t, -1)} title="Move up">↑</button>
                  <button className="iconBtn" disabled={i === items.length - 1} onClick={() => move(t, 1)} title="Move down">↓</button>
                  <button className="mini" onClick={() => setEditing(t)}>Edit</button>
                  <button className="mini danger" onClick={() => remove(t)}>Remove</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <TestimonialForm
          initial={editing === "new" ? null : editing}
          nextOrder={items.length}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setToast({ kind: "success", message: msg }); load(); }}
        />
      )}

      {toast && <Toast kind={toast.kind} message={toast.message} onDone={() => setToast(null)} />}

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .hint { font-size: 13px; color: var(--muted); margin-bottom: 20px; line-height: 1.5; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
        .empty { grid-column: 1 / -1; text-align: center; color: var(--muted); padding: 30px; }
        .tCard { padding: 0; overflow: hidden; }
        .tMedia { width: 100%; aspect-ratio: 16/10; background: var(--paper-2); display: flex; align-items: center; justify-content: center; }
        .tMedia img { width: 100%; height: 100%; object-fit: cover; }
        .videoPlaceholder { color: var(--muted); font-size: 13px; }
        .tBody { padding: 16px; }
        .tSchool { font-weight: 700; color: var(--ink); font-size: 14px; }
        .tPerson { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .tQuote { font-size: 13px; color: var(--ink-2); font-style: italic; margin: 10px 0; line-height: 1.5; }
        .tMeta { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; flex-wrap: wrap; gap: 8px; }
        .pill { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 999px; border: none; cursor: pointer; }
        .pill.on { background: var(--green-soft); color: var(--green); }
        .pill.off { background: var(--paper-2); color: var(--muted); }
        .tActions { display: flex; gap: 5px; }
        .iconBtn { background: var(--paper-2); border: 1px solid var(--line-strong); border-radius: 6px; width: 24px; height: 24px; cursor: pointer; font-size: 11px; color: var(--ink-2); }
        .iconBtn:disabled { opacity: 0.35; cursor: default; }
        .mini { background: var(--navy-soft); color: var(--navy); border: none; border-radius: var(--radius-sm); padding: 5px 10px; font-size: 11.5px; font-weight: 600; cursor: pointer; }
        .mini.danger { background: var(--red-soft); color: var(--red); }
      `}</style>
    </div>
  );
}

function TestimonialForm({ initial, nextOrder, onCancel, onSaved }: {
  initial: Testimonial | null; nextOrder: number;
  onCancel: () => void; onSaved: (msg: string) => void;
}) {
  const [mediaType, setMediaType] = useState<"image" | "video_link">(initial?.media_type ?? "image");
  const [schoolName, setSchoolName] = useState(initial?.school_name ?? "");
  const [personName, setPersonName] = useState(initial?.person_name ?? "");
  const [quote, setQuote] = useState(initial?.quote ?? "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function save() {
    setErr(null);
    if (!schoolName.trim()) { setErr("School/organisation name is required."); return; }
    if (mediaType === "video_link" && !videoUrl.trim()) { setErr("Enter a video link."); return; }
    if (mediaType === "image" && !initial && !file) { setErr("Choose a photo to upload."); return; }

    setBusy(true);
    try {
      let mediaPath = initial?.media_path ?? null;
      let mediaMimetype = initial?.media_mimetype ?? null;

      if (mediaType === "image" && file) {
        setProgress("Compressing image…");
        const { blob } = await compressImage(file, { maxDimension: 1600, quality: 0.75 });
        setProgress("Uploading…");
        const path = `testimonial-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage.from("testimonials-media").upload(path, blob, {
          contentType: "image/jpeg", upsert: false,
        });
        if (upErr) throw new Error(upErr.message);
        // Remove the old file if replacing an existing image
        if (initial?.media_path) await supabase.storage.from("testimonials-media").remove([initial.media_path]);
        mediaPath = path;
        mediaMimetype = "image/jpeg";
      }

      setProgress("Saving…");
      const payload = {
        school_name: schoolName.trim(),
        person_name: personName.trim() || null,
        quote: quote.trim() || null,
        media_type: mediaType,
        media_path: mediaType === "image" ? mediaPath : null,
        media_mimetype: mediaType === "image" ? mediaMimetype : null,
        video_url: mediaType === "video_link" ? videoUrl.trim() : null,
        display_order: initial?.display_order ?? nextOrder,
        is_active: initial?.is_active ?? true,
      };

      const { error } = initial
        ? await supabase.from("testimonials").update(payload).eq("id", initial.id)
        : await supabase.from("testimonials").insert(payload);
      if (error) throw new Error(error.message);

      onSaved(initial ? "Testimonial updated" : "Testimonial added");
    } catch (e: any) {
      setErr(e?.message || "Could not save testimonial.");
    }
    setBusy(false);
    setProgress(null);
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>{initial ? "Edit testimonial" : "Add testimonial"}</h3>
          <button className="x" onClick={onCancel} type="button">✕</button>
        </div>

        <label>Media type</label>
        <div className="toggle">
          <button type="button" className={mediaType === "image" ? "seg on" : "seg"} onClick={() => setMediaType("image")}>Photo</button>
          <button type="button" className={mediaType === "video_link" ? "seg on" : "seg"} onClick={() => setMediaType("video_link")}>Video link</button>
        </div>

        {mediaType === "image" ? (
          <>
            <label>{initial?.media_path ? "Replace photo (optional)" : "Photo"}</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {initial?.media_path && !file && (
              <img src={publicMediaUrl(initial.media_path)} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 10, maxHeight: 160, objectFit: "cover" }} />
            )}
          </>
        ) : (
          <>
            <label>Video link (Google Drive, YouTube, etc.)</label>
            <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
          </>
        )}

        <label>School / organisation name</label>
        <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Assalam International Academic School" />

        <label>Person (optional)</label>
        <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="Malam Ibrahim, Principal" />

        <label>Quote (optional)</label>
        <textarea rows={3} value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="What they said about working with us..." />

        {err && <div className="err">{err}</div>}
        {progress && <div className="progress">{progress}</div>}

        <div className="mf">
          <button className="btn ghost" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn ok" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Add testimonial"}</button>
        </div>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 460px; padding: 24px; margin: 20px 0; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
          input, textarea { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; background: #fff; box-sizing: border-box; }
          input:focus, textarea:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          textarea { resize: vertical; }
          .toggle { display: flex; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); overflow: hidden; }
          .seg { flex: 1; background: #fff; border: none; padding: 9px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
          .seg.on { background: var(--navy); color: #fff; }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
          .progress { font-size: 13px; color: var(--navy); margin-top: 12px; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        `}</style>
      </div>
    </div>
  );
}
