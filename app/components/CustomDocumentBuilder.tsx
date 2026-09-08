"use client";
import { useState } from "react";

export default function CustomDocumentBuilder() {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [body, setBody] = useState("");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setErr(null);
    if (!title.trim()) { setErr("Enter a title."); return; }
    if (!body.trim()) { setErr("Enter the document body text."); return; }
    setBusy(true);
    try {
      const { generateCustomDocPdf } = await import("@/lib/custom-document");
      await generateCustomDocPdf({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        recipientAddress: recipientAddress.trim() || undefined,
        body,
        includeSignature,
        fileName: fileName.trim() || undefined,
      });
    } catch (e: any) {
      setErr(e?.message || "Could not generate the document.");
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
          <label>Body text</label>
          <textarea
            rows={14}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Write freely. Leave a blank line between paragraphs to start a new one.\n\nExample:\nThis Agreement is made between SUIBING LIMITED (\"the Company\") and the above-named party (\"the Client\").\n\n1. The Company agrees to provide...\n\n2. The Client agrees to..."}
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
      </div>

      {err && <div className="err">{err}</div>}

      <button className="btn ok" onClick={generate} disabled={busy} style={{ marginTop: 16 }}>
        {busy ? "Generating…" : "Generate PDF"}
      </button>

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .intro { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 18px; max-width: 640px; }
        .formGrid { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.full { grid-column: 1 / -1; }
        label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
        input, textarea { border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; }
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
