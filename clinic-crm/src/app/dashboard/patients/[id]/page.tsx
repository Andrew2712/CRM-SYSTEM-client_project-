"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";

type Appointment = {
  id: string; startTime: string; sessionType: string;
  status: string; doctor: { name: string };
};

type Patient = {
  id: string; patientCode: string; name: string; phone: string;
  email: string; age: number; gender: string; address: string;
  purposeOfVisit: string; medicalConditions: string;
  status: string; phase: string | null; totalSessionsPlanned: number;
  createdAt: string;
  appointments: Appointment[];
  visits: { notes: string; visitDate: string; appointment: { id: string } }[];
};

const PHASES: Record<string, { label: string; desc: string; color: string; bg: string; border: string; dot: string; ring: string }> = {
  PHASE_1: { label: "Phase 1", desc: "Every day",                color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", dot: "bg-violet-500",  ring: "ring-violet-300" },
  PHASE_2: { label: "Phase 2", desc: "Alternate days",           color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   dot: "bg-blue-500",    ring: "ring-blue-300" },
  PHASE_3: { label: "Phase 3", desc: "Twice a week",             color: "text-teal-700",   bg: "bg-teal-50",    border: "border-teal-200",   dot: "bg-teal-500",    ring: "ring-teal-300" },
  PHASE_4: { label: "Phase 4", desc: "Weekly once",              color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", ring: "ring-emerald-300" },
  PHASE_5: { label: "Phase 5", desc: "Weekly once (maintenance)",color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  dot: "bg-amber-500",   ring: "ring-amber-300" },
};

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  ATTENDED:  { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  MISSED:    { pill: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-500" },
  CONFIRMED: { pill: "bg-blue-50 text-blue-600 border border-blue-200",          dot: "bg-blue-500" },
  CANCELLED: { pill: "bg-gray-100 text-gray-500 border border-gray-200",         dot: "bg-gray-400" },
};

// ── Pure helper — no hooks, safe to call anywhere ─────────────────────────────
function maskPhone(phone: string, role: string): string {
  if (!phone) return "—";
  if (role === "ADMIN") return phone;
  if (role === "DOCTOR") return `••••••${phone.slice(-4)}`;
  return phone;
}

// ── InfoRow — pure component, no hooks ───────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-gray-400 text-sm">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 leading-snug">{value || "—"}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientProfile() {
  const params = useParams();
  const { data: session } = useSession(); // ✅ ONLY inside component body

  const role = session?.user?.role ?? "";

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [totalSessions, setTotalSessions] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"sessions" | "notes">("sessions");

  const canEdit = ["ADMIN", "DOCTOR"].includes(role);

  async function loadPatient() {
    const res = await fetch(`/api/patients/${params.id}`, { credentials: "include" });
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    setPatient(data);
    setTotalSessions(data.totalSessionsPlanned ?? 0);
    setPhase(data.phase && PHASES[data.phase] ? data.phase : null);
    setLoading(false);
  }

  useEffect(() => { loadPatient(); }, [params.id]);

  async function saveChanges() {
    setSaving(true);
    const body: Record<string, unknown> = { totalSessionsPlanned: totalSessions };
    body.phase = phase ?? null;

    await fetch(`/api/patients/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setEditing(false);
    loadPatient();
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Loading patient profile…</p>
      </div>
    </div>
  );

  if (!patient) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="text-base font-semibold text-gray-700">Patient not found</p>
        <p className="text-sm text-gray-400 mt-1">This patient record may have been removed.</p>
        <Link href="/dashboard/patients" className="mt-4 inline-block text-sm text-teal-600 font-medium hover:underline">← Back to Patients</Link>
      </div>
    </div>
  );

  const attended = patient.appointments.filter(a => a.status === "ATTENDED").length;
  const missed   = patient.appointments.filter(a => a.status === "MISSED").length;
  const upcoming = patient.appointments.filter(a => a.status === "CONFIRMED").length;
  const total    = patient.appointments.length;

  const filteredAppointments = statusFilter
    ? patient.appointments.filter(a => a.status === statusFilter)
    : patient.appointments;

  const latestNote   = patient.visits?.[0]?.notes;
  const currentPhase = phase && PHASES[phase] ? PHASES[phase] : null;
  const progressPct  = patient.totalSessionsPlanned > 0
    ? Math.min((attended / patient.totalSessionsPlanned) * 100, 100)
    : 0;

  const initials = patient.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50/80">

      {/* ── Top nav bar ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/dashboard/patients" className="text-gray-400 hover:text-teal-600 transition-colors flex items-center gap-1.5 font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Patients
          </Link>
          <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-gray-800">{patient.name}</span>
          <span className="text-gray-300 mx-1">·</span>
          <span className="font-mono text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{patient.patientCode}</span>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
          patient.status === "NEW"
            ? "bg-blue-50 text-blue-600 border-blue-200"
            : "bg-teal-50 text-teal-700 border-teal-200"
        }`}>
          {patient.status}
        </span>
      </div>

      <div className="max-w-[1400px] mx-auto p-6">
        <div className="grid grid-cols-[360px_1fr] gap-6 items-start">

          {/* ════════ LEFT COLUMN ════════ */}
          <div className="space-y-5">

            {/* Identity card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="relative">
                <div className="h-24 bg-gradient-to-br from-teal-600 via-teal-500 to-cyan-400 relative overflow-hidden">
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full" />
                  <div className="absolute -right-2 top-8 w-12 h-12 bg-white/10 rounded-full" />
                  <div className="absolute left-1/2 -bottom-4 w-32 h-8 bg-white/5 rounded-full blur-md" />
                </div>
                <div className="absolute left-6 top-14 z-10">
                  <div className="w-20 h-20 rounded-2xl bg-white shadow-lg flex items-center justify-center text-teal-600 text-2xl font-bold border-2 border-white">
                    {initials}
                  </div>
                </div>
              </div>

              <div className="px-5 pb-5 pt-14">
                <div className="mb-5">
                  <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">{patient.name}</h1>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{patient.patientCode}</p>
                </div>
                <div className="space-y-1">
                  {/* ✅ maskPhone called here, inside component, using role from hook */}
                  <InfoRow icon="📞" label="Phone"      value={maskPhone(patient.phone, role)} />
                  <InfoRow icon="✉️" label="Email"      value={patient.email ?? "—"} />
                  <InfoRow icon="🎂" label="Age"        value={patient.age ? `${patient.age} years old` : "—"} />
                  <InfoRow icon="⚧"  label="Gender"     value={patient.gender ?? "—"} />
                  <InfoRow icon="📍" label="Address"    value={patient.address ?? "—"} />
                  <InfoRow icon="🗓" label="Registered" value={new Date(patient.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
                </div>
              </div>
            </div>

            {/* Clinical Info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-gray-800">Clinical Info</h2>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Purpose of Visit</p>
                  <p className="text-sm font-medium text-gray-800">{patient.purposeOfVisit ?? "—"}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Medical Conditions</p>
                  <p className="text-sm font-medium text-gray-800">{patient.medicalConditions ?? "—"}</p>
                </div>
                {latestNote && (
                  <div className="bg-teal-50 border border-teal-100 rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest">Latest Doctor Note</p>
                    </div>
                    <p className="text-sm text-teal-900 leading-relaxed">{latestNote}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Treatment Plan */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-800">Treatment Plan</h2>
                      <p className="text-[10px] text-gray-400">Phase &amp; session management</p>
                    </div>
                  </div>
                  {canEdit && !editing && (
                    <button onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition-all">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              <div className="p-5">
                {editing ? (
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-3">Treatment Phase</label>
                      <div className="space-y-2">
                        <button onClick={() => setPhase(null)}
                          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all ${
                            phase === null ? "border-gray-300 bg-gray-50 shadow-sm" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
                          }`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${phase === null ? "bg-gray-200" : "bg-gray-100"}`}>
                            <span className="w-2 h-2 rounded-full bg-gray-400 block" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-600">Not assigned</p>
                            <p className="text-xs text-gray-400">No phase selected yet</p>
                          </div>
                          {phase === null && (
                            <div className="w-5 h-5 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>

                        {Object.entries(PHASES).map(([key, val]) => (
                          <button key={key} onClick={() => setPhase(key)}
                            className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 text-left transition-all ${
                              phase === key ? `${val.border} ${val.bg} shadow-sm` : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/50"
                            }`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${phase === key ? val.bg : "bg-gray-100"}`}>
                              <span className={`w-2.5 h-2.5 rounded-full ${val.dot} block`} />
                            </div>
                            <div className="flex-1">
                              <p className={`text-sm font-bold ${phase === key ? val.color : "text-gray-700"}`}>{val.label}</p>
                              <p className="text-xs text-gray-400">{val.desc}</p>
                            </div>
                            {phase === key && (
                              <div className={`w-5 h-5 rounded-full ${val.dot} flex items-center justify-center flex-shrink-0`}>
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Total Sessions Planned</label>
                      <div className="relative">
                        <input type="number" min={0} value={totalSessions}
                          onChange={e => setTotalSessions(Number(e.target.value))}
                          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-0 focus:border-teal-400 transition-colors"
                          placeholder="e.g. 20" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">sessions</span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 pt-1">
                      <button onClick={saveChanges} disabled={saving}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2">
                        {saving ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                        ) : saved ? (
                          <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> Saved!</>
                        ) : "Save Changes"}
                      </button>
                      <button onClick={() => { setEditing(false); setPhase(patient.phase && PHASES[patient.phase] ? patient.phase : null); setTotalSessions(patient.totalSessionsPlanned ?? 0); }}
                        className="px-5 text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border-2 border-gray-100 rounded-xl transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentPhase ? (
                      <div className={`flex items-center gap-3 p-3.5 rounded-xl border ${currentPhase.bg} ${currentPhase.border}`}>
                        <div className={`w-9 h-9 rounded-xl ${currentPhase.bg} border ${currentPhase.border} flex items-center justify-center flex-shrink-0`}>
                          <span className={`w-3 h-3 rounded-full ${currentPhase.dot} block`} />
                        </div>
                        <div>
                          <p className={`text-sm font-extrabold ${currentPhase.color}`}>{currentPhase.label}</p>
                          <p className="text-xs text-gray-500">{currentPhase.desc}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/80">
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <span className="w-3 h-3 rounded-full bg-gray-300 block" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-500">Phase Not Assigned</p>
                          <p className="text-xs text-gray-400">Pending doctor assignment</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-extrabold text-gray-800">
                          {patient.totalSessionsPlanned > 0 ? patient.totalSessionsPlanned : "—"}
                        </p>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Planned</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-2xl font-extrabold text-emerald-600">{attended}</p>
                        <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mt-0.5">Completed</p>
                      </div>
                    </div>

                    {patient.totalSessionsPlanned > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-gray-500">Progress</span>
                          <span className="text-sm font-extrabold text-gray-700">{Math.round(progressPct)}%</span>
                        </div>
                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${progressPct}%`,
                              background: progressPct >= 80
                                ? "linear-gradient(90deg, #10b981, #059669)"
                                : progressPct >= 40
                                ? "linear-gradient(90deg, #14b8a6, #0d9488)"
                                : "linear-gradient(90deg, #5eead4, #14b8a6)"
                            }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5 font-medium">{attended} of {patient.totalSessionsPlanned} sessions completed</p>
                      </div>
                    )}

                    {!currentPhase && canEdit && (
                      <button onClick={() => setEditing(true)}
                        className="w-full mt-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/60 text-teal-600 text-xs font-semibold hover:bg-teal-50 hover:border-teal-300 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        Assign Treatment Phase
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════ RIGHT COLUMN ════════ */}
          <div className="space-y-5">

            {/* Stat cards */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total",    value: total,    color: "text-gray-700",    bg: "bg-gray-100",    filter: null,        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
                { label: "Attended", value: attended, color: "text-emerald-700", bg: "bg-emerald-100", filter: "ATTENDED",  icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                { label: "Missed",   value: missed,   color: "text-red-600",     bg: "bg-red-100",     filter: "MISSED",    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                { label: "Upcoming", value: upcoming, color: "text-blue-700",    bg: "bg-blue-100",    filter: "CONFIRMED", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              ].map(s => (
                <button key={s.label}
                  onClick={() => setStatusFilter(statusFilter === s.filter ? null : s.filter)}
                  className={`bg-white rounded-2xl border shadow-sm p-4 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${
                    statusFilter === s.filter ? "border-gray-300 ring-2 ring-gray-200 shadow-md" : "border-gray-100"
                  }`}>
                  <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center ${s.color} mb-3`}>{s.icon}</div>
                  <div className={`text-3xl font-black ${s.color} mb-1`}>{s.value}</div>
                  <div className="text-xs font-semibold text-gray-400">{s.label}</div>
                </button>
              ))}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-100 px-5">
                {([
                  { key: "sessions", label: "Session History", count: filteredAppointments.length },
                  { key: "notes",    label: "Visit Notes",     count: patient.visits?.length ?? 0 },
                ] as const).map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold border-b-2 transition-colors mr-2 ${
                      activeTab === tab.key ? "border-teal-500 text-teal-600" : "border-transparent text-gray-400 hover:text-gray-600"
                    }`}>
                    {tab.label}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      activeTab === tab.key ? "bg-teal-50 text-teal-600" : "bg-gray-100 text-gray-400"
                    }`}>{tab.count}</span>
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-3 py-3">
                  {activeTab === "sessions" && statusFilter && (
                    <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                      statusFilter === "ATTENDED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      statusFilter === "MISSED"   ? "bg-red-50 text-red-600 border-red-200" :
                      "bg-blue-50 text-blue-600 border-blue-200"
                    }`}>
                      {statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}
                      <button onClick={() => setStatusFilter(null)} className="opacity-60 hover:opacity-100 text-base leading-none">×</button>
                    </span>
                  )}
                  {canEdit && (
                    <Link href="/dashboard/doctor"
                      className="text-xs text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1 bg-teal-50 hover:bg-teal-100 border border-teal-100 px-3 py-1.5 rounded-lg transition-colors">
                      Update status
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </div>
              </div>

              {activeTab === "sessions" && (
                filteredAppointments.length === 0 ? (
                  <div className="py-20 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-500">No sessions found</p>
                    <p className="text-xs text-gray-400 mt-1">{statusFilter ? "Try removing the filter" : "Sessions will appear here once booked"}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50/80">
                          <th className="text-left px-5 py-3.5">Date</th>
                          <th className="text-left px-5 py-3.5">Session Type</th>
                          <th className="text-left px-5 py-3.5">Doctor</th>
                          <th className="text-left px-5 py-3.5">Status</th>
                          <th className="text-left px-5 py-3.5">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppointments.map(a => {
                          const visit = patient.visits?.find(v => v.appointment?.id === a.id);
                          const style = STATUS_STYLES[a.status] ?? STATUS_STYLES.CANCELLED;
                          return (
                            <tr key={a.id} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                              <td className="px-5 py-4 text-xs font-semibold text-gray-700 whitespace-nowrap">
                                {new Date(a.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                                  {a.sessionType.replace(/_/g, " ")}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-[10px] font-bold flex-shrink-0">
                                    {a.doctor.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                  </div>
                                  <span className="text-xs font-medium text-gray-700">{a.doctor.name}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${style.pill}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                  {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-xs text-gray-500 max-w-[200px]">
                                {visit?.notes
                                  ? <span className="truncate block">{visit.notes}</span>
                                  : <span className="text-gray-300 italic">No notes</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {activeTab === "notes" && (
                !patient.visits?.length ? (
                  <div className="py-20 text-center">
                    <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-500">No visit notes yet</p>
                    <p className="text-xs text-gray-400 mt-1">Notes will appear here after doctor visits</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-3">
                    {patient.visits.map((v, i) => (
                      <div key={i} className="flex gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100/60 transition-colors">
                        <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-400 mb-1">
                            {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {v.notes || <span className="italic text-gray-400">No notes recorded</span>}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}