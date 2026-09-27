// =====================================================================
//  SUIBING registry client kit — drop into ANY of your apps (Bucket,
//  SSMS, SuibingLedger, Tracker, etc.), not just school-shaped ones.
//  Add to lib/ in the app and call it to:
//   1. confirm this client is active (else show a lock screen)
//   2. report a heartbeat with whatever numbers matter to THIS product
//
//  SETUP: add these to the app's environment variables (same three
//  for every product — the console shows you these values, pre-filled
//  with the right key, right after you add a client):
//    NEXT_PUBLIC_REGISTRY_URL       = the registry Supabase project URL
//    NEXT_PUBLIC_REGISTRY_ANON_KEY  = the registry publishable (anon) key
//    NEXT_PUBLIC_SCHOOL_KEY         = this client's key (e.g. "assalam")
//
//  Which heartbeat to call:
//    - SUIBING Bucket: keep using reportCounts(students, records) —
//      unchanged, nothing to do differently.
//    - Any other product (SSMS, SuibingLedger, Tracker, custom apps):
//      use reportMetrics({ ...whatever this product tracks }) instead,
//      e.g. reportMetrics({ students: 120, exams_conducted: 45 }).
//      Keys are free-form — they show up as-is in the console.
// =====================================================================
import { createClient } from "@supabase/supabase-js";

const RURL = process.env.NEXT_PUBLIC_REGISTRY_URL || "";
const RKEY = process.env.NEXT_PUBLIC_REGISTRY_ANON_KEY || "";
const SCHOOL_KEY = process.env.NEXT_PUBLIC_SCHOOL_KEY || "";

const registry = RURL && RKEY ? createClient(RURL, RKEY) : null;

export type SchoolStatus = { active: boolean; name: string; paid_until: string | null };

// Returns null if the registry isn't configured (fail-open so a client that
// isn't yet linked keeps working). Returns {active:false} to lock the app.
export async function checkSchoolActive(): Promise<SchoolStatus | null> {
  if (!registry || !SCHOOL_KEY) return null;
  const { data, error } = await registry.rpc("school_status", { p_key: SCHOOL_KEY });
  if (error || !data || (data as any[]).length === 0) return null;
  const row = (data as any[])[0];
  return { active: !!row.active, name: row.name, paid_until: row.paid_until };
}

// Fire-and-forget heartbeat for SUIBING Bucket specifically — kept exactly
// as-is for backward compatibility with existing deployments.
export async function reportCounts(students: number, records: number): Promise<void> {
  if (!registry || !SCHOOL_KEY) return;
  try {
    await registry.rpc("report_counts", {
      p_key: SCHOOL_KEY, p_students: students, p_records: records,
    });
  } catch { /* non-critical */ }
}

// Generic fire-and-forget heartbeat for every OTHER product. Pass any set
// of numeric metrics that make sense for this app — they're stored as-is
// and shown in the console's client detail view.
export async function reportMetrics(metrics: Record<string, number>): Promise<void> {
  if (!registry || !SCHOOL_KEY) return;
  try {
    await registry.rpc("report_metrics", { p_key: SCHOOL_KEY, p_metrics: metrics });
  } catch { /* non-critical */ }
}
