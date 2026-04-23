"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

/** Safely coerce an unknown API response to Appointment[] */
function toAppointmentArray(raw: unknown): Appointment[] {
  if (Array.isArray(raw)) return raw as Appointment[];
  return [];
}

/** Safely coerce an unknown API response to Patient[] */
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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-100/50 overflow-hidden mb-5">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl transition-all">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─── Patient Table ────────────────────────────────────────────────────────────

function PatientTable({ patients, filterStatus }: {
  patients: Patient[]; filterStatus?: "NEW" | "RETURNING";
}) {
  // ✅ FIX: guard against non-array
  const safePatients = Array.isArray(patients) ? patients : [];
  const list = filterStatus ? safePatients.filter(p => p.status === filterStatus) : safePatients;

  if (list.length === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold text-slate-400">No patients found</p>
    </div>
  );
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/80 border-b border-slate-100">
          {["Patient ID", "Name", "Status", "Sessions", ""].map(h => (
            <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {list.map((p, idx) => (
          <tr key={p.id}
            className={`border-b border-slate-50 last:border-0 hover:bg-teal-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}>
            <td className="px-4 py-3.5">
              <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{p.patientCode}</span>
            </td>
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <Avatar name={p.name} size="sm" />
                <span className="text-sm font-bold text-slate-800">{p.name}</span>
              </div>
            </td>
            <td className="px-4 py-3.5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                p.status === "NEW"
                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                  : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${p.status === "NEW" ? "bg-sky-500" : "bg-red-400"}`} />
                {p.status === "NEW" ? "New" : "Returning"}
              </span>
            </td>
            <td className="px-4 py-3.5">
              <span className="text-sm font-bold text-slate-700">{p._count?.appointments ?? "—"}</span>
            </td>
            <td className="px-4 py-3.5">
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
  );
}

// ─── Session Table ────────────────────────────────────────────────────────────

function SessionTable({ appointments }: { appointments: Appointment[] }) {
  const now = new Date();

  // ✅ FIX: guard against non-array — this was the crash site
  const safeAppointments = Array.isArray(appointments) ? appointments : [];

  if (safeAppointments.length === 0) return (
    <div className="py-10 text-center">
      <p className="text-sm font-semibold text-slate-400">No sessions found</p>
    </div>
  );
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-slate-50/80 border-b border-slate-100">
          {["Time", "Patient", "Doctor", "Type", "Status"].map(h => (
            <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {safeAppointments.map((a, idx) => {
          const isNow = new Date(a.startTime) <= now && new Date(a.endTime) >= now;
          return (
            <tr key={a.id}
              className={`border-b border-slate-50 last:border-0 hover:bg-teal-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}>
              <td className="px-4 py-3.5">
                <span className="text-sm font-semibold text-slate-700">{fmtTime(a.startTime)}</span>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.patient.name} size="sm" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{a.patient.name}</p>
                    <p className="text-xs font-mono text-slate-400">{a.patient.patientCode}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <span className="text-xs font-medium text-slate-600">{a.doctor.name}</span>
              </td>
              <td className="px-4 py-3.5">
                <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {a.sessionType.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3.5">
                <StatusPill status={a.status} isNow={isNow} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(raw => {
        // ✅ FIX: normalise every array field coming from the API
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Loading dashboard…</p>
      </div>
    </div>
  );

  const {
    totalPatients, newPatients, returningPatients,
    todayTotal, missedWeek,
    todayAppointments, recentAppointments,
    weekCounts, allPatients,
  } = data;

  const maxCount = Math.max(...weekCounts, 1);
  const todayIndex = getTodayIndex();
  const peakCount = Math.max(...weekCounts);
  const peakIndex = weekCounts[todayIndex] === peakCount
    ? todayIndex
    : weekCounts.indexOf(peakCount);

  const noShowRate = todayTotal > 0 ? ((missedWeek / todayTotal) * 100).toFixed(1) : "0.0";
  const noShowReasons = [
    { label: "No-call",     count: Math.round(missedWeek * 0.5),  color: "bg-red-400" },
    { label: "Late cancel", count: Math.round(missedWeek * 0.33), color: "bg-amber-400" },
    { label: "Emergency",   count: Math.round(missedWeek * 0.17), color: "bg-emerald-400" },
  ];

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
    setDayAppointments(toAppointmentArray(raw.data)); // ✅ unwrap .data
  } catch {
    setDayAppointments([]);
  } finally {
    setLoadingDay(false);
  }
}

  const todayAttended = todayAppointments.filter(a => a.status === "ATTENDED").length;
  const todayMissed   = todayAppointments.filter(a => a.status === "MISSED").length;
  const todayPending  = todayAppointments.filter(a => a.status === "CONFIRMED").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Dashboard</h1>
            </div>
            <p className="text-sm text-slate-400 ml-[42px]">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {" · "}Weekly overview
            </p>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Live
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-4 gap-4">
          {/* Total Patients */}
          <button onClick={() => toggleFilter("total")}
            className={`text-left rounded-2xl p-5 border-2 transition-all ${
              activeFilter === "total"
                ? "bg-teal-600 border-teal-600 shadow-lg shadow-teal-200"
                : "bg-white border-slate-100 hover:border-teal-200 hover:shadow-md shadow-sm"
            }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${activeFilter === "total" ? "bg-white/20" : "bg-teal-50"}`}>
              <svg className={`w-5 h-5 ${activeFilter === "total" ? "text-white" : "text-teal-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "total" ? "text-teal-100" : "text-slate-400"}`}>Total Patients</p>
            <p className={`text-4xl font-black tracking-tight ${activeFilter === "total" ? "text-white" : "text-slate-900"}`}>{totalPatients}</p>
            <p className={`text-xs font-semibold mt-2 ${activeFilter === "total" ? "text-teal-200" : "text-teal-600"}`}>+{newPatients} new this week</p>
          </button>

          {/* Sessions Today */}
          <button onClick={() => toggleFilter("sessions")}
            className={`text-left rounded-2xl p-5 border-2 transition-all ${
              activeFilter === "sessions"
                ? "bg-teal-600 border-teal-600 shadow-lg shadow-teal-200"
                : "bg-white border-slate-100 hover:border-teal-200 hover:shadow-md shadow-sm"
            }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${activeFilter === "sessions" ? "bg-white/20" : "bg-blue-50"}`}>
              <svg className={`w-5 h-5 ${activeFilter === "sessions" ? "text-white" : "text-blue-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "sessions" ? "text-teal-100" : "text-slate-400"}`}>Sessions Today</p>
            <p className={`text-4xl font-black tracking-tight ${activeFilter === "sessions" ? "text-white" : "text-slate-900"}`}>{todayTotal}</p>
            <p className={`text-xs font-semibold mt-2 ${activeFilter === "sessions" ? "text-teal-200" : "text-slate-400"}`}>{todayPending} remaining today</p>
          </button>

          {/* No-shows */}
          <button onClick={() => toggleFilter("noshow")}
            className={`text-left rounded-2xl p-5 border-2 transition-all ${
              activeFilter === "noshow"
                ? "bg-red-500 border-red-500 shadow-lg shadow-red-100"
                : "bg-white border-slate-100 hover:border-red-200 hover:shadow-md shadow-sm"
            }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${activeFilter === "noshow" ? "bg-white/20" : "bg-red-50"}`}>
              <svg className={`w-5 h-5 ${activeFilter === "noshow" ? "text-white" : "text-red-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "noshow" ? "text-red-100" : "text-slate-400"}`}>No-shows This Week</p>
            <p className={`text-4xl font-black tracking-tight ${activeFilter === "noshow" ? "text-white" : "text-slate-900"}`}>{missedWeek}</p>
            <p className={`text-xs font-semibold mt-2 ${activeFilter === "noshow" ? "text-red-200" : "text-red-500"}`}>{noShowRate}% no-show rate</p>
          </button>

          {/* New vs Returning */}
          <button onClick={() => toggleFilter("newvsreturning")}
            className={`text-left rounded-2xl p-5 border-2 transition-all ${
              activeFilter === "newvsreturning"
                ? "bg-teal-600 border-teal-600 shadow-lg shadow-teal-200"
                : "bg-white border-slate-100 hover:border-teal-200 hover:shadow-md shadow-sm"
            }`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${activeFilter === "newvsreturning" ? "bg-white/20" : "bg-violet-50"}`}>
              <svg className={`w-5 h-5 ${activeFilter === "newvsreturning" ? "text-white" : "text-violet-600"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${activeFilter === "newvsreturning" ? "text-teal-100" : "text-slate-400"}`}>New vs Returning</p>
            <p className={`text-4xl font-black tracking-tight ${activeFilter === "newvsreturning" ? "text-white" : "text-slate-900"}`}>
              {newPatients}
              <span className={`text-2xl font-medium ${activeFilter === "newvsreturning" ? "text-teal-300" : "text-slate-300"}`}> / </span>
              {returningPatients}
            </p>
            <p className={`text-xs font-semibold mt-2 ${activeFilter === "newvsreturning" ? "text-teal-200" : "text-slate-400"}`}>
              {totalPatients > 0 ? Math.round((newPatients / totalPatients) * 100) : 0}% new patients
            </p>
          </button>
        </div>

        {/* ── Filter panels ── */}
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
          <FilterPanel
            title="New vs Returning Patients"
            subtitle={`${newPatients} new · ${returningPatients} returning`}
            onClose={() => setActiveFilter(null)}>
            <div className="flex items-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                {newPatients} New
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {returningPatients} Returning
              </span>
            </div>
            <div className="grid grid-cols-2 gap-6">
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
                <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400 font-medium">Loading…</p>
              </div>
            ) : (
              <SessionTable appointments={dayAppointments} />
            )}
          </FilterPanel>
        )}

        {/* ── Middle row ── */}
        <div className="grid grid-cols-2 gap-5">

          {/* Today's Sessions card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Today's Sessions</h2>
                <p className="text-xs text-slate-400 mt-0.5">{todayTotal} total</p>
              </div>
              <div className="flex items-center gap-2">
                {todayTotal > 0 && (
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
                    <div className="flex gap-1">
                      {todayAttended > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-0.5" />}
                      {todayMissed > 0  && <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5" />}
                      {todayPending > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-0.5" />}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {todayAttended + todayMissed}/{todayTotal} done
                    </span>
                  </div>
                )}
                <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                  {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </span>
              </div>
            </div>

            {todayAppointments.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-400">No sessions today</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      {["Time", "Patient", "Type", "Status"].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayAppointments.map((a, idx) => {
                      const now = new Date();
                      const isNow = new Date(a.startTime) <= now && new Date(a.endTime) >= now;
                      return (
                        <tr key={a.id}
                          className={`border-b border-slate-50 last:border-0 hover:bg-teal-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}>
                          <td className="px-5 py-3.5">
                            <span className="text-sm font-bold text-slate-700">{fmtTime(a.startTime)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <Avatar name={a.patient.name} size="sm" />
                              <span className="text-sm font-bold text-slate-800">{a.patient.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {a.sessionType.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
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

          {/* Weekly trend + no-show */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold text-slate-900">Weekly Session Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">Click a bar to see that day's sessions</p>
              </div>
              <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl">
                {weekCounts.reduce((a, b) => a + b, 0)} this week
              </span>
            </div>

            {/* Bar chart */}
            <div className="flex items-end gap-2 h-32 mb-2">
              {weekCounts.map((count, i) => {
                const isToday    = i === todayIndex;
                const isSelected = activeFilter === `day-${i}`;
                const isPeak     = i === peakIndex && !isToday;

                let barColor: string;
                if      (isSelected) barColor = "#0A4F3C";
                else if (isToday)    barColor = "#0F6E56";
                else if (isPeak)     barColor = "#3EB489";
                else if (count > 0)  barColor = "#9FE1CB";
                else                 barColor = "#F1F5F9";

                return (
                  <button key={i} onClick={() => handleBarClick(i)}
                    className="flex-1 flex flex-col items-center gap-1 group focus:outline-none"
                    title={`${weekDays[i]}: ${count} session${count !== 1 ? "s" : ""}${isToday ? " (today)" : ""}`}>
                    <span className="text-xs font-bold text-slate-400 mb-1">{count > 0 ? count : ""}</span>
                    <div
                      className="w-full rounded-t-xl transition-all group-hover:opacity-75"
                      style={{
                        height: `${Math.max((count / maxCount) * 96, count > 0 ? 8 : 0)}px`,
                        background: barColor,
                        outline: (isSelected || isToday) ? `2px solid ${isSelected ? "#0A4F3C" : "#0F6E56"}` : "none",
                        outlineOffset: "1px",
                      }}
                    />
                    <div className="flex flex-col items-center gap-0.5 mt-1">
                      <span className={`text-xs font-bold ${isToday ? "text-teal-700" : isSelected ? "text-slate-800" : "text-slate-400"}`}>
                        {weekDays[i]}
                      </span>
                      {isToday && <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs text-slate-400 mb-5">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#0F6E56]" />Today</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#3EB489]" />Peak</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-[#9FE1CB]" />Active</span>
            </div>

            {/* No-show reasons */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">No-show Reasons</h3>
                <span className="text-xs font-bold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg">{missedWeek} total</span>
              </div>
              <div className="space-y-3">
                {noShowReasons.map(r => (
                  <div key={r.label} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600 w-24 flex-shrink-0">{r.label}</span>
                    <div className="flex-1 h-2.5 bg-white rounded-full overflow-hidden border border-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${r.color}`}
                        style={{ width: missedWeek > 0 ? `${(r.count / missedWeek) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-xs font-black text-slate-600 w-4 text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Recent Patient Activity ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Patient Activity</h2>
              <p className="text-xs text-slate-400 mt-0.5">Latest sessions across all patients</p>
            </div>
            <Link href="/dashboard/patients"
              className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3.5 py-2 rounded-xl transition-all">
              View all patients
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {["Patient ID", "Name", "Last Visit", "Sessions", "Status", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm font-semibold text-slate-400">
                      No recent activity
                    </td>
                  </tr>
                ) : recentAppointments.map((a, idx) => (
                  <tr key={a.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-teal-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{a.patient.patientCode}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.patient.name} size="sm" />
                        <span className="text-sm font-bold text-slate-800">{a.patient.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-slate-600">{fmtDate(a.startTime)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
                          <span className="text-xs font-black text-slate-600">{a.patient._count?.appointments ?? "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/dashboard/patients/${a.patient.id}`}
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
        </div>

      </div>
    </div>
  );
}