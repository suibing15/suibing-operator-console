import { BRAND, drawLetterhead, drawFooter } from "./branding";
import { supabase } from "./supabaseClient";

export type CustomReceiptDetails = {
  receiptNumber?: string;
  receivedFrom: string;
  paymentFor: string;
  amount: number;
  currency?: string;
  paymentDate: string; // ISO date
  paymentMethod?: string;
  note?: string;
};

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function loadSignature(): Promise<string | null> {
  try {
    const { data } = await supabase.rpc("get_company_settings");
    const row = Array.isArray(data) ? data[0] : data;
    return row?.signature_data ? `data:${row.signature_mimetype || "image/jpeg"};base64,${row.signature_data}` : null;
  } catch {
    return null;
  }
}

// Generates a free-form, manually-filled receipt — for situations that
// don't go through the payment-review flow (which auto-generates its
// own receipt via lib/receipt-of-payment.ts). Same letterhead, layout
// language, and signature handling as every other generated document,
// so it never looks out of place next to an invoice or the automatic
// payment receipt.
export async function generateCustomReceiptPdf(d: CustomReceiptDetails) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2 } = BRAND;
  const currency = d.currency || "NGN";
  const receiptNumber = d.receiptNumber?.trim() || `RCT-${Date.now().toString().slice(-8)}`;

  let y = drawLetterhead(doc, "RECEIPT", `Ref: ${receiptNumber}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...ink2);
  doc.text(
    `Date: ${new Date(d.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`,
    W - 18, y - 4, { align: "right" }
  );

  const rows: [string, string][] = [
    ["Received From", d.receivedFrom],
    ["For", d.paymentFor],
    ["Amount", fmtMoney(d.amount, currency)],
    ["Payment Method", d.paymentMethod?.trim() || "Not specified"],
  ];

  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  const boxTop = y;
  const lineH = 5.2;
  const rowPad = 4;
  const valueMaxWidth = W - 100;
  const wrapped = rows.map(([k, v]) => {
    const lines = doc.splitTextToSize(v, valueMaxWidth);
    return { k, lines, height: Math.max(lines.length, 1) * lineH + rowPad };
  });
  const boxHeight = wrapped.reduce((sum, r) => sum + r.height, 0) + 6;
  doc.roundedRect(18, boxTop, W - 36, boxHeight, 2, 2, "F");
  let ry = boxTop + 9;
  wrapped.forEach(({ k, lines, height }) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(k, 24, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink2);
    doc.text(lines, 78, ry);
    ry += height;
  });
  y = boxTop + boxHeight + 16;

  if (d.note?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text("Note", 18, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ink2);
    const lines = doc.splitTextToSize(d.note.trim(), W - 36);
    doc.text(lines, 18, y);
    y += lines.length * 5 + 10;
  }

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink2);
  doc.text("Thank you.", 18, y);
  y += 14;

  const signatureDataUrl = await loadSignature();
  if (signatureDataUrl) {
    try {
      const maxSigW = 32;
      const maxSigH = 15;
      let sigW = maxSigW;
      let sigH = maxSigH;
      try {
        const props = (doc as any).getImageProperties(signatureDataUrl);
        if (props?.width && props?.height) {
          const ratio = props.width / props.height;
          if (maxSigW / ratio <= maxSigH) { sigW = maxSigW; sigH = maxSigW / ratio; }
          else { sigH = maxSigH; sigW = maxSigH * ratio; }
        }
      } catch {
        // Fall back to the default box above if dimensions can't be read.
      }
      doc.addImage(signatureDataUrl, "JPEG", 18, y, sigW, sigH);
      y += sigH + 5;
    } catch {
      y += 4;
    }
  } else {
    y += 4;
  }
  doc.setDrawColor(...ink2);
  doc.line(18, y, 78, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...navy);
  doc.text("SUIBING LIMITED, trading as Suibing IT Services", 18, y);

  drawFooter(doc, "Page 1 of 1");
  doc.save(`${receiptNumber}_Receipt_${d.receivedFrom.replace(/\s+/g, "_")}.pdf`);
}
