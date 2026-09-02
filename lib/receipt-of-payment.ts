import { BRAND, drawLetterhead, drawFooter } from "./branding";
import { supabase } from "./supabaseClient";

export type ReceiptDetails = {
  receiptNumber: string;
  schoolName: string;
  invoiceNumber?: string | null;
  description?: string | null;
  amount: number;
  currency?: string;
  paymentDate: string; // ISO date
  note?: string | null;
  confirmedAt: string; // ISO datetime
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

export async function generateReceiptPdf(d: ReceiptDetails) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2, green } = { ...BRAND, green: [15, 122, 61] as [number, number, number] };
  const currency = d.currency || "NGN";
  const signatureDataUrl = await loadSignature();

  let y = drawLetterhead(doc, "RECEIPT OF PAYMENT", `Ref: ${d.receiptNumber}`);

  // Confirmed stamp-style badge — box sized to the actual text width so
  // the label never overflows regardless of font metrics.
  const badgeText = "PAYMENT CONFIRMED";
  const badgeFontSize = 10.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(badgeFontSize);
  const textWidth = doc.getTextWidth(badgeText);
  const badgePaddingX = 10;
  const checkWidth = 6; // reserved space for the ✓ glyph before the text
  const badgeW = textWidth + checkWidth + badgePaddingX * 2;
  const badgeH = 12;
  const badgeX = W / 2 - badgeW / 2;
  doc.setDrawColor(...green);
  doc.setFillColor(230, 247, 237);
  doc.roundedRect(badgeX, y, badgeW, badgeH, 6, 6, "FD");
  doc.setTextColor(...green);
  doc.text(badgeText, W / 2 + checkWidth / 2, y + badgeH / 2 + 3, { align: "center" });
  // Draw the checkmark as vector lines instead of a font glyph — jsPDF's
  // built-in Helvetica does not reliably render ✓ across environments.
  const checkX = badgeX + badgePaddingX - 1;
  const checkY = y + badgeH / 2;
  doc.setDrawColor(...green);
  doc.setLineWidth(0.6);
  doc.line(checkX, checkY, checkX + 1.6, checkY + 1.8);
  doc.line(checkX + 1.6, checkY + 1.8, checkX + 4.2, checkY - 2.2);
  y += badgeH + 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...ink2);
  doc.text(
    `This confirms that Suibing IT Services has received and verified payment from the details below.`,
    18, y, { maxWidth: W - 36 }
  );
  y += 14;

  const rows: [string, string][] = [
    ["Received From", d.schoolName],
    ["For", d.description || "General payment"],
    ["Amount", fmtMoney(d.amount, currency)],
    ["Payment Date", new Date(d.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
    ["Related Invoice", d.invoiceNumber || "General payment (not tied to a specific invoice)"],
    ["Confirmed On", new Date(d.confirmedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ];

  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  const boxTop = y;
  const lineH = 5.2;
  const rowPad = 4;
  const valueMaxWidth = W - 100;
  // Measure each row's actual wrapped height first, since a long product
  // description can wrap to more than one line and a fixed row height
  // would let it overflow into the row below.
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
  doc.text("Thank you for your payment.", 18, y);
  y += 14;

  // Authorised signature block — sized and aspect-ratio-preserved so a
  // real signature photo (any shape) never looks stretched or oversized.
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
        // If dimensions can't be read, fall back to the default box above.
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
  doc.save(`${d.receiptNumber}_Receipt_${d.schoolName.replace(/\s+/g, "_")}.pdf`);
}
