import { BRAND, drawLetterhead, drawFooter } from "./branding";

export type InvoiceLineItem = { description: string; qty: number; unitPrice: number };

export type InvoiceDetails = {
  invoiceNumber: string;
  schoolName: string;
  currency: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  total: number;
  notes?: string | null;
  issuedAt: string; // ISO date string
};

function fmtMoney(n: number, currency: string) {
  return `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function generateInvoicePdf(d: InvoiceDetails) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2, muted } = BRAND;

  let y = drawLetterhead(doc, "INVOICE", `Ref: ${d.invoiceNumber}`);

  // Bill-to / meta block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...navy);
  doc.text("Bill To", 18, y);
  doc.text("Invoice Details", W - 78, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...ink2);
  doc.text(d.schoolName, 18, y);

  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text(`Invoice #: ${d.invoiceNumber}`, W - 78, y);
  y += 5.5;
  doc.text(`Date: ${new Date(d.issuedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, W - 78, y);
  y += 12;

  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit Price", "Amount"]],
    body: d.lineItems.map((li) => [
      li.description,
      String(li.qty),
      fmtMoney(li.unitPrice, d.currency),
      fmtMoney(li.qty * li.unitPrice, d.currency),
    ]),
    margin: { left: 18, right: 18 },
    styles: { fontSize: 9.5, cellPadding: 3.2, lineColor: [223, 228, 236], lineWidth: 0.1 },
    headStyles: { fillColor: navy, textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 246, 250] },
    columnStyles: {
      1: { halign: "right", cellWidth: 18 },
      2: { halign: "right", cellWidth: 38 },
      3: { halign: "right", cellWidth: 38 },
    },
  });

  // @ts-ignore - jspdf-autotable augments doc with lastAutoTable
  y = (doc as any).lastAutoTable.finalY + 10;

  const rowTop = y;

  // Bank details box, left-aligned
  const bankW = 84;
  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(18, rowTop, bankW, 30, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("Payment Details", 24, rowTop + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ink2);
  doc.text("Bank Name:", 24, rowTop + 14.5);
  doc.text("OPay", 60, rowTop + 14.5);
  doc.text("Account Name:", 24, rowTop + 19.5);
  const nameLines = doc.splitTextToSize("Sulaiman Ibrahim Inuwa", 22);
  doc.text(nameLines, 60, rowTop + 19.5);
  doc.text("Account Number:", 24, rowTop + 25.5);
  doc.text("7080195042", 60, rowTop + 25.5);

  // Totals box, right-aligned
  const boxW = 76;
  const boxX = W - 18 - boxW;
  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(boxX, rowTop, boxW, 20, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink2);
  doc.text("Subtotal", boxX + 6, rowTop + 8);
  doc.text(fmtMoney(d.subtotal, d.currency), boxX + boxW - 6, rowTop + 8, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...navy);
  doc.text("Total", boxX + 6, rowTop + 16);
  doc.text(fmtMoney(d.total, d.currency), boxX + boxW - 6, rowTop + 16, { align: "right" });

  y = rowTop + 40;

  if (d.notes?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text("Payment Terms & Notes", 18, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...ink2);
    const lines = doc.splitTextToSize(d.notes.trim(), W - 36);
    doc.text(lines, 18, y);
    y += lines.length * 5;
  }

  drawFooter(doc, "Page 1 of 1");
  doc.save(`${d.invoiceNumber}_${d.schoolName.replace(/\s+/g, "_")}.pdf`);
}
