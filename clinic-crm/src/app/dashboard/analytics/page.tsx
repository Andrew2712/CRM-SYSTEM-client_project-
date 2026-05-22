"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  AreaChart, Area, LineChart, Line,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Sector,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type Appointment = {
  id: string; startTime: string; endTime: string;
  status: string; sessionType: string; notes?: string;
  patient: { id: string; name: string; patientCode: string };
  doctor:  { id: string; name: string };
};

type DoctorPerf = {
  id: string; name: string;
  total: number; attended: number; cancelled: number; missed: number;
  attendanceRate: number; cancellationRate: number;
};

type WeekRow = {
  week: string; label: string;
  total: number; attended: number; cancelled: number; missed: number;
};

type AnalyticsData = {
  booked: number; attended: number; cancelled: number;
  rescheduled: number; missed: number; confirmed: number; conducted: number;
  attendanceRate: number; missRate: number; cancelRate: number;
  totalPatients: number; newPatients: number; returning: number;
  sessionTypes:       { sessionType: string; _count: { sessionType: number } }[];
  weeklyTrend:        WeekRow[];
  monthlyTrend:       { month: string; total: number; attended: number; cancelled: number; missed: number }[];
  genderDistribution: { gender: string; count: number; patients: GenderPatient[] }[];
  phaseDistribution:  { phase: string; count: number; avgSessions: number }[];
  doctorPerformance:  DoctorPerf[];
  weeklyHeatmap:      { day: string; count: number }[];
  appointments:       Appointment[];
  insights:           string[];
  selectedMonth:      string;
};

type GenderPatient = { id: string; name: string; patientCode: string; status: string; age?: number };
type ModalType = "booked" | "cancelled" | "rescheduled" | "missed" | "conducted" | null;

// ─── Theme ────────────────────────────────────────────────────────────────────

const B = {
  primary: "#5B1A0E", accent: "#D46A2E", green: "#16a34a",
  red: "#dc2626", blue: "#2563eb", amber: "#d97706", violet: "#7c3aed",
  bg: "#F5F1E8", text: "#2B1A14", muted: "#7A685F",
};

const STATUS_COLOR: Record<string, string> = {
  ATTENDED: B.green, CANCELLED: B.red, RESCHEDULED: B.violet,
  CONFIRMED: B.blue, MISSED: B.amber,
};
const STATUS_BG: Record<string, string> = {
  ATTENDED:    "bg-green-50 text-green-700 border-green-200",
  CANCELLED:   "bg-red-50 text-red-700 border-red-200",
  RESCHEDULED: "bg-violet-50 text-violet-700 border-violet-200",
  CONFIRMED:   "bg-blue-50 text-blue-700 border-blue-200",
  MISSED:      "bg-amber-50 text-amber-700 border-amber-200",
};
const GENDER_COLORS: Record<string, string> = {
  MALE: "#2563eb", FEMALE: "#db2777", OTHER: "#7c3aed",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeRate(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return "0%";
  return `${v}%`;
}

function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

function monthLabel(value: string): string {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

// ─── PDF / CSV Download ───────────────────────────────────────────────────────

function downloadCSV(data: AnalyticsData, month: string) {
  const label = monthLabel(month);
  const rows: string[][] = [];

  rows.push([`Analytics Report — ${label}`]);
  rows.push([]);

  // Summary
  rows.push(["SUMMARY"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Sessions Booked",       String(data.booked)]);
  rows.push(["Sessions Attended",     String(data.attended)]);
  rows.push(["Sessions Missed",       String(data.missed)]);
  rows.push(["Sessions Cancelled",    String(data.cancelled)]);
  rows.push(["Sessions Rescheduled",  String(data.rescheduled)]);
  rows.push(["Conducted",             String(data.conducted)]);
  rows.push(["Attendance Rate",       safeRate(data.attendanceRate)]);
  rows.push(["No-show Rate",          safeRate(data.missRate)]);
  rows.push(["Cancel Rate",           safeRate(data.cancelRate)]);
  rows.push(["Active Patients",       String(data.totalPatients)]);
  rows.push([]);

  // Weekly trend — FIX: guard with ?? []
  rows.push(["WEEKLY TREND"]);
  rows.push(["Week", "Total", "Attended", "Missed", "Cancelled"]);
  (data.weeklyTrend ?? []).forEach(w => {
    rows.push([w.label, String(w.total), String(w.attended), String(w.missed), String(w.cancelled)]);
  });
  rows.push([]);

  // Session types — FIX: guard with ?? []
  rows.push(["SESSION TYPE BREAKDOWN"]);
  rows.push(["Session Type", "Count"]);
  (data.sessionTypes ?? []).forEach(s => {
    rows.push([s.sessionType.replace(/_/g, " "), String(s._count.sessionType)]);
  });
  rows.push([]);

  // Busiest days — FIX: guard with ?? []
  rows.push(["DAY OF WEEK DISTRIBUTION"]);
  rows.push(["Day", "Sessions"]);
  (data.weeklyHeatmap ?? []).forEach(d => rows.push([d.day, String(d.count)]));
  rows.push([]);

  // Doctor performance — FIX: guard with ?? []
  rows.push(["DOCTOR PERFORMANCE"]);
  rows.push(["Doctor", "Total", "Attended", "Missed", "Cancelled", "Attendance Rate"]);
  (data.doctorPerformance ?? []).forEach(doc => {
    rows.push([doc.name, String(doc.total), String(doc.attended), String(doc.missed), String(doc.cancelled), `${doc.attendanceRate}%`]);
  });
  rows.push([]);

  // Appointments list — FIX: guard with ?? []
  rows.push(["APPOINTMENTS DETAIL"]);
  rows.push(["Patient", "Code", "Doctor", "Date", "Time", "Status", "Session Type", "Notes"]);
  (data.appointments ?? []).forEach(a => {
    const dt = new Date(a.startTime);
    rows.push([
      a.patient.name,
      a.patient.patientCode,
      `Dr. ${a.doctor.name}`,
      dt.toLocaleDateString("en-IN"),
      dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
      a.status,
      a.sessionType.replace(/_/g, " "),
      a.notes ?? "",
    ]);
  });

  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `analytics-${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadTextReport(data: AnalyticsData, month: string) {
  const label = monthLabel(month);
  const line  = "─".repeat(56);
  const lines: string[] = [];

  lines.push(`VYAYAMA-PHYSIO — ANALYTICS REPORT`);
  lines.push(`Period: ${label}`);
  lines.push(line);
  lines.push("");
  lines.push("OVERVIEW");
  lines.push(`  Sessions Booked      : ${data.booked}`);
  lines.push(`  Sessions Attended    : ${data.attended}  (${safeRate(data.attendanceRate)})`);
  lines.push(`  Sessions Missed      : ${data.missed}   (${safeRate(data.missRate)})`);
  lines.push(`  Sessions Cancelled   : ${data.cancelled}  (${safeRate(data.cancelRate)})`);
  lines.push(`  Rescheduled          : ${data.rescheduled}`);
  lines.push(`  Conducted            : ${data.conducted}`);
  lines.push(`  Active Patients      : ${data.totalPatients} (${data.newPatients} new · ${data.returning} returning)`);
  lines.push("");

  // FIX: guard with ?? []
  lines.push("WEEKLY BREAKDOWN");
  (data.weeklyTrend ?? []).forEach(w => {
    lines.push(`  ${w.label.padEnd(28)} Total:${w.total}  Attended:${w.attended}  Missed:${w.missed}  Cancelled:${w.cancelled}`);
  });
  lines.push("");

  // FIX: guard with ?? []
  lines.push("SESSION TYPES");
  (data.sessionTypes ?? []).forEach(s => {
    lines.push(`  ${s.sessionType.replace(/_/g, " ").padEnd(24)} ${s._count.sessionType}`);
  });
  lines.push("");

  // FIX: guard with ?? []
  lines.push("DAY OF WEEK");
  (data.weeklyHeatmap ?? []).forEach(d => {
    lines.push(`  ${d.day.padEnd(6)} ${"█".repeat(Math.min(d.count, 30))} ${d.count}`);
  });
  lines.push("");

  // FIX: guard with ?? []
  lines.push("DOCTOR PERFORMANCE");
  (data.doctorPerformance ?? []).forEach(doc => {
    lines.push(`  ${doc.name.padEnd(24)} Attended:${doc.attended}  Missed:${doc.missed}  Cancelled:${doc.cancelled}  Rate:${doc.attendanceRate}%`);
  });
  lines.push("");

  // FIX: guard with ?? []
  lines.push("APPOINTMENT DETAILS");
  lines.push(`  ${"Patient".padEnd(22)} ${"Code".padEnd(10)} ${"Doctor".padEnd(20)} ${"Date".padEnd(14)} ${"Status".padEnd(14)} Session Type`);
  lines.push("  " + "─".repeat(90));
  (data.appointments ?? []).forEach(a => {
    const dt = new Date(a.startTime);
    lines.push(`  ${a.patient.name.slice(0,22).padEnd(22)} ${a.patient.patientCode.padEnd(10)} ${"Dr. " + a.doctor.name.slice(0,16).padEnd(20)} ${dt.toLocaleDateString("en-IN").padEnd(14)} ${a.status.padEnd(14)} ${a.sessionType.replace(/_/g," ")}`);
  });
  lines.push("");
  lines.push(line);
  lines.push(`Generated: ${new Date().toLocaleString("en-IN")}`);

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `analytics-${month}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Download Button with dropdown ───────────────────────────────────────────

function DownloadButton({ data, month }: { data: AnalyticsData; month: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        style={{ background: B.primary, color: "#fff" }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Report
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Export format</p>
          </div>
          <button
            onClick={() => { downloadCSV(data, month); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: B.green + "15" }}>
              <svg className="w-4 h-4" style={{ color: B.green }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Download CSV</p>
              <p className="text-[10px] text-gray-400">Excel-compatible spreadsheet</p>
            </div>
          </button>
          <button
            onClick={() => { downloadTextReport(data, month); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-50"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: B.blue + "15" }}>
              <svg className="w-4 h-4" style={{ color: B.blue }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Download Text</p>
              <p className="text-[10px] text-gray-400">Formatted plain-text report</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-3 text-xs min-w-[160px]">
      <p className="font-bold text-gray-800 mb-2 truncate max-w-[200px]">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800">{p.value}</span>
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
      <text x={cx} y={cy - 12} textAnchor="middle" style={{ fontSize: 24, fontWeight: 900, fill: B.text }}>{value}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" style={{ fontSize: 11, fontWeight: 600, fill: B.muted }}>{payload.name}</text>
      <text x={cx} y={cy + 27} textAnchor="middle" style={{ fill, fontSize: 12, fontWeight: 700 }}>{(percent * 100).toFixed(0)}%</text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 15} startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, color, icon, onClick, loading }: {
  label: string; value: string | number; sub?: string;
  color: string; icon: React.ReactNode; onClick?: () => void; loading?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={`bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 text-left relative overflow-hidden transition-all group
        ${onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:translate-y-0" : "cursor-default"}`}
      style={{ borderColor: color + "30" }}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 group-hover:opacity-20 transition-opacity"
        style={{ background: color }} />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="w-10 h-10" /><Skeleton className="w-20 h-3" />
          <Skeleton className="w-16 h-7" /><Skeleton className="w-24 h-3" />
        </div>
      ) : (
        <>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3"
            style={{ background: color + "15" }}>
            <div style={{ color }}>{icon}</div>
          </div>
          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-1 text-gray-500">{label}</p>
          <p className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: B.text }}>{value}</p>
          {sub && <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>}
          {onClick && (
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" style={{ color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          )}
        </>
      )}
    </button>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4"
        style={{ background: `linear-gradient(to right, ${B.bg}, white)` }}>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

// ─── Empty Chart ──────────────────────────────────────────────────────────────

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-48 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-400">{message}</p>
      </div>
    </div>
  );
}

// ─── Appointments Modal ───────────────────────────────────────────────────────

function AppointmentsModal({ type, appointments, onClose }: {
  type: ModalType; appointments: Appointment[]; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [sort,   setSort]   = useState<"date-desc" | "date-asc" | "patient">("date-desc");
  const [page,   setPage]   = useState(1);
  const PER_PAGE = 10;

  const statusMap: Record<NonNullable<ModalType>, string[]> = {
    booked:      ["CONFIRMED", "ATTENDED", "MISSED", "CANCELLED", "RESCHEDULED"],
    cancelled:   ["CANCELLED"],
    rescheduled: ["RESCHEDULED"],
    missed:      ["MISSED"],
    conducted:   ["ATTENDED"],
  };
  const titles: Record<NonNullable<ModalType>, string> = {
    booked:      "All Booked Sessions",
    cancelled:   "Cancelled Sessions",
    rescheduled: "Rescheduled Sessions",
    missed:      "Missed / No-show Sessions",
    conducted:   "Conducted Sessions",
  };

  const filtered = useMemo(() => {
    if (!type) return [];
    let list = appointments.filter(a => statusMap[type].includes(a.status));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.patient.name.toLowerCase().includes(q) ||
        a.doctor.name.toLowerCase().includes(q) ||
        a.patient.patientCode.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "date-desc") return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
      if (sort === "date-asc")  return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return a.patient.name.localeCompare(b.patient.name);
    });
  }, [type, appointments, search, sort]);

  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  if (!type) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
          style={{ background: `linear-gradient(to right, ${B.bg}, white)` }}>
          <div>
            <h3 className="font-bold text-gray-800">{titles[type]}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{filtered.length} session{filtered.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3 flex-wrap">
          <div className="flex-1 min-w-[180px] relative">
            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search patient, doctor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-blue-400 transition-colors" />
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as any)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none text-gray-700">
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="patient">By patient</option>
          </select>
        </div>
        <div className="overflow-y-auto flex-1">
          {paginated.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-gray-500">No sessions found</p>
              {search && <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {paginated.map(a => {
                const date = new Date(a.startTime);
                return (
                  <div key={a.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                        style={{ background: STATUS_COLOR[a.status] ?? B.muted }}>
                        {a.patient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-800 truncate">{a.patient.name}</p>
                          <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{a.patient.patientCode}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-gray-500">Dr. {a.doctor.name}</p>
                          <span className="text-gray-300">·</span>
                          <p className="text-xs text-gray-500">
                            {date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {" "}{date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <span className="text-gray-300">·</span>
                          <p className="text-xs text-gray-400">{a.sessionType.replace(/_/g, " ")}</p>
                        </div>
                        {a.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">📝 {a.notes}</p>}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_BG[a.status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">{(page-1)*PER_PAGE+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">← Prev</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const monthOptions = useMemo(() => getMonthOptions(), []);
  const defaultMonth = monthOptions[0].value;

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [data,          setData]          = useState<AnalyticsData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState<ModalType>(null);
  const [activePieIdx,  setActivePieIdx]  = useState(0);
  const [selGender,     setSelGender]     = useState<string | null>(null);
  const [genderPts,     setGenderPts]     = useState<GenderPatient[]>([]);

  const axisProps = {
    axisLine: false as const, tickLine: false as const,
    tick: { fontSize: 11, fill: "#9ca3af", fontWeight: 600 as const },
  };

  const fetchAnalytics = useCallback(async (month: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics?month=${month}`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalytics(selectedMonth);
    // Reset gender drill-in when month changes
    setSelGender(null);
    setGenderPts([]);
  }, [selectedMonth, fetchAnalytics]);

  function handlePieClick(_: any, index: number) {
    if (!data) return;
    const slice = data.genderDistribution[index];
    if (!slice) return;
    if (selGender === slice.gender) { setSelGender(null); setGenderPts([]); }
    else { setSelGender(slice.gender); setGenderPts(slice.patients ?? []); }
    setActivePieIdx(index);
  }

  const d = data;

  const cancelRateStr = safeRate(d?.cancelRate);
  const missRateStr   = safeRate(d?.missRate);
  const attendRate    = safeRate(d?.attendanceRate);

  const outcomeDonut = d ? [
    { name: "Attended",    value: d.attended,    fill: B.green  },
    { name: "Missed",      value: d.missed,      fill: B.amber  },
    { name: "Cancelled",   value: d.cancelled,   fill: B.red    },
    { name: "Rescheduled", value: d.rescheduled, fill: B.violet },
  ].filter(x => x.value > 0) : [];

  // Weekly trend — safe fallback to []
  const weeklyTrendData = (d?.weeklyTrend ?? []).map(w => ({ ...w, weekShort: w.week }));

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-[#F5F1E8]">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                style={{ background: B.primary }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: B.primary }}>Analytics</h1>
            </div>
            <p className="text-xs sm:text-sm ml-[42px] text-gray-500">
              Weekly clinic insights · Click any metric card to view session details
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
            {/* Month selector */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400 cursor-pointer">
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Live badge */}
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 text-xs font-bold shadow-sm"
              style={{ background: B.green + "15", borderColor: B.green + "40", color: B.green }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: B.green }} />
              Live
            </div>

            {/* Download button — only when data is loaded */}
            {!loading && d && <DownloadButton data={d} month={selectedMonth} />}
          </div>
        </div>

        {/* ── Row 1: Core Metric Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <MetricCard loading={loading} label="Sessions Booked" value={d?.booked ?? 0}
            sub="Total this month" color={B.primary}
            onClick={() => setModal("booked")}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          />
          <MetricCard loading={loading} label="Sessions Missed" value={d?.missed ?? 0}
            sub={`${missRateStr} no-show rate`} color={B.amber}
            onClick={() => setModal("missed")}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <MetricCard loading={loading} label="Sessions Cancelled" value={d?.cancelled ?? 0}
            sub={`${cancelRateStr} cancel rate`} color={B.red}
            onClick={() => setModal("cancelled")}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>

        {/* ── Row 2: Secondary Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard loading={loading} label="Rescheduled" value={d?.rescheduled ?? 0}
            sub="Moved appointments" color={B.violet}
            onClick={() => setModal("rescheduled")}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
          />
          <MetricCard loading={loading} label="Conducted" value={d?.conducted ?? 0}
            sub="Attended + upcoming" color={B.blue}
            onClick={() => setModal("conducted")}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
          />
          <MetricCard loading={loading} label="Active Patients" value={d?.totalPatients ?? 0}
            sub={`${d?.newPatients ?? 0} new · ${d?.returning ?? 0} returning`} color={B.accent}
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          />
          <MetricCard loading={loading} label="Confirmed Upcoming" value={d?.confirmed ?? 0}
            sub="Still upcoming" color="#0891b2"
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>

        {/* ── Insight Banners ── */}
        {!loading && d?.insights && d.insights.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.insights.slice(0, 3).map((insight, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex items-start gap-3 shadow-sm">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: [B.green, B.blue, B.accent][i % 3] + "15" }}>
                  <svg className="w-3.5 h-3.5" style={{ color: [B.green, B.blue, B.accent][i % 3] }}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-gray-600 leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Weekly Session Trend Chart ── */}
        <SectionCard
          title="Weekly Session Trends"
          subtitle={`Week-by-week breakdown for ${monthLabel(selectedMonth)} — booked, attended, missed, cancelled`}>
          {loading ? <Skeleton className="h-64 w-full" /> :
            weeklyTrendData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={weeklyTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={B.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={B.primary} stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gAttended" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={B.green} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={B.green} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = weeklyTrendData.find(w => w.week === label);
                      return (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-3 text-xs min-w-[180px]">
                          <p className="font-bold text-gray-800 mb-2">{row?.label ?? label}</p>
                          {payload.map((p: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-4 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                                <span className="text-gray-500">{p.name}</span>
                              </div>
                              <span className="font-bold text-gray-800">{p.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, color: B.muted }} />
                  <Area type="monotone" dataKey="total"     name="Total Booked" stroke={B.primary} fill="url(#gTotal)"    strokeWidth={2.5} dot={{ r: 4, fill: B.primary, strokeWidth: 2, stroke: "#fff" }} />
                  <Area type="monotone" dataKey="attended"  name="Attended"     stroke={B.green}   fill="url(#gAttended)" strokeWidth={2}   dot={{ r: 3, fill: B.green,   strokeWidth: 2, stroke: "#fff" }} />
                  <Line type="monotone" dataKey="missed"    name="Missed"       stroke={B.amber}   strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: B.amber }} />
                  <Line type="monotone" dataKey="cancelled" name="Cancelled"    stroke={B.red}     strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3, fill: B.red }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="No sessions in this month yet" />}
        </SectionCard>

        {/* ── Row 3: Donut + Doctor Performance ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          <SectionCard title="Session Outcome Breakdown" subtitle="Attendance vs missed vs cancelled vs rescheduled">
            {loading ? <Skeleton className="h-48 w-full" /> : outcomeDonut.length > 0 ? (
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie {...({
                        activeIndex: activePieIdx,
                        activeShape: ActivePieShape,
                        data: outcomeDonut,
                        cx: "50%", cy: "50%",
                        innerRadius: 60, outerRadius: 85,
                        dataKey: "value",
                        onMouseEnter: (_: any, index: number) => setActivePieIdx(index),
                      } as any)}>
                        {outcomeDonut.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex sm:flex-col flex-row flex-wrap justify-center gap-3 flex-shrink-0">
                  {outcomeDonut.map(item => {
                    const pct = d!.booked > 0 ? Math.round((item.value / d!.booked) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 min-w-[120px]">
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.fill }} />
                        <div>
                          <p className="text-xs font-bold text-gray-700">{item.name}</p>
                          <p className="text-xs font-semibold" style={{ color: item.fill }}>{item.value} · {pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <EmptyChart message="No session data for this month" />}
          </SectionCard>

          <SectionCard title="Doctor Performance" subtitle={`Sessions per doctor — ${monthLabel(selectedMonth)}`}>
            {loading ? <Skeleton className="h-48 w-full" /> :
              d?.doctorPerformance?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={d.doctorPerformance.slice(0, 6)}
                      margin={{ top: 5, right: 10, left: -10, bottom: 5 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" {...axisProps} tickFormatter={v => v.split(" ")[0]} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600, color: B.muted }} />
                      <Bar dataKey="attended"  name="Attended"  fill={B.green} radius={[4,4,0,0]} />
                      <Bar dataKey="missed"    name="Missed"    fill={B.amber} radius={[4,4,0,0]} />
                      <Bar dataKey="cancelled" name="Cancelled" fill={B.red}   radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {d.doctorPerformance.slice(0, 4).map(doc => (
                      <div key={doc.id} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-600 flex-shrink-0">
                          {doc.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <p className="text-xs font-semibold text-gray-700 w-24 truncate flex-shrink-0">{doc.name}</p>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${doc.attendanceRate}%`, background: doc.attendanceRate >= 80 ? B.green : doc.attendanceRate >= 60 ? B.amber : B.red }} />
                        </div>
                        <span className="text-xs font-bold text-gray-600 w-10 text-right flex-shrink-0">{doc.attendanceRate}%</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <EmptyChart message="No doctor data for this month" />}
          </SectionCard>
        </div>

        {/* ── Row 4: Session Types + Busiest Days ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          <SectionCard title="Session Type Breakdown" subtitle={`Distribution of session categories — ${monthLabel(selectedMonth)}`}>
            {loading ? (
              <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : d?.sessionTypes?.length ? (
              <div className="space-y-4">
                {d.sessionTypes.map((s, i) => {
                  const total = d.sessionTypes.reduce((a, b) => a + b._count.sessionType, 0);
                  const pct   = total > 0 ? Math.round((s._count.sessionType / total) * 100) : 0;
                  const colors = [B.primary, B.blue, B.violet, B.accent, B.green];
                  const c = colors[i % colors.length];
                  return (
                    <div key={s.sessionType}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c }} />
                          <span className="text-sm font-semibold text-gray-700">{s.sessionType.replace(/_/g, " ")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-800">{s._count.sessionType}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-lg text-gray-500 bg-gray-100">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyChart message="No sessions recorded this month" />}
          </SectionCard>

          <SectionCard title="Busiest Days" subtitle={`Day-of-week distribution — ${monthLabel(selectedMonth)}`}>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={d?.weeklyHeatmap ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="day" {...axisProps} />
                    <YAxis {...axisProps} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                    <Bar dataKey="count" name="Sessions" radius={[6,6,0,0]}>
                      {(d?.weeklyHeatmap ?? []).map((entry, i) => {
                        const max = Math.max(...(d?.weeklyHeatmap ?? []).map(x => x.count), 1);
                        const intensity = entry.count / max;
                        const color = entry.count === 0 ? "#e5e7eb"
                          : intensity > 0.7 ? B.primary
                          : intensity > 0.4 ? B.accent
                          : B.green;
                        return <Cell key={i} fill={color} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                {d?.weeklyHeatmap?.every(x => x.count === 0) && (
                  <p className="text-center text-xs text-gray-400 mt-2">No sessions in this month yet</p>
                )}
              </>
            )}
          </SectionCard>
        </div>

        {/* ── Row 5: Gender + Phase ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          <SectionCard title="Gender Distribution"
            subtitle={selGender ? `Showing ${selGender.toLowerCase()} patients — click to clear` : "Click a slice to drill in"}>
            {loading ? <Skeleton className="h-48 w-full" /> : (
              <>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie {...({
                          activeIndex: activePieIdx,
                          activeShape: ActivePieShape,
                          data: (d?.genderDistribution ?? []).map(g => ({
                            name:   g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Other",
                            value:  g.count,
                            gender: g.gender,
                          })),
                          cx: "50%", cy: "50%",
                          innerRadius: 55, outerRadius: 80,
                          dataKey: "value",
                          onClick: handlePieClick,
                          className: "cursor-pointer",
                        } as any)}>
                          {(d?.genderDistribution ?? []).map(g => (
                            <Cell key={g.gender} fill={GENDER_COLORS[g.gender] ?? B.muted} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex sm:flex-col flex-row flex-wrap justify-center gap-2 flex-shrink-0">
                    {(d?.genderDistribution ?? []).map((g, i) => {
                      const pct   = d!.totalPatients > 0 ? Math.round((g.count / d!.totalPatients) * 100) : 0;
                      const color = GENDER_COLORS[g.gender] ?? B.muted;
                      const isSel = selGender === g.gender;
                      return (
                        <button key={g.gender} onClick={() => handlePieClick(null, i)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all text-left min-w-[110px]"
                          style={isSel ? { borderColor: color, background: color + "15" } : { borderColor: "#e5e7eb", background: "white" }}>
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                          <div>
                            <p className="text-xs font-bold text-gray-700">
                              {g.gender === "MALE" ? "Male" : g.gender === "FEMALE" ? "Female" : "Other"}
                            </p>
                            <p className="text-xs font-semibold" style={{ color }}>{g.count} · {pct}%</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selGender && genderPts.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                      {selGender === "MALE" ? "Male" : selGender === "FEMALE" ? "Female" : "Other"} patients ({genderPts.length})
                    </p>
                    <div className="space-y-2 max-h-44 overflow-y-auto">
                      {genderPts.map(p => (
                        <Link key={p.id} href={`/dashboard/patients/${p.id}`}
                          className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                              style={{ background: GENDER_COLORS[selGender] ?? B.muted }}>
                              {p.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-700">{p.name}</p>
                              <p className="text-[10px] font-mono text-gray-400">{p.patientCode}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.age && <span className="text-xs text-gray-400">{p.age}y</span>}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              p.status === "NEW" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}>{p.status}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Phase Distribution" subtitle="Active patients by treatment phase">
            {loading ? <Skeleton className="h-48 w-full" /> :
              d?.phaseDistribution?.length ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={d.phaseDistribution} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="phase" {...axisProps} tickFormatter={v => v.replace("PHASE_", "P")} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                      <Bar dataKey="count"       name="Patients"     fill={B.primary} radius={[4,4,0,0]} />
                      <Bar dataKey="avgSessions" name="Avg Sessions" fill={B.accent}  radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {d.phaseDistribution.map(p => (
                      <div key={p.phase} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-100 bg-gray-50 text-xs">
                        <span className="font-bold text-gray-700">{p.phase.replace("PHASE_", "Phase ")}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">{p.count} patients</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">{p.avgSessions} avg sessions</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-400">No phase data yet</p>
                    <p className="text-xs text-gray-300 mt-1">Assign treatment phases to patients</p>
                  </div>
                </div>
              )}
          </SectionCard>
        </div>

        {/* ── Monthly Summary Strip ── */}
        {!loading && d && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-gray-800">Monthly Summary — {monthLabel(selectedMonth)}</h2>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
              {[
                { label: "Patients",  value: d.totalPatients,            color: B.primary },
                { label: "Booked",    value: d.booked,                   color: B.accent  },
                { label: "Conducted", value: d.conducted,                color: B.blue    },
                { label: "Missed",    value: d.missed,                   color: B.amber   },
                { label: "Attend %",  value: safeRate(d.attendanceRate), color: B.green   },
                { label: "No-show %", value: safeRate(d.missRate),       color: B.red     },
              ].map(s => (
                <div key={s.label} className="text-center p-3 sm:p-4 rounded-2xl border border-gray-100 bg-gray-50">
                  <p className="text-xl sm:text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mt-1 text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Drilldown Modal ── */}
      {modal && d && (
        <AppointmentsModal
          type={modal}
          appointments={d.appointments ?? []}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}