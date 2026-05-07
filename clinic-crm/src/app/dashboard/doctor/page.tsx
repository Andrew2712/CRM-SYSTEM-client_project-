"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  PHASE_1: {
    label: "Phase 1", desc: "Every day",
    pill: "bg-[#FDF3EC] text-[#D97332] border border-[#D97332]/30",
    dot: "bg-[#D97332]",
  },
  PHASE_2: {
    label: "Phase 2", desc: "Alternate days",
    pill: "bg-[#F5F1E8] text-[#5C1408] border border-[#5C1408]/20",
    dot: "bg-[#5C1408]",
  },
  PHASE_3: {
    label: "Phase 3", desc: "Twice a week",
    pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",
    dot: "bg-[#4F8A5B]",
  },
  PHASE_4: {
    label: "Phase 4", desc: "Weekly once",
    pill: "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40",
    dot: "bg-[#D9A441]",
  },
  PHASE_5: {
    label: "Phase 5", desc: "Weekly once (maintenance)",
    pill: "bg-[#4B0F05]/8 text-[#4B0F05] border border-[#4B0F05]/20",
    dot: "bg-[#4B0F05]",
  },
};

const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  ATTENDED:  { pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",  dot: "bg-[#4F8A5B]" },
  MISSED:    { pill: "bg-[#C94F4F]/10 text-[#C94F4F] border border-[#C94F4F]/30",   dot: "bg-[#C94F4F]" },
  CONFIRMED: { pill: "bg-[#D97332]/10 text-[#D97332] border border-[#D97332]/30",   dot: "bg-[#D97332]" },
  CANCELLED: { pill: "bg-[#E8E1D5] text-[#7A685F] border border-[#DDD2C2]",          dot: "bg-[#7A685F]" },
};

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const palettes = [
    "bg-[#FDF3EC] text-[#D97332]",
    "bg-[#4B0F05]/10 text-[#4B0F05]",
    "bg-[#4F8A5B]/10 text-[#4F8A5B]",
    "bg-[#D9A441]/10 text-[#8B6419]",
    "bg-[#5C1408]/10 text-[#5C1408]",
  ];
  const color = palettes[name.charCodeAt(0) % palettes.length];
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return (
    <div className={`${sz} ${color} rounded-xl flex items-center justify-center font-black flex-shrink-0 border border-[#DDD2C2]/60`}>
      {initials}
    </div>
  );
}

export default function DoctorPage() {
  const { data: session } = useSession();
  const router = useRouter();
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

  const missed    = appointments.filter(a => a.status === "MISSED");
  const canUpdate = ["ADMIN", "DOCTOR"].includes(session?.user?.role ?? "");
  const filteredHistory = historyFilter
    ? allAppointments.filter(a => a.status === historyFilter)
    : allAppointments;

  const attendedToday = appointments.filter(a => a.status === "ATTENDED").length;
  const pendingToday  = appointments.filter(a => a.status === "CONFIRMED").length;

  return (
    <div className="min-h-screen bg-[#F5F1E8] p-4 sm:p-6">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-[#4B0F05] rounded-xl flex items-center justify-center shadow-md shadow-[#4B0F05]/20">
              <svg className="w-4 h-4 text-[#F5F1E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#2B1A14] tracking-tight">Session View</h1>
          </div>
          <p className="text-xs sm:text-sm text-[#7A685F] ml-[42px]">{today}</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {appointments.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-[#DDD2C2] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#D97332] animate-pulse" />
              <span className="text-sm font-bold text-[#2B1A14]">{appointments.length}</span>
              <span className="text-xs text-[#7A685F] font-medium">today</span>
            </div>
          )}
          <button
            onClick={() => { setShowHistory(!showHistory); setHistoryFilter(null); }}
            className={`flex items-center gap-2 text-sm font-semibold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border transition-all duration-200 shadow-sm ${
              showHistory
                ? "bg-[#4B0F05] text-[#F5F1E8] border-[#4B0F05] shadow-[#4B0F05]/20"
                : "bg-white text-[#2B1A14] border-[#DDD2C2] hover:border-[#D97332] hover:text-[#D97332] hover:bg-[#FDF3EC]"
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
        <div className="mb-5 sm:mb-6 bg-[#C94F4F]/8 border border-[#C94F4F]/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 bg-[#C94F4F] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#C94F4F]">
              {missed.length} Missed Session{missed.length > 1 ? "s" : ""} Today
            </span>
          </div>
          <div className="space-y-2">
            {missed.map(a => (
              <div
                key={a.id}
                onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}
                className="flex items-center justify-between bg-white/70 rounded-xl px-3 py-2 cursor-pointer hover:bg-white transition-colors duration-150"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.patient.name} size="sm" />
                  <div>
                    <span className="text-sm font-semibold text-[#2B1A14]">{a.patient.name}</span>
                    <span className="text-xs text-[#7A685F] ml-2">
                      {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#C94F4F]">View →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SESSION HISTORY VIEW ── */}
      {showHistory ? (
        <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#2B1A14]">Session History</h2>
              <p className="text-xs text-[#7A685F] mt-0.5">{filteredHistory.length} total sessions</p>
            </div>
            {historyFilter && (
              <button onClick={() => setHistoryFilter(null)}
                className="self-start sm:self-auto flex items-center gap-1.5 text-xs font-semibold text-[#7A685F] hover:text-[#2B1A14] bg-[#E8E1D5] hover:bg-[#DDD2C2] px-3 py-1.5 rounded-lg transition-colors">
                Clear filter ×
              </button>
            )}
          </div>

          {/* Week stat chips */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-4 sm:p-5 border-b border-[#E8E1D5]">
            {[
              { label: "Attended this week",  value: weekStats.attended, color: "text-[#4F8A5B]", bg: "bg-[#4F8A5B]/8",  border: "border-[#4F8A5B]/25", dot: "bg-[#4F8A5B]", filter: "ATTENDED",  selBg: "bg-[#4F8A5B]/10",  selBorder: "border-[#4F8A5B]/40" },
              { label: "Missed this week",    value: weekStats.missed,   color: "text-[#C94F4F]", bg: "bg-[#C94F4F]/8",  border: "border-[#C94F4F]/25", dot: "bg-[#C94F4F]", filter: "MISSED",   selBg: "bg-[#C94F4F]/10",  selBorder: "border-[#C94F4F]/40" },
              { label: "Upcoming this week",  value: weekStats.upcoming, color: "text-[#D97332]", bg: "bg-[#D97332]/8",  border: "border-[#D97332]/25", dot: "bg-[#D97332]", filter: "CONFIRMED",selBg: "bg-[#D97332]/10",  selBorder: "border-[#D97332]/40" },
            ].map(s => (
              <button key={s.label}
                onClick={() => setHistoryFilter(historyFilter === s.filter ? null : s.filter)}
                className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 transition-all duration-150 text-left ${
                  historyFilter === s.filter
                    ? `${s.selBg} ${s.selBorder} shadow-sm`
                    : "border-[#E8E1D5] hover:border-[#DDD2C2] bg-[#F5F1E8]/60"
                }`}>
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${s.bg} border ${s.border} flex items-center justify-center flex-shrink-0`}>
                  <span className={`w-3 h-3 rounded-full ${s.dot}`} />
                </div>
                <div>
                  <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-medium text-[#7A685F]">{s.label}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Desktop Table / Mobile Cards */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F1E8]/80 border-b border-[#E8E1D5]">
                  {["Date & Time", "Patient", "Session Type", "Doctor", "Status"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-[#7A685F] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <p className="text-sm font-semibold text-[#7A685F]">No sessions found</p>
                    </td>
                  </tr>
                ) : filteredHistory.map((a, idx) => {
                  const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CANCELLED;
                  return (
                    <tr key={a.id}
                      onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}
                      className={`border-b border-[#F5F1E8] last:border-0 transition-all duration-150 cursor-pointer hover:bg-[#FDF3EC] ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F1E8]/30"}`}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#2B1A14]">
                          {new Date(a.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p className="text-xs text-[#7A685F] mt-0.5">
                          {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={a.patient.name} size="sm" />
                          <div>
                            <p className="text-sm font-bold text-[#2B1A14]">{a.patient.name}</p>
                            <p className="text-xs font-mono text-[#7A685F]">{a.patient.patientCode}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-medium text-[#5C1408] bg-[#E8E1D5] px-2.5 py-1 rounded-lg">
                          {a.sessionType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#FDF3EC] border border-[#DDD2C2] flex items-center justify-center text-[#D97332] text-[10px] font-bold flex-shrink-0">
                            {a.doctor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-xs font-medium text-[#2B1A14]">{a.doctor.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards for history */}
          <div className="sm:hidden divide-y divide-[#E8E1D5]">
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-semibold text-[#7A685F]">No sessions found</p>
              </div>
            ) : filteredHistory.map(a => {
              const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CANCELLED;
              return (
                <div key={a.id}
                  onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}
                  className="p-4 cursor-pointer hover:bg-[#FDF3EC] transition-colors duration-150 active:bg-[#FDF3EC]">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={a.patient.name} size="sm" />
                      <div>
                        <p className="text-sm font-bold text-[#2B1A14]">{a.patient.name}</p>
                        <p className="text-xs font-mono text-[#7A685F]">{a.patient.patientCode}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${st.pill}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-[#7A685F]">
                      {new Date(a.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}
                      {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-xs font-medium text-[#5C1408] bg-[#E8E1D5] px-2 py-0.5 rounded-lg">
                      {a.sessionType.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      ) : (
        /* ── MAIN SCHEDULE VIEW ── */
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px] gap-5 sm:gap-6">

          {/* ── Left: Today's schedule ── */}
          <div className="space-y-4">

            {/* Progress bar for today */}
            {appointments.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-[#2B1A14]">Today's Progress</span>
                  <span className="text-xs font-semibold text-[#7A685F]">
                    {attendedToday + missed.length} / {appointments.length} done
                  </span>
                </div>
                <div className="h-2.5 bg-[#E8E1D5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#4B0F05] to-[#D97332] rounded-full transition-all duration-700"
                    style={{ width: `${appointments.length > 0 ? ((attendedToday + missed.length) / appointments.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 sm:gap-4 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4F8A5B]" />
                    <span className="text-xs text-[#7A685F] font-medium">{attendedToday} Attended</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#C94F4F]" />
                    <span className="text-xs text-[#7A685F] font-medium">{missed.length} Missed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#D97332]" />
                    <span className="text-xs text-[#7A685F] font-medium">{pendingToday} Pending</span>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule card */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#FDF3EC] rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-[#2B1A14]">Today's Schedule</h2>
                </div>
                <span className="text-xs font-semibold text-[#7A685F] bg-[#E8E1D5] px-2.5 py-1 rounded-full">
                  {appointments.length} session{appointments.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="p-4 sm:p-5">
                {loading ? (
                  <div className="py-16 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-[3px] border-[#D97332] border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-[#7A685F] font-medium">Loading schedule…</p>
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="py-16 text-center">
                    <div className="w-14 h-14 bg-[#E8E1D5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-[#7A685F]/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-[#7A685F]">No appointments today</p>
                    <p className="text-xs text-[#7A685F]/70 mt-1">Enjoy the free day!</p>
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
                        <div key={a.id} className={`rounded-2xl border-2 p-3 sm:p-4 transition-all duration-200 ${
                          isNow && a.status === "CONFIRMED"
                            ? "border-[#D97332]/40 bg-[#FDF3EC] shadow-sm shadow-[#D97332]/10"
                            : a.status === "ATTENDED"
                            ? "border-[#4F8A5B]/20 bg-[#4F8A5B]/5"
                            : a.status === "MISSED"
                            ? "border-[#C94F4F]/20 bg-[#C94F4F]/5"
                            : "border-[#E8E1D5] bg-white hover:border-[#DDD2C2]"
                        }`}>

                          {/* Top row */}
                          <div className="flex items-start gap-2 sm:gap-3">
                            {/* Time */}
                            <div className="text-center flex-shrink-0 w-12 sm:w-14">
                              <p className="text-xs font-bold text-[#7A685F]">
                                {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                              {isNow && a.status === "CONFIRMED" && (
                                <span className="text-[9px] font-bold text-[#D97332] bg-[#D97332]/15 px-1.5 py-0.5 rounded-full mt-1 block">LIVE</span>
                              )}
                            </div>

                            {/* Avatar */}
                            <Avatar name={a.patient.name} />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-[#2B1A14]">{a.patient.name}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                    <span className="text-xs text-[#7A685F] font-mono">{a.patient.patientCode}</span>
                                    <span className="text-[#DDD2C2]">·</span>
                                    <span className="text-xs font-medium text-[#5C1408] bg-[#E8E1D5] px-2 py-0.5 rounded-lg">
                                      {a.sessionType.replace(/_/g, " ")}
                                    </span>
                                    {phase && (
                                      <>
                                        <span className="text-[#DDD2C2]">·</span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${phase.pill}`}>
                                          {phase.label}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {a.patient.purposeOfVisit && (
                                    <p className="text-xs text-[#7A685F] mt-1 truncate max-w-xs">{a.patient.purposeOfVisit}</p>
                                  )}
                                </div>
                                <div className="flex items-center sm:flex-col sm:items-end gap-1.5 flex-shrink-0">
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
                            <div className="mt-4 ml-0 sm:ml-[68px] space-y-3">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <textarea
                                  rows={2}
                                  placeholder="Session notes (visible in patient dashboard)…"
                                  value={notes[a.id] ?? ""}
                                  onChange={e => setNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  className="flex-1 text-xs bg-white border-2 border-[#DDD2C2] rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-0 focus:border-[#D97332] placeholder:text-[#7A685F]/40 transition-colors duration-150 w-full"
                                />
                                <button
                                  onClick={() => saveNote(a.id)}
                                  disabled={savingNote === a.id}
                                  className="text-xs bg-[#F5F1E8] hover:bg-[#E8E1D5] text-[#5C1408] font-semibold px-3 py-2 rounded-xl border-2 border-[#DDD2C2] disabled:opacity-50 sm:self-start transition-all duration-150 whitespace-nowrap"
                                >
                                  {savingNote === a.id ? "Saving…" : "Save note"}
                                </button>
                              </div>
                              {savedNotes[a.id] && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4F8A5B] bg-[#4F8A5B]/8 border border-[#4F8A5B]/25 px-3 py-2 rounded-xl">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Note saved — visible in patient dashboard
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  disabled={updating === a.id}
                                  onClick={() => updateStatus(a.id, "ATTENDED")}
                                  className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold bg-[#4F8A5B] hover:bg-[#3d6e47] text-white py-2.5 rounded-xl border border-[#4F8A5B] disabled:opacity-50 transition-all duration-150 shadow-sm shadow-[#4F8A5B]/20"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  {updating === a.id ? "Saving…" : "Mark Attended"}
                                </button>
                                <button
                                  disabled={updating === a.id}
                                  onClick={() => updateStatus(a.id, "MISSED")}
                                  className="flex items-center justify-center gap-1.5 sm:gap-2 text-xs font-bold bg-white hover:bg-[#C94F4F]/8 text-[#C94F4F] py-2.5 rounded-xl border-2 border-[#C94F4F]/30 hover:border-[#C94F4F]/50 disabled:opacity-50 transition-all duration-150"
                                >
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
                            <div className={`mt-3 ml-0 sm:ml-[68px] flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${
                              a.status === "ATTENDED"
                                ? "bg-[#4F8A5B]/8 text-[#4F8A5B] border border-[#4F8A5B]/25"
                                : "bg-[#C94F4F]/8 text-[#C94F4F] border border-[#C94F4F]/25"
                            }`}>
                              {a.status === "ATTENDED" ? (
                                <>
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                  Session completed and recorded in patient dashboard
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="space-y-4 sm:space-y-5">

            {/* This week stats */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#E8E1D5] rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#5C1408]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-[#2B1A14]">This Week</h2>
                </div>
                <button onClick={() => { setShowHistory(true); setHistoryFilter(null); }}
                  className="text-xs font-semibold text-[#D97332] hover:text-[#4B0F05] flex items-center gap-1 transition-colors duration-150">
                  Full history
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { label: "Attended",  value: weekStats.attended, color: "text-[#4F8A5B]", bar: "bg-[#4F8A5B]", bg: "bg-[#4F8A5B]/8",  filter: "ATTENDED" },
                  { label: "Missed",    value: weekStats.missed,   color: "text-[#C94F4F]", bar: "bg-[#C94F4F]", bg: "bg-[#C94F4F]/8",  filter: "MISSED" },
                  { label: "Upcoming",  value: weekStats.upcoming, color: "text-[#D97332]", bar: "bg-[#D97332]", bg: "bg-[#D97332]/8",  filter: "CONFIRMED" },
                ].map(s => {
                  const total = weekStats.attended + weekStats.missed + weekStats.upcoming;
                  const pct = total > 0 ? (s.value / total) * 100 : 0;
                  return (
                    <button key={s.label}
                      onClick={() => { setHistoryFilter(s.filter); setShowHistory(true); }}
                      className="w-full flex items-center gap-3 p-2.5 sm:p-3 rounded-xl hover:bg-[#F5F1E8] transition-colors duration-150 text-left">
                      <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center flex-shrink-0 border border-[#DDD2C2]/60`}>
                        <span className={`text-sm font-black ${s.color}`}>{s.value}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-[#2B1A14]">{s.label}</span>
                          <span className="text-xs text-[#7A685F]">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-[#E8E1D5] rounded-full overflow-hidden">
                          <div className={`h-full ${s.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Today's patients quick list */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#FDF3EC] rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-[#2B1A14]">Today's Patients</h2>
              </div>
              {appointments.length === 0 ? (
                <p className="text-xs text-[#7A685F] text-center py-4">No patients today</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map(a => {
                    const phase = a.patient.phase ? PHASES[a.patient.phase] : null;
                    const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CONFIRMED;
                    return (
                      <div
                        key={a.id}
                        onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}
                        className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-[#F5F1E8] hover:bg-[#EFE7DA] transition-colors duration-150 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={a.patient.name} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#2B1A14] truncate">{a.patient.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                        <svg className="w-4 h-4 text-[#7A685F] flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phase legend */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-[#4B0F05]/8 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#4B0F05]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-[#2B1A14]">Treatment Phases</h2>
              </div>
              <div className="space-y-2">
                {Object.entries(PHASES).map(([, p]) => (
                  <div key={p.label} className="flex items-center gap-3 py-1">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${p.pill}`}>
                      {p.label}
                    </span>
                    <span className="text-xs font-medium text-[#7A685F]">{p.desc}</span>
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