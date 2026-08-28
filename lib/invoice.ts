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
  bank: BankDetails; signatureDataUrl: string | null; paymentQrDataUrl: string | null;
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
    const paymentQrDataUrl = row?.payment_qr_data
      ? `data:${row.payment_qr_mimetype || "image/jpeg"};base64,${row.payment_qr_data}`
      : null;
    return { bank, signatureDataUrl, paymentQrDataUrl };
  } catch {
    return { bank: PAYMENT_DETAILS_FALLBACK, signatureDataUrl: null, paymentQrDataUrl: null };
  }
}

export async function generateInvoicePdf(d: InvoiceDetails) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2, muted } = BRAND;
  const { bank, signatureDataUrl, paymentQrDataUrl } = await loadCompanySettings();

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

  // Totals box, right-aligned, sits above the payment section — small and
  // doesn't compete for space with the QR code below.
  const totalsW = 76;
  const totalsX = W - 18 - totalsW;
  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(totalsX, y, totalsW, 20, 2, 2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...ink2);
  doc.text("Subtotal", totalsX + 6, y + 8);
  doc.text(fmtMoney(d.subtotal, d.currency), totalsX + totalsW - 6, y + 8, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...navy);
  doc.text("Total", totalsX + 6, y + 16);
  doc.text(fmtMoney(d.total, d.currency), totalsX + totalsW - 6, y + 16, { align: "right" });

  y += 30;
  const rowTop = y;

  // Payment Details box, left-aligned, compact
  const bankW = 62;
  const bankX = 18;
  const boxH = 60;
  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  doc.roundedRect(bankX, rowTop, bankW, boxH, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...navy);
  doc.text("Payment Details", bankX + 6, rowTop + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...ink2);
  doc.text("Bank:", bankX + 6, rowTop + 19);
  doc.text(bank.bankName, bankX + 6, rowTop + 24);
  doc.text("Account Name:", bankX + 6, rowTop + 33);
  const nameLines = doc.splitTextToSize(bank.accountName, bankW - 12);
  doc.text(nameLines, bankX + 6, rowTop + 38);
  doc.text("Account Number:", bankX + 6, rowTop + 49);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(bank.accountNumber, bankX + 6, rowTop + 54.5);

  // Payment QR code — given real, scannable size (roughly double the
  // previous compact layout) since a photographed/screenshotted QR from a
  // banking app needs much more room to stay readable than a freshly
  // generated one. Prefers the operator's real uploaded QR (e.g. OPay's
  // "Scan to Pay Me" code); falls back to a generated text QR (view-only —
  // not recognised by bank payment scanners) if none has been uploaded.
  const gap = 8;
  const qrBoxSize = boxH; // square card matching the bank box height
  const qrX = bankX + bankW + gap;
  try {
    let qrDataUrl: string;
    let qrCaption: string;
    let qrFormat: "PNG" | "JPEG";
    if (paymentQrDataUrl) {
      qrDataUrl = paymentQrDataUrl;
      qrCaption = "Scan to pay directly";
      qrFormat = paymentQrDataUrl.includes("image/png") ? "PNG" : "JPEG";
    } else {
      qrDataUrl = await generatePaymentQrDataUrl(bank, {
        amount: d.total,
        reference: d.invoiceNumber,
        schoolKey: d.schoolKey || d.schoolName,
      });
      qrCaption = "Scan with any QR reader";
      qrFormat = "PNG";
    }
    doc.setDrawColor(224, 228, 236);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX, rowTop, qrBoxSize, qrBoxSize, 2, 2, "FD");
    const imgPad = 4;
    const imgSize = qrBoxSize - imgPad * 2 - 6; // leave room for the caption below
    doc.addImage(qrDataUrl, qrFormat, qrX + imgPad, rowTop + imgPad, imgSize, imgSize);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text(qrCaption, qrX + qrBoxSize / 2, rowTop + imgPad + imgSize + 5, { align: "center" });
  } catch {
    // If QR generation fails for any reason, the invoice still renders correctly without it.
  }

  y = rowTop + boxH + 12;

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
