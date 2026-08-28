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

  y += 22;
  const rowTop = y;

  // Payment QR code — a genuinely scannable size (proven by testing: 40mm
  // failed to decode at typical screen rendering, 50mm and above decoded
  // reliably, so 62mm is used here for real margin) because a
  // photographed/screenshotted QR from a banking app (e.g. OPay's "Scan to
  // Pay Me" card, encoding a dense EMVCo merchant payload) needs
  // significant on-screen size to stay reliably scannable once rendered
  // inside a PDF viewer, which often downsamples embedded images relative
  // to the page's zoom level. Prefers the operator's real uploaded QR;
  // falls back to a generated text QR (view-only — not recognised by bank
  // payment scanners) if none has been uploaded. Placed side-by-side with
  // Payment Details (rather than stacked) so the whole invoice — QR
  // included — fits on a single page.
  const qrBoxSize = 62;
  const qrX = 18;
  const qrCaptionH = 9;

  let qrDataUrl: string | null = null;
  let qrCaption = "";
  let qrFormat: "PNG" | "JPEG" = "PNG";
  try {
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
  } catch {
    qrDataUrl = null;
  }

  if (qrDataUrl) {
    doc.setDrawColor(224, 228, 236);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX, rowTop, qrBoxSize, qrBoxSize + qrCaptionH, 2, 2, "FD");
    const imgPad = 4;
    const maxDim = qrBoxSize - imgPad * 2;
    // Preserve the real image's aspect ratio — a real uploaded QR card
    // (e.g. OPay's tall branded card) is rarely square, and forcing it
    // into a square distorts the QR's own module grid just enough to
    // break real-world camera-based scanning, even though the raw pixel
    // data decodes fine. Fit it within the available box instead.
    let drawW = maxDim;
    let drawH = maxDim;
    try {
      const props = (doc as any).getImageProperties(qrDataUrl);
      if (props?.width && props?.height) {
        const ratio = props.width / props.height;
        if (ratio >= 1) { drawW = maxDim; drawH = maxDim / ratio; }
        else { drawH = maxDim; drawW = maxDim * ratio; }
      }
    } catch {
      // If dimensions can't be read for any reason, fall back to a square fit.
    }
    const drawX = qrX + imgPad + (maxDim - drawW) / 2;
    const drawY = rowTop + imgPad + (maxDim - drawH) / 2;
    doc.addImage(qrDataUrl, qrFormat, drawX, drawY, drawW, drawH);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text(qrCaption, qrX + qrBoxSize / 2, rowTop + qrBoxSize + 6, { align: "center" });
  }

  // Payment Details box, to the right of the QR
  const bankX = qrX + qrBoxSize + 8;
  const bankW = W - 18 - bankX;
  const boxH = qrBoxSize + qrCaptionH;
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
  doc.text(bank.bankName, bankX + 40, rowTop + 19);
  doc.text("Account Name:", bankX + 6, rowTop + 26);
  const nameLines = doc.splitTextToSize(bank.accountName, bankW - 46);
  doc.text(nameLines, bankX + 40, rowTop + 26);
  doc.text("Account Number:", bankX + 6, rowTop + (nameLines.length > 1 ? 40 : 33));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(bank.accountNumber, bankX + 40, rowTop + (nameLines.length > 1 ? 40 : 33));
  if (d.notes?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    const noteLines = doc.splitTextToSize(d.notes.trim(), bankW - 12);
    doc.text(noteLines.slice(0, 2), bankX + 6, rowTop + boxH - 6);
  }

  y = rowTop + Math.max(qrBoxSize + qrCaptionH, boxH) + 14;

  // Authorised signature block — compact, sits at the bottom
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, "JPEG", 18, y, 34, 17);
      y += 19;
    } catch {
      y += 3;
    }
  } else {
    y += 3;
  }
  doc.setDrawColor(...ink2);
  doc.line(18, y, 68, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text("For SUIBING LIMITED, trading as Suibing IT Services", 18, y);

  const totalPages = (doc as any).internal.getNumberOfPages
    ? (doc as any).internal.getNumberOfPages()
    : doc.internal.pages.length - 1; // jsPDF's pages array is 1-indexed with a leading placeholder
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, totalPages > 1 ? `Page ${p} of ${totalPages}` : "Page 1 of 1");
  }
  doc.save(`${d.invoiceNumber}_${d.schoolName.replace(/\s+/g, "_")}.pdf`);
}
