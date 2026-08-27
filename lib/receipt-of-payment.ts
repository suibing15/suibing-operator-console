import { BRAND, drawLetterhead, drawFooter } from "./branding";

export type ReceiptDetails = {
  receiptNumber: string;
  schoolName: string;
  invoiceNumber?: string | null;
  amount: number;
  currency?: string;
  paymentDate: string; // ISO date
  note?: string | null;
  confirmedAt: string; // ISO datetime
};

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateReceiptPdf(d: ReceiptDetails) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2, green } = { ...BRAND, green: [15, 122, 61] as [number, number, number] };
  const currency = d.currency || "NGN";

  let y = drawLetterhead(doc, "RECEIPT OF PAYMENT", `Ref: ${d.receiptNumber}`);

  // Confirmed stamp-style badge
  doc.setDrawColor(...green);
  doc.setFillColor(230, 247, 237);
  doc.roundedRect(W / 2 - 30, y, 60, 12, 6, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...green);
  doc.text("✓ PAYMENT CONFIRMED", W / 2, y + 8, { align: "center" });
  y += 24;

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
    ["Amount", fmtMoney(d.amount, currency)],
    ["Payment Date", new Date(d.paymentDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
    ["Related Invoice", d.invoiceNumber || "General payment (not tied to a specific invoice)"],
    ["Confirmed On", new Date(d.confirmedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })],
  ];

  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  const boxTop = y;
  const rowH = 9;
  doc.roundedRect(18, boxTop, W - 36, rows.length * rowH + 6, 2, 2, "F");
  let ry = boxTop + 9;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(k, 24, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink2);
    doc.text(v, 78, ry, { maxWidth: W - 100 });
    ry += rowH;
  });
  y = boxTop + rows.length * rowH + 6 + 16;

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
