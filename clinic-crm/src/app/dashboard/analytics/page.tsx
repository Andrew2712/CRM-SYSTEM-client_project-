"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
  ScatterChart, Scatter, ZAxis,
  BarChart, Bar,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type AnalyticsData = {
  total: number;
  newPatients: number;
  returning: number;
  missed: number;
  attended: number;
  confirmed: number;
  totalPatients: number;
  sessionTypes: { sessionType: string; _count: { sessionType: number } }[];
  monthlyTrend: { month: string; total: number; newPatients: number; returning: number }[];
  genderDistribution: { gender: string; count: number; patients: GenderPatient[] }[];
  phaseDistribution: { phase: string; count: number; avgSessions: number }[];
};

type GenderPatient = {
  id: string; name: string; patientCode: string;
  status: string; age?: number;
};

// ─── Colors ───────────────────────────────────────────────────────────────────

const TEAL    = "#0d7a5f";
const TEAL_LT = "#14b8a6";
const BLUE    = "#3b82f6";
const AMBER   = "#f59e0b";
const RED     = "#ef4444";
const EMERALD = "#10b981";
const VIOLET  = "#8b5cf6";
const SLATE   = "#64748b";

const GENDER_COLORS: Record<string, string> = {
  MALE:   "#3b82f6",
  FEMALE: "#ec4899",
  OTHER:  "#8b5cf6",
};

const PHASE_COLORS = [TEAL, BLUE, VIOLET, EMERALD, AMBER];

const STATUS_PILL: Record<string, string> = {
  NEW:       "bg-sky-50 text-sky-700 border border-sky-200",
  RETURNING: "bg-red-50 text-red-600 border border-red-200",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-xs">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
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

// ─── Active Pie Shape ─────────────────────────────────────────────────────────

function ActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" className="fill-slate-800 font-black text-2xl" style={{ fontSize: 24, fontWeight: 900 }}>
        {value}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, fontWeight: 600 }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 32} textAnchor="middle" style={{ fill: fill, fontSize: 12, fontWeight: 700 }}>
        {(percent * 100).toFixed(0)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; accent: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border-2 ${accent} shadow-sm p-5 relative overflow-hidden`}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: color }} />
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + "20" }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePieIndex, setActivePieIndex] = useState(0);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [genderPatients, setGenderPatients] = useState<GenderPatient[]>([]);

  useEffect(() => {
    fetch("/api/admin/analytics", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function handlePieClick(_: any, index: number) {
    if (!data) return;
    const slice = data.genderDistribution[index];
    if (!slice) return;

    if (selectedGender === slice.gender) {
      setSelectedGender(null);
      setGenderPatients([]);
    } else {
      setSelectedGender(slice.gender);
      setGenderPatients(slice.patients ?? []);
    }
    setActivePieIndex(index);
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Loading analytics…</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
      <p className="text-sm text-slate-400">Failed to load analytics data.</p>
    </div>
  );

  const { total, newPatients, returning, missed, attended, confirmed, totalPatients,
    sessionTypes, monthlyTrend, genderDistribution, phaseDistribution } = data;

  const noShowRate  = total > 0 ? ((missed / total) * 100).toFixed(1) : "0";
  const attendRate  = total > 0 ? ((attended / total) * 100).toFixed(1) : "0";

  // Scatter data: phase vs sessions attended
  const scatterData = (phaseDistribution ?? []).map((p, i) => ({
    x: i + 1,
    y: p.avgSessions ?? 0,
    z: p.count,
    phase: p.phase?.replace("_", " ") ?? "Unknown",
  }));

  // Outcome bar data
  const outcomeData = [
    { name: "Attended",  value: attended,  fill: EMERALD },
    { name: "Confirmed", value: confirmed, fill: BLUE },
    { name: "Missed",    value: missed,    fill: RED },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md" style={{ background: TEAL }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Analytics</h1>
            </div>
            <p className="text-sm text-slate-400 ml-[42px]">Patient trends · Session outcomes · Phase distribution</p>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Live data
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Sessions" value={total} sub={`${attended} attended`} color={TEAL}
            accent="border-teal-100"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
          <StatCard label="Attendance Rate" value={`${attendRate}%`} sub="of all sessions" color={EMERALD}
            accent="border-emerald-100"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          <StatCard label="No-show Rate" value={`${noShowRate}%`} sub={`${missed} missed`} color={RED}
            accent="border-red-100"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>} />
          <StatCard label="Total Patients" value={totalPatients} sub={`${newPatients} new · ${returning} returning`} color={BLUE}
            accent="border-blue-100"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        </div>

        {/* ── Row 1: Monthly Trend Line Chart ── */}
        <SectionCard title="Monthly Patient Trend" subtitle="Total sessions · New patients · Returning patients — month by month">
          {monthlyTrend && monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
                <Line type="monotone" dataKey="total"       name="Total Sessions"       stroke={TEAL}    strokeWidth={3} dot={{ r: 4, fill: TEAL,    strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="newPatients" name="New Patients"         stroke={BLUE}    strokeWidth={2} dot={{ r: 3, fill: BLUE,    strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="returning"   name="Returning Patients"   stroke={AMBER}   strokeWidth={2} dot={{ r: 3, fill: AMBER,   strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-400">Not enough data yet</p>
                <p className="text-xs text-slate-300 mt-1">Trend data will appear as sessions accumulate</p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Row 2: Pie + Bar ── */}
        <div className="grid grid-cols-2 gap-5">

          {/* Gender Pie — interactive */}
          <SectionCard
            title="Gender Distribution"
            subtitle={selectedGender ? `Showing ${selectedGender.toLowerCase()} patients — click again to clear` : "Click a slice to drill into patient list"}>
            <div className="flex gap-6 items-center">
              <div className="flex-1">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      activeIndex={activePieIndex}
                      activeShape={ActivePieShape}
                      data={(genderDistribution ?? []).map(g => ({
                        name: g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Other",
                        value: g.count,
                        gender: g.gender,
                      }))}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={85}
                      dataKey="value"
                      onClick={handlePieClick}
                      className="cursor-pointer"
                    >
                      {(genderDistribution ?? []).map((g, i) => (
                        <Cell key={g.gender} fill={GENDER_COLORS[g.gender] ?? SLATE} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-3 flex-shrink-0">
                {(genderDistribution ?? []).map((g, i) => {
                  const pct = totalPatients > 0 ? Math.round((g.count / totalPatients) * 100) : 0;
                  const color = GENDER_COLORS[g.gender] ?? SLATE;
                  const isSelected = selectedGender === g.gender;
                  return (
                    <button key={g.gender}
                      onClick={() => handlePieClick(null, i)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all w-36 text-left ${
                        isSelected ? "border-current shadow-sm" : "border-slate-100 hover:border-slate-200"
                      }`}
                      style={isSelected ? { borderColor: color, background: color + "15" } : {}}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div>
                        <p className="text-xs font-bold text-slate-700">{g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Other"}</p>
                        <p className="text-xs font-semibold" style={{ color }}>{g.count} · {pct}%</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Patient list on drill-down */}
            {selectedGender && genderPatients.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  {selectedGender === "MALE" ? "Male" : selectedGender === "FEMALE" ? "Female" : "Other"} patients ({genderPatients.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto
                  [&::-webkit-scrollbar]:w-1.5
                  [&::-webkit-scrollbar-track]:bg-slate-100
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-thumb]:bg-teal-300
                  [&::-webkit-scrollbar-thumb]:rounded-full">
                  {genderPatients.map(p => (
                    <Link key={p.id} href={`/dashboard/patients/${p.id}`}
                      className="flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-teal-50/50 rounded-xl border border-slate-100 hover:border-teal-200 transition-all group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                          style={{ background: GENDER_COLORS[selectedGender] ?? SLATE }}>
                          {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] font-mono text-slate-400">{p.patientCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.age && <span className="text-xs text-slate-400">{p.age}y</span>}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[p.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {p.status === "NEW" ? "New" : "Returning"}
                        </span>
                        <svg className="w-3 h-3 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Session Outcomes Bar */}
          <SectionCard title="Session Outcomes" subtitle="Attended vs Confirmed vs Missed">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={outcomeData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f8fafc" }} />
                <Bar dataKey="value" name="Sessions" radius={[8, 8, 0, 0]}>
                  {outcomeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Mini legend */}
            <div className="flex items-center justify-center gap-5 mt-2">
              {outcomeData.map(o => (
                <div key={o.name} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: o.fill }} />
                  <span className="text-xs font-semibold text-slate-500">{o.name}</span>
                  <span className="text-xs font-black text-slate-800">{o.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Row 3: Session Type + Scatter ── */}
        <div className="grid grid-cols-2 gap-5">

          {/* Session type bar */}
          <SectionCard title="Session Type Breakdown" subtitle="Distribution of session categories">
            <div className="space-y-4">
              {(sessionTypes ?? []).map((s, i) => {
                const pct = total > 0 ? Math.round((s._count.sessionType / total) * 100) : 0;
                const colors = [TEAL, BLUE, VIOLET, AMBER, EMERALD];
                const c = colors[i % colors.length];
                return (
                  <div key={s.sessionType}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                        <span className="text-sm font-semibold text-slate-700">
                          {s.sessionType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">{s._count.sessionType}</span>
                        <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Patient breakdown sub-section */}
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Patient Breakdown</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "New Patients",      value: newPatients, pct: totalPatients > 0 ? Math.round((newPatients / totalPatients) * 100) : 0, color: BLUE },
                  { label: "Returning Patients", value: returning,   pct: totalPatients > 0 ? Math.round((returning / totalPatients) * 100) : 0,   color: TEAL },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 mb-1">{item.label}</p>
                    <p className="text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                    </div>
                    <p className="text-xs font-semibold text-slate-400 mt-1">{item.pct}% of total</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Phase Scatter Plot */}
          <SectionCard title="Phase vs Avg Sessions" subtitle="Bubble size = number of patients in phase · Hover for details">
            {scatterData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="x" type="number" name="Phase"
                      domain={[0, 6]}
                      tickFormatter={v => `P${v}`}
                      tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      dataKey="y" type="number" name="Avg Sessions"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false} allowDecimals={false}
                    />
                    <ZAxis dataKey="z" range={[80, 500]} name="Patients" />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-4 text-xs">
                            <p className="font-bold text-slate-700 mb-2">{d?.phase}</p>
                            <p className="text-slate-500">Avg sessions: <span className="font-bold text-slate-800">{d?.y}</span></p>
                            <p className="text-slate-500">Patients: <span className="font-bold text-slate-800">{d?.z}</span></p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={scatterData} name="Phase">
                      {scatterData.map((_, i) => (
                        <Cell key={i} fill={PHASE_COLORS[i % PHASE_COLORS.length]} fillOpacity={0.85} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>

                {/* Phase legend */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {scatterData.map((d, i) => (
                    <div key={d.phase} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                      <span className="w-2 h-2 rounded-full" style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }} />
                      {d.phase}
                      <span className="text-slate-400">({d.z})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-center">
                <div>
                  <p className="text-sm font-semibold text-slate-400">No phase data yet</p>
                  <p className="text-xs text-slate-300 mt-1">Assign treatment phases to patients to see this chart</p>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Row 4: Quick Summary ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-slate-900">Quick Summary</h2>
          </div>
          <div className="grid grid-cols-6 gap-4">
            {[
              { label: "Total Patients",   value: totalPatients, color: TEAL },
              { label: "Total Sessions",   value: total,         color: BLUE },
              { label: "Attended",         value: attended,      color: EMERALD },
              { label: "Missed",           value: missed,        color: RED },
              { label: "Attendance Rate",  value: `${attendRate}%`, color: EMERALD },
              { label: "No-show Rate",     value: `${noShowRate}%`, color: RED },
            ].map(s => (
              <div key={s.label} className="text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}