// src/app/dashboard/analytics/page.tsx
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

// ─── Brand Colors ─────────────────────────────────────────────────────────────

const BRAND = {
  primary:  "#5B1A0E",
  accent:   "#D46A2E",
  green:    "#4F8A5B",
  red:      "#C94F4F",
  blue:     "#3b82f6",
  amber:    "#D9A441",
  violet:   "#8b5cf6",
  bg:       "#F5F1E8",
  border:   "#E8E1D5",
  card:     "#DDD2C2",
  text:     "#2B1A14",
  muted:    "#7A685F",
};

const GENDER_COLORS: Record<string, string> = {
  MALE:   "#3b82f6",
  FEMALE: "#ec4899",
  OTHER:  "#8b5cf6",
};

const PHASE_COLORS = [BRAND.green, BRAND.blue, BRAND.violet, BRAND.green, BRAND.amber];

const STATUS_PILL: Record<string, string> = {
  NEW:       "bg-sky-50 text-sky-700 border border-sky-200",
  RETURNING: "bg-red-50 text-red-600 border border-red-200",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

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

// ─── Active Pie Shape ─────────────────────────────────────────────────────────

function ActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 10} textAnchor="middle" style={{ fontSize: 22, fontWeight: 900, fill: BRAND.text }}>
        {value}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: BRAND.muted }}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 30} textAnchor="middle" style={{ fill, fontSize: 12, fontWeight: 700 }}>
        {(percent * 100).toFixed(0)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 14} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color, borderColor }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; borderColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 relative overflow-hidden" style={{ borderColor }}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: color }} />
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "20" }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: BRAND.muted }}>{label}</p>
      <p className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: BRAND.text }}>{value}</p>
      {sub && <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BRAND.card }}>
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b" style={{ borderColor: BRAND.border, background: `linear-gradient(to right, ${BRAND.bg}, white)` }}>
        <h2 className="text-sm sm:text-base font-bold" style={{ color: BRAND.text }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: BRAND.muted }}>{subtitle}</p>}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data,           setData]           = useState<AnalyticsData | null>(null);
  const [loading,        setLoading]        = useState(true);
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
    <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.accent, borderTopColor: "transparent" }} />
        <p className="text-sm font-medium" style={{ color: BRAND.muted }}>Loading analytics…</p>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.bg }}>
      <p className="text-sm" style={{ color: BRAND.muted }}>Failed to load analytics data.</p>
    </div>
  );

  const {
    total, newPatients, returning, missed, attended, confirmed, totalPatients,
    sessionTypes, monthlyTrend, genderDistribution, phaseDistribution,
  } = data;

  const noShowRate = total > 0 ? ((missed / total) * 100).toFixed(1) : "0";
  const attendRate = total > 0 ? ((attended / total) * 100).toFixed(1) : "0";

  const scatterData = (phaseDistribution ?? []).map((p, i) => ({
    x: i + 1,
    y: p.avgSessions ?? 0,
    z: p.count,
    phase: p.phase?.replace("_", " ") ?? "Unknown",
  }));

  const outcomeData = [
    { name: "Attended",  value: attended,  fill: BRAND.green },
    { name: "Confirmed", value: confirmed, fill: BRAND.blue  },
    { name: "Missed",    value: missed,    fill: BRAND.red   },
  ];

  const axisProps = {
    axisLine: false as const,
    tickLine: false as const,
    tick:     { fontSize: 11, fill: BRAND.muted, fontWeight: 600 as const },
  };

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: BRAND.bg }}>
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0" style={{ background: BRAND.primary }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: BRAND.primary }}>Analytics</h1>
            </div>
            <p className="text-xs sm:text-sm ml-[42px]" style={{ color: BRAND.muted }}>
              Patient trends · Session outcomes · Phase distribution
            </p>
          </div>
          <div className="flex items-center gap-2 border rounded-xl px-3 sm:px-4 py-2 text-xs font-bold shadow-sm self-start"
            style={{ background: BRAND.green + "15", borderColor: BRAND.green + "40", color: BRAND.green }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: BRAND.green }} />
            Live data
          </div>
        </div>

        {/* ── KPI Cards: 2 col mobile → 4 col desktop ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Sessions" value={total} sub={`${attended} attended`}
            color={BRAND.primary} borderColor={BRAND.card}
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <StatCard
            label="Attendance Rate" value={`${attendRate}%`} sub="of all sessions"
            color={BRAND.green} borderColor={BRAND.green + "40"}
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard
            label="No-show Rate" value={`${noShowRate}%`} sub={`${missed} missed`}
            color={BRAND.red} borderColor={BRAND.red + "40"}
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
          />
          <StatCard
            label="Total Patients" value={totalPatients} sub={`${newPatients} new · ${returning} returning`}
            color={BRAND.accent} borderColor={BRAND.accent + "40"}
            icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
        </div>

        {/* ── Monthly Trend Line ── */}
        <SectionCard
          title="Monthly Patient Trend"
          subtitle="Total sessions · New patients · Returning patients — month by month">
          {monthlyTrend && monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BRAND.border} />
                <XAxis dataKey="month" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, color: BRAND.muted }} />
                <Line type="monotone" dataKey="total"       name="Total Sessions"     stroke={BRAND.primary} strokeWidth={3} dot={{ r: 4, fill: BRAND.primary, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="newPatients" name="New Patients"       stroke={BRAND.blue}    strokeWidth={2} dot={{ r: 3, fill: BRAND.blue,    strokeWidth: 2, stroke: "#fff" }} strokeDasharray="5 3" />
                <Line type="monotone" dataKey="returning"   name="Returning Patients" stroke={BRAND.amber}   strokeWidth={2} dot={{ r: 3, fill: BRAND.amber,   strokeWidth: 2, stroke: "#fff" }} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 sm:h-64 flex items-center justify-center">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: BRAND.bg }}>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: BRAND.card }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="text-sm font-semibold" style={{ color: BRAND.muted }}>Not enough data yet</p>
                <p className="text-xs mt-1" style={{ color: BRAND.card }}>Trend data will appear as sessions accumulate</p>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Row 2: Pie + Bar — 1 col mobile → 2 col lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          {/* Gender Pie */}
          <SectionCard
            title="Gender Distribution"
            subtitle={selectedGender
              ? `Showing ${selectedGender.toLowerCase()} patients — click again to clear`
              : "Click a slice to drill into patient list"}>
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center">
              <div className="w-full sm:flex-1">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      {...({
                        activeIndex: activePieIndex,
                        activeShape: ActivePieShape,
                        data: (genderDistribution ?? []).map(g => ({
                          name:   g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Other",
                          value:  g.count,
                          gender: g.gender,
                        })),
                        cx:          "50%",
                        cy:          "50%",
                        innerRadius: 55,
                        outerRadius: 80,
                        dataKey:     "value",
                        onClick:     handlePieClick,
                        className:   "cursor-pointer",
                      } as any)}
                    >
                      {(genderDistribution ?? []).map((g) => (
                        <Cell key={g.gender} fill={GENDER_COLORS[g.gender] ?? BRAND.muted} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend buttons */}
              <div className="flex sm:flex-col flex-row flex-wrap justify-center gap-2 sm:gap-3 flex-shrink-0">
                {(genderDistribution ?? []).map((g, i) => {
                  const pct      = totalPatients > 0 ? Math.round((g.count / totalPatients) * 100) : 0;
                  const color    = GENDER_COLORS[g.gender] ?? BRAND.muted;
                  const isSelected = selectedGender === g.gender;
                  return (
                    <button key={g.gender}
                      onClick={() => handlePieClick(null, i)}
                      className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:py-2.5 rounded-xl border-2 transition-all text-left"
                      style={isSelected
                        ? { borderColor: color, background: color + "15" }
                        : { borderColor: BRAND.border, background: "white" }}>
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div>
                        <p className="text-xs font-bold" style={{ color: BRAND.text }}>
                          {g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Other"}
                        </p>
                        <p className="text-xs font-semibold" style={{ color }}>{g.count} · {pct}%</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drill-down patient list */}
            {selectedGender && genderPatients.length > 0 && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: BRAND.border }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.muted }}>
                  {selectedGender === "MALE" ? "Male" : selectedGender === "FEMALE" ? "Female" : "Other"} patients ({genderPatients.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto
                  [&::-webkit-scrollbar]:w-1.5
                  [&::-webkit-scrollbar-track]:bg-[#F5F1E8]
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-thumb]:bg-[#D46A2E]
                  [&::-webkit-scrollbar-thumb]:rounded-full">
                  {genderPatients.map(p => (
                    <Link key={p.id} href={`/dashboard/patients/${p.id}`}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all group"
                      style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                          style={{ background: GENDER_COLORS[selectedGender] ?? BRAND.muted }}>
                          {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-xs font-bold" style={{ color: BRAND.text }}>{p.name}</p>
                          <p className="text-[10px] font-mono" style={{ color: BRAND.muted }}>{p.patientCode}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.age && <span className="text-xs" style={{ color: BRAND.muted }}>{p.age}y</span>}
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[p.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {p.status === "NEW" ? "New" : "Returning"}
                        </span>
                        <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: BRAND.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={outcomeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" stroke={BRAND.border} vertical={false} />
                <XAxis dataKey="name" {...axisProps} />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: BRAND.bg }} />
                <Bar dataKey="value" name="Sessions" radius={[8, 8, 0, 0]}>
                  {outcomeData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5 mt-3">
              {outcomeData.map(o => (
                <div key={o.name} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: o.fill }} />
                  <span className="text-xs font-semibold" style={{ color: BRAND.muted }}>{o.name}</span>
                  <span className="text-xs font-black" style={{ color: BRAND.text }}>{o.value}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ── Row 3: Session Type + Scatter — 1 col mobile → 2 col lg ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          {/* Session Type Breakdown */}
          <SectionCard title="Session Type Breakdown" subtitle="Distribution of session categories">
            <div className="space-y-3 sm:space-y-4">
              {(sessionTypes ?? []).map((s, i) => {
                const pct    = total > 0 ? Math.round((s._count.sessionType / total) * 100) : 0;
                const colors = [BRAND.primary, BRAND.blue, BRAND.violet, BRAND.accent, BRAND.green];
                const c      = colors[i % colors.length];
                return (
                  <div key={s.sessionType}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                        <span className="text-xs sm:text-sm font-semibold" style={{ color: BRAND.text }}>
                          {s.sessionType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black" style={{ color: BRAND.text }}>{s._count.sessionType}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ color: BRAND.muted, background: BRAND.bg }}>{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden" style={{ background: BRAND.border }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 sm:mt-6 border-t pt-4 sm:pt-5" style={{ borderColor: BRAND.border }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4" style={{ color: BRAND.muted }}>Patient Breakdown</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "New Patients",      value: newPatients, pct: totalPatients > 0 ? Math.round((newPatients / totalPatients) * 100) : 0, color: BRAND.accent },
                  { label: "Returning Patients", value: returning,   pct: totalPatients > 0 ? Math.round((returning / totalPatients) * 100) : 0,   color: BRAND.primary },
                ].map(item => (
                  <div key={item.label} className="rounded-2xl p-3 sm:p-4 border" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: BRAND.muted }}>{item.label}</p>
                    <p className="text-xl sm:text-2xl font-black" style={{ color: item.color }}>{item.value}</p>
                    <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: BRAND.card }}>
                      <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                    </div>
                    <p className="text-xs font-semibold mt-1" style={{ color: BRAND.muted }}>{item.pct}% of total</p>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Phase Scatter */}
          <SectionCard title="Phase vs Avg Sessions" subtitle="Bubble size = number of patients in phase · Hover for details">
            {scatterData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BRAND.border} />
                    <XAxis
                      dataKey="x" type="number" name="Phase"
                      domain={[0, 6]}
                      tickFormatter={v => `P${v}`}
                      {...axisProps}
                    />
                    <YAxis dataKey="y" type="number" name="Avg Sessions" {...axisProps} allowDecimals={false} />
                    <ZAxis dataKey="z" range={[80, 400]} name="Patients" />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="bg-white border rounded-2xl shadow-xl p-3 text-xs" style={{ borderColor: BRAND.card }}>
                            <p className="font-bold mb-1.5" style={{ color: BRAND.text }}>{d?.phase}</p>
                            <p style={{ color: BRAND.muted }}>Avg sessions: <span className="font-bold" style={{ color: BRAND.text }}>{d?.y}</span></p>
                            <p style={{ color: BRAND.muted }}>Patients: <span className="font-bold" style={{ color: BRAND.text }}>{d?.z}</span></p>
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

                <div className="flex flex-wrap gap-2 mt-3">
                  {scatterData.map((d, i) => (
                    <div key={d.phase} className="flex items-center gap-1.5 text-xs font-semibold border px-2.5 py-1 rounded-lg"
                      style={{ color: BRAND.muted, background: BRAND.bg, borderColor: BRAND.border }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: PHASE_COLORS[i % PHASE_COLORS.length] }} />
                      {d.phase}
                      <span style={{ color: BRAND.card }}>({d.z})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-center">
                <div>
                  <p className="text-sm font-semibold" style={{ color: BRAND.muted }}>No phase data yet</p>
                  <p className="text-xs mt-1" style={{ color: BRAND.card }}>Assign treatment phases to patients to see this chart</p>
                </div>
              </div>
            )}
          </SectionCard>
        </div>

        {/* ── Quick Summary ── */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 sm:p-6" style={{ borderColor: BRAND.card }}>
          <div className="flex items-center gap-2 mb-4 sm:mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: BRAND.bg }}>
              <svg className="w-4 h-4" style={{ color: BRAND.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm sm:text-base font-bold" style={{ color: BRAND.text }}>Quick Summary</h2>
          </div>

          {/* 3 cols mobile → 6 cols desktop */}
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 sm:gap-4">
            {[
              { label: "Total Patients",  value: totalPatients,       color: BRAND.primary },
              { label: "Total Sessions",  value: total,               color: BRAND.accent  },
              { label: "Attended",        value: attended,            color: BRAND.green   },
              { label: "Missed",          value: missed,              color: BRAND.red     },
              { label: "Attend Rate",     value: `${attendRate}%`,    color: BRAND.green   },
              { label: "No-show Rate",    value: `${noShowRate}%`,    color: BRAND.red     },
            ].map(s => (
              <div key={s.label} className="text-center p-3 sm:p-4 rounded-2xl border" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                <p className="text-xl sm:text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1" style={{ color: BRAND.muted }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}