"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import RescheduleModal from "@/components/RescheduleModal";
import ReassignDoctorModal from "@/components/ReassignDoctorModal";

type Doctor = { id: string; name: string };
type Patient = {
  id: string; patientCode: string; name: string;
  phase: string; totalSessionsPlanned: number;
  appointments: { status: string }[];
};
type Appointment = {
  id: string; startTime: string; sessionType: string; status: string;
  doctorId?: string;
  patient: { id: string; name: string; patientCode: string };
  doctor: { id?: string; name: string };
};

const PHASES: Record<string, { label: string; desc: string; hint: string; color: string; dot: string }> = {
  PHASE_1: { label: "Phase 1", desc: "Every day",                 hint: "Book daily sessions",       color: "bg-violet-50 text-violet-700 border border-violet-200", dot: "bg-violet-500" },
  PHASE_2: { label: "Phase 2", desc: "Alternate days",            hint: "Book every other day",       color: "bg-blue-50 text-blue-700 border border-blue-200",       dot: "bg-blue-500" },
  PHASE_3: { label: "Phase 3", desc: "Twice a week",              hint: "Book Mon+Thu or Tue+Fri",    color: "bg-teal-50 text-teal-700 border border-teal-200",       dot: "bg-teal-500" },
  PHASE_4: { label: "Phase 4", desc: "Weekly once",               hint: "Book once per week",         color: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500" },
  PHASE_5: { label: "Phase 5", desc: "Weekly once (maintenance)", hint: "Maintenance — once a week",  color: "bg-amber-50 text-amber-700 border border-amber-200",    dot: "bg-amber-500" },
};

const STATUS_CONFIG: Record<string, { pill: string; dot: string; label: string }> = {
  ATTENDED:    { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Attended" },
  MISSED:      { pill: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-500",     label: "Missed" },
  CONFIRMED:   { pill: "bg-sky-50 text-sky-700 border border-sky-200",             dot: "bg-sky-500",     label: "Confirmed" },
  CANCELLED:   { pill: "bg-gray-100 text-gray-500 border border-gray-200",         dot: "bg-gray-400",    label: "Cancelled" },
  RESCHEDULED: { pill: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-500",   label: "Rescheduled" },
};

const SESSION_TYPES = [
  { value: "INITIAL_ASSESSMENT", label: "Initial Assessment" },
  { value: "FOLLOW_UP",          label: "Follow-up" },
  { value: "SPECIALIZED",        label: "Specialized" },
];

const TIMES = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"];

function suggestNextDate(phase: string): string {
  const today = new Date();
  let daysAhead = 1;
  if (phase === "PHASE_2") daysAhead = 2;
  else if (phase === "PHASE_3") daysAhead = 3;
  else if (phase === "PHASE_4" || phase === "PHASE_5") daysAhead = 7;
  const next = new Date(today);
  next.setDate(today.getDate() + daysAhead);
  return next.toISOString().split("T")[0];
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
  const colors = ["bg-amber-100 text-amber-800","bg-orange-100 text-orange-800","bg-teal-100 text-teal-800","bg-violet-100 text-violet-800","bg-blue-100 text-blue-800","bg-rose-100 text-rose-800"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-7 h-7 text-[10px]" : "w-9 h-9 text-xs";
  return <div className={`${sz} ${color} rounded-xl flex items-center justify-center font-black flex-shrink-0`}>{initials}</div>;
}

const inputCls = "w-full bg-[#FAF8F2] border-2 border-[#4A0F06]/12 rounded-xl px-4 py-3 text-sm font-medium text-[#4A0F06] placeholder:text-[#4A0F06]/30 focus:outline-none focus:ring-0 focus:border-[#D86F32]/50 transition-all";
const labelCls = "block text-[11px] font-bold text-[#4A0F06]/50 uppercase tracking-widest mb-1.5";

export default function BookingPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const canManage = ["ADMIN", "RECEPTIONIST"].includes(role);

  const [doctors, setDoctors]                 = useState<Doctor[]>([]);
  const [patients, setPatients]               = useState<Patient[]>([]);
  const [upcoming, setUpcoming]               = useState<Appointment[]>([]);
  const [patientSearch, setPatientSearch]     = useState("");
  const [showDropdown, setShowDropdown]       = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [upcomingFilter, setUpcomingFilter]   = useState("ALL");
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");
  const [error, setError]       = useState("");
  const [cancelling, setCancelling]           = useState<string | null>(null);
  const [rescheduleAppt, setRescheduleAppt]   = useState<Appointment | null>(null);
  const [reassignAppt, setReassignAppt]       = useState<Appointment | null>(null);

  const [form, setForm] = useState({
    patientId: "", doctorId: "",
    sessionType: "INITIAL_ASSESSMENT",
    date: "", time: "09:00",
  });

  useEffect(() => {
    fetch("/api/doctors",{credentials:"include"}).then(r=>r.json()).then(d=>setDoctors(Array.isArray(d)?d:[])).catch(()=>{});
    fetch("/api/patients",{credentials:"include"}).then(r=>r.json()).then(d=>setPatients(Array.isArray(d)?d:[])).catch(()=>{});
    loadUpcoming();
  }, []);

  function loadUpcoming() {
    fetch("/api/appointments",{credentials:"include"}).then(r=>r.json()).then(d=>setUpcoming(Array.isArray(d)?d:[])).catch(()=>{});
  }

  function handlePatientSelect(p: Patient) {
    setSelectedPatient(p); setPatientSearch(p.name); setShowDropdown(false);
    setForm(f => ({...f, patientId: p.id, date: p.phase ? suggestNextDate(p.phase) : f.date}));
  }

  function clearPatient() {
    setSelectedPatient(null); setPatientSearch(""); setForm(f => ({...f, patientId: ""}));
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    const [year, month, day] = form.date.split("-").map(Number);
    const [hour, minute]     = form.time.split(":").map(Number);
    const startLocal = new Date(year, month-1, day, hour, minute, 0);
    const endLocal   = new Date(year, month-1, day, hour+1, minute, 0);
    const res = await fetch("/api/appointments", {
      method: "POST", headers: {"Content-Type":"application/json"}, credentials: "include",
      body: JSON.stringify({...form, startTime: startLocal.toISOString(), endTime: endLocal.toISOString()}),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setSuccess(`Booking confirmed for ${selectedPatient?.name ?? "patient"}!`);
      setForm({patientId:"",doctorId:"",sessionType:"INITIAL_ASSESSMENT",date:"",time:"09:00"});
      clearPatient(); loadUpcoming();
      setTimeout(() => setSuccess(""), 5000);
    } else { setError(data.error ?? "Booking failed. Please try again."); }
  }

  async function handleCancel(apptId: string) {
    if (!confirm("Cancel this appointment?")) return;
    setCancelling(apptId);
    try {
      await fetch(`/api/appointments/${apptId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"CANCELLED"})});
      loadUpcoming();
    } finally { setCancelling(null); }
  }

  const filteredPatients = patientSearch.length > 1
    ? patients.filter(p => p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.patientCode.toLowerCase().includes(patientSearch.toLowerCase()))
    : patients.slice(0, 6);

  const filteredUpcoming = upcomingFilter === "ALL" ? upcoming : upcoming.filter(a => a.status === upcomingFilter);

  const todayStr       = new Date().toISOString().split("T")[0];
  const confirmedCount = upcoming.filter(a => a.status === "CONFIRMED").length;
  const attendedCount  = upcoming.filter(a => a.status === "ATTENDED").length;
  const missedCount    = upcoming.filter(a => a.status === "MISSED").length;

  return (
    <div className="min-h-screen bg-[#F5F2E8] p-4 sm:p-6">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-[#4A0F06] rounded-xl flex items-center justify-center shadow-md shadow-[#4A0F06]/20">
              <svg className="w-4 h-4 text-[#F5F2E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#4A0F06] tracking-tight">Booking Engine</h1>
          </div>
          <p className="text-sm text-[#4A0F06]/40 ml-[42px]">Schedule and manage patient appointments</p>
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Confirmed", value: confirmedCount, color: "text-sky-700",     bg: "bg-sky-50 border-sky-200",         dot: "bg-sky-500",     filter: "CONFIRMED" },
            { label: "Attended",  value: attendedCount,  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", filter: "ATTENDED" },
            { label: "Missed",    value: missedCount,    color: "text-red-600",     bg: "bg-red-50 border-red-200",         dot: "bg-red-500",     filter: "MISSED" },
          ].map(s => (
            <button key={s.label}
              onClick={() => setUpcomingFilter(upcomingFilter === s.filter ? "ALL" : s.filter)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm ${upcomingFilter === s.filter ? `${s.bg} ring-2 ring-offset-1 ring-current` : `bg-[#FAF8F2] border-[#4A0F06]/10 hover:bg-[#D86F32]/5 hover:border-[#D86F32]/20`} ${s.color}`}>
              <span className={`w-2 h-2 rounded-full ${s.dot}`}/>{s.value} {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout — stacks on mobile, side-by-side on lg+ */}
      <div className="flex flex-col lg:grid lg:grid-cols-[480px_1fr] gap-5 sm:gap-6 items-start">

        {/* LEFT — Booking form */}
        <div className="bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/8 shadow-sm overflow-hidden w-full">
          {/* Form header */}
          <div className="px-6 py-5 border-b border-[#4A0F06]/8 relative overflow-hidden" style={{background: "linear-gradient(135deg, #4A0F06, #5C1408)"}}>
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/8 rounded-full"/>
            <div className="absolute right-8 bottom-0 w-10 h-10 bg-white/8 rounded-full"/>
            <div className="relative">
              <h2 className="text-base font-bold text-[#F5F2E8]">New Appointment</h2>
              <p className="text-xs text-[#F5F2E8]/60 mt-0.5">Fill in details to schedule a session</p>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {success && (
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{success}</p>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </div>
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleBook} className="space-y-5">
              {/* Patient search */}
              <div>
                <label className={labelCls}>Patient <span className="text-[#D86F32]">*</span></label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                  </div>
                  <input type="text" placeholder="Search by name or patient ID…" value={patientSearch} autoComplete="off"
                    onChange={e => { setPatientSearch(e.target.value); setShowDropdown(true); if (!e.target.value) clearPatient(); }}
                    onFocus={() => setShowDropdown(true)}
                    className={`${inputCls} pl-10 ${selectedPatient ? "pr-10" : ""}`}/>
                  {selectedPatient && (
                    <button type="button" onClick={clearPatient} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A0F06]/30 hover:text-[#4A0F06]/60">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  )}
                </div>
                {showDropdown && !selectedPatient && filteredPatients.length > 0 && (
                  <div className="mt-1.5 bg-[#FAF8F2] border-2 border-[#4A0F06]/12 rounded-xl overflow-hidden shadow-lg z-10 relative">
                    {filteredPatients.slice(0,8).map(p => (
                      <button key={p.id} type="button" onMouseDown={() => handlePatientSelect(p)}
                        className="w-full text-left px-4 py-3 hover:bg-[#D86F32]/8 border-b border-[#4A0F06]/5 last:border-0 transition-colors flex items-center gap-3">
                        <Avatar name={p.name} size="sm"/>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#4A0F06]">{p.name}</p>
                          <p className="text-xs font-mono text-[#4A0F06]/40">{p.patientCode}</p>
                        </div>
                        {p.phase && PHASES[p.phase] && (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${PHASES[p.phase].color}`}>{PHASES[p.phase].label}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedPatient && selectedPatient.phase && PHASES[selectedPatient.phase] && (
                  <div className={`mt-2.5 flex items-center gap-3 px-4 py-3 rounded-xl border ${PHASES[selectedPatient.phase].color}`}>
                    <span className={`w-2 h-2 rounded-full ${PHASES[selectedPatient.phase].dot} flex-shrink-0`}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold">{PHASES[selectedPatient.phase].label} — {PHASES[selectedPatient.phase].desc}</p>
                      <p className="text-xs opacity-75 mt-0.5">{PHASES[selectedPatient.phase].hint}</p>
                    </div>
                    <Link href={`/dashboard/patients/${selectedPatient.id}`} className="text-xs font-semibold underline opacity-75 hover:opacity-100 flex-shrink-0">View profile →</Link>
                  </div>
                )}
              </div>

              {/* Doctor */}
              <div>
                <label className={labelCls}>Doctor <span className="text-[#D86F32]">*</span></label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0"/></svg>
                  </div>
                  <select required value={form.doctorId} onChange={e => setForm({...form, doctorId: e.target.value})} className={`${inputCls} pl-10 appearance-none`}>
                    <option value="">Select a doctor</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                </div>
              </div>

              {/* Session type */}
              <div>
                <label className={labelCls}>Session Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {SESSION_TYPES.map(s => (
                    <button key={s.value} type="button" onClick={() => setForm({...form, sessionType: s.value})}
                      className={`px-2 sm:px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-center ${form.sessionType === s.value ? "bg-[#4A0F06] border-[#4A0F06] text-[#F5F2E8] shadow-sm shadow-[#4A0F06]/20" : "bg-[#FAF8F2] border-[#4A0F06]/12 text-[#4A0F06]/60 hover:border-[#D86F32]/40 hover:text-[#D86F32]"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Date <span className="text-[#D86F32]">*</span></label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    </div>
                    <input required type="date" value={form.date} min={todayStr} onChange={e => setForm({...form, date: e.target.value})} className={`${inputCls} pl-10`}/>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Time (IST) <span className="text-[#D86F32]">*</span></label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <select required value={form.time} onChange={e => setForm({...form, time: e.target.value})} className={`${inputCls} pl-10 appearance-none`}>
                      {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={saving || !form.patientId || !form.doctorId}
                className="w-full flex items-center justify-center gap-2 bg-[#4A0F06] hover:bg-[#5C1408] text-[#F5F2E8] text-sm font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-md shadow-[#4A0F06]/25 hover:shadow-lg hover:-translate-y-0.5">
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-[#F5F2E8]/40 border-t-[#F5F2E8] rounded-full animate-spin"/>Booking…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>Confirm Booking</>
                )}
              </button>
            </form>

            {/* Reschedule rule hint */}
            <div className="flex items-start gap-3 p-4 bg-[#D86F32]/8 border border-[#D86F32]/20 rounded-2xl">
              <div className="w-6 h-6 bg-[#D86F32] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01"/></svg>
              </div>
              <div>
                <p className="text-xs font-bold text-[#4A0F06]">Reschedule Rule</p>
                <p className="text-xs text-[#4A0F06]/60 mt-0.5 leading-relaxed">Only 1 reschedule allowed per booking. All times are stored in UTC and displayed in IST.</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Appointments list */}
        <div className="bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/8 shadow-sm overflow-hidden flex flex-col w-full" style={{height: "calc(100vh - 160px)", minHeight: "400px"}}>
          <div className="px-4 sm:px-6 py-5 border-b border-[#4A0F06]/6 flex-shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-[#4A0F06]">Appointments</h2>
                <p className="text-xs text-[#4A0F06]/40 mt-0.5">{filteredUpcoming.length} {upcomingFilter === "ALL" ? "total" : upcomingFilter.toLowerCase()}</p>
              </div>
              <div className="flex items-center gap-1 bg-[#4A0F06]/6 p-1 rounded-xl">
                {["ALL","CONFIRMED","ATTENDED","MISSED"].map(f => (
                  <button key={f} onClick={() => setUpcomingFilter(f)}
                    className={`text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded-lg transition-all ${upcomingFilter === f ? "bg-[#FAF8F2] text-[#4A0F06] shadow-sm" : "text-[#4A0F06]/50 hover:text-[#4A0F06]/70"}`}>
                    {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 space-y-2
            [&::-webkit-scrollbar]:w-1.5
            [&::-webkit-scrollbar-track]:bg-[#4A0F06]/5
            [&::-webkit-scrollbar-track]:rounded-full
            [&::-webkit-scrollbar-thumb]:bg-[#D86F32]/40
            [&::-webkit-scrollbar-thumb]:rounded-full
            [&::-webkit-scrollbar-thumb:hover]:bg-[#D86F32]/60">

            {filteredUpcoming.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-14 h-14 bg-[#4A0F06]/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#4A0F06]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <p className="text-sm font-semibold text-[#4A0F06]/40">No appointments found</p>
                <p className="text-xs text-[#4A0F06]/25 mt-1">{upcomingFilter !== "ALL" ? "Try switching to All" : "Book one using the form"}</p>
              </div>
            ) : (
              filteredUpcoming.map(a => {
                const cfg  = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.CANCELLED;
                const date = new Date(a.startTime).toLocaleDateString("en-IN",{day:"numeric",month:"short",timeZone:"Asia/Kolkata"});
                const time = new Date(a.startTime).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kolkata"});

                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl border-2 border-[#4A0F06]/6 hover:border-[#D86F32]/30 hover:bg-[#D86F32]/4 transition-all group">
                    <Avatar name={a.patient.name}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#4A0F06] truncate">{a.patient.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-[#4A0F06]/40">{a.patient.patientCode}</span>
                        <span className="text-[#4A0F06]/20">·</span>
                        <span className="text-xs font-medium text-[#4A0F06]/50">{a.doctor.name}</span>
                        <span className="text-[#4A0F06]/20">·</span>
                        <span className="text-xs font-medium text-[#4A0F06]/50 bg-[#4A0F06]/6 px-2 py-0.5 rounded-lg">{a.sessionType.replace(/_/g," ")}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>{cfg.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#4A0F06]/50">{date}</span>
                        <span className="text-xs text-[#4A0F06]/40 bg-[#4A0F06]/6 px-1.5 py-0.5 rounded-lg font-mono">{time}</span>
                      </div>
                    </div>

                    {canManage && a.status === "CONFIRMED" && (
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => handleCancel(a.id)} disabled={cancelling === a.id}
                          className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-40">
                          Cancel
                        </button>
                        <button onClick={() => setRescheduleAppt(a)}
                          className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all">
                          Reschedule
                        </button>
                        <button onClick={() => setReassignAppt(a)}
                          className="hidden sm:block text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2.5 py-1.5 rounded-xl transition-all">
                          Reassign Dr.
                        </button>
                      </div>
                    )}

                    <Link href={`/dashboard/patients/${a.patient.id}`}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-xs font-semibold text-[#D86F32] bg-[#D86F32]/10 hover:bg-[#D86F32]/20 border border-[#D86F32]/20 px-2 sm:px-2.5 py-1.5 rounded-xl transition-all ml-1">
                      View
                    </Link>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-4 sm:px-6 py-3 border-t border-[#4A0F06]/6 bg-[#4A0F06]/2 flex-shrink-0">
            <p className="text-xs text-[#4A0F06]/40 font-medium text-center">
              {filteredUpcoming.length} appointment{filteredUpcoming.length !== 1 ? "s" : ""}
              {upcomingFilter !== "ALL" && ` · filtered by ${upcomingFilter.toLowerCase()}`}
            </p>
          </div>
        </div>
      </div>

      {rescheduleAppt && (
        <RescheduleModal appointmentId={rescheduleAppt.id} patientName={rescheduleAppt.patient.name}
          onClose={() => setRescheduleAppt(null)} onSuccess={() => { setRescheduleAppt(null); loadUpcoming(); }}/>
      )}
      {reassignAppt && (
        <ReassignDoctorModal appointmentId={reassignAppt.id} patientName={reassignAppt.patient.name}
          currentDoctorId={reassignAppt.doctor?.id ?? reassignAppt.doctorId ?? ""}
          onClose={() => setReassignAppt(null)} onSuccess={() => { setReassignAppt(null); loadUpcoming(); }}/>
      )}
    </div>
  );
}