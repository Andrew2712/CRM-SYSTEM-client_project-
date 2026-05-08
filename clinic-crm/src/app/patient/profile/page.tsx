"use client";

/**
 * src/app/patient/profile/page.tsx
 * Patient self-view of their own profile.
 * Server-side guard: API /api/patient/me only returns data for the logged-in patient.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type Patient = {
  id: string;
  patientCode: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  gender: string;
  address: string;
  purposeOfVisit: string;
  medicalConditions: string;
  status: string;
  phase: string | null;
  totalSessionsPlanned: number;
  createdAt: string;
  appointments: { id: string; startTime: string; sessionType: string; status: string; doctor: { name: string } }[];
  visits: { visitDate: string; notes: string }[];
};

const PHASES: Record<string, { label: string; desc: string }> = {
  PHASE_1: { label: "Phase 1", desc: "Every day" },
  PHASE_2: { label: "Phase 2", desc: "Alternate days" },
  PHASE_3: { label: "Phase 3", desc: "Twice a week" },
  PHASE_4: { label: "Phase 4", desc: "Weekly once" },
  PHASE_5: { label: "Phase 5", desc: "Weekly (maintenance)" },
};

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  ATTENDED:  { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  MISSED:    { pill: "bg-red-50 text-red-700 border border-red-200",             dot: "bg-red-500" },
  CONFIRMED: { pill: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-500" },
  CANCELLED: { pill: "bg-slate-100 text-slate-500 border border-slate-200",      dot: "bg-slate-400" },
};

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[#F5F1E8] last:border-0">
      <div className="w-8 h-8 rounded-lg bg-[#F5F1E8] flex items-center justify-center flex-shrink-0 mt-0.5 text-base">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-[#7A685F] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[#2B1A14] leading-snug break-words">{value || "—"}</p>
      </div>
    </div>
  );
}

export default function PatientProfilePage() {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/patient/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setPatient(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-[#D97332] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#7A685F] font-medium">Loading your profile…</p>
      </div>
    </div>
  );

  if (!patient) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <p className="text-[#7A685F]">Unable to load profile. Please try refreshing.</p>
    </div>
  );

  const attended  = patient.appointments.filter((a) => a.status === "ATTENDED").length;
  const missed    = patient.appointments.filter((a) => a.status === "MISSED").length;
  const upcoming  = patient.appointments.filter((a) => a.status === "CONFIRMED").length;
  const initials  = patient.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const phase     = patient.phase ? PHASES[patient.phase] : null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link href="/patient/dashboard" className="text-[#7A685F] hover:text-[#D97332] transition-colors">
          Dashboard
        </Link>
        <span className="text-[#C8BFB5]">›</span>
        <span className="text-[#2B1A14] font-semibold">My Profile</span>
      </div>

      <div className="grid lg:grid-cols-[320px,1fr] gap-6">

        {/* Left Card */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-[#E8E1D5] shadow-sm overflow-hidden">
            {/* Cover */}
            <div className="h-24 relative"
              style={{ background: "linear-gradient(135deg, #5B1A0E 0%, #3A0F08 100%)" }}>
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle at 30% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
            </div>

            {/* Avatar */}
            <div className="px-6 pb-6">
              <div className="-mt-8 mb-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg"
                  style={{ background: "#F5F1E8", color: "#5B1A0E", border: "3px solid white" }}>
                  {initials}
                </div>
              </div>
              <h2 className="text-xl font-black text-[#2B1A14] leading-tight">{patient.name}</h2>
              <p className="text-sm text-[#7A685F] mt-1 font-medium">{patient.patientCode}</p>
              {phase && (
                <span className="inline-block mt-2 text-xs font-bold px-2.5 py-1 rounded-lg bg-[#FDF3EC] text-[#D97332] border border-[#D97332]/20">
                  {phase.label} — {phase.desc}
                </span>
              )}

              <div className="mt-5 space-y-0">
                <InfoRow icon="📞" label="Phone" value={patient.phone} />
                <InfoRow icon="📧" label="Email" value={patient.email} />
                <InfoRow icon="🎂" label="Age" value={patient.age ? `${patient.age} years old` : "—"} />
                <InfoRow icon="⚧" label="Gender" value={patient.gender ?? "—"} />
                <InfoRow icon="📍" label="Address" value={patient.address ?? "—"} />
                <InfoRow icon="📅" label="Registered" value={new Date(patient.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })} />
              </div>
            </div>
          </div>

          {/* Medical Info */}
          {(patient.purposeOfVisit || patient.medicalConditions) && (
            <div className="bg-white rounded-2xl border border-[#E8E1D5] shadow-sm p-5">
              <h3 className="text-sm font-black text-[#2B1A14] mb-3 uppercase tracking-wide">Medical Info</h3>
              {patient.purposeOfVisit && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-[#7A685F] uppercase tracking-wider mb-1">Purpose of Visit</p>
                  <p className="text-sm text-[#2B1A14]">{patient.purposeOfVisit}</p>
                </div>
              )}
              {patient.medicalConditions && (
                <div>
                  <p className="text-[10px] font-bold text-[#7A685F] uppercase tracking-wider mb-1">Medical Conditions</p>
                  <p className="text-sm text-[#2B1A14]">{patient.medicalConditions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total", value: patient.appointments.length, icon: "📅", cls: "text-[#5B1A0E]" },
              { label: "Attended",  value: attended,  icon: "✅", cls: "text-emerald-700" },
              { label: "Missed",    value: missed,    icon: "⏱️", cls: "text-red-700" },
              { label: "Upcoming",  value: upcoming,  icon: "🔜", cls: "text-amber-700" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-4 border border-[#E8E1D5] shadow-sm text-center">
                <p className="text-2xl mb-1">{s.icon}</p>
                <p className={`text-xl font-black ${s.cls}`}>{s.value}</p>
                <p className="text-[10px] font-semibold text-[#7A685F] uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Appointment History */}
          <div className="bg-white rounded-2xl border border-[#E8E1D5] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#F0EAE0]">
              <h3 className="font-black text-[#2B1A14]">Appointment History</h3>
            </div>
            {patient.appointments.length === 0 ? (
              <div className="p-8 text-center text-[#7A685F] text-sm">No appointments recorded.</div>
            ) : (
              <div className="divide-y divide-[#F5F1E8] max-h-[400px] overflow-y-auto">
                {patient.appointments.map((appt) => {
                  const styles = STATUS_STYLES[appt.status] ?? STATUS_STYLES["CONFIRMED"];
                  const date = new Date(appt.startTime);
                  return (
                    <div key={appt.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#F5F1E8] flex flex-col items-center justify-center flex-shrink-0 text-center">
                        <p className="text-[9px] font-bold text-[#7A685F] uppercase leading-none">
                          {date.toLocaleDateString("en-IN", { month: "short" })}
                        </p>
                        <p className="text-sm font-black text-[#2B1A14] leading-tight">{date.getDate()}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#2B1A14]">
                          {appt.sessionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                        <p className="text-xs text-[#7A685F]">Dr. {appt.doctor.name}</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${styles.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                        {appt.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Visit Notes */}
          {patient.visits.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E8E1D5] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F0EAE0]">
                <h3 className="font-black text-[#2B1A14]">Visit Notes</h3>
              </div>
              <div className="divide-y divide-[#F5F1E8] max-h-[300px] overflow-y-auto">
                {patient.visits.map((v, i) => (
                  <div key={i} className="px-6 py-4">
                    <p className="text-xs font-semibold text-[#7A685F] mb-1">
                      {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-sm text-[#2B1A14]">{v.notes || "No notes recorded."}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
