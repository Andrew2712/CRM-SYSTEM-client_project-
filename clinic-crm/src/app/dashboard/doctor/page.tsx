"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import HolidayRequestForm from "@/components/HolidayRequestForm";

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  status: string;
  patient: {
    id: string;
    name: string;
    patientCode: string;
    phase: string;
    totalSessionsPlanned: number;
    purposeOfVisit: string;
  };
  doctor: { name: string };
};

type SessionHistory = {
  id: string;
  startTime: string;
  sessionType: string;
  status: string;
  patient: { id: string; name: string; patientCode: string };
  doctor: { name: string };
};

const PHASES: Record<string, { label: string; desc: string; pill: string; dot: string }> = {
  PHASE_1: { label: "Phase 1", desc: "Every day",                pill: "bg-violet-50 text-violet-700 border border-violet-200", dot: "bg-violet-500" },
  PHASE_2: { label: "Phase 2", desc: "Alternate days",           pill: "bg-blue-50 text-blue-700 border border-blue-200",       dot: "bg-blue-500" },
  PHASE_3: { label: "Phase 3", desc: "Twice a week",             pill: "bg-teal-50 text-teal-700 border border-teal-200",       dot: "bg-teal-500" },
  PHASE_4: { label: "Phase 4", desc: "Weekly once",              pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  PHASE_5: { label: "Phase 5", desc: "Weekly once (maintenance)",pill: "bg-amber-50 text-amber-700 border border-amber-200",    dot: "bg-amber-500" },
};

const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  ATTENDED:  { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  MISSED:    { pill: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-500" },
  CONFIRMED: { pill: "bg-blue-50 text-blue-600 border border-blue-200",          dot: "bg-blue-500" },
  CANCELLED: { pill: "bg-gray-100 text-gray-500 border border-gray-200",         dot: "bg-gray-400" },
};

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-teal-100 text-teal-700", "bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} ${color} rounded-xl flex items-center justify-center font-black flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function DoctorPage() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [weekStats, setWeekStats] = useState({ attended: 0, missed: 0, upcoming: 0 });
  const [historyFilter, setHistoryFilter] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function loadAppointments() {
    setLoading(true);
    const res = await fetch("/api/appointments", { credentials: "include" });
    const data = await res.json();
    if (!Array.isArray(data)) { setLoading(false); return; }

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayStart.getDate() + 1);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

    const todayAppts = data.filter((a: Appointment) => {
      const d = new Date(a.startTime);
      return d >= todayStart && d < todayEnd;
    });
    const weekAppts = data.filter((a: Appointment) => {
      const d = new Date(a.startTime);
      return d >= weekStart && d < weekEnd;
    });

    setAppointments(todayAppts);
    setAllAppointments(data);
    setWeekStats({
      attended: weekAppts.filter((a: Appointment) => a.status === "ATTENDED").length,
      missed:   weekAppts.filter((a: Appointment) => a.status === "MISSED").length,
      upcoming: weekAppts.filter((a: Appointment) => a.status === "CONFIRMED").length,
    });
    setLoading(false);
  }

  useEffect(() => { loadAppointments(); }, []);

  async function saveNote(id: string) {
    setSavingNote(id);
    const appt = appointments.find(a => a.id === id);
    if (!appt) { setSavingNote(null); return; }
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: appt.status, notes: notes[id] ?? "" }),
    });
    setSavedNotes(prev => ({ ...prev, [id]: notes[id] ?? "" }));
    setSavingNote(null);
  }

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status, notes: notes[id] ?? "" }),
    });
    if (res.ok) await loadAppointments();
    setUpdating(null);
  }

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const missed   = appointments.filter(a => a.status === "MISSED");
  const canUpdate = ["ADMIN", "DOCTOR"].includes(session?.user?.role ?? "");
  const filteredHistory = historyFilter
    ? allAppointments.filter(a => a.status === historyFilter)
    : allAppointments;

  const attendedToday  = appointments.filter(a => a.status === "ATTENDED").length;
  const pendingToday   = appointments.filter(a => a.status === "CONFIRMED").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Session View</h1>
          </div>
          <p className="text-sm text-slate-400 ml-[42px]">{today}</p>
        </div>

        <div className="flex items-center gap-2.5">
          {appointments.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-sm font-bold text-slate-700">{appointments.length}</span>
              <span className="text-xs text-slate-400 font-medium">today</span>
            </div>
          )}
          <button
            onClick={() => { setShowHistory(!showHistory); setHistoryFilter(null); }}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all shadow-sm ${
              showHistory
                ? "bg-teal-600 text-white border-teal-600 shadow-teal-200"
                : "bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50"
            }`}
          >
            {showHistory ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Schedule
              </>
            ) : (
              <>
                Session History
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Missed alerts ── */}
      {missed.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-red-700">
              {missed.length} Missed Session{missed.length > 1 ? "s" : ""} Today
            </span>
          </div>
          <div className="space-y-2">
            {missed.map(a => (
              <div key={a.id} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.patient.name} size="sm" />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">{a.patient.name}</span>
                    <span className="text-xs text-slate-400 ml-2">
                      {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <Link href={`/dashboard/patients/${a.patient.id}`}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-lg transition-colors">
                  View Patient →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SESSION HISTORY VIEW ── */}
      {showHistory ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Session History</h2>
              <p className="text-xs text-slate-400 mt-0.5">{filteredHistory.length} total sessions</p>
            </div>
            {historyFilter && (
              <button onClick={() => setHistoryFilter(null)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg transition-colors">
                Clear filter ×
              </button>
            )}
          </div>

          {/* Week stat chips */}
          <div className="grid grid-cols-3 gap-4 p-5 border-b border-slate-100">
            {[
              { label: "Attended this week",  value: weekStats.attended, color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-500", filter: "ATTENDED" },
              { label: "Missed this week",    value: weekStats.missed,   color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200",     dot: "bg-red-500",     filter: "MISSED" },
              { label: "Upcoming this week",  value: weekStats.upcoming, color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    dot: "bg-blue-500",    filter: "CONFIRMED" },
            ].map(s => (
              <button key={s.label}
                onClick={() => setHistoryFilter(historyFilter === s.filter ? null : s.filter)}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                  historyFilter === s.filter
                    ? `${s.bg} ${s.border} shadow-sm`
                    : "border-slate-100 hover:border-slate-200 bg-slate-50/50"
                }`}>
                <div className={`w-10 h-10 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center flex-shrink-0`}>
                  <span className={`w-3 h-3 rounded-full ${s.dot}`} />
                </div>
                <div>
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-medium text-slate-400">{s.label}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {["Date & Time", "Patient", "Session Type", "Doctor", "Status", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center">
                      <p className="text-sm font-semibold text-slate-400">No sessions found</p>
                    </td>
                  </tr>
                ) : filteredHistory.map((a, idx) => {
                  const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CANCELLED;
                  return (
                    <tr key={a.id}
                      className={`border-b border-slate-50 last:border-0 transition-colors hover:bg-teal-50/30 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-slate-700">
                          {new Date(a.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={a.patient.name} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800">{a.patient.name}</p>
                            <p className="text-xs font-mono text-slate-400">{a.patient.patientCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {a.sessionType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[10px] font-bold flex-shrink-0">
                            {a.doctor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-xs font-medium text-slate-700">{a.doctor.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/patients/${a.patient.id}`}
                          className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 px-3 py-1.5 rounded-lg transition-all">
                          View
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      ) : (
        /* ── MAIN SCHEDULE VIEW ── */
        <div className="grid grid-cols-[1fr_340px] gap-6">

          {/* ── Left: Today's schedule ── */}
          <div className="space-y-4">

            {/* Progress bar for today */}
            {appointments.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-700">Today's Progress</span>
                  <span className="text-xs font-semibold text-slate-400">
                    {attendedToday + missed.length} / {appointments.length} done
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-500 to-teal-400 rounded-full transition-all duration-700"
                    style={{ width: `${appointments.length > 0 ? ((attendedToday + missed.length) / appointments.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-500 font-medium">{attendedToday} Attended</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-xs text-slate-500 font-medium">{missed.length} Missed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs text-slate-500 font-medium">{pendingToday} Pending</span>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule card */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">Today's Schedule</h2>
                </div>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                  {appointments.length} session{appointments.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-5">
                {loading ? (
                  <div className="py-16 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-400 font-medium">Loading schedule…</p>
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">No appointments today</p>
                    <p className="text-xs text-slate-400 mt-1">Enjoy the free day!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map(a => {
                      const now = new Date();
                      const start = new Date(a.startTime);
                      const end = new Date(a.endTime);
                      const isNow = start <= now && end >= now;
                      const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CONFIRMED;
                      const phase = a.patient.phase ? PHASES[a.patient.phase] : null;

                      return (
                        <div key={a.id} className={`rounded-2xl border-2 p-4 transition-all ${
                          isNow && a.status === "CONFIRMED"
                            ? "border-teal-300 bg-teal-50/60 shadow-sm shadow-teal-100"
                            : a.status === "ATTENDED"
                            ? "border-emerald-100 bg-emerald-50/30"
                            : a.status === "MISSED"
                            ? "border-red-100 bg-red-50/20"
                            : "border-slate-100 bg-white hover:border-slate-200"
                        }`}>

                          {/* Top row */}
                          <div className="flex items-start gap-3">
                            {/* Time */}
                            <div className="text-center flex-shrink-0 w-14">
                              <p className="text-xs font-bold text-slate-500">
                                {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              {isNow && a.status === "CONFIRMED" && (
                                <span className="text-[9px] font-bold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded-full mt-1 block">LIVE</span>
                              )}
                            </div>

                            {/* Avatar */}
                            <Avatar name={a.patient.name} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-bold text-slate-900">{a.patient.name}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-xs text-slate-400 font-mono">{a.patient.patientCode}</span>
                                    <span className="text-slate-200">·</span>
                                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                                      {a.sessionType.replace(/_/g, " ")}
                                    </span>
                                    {phase && (
                                      <>
                                        <span className="text-slate-200">·</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${phase.pill}`}>
                                          {phase.label}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {a.patient.purposeOfVisit && (
                                    <p className="text-xs text-slate-400 mt-1 truncate max-w-xs">{a.patient.purposeOfVisit}</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${st.pill}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                                    {isNow && a.status === "CONFIRMED" ? "In Progress" : a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                                  </span>
                                  
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Notes + action buttons for CONFIRMED */}
                          {canUpdate && a.status === "CONFIRMED" && (
                            <div className="mt-4 ml-[68px] space-y-3">
                              <div className="flex gap-2">
                                <textarea
                                  rows={2}
                                  placeholder="Session notes (visible in patient dashboard)…"
                                  value={notes[a.id] ?? ""}
                                  onChange={e => setNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  className="flex-1 text-xs bg-white border-2 border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-0 focus:border-teal-400 placeholder:text-slate-300 transition-colors"
                                />
                                <button onClick={() => saveNote(a.id)} disabled={savingNote === a.id}
                                  className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-semibold px-3 py-2 rounded-xl border-2 border-slate-200 disabled:opacity-50 self-start transition-all whitespace-nowrap">
                                  {savingNote === a.id ? "Saving…" : "Save note"}
                                </button>
                              </div>
                              {savedNotes[a.id] && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-100 px-3 py-2 rounded-xl">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Note saved — visible in patient dashboard
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <button disabled={updating === a.id} onClick={() => updateStatus(a.id, "ATTENDED")}
                                  className="flex items-center justify-center gap-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl border border-emerald-400 disabled:opacity-50 transition-all shadow-sm shadow-emerald-100">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {updating === a.id ? "Saving…" : "Mark Attended"}
                                </button>
                                <button disabled={updating === a.id} onClick={() => updateStatus(a.id, "MISSED")}
                                  className="flex items-center justify-center gap-2 text-xs font-bold bg-white hover:bg-red-50 text-red-500 py-2.5 rounded-xl border-2 border-red-200 hover:border-red-300 disabled:opacity-50 transition-all">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  {updating === a.id ? "Saving…" : "Mark Missed"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Completed status message */}
                          {(a.status === "ATTENDED" || a.status === "MISSED") && (
                            <div className={`mt-3 ml-[68px] flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${
                              a.status === "ATTENDED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-red-50 text-red-600 border border-red-100"
                            }`}>
                              {a.status === "ATTENDED" ? (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Session completed and recorded in patient dashboard
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Marked as missed — patient flagged
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="space-y-5">

            {/* This week stats */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-slate-800">This Week</h2>
                </div>
                <button onClick={() => { setShowHistory(true); setHistoryFilter(null); }}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1">
                  Full history
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: "Attended",  value: weekStats.attended, color: "text-emerald-700", bar: "bg-emerald-500", bg: "bg-emerald-50", filter: "ATTENDED" },
                  { label: "Missed",    value: weekStats.missed,   color: "text-red-600",     bar: "bg-red-400",     bg: "bg-red-50",     filter: "MISSED" },
                  { label: "Upcoming",  value: weekStats.upcoming, color: "text-blue-700",    bar: "bg-blue-500",    bg: "bg-blue-50",    filter: "CONFIRMED" },
                ].map(s => {
                  const total = weekStats.attended + weekStats.missed + weekStats.upcoming;
                  const pct = total > 0 ? (s.value / total) * 100 : 0;
                  return (
                    <button key={s.label}
                      onClick={() => { setHistoryFilter(s.filter); setShowHistory(true); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group text-left">
                      <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-sm font-black ${s.color}`}>{s.value}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-600">{s.label}</span>
                          <span className="text-xs text-slate-400">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${s.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Today's patients quick list */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-slate-800">Today's Patients</h2>
              </div>
              {appointments.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No patients today</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map(a => {
                    const phase = a.patient.phase ? PHASES[a.patient.phase] : null;
                    const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CONFIRMED;
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-teal-50/50 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={a.patient.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{a.patient.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.pill}`}>
                                <span className={`w-1 h-1 rounded-full ${st.dot}`} />
                                {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                              </span>
                              {phase && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${phase.pill}`}>
                                  {phase.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <Link href={`/dashboard/patients/${a.patient.id}`}
                          className="flex-shrink-0 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-white hover:bg-teal-50 border border-teal-100 px-2.5 py-1.5 rounded-lg transition-all ml-2">
                          Profile
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phase legend */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-slate-800">Treatment Phases</h2>
              </div>
              <div className="space-y-2">
                {Object.entries(PHASES).map(([, p]) => (
                  <div key={p.label} className="flex items-center gap-3 py-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${p.pill}`}>
                      {p.label}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Holiday Request — Doctor only */}
            {session?.user?.role === "DOCTOR" && (
              <HolidayRequestForm />
            )}
          </div>
        </div>
      )}
    </div>
  );
}