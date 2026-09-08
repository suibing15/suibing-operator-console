import { BRAND, drawLetterhead, drawFooter } from "./branding";
import { supabase } from "./supabaseClient";

export type CustomDocDetails = {
  title: string;
  subtitle?: string;
  body: string; // free-form text; blank lines become paragraph breaks
  recipientName?: string;
  recipientAddress?: string;
  includeSignature: boolean;
  dateLabel?: string; // e.g. "28 August 2026" — defaults to today
  fileName?: string; // without extension — defaults to a slugified title
  // Body text styling — applies only to the free-form body paragraphs,
  // not the letterhead/title, which stay in the fixed brand style.
  fontFamily?: "helvetica" | "times" | "courier"; // jsPDF's built-in standard fonts, no embedding needed
  fontSize?: number; // pt, defaults to 11
  fontColor?: string; // hex, defaults to the brand's body text colour
  textAlign?: "left" | "center" | "justify";
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

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "document";
}

function hexToRgb(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

// Generates a professional, letterhead-branded PDF for any custom
// contract, agreement, or report the operator writes freely — same
// letterhead, colours, and (optionally) signature as every other
// generated document, so it never looks out of place next to an
// invoice or receipt.
//
// Returns the built jsPDF instance so callers can either trigger a
// direct browser download (generateCustomDocPdf) or extract the raw
// PDF bytes to send to a school (buildCustomDocPdf).
async function buildCustomDocPdf(d: CustomDocDetails) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const { navy, ink2, muted } = BRAND;
  const marginX = 18;
  const footerSafeY = pageH - 22;

  let y = drawLetterhead(doc, d.title.toUpperCase(), d.subtitle);

  const dateLabel = d.dateLabel?.trim() || new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...muted);
  doc.text(`Date: ${dateLabel}`, W - marginX, y - 4, { align: "right" });

  if (d.recipientName?.trim()) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...navy);
    doc.text("To", marginX, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...ink2);
    doc.setFontSize(10.5);
    doc.text(d.recipientName.trim(), marginX, y);
    y += 5.5;
    if (d.recipientAddress?.trim()) {
      const addrLines = doc.splitTextToSize(d.recipientAddress.trim(), W - marginX * 2);
      doc.text(addrLines, marginX, y);
      y += addrLines.length * 5;
    }
    y += 8;
  }

  // Body text — split on blank lines into paragraphs, wrap each to the
  // page width, and start a fresh page whenever a paragraph would run
  // past the footer-safe boundary. Font family, size, colour, and
  // alignment are all operator-configurable; letterhead/title stay
  // fixed to the brand style regardless.
  const paragraphs = d.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const fontFamily = d.fontFamily || "helvetica";
  const fontSize = d.fontSize || 11;
  const align = d.textAlign || "left";
  const bodyColor = hexToRgb(d.fontColor) ?? ink2;
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...bodyColor);
  const lineH = fontSize * 0.53; // scales line height with font size, matches the ~6mm spacing used at 11pt elsewhere in the app
  const textX = align === "center" ? W / 2 : marginX;
  const maxWidth = W - marginX * 2;

  for (const para of paragraphs) {
    const lines = doc.splitTextToSize(para, maxWidth) as string[];
    const paraHeight = lines.length * lineH;
    if (y + paraHeight > footerSafeY) {
      drawFooter(doc, "");
      doc.addPage();
      y = 20;
    }
    if (align === "justify") {
      doc.text(lines, textX, y, { maxWidth, align: "justify" });
    } else {
      doc.text(lines, textX, y, { align });
    }
    y += paraHeight + 6;
  }

  if (d.includeSignature) {
    const signatureDataUrl = await loadSignature();
    const sigHeight = signatureDataUrl ? 15 + 3 : 3;
    if (y + sigHeight + 20 > footerSafeY) {
      drawFooter(doc, "");
      doc.addPage();
      y = 20;
    }
    y += 6;
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
        doc.addImage(signatureDataUrl, "JPEG", marginX, y, sigW, sigH);
        y += sigH + 3;
      } catch {
        y += 3;
      }
    } else {
      y += 3;
    }
    doc.setDrawColor(...ink2);
    doc.line(marginX, y, marginX + 50, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...navy);
    doc.text(`For ${BRAND.companyLegal}, ${BRAND.companyTrade}`, marginX, y);
  }

  const totalPages = (doc as any).internal.getNumberOfPages
    ? (doc as any).internal.getNumberOfPages()
    : doc.internal.pages.length - 1;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(doc, totalPages > 1 ? `Page ${p} of ${totalPages}` : "Page 1 of 1");
  }

  return doc;
}

// Triggers a direct browser download of the generated PDF.
export async function generateCustomDocPdf(d: CustomDocDetails) {
  const doc = await buildCustomDocPdf(d);
  doc.save(`${d.fileName?.trim() || slugify(d.title)}.pdf`);
}

// Builds the PDF and returns it as base64 (no file extension/data-url
// prefix), for sending to a school via send_school_document rather
// than downloading it locally.
export async function buildCustomDocBase64(d: CustomDocDetails): Promise<{ base64: string; fileName: string }> {
  const doc = await buildCustomDocPdf(d);
  const dataUri: string = doc.output("datauristring");
  const base64 = dataUri.split(",")[1] ?? "";
  return { base64, fileName: `${d.fileName?.trim() || slugify(d.title)}.pdf` };
}
