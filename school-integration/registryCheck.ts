// =====================================================================
//  SUIBING Bucket — school-side registry check (drop into the school app)
//  Add to lib/ in each school's app. It calls the central registry to:
//   1. confirm the school is active (else the app shows a lock screen)
//   2. report the school's current student & record counts (heartbeat)
//
//  SETUP: add these to the school app's environment variables:
//    NEXT_PUBLIC_REGISTRY_URL       = the registry Supabase project URL
//    NEXT_PUBLIC_REGISTRY_ANON_KEY  = the registry publishable (anon) key
//    NEXT_PUBLIC_SCHOOL_KEY         = this school's key (e.g. "assalam")
// =====================================================================
import { createClient } from "@supabase/supabase-js";

const RURL = process.env.NEXT_PUBLIC_REGISTRY_URL || "";
const RKEY = process.env.NEXT_PUBLIC_REGISTRY_ANON_KEY || "";
const SCHOOL_KEY = process.env.NEXT_PUBLIC_SCHOOL_KEY || "";

const registry = RURL && RKEY ? createClient(RURL, RKEY) : null;

export type SchoolStatus = { active: boolean; name: string; paid_until: string | null };

// Returns null if the registry isn't configured (fail-open so a school that
// isn't yet linked keeps working). Returns {active:false} to lock the app.
export async function checkSchoolActive(): Promise<SchoolStatus | null> {
  if (!registry || !SCHOOL_KEY) return null;
  const { data, error } = await registry.rpc("school_status", { p_key: SCHOOL_KEY });
  if (error || !data || (data as any[]).length === 0) return null;
  const row = (data as any[])[0];
  return { active: !!row.active, name: row.name, paid_until: row.paid_until };
}

// Fire-and-forget heartbeat: report current counts up to the registry.
export async function reportCounts(students: number, records: number): Promise<void> {
  if (!registry || !SCHOOL_KEY) return;
  try {
    await registry.rpc("report_counts", {
      p_key: SCHOOL_KEY, p_students: students, p_records: records,
    });
  } catch { /* non-critical */ }
}
