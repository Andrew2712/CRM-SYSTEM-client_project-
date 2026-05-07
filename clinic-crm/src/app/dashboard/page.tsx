// src/app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Patient = {
  id: string;
  name: string;
  patientCode: string;
  status: "NEW" | "RETURNING";
  _count?: { appointments: number };
};

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "ATTENDED" | "MISSED" | "CANCELLED";
  sessionType: string;
  patient: Patient & { _count?: { appointments: number } };
  doctor: { name: string };
};

type DashboardData = {
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  todayTotal: number;
  missedWeek: number;
  confirmedUpcoming: number;
  todayAppointments: Appointment[];
  recentAppointments: Appointment[];
  weekCounts: number[];
  allPatients: Patient[];
};

type ActiveFilter =
  | null
  | "total"
  | "new"
  | "returning"
  | "sessions"
  | "noshow"
  | "newvsreturning"
  | `day-${number}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function toAppointmentArray(raw: unknown): Appointment[] {
  if (Array.isArray(raw)) return raw as Appointment[];
  return [];
}
function toPatientArray(raw: unknown): Patient[] {
  if (Array.isArray(raw)) return raw as Patient[];
  return [];
}

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getTodayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

const STATUS_CONFIG: Record<string, { pill: string; dot: string; label: string }> = {
  ATTENDED:  { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Attended" },
  MISSED:    { pill: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-500",     label: "Missed" },
  CONFIRMED: { pill: "bg-sky-50 text-sky-700 border border-sky-200",             dot: "bg-sky-500",     label: "Confirmed" },
  CANCELLED: { pill: "bg-gray-100 text-gray-500 border border-gray-200",         dot: "bg-gray-400",    label: "Cancelled" },
};

// Brand colors from globals.css
const BRAND = {
  primary: "#5B1A0E",
  accent:  "#D46A2E",
  bg:      "#F5F1E8",
  border:  "#E8E0D0",
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "bg-teal-100 text-teal-700",
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div className={`${sz} ${color} rounded-xl flex items-center justify-center font-black flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, isNow }: { status: string; isNow?: boolean }) {
  if (isNow) return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      In Progress
    </span>
  );
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.CANCELLED;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${cfg.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Filter Panel ─────────────────────────────────────────────────────────────

function FilterPanel({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border shadow-lg overflow-hidden mb-5" style={{ borderColor: BRAND.border }}>
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex items-center justify-between" style={{ borderColor: BRAND.border, background: `linear-gradient(to right, ${BRAND.bg}, white)` }}>
        <div>
          <h2 className="text-sm sm:text-base font-bold" style={{ color: BRAND.primary }}>{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all flex-shrink-0">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      <div className="p-4 sm:p-6 overflow-x-auto">{children}</div>
    </div>
  );
}

// ─── Patient Table ────────────────────────────────────────────────────────────

function PatientTable({ patients, filterStatus }: {
  patients: Patient[]; filterStatus?: "NEW" | "RETURNING";
}) {
  const safePatients = Array.isArray(patients) ? patients : [];
  const list = filterStatus ? safePatients.filter(p => p.status === filterStatus) : safePatients;

  if (list.length === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold text-slate-400">No patients found</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px]">
        <thead>
          <tr className="border-b" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
            {["Patient ID", "Name", "Status", "Sessions", ""].map(h => (
              <th key={h} className="text-left px-3 sm:px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((p, idx) => (
            <tr key={p.id}
              className={`border-b last:border-0 transition-colors ${idx % 2 === 0 ? "bg-white" : ""}`}
              style={{ borderColor: BRAND.border }}>
              <td className="px-3 sm:px-4 py-3">
                <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{p.patientCode}</span>
              </td>
              <td className="px-3 sm:px-4 py-3">
                <div className="flex items-center gap-2">
                  <Avatar name={p.name} size="sm" />
                  <span className="text-sm font-bold text-slate-800">{p.name}</span>
                </div>
              </td>
              <td className="px-3 sm:px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  p.status === "NEW" ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-red-50 text-red-600 border border-red-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === "NEW" ? "bg-sky-500" : "bg-red-400"}`} />
                  {p.status === "NEW" ? "New" : "Returning"}
                </span>
              </td>
              <td className="px-3 sm:px-4 py-3">
                <span className="text-sm font-bold text-slate-700">{p._count?.appointments ?? "—"}</span>
              </td>
              <td className="px-3 sm:px-4 py-3">
                <Link href={`/dashboard/patients/${p.id}`}
                  className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 px-3 py-1.5 rounded-lg transition-all w-fit">
                  View
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Session Table ────────────────────────────────────────────────────────────

function SessionTable({ appointments }: { appointments: Appointment[] }) {
  const now = new Date();
  const safeAppointments = Array.isArray(appointments) ? appointments : [];

  if (safeAppointments.length === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold text-slate-400">No sessions found</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px]">
        <thead>
          <tr className="border-b" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
            {["Time", "Patient", "Doctor", "Type", "Status"].map(h => (
              <th key={h} className="text-left px-3 sm:px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {safeAppointments.map((a, idx) => {
            const isNow = new Date(a.startTime) <= now && new Date(a.endTime) >= now;
            return (
              <tr key={a.id}
                className={`border-b last:border-0 transition-colors ${idx % 2 === 0 ? "bg-white" : ""}`}
                style={{ borderColor: BRAND.border }}>
                <td className="px-3 sm:px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">{fmtTime(a.startTime)}</span>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={a.patient.name} size="sm" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">{a.patient.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{a.patient.patientCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className="text-xs font-medium text-slate-600">{a.doctor.name}</span>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg whitespace-nowrap">
                    {a.sessionType.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-3 sm:px-4 py-3">
                  <StatusPill status={a.status} isNow={isNow} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(raw => {
        setData({
          ...raw,
          todayAppointments:  toAppointmentArray(raw.todayAppointments),
          recentAppointments: toAppointmentArray(raw.recentAppointments),
          allPatients:        toPatientArray(raw.allPatients),
          weekCounts: Array.isArray(raw.weekCounts) ? raw.weekCounts : [0,0,0,0,0,0,0],
        });
      })
      .catch(console.error);
  }, []);

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.bg }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.accent, borderTopColor: "transparent" }} />
        <p className="text-sm font-medium text-slate-400">Loading dashboard…</p>
      </div>
    </div>
  );

  const {
    totalPatients, newPatients, returningPatients,
    todayTotal, missedWeek,
    todayAppointments, recentAppointments,
    weekCounts, allPatients,
  } = data;

  const maxCount    = Math.max(...weekCounts, 1);
  const todayIndex  = getTodayIndex();
  const peakCount   = Math.max(...weekCounts);
  const peakIndex   = weekCounts[todayIndex] === peakCount ? todayIndex : weekCounts.indexOf(peakCount);
  const noShowRate  = todayTotal > 0 ? ((missedWeek / todayTotal) * 100).toFixed(1) : "0.0";
  const noShowReasons = [
    { label: "No-call",     count: Math.round(missedWeek * 0.5),  color: "bg-red-400" },
    { label: "Late cancel", count: Math.round(missedWeek * 0.33), color: "bg-amber-400" },
    { label: "Emergency",   count: Math.round(missedWeek * 0.17), color: "bg-emerald-400" },
  ];

  const todayAttended = todayAppointments.filter(a => a.status === "ATTENDED").length;
  const todayMissed   = todayAppointments.filter(a => a.status === "MISSED").length;
  const todayPending  = todayAppointments.filter(a => a.status === "CONFIRMED").length;

  function toggleFilter(f: ActiveFilter) {
    setActiveFilter(prev => prev === f ? null : f);
    setSelectedDay(null);
  }

  async function handleBarClick(dayIndex: number) {
    const key = `day-${dayIndex}` as ActiveFilter;
    if (activeFilter === key) { setActiveFilter(null); setSelectedDay(null); return; }
    setActiveFilter(key);
    setSelectedDay(dayIndex);
    setLoadingDay(true);

    const today = new Date();
    const currentDay = today.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const d = new Date(monday);
    d.setDate(monday.getDate() + dayIndex);
    d.setHours(0, 0, 0, 0);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    next.setHours(0, 0, 0, 0);

    try {
      const res = await fetch(`/api/admin/appointments?from=${d.toISOString()}&to=${next.toISOString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      setDayAppointments(toAppointmentArray(raw.data));
    } catch {
      setDayAppointments([]);
    } finally {
      setLoadingDay(false);
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: BRAND.bg }}>
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                style={{ background: BRAND.primary }}>
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: BRAND.primary }}>
                Admin Dashboard
              </h1>
            </div>
            <p className="text-sm text-slate-400 ml-[42px]">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" · "}Weekly overview
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            <Link href="/dashboard/signup"
              className="flex items-center gap-1.5 sm:gap-2 bg-white border text-slate-600 hover:text-slate-800 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold shadow-sm transition-all"
              style={{ borderColor: BRAND.border }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Sign Up
            </Link>
            <Link href="/dashboard/reset-password"
              className="flex items-center gap-1.5 sm:gap-2 bg-white border text-slate-600 hover:text-slate-800 rounded-xl px-3 sm:px-3.5 py-2 text-xs font-bold shadow-sm transition-all"
              style={{ borderColor: BRAND.border }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Reset Password
            </Link>
          </div>
        </div>

        {/* ── Stat cards: 1 col mobile → 2 col tablet → 4 col desktop ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

          {/* Total Patients */}
          <button onClick={() => toggleFilter("total")}
            className={`text-left rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-sm ${
              activeFilter === "total" ? "shadow-lg" : "bg-white hover:shadow-md"
            }`}
            style={activeFilter === "total"
              ? { background: BRAND.primary, borderColor: BRAND.primary }
              : { borderColor: BRAND.border }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: activeFilter === "total" ? "rgba(255,255,255,0.15)" : "#F5F1E8" }}>
              <svg className="w-5 h-5" style={{ color: activeFilter === "total" ? "white" : BRAND.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "total" ? "text-white/70" : "text-slate-400"}`}>Total Patients</p>
            <p className={`text-3xl sm:text-4xl font-black tracking-tight ${activeFilter === "total" ? "text-white" : "text-slate-900"}`}>{totalPatients}</p>
            <p className={`text-xs font-semibold mt-2`} style={{ color: activeFilter === "total" ? "rgba(255,255,255,0.8)" : BRAND.accent }}>
              +{newPatients} new this week
            </p>
          </button>

          {/* Sessions Today */}
          <button onClick={() => toggleFilter("sessions")}
            className={`text-left rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-sm ${
              activeFilter === "sessions" ? "shadow-lg" : "bg-white hover:shadow-md"
            }`}
            style={activeFilter === "sessions"
              ? { background: BRAND.primary, borderColor: BRAND.primary }
              : { borderColor: BRAND.border }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: activeFilter === "sessions" ? "rgba(255,255,255,0.15)" : "#F5F1E8" }}>
              <svg className="w-5 h-5" style={{ color: activeFilter === "sessions" ? "white" : BRAND.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "sessions" ? "text-white/70" : "text-slate-400"}`}>Sessions Today</p>
            <p className={`text-3xl sm:text-4xl font-black tracking-tight ${activeFilter === "sessions" ? "text-white" : "text-slate-900"}`}>{todayTotal}</p>
            <p className={`text-xs font-semibold mt-2 ${activeFilter === "sessions" ? "text-white/70" : "text-slate-400"}`}>{todayPending} remaining today</p>
          </button>

          {/* No-shows */}
          <button onClick={() => toggleFilter("noshow")}
            className={`text-left rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-sm ${
              activeFilter === "noshow" ? "shadow-lg shadow-red-100" : "bg-white hover:shadow-md"
            }`}
            style={activeFilter === "noshow"
              ? { background: "#C0392B", borderColor: "#C0392B" }
              : { borderColor: BRAND.border }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: activeFilter === "noshow" ? "rgba(255,255,255,0.15)" : "#FCECEA" }}>
              <svg className="w-5 h-5" style={{ color: activeFilter === "noshow" ? "white" : "#C0392B" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "noshow" ? "text-white/70" : "text-slate-400"}`}>No-shows This Week</p>
            <p className={`text-3xl sm:text-4xl font-black tracking-tight ${activeFilter === "noshow" ? "text-white" : "text-slate-900"}`}>{missedWeek}</p>
            <p className={`text-xs font-semibold mt-2`} style={{ color: activeFilter === "noshow" ? "rgba(255,255,255,0.8)" : "#C0392B" }}>{noShowRate}% no-show rate</p>
          </button>

          {/* New vs Returning */}
          <button onClick={() => toggleFilter("newvsreturning")}
            className={`text-left rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-sm ${
              activeFilter === "newvsreturning" ? "shadow-lg" : "bg-white hover:shadow-md"
            }`}
            style={activeFilter === "newvsreturning"
              ? { background: BRAND.primary, borderColor: BRAND.primary }
              : { borderColor: BRAND.border }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
              style={{ background: activeFilter === "newvsreturning" ? "rgba(255,255,255,0.15)" : "#F5F1E8" }}>
              <svg className="w-5 h-5" style={{ color: activeFilter === "newvsreturning" ? "white" : BRAND.accent }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "newvsreturning" ? "text-white/70" : "text-slate-400"}`}>New vs Returning</p>
            <p className={`text-3xl sm:text-4xl font-black tracking-tight ${activeFilter === "newvsreturning" ? "text-white" : "text-slate-900"}`}>
              {newPatients}
              <span className={`text-xl sm:text-2xl font-medium ${activeFilter === "newvsreturning" ? "text-white/40" : "text-slate-300"}`}> / </span>
              {returningPatients}
            </p>
            <p className={`text-xs font-semibold mt-2 ${activeFilter === "newvsreturning" ? "text-white/70" : "text-slate-400"}`}>
              {totalPatients > 0 ? Math.round((newPatients / totalPatients) * 100) : 0}% new patients
            </p>
          </button>
        </div>

        {/* ── Filter Panels ── */}
        {activeFilter === "total" && (
          <FilterPanel title="All Patients" subtitle={`${totalPatients} registered patients`} onClose={() => setActiveFilter(null)}>
            <PatientTable patients={allPatients} />
          </FilterPanel>
        )}
        {activeFilter === "sessions" && (
          <FilterPanel title="Today's Sessions" subtitle={`${todayTotal} total · ${todayPending} pending`} onClose={() => setActiveFilter(null)}>
            <SessionTable appointments={todayAppointments} />
          </FilterPanel>
        )}
        {activeFilter === "noshow" && (
          <FilterPanel title="No-show Appointments This Week" subtitle={`${missedWeek} missed sessions`} onClose={() => setActiveFilter(null)}>
            <SessionTable appointments={recentAppointments.filter(a => a.status === "MISSED")} />
          </FilterPanel>
        )}
        {activeFilter === "newvsreturning" && (
          <FilterPanel title="New vs Returning Patients" subtitle={`${newPatients} new · ${returningPatients} returning`} onClose={() => setActiveFilter(null)}>
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />{newPatients} New
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{returningPatients} Returning
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-sky-600 uppercase tracking-widest mb-3">New Patients</p>
                <PatientTable patients={allPatients} filterStatus="NEW" />
              </div>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">Returning Patients</p>
                <PatientTable patients={allPatients} filterStatus="RETURNING" />
              </div>
            </div>
          </FilterPanel>
        )}
        {selectedDay !== null && activeFilter === `day-${selectedDay}` && (
          <FilterPanel
            title={`${weekDays[selectedDay]}'s Sessions`}
            subtitle={`${weekCounts[selectedDay]} total session${weekCounts[selectedDay] !== 1 ? "s" : ""}`}
            onClose={() => { setActiveFilter(null); setSelectedDay(null); }}>
            {loadingDay ? (
              <div className="flex items-center justify-center py-10 gap-3">
                <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BRAND.accent, borderTopColor: "transparent" }} />
                <p className="text-sm text-slate-400 font-medium">Loading…</p>
              </div>
            ) : (
              <SessionTable appointments={dayAppointments} />
            )}
          </FilterPanel>
        )}

        {/* ── Middle row: 1 col mobile → 2 col desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">

          {/* Today's Sessions */}
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BRAND.border }}>
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: BRAND.border }}>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Today's Sessions</h2>
                <p className="text-xs text-slate-400 mt-0.5">{todayTotal} total</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {todayTotal > 0 && (
                  <div className="flex items-center gap-2 border rounded-xl px-3 py-1.5" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                    <div className="flex gap-1">
                      {todayAttended > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" />}
                      {todayMissed > 0  && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5" />}
                      {todayPending > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-0.5" />}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{todayAttended + todayMissed}/{todayTotal} done</span>
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-400 border rounded-xl px-3 py-1.5" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                  {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              </div>
            </div>

            {todayAppointments.length === 0 ? (
              <div className="py-12 sm:py-16 text-center">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: BRAND.bg }}>
                  <svg className="w-5 sm:w-6 h-5 sm:h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-400">No sessions today</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[380px]">
                  <thead>
                    <tr className="border-b" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                      {["Time", "Patient", "Type", "Status"].map(h => (
                        <th key={h} className="text-left px-4 sm:px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayAppointments.map((a, idx) => {
                      const now = new Date();
                      const isNow = new Date(a.startTime) <= now && new Date(a.endTime) >= now;
                      return (
                        <tr key={a.id}
                          className={`border-b last:border-0 transition-colors ${idx % 2 === 0 ? "bg-white" : ""}`}
                          style={{ borderColor: BRAND.border }}>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                            <span className="text-sm font-bold text-slate-700">{fmtTime(a.startTime)}</span>
                          </td>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                            <div className="flex items-center gap-2">
                              <Avatar name={a.patient.name} size="sm" />
                              <span className="text-xs sm:text-sm font-bold text-slate-800">{a.patient.name}</span>
                            </div>
                          </td>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg whitespace-nowrap">
                              {a.sessionType.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3 sm:py-3.5">
                            <StatusPill status={a.status} isNow={isNow} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Weekly Trend */}
          <div className="bg-white rounded-2xl border shadow-sm p-4 sm:p-6" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Weekly Session Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">Click a bar to see that day's sessions</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 border rounded-xl px-3 py-1.5" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                {weekCounts.reduce((a, b) => a + b, 0)} this week
              </span>
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-1.5 sm:gap-2 h-24 sm:h-32 mb-2">
              {weekCounts.map((count, i) => {
                const isToday    = i === todayIndex;
                const isSelected = activeFilter === `day-${i}`;
                const isPeak     = i === peakIndex && !isToday;

                let barColor: string;
                if      (isSelected) barColor = BRAND.primary;
                else if (isToday)    barColor = BRAND.accent;
                else if (isPeak)     barColor = "#D46A2E99";
                else if (count > 0)  barColor = "#E8D5C4";
                else                 barColor = "#F5F1E8";

                return (
                  <button key={i} onClick={() => handleBarClick(i)}
                    className="flex-1 flex flex-col items-center gap-1 group focus:outline-none"
                    title={`${weekDays[i]}: ${count} session${count !== 1 ? "s" : ""}${isToday ? " (today)" : ""}`}>
                    <span className="text-[10px] sm:text-xs font-bold text-slate-400 mb-1">{count > 0 ? count : ""}</span>
                    <div
                      className="w-full rounded-t-xl transition-all group-hover:opacity-75"
                      style={{
                        height: `${Math.max((count / maxCount) * 96, count > 0 ? 8 : 0)}px`,
                        background: barColor,
                        outline: (isSelected || isToday) ? `2px solid ${isSelected ? BRAND.primary : BRAND.accent}` : "none",
                        outlineOffset: "1px",
                      }}
                    />
                    <div className="flex flex-col items-center gap-0.5 mt-1">
                      <span className={`text-[10px] sm:text-xs font-bold`}
                        style={{ color: isToday ? BRAND.accent : isSelected ? BRAND.primary : "#94a3b8" }}>
                        {weekDays[i]}
                      </span>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND.accent }} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400 mb-4 sm:mb-5">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md" style={{ background: BRAND.accent }} />Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md" style={{ background: "#D46A2E99" }} />Peak
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md" style={{ background: "#E8D5C4" }} />Active
              </span>
            </div>

            {/* No-show reasons */}
            <div className="rounded-2xl p-3 sm:p-4 border" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: BRAND.primary }}>No-show Reasons</h3>
                <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">{missedWeek} total</span>
              </div>
              <div className="space-y-2.5 sm:space-y-3">
                {noShowReasons.map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600 w-20 sm:w-24 flex-shrink-0">{r.label}</span>
                    <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden border border-slate-100">
                      <div className={`h-full rounded-full transition-all ${r.color}`}
                        style={{ width: missedWeek > 0 ? `${(r.count / missedWeek) * 100}%` : "0%" }} />
                    </div>
                    <span className="text-xs font-black text-slate-600 w-4 text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Patient Activity ── */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BRAND.border }}>
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b flex flex-wrap items-center justify-between gap-3"
            style={{ borderColor: BRAND.border, background: `linear-gradient(to right, ${BRAND.bg}, white)` }}>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Recent Patient Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Click any row to view patient profile</p>
            </div>
            <Link href="/dashboard/patients"
              className="flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 sm:px-3.5 py-2 transition-all border"
              style={{ color: BRAND.primary, background: BRAND.bg, borderColor: BRAND.border }}>
              View all patients
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr className="border-b" style={{ background: BRAND.bg, borderColor: BRAND.border }}>
                  {["Patient ID", "Name", "Last Visit", "Sessions", "Status"].map(h => (
                    <th key={h} className="text-left px-4 sm:px-5 py-3 sm:py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">
                      No recent activity
                    </td>
                  </tr>
                ) : recentAppointments.map((a, idx) => (
                  <tr
                    key={a.id}
                    onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}
                    className={`border-b last:border-0 cursor-pointer transition-all group ${idx % 2 === 0 ? "bg-white" : ""}`}
                    style={{ borderColor: BRAND.border }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = "#F5F1E8";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "white" : "";
                    }}
                  >
                    <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                      <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                        {a.patient.patientCode}
                      </span>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                      <div className="flex items-center gap-2 sm:gap-2.5">
                        <Avatar name={a.patient.name} size="sm" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-[#5B1A0E] transition-colors">
                          {a.patient.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                      <span className="text-sm font-semibold text-slate-600">{fmtDate(a.startTime)}</span>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                      <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs font-black text-slate-600">{a.patient._count?.appointments ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 sm:py-4">
                      <div className="flex items-center justify-between gap-3">
                        <StatusPill status={a.status} />
                        <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#D46A2E] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}