import QRCode from "qrcode";

const NAVY_HEX = "#1B2A4A";

// Fallback defaults, used only if company_settings hasn't loaded/been
// set yet. The real values come from the database via company_settings
// (editable in the console), so a bank change updates every QR without
// a code deploy.
export const PAYMENT_DETAILS_FALLBACK = {
  bankName: "OPay",
  accountName: "Sulaiman Ibrahim Inuwa",
  accountNumber: "7080195042",
};

export type BankDetails = { bankName: string; accountName: string; accountNumber: string };

/**
 * Builds the QR payload as structured text. Many Nigerian banking apps
 * can read account details from a scanned QR code and pre-fill the
 * transfer screen; behaviour varies by bank app, so the text is also
 * human-readable as a fallback if the scanning app just displays raw
 * text instead of auto-filling. The reference ties the payment back to
 * a specific school + invoice, so on manual review it is easy to match.
 */
export function buildPaymentQrPayload(bank: BankDetails, opts: {
  amount: number;
  reference: string; // e.g. invoice number
  schoolKey: string;
}): string {
  const lines = [
    `Bank: ${bank.bankName}`,
    `Account Name: ${bank.accountName}`,
    `Account Number: ${bank.accountNumber}`,
    `Amount: NGN ${opts.amount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
    `Reference: ${opts.reference}`,
    `School: ${opts.schoolKey}`,
  ];
  return lines.join("\n");
}

/** Returns a PNG data URL of the QR code, ready to drop into a jsPDF doc via addImage. */
export async function generatePaymentQrDataUrl(bank: BankDetails, opts: {
  amount: number;
  reference: string;
  schoolKey: string;
}): Promise<string> {
  const payload = buildPaymentQrPayload(bank, opts);
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
    color: { dark: NAVY_HEX, light: "#FFFFFF" },
  });
}
