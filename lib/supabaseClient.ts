import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
export const isConfigured = !!(url && key);
export const supabase = createClient(url || "https://demo.supabase.co", key || "demo");
