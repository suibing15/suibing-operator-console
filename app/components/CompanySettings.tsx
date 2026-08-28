"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Settings = {
  signature_data: string | null;
  signature_mimetype: string | null;
  bank_name: string;
  account_name: string;
  account_number: string;
  payment_qr_data: string | null;
  payment_qr_mimetype: string | null;
};

export default function CompanySettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_company_settings").then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setSettings(row);
        setBankName(row.bank_name);
        setAccountName(row.account_name);
        setAccountNumber(row.account_number);
      }
    });
  }, []);

  function onFileChange(f: File | null) {
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  function onQrFileChange(f: File | null) {
    setQrFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setQrPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setQrPreview(null);
    }
  }

  function fileToBase64(f: File): Promise<{ data: string; mimetype: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const [meta, data] = result.split(",");
        const mimetype = meta.match(/data:(.*);base64/)?.[1] || f.type;
        resolve({ data, mimetype });
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function save() {
    setErr(null); setMsg(null);
    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setErr("Bank name, account name, and account number are all required.");
      return;
    }
    setBusy(true);
    try {
      let sigData: string | null = null;
      let sigMime: string | null = null;
      if (file) {
        const { data, mimetype } = await fileToBase64(file);
        sigData = data;
        sigMime = mimetype;
      }
      let qrData: string | null = null;
      let qrMime: string | null = null;
      if (qrFile) {
        const { data, mimetype } = await fileToBase64(qrFile);
        qrData = data;
        qrMime = mimetype;
      }
      const { error } = await supabase.rpc("update_company_settings", {
        p_signature_data: sigData,
        p_signature_mimetype: sigMime,
        p_bank_name: bankName.trim(),
        p_account_name: accountName.trim(),
        p_account_number: accountNumber.trim(),
        p_payment_qr_data: qrData,
        p_payment_qr_mimetype: qrMime,
      });
      if (error) throw new Error(error.message);
      setMsg("Saved. New documents will use these details and images immediately.");
      setFile(null);
      setQrFile(null);
    } catch (e: any) {
      setErr(e?.message || "Could not save settings.");
    }
    setBusy(false);
  }

  const currentSignatureUrl = settings?.signature_data
    ? `data:${settings.signature_mimetype || "image/jpeg"};base64,${settings.signature_data}`
    : null;
  const currentQrUrl = settings?.payment_qr_data
    ? `data:${settings.payment_qr_mimetype || "image/jpeg"};base64,${settings.payment_qr_data}`
    : null;

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mh">
          <h3>Company settings</h3>
          <button className="x" onClick={onClose} type="button">✕</button>
        </div>
        <p className="hint">These appear on every generated invoice, receipt, contract, and offer letter — signature, bank name, account name, and account number.</p>

        <label>Signature image</label>
        <div className="sigPreviewBox">
          {(preview || currentSignatureUrl) ? (
            <img src={preview || currentSignatureUrl!} alt="Signature" />
          ) : (
            <span className="noSig">No signature uploaded yet</span>
          )}
        </div>
        <input type="file" accept="image/*" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} />

        <label>Bank name</label>
        <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="OPay" />
        <label>Account name</label>
        <input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        <label>Account number</label>
        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />

        <label>Payment QR code (optional)</label>
        <p className="hint" style={{ marginBottom: 8 }}>
          Upload your bank/OPay app's "Scan to Pay Me" QR image — a real, scannable code your customers can pay
          with directly. If left empty, invoices show a generated QR with your account details as plain text
          instead (view-only, not scannable by banking apps).
        </p>
        <div className="sigPreviewBox">
          {(qrPreview || currentQrUrl) ? (
            <img src={qrPreview || currentQrUrl!} alt="Payment QR" style={{ maxHeight: 130 }} />
          ) : (
            <span className="noSig">No payment QR uploaded yet</span>
          )}
        </div>
        <input type="file" accept="image/*" onChange={(e) => onQrFileChange(e.target.files?.[0] ?? null)} />

        {err && <div className="err">{err}</div>}
        {msg && <div className="okMsg">{msg}</div>}

        <div className="mf">
          <button className="btn ghost" type="button" onClick={onClose}>Close</button>
          <button className="btn ok" type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>

        <style jsx>{`
          .overlay { position: fixed; inset: 0; background: rgba(15,20,32,0.6); display: flex; align-items: center; justify-content: center; padding: 20px; z-index: 300; backdrop-filter: blur(3px); overflow-y: auto; }
          .modal { width: 100%; max-width: 440px; padding: 24px; margin: 20px 0; }
          .mh { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
          h3 { font-size: 17px; font-weight: 700; color: var(--ink); }
          .x { background: none; border: none; font-size: 16px; color: var(--muted); cursor: pointer; }
          .hint { font-size: 13px; color: var(--muted); line-height: 1.5; margin-bottom: 16px; }
          label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin: 12px 0 5px; }
          input { width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; box-sizing: border-box; }
          input:focus { outline: none; border-color: var(--navy); box-shadow: 0 0 0 3px var(--navy-soft); }
          .sigPreviewBox { border: 1px dashed var(--line-strong); border-radius: 10px; padding: 14px; display: flex; align-items: center; justify-content: center; min-height: 70px; background: var(--paper-2); margin-bottom: 8px; }
          .sigPreviewBox img { max-height: 70px; max-width: 100%; }
          .noSig { font-size: 12.5px; color: var(--muted); }
          .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; }
          .okMsg { color: var(--green); font-size: 13px; margin-top: 12px; line-height: 1.4; }
          .mf { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        `}</style>
      </div>
    </div>
  );
}
