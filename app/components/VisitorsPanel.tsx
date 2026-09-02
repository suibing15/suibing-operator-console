"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Stats = { total_views: number; unique_sessions: number; today_views: number; today_sessions: number };
type TopPage = { path: string; views: number; unique_sessions: number };
type DailyVisit = { day: string; views: number; unique_sessions: number };
type Referrer = { referrer: string; views: number };

export default function VisitorsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [daily, setDaily] = useState<DailyVisit[]>([]);
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [days, setDays] = useState(30);

  async function load() {
    const [s, tp, dv, rf] = await Promise.all([
      supabase.rpc("get_visitor_stats", { p_days: days }),
      supabase.rpc("get_top_pages", { p_days: days, p_limit: 10 }),
      supabase.rpc("get_daily_visits", { p_days: days }),
      supabase.rpc("get_top_referrers", { p_days: days, p_limit: 8 }),
    ]);
    const sRow = Array.isArray(s.data) ? s.data[0] : s.data;
    setStats(sRow ?? null);
    setTopPages((tp.data as TopPage[]) ?? []);
    setDaily((dv.data as DailyVisit[]) ?? []);
    setReferrers((rf.data as Referrer[]) ?? []);
  }

  useEffect(() => { load(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxViews = Math.max(1, ...daily.map((d) => d.views));

  return (
    <div>
      <div className="bar">
        <h2>Website visitors</h2>
        <div className="rangeChips">
          {[7, 30, 90].map((d) => (
            <button key={d} className={days === d ? "chip on" : "chip"} onClick={() => setDays(d)}>{d} days</button>
          ))}
        </div>
      </div>

      <div className="statsRow">
        <div className="statCard"><span className="l">Views today</span><span className="v">{stats?.today_views ?? 0}</span></div>
        <div className="statCard"><span className="l">Visitors today</span><span className="v">{stats?.today_sessions ?? 0}</span></div>
        <div className="statCard"><span className="l">Views ({days}d)</span><span className="v">{stats?.total_views ?? 0}</span></div>
        <div className="statCard"><span className="l">Visitors ({days}d)</span><span className="v">{stats?.unique_sessions ?? 0}</span></div>
      </div>

      <div className="card panel">
        <h3>Daily visits</h3>
        {daily.length === 0 ? (
          <p className="muted">No visits recorded yet in this range.</p>
        ) : (
          <div className="chart">
            {daily.map((d) => (
              <div key={d.day} className="barCol" title={`${d.day}: ${d.views} views, ${d.unique_sessions} visitors`}>
                <div className="barFill" style={{ height: `${Math.max(4, (d.views / maxViews) * 100)}%` }} />
                <span className="barLabel">{new Date(d.day).getDate()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="twoCol">
        <div className="card panel">
          <h3>Top pages</h3>
          {topPages.length === 0 ? <p className="muted">No data yet.</p> : (
            <table>
              <thead><tr><th>Page</th><th className="r">Views</th><th className="r">Visitors</th></tr></thead>
              <tbody>
                {topPages.map((p) => (
                  <tr key={p.path}><td>{p.path}</td><td className="r">{p.views}</td><td className="r">{p.unique_sessions}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card panel">
          <h3>Where visitors came from</h3>
          {referrers.length === 0 ? <p className="muted">No data yet.</p> : (
            <table>
              <thead><tr><th>Source</th><th className="r">Views</th></tr></thead>
              <tbody>
                {referrers.map((r) => (
                  <tr key={r.referrer}><td className="truncate">{r.referrer}</td><td className="r">{r.views}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="hint">
        Counts page views and unique browser sessions on public pages only (not the console or school portal).
        No IP addresses, device details, or anything identifying an individual visitor are recorded.
      </p>

      <style jsx>{`
        .bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
        h2 { font-size: 18px; font-weight: 700; color: var(--ink); }
        .rangeChips { display: flex; gap: 6px; }
        .chip { background: #fff; border: 1px solid var(--line-strong); border-radius: 999px; padding: 6px 14px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); cursor: pointer; }
        .chip.on { background: var(--navy); border-color: var(--navy); color: #fff; }
        .statsRow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
        .statCard { background: #fff; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
        .l { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.02em; }
        .v { font-size: 24px; font-weight: 800; color: var(--navy); }
        .panel { padding: 18px; margin-bottom: 16px; }
        .panel h3 { font-size: 14px; font-weight: 700; color: var(--ink); margin-bottom: 14px; }
        .muted { color: var(--muted); font-size: 13px; }
        .chart { display: flex; align-items: flex-end; gap: 3px; height: 140px; }
        .barCol { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 4px; }
        .barFill { width: 100%; background: var(--navy); border-radius: 3px 3px 0 0; min-height: 4px; }
        .barLabel { font-size: 9px; color: var(--muted); margin-top: 4px; }
        .twoCol { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 800px) { .twoCol { grid-template-columns: 1fr; } .statsRow { grid-template-columns: repeat(2, 1fr); } }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; font-size: 10.5px; text-transform: uppercase; color: var(--muted); padding: 6px 4px; border-bottom: 1px solid var(--line); }
        td { padding: 8px 4px; border-bottom: 1px solid var(--line); color: var(--ink-2); }
        td.truncate { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .r { text-align: right; }
        .hint { font-size: 12px; color: var(--muted); line-height: 1.5; margin-top: 4px; }
      `}</style>
    </div>
  );
}
