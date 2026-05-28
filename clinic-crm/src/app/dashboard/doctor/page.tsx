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

const PHASES: Record<string, { label: string; desc: string; pill: string; dot: string }> = {
  PHASE_1: { label: "Phase 1", desc: "Every day",                   pill: "bg-[#FDF3EC] text-[#D97332] border border-[#D97332]/30", dot: "bg-[#D97332]" },
  PHASE_2: { label: "Phase 2", desc: "Alternate days",              pill: "bg-[#F5F1E8] text-[#5C1408] border border-[#5C1408]/20", dot: "bg-[#5C1408]" },
  PHASE_3: { label: "Phase 3", desc: "Twice a week",                pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30", dot: "bg-[#4F8A5B]" },
  PHASE_4: { label: "Phase 4", desc: "Weekly once",                 pill: "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40", dot: "bg-[#D9A441]" },
  PHASE_5: { label: "Phase 5", desc: "Weekly once (maintenance)",   pill: "bg-[#4B0F05]/8 text-[#4B0F05] border border-[#4B0F05]/20", dot: "bg-[#4B0F05]" },
};

const STATUS_STYLE: Record<string, { pill: string; dot: string }> = {
  ATTENDED:    { pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",  dot: "bg-[#4F8A5B]" },
  MISSED:      { pill: "bg-[#C94F4F]/10 text-[#C94F4F] border border-[#C94F4F]/30",   dot: "bg-[#C94F4F]" },
  CONFIRMED:   { pill: "bg-[#D97332]/10 text-[#D97332] border border-[#D97332]/30",   dot: "bg-[#D97332]" },
  RESCHEDULED: { pill: "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40",   dot: "bg-[#D9A441]" },
  CANCELLED:   { pill: "bg-[#E8E1D5] text-[#7A685F] border border-[#DDD2C2]",          dot: "bg-[#7A685F]" },
};

const ACTIONABLE = ["CONFIRMED", "RESCHEDULED"];

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
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [pastPending, setPastPending] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [weekStats, setWeekStats] = useState({ attended: 0, missed: 0, upcoming: 0, cancelled: 0 });
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

    const todayAppts = (data as Appointment[]).filter(a => {
      const d = new Date(a.startTime);
      return d >= todayStart && d < todayEnd;
    });
    const weekAppts = (data as Appointment[]).filter(a => {
      const d = new Date(a.startTime);
      return d >= weekStart && d < weekEnd;
    });

    const past = (data as Appointment[]).filter(a =>
      ACTIONABLE.includes(a.status) && new Date(a.endTime) < now &&
      new Date(a.startTime) < todayStart
    );

    setAppointments(todayAppts);
    setAllAppointments(data as Appointment[]);
    setPastPending(past);
    setWeekStats({
      attended:  weekAppts.filter(a => a.status === "ATTENDED").length,
      missed:    weekAppts.filter(a => a.status === "MISSED").length,
      upcoming:  weekAppts.filter(a => ACTIONABLE.includes(a.status)).length,
      cancelled: weekAppts.filter(a => a.status === "CANCELLED").length,
    });
    setLoading(false);
  }

  useEffect(() => { loadAppointments(); }, []);

  async function saveNote(id: string) {
    setSavingNote(id);
    const appt = [...appointments, ...pastPending].find(a => a.id === id);
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

  const activeToday    = appointments.filter(a => a.status !== "CANCELLED");
  const cancelledToday = appointments.filter(a => a.status === "CANCELLED").length;
  const missed         = appointments.filter(a => a.status === "MISSED");
  const attendedToday  = appointments.filter(a => a.status === "ATTENDED").length;
  const pendingToday   = appointments.filter(a => ACTIONABLE.includes(a.status)).length;

  const canUpdate = ["ADMIN", "DOCTOR"].includes(session?.user?.role ?? "");
  const filteredHistory = historyFilter
    ? allAppointments.filter(a => a.status === historyFilter)
    : allAppointments;

  function renderApptCard(a: Appointment, opts: { isPast?: boolean } = {}) {
    const now = new Date();
    const start = new Date(a.startTime);
    const end = new Date(a.endTime);
    const isNow = start <= now && end >= now;
    const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CANCELLED;
    const phase = a.patient.phase ? PHASES[a.patient.phase] : null;
    const isActionable = ACTIONABLE.includes(a.status);

    return (
      <div key={a.id} className={`rounded-2xl border-2 p-3 sm:p-4 transition-all duration-200 ${
        opts.isPast
          ? "border-[#D9A441]/40 bg-[#FFF8E8]"
          : isNow && isActionable
          ? "border-[#D97332]/40 bg-[#FDF3EC] shadow-sm shadow-[#D97332]/10"
          : a.status === "ATTENDED"
          ? "border-[#4F8A5B]/20 bg-[#4F8A5B]/5"
          : a.status === "MISSED"
          ? "border-[#C94F4F]/20 bg-[#C94F4F]/5"
          : a.status === "CANCELLED"
          ? "border-[#DDD2C2] bg-[#F5F1E8]/60 opacity-75"
          : "border-[#E8E1D5] bg-white hover:border-[#DDD2C2]"
      }`}>
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="text-center flex-shrink-0 w-12 sm:w-14">
            <p className="text-xs font-bold text-[#7A685F]">
              {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {opts.isPast ? (
              <span className="text-[9px] font-bold text-[#8B6419] bg-[#D9A441]/20 px-1.5 py-0.5 rounded-full mt-1 block">PAST</span>
            ) : isNow && isActionable ? (
              <span className="text-[9px] font-bold text-[#D97332] bg-[#D97332]/15 px-1.5 py-0.5 rounded-full mt-1 block">LIVE</span>
            ) : null}
            {opts.isPast && (
              <p className="text-[10px] text-[#7A685F]/70 mt-1">
                {start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            )}
          </div>

          <Avatar name={a.patient.name} />

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
                  {isNow && isActionable
                    ? "In Progress"
                    : a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {canUpdate && isActionable && (
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

        {(a.status === "ATTENDED" || a.status === "MISSED") && (
          <div className={`mt-3 ml-0 sm:ml-[68px] flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl ${
            a.status === "ATTENDED"
              ? "bg-[#4F8A5B]/8 text-[#4F8A5B] border border-[#4F8A5B]/25"
              : "bg-[#C94F4F]/8 text-[#C94F4F] border border-[#C94F4F]/25"
          }`}>
            {a.status === "ATTENDED" ? "Session completed and recorded in patient dashboard" : "Marked as missed — patient flagged"}
          </div>
        )}

        {a.status === "CANCELLED" && (
          <div className="mt-3 ml-0 sm:ml-[68px] flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl bg-[#E8E1D5] text-[#7A685F] border border-[#DDD2C2]">
            Session cancelled — excluded from totals
          </div>
        )}
      </div>
    );
  }

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
          {activeToday.length > 0 && (
            <div className="flex items-center gap-2 bg-white border border-[#DDD2C2] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-[#D97332] animate-pulse" />
              <span className="text-sm font-bold text-[#2B1A14]">{activeToday.length}</span>
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
            {showHistory ? "← Back to Schedule" : "Session History →"}
          </button>
        </div>
      </div>

      {/* ── Missed alerts ── */}
      {missed.length > 0 && (
        <div className="mb-5 sm:mb-6 bg-[#C94F4F]/8 border border-[#C94F4F]/25 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
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

      {/* ── Past Pending Sessions ── */}
      {!showHistory && pastPending.length > 0 && (
        <div className="mb-5 sm:mb-6 bg-white rounded-2xl border-2 border-[#D9A441]/40 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#D9A441]/30 bg-[#FFF8E8] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#D9A441]/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[#8B6419]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#5C1408]">Unmarked Past Sessions</h2>
                <p className="text-[11px] text-[#7A685F]">These slipped past their end time without being marked — please mark them now.</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#8B6419] bg-[#D9A441]/20 px-2.5 py-1 rounded-full">
              {pastPending.length} pending
            </span>
          </div>
          <div className="p-4 sm:p-5 space-y-3">
            {pastPending.map(a => renderApptCard(a, { isPast: true }))}
          </div>
        </div>
      )}

      {/* ── SESSION HISTORY VIEW ── */}
      {showHistory ? (
        <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-5 border-b border-[#E8E1D5]">
            {[
              { label: "Attended",  value: weekStats.attended,  color: "text-[#4F8A5B]", dot: "bg-[#4F8A5B]", filter: "ATTENDED" },
              { label: "Missed",    value: weekStats.missed,    color: "text-[#C94F4F]", dot: "bg-[#C94F4F]", filter: "MISSED" },
              { label: "Upcoming",  value: weekStats.upcoming,  color: "text-[#D97332]", dot: "bg-[#D97332]", filter: "CONFIRMED" },
              { label: "Cancelled", value: weekStats.cancelled, color: "text-[#7A685F]", dot: "bg-[#7A685F]", filter: "CANCELLED" },
            ].map(s => (
              <button key={s.label}
                onClick={() => setHistoryFilter(historyFilter === s.filter ? null : s.filter)}
                className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border-2 transition-all duration-150 text-left ${
                  historyFilter === s.filter ? "border-[#4B0F05]/30 bg-[#FDF3EC]" : "border-[#E8E1D5] hover:border-[#DDD2C2] bg-[#F5F1E8]/60"
                }`}>
                <span className={`w-3 h-3 rounded-full ${s.dot}`} />
                <div>
                  <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs font-medium text-[#7A685F]">{s.label} this week</p>
                </div>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F5F1E8]/80 border-b border-[#E8E1D5]">
                  {["Date & Time", "Patient", "Session", "Doctor", "Status", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-[#7A685F] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center"><p className="text-sm font-semibold text-[#7A685F]">No sessions found</p></td></tr>
                ) : filteredHistory.map((a, idx) => {
                  const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CANCELLED;
                  const canMarkInline = canUpdate && ACTIONABLE.includes(a.status);
                  return (
                    <tr key={a.id} className={`border-b border-[#F5F1E8] last:border-0 transition-all hover:bg-[#FDF3EC] ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F1E8]/30"}`}>
                      <td className="px-5 py-4 cursor-pointer" onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}>
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
                      <td className="px-5 py-4 text-xs font-medium text-[#2B1A14]">{a.doctor.name}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {canMarkInline ? (
                          <div className="flex gap-1.5">
                            <button
                              disabled={updating === a.id}
                              onClick={() => updateStatus(a.id, "ATTENDED")}
                              className="text-[11px] font-bold bg-[#4F8A5B] hover:bg-[#3d6e47] text-white px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                              Attended
                            </button>
                            <button
                              disabled={updating === a.id}
                              onClick={() => updateStatus(a.id, "MISSED")}
                              className="text-[11px] font-bold bg-white hover:bg-[#C94F4F]/10 text-[#C94F4F] border border-[#C94F4F]/30 px-2.5 py-1.5 rounded-lg disabled:opacity-50">
                              Missed
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-[#7A685F]">—</span>
                        )}
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_340px] gap-5 sm:gap-6">
          <div className="space-y-4">

            {/* Progress bar */}
            {activeToday.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-[#2B1A14]">Today&apos;s Progress</span>
                  <span className="text-xs font-semibold text-[#7A685F]">
                    {attendedToday + missed.length} / {activeToday.length} done
                  </span>
                </div>
                <div className="h-2.5 bg-[#E8E1D5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#4B0F05] to-[#D97332] rounded-full transition-all duration-700"
                    style={{ width: `${activeToday.length > 0 ? ((attendedToday + missed.length) / activeToday.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 sm:gap-4 mt-3 flex-wrap">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#4F8A5B]" /><span className="text-xs text-[#7A685F] font-medium">{attendedToday} Attended</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#C94F4F]" /><span className="text-xs text-[#7A685F] font-medium">{missed.length} Missed</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D97332]" /><span className="text-xs text-[#7A685F] font-medium">{pendingToday} Pending</span></div>
                  {cancelledToday > 0 && (
                    <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#7A685F]" /><span className="text-xs text-[#7A685F] font-medium">{cancelledToday} Cancelled</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Schedule card */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#2B1A14]">Today&apos;s Schedule</h2>
                <span className="text-xs font-semibold text-[#7A685F] bg-[#E8E1D5] px-2.5 py-1 rounded-full">
                  {activeToday.length} session{activeToday.length !== 1 ? "s" : ""}
                  {cancelledToday > 0 ? ` · ${cancelledToday} cancelled` : ""}
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
                    <p className="text-sm font-semibold text-[#7A685F]">No appointments today</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map(a => renderApptCard(a))}
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
                <h2 className="text-sm font-bold text-[#2B1A14]">This Week</h2>
                <button onClick={() => { setShowHistory(true); setHistoryFilter(null); }}
                  className="text-xs font-semibold text-[#D97332] hover:text-[#4B0F05]">Full history →</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#4F8A5B]/8 border border-[#4F8A5B]/25">
                  <p className="text-2xl font-black text-[#4F8A5B]">{weekStats.attended}</p>
                  <p className="text-[11px] font-medium text-[#7A685F]">Attended</p>
                </div>
                <div className="p-3 rounded-xl bg-[#C94F4F]/8 border border-[#C94F4F]/25">
                  <p className="text-2xl font-black text-[#C94F4F]">{weekStats.missed}</p>
                  <p className="text-[11px] font-medium text-[#7A685F]">Missed</p>
                </div>
                <div className="p-3 rounded-xl bg-[#D97332]/8 border border-[#D97332]/25">
                  <p className="text-2xl font-black text-[#D97332]">{weekStats.upcoming}</p>
                  <p className="text-[11px] font-medium text-[#7A685F]">Upcoming</p>
                </div>
                <div className="p-3 rounded-xl bg-[#E8E1D5] border border-[#DDD2C2]">
                  <p className="text-2xl font-black text-[#7A685F]">{weekStats.cancelled}</p>
                  <p className="text-[11px] font-medium text-[#7A685F]">Cancelled</p>
                </div>
              </div>
            </div>

            {/* ── TODAY'S PATIENTS (scrollable) ── */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 py-4 border-b border-[#E8E1D5] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#FDF3EC] rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <h2 className="text-sm font-bold text-[#2B1A14]">Today&apos;s Patients</h2>
                </div>
                {appointments.length > 0 && (
                  <span className="text-xs font-semibold text-[#7A685F] bg-[#E8E1D5] px-2.5 py-1 rounded-full">
                    {appointments.length}
                  </span>
                )}
              </div>

              {/*
                Scrollable container: shows ~5 rows (~64px each = 320px),
                then scrolls. The subtle gradient at the bottom hints there's more.
              */}
              <div className="relative">
                <div className="overflow-y-auto max-h-[320px] divide-y divide-[#F0EBE3] scrollbar-thin scrollbar-thumb-[#DDD2C2] scrollbar-track-transparent">
                  {appointments.length === 0 ? (
                    <p className="text-xs text-[#7A685F] text-center py-8">No patients today</p>
                  ) : (
                    appointments.map(a => {
                      const phase = a.patient.phase ? PHASES[a.patient.phase] : null;
                      const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.CANCELLED;
                      return (
                        <div
                          key={a.id}
                          onClick={() => router.push(`/dashboard/patients/${a.patient.id}`)}
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#FDF3EC] active:bg-[#FDF3EC] transition-colors duration-150"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar name={a.patient.name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#2B1A14] truncate">{a.patient.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {/* Session time */}
                                <span className="text-[10px] text-[#7A685F] font-medium">
                                  {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span className="text-[#DDD2C2]">·</span>
                                {/* Status pill */}
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.pill}`}>
                                  <span className={`w-1 h-1 rounded-full ${st.dot}`} />
                                  {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                                </span>
                                {/* Phase pill */}
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
                    })
                  )}
                </div>
                {/* Fade-out hint when list overflows */}
                {appointments.length > 5 && (
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent rounded-b-2xl" />
                )}
              </div>
            </div>

            
          </div>
        </div>
      )}
    </div>
  );
}