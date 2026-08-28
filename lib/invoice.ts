import { BRAND, drawLetterhead, drawFooter } from "./branding";
import { generatePaymentQrDataUrl, PAYMENT_DETAILS_FALLBACK, BankDetails } from "./paymentQr";
import { supabase } from "./supabaseClient";

export type InvoiceLineItem = { description: string; qty: number; unitPrice: number };

export type InvoiceDetails = {
  invoiceNumber: string;
  schoolName: string;
  schoolKey?: string;
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

async function loadCompanySettings(): Promise<{
  bank: BankDetails; signatureDataUrl: string | null;
}> {
  try {
    const { data } = await supabase.rpc("get_company_settings");
    const row = Array.isArray(data) ? data[0] : data;
    const bank: BankDetails = row
      ? { bankName: row.bank_name, accountName: row.account_name, accountNumber: row.account_number }
      : PAYMENT_DETAILS_FALLBACK;
    const signatureDataUrl = row?.signature_data
      ? `data:${row.signature_mimetype || "image/jpeg"};base64,${row.signature_data}`
      : null;
    return { bank, signatureDataUrl };
  } catch {
    return { bank: PAYMENT_DETAILS_FALLBACK, signatureDataUrl: null };
  }
}

export async function generateInvoicePdf(d: InvoiceDetails) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2, muted } = BRAND;
  const { bank, signatureDataUrl } = await loadCompanySettings();

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
  const boxH = 42;
  const gap = 6;

  // Bank details box, left-aligned
  const bankW = 56;
  const bankX = 18;
  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(bankX, rowTop, bankW, boxH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("Payment Details", bankX + 5, rowTop + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...ink2);
  doc.text("Bank:", bankX + 5, rowTop + 14.5);
  doc.text(bank.bankName, bankX + 5, rowTop + 18.5);
  doc.text("Account Name:", bankX + 5, rowTop + 24.5);
  const nameLines = doc.splitTextToSize(bank.accountName, bankW - 10);
  doc.text(nameLines, bankX + 5, rowTop + 28.5);
  doc.text("Account Number:", bankX + 5, rowTop + 36.5);
  doc.setFont("helvetica", "bold");
  doc.text(bank.accountNumber, bankX + 5, rowTop + 40.5);

  // Payment QR code — fixed, modest size, positioned right after the bank box
  const qrSize = 34;
  const qrX = bankX + bankW + gap;
  const qrY = rowTop + (boxH - qrSize) / 2; // vertically centred within the row
  try {
    const qrDataUrl = await generatePaymentQrDataUrl(bank, {
      amount: d.total,
      reference: d.invoiceNumber,
      schoolKey: d.schoolKey || d.schoolName,
    });
    doc.setDrawColor(224, 228, 236);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX, qrY, qrSize, qrSize + 5, 2, 2, "FD");
    doc.addImage(qrDataUrl, "PNG", qrX + 2.5, qrY + 2.5, qrSize - 5, qrSize - 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...muted);
    doc.text("Scan with your bank app", qrX + qrSize / 2, qrY + qrSize + 3.5, { align: "center" });
  } catch {
    // If QR generation fails for any reason, the invoice still renders correctly without it.
  }
  const qrRight = qrX + qrSize;

  // Totals box, right-aligned — width computed from remaining space so it can
  // never overlap the QR box, regardless of page width or box sizes above.
  const boxX = qrRight + gap;
  const boxW = (W - 18) - boxX;
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

  y = rowTop + boxH + 10;

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

  // Authorised signature block
  y += 10;
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "JPEG", 18, y, 40, 20);
      y += 22;
    } catch {
      y += 4;
    }
  } else {
    y += 4;
  }
  doc.setDrawColor(...ink2);
  doc.line(18, y, 68, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("For SUIBING LIMITED, trading as Suibing IT Services", 18, y);

  drawFooter(doc, "Page 1 of 1");
  doc.save(`${d.invoiceNumber}_${d.schoolName.replace(/\s+/g, "_")}.pdf`);
}
