"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

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

const PHASES: Record<string, { label: string; desc: string; color: string }> = {
  PHASE_1: { label: "Phase 1", desc: "Every day", color: "bg-purple-50 text-purple-700" },
  PHASE_2: { label: "Phase 2", desc: "Alternate days", color: "bg-blue-50 text-blue-700" },
  PHASE_3: { label: "Phase 3", desc: "Twice a week", color: "bg-teal-50 text-teal-700" },
  PHASE_4: { label: "Phase 4", desc: "Weekly once", color: "bg-amber-50 text-amber-700" },
  PHASE_5: { label: "Phase 5", desc: "Weekly once (maintenance)", color: "bg-green-50 text-green-700" },
};

export default function DoctorPage() {
  const { data: session } = useSession();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<SessionHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNotes, setSavedNotes] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);

  // Week stats
  const [weekStats, setWeekStats] = useState({ attended: 0, missed: 0, upcoming: 0 });

  // Session history panel
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

    // Today's sessions only
    const todayAppts = data.filter((a: Appointment) => {
      const d = new Date(a.startTime);
      return d >= todayStart && d < todayEnd;
    });

    // This week stats
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekAppts = data.filter((a: Appointment) => {
      const d = new Date(a.startTime);
      return d >= weekStart && d < weekEnd;
    });

    setAppointments(todayAppts);
    setAllAppointments(data);
    setWeekStats({
      attended: weekAppts.filter((a: Appointment) => a.status === "ATTENDED").length,
      missed: weekAppts.filter((a: Appointment) => a.status === "MISSED").length,
      upcoming: weekAppts.filter((a: Appointment) => a.status === "CONFIRMED").length,
    });
    setLoading(false);
  }

  useEffect(() => { loadAppointments(); }, []);

  async function saveNote(id: string) {
    setSavingNote(id);
    const noteText = notes[id] ?? "";
    // Save the note via PATCH – keep current status but update notes
    const appt = appointments.find(a => a.id === id);
    if (!appt) { setSavingNote(null); return; }
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: appt.status, notes: noteText }),
    });
    setSavedNotes(prev => ({ ...prev, [id]: noteText }));
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

  const missed = appointments.filter(a => a.status === "MISSED");
  const canUpdate = ["ADMIN", "DOCTOR"].includes(session?.user?.role ?? "");

  // Filtered history
  const filteredHistory = historyFilter
    ? allAppointments.filter(a => a.status === historyFilter)
    : allAppointments;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Doctor dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-teal-50 text-teal-700 px-3 py-1 rounded-full font-medium">
            {appointments.length} today
          </span>
          <button
            onClick={() => { setShowHistory(!showHistory); setHistoryFilter(null); }}
            className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {showHistory ? "← Schedule" : "Session history →"}
          </button>
        </div>
      </div>

      {/* Missed session alerts */}
      {missed.length > 0 && (
        <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-xl">
          <div className="text-sm font-medium text-red-700 mb-1">Missed session alerts</div>
          {missed.map(a => (
            <div key={a.id} className="text-xs text-red-600 mt-0.5 flex items-center gap-2">
              <span>{a.patient.name}</span>
              <span>—</span>
              <span>{new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              <span>· Auto-flagged</span>
              <Link href={`/dashboard/patients/${a.patient.id}`}
                className="underline hover:text-red-800 ml-1">View patient →</Link>
            </div>
          ))}
        </div>
      )}

      {/* ── SESSION HISTORY PANEL ── */}
      {showHistory ? (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-900">
              Session history
              {historyFilter && (
                <span className="ml-2 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                  {historyFilter}
                  <button onClick={() => setHistoryFilter(null)} className="ml-1 text-teal-400 hover:text-teal-600">×</button>
                </span>
              )}
            </h2>
            <span className="text-xs text-gray-400">{filteredHistory.length} sessions</span>
          </div>

          {/* This week stats — clickable to filter */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Attended", value: weekStats.attended, color: "text-green-600", bg: "hover:bg-green-50", filter: "ATTENDED" },
              { label: "Missed", value: weekStats.missed, color: "text-red-500", bg: "hover:bg-red-50", filter: "MISSED" },
              { label: "Upcoming", value: weekStats.upcoming, color: "text-blue-600", bg: "hover:bg-blue-50", filter: "CONFIRMED" },
            ].map(s => (
              <button key={s.label}
                onClick={() => setHistoryFilter(historyFilter === s.filter ? null : s.filter)}
                className={`bg-gray-50 rounded-xl p-3 text-center cursor-pointer transition-colors ${s.bg}
                  ${historyFilter === s.filter ? "ring-2 ring-offset-1 ring-teal-400" : ""}`}>
                <div className="text-xs text-gray-400 mb-1">This week · {s.label}</div>
                <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">Date</th>
                <th className="text-left pb-2 font-medium">Patient</th>
                <th className="text-left pb-2 font-medium">Type</th>
                <th className="text-left pb-2 font-medium">Doctor</th>
                <th className="text-left pb-2 font-medium">Status</th>
                <th className="text-left pb-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs text-gray-400">No sessions found</td></tr>
              ) : filteredHistory.map(a => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="py-2.5 text-xs text-gray-500">
                    {new Date(a.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    <span className="block text-gray-400">
                      {new Date(a.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="text-sm font-medium text-gray-900">{a.patient.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{a.patient.patientCode}</div>
                  </td>
                  <td className="py-2.5 text-xs text-gray-500">{a.sessionType.replace(/_/g, " ")}</td>
                  <td className="py-2.5 text-xs text-gray-500">{a.doctor.name}</td>
                  <td className="py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${a.status === "ATTENDED" ? "bg-green-50 text-green-700" :
                        a.status === "MISSED" ? "bg-red-50 text-red-600" :
                        a.status === "CONFIRMED" ? "bg-blue-50 text-blue-600" :
                        "bg-gray-100 text-gray-500"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <Link href={`/dashboard/patients/${a.patient.id}`}
                      className="text-xs text-teal-600 hover:text-teal-800 border border-teal-100 px-2 py-1 rounded-lg">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      ) : (
        /* ── MAIN SCHEDULE VIEW ── */
        <div className="grid grid-cols-2 gap-5">

          {/* Today's schedule */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Today's schedule</h2>
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
            ) : appointments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No appointments today</p>
            ) : (
              <div className="space-y-3">
                {appointments.map(a => {
                  const now = new Date();
                  // Use local time for "in progress" check
                  const start = new Date(a.startTime);
                  const end = new Date(a.endTime);
                  const isNow = start <= now && end >= now;

                  return (
                    <div key={a.id} className={`rounded-lg border p-3 transition-colors
                      ${isNow ? "border-teal-200 bg-teal-50" : "border-gray-100 hover:bg-gray-50"}`}>

                      {/* Patient row */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-xs font-medium text-gray-400 w-14 flex-shrink-0">
                          {/* Show time in IST — stored as UTC in DB, display in local */}
                          {start.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 text-xs font-semibold flex-shrink-0">
                          {a.patient.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">{a.patient.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-1.5 flex-wrap">
                            <span>{a.sessionType.replace(/_/g, " ")}</span>
                            <span>·</span>
                            <span className="font-mono">{a.patient.patientCode}</span>
                            {a.patient.phase && PHASES[a.patient.phase] && (
                              <>
                                <span>·</span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${PHASES[a.patient.phase].color}`}>
                                  {PHASES[a.patient.phase].label}
                                </span>
                              </>
                            )}
                          </div>
                          {a.patient.purposeOfVisit && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">
                              {a.patient.purposeOfVisit}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${a.status === "ATTENDED" ? "bg-green-50 text-green-700" :
                              a.status === "MISSED" ? "bg-red-50 text-red-600" :
                              isNow ? "bg-amber-50 text-amber-600" :
                              "bg-blue-50 text-blue-600"}`}>
                            {isNow && a.status === "CONFIRMED" ? "In progress" : a.status}
                          </span>
                          <Link href={`/dashboard/patients/${a.patient.id}`}
                            className="text-xs text-teal-600 hover:underline">
                            View profile →
                          </Link>
                        </div>
                      </div>

                      {/* Notes for any CONFIRMED session */}
                      {canUpdate && a.status === "CONFIRMED" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <textarea
                              rows={2}
                              placeholder="Session notes (will appear in patient dashboard)..."
                              value={notes[a.id] ?? ""}
                              onChange={e => setNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-teal-400"
                            />
                            <button
                              onClick={() => saveNote(a.id)}
                              disabled={savingNote === a.id}
                              className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 px-2 py-1.5 rounded-lg border border-gray-200 font-medium disabled:opacity-50 self-start transition-colors whitespace-nowrap"
                            >
                              {savingNote === a.id ? "Saving..." : "Save note"}
                            </button>
                          </div>
                          {savedNotes[a.id] && (
                            <div className="text-xs text-teal-600 bg-teal-50 px-2 py-1 rounded-lg">
                              ✓ Note saved — visible in patient dashboard
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              disabled={updating === a.id}
                              onClick={() => updateStatus(a.id, "ATTENDED")}
                              className="flex-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 py-1.5 rounded-lg border border-green-100 font-medium disabled:opacity-50 transition-colors">
                              {updating === a.id ? "Saving..." : "✓ Mark attended"}
                            </button>
                            <button
                              disabled={updating === a.id}
                              onClick={() => updateStatus(a.id, "MISSED")}
                              className="flex-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-lg border border-red-100 font-medium disabled:opacity-50 transition-colors">
                              {updating === a.id ? "Saving..." : "✗ Mark missed"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Completed */}
                      {(a.status === "ATTENDED" || a.status === "MISSED") && (
                        <div className={`mt-2 text-xs px-2 py-1 rounded-lg
                          ${a.status === "ATTENDED" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                          {a.status === "ATTENDED" ? "✓ Session completed and recorded in patient dashboard" : "✗ Marked as missed — patient notified"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-4">

            {/* This week stats — clickable → opens session history with filter */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-900">This week</h2>
                <button onClick={() => { setShowHistory(true); setHistoryFilter(null); }}
                  className="text-xs text-teal-600 hover:underline">
                  Full history →
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Attended", value: weekStats.attended, color: "text-green-600", filter: "ATTENDED" },
                  { label: "Missed", value: weekStats.missed, color: "text-red-500", filter: "MISSED" },
                  { label: "Upcoming", value: weekStats.upcoming, color: "text-blue-600", filter: "CONFIRMED" },
                ].map(s => (
                  <button key={s.label}
                    onClick={() => { setHistoryFilter(s.filter); setShowHistory(true); }}
                    className="bg-gray-50 hover:bg-teal-50 rounded-xl p-3 text-center cursor-pointer transition-colors group">
                    <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                    <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-300 group-hover:text-teal-400 mt-1 transition-colors"></div>
                  </button>
                ))}
              </div>
            </div>

            {/* Patient quick-lookup today */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-900 mb-3">Today's patients</h2>
              {appointments.length === 0 ? (
                <p className="text-xs text-gray-400">No patients scheduled today.</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 hover:bg-teal-50 transition-colors">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{a.patient.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{a.patient.patientCode}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.patient.phase && PHASES[a.patient.phase] && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASES[a.patient.phase].color}`}>
                            {PHASES[a.patient.phase].label}
                          </span>
                        )}
                        <Link href={`/dashboard/patients/${a.patient.id}`}
                          className="text-xs text-teal-600 hover:text-teal-800 border border-teal-100 px-2 py-1 rounded-lg">
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Phase legend */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-medium text-gray-900 mb-3">Treatment phases</h2>
              <div className="space-y-2">
                {Object.entries(PHASES).map(([key, p]) => (
                  <div key={key} className="flex items-center gap-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${p.color}`}>
                      {p.label}
                    </span>
                    <span className="text-xs text-gray-500">{p.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}