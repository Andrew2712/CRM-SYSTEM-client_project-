// src/components/staff/Analyticscharts.tsx
"use client";

/**
 * AnalyticsCharts — staff profile analytics
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Month selector (last 12 months)
 * ✅ Interactive stat cards — click to see session list drawer
 * ✅ Weekly Session Trend → LINE chart (not bar)
 * ✅ Monthly Session Trend → Bar chart (12 months)
 * ✅ Download Report button → CSV + Text Report dropdown
 * ✅ Session list drawer with status badges, date, type
 * ✅ Responsive & fully typed
 */

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────
export type AppointmentSlim = {
  id:          string;
  startTime:   string;
  status:      string;
  sessionType?: string;
  patient?:    { id: string; name: string; patientCode?: string };
};

type StatFilter = "total" | "attended" | "missed" | "upcoming" | null;

// ── Constants ──────────────────────────────────────────────────────────────
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ATTENDED:    { label: "Attended",    color: "#4F8A5B", bg: "#4F8A5B15", border: "#4F8A5B30" },
  MISSED:      { label: "Missed",      color: "#C94F4F", bg: "#C94F4F15", border: "#C94F4F30" },
  CONFIRMED:   { label: "Confirmed",   color: "#D97332", bg: "#D9733215", border: "#D9733230" },
  CANCELLED:   { label: "Cancelled",   color: "#7A685F", bg: "#7A685F15", border: "#7A685F30" },
  RESCHEDULED: { label: "Rescheduled", color: "#2563eb", bg: "#2563eb15", border: "#2563eb30" },
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  INITIAL_ASSESSMENT: "Initial Assessment",
  FOLLOW_UP:          "Follow Up",
  SPECIALIZED:        "Specialized",
};

// ── Month helpers ──────────────────────────────────────────────────────────
function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) });
  }
  return opts;
}

function getWeeksOfMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const weeks: { label: string; short: string; start: Date; end: Date }[] = [];
  let current = new Date(firstDay);
  let wn = 1;
  while (current <= lastDay) {
    const start = new Date(current);
    const end   = new Date(current);
    end.setDate(end.getDate() + 6);
    if (end > lastDay) end.setTime(lastDay.getTime());
    weeks.push({
      label: `W${wn} (${start.getDate()} ${MONTH_ABBR[m-1]}–${end.getDate()})`,
      short: `W${wn}`,
      start: new Date(start),
      end:   new Date(end),
    });
    current.setDate(current.getDate() + 7);
    wn++;
  }
  return weeks;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ── Export helpers ─────────────────────────────────────────────────────────
function exportCSV(appointments: AppointmentSlim[], month: string, doctorName?: string) {
  const label = getMonthOptions().find(o => o.value === month)?.label ?? month;
  const rows: string[][] = [
    [`Session Report — ${doctorName ?? "Doctor"} — ${label}`], [],
    ["#", "Patient", "Date", "Time", "Session Type", "Status"],
  ];
  appointments.forEach((a, i) => {
    rows.push([
      String(i + 1),
      a.patient?.name ?? "—",
      fmtDate(a.startTime),
      fmtTime(a.startTime),
      SESSION_TYPE_LABELS[a.sessionType ?? ""] ?? a.sessionType ?? "—",
      STATUS_CONFIG[a.status]?.label ?? a.status,
    ]);
  });
  const csv  = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `sessions-${month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportText(
  appointments: AppointmentSlim[],
  stats: { total: number; attended: number; missed: number; upcoming: number },
  month: string,
  doctorName?: string
) {
  const label = getMonthOptions().find(o => o.value === month)?.label ?? month;
  const line = "─".repeat(60);
  const lines: string[] = [
    "CLINIC CRM — SESSION REPORT",
    `Doctor   : ${doctorName ?? "—"}`,
    `Period   : ${label}`,
    `Generated: ${new Date().toLocaleString("en-IN")}`,
    line, "",
    "OVERVIEW",
    `  Total Sessions  : ${stats.total}`,
    `  Attended        : ${stats.attended}`,
    `  Missed          : ${stats.missed}`,
    `  Upcoming        : ${stats.upcoming}`,
    "", "SESSION DETAIL",
    `  ${"#".padEnd(4)} ${"Patient".padEnd(24)} ${"Date".padEnd(14)} ${"Time".padEnd(8)} ${"Type".padEnd(22)} Status`,
    "  " + "─".repeat(82),
  ];
  appointments.forEach((a, i) => {
    lines.push(
      `  ${String(i+1).padEnd(4)} ${(a.patient?.name ?? "—").slice(0,24).padEnd(24)} ${fmtDate(a.startTime).padEnd(14)} ${fmtTime(a.startTime).padEnd(8)} ${(SESSION_TYPE_LABELS[a.sessionType ?? ""] ?? a.sessionType ?? "—").slice(0,22).padEnd(22)} ${STATUS_CONFIG[a.status]?.label ?? a.status}`
    );
  });
  lines.push(""); lines.push(line);
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `session-report-${month}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ── Download Button (matches CRM design) ──────────────────────────────────
function DownloadButton({
  appointments, stats, month, doctorName,
}: {
  appointments: AppointmentSlim[];
  stats: { total: number; attended: number; missed: number; upcoming: number };
  month: string;
  doctorName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 border-2"
        style={{ background: "#5B1A0E", color: "#fff", borderColor: "#5B1A0E" }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Report
        <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-58 bg-white border border-[#DDD2C2] rounded-2xl shadow-2xl z-50 overflow-hidden min-w-[220px]">
          <div className="px-4 py-2.5 border-b border-[#E8E1D5]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#7A685F]">Export Format</p>
          </div>
          <button
            onClick={() => { exportCSV(appointments, month, doctorName); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F1E8] transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#16a34a15" }}>
              <svg className="w-4 h-4" style={{ color: "#16a34a" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#2B1A14]">Download CSV</p>
              <p className="text-[10px] text-[#7A685F]">Excel-compatible spreadsheet</p>
            </div>
          </button>
          <button
            onClick={() => { exportText(appointments, stats, month, doctorName); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F1E8] transition-colors text-left border-t border-[#F5F1E8]"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#2563eb15" }}>
              <svg className="w-4 h-4" style={{ color: "#2563eb" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-[#2B1A14]">Download Text</p>
              <p className="text-[10px] text-[#7A685F]">Formatted plain-text report</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Interactive Stat Card ──────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, border, icon, active, onClick,
}: {
  label: string; value: number; sub: string;
  color: string; border: string; icon: React.ReactNode;
  active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5
        transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${active ? "ring-2 ring-offset-1 scale-[1.02] shadow-lg" : ""}
      `}
      style={{
        borderColor: active ? color : border,
        ...(active ? { boxShadow: `0 4px 20px ${color}25` } : {}),
      }}
    >
      {/* bg glow */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-[0.08] pointer-events-none"
        style={{ background: color }} />

      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: color + "18", color }}>
        {icon}
      </div>
      <p className="text-[10px] font-bold text-[#7A685F] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl sm:text-3xl font-black text-[#2B1A14] tracking-tight">{value}</p>
      <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>

      {/* "click to view" hint */}
      <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`}
        style={{ color }}>
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
            d={active ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
        {active ? "Hide list" : "View sessions"}
      </div>
    </button>
  );
}

// ── Session List Drawer ────────────────────────────────────────────────────
function SessionList({
  sessions, filter, label, onClose,
}: {
  sessions: AppointmentSlim[];
  filter: StatFilter;
  label: string;
  onClose: () => void;
}) {
  if (!sessions.length) {
    return (
      <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#F5F1E8] flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-[#DDD2C2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-[#2B1A14]">No {label.toLowerCase()} sessions</p>
        <p className="text-xs text-[#7A685F] mt-1">for the selected month</p>
      </div>
    );
  }

  const filterColors: Record<string, string> = {
    total: "#4B0F05", attended: "#4F8A5B", missed: "#C94F4F", upcoming: "#D97332",
  };
  const fc = filterColors[filter ?? "total"] ?? "#4B0F05";

  return (
    <div className="bg-white rounded-2xl border-2 shadow-sm overflow-hidden"
      style={{ borderColor: fc + "30" }}>
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#E8E1D5] flex items-center justify-between"
        style={{ background: `linear-gradient(to right, ${fc}08, white)` }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: fc }} />
          <p className="text-sm font-bold text-[#2B1A14]">{label} Sessions</p>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: fc + "18", color: fc }}>
            {sessions.length}
          </span>
        </div>
        <button onClick={onClose}
          className="w-7 h-7 rounded-lg bg-[#F5F1E8] hover:bg-[#E8E1D5] flex items-center justify-center transition-colors">
          <svg className="w-3.5 h-3.5 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Table — desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#F5F1E8]">
              {["#","Patient","Date","Time","Session Type","Status"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-[#7A685F]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F1E8]">
            {sessions.map((s, i) => {
              const sc = STATUS_CONFIG[s.status];
              return (
                <tr key={s.id} className="hover:bg-[#F5F1E8]/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-bold text-[#7A685F]">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#2B1A14] truncate max-w-[140px]">
                      {s.patient?.name ?? "—"}
                    </p>
                    {s.patient?.patientCode && (
                      <p className="text-[10px] text-[#7A685F] font-mono">{s.patient.patientCode}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#7A685F] whitespace-nowrap">{fmtDate(s.startTime)}</td>
                  <td className="px-4 py-3 text-xs text-[#7A685F] whitespace-nowrap">{fmtTime(s.startTime)}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold text-[#7A685F] bg-[#F5F1E8] px-2 py-1 rounded-lg">
                      {SESSION_TYPE_LABELS[s.sessionType ?? ""] ?? s.sessionType ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
                      style={{ background: sc?.bg, color: sc?.color, borderColor: sc?.border }}>
                      {sc?.label ?? s.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden divide-y divide-[#F5F1E8]">
        {sessions.map((s, i) => {
          const sc = STATUS_CONFIG[s.status];
          return (
            <div key={s.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black text-[#7A685F] bg-[#F5F1E8] rounded-lg w-6 h-6 flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="font-bold text-[#2B1A14] truncate text-sm">{s.patient?.name ?? "—"}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                  style={{ background: sc?.bg, color: sc?.color, borderColor: sc?.border }}>
                  {sc?.label ?? s.status}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 ml-8">
                <span className="text-[10px] text-[#7A685F]">{fmtDate(s.startTime)} · {fmtTime(s.startTime)}</span>
                <span className="text-[10px] text-[#7A685F] bg-[#F5F1E8] px-1.5 py-0.5 rounded">
                  {SESSION_TYPE_LABELS[s.sessionType ?? ""] ?? s.sessionType ?? "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton + Empty ───────────────────────────────────────────────────────
function ChartSkeleton({ height = 220 }: { height?: number }) {
  return <div className="animate-pulse bg-[#F5F1E8] rounded-2xl w-full" style={{ height }} />;
}
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-40 flex items-center justify-center flex-col gap-2 text-center">
      <div className="w-10 h-10 rounded-xl bg-[#F5F1E8] flex items-center justify-center">
        <svg className="w-5 h-5 text-[#DDD2C2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-[#7A685F]">{message}</p>
    </div>
  );
}

// ── Chart section card ─────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, action }: {
  title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] flex items-start justify-between gap-3 flex-wrap"
        style={{ background: "linear-gradient(to right, #F5F1E8, white)" }}>
        <div>
          <h3 className="text-sm font-bold text-[#2B1A14]">{title}</h3>
          <p className="text-xs text-[#7A685F] mt-0.5">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

// ── Tooltip ────────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, weeks }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  weeks?: { label: string; short: string; start: Date; end: Date }[];
}) {
  if (!active || !payload?.length) return null;
  const week = weeks?.find(w => w.short === label);
  return (
    <div className="bg-white border border-[#DDD2C2] rounded-2xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-bold text-[#2B1A14] mb-0.5">{week?.label ?? label}</p>
      {week && (
        <p className="text-[#7A685F] text-[10px] mb-1.5">
          {week.start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
          {week.end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </p>
      )}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
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
  doctorName,
}: {
  appointments: AppointmentSlim[];
  chartsReady:  boolean;
  doctorName?:  string;
}) {
  const monthOptions  = useMemo(() => getMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [activeFilter, setActiveFilter]   = useState<StatFilter>(null);

  const axisProps = {
    axisLine: false as const, tickLine: false as const,
    tick: { fontSize: 11, fill: "#7A685F", fontWeight: 600 as const },
  };

  // ── Month-scoped appointments ─────────────────────────────────────────────
  const monthAppointments = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const start  = new Date(y, m - 1, 1);
    const end    = new Date(y, m, 0, 23, 59, 59, 999);
    return appointments.filter(a => {
      const d = new Date(a.startTime);
      return d >= start && d <= end;
    });
  }, [appointments, selectedMonth]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total:    monthAppointments.length,
      attended: monthAppointments.filter(a => a.status === "ATTENDED").length,
      missed:   monthAppointments.filter(a => a.status === "MISSED").length,
      upcoming: monthAppointments.filter(a => new Date(a.startTime) > now).length,
    };
  }, [monthAppointments]);

  // ── Filtered sessions for drawer ─────────────────────────────────────────
  const filteredSessions = useMemo(() => {
    if (!activeFilter) return [];
    const now = new Date();
    switch (activeFilter) {
      case "total":    return [...monthAppointments].sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      case "attended": return monthAppointments.filter(a => a.status === "ATTENDED").sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      case "missed":   return monthAppointments.filter(a => a.status === "MISSED").sort((a,b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      case "upcoming": return monthAppointments.filter(a => new Date(a.startTime) > now).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      default: return [];
    }
  }, [monthAppointments, activeFilter]);

  const filterLabel = activeFilter
    ? { total: "All", attended: "Attended", missed: "Missed", upcoming: "Upcoming" }[activeFilter]
    : "";

  // ── Weekly data — LINE chart ──────────────────────────────────────────────
  const { weeks, weeklyData } = useMemo(() => {
    const ws = getWeeksOfMonth(selectedMonth);
    const data = ws.map(({ short, start, end }) => {
      const inWeek = monthAppointments.filter(a => {
        const d = new Date(a.startTime);
        return d >= start && d <= end;
      });
      return {
        week:     short,
        Sessions: inWeek.length,
        Attended: inWeek.filter(a => a.status === "ATTENDED").length,
        Missed:   inWeek.filter(a => a.status === "MISSED").length,
      };
    });
    return { weeks: ws, weeklyData: data };
  }, [monthAppointments, selectedMonth]);

  // ── Monthly bar chart — last 12 months ───────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { sessions: number; attended: number; missed: number }> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      map[key] = { sessions: 0, attended: 0, missed: 0 };
    }
    appointments.forEach(a => {
      const d   = new Date(a.startTime);
      const key = `${MONTH_ABBR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
      if (map[key]) {
        map[key].sessions++;
        if (a.status === "ATTENDED") map[key].attended++;
        if (a.status === "MISSED")   map[key].missed++;
      }
    });
    return Object.entries(map).map(([month, v]) => ({ month, ...v }));
  }, [appointments]);

  const selectedLabel  = monthOptions.find(o => o.value === selectedMonth)?.label ?? selectedMonth;
  const hasWeeklyData  = weeklyData.some(w => w.Sessions > 0);
  const hasMonthlyData = monthlyData.some(m => m.sessions > 0);

  const STAT_CARDS = [
    {
      key:    "total"    as StatFilter,
      label:  "Total Sessions",
      sub:    `${stats.attended} attended`,
      color:  "#4B0F05",
      border: "#DDD2C2",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      value: stats.total,
    },
    {
      key:    "attended" as StatFilter,
      label:  "Attended",
      sub:    "sessions completed",
      color:  "#4F8A5B",
      border: "#4F8A5B30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      value: stats.attended,
    },
    {
      key:    "missed"   as StatFilter,
      label:  "Missed",
      sub:    "no-shows",
      color:  "#C94F4F",
      border: "#C94F4F30",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      value: stats.missed,
    },
    {
      key:    "upcoming" as StatFilter,
      label:  "Upcoming",
      sub:    "scheduled ahead",
      color:  "#D97332",
      border: "#D9733230",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      value: stats.upcoming,
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">

      {/* ── Top Controls Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#7A685F] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select
              value={selectedMonth}
              onChange={e => { setSelectedMonth(e.target.value); setActiveFilter(null); }}
              className="text-sm font-semibold border border-[#DDD2C2] rounded-xl px-3 py-1.5 bg-white text-[#2B1A14] focus:outline-none focus:ring-2 focus:ring-[#D97332]/40 cursor-pointer shadow-sm"
            >
              {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Live badge */}
          <div className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border"
            style={{ background: "#16a34a15", borderColor: "#16a34a40", color: "#16a34a" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#16a34a]" />
            Live
          </div>
        </div>

        {/* Download button */}
        <DownloadButton
          appointments={monthAppointments}
          stats={stats}
          month={selectedMonth}
          doctorName={doctorName}
        />
      </div>

      {/* ── Session Analytics label ── */}
      <div>
        <p className="text-[10px] font-bold text-[#7A685F] uppercase tracking-widest mb-3">
          Session Analytics — {selectedLabel}
        </p>

        {/* ── Interactive Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STAT_CARDS.map(card => (
            <StatCard
              key={card.key}
              label={card.label}
              value={card.value}
              sub={card.sub}
              color={card.color}
              border={card.border}
              icon={card.icon}
              active={activeFilter === card.key}
              onClick={() => setActiveFilter(f => f === card.key ? null : card.key)}
            />
          ))}
        </div>
      </div>

      {/* ── Session List Drawer ── */}
      {activeFilter && (
        <SessionList
          sessions={filteredSessions}
          filter={activeFilter}
          label={filterLabel ?? ""}
          onClose={() => setActiveFilter(null)}
        />
      )}

      {/* ── Weekly Session Trend — LINE chart ── */}
      <ChartCard
        title="Weekly Session Trend"
        subtitle={`Week-by-week sessions — ${selectedLabel}`}
      >
        {!chartsReady ? <ChartSkeleton height={220} /> :
          !hasWeeklyData ? <EmptyChart message={`No sessions in ${selectedLabel}`} /> : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gAttended" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#4F8A5B" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4F8A5B" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D5" />
                  <XAxis dataKey="week" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip content={(props) => (
                    <ChartTooltip
                      active={props.active}
                      payload={props.payload as unknown as { name: string; value: number; color: string }[]}
                      label={props.label as string}
                      weeks={weeks}
                    />
                  )} />
                  <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600, color: "#7A685F" }} />
                  <Line
                    type="monotone" dataKey="Attended" name="Attended"
                    stroke="#4F8A5B" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#4F8A5B", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone" dataKey="Missed" name="Missed"
                    stroke="#C94F4F" strokeWidth={2.5}
                    dot={{ r: 4, fill: "#C94F4F", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>

              {/* Week date range pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                {weeks.map(w => (
                  <div key={w.short}
                    className="text-[10px] font-semibold text-[#7A685F] bg-[#F5F1E8] rounded-lg px-2.5 py-1 border border-[#E8E1D5]">
                    <span className="font-black text-[#2B1A14]">{w.short}</span>
                    {" · "}
                    {w.start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    {" – "}
                    {w.end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                ))}
              </div>
            </>
          )}
      </ChartCard>

      {/* ── Monthly trend — last 12 months ── */}
      <ChartCard
        title="Monthly Session Trend"
        subtitle="Attended vs Missed — last 12 months"
      >
        {!chartsReady ? <ChartSkeleton height={220} /> :
          !hasMonthlyData ? <EmptyChart message="No session data found" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E1D5" vertical={false} />
                <XAxis dataKey="month" {...axisProps}
                  tickFormatter={(v: string) => {
                    const idx = monthlyData.findIndex(m => m.month === v);
                    return idx % 2 === 0 ? v : "";
                  }}
                />
                <YAxis {...axisProps} allowDecimals={false} />
                <Tooltip content={(props) => (
                  <ChartTooltip
                    active={props.active}
                    payload={props.payload as unknown as { name: string; value: number; color: string }[]}
                    label={props.label as string}
                  />
                )} cursor={{ fill: "#F5F1E8" }} />
                <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600, color: "#7A685F" }} />
                <Bar dataKey="attended" name="Attended" fill="#4F8A5B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="missed"   name="Missed"   fill="#C94F4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
      </ChartCard>

    </div>
  );
}