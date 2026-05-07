// src/components/staff/AnalyticsCharts.tsx
"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";

// ── Lazy-load recharts ─────────────────────────────────────────────────────
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

// ── Types ──────────────────────────────────────────────────────────────────
export type AppointmentSlim = {
  id:        string;
  startTime: string;
  status:    string;
};

type WeekPoint  = { day: string; sessions: number };
type MonthPoint = { month: string; sessions: number; attended: number; missed: number };

// ── Helpers ────────────────────────────────────────────────────────────────
const WEEK_DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildWeekly(appts: AppointmentSlim[]): WeekPoint[] {
  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

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

// ── Skeleton ───────────────────────────────────────────────────────────────
function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="animate-pulse bg-[#F5F1E8] rounded-2xl w-full" style={{ height }} />
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#DDD2C2] rounded-2xl shadow-xl p-3 text-xs">
      <p className="font-bold text-[#2B1A14] mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#7A685F]">{p.name}:</span>
          <span className="font-bold text-[#2B1A14]">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Export ────────────────────────────────────────────────────────────
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
    axisLine: false as const,
    tickLine: false as const,
    tick:     { fontSize: 11, fill: "#7A685F", fontWeight: 600 },
  };

  return (
    // ✅ FIXED: flex-col stacks both charts vertically on ALL screen sizes
    <div className="flex flex-col gap-4 sm:gap-5">

      {/* ── Weekly trend (Line) ── */}
      <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
        <div
          className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5]"
          style={{ background: "linear-gradient(to right, #F5F1E8, white)" }}
        >
          <h3 className="text-sm font-bold text-[#2B1A14]">Weekly Session Trend</h3>
          <p className="text-xs text-[#7A685F] mt-0.5">Sessions this week — Mon to Sun</p>
        </div>
        <div className="p-4 sm:p-6">
          {!chartsReady ? <ChartSkeleton height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weekly} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D5" />
                <XAxis dataKey="day" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  name="Sessions"
                  stroke="#4F8A5B"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#4F8A5B", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Monthly trend (Bar) ── */}
      <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
        <div
          className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5]"
          style={{ background: "linear-gradient(to right, #F5F1E8, white)" }}
        >
          <h3 className="text-sm font-bold text-[#2B1A14]">Monthly Session Trend</h3>
          <p className="text-xs text-[#7A685F] mt-0.5">Attended vs Missed — last 6 months</p>
        </div>
        <div className="p-4 sm:p-6">
          {!chartsReady ? <ChartSkeleton height={200} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D5" vertical={false} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F5F1E8" }} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, color: "#7A685F" }} />
                <Bar dataKey="attended" name="Attended" fill="#4F8A5B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed"   name="Missed"   fill="#C94F4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
}