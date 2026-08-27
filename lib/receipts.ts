import { supabase } from "./supabaseClient";

export async function uploadReceipt(schoolKey: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${schoolKey}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export function receiptPublicUrl(path: string): string {
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}
