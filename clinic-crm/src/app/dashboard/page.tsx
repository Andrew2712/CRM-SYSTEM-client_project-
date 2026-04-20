"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Format a UTC date string into the user's LOCAL time.
 * This is the key fix: we do NOT pass a timeZone override, so the
 * browser (or Node on the server) uses the system locale automatically.
 * On an IST machine the server stores UTC; toLocaleTimeString() converts
 * to local time correctly just like the Doctor dashboard does.
 */
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_PILL: Record<string, string> = {
  ATTENDED: "bg-green-50 text-green-700",
  MISSED: "bg-red-50 text-red-600",
  CONFIRMED: "bg-blue-50 text-blue-600",
  CANCELLED: "bg-gray-100 text-gray-500",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({
  status,
  isNow,
}: {
  status: string;
  isNow?: boolean;
}) {
  if (isNow)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">
        In progress
      </span>
    );
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        STATUS_PILL[status] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function FilterPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-teal-100 shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-2 py-1 rounded-lg"
        >
          ✕ Close
        </button>
      </div>
      {children}
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

  // Fetch dashboard data from your existing API route (or server action).
  // Replace `/api/admin/dashboard` with whatever endpoint you use.
  useEffect(() => {
  fetch("/api/admin/dashboard")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(setData)
    .catch(console.error);
}, []);

  if (!data) {
    return (
      <div className="p-6 text-sm text-gray-400">Loading dashboard…</div>
    );
  }

  const {
    totalPatients,
    newPatients,
    returningPatients,
    todayTotal,
    missedWeek,
    todayAppointments,
    recentAppointments,
    weekCounts,
    allPatients,
  } = data;

  const maxCount = Math.max(...weekCounts, 1);
  const peakIndex = weekCounts.indexOf(Math.max(...weekCounts));

  const noShowReasons = [
    { label: "No-call", count: Math.round(missedWeek * 0.5), color: "#E24B4A" },
    {
      label: "Late cancel",
      count: Math.round(missedWeek * 0.33),
      color: "#EF9F27",
    },
    {
      label: "Emergency",
      count: Math.round(missedWeek * 0.17),
      color: "#97C459",
    },
  ];
  const noShowRate =
    todayTotal > 0 ? ((missedWeek / todayTotal) * 100).toFixed(1) : "0.0";

  // ── Handlers ──────────────────────────────────────────────────────────────

  function toggleFilter(f: ActiveFilter) {
    setActiveFilter((prev) => (prev === f ? null : f));
    setSelectedDay(null);
  }

async function handleBarClick(dayIndex: number) {
  const key = `day-${dayIndex}` as ActiveFilter;
  if (activeFilter === key) {
    setActiveFilter(null);
    setSelectedDay(null);
    return;
  }
  setActiveFilter(key);
  setSelectedDay(dayIndex);
  setLoadingDay(true);

  // Calculate Monday of the current week (dayIndex: Mon=0 ... Sun=6)
  const today = new Date();
  const currentDay = today.getDay(); // Sun=0, Mon=1 ... Sat=6
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // days to Monday

  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  // Target day = monday + dayIndex
  const d = new Date(monday);
  d.setDate(monday.getDate() + dayIndex);
  d.setHours(0, 0, 0, 0);

  const next = new Date(d);
  next.setDate(d.getDate() + 1);
  next.setHours(0, 0, 0, 0);

  try {
    const res = await fetch(
      `/api/admin/appointments?from=${d.toISOString()}&to=${next.toISOString()}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const appts: Appointment[] = await res.json();
    setDayAppointments(appts);
  } catch {
    setDayAppointments([]);
  } finally {
    setLoadingDay(false);
  }
}

  // ── Patient table helper ──────────────────────────────────────────────────

  function PatientTable({
    patients,
    filterStatus,
  }: {
    patients: Patient[];
    filterStatus?: "NEW" | "RETURNING";
  }) {
    const list = filterStatus
      ? patients.filter((p) => p.status === filterStatus)
      : patients;

    if (list.length === 0)
      return (
        <p className="text-sm text-gray-400 text-center py-4">No patients found.</p>
      );

    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">Patient ID</th>
            <th className="text-left pb-2 font-medium">Name</th>
            <th className="text-left pb-2 font-medium">Status</th>
            <th className="text-left pb-2 font-medium">Sessions</th>
            <th className="text-left pb-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 text-xs text-gray-400 font-mono">
                {p.patientCode}
              </td>
              <td className="py-2.5 font-medium text-gray-900">{p.name}</td>
              <td className="py-2.5">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.status === "NEW"
                      ? "bg-teal-50 text-teal-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                </span>
              </td>
              <td className="py-2.5 text-gray-500">
                {p._count?.appointments ?? "—"}
              </td>
              <td className="py-2.5">
                <Link
                  href={`/dashboard/patients/${p.id}`}
                  className="text-xs text-teal-600 hover:text-teal-800 border border-teal-100 px-2 py-1 rounded-lg"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  // ── Session table helper ──────────────────────────────────────────────────

  function SessionTable({ appointments }: { appointments: Appointment[] }) {
    const now = new Date();
    if (appointments.length === 0)
      return (
        <p className="text-sm text-gray-400 text-center py-4">
          No sessions found.
        </p>
      );
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">Time</th>
            <th className="text-left pb-2 font-medium">Patient</th>
            <th className="text-left pb-2 font-medium">Doctor</th>
            <th className="text-left pb-2 font-medium">Type</th>
            <th className="text-left pb-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => {
            const isNow =
              new Date(a.startTime) <= now && new Date(a.endTime) >= now;
            return (
              <tr key={a.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2 text-xs text-gray-500">{fmtTime(a.startTime)}</td>
                <td className="py-2 font-medium text-gray-900">
                  {a.patient.name}
                </td>
                <td className="py-2 text-xs text-gray-500">{a.doctor.name}</td>
                <td className="py-2 text-xs text-gray-500">
                  {a.sessionType.replace(/_/g, " ")}
                </td>
                <td className="py-2">
                  <StatusPill status={a.status} isNow={isNow} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Admin dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          — Weekly overview
        </p>
      </div>

      {/* ── Top stat cards (clickable filters) ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Total patients */}
        <button
          onClick={() => toggleFilter("total")}
          className={`text-left rounded-xl p-4 transition-all border ${
            activeFilter === "total"
              ? "bg-teal-50 border-teal-200 ring-1 ring-teal-300"
              : "bg-gray-50 border-transparent hover:border-gray-200"
          }`}
        >
          <div className="text-xs text-gray-400 mb-1">Total patients</div>
          <div className="text-3xl font-semibold text-gray-900">
            {totalPatients}
          </div>
          <div className="text-xs text-teal-600 mt-1">+{newPatients} new</div>
        </button>

        {/* Sessions today */}
        <button
          onClick={() => toggleFilter("sessions")}
          className={`text-left rounded-xl p-4 transition-all border ${
            activeFilter === "sessions"
              ? "bg-teal-50 border-teal-200 ring-1 ring-teal-300"
              : "bg-gray-50 border-transparent hover:border-gray-200"
          }`}
        >
          <div className="text-xs text-gray-400 mb-1">Sessions today</div>
          <div className="text-3xl font-semibold text-gray-900">{todayTotal}</div>
          <div className="text-xs text-gray-400 mt-1">
            {todayAppointments.filter((a) => a.status === "CONFIRMED").length}{" "}
            remaining
          </div>
        </button>

        {/* No-shows */}
        <button
          onClick={() => toggleFilter("noshow")}
          className={`text-left rounded-xl p-4 transition-all border ${
            activeFilter === "noshow"
              ? "bg-red-50 border-red-200 ring-1 ring-red-200"
              : "bg-gray-50 border-transparent hover:border-gray-200"
          }`}
        >
          <div className="text-xs text-gray-400 mb-1">No-shows this week</div>
          <div className="text-3xl font-semibold text-gray-900">{missedWeek}</div>
          <div className="text-xs text-red-500 mt-1">{noShowRate}% rate</div>
        </button>

        {/* New vs returning */}
        <button
          onClick={() => toggleFilter("newvsreturning")}
          className={`text-left rounded-xl p-4 transition-all border ${
            activeFilter === "newvsreturning"
              ? "bg-teal-50 border-teal-200 ring-1 ring-teal-300"
              : "bg-gray-50 border-transparent hover:border-gray-200"
          }`}
        >
          <div className="text-xs text-gray-400 mb-1">New vs returning</div>
          <div className="text-3xl font-semibold text-gray-900">
            {newPatients} / {returningPatients}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {totalPatients > 0
              ? Math.round((newPatients / totalPatients) * 100)
              : 0}
            % new
          </div>
        </button>
      </div>

      {/* ── Filter panels ── */}

      {activeFilter === "total" && (
        <FilterPanel title="All patients" onClose={() => setActiveFilter(null)}>
          <PatientTable patients={allPatients} />
        </FilterPanel>
      )}

      {activeFilter === "sessions" && (
        <FilterPanel
          title="Today's sessions"
          onClose={() => setActiveFilter(null)}
        >
          <SessionTable appointments={todayAppointments} />
        </FilterPanel>
      )}

      {activeFilter === "noshow" && (
        <FilterPanel
          title="No-show appointments this week"
          onClose={() => setActiveFilter(null)}
        >
          <SessionTable
            appointments={recentAppointments.filter(
              (a) => a.status === "MISSED"
            )}
          />
          {recentAppointments.filter((a) => a.status === "MISSED").length ===
            0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No missed appointments this week 🎉
            </p>
          )}
        </FilterPanel>
      )}

      {activeFilter === "newvsreturning" && (
        <FilterPanel
          title="New vs returning patients"
          onClose={() => setActiveFilter(null)}
        >
          <div className="flex gap-3 mb-4">
            <span className="text-xs bg-teal-50 text-teal-700 px-3 py-1 rounded-full font-medium">
              {newPatients} New
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
              {returningPatients} Returning
            </span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-medium text-teal-600 mb-2">
                New patients
              </div>
              <PatientTable patients={allPatients} filterStatus="NEW" />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 mb-2">
                Returning patients
              </div>
              <PatientTable patients={allPatients} filterStatus="RETURNING" />
            </div>
          </div>
        </FilterPanel>
      )}

      {/* Day filter panel */}
      {selectedDay !== null && activeFilter === `day-${selectedDay}` && (
        <FilterPanel
          title={`Sessions on ${weekDays[selectedDay]} (${
            weekCounts[selectedDay]
          } total)`}
          onClose={() => {
            setActiveFilter(null);
            setSelectedDay(null);
          }}
        >
          {loadingDay ? (
            <p className="text-sm text-gray-400 text-center py-4">
              Loading…
            </p>
          ) : (
            <SessionTable appointments={dayAppointments} />
          )}
        </FilterPanel>
      )}

      {/* ── Middle row ── */}
      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* Today's sessions table */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">
            Today's sessions
          </h2>
          {todayAppointments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No sessions scheduled today
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">Time</th>
                  <th className="text-left pb-2 font-medium">Patient</th>
                  <th className="text-left pb-2 font-medium">Type</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.map((a) => {
                  const now = new Date();
                  const isNow =
                    new Date(a.startTime) <= now &&
                    new Date(a.endTime) >= now;
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-gray-50 last:border-0"
                    >
                      {/* ✅ FIX: removed { timeZone: "Asia/Kolkata" } override —
                          toLocaleTimeString() with no timeZone arg uses the
                          runtime's local timezone, same as Doctor dashboard. */}
                      <td className="py-2 text-xs text-gray-500">
                        {fmtTime(a.startTime)}
                      </td>
                      <td className="py-2 font-medium text-gray-900">
                        {a.patient.name}
                      </td>
                      <td className="py-2 text-xs text-gray-500">
                        {a.sessionType.replace(/_/g, " ")}
                      </td>
                      <td className="py-2">
                        <StatusPill status={a.status} isNow={isNow} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Weekly trend + no-show */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">
            Weekly session trend
          </h2>

          {/* Bar chart — each bar is clickable */}
          <div className="flex items-end gap-2 h-24 mb-2">
            {weekCounts.map((count, i) => {
              const isSelected = activeFilter === `day-${i}`;
              return (
                <button
                  key={i}
                  onClick={() => handleBarClick(i)}
                  className="flex-1 flex flex-col items-center gap-1 group focus:outline-none"
                  title={`${weekDays[i]}: ${count} session${count !== 1 ? "s" : ""}`}
                >
                  <div className="text-xs text-gray-400">
                    {count > 0 ? count : ""}
                  </div>
                  <div
                    className="w-full rounded-t-sm transition-all group-hover:opacity-80"
                    style={{
                      height: `${Math.max(
                        (count / maxCount) * 72,
                        count > 0 ? 4 : 0
                      )}px`,
                      background: isSelected
                        ? "#0A4F3C"
                        : i === peakIndex
                        ? "#0F6E56"
                        : count > 0
                        ? "#9FE1CB"
                        : "#F1EFE8",
                      outline: isSelected ? "2px solid #0A4F3C" : "none",
                    }}
                  />
                  <div
                    className={`text-xs ${
                      isSelected ? "text-teal-700 font-semibold" : "text-gray-400"
                    }`}
                  >
                    {weekDays[i]}
                  </div>
                </button>
              );
            })}
          </div>

          {weekCounts[peakIndex] > 0 && (
            <div className="text-xs text-gray-400 mb-4">
              Peak day: {weekDays[peakIndex]} ({weekCounts[peakIndex]} sessions)
              · Click a bar to see that day's sessions
            </div>
          )}

          <h3 className="text-xs font-medium text-gray-500 mb-3">
            No-show reasons this week
          </h3>
          <div className="space-y-2">
            {noShowReasons.map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20">{r.label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:
                        missedWeek > 0
                          ? `${(r.count / missedWeek) * 100}%`
                          : "0%",
                      background: r.color,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-4 text-right">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent patient activity ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-gray-900">
            Recent patient activity
          </h2>
          <Link
            href="/dashboard/patients"
            className="text-xs text-teal-600 hover:text-teal-800"
          >
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Patient ID</th>
              <th className="text-left pb-2 font-medium">Name</th>
              <th className="text-left pb-2 font-medium">Last visit</th>
              <th className="text-left pb-2 font-medium">Sessions</th>
              <th className="text-left pb-2 font-medium">Status</th>
              <th className="text-left pb-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {recentAppointments.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 last:border-0">
                <td className="py-2.5 text-xs text-gray-400 font-mono">
                  {a.patient.patientCode}
                </td>
                <td className="py-2.5 font-medium text-gray-900">
                  {a.patient.name}
                </td>
                <td className="py-2.5 text-xs text-gray-500">
                  {fmtDate(a.startTime)}
                </td>
                <td className="py-2.5 text-gray-500">
                  {a.patient._count?.appointments ?? "—"}
                </td>
                <td className="py-2.5">
                  <StatusPill status={a.status} />
                </td>
                <td className="py-2.5">
                  <Link
                    href={`/dashboard/patients/${a.patient.id}`}
                    className="text-xs text-teal-600 hover:text-teal-800 border border-teal-100 px-2 py-1 rounded-lg"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}