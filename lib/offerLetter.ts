import { BRAND, drawLetterhead, drawFooter } from "./branding";
import { supabase } from "./supabaseClient";

export type OfferDetails = {
  fullName: string;
  role: string;
  startDate: string;      // display string, e.g. "1 September 2026"
  salary: string;         // display string, e.g. "NGN 150,000 / month"
  employmentType: string; // e.g. "Full-time", "Part-time", "Contract"
  reportingTo: string;
  additionalTerms?: string;
  issuedBy: string;       // operator email/name for the signature line
};

async function loadSignature(): Promise<string | null> {
  try {
    const { data } = await supabase.rpc("get_company_settings");
    const row = Array.isArray(data) ? data[0] : data;
    return row?.signature_data ? `data:${row.signature_mimetype || "image/jpeg"};base64,${row.signature_data}` : null;
  } catch {
    return null;
  }
}

export async function generateOfferLetterPdf(d: OfferDetails, formNumber: string) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const { navy, ink2 } = BRAND;
  const signatureDataUrl = await loadSignature();

  let y = drawLetterhead(doc, "OFFER OF APPOINTMENT", `Ref: ${formNumber}`);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...ink2);
  doc.text(new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }), 18, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.text(`Dear ${d.fullName},`, 18, y);
  y += 9;

  const body =
    `We are pleased to offer you the position of ${d.role} with ${BRAND.companyLegal} ` +
    `(${BRAND.rc}), trading as Suibing IT Services, on the terms set out below. ` +
    `This offer is subject to your acceptance and any pre-employment checks we may require.`;
  const lines = doc.splitTextToSize(body, W - 36);
  doc.text(lines, 18, y);
  y += lines.length * 5.5 + 8;

  const rows: [string, string][] = [
    ["Position", d.role],
    ["Employment type", d.employmentType],
    ["Start date", d.startDate],
    ["Compensation", d.salary],
    ["Reporting to", d.reportingTo],
  ];

  doc.setDrawColor(224, 228, 236);
  doc.setFillColor(246, 248, 251);
  const boxTop = y;
  const rowH = 8;
  doc.roundedRect(18, boxTop, W - 36, rows.length * rowH + 6, 2, 2, "F");
  let ry = boxTop + 8;
  rows.forEach(([k, v]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text(k, 24, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink2);
    doc.text(v, 75, ry);
    ry += rowH;
  });
  y = boxTop + rows.length * rowH + 6 + 12;

  if (d.additionalTerms?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...navy);
    doc.text("Additional Terms", 18, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink2);
    const extra = doc.splitTextToSize(d.additionalTerms.trim(), W - 36);
    doc.text(extra, 18, y);
    y += extra.length * 5.5 + 8;
  }

  const closing =
    `Please confirm your acceptance of this offer by replying to ${BRAND.email} or contacting us on ${BRAND.phone}. ` +
    `We look forward to welcoming you to the team.`;
  const closingLines = doc.splitTextToSize(closing, W - 36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...ink2);
  doc.text(closingLines, 18, y);
  y += closingLines.length * 5.5 + 14;

  doc.setFont("helvetica", "normal");
  doc.text("Yours sincerely,", 18, y);
  y += 12;
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
  doc.text("For SUIBING LIMITED, trading as Suibing IT Services", 18, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...ink2);
  doc.text(d.issuedBy, 18, y);

  drawFooter(doc, "Page 1 of 1");
  doc.save(`Offer_of_Appointment_${d.fullName.replace(/\s+/g, "_")}.pdf`);
}
