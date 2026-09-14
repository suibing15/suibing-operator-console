"use client";
import { useState } from "react";

export default function CustomReceiptBuilder() {
  const [receivedFrom, setReceivedFrom] = useState("");
  const [paymentFor, setPaymentFor] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("NGN");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState("Bank transfer");
  const [note, setNote] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setErr(null);
    if (!receivedFrom.trim()) { setErr("Enter who this receipt is from."); return; }
    if (!paymentFor.trim()) { setErr("Enter what this payment was for."); return; }
    const amt = Number(amount);
    if (!amount.trim() || isNaN(amt) || amt <= 0) { setErr("Enter a valid amount."); return; }

    setBusy(true);
    try {
      const { generateCustomReceiptPdf } = await import("@/lib/custom-receipt");
      await generateCustomReceiptPdf({
        receiptNumber: receiptNumber.trim() || undefined,
        receivedFrom: receivedFrom.trim(),
        paymentFor: paymentFor.trim(),
        amount: amt,
        currency,
        paymentDate,
        paymentMethod: paymentMethod.trim() || undefined,
        note: note.trim() || undefined,
      });
    } catch (e: any) {
      setErr(e?.message || "Could not generate the receipt.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="bar"><h2>Custom receipt</h2></div>
      <p className="intro">
        Write a receipt manually for a payment that doesn't go through the school portal's payment-review flow —
        e.g. cash received in person, or a one-off payment outside the usual system.
      </p>

      <div className="formGrid card">
        <div className="field">
          <label>Received from</label>
          <input value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} placeholder="e.g. Assalam International Academic School" />
        </div>
        <div className="field">
          <label>Payment for</label>
          <input value={paymentFor} onChange={(e) => setPaymentFor(e.target.value)} placeholder="e.g. Hosting renewal, 6 months" />
        </div>
        <div className="field">
          <label>Amount</label>
          <div className="amountRow">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
            </select>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
          </div>
        </div>
        <div className="field">
          <label>Payment date</label>
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Payment method</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option>Bank transfer</option>
            <option>OPay</option>
            <option>Cash</option>
            <option>Cheque</option>
            <option>Other</option>
          </select>
        </div>
        <div className="field">
          <label>Receipt number (optional)</label>
          <input value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} placeholder="Auto-generated if left blank" />
        </div>
        <div className="field full">
          <label>Note (optional)</label>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any extra detail worth including" />
        </div>
      </div>

      {err && <div className="err">{err}</div>}

      <button className="btn ok" onClick={generate} disabled={busy} style={{ marginTop: 16 }}>
        {busy ? "Generating…" : "Generate receipt PDF"}
      </button>

      <style jsx>{`
        .bar { margin-bottom: 10px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .intro { font-size: 13px; color: var(--ink-2); line-height: 1.5; margin-bottom: 18px; max-width: 620px; }
        .formGrid { padding: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field.full { grid-column: 1 / -1; }
        label { font-size: 12px; font-weight: 600; color: var(--ink-2); }
        input, select, textarea { border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 9px 11px; font-size: 13.5px; font-family: inherit; box-sizing: border-box; background: #fff; }
        textarea { resize: vertical; }
        .amountRow { display: flex; gap: 8px; }
        .amountRow select { flex: 0 0 90px; }
        .amountRow input { flex: 1; }
        .err { background: var(--red-soft); color: var(--red); padding: 9px 12px; border-radius: var(--radius-sm); font-size: 13px; margin-top: 12px; max-width: 620px; }
        @media (max-width: 700px) { .formGrid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
