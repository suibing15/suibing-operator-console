"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type SchoolLite = { id: string; name: string };

export default function CustomDocumentBuilder({ operatorEmail }: { operatorEmail: string }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [body, setBody] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [fileName, setFileName] = useState("");
  const [fontFamily, setFontFamily] = useState<"helvetica" | "times" | "courier">("helvetica");
  const [fontSize, setFontSize] = useState(11);
  const [fontColor, setFontColor] = useState("#45506A");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "justify">("left");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolLite[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");

  useEffect(() => {
    supabase.from("schools").select("id, name").order("name").then(({ data }) => {
      setSchools((data as SchoolLite[]) ?? []);
    });
  }, []);

  function validate() {
    if (!title.trim()) { setErr("Enter a title."); return false; }
    if (!body.trim()) { setErr("Enter the document body text."); return false; }
    return true;
  }

  async function download() {
    setErr(null); setMsg(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const { generateCustomDocPdf } = await import("@/lib/custom-document");
      await generateCustomDocPdf({
        title: title.trim(), subtitle: subtitle.trim() || undefined,
        recipientName: recipientName.trim() || undefined, recipientAddress: recipientAddress.trim() || undefined,
        body, includeSignature, fileName: fileName.trim() || undefined,
        fontFamily, fontSize, fontColor, textAlign,
      });
    } catch (e: any) {
      setErr(e?.message || "Could not generate the document.");
    }
    setBusy(false);
  }

  async function sendToSchool() {
    setErr(null); setMsg(null);
    if (!validate()) return;
    if (!selectedSchoolId) { setErr("Choose a school to send this to."); return; }
    setBusy(true);
    try {
      const { buildCustomDocBase64 } = await import("@/lib/custom-document");
      const { base64, fileName: fname } = await buildCustomDocBase64({
        title: title.trim(), subtitle: subtitle.trim() || undefined,
        recipientName: recipientName.trim() || undefined, recipientAddress: recipientAddress.trim() || undefined,
        body, includeSignature, fileName: fileName.trim() || undefined,
        fontFamily, fontSize, fontColor, textAlign,
      });
      const { error } = await supabase.rpc("send_school_document", {
        p_school_id: selectedSchoolId, p_title: title.trim(), p_file_data: base64, p_file_name: fname, p_by: operatorEmail,
      });
      if (error) throw new Error(error.message);
      const schoolName = schools.find((s) => s.id === selectedSchoolId)?.name ?? "the school";
      setMsg(`Sent to ${schoolName}. It's now downloadable from their portal.`);
    } catch (e: any) {
      setErr(e?.message || "Could not send the document.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="bar">
        <h2>Custom document</h2>
      </div>
      <p className="intro">
        Write any contract, agreement, letter, or report in your own words, and generate it as a professional PDF
        with your logo, letterhead, and (optionally) your signature — the same branding used on every invoice and
        receipt.
      </p>

      <div className="formGrid card">
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Memorandum of Understanding" />
        </div>
        <div className="field">
          <label>Subtitle (optional)</label>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="e.g. Between Suibing IT Services and ..." />
        </div>
        <div className="field">
          <label>Addressed to (optional)</label>
          <input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="e.g. The Principal, Example School" />
        </div>
        <div className="field">
          <label>Recipient address (optional)</label>
          <input value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} placeholder="e.g. 12 School Road, Kano" />
        </div>
        <div className="field full">
          <label>Body text style</label>
          <div className="styleRow">
            <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as typeof fontFamily)}>
              <option value="helvetica">Helvetica (sans-serif)</option>
              <option value="times">Times (serif)</option>
              <option value="courier">Courier (monospace)</option>
            </select>
            <select value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))}>
              {[9, 10, 11, 12, 13, 14, 16].map((s) => <option key={s} value={s}>{s}pt</option>)}
            </select>
            <select value={textAlign} onChange={(e) => setTextAlign(e.target.value as typeof textAlign)}>
              <option value="left">Left</option>
              <option value="center">Centred</option>
              <option value="justify">Justified</option>
            </select>
            <label className="colorField">
              <input type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
              Text colour
            </label>
          </div>
        </div>
        <div className="field full">
          <label>Body text</label>
          <textarea
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Write freely. Leave a blank line between paragraphs to start a new one.\n\nExample:\nThis Agreement is made between SUIBING LIMITED (\"the Company\") and the above-named party (\"the Client\").\n\n1. The Company agrees to provide...\n\n2. The Client agrees to..."}
            style={{
              fontFamily: fontFamily === "times" ? "Georgia, serif" : fontFamily === "courier" ? "monospace" : "inherit",
              fontSize: `${fontSize + 2}px`,
              color: fontColor,
              textAlign: textAlign === "justify" ? "justify" : textAlign,
            }}
          />
        </div>
        <div className="field">
          <label>File name (optional)</label>
          <input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="e.g. mou_example_school" />
        </div>
        <div className="field checkboxField">
          <label className="checkboxLabel">
            <input type="checkbox" checked={includeSignature} onChange={(e) => setIncludeSignature(e.target.checked)} />
            Include my signature at the bottom
          </label>
        </div>
        <div className="field full">
          <label>Send to a school (optional)</label>
          <select value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)}>
            <option value="">— Don't send, just download —</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {err && <div className="err">{err}</div>}
      {msg && <div className="msgOk">{msg}</div>}

      <div className="actions">
        <button className="btn ghost" onClick={download} disabled={busy}>
          {busy ? "Working…" : "Download PDF"}
        </button>
        <button className="btn ok" onClick={sendToSchool} disabled={busy || !selectedSchoolId}>
          {busy ? "Sending…" : "Send to selected school"}
        </button>
      </div>

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .intro { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 18px; max-width: 640px; }
        .formGrid { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.full { grid-column: 1 / -1; }
        label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
        input, textarea, select { border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; background: #fff; }
        .styleRow { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .styleRow select { flex: 1; min-width: 120px; }
        .colorField { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .colorField input[type="color"] { width: 34px; height: 34px; padding: 2px; cursor: pointer; }
        .actions { display: flex; gap: 10px; margin-top: 16px; }
        .msgOk { color: var(--green); font-size: 13px; margin-top: 12px; max-width: 640px; }
        textarea { resize: vertical; line-height: 1.5; }
        .checkboxField { display: flex; align-items: center; }
        .checkboxLabel { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--ink); cursor: pointer; }
        .checkboxLabel input { width: auto; }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; max-width: 640px; }
        @media (max-width: 700px) { .formGrid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
