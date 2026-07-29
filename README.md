# SUIBING Bucket — Operator Console & Registry

The central system you (the operator) own to manage every registered school.
It is completely separate from the schools' own apps and never holds any
student data. Schools stay fully isolated (each has its own project); this
registry only tracks their status, subscription, activity, and reported counts.

## Parts

1. **schema-registry.sql** — run once in a NEW, separate Supabase project that
   only you own. Creates: operators, schools, activity_log, and the functions
   school_status(), report_counts(), record_payment().

2. **The console app** (this Next.js project) — your dashboard to:
   - see all schools with live student/record counts
   - add a school
   - disable / re-enable a school (data always preserved)
   - record a payment (auto-extends paid-until and logs it)
   - view each school's activity history and generate a PDF report

3. **school-integration/** — two small files to drop into EACH school's app so
   it honours the disable switch and reports its counts:
   - registryCheck.ts  (checkSchoolActive + reportCounts)
   - LockScreen.tsx     (the polite "access paused" screen)

## Deploy the console

1. Create the registry Supabase project; run schema-registry.sql.
2. Seed yourself in the `operators` table (the SQL already seeds
   suibing15@gmail.com; edit if needed).
3. Deploy this app to Vercel with two env vars:
   - NEXT_PUBLIC_SUPABASE_URL      = registry project URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY = registry publishable key
4. In the registry project's Auth → URL Configuration, add the console URL.
5. Sign in with your operator email.

## Link a school to the registry

In each school's app, add registryCheck.ts + LockScreen.tsx, wire them into the
auth flow (call checkSchoolActive() on login; if {active:false} render
LockScreen; after loading the dashboard call reportCounts(students, records)),
and add three env vars to that school's deployment:
   - NEXT_PUBLIC_REGISTRY_URL       = registry project URL
   - NEXT_PUBLIC_REGISTRY_ANON_KEY  = registry publishable key
   - NEXT_PUBLIC_SCHOOL_KEY         = that school's key (matches the console)

## Pricing (recorded manually in the console)

- Registration (one-time): NGN 100,000
- Subscription: NGN 10,000 per school per 3 months (may rise as records grow)
- Maintenance & guidance: free
- Custom modifications: at an agreed rate
