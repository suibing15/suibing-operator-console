// Reads a File as base64 (no data: prefix) for inline storage in the
// database, bypassing Supabase Storage entirely.

const MAX_RECEIPT_BYTES = 6 * 1024 * 1024; // 6MB safety cap

export async function fileToBase64(file: File): Promise<{ data: string; mimetype: string; filename: string }> {
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new Error("File is too large. Please attach a receipt under 6MB.");
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const data = btoa(binary);
  return { data, mimetype: file.type || "application/octet-stream", filename: file.name };
}

export function receiptDataUrl(data: string, mimetype: string): string {
  return `data:${mimetype};base64,${data}`;
}
