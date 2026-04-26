// src/components/staff/AnalyticsCharts.tsx
"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";

// ── Lazy-load recharts so it never slows down other pages ──────────────────
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => ({ default: m.ResponsiveContainer })),
  { ssr: false, loading: () => <ChartSkeleton /> }
);
const LineChart    = dynamic(() => import("recharts").then((m) => ({ default: m.LineChart })),    { ssr: false });
const Line         = dynamic(() => import("recharts").then((m) => ({ default: m.Line })),         { ssr: false });
const BarChart     = dynamic(() => import("recharts").then((m) => ({ default: m.BarChart })),     { ssr: false });
const Bar          = dynamic(() => import("recharts").then((m) => ({ default: m.Bar })),          { ssr: false });
const XAxis        = dynamic(() => import("recharts").then((m) => ({ default: m.XAxis })),        { ssr: false });
const YAxis        = dynamic(() => import("recharts").then((m) => ({ default: m.YAxis })),        { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip      = dynamic(() => import("recharts").then((m) => ({ default: m.Tooltip })),      { ssr: false });
const Legend       = dynamic(() => import("recharts").then((m) => ({ default: m.Legend })),       { ssr: false });
const Cell         = dynamic(() => import("recharts").then((m) => ({ default: m.Cell })),         { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────
export type AppointmentSlim = {
  id:        string;
  startTime: string;
  status:    string;
};

type WeekPoint  = { day: string; sessions: number };
type MonthPoint = { month: string; sessions: number; attended: number; missed: number };

// ── Helpers ───────────────────────────────────────────────────────────────
const WEEK_DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildWeekly(appts: AppointmentSlim[]): WeekPoint[] {
  const now      = new Date();
  const monday   = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0,0,0,0);

  const counts = Array(7).fill(0);
  appts.forEach((a) => {
    const d    = new Date(a.startTime);
    const diff = Math.floor((d.getTime() - monday.getTime()) / 86400000);
    if (diff >= 0 && diff < 7) counts[diff]++;
  });
  return WEEK_DAYS.map((day, i) => ({ day, sessions: counts[i] }));
}

function buildMonthly(appts: AppointmentSlim[]): MonthPoint[] {
  const map: Record<string, { sessions: number; attended: number; missed: number }> = {};

  // last 6 months
  for (let i = 5; i >= 0; i--) {
    const d  = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    map[key] = { sessions: 0, attended: 0, missed: 0 };
  }

  appts.forEach((a) => {
    const d   = new Date(a.startTime);
    const key = `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
    if (map[key]) {
      map[key].sessions++;
      if (a.status === "ATTENDED") map[key].attended++;
      if (a.status === "MISSED")   map[key].missed++;
    }
  });

  return Object.entries(map).map(([month, v]) => ({ month, ...v }));
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="animate-pulse bg-slate-100 rounded-2xl w-full" style={{ height }} />
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-3 text-xs">
      <p className="font-bold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}:</span>
          <span className="font-bold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export default function AnalyticsCharts({
  appointments,
  chartsReady,
}: {
  appointments: AppointmentSlim[];
  chartsReady:  boolean;
}) {
  const weekly  = useMemo(() => buildWeekly(appointments),  [appointments]);
  const monthly = useMemo(() => buildMonthly(appointments), [appointments]);

  const axisProps = {
    axisLine:  false as const,
    tickLine:  false as const,
    tick:      { fontSize: 11, fill: "#94a3b8", fontWeight: 600 },
  };

  return (
    <div className="grid grid-cols-2 gap-5">

      {/* ── Weekly trend (Line) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h3 className="text-sm font-bold text-slate-900">Weekly Session Trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">Sessions this week — Mon to Sun</p>
        </div>
        <div className="p-6">
          {!chartsReady ? <ChartSkeleton height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weekly} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#0d7a5f"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#0d7a5f", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Monthly trend (Bar) ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <h3 className="text-sm font-bold text-slate-900">Monthly Session Trend</h3>
          <p className="text-xs text-slate-400 mt-0.5">Attended vs Missed — last 6 months</p>
        </div>
        <div className="p-6">
          {!chartsReady ? <ChartSkeleton height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Bar dataKey="attended" name="Attended" fill="#10b981" radius={[4,4,0,0]} />
                <Bar dataKey="missed"   name="Missed"   fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}