"use client";
/**
 * src/app/dashboard/waitlist/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Patient Waitlist Management Page
 * Roles: ADMIN (full access), RECEPTIONIST (full access), DOCTOR (read-only)
 */

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Doctor  = { id: string; name: string };
type Patient = { id: string; name: string; patientCode: string; phase?: string };

type WaitlistEntry = {
  id:            string;
  status:        "PENDING" | "NOTIFIED" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
  priority:      number;
  preferredDate: string;
  preferredTime: string | null;
  notes:         string | null;
  notifiedAt:    string | null;
  expiresAt:     string | null;
  createdAt:     string;
  patient:       { id: string; name: string; patientCode: string; phone: string; email: string | null; phase: string | null };
  doctor:        { id: string; name: string };
};

type WaitlistResponse = {
  entries:   WaitlistEntry[];
  total:     number;
  page:      number;
  pageCount: number;
};

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<WaitlistEntry["status"], { label: string; pill: string; dot: string }> = {
  PENDING:   { label: "Pending",   pill: "bg-sky-50 text-sky-700 border-sky-200",         dot: "bg-sky-500"     },
  NOTIFIED:  { label: "Notified",  pill: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-500"   },
  ACCEPTED:  { label: "Accepted",  pill: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  EXPIRED:   { label: "Expired",   pill: "bg-red-50 text-red-600 border-red-200",         dot: "bg-red-500"     },
  CANCELLED: { label: "Cancelled", pill: "bg-gray-100 text-gray-500 border-gray-200",     dot: "bg-gray-400"    },
};

const PHASE_COLORS: Record<string, string> = {
  PHASE_1: "bg-violet-100 text-violet-700",
  PHASE_2: "bg-blue-100 text-blue-700",
  PHASE_3: "bg-teal-100 text-teal-700",
  PHASE_4: "bg-emerald-100 text-emerald-700",
  PHASE_5: "bg-amber-100 text-amber-700",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  const colors = [
    "bg-amber-100 text-amber-800", "bg-orange-100 text-orange-800",
    "bg-teal-100 text-teal-800",   "bg-violet-100 text-violet-800",
    "bg-blue-100 text-blue-800",   "bg-rose-100 text-rose-800",
  ];
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const color    = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 ${color} rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0`}>
      {initials}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-[#4A0F06]/20 border-t-[#4A0F06] rounded-full animate-spin" />
  );
}

const inputCls = "w-full bg-[#FAF8F2] border-2 border-[#4A0F06]/12 rounded-xl px-4 py-2.5 text-sm font-medium text-[#4A0F06] placeholder:text-[#4A0F06]/30 focus:outline-none focus:border-[#D86F32]/50 transition-all";
const labelCls = "block text-[11px] font-bold text-[#4A0F06]/50 uppercase tracking-widest mb-1.5";

// ─── Add to Waitlist Modal ────────────────────────────────────────────────────

function AddWaitlistModal({
  doctors,
  patients,
  onClose,
  onAdded,
}: {
  doctors:  Doctor[];
  patients: Patient[];
  onClose:  () => void;
  onAdded:  () => void;
}) {
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [showDrop,      setShowDrop]      = useState(false);
  const [selPatient,    setSelPatient]    = useState<Patient | null>(null);
  const [form, setForm] = useState({
    doctorId:      "",
    preferredDate: "",
    preferredTime: "",
    priority:      0,
    notes:         "",
  });

  const filtered = patientSearch.length > 1
    ? patients.filter(p =>
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
        p.patientCode.toLowerCase().includes(patientSearch.toLowerCase())
      ).slice(0, 8)
    : patients.slice(0, 6);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selPatient) { setError("Select a patient"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          patientId:     selPatient.id,
          doctorId:      form.doctorId,
          preferredDate: form.preferredDate,
          preferredTime: form.preferredTime || undefined,
          priority:      form.priority,
          notes:         form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add to waitlist"); return; }
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#FAF8F2] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#4A0F06]/8"
          style={{ background: "linear-gradient(135deg, #4A0F06, #5C1408)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#F5F2E8]">Add to Waitlist</h2>
              <p className="text-xs text-[#F5F2E8]/60 mt-0.5">Queue a patient for the next available slot</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[#F5F2E8]/70 hover:bg-white/20 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-semibold text-red-600">{error}</p>
            </div>
          )}

          {/* Patient Search */}
          <div>
            <label className={labelCls}>Patient *</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or ID…"
                value={patientSearch}
                autoComplete="off"
                onChange={e => { setPatientSearch(e.target.value); setShowDrop(true); if (!e.target.value) setSelPatient(null); }}
                onFocus={() => setShowDrop(true)}
                className={inputCls}
              />
              {showDrop && !selPatient && filtered.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-[#FAF8F2] border-2 border-[#4A0F06]/12 rounded-xl shadow-lg z-10 overflow-hidden">
                  {filtered.map(p => (
                    <button key={p.id} type="button"
                      onMouseDown={() => { setSelPatient(p); setPatientSearch(p.name); setShowDrop(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-[#D86F32]/8 border-b border-[#4A0F06]/5 last:border-0 flex items-center gap-3 transition-colors"
                    >
                      <Avatar name={p.name} />
                      <div>
                        <p className="text-sm font-bold text-[#4A0F06]">{p.name}</p>
                        <p className="text-xs font-mono text-[#4A0F06]/40">{p.patientCode}</p>
                      </div>
                      {p.phase && (
                        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${PHASE_COLORS[p.phase] ?? ""}`}>
                          {p.phase.replace("PHASE_", "P")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selPatient && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-[#4A0F06]/5 rounded-xl">
                <Avatar name={selPatient.name} />
                <div className="flex-1">
                  <p className="text-xs font-bold text-[#4A0F06]">{selPatient.name}</p>
                  <p className="text-[10px] font-mono text-[#4A0F06]/50">{selPatient.patientCode}</p>
                </div>
                <button type="button" onClick={() => { setSelPatient(null); setPatientSearch(""); }}
                  className="text-[#4A0F06]/40 hover:text-[#4A0F06]/70">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Doctor */}
          <div>
            <label className={labelCls}>Doctor *</label>
            <select required value={form.doctorId} onChange={e => setForm({ ...form, doctorId: e.target.value })} className={inputCls}>
              <option value="">Select a doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* Preferred Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Preferred Date *</label>
              <input
                required type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.preferredDate}
                onChange={e => setForm({ ...form, preferredDate: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Preferred Time</label>
              <input
                type="text" placeholder="e.g. 10:00 AM"
                value={form.preferredTime}
                onChange={e => setForm({ ...form, preferredTime: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className={labelCls}>Priority (0 = normal, higher = sooner)</label>
            <input
              type="number" min={0} max={10}
              value={form.priority}
              onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Any special instructions…"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border-2 border-[#4A0F06]/12 text-sm font-semibold text-[#4A0F06]/60 hover:bg-[#4A0F06]/5 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving || !selPatient || !form.doctorId || !form.preferredDate}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#4A0F06] text-[#F5F2E8] text-sm font-bold disabled:opacity-50 hover:bg-[#5C1408] transition-all">
              {saving ? <Spinner /> : null}
              {saving ? "Adding…" : "Add to Waitlist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WaitlistPage() {
  const { data: session } = useSession();
  const role      = session?.user?.role ?? "";
  const canManage = ["ADMIN", "RECEPTIONIST"].includes(role);

  const [data,      setData]      = useState<WaitlistResponse | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [doctors,   setDoctors]   = useState<Doctor[]>([]);
  const [patients,  setPatients]  = useState<Patient[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [filtering, setFiltering] = useState({ status: "", doctorId: "", search: "" });
  const [updating,  setUpdating]  = useState<string | null>(null);
  const [page,      setPage]      = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtering.status)   params.set("status",   filtering.status);
      if (filtering.doctorId) params.set("doctorId", filtering.doctorId);
      params.set("page",  String(page));
      params.set("limit", "25");

      const res = await fetch(`/api/waitlist?${params}`, { credentials: "include" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filtering, page]);

  useEffect(() => {
    load();
    fetch("/api/doctors",  { credentials: "include" }).then(r => r.json()).then(d => setDoctors(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/patients", { credentials: "include" }).then(r => r.json()).then(d => setPatients(Array.isArray(d) ? d : [])).catch(() => {});
  }, [load]);

  async function handleStatusChange(id: string, status: string) {
    setUpdating(id);
    try {
      await fetch(`/api/waitlist/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      load();
    } finally {
      setUpdating(null);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Remove this patient from the waitlist?")) return;
    setUpdating(id);
    try {
      await fetch(`/api/waitlist/${id}`, { method: "DELETE", credentials: "include" });
      load();
    } finally {
      setUpdating(null);
    }
  }

  async function handleTriggerNotify(doctorId: string, preferredDate: string) {
    if (!confirm("Send slot notification to the next patient in queue?")) return;
    const dateStr = new Date(preferredDate).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    try {
      const res = await fetch("/api/waitlist/notify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ doctorId, date: dateStr }),
      });
      const data = await res.json();
      if (data.notified) {
        alert(`✅ Notified: ${data.patientName}`);
        load();
      } else {
        alert(`ℹ️ ${data.reason ?? "No pending entries to notify"}`);
      }
    } catch {
      alert("Failed to trigger notification");
    }
  }

  // Search filter (client-side)
  const entries = (data?.entries ?? []).filter(e => {
    if (!filtering.search) return true;
    const q = filtering.search.toLowerCase();
    return (
      e.patient.name.toLowerCase().includes(q) ||
      e.patient.patientCode.toLowerCase().includes(q) ||
      e.doctor.name.toLowerCase().includes(q)
    );
  });

  const counts = (data?.entries ?? []).reduce((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-[#F5F2E8] p-4 sm:p-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-[#4A0F06] rounded-xl flex items-center justify-center shadow-md shadow-[#4A0F06]/20">
              <svg className="w-4 h-4 text-[#F5F2E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#4A0F06] tracking-tight">Patient Waitlist</h1>
          </div>
          <p className="text-sm text-[#4A0F06]/40 ml-[42px]">
            Auto-notifies the next patient when a slot opens up
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#4A0F06] text-[#F5F2E8] px-4 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-[#5C1408] transition-all hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add to Waitlist
          </button>
        )}
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {(["PENDING", "NOTIFIED", "ACCEPTED", "EXPIRED", "CANCELLED"] as const).map(s => {
          const cfg = STATUS_CFG[s];
          return (
            <button key={s}
              onClick={() => setFiltering(f => ({ ...f, status: f.status === s ? "" : s }))}
              className={`p-3 sm:p-4 rounded-2xl border-2 text-left transition-all ${
                filtering.status === s
                  ? `${cfg.pill} ring-2 ring-offset-1 ring-current`
                  : "bg-[#FAF8F2] border-[#4A0F06]/8 hover:border-[#D86F32]/20"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${cfg.dot} mb-2`} />
              <p className="text-xl font-black text-[#4A0F06]">{counts[s] ?? 0}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A0F06]/50">{cfg.label}</p>
            </button>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/8 shadow-sm p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A0F06]/30 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text" placeholder="Search patient, doctor…"
            value={filtering.search}
            onChange={e => setFiltering(f => ({ ...f, search: e.target.value }))}
            className="w-full pl-9 pr-3 py-2 bg-[#4A0F06]/5 border border-[#4A0F06]/10 rounded-xl text-sm font-medium text-[#4A0F06] placeholder:text-[#4A0F06]/30 focus:outline-none focus:border-[#D86F32]/50 transition-all"
          />
        </div>
        <select
          value={filtering.doctorId}
          onChange={e => setFiltering(f => ({ ...f, doctorId: e.target.value }))}
          className="py-2 px-3 bg-[#4A0F06]/5 border border-[#4A0F06]/10 rounded-xl text-sm font-medium text-[#4A0F06] focus:outline-none focus:border-[#D86F32]/50"
        >
          <option value="">All Doctors</option>
          {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={filtering.status}
          onChange={e => setFiltering(f => ({ ...f, status: e.target.value }))}
          className="py-2 px-3 bg-[#4A0F06]/5 border border-[#4A0F06]/10 rounded-xl text-sm font-medium text-[#4A0F06] focus:outline-none focus:border-[#D86F32]/50"
        >
          <option value="">All Statuses</option>
          {(["PENDING", "NOTIFIED", "ACCEPTED", "EXPIRED", "CANCELLED"] as const).map(s => (
            <option key={s} value={s}>{STATUS_CFG[s].label}</option>
          ))}
        </select>
      </div>

      {/* ── Waitlist Table ── */}
      <div className="bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/8 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-[#4A0F06]/5 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#4A0F06]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#4A0F06]/40">No waitlist entries found</p>
            {canManage && (
              <button onClick={() => setShowModal(true)} className="mt-3 text-xs font-semibold text-[#D86F32] hover:underline">
                Add a patient →
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#4A0F06]/8 bg-[#4A0F06]/3">
                    {["Queue", "Patient", "Doctor", "Preferred Date", "Time", "Status", "Priority", "Actions"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-[#4A0F06]/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#4A0F06]/5">
                  {entries.map((entry, idx) => {
                    const cfg  = STATUS_CFG[entry.status];
                    const date = new Date(entry.preferredDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
                    const isUpdating = updating === entry.id;

                    return (
                      <tr key={entry.id} className="hover:bg-[#D86F32]/4 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="w-7 h-7 rounded-lg bg-[#4A0F06]/8 flex items-center justify-center text-xs font-black text-[#4A0F06]/60">
                            {idx + 1}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={entry.patient.name} />
                            <div>
                              <p className="font-bold text-[#4A0F06]">{entry.patient.name}</p>
                              <p className="text-xs font-mono text-[#4A0F06]/40">{entry.patient.patientCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-[#4A0F06]">Dr. {entry.doctor.name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[#4A0F06]">{date}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-mono text-sm text-[#4A0F06]/60">{entry.preferredTime ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          {entry.notifiedAt && (
                            <p className="text-[10px] text-[#4A0F06]/40 mt-1">
                              Notified {new Date(entry.notifiedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1">
                            {[...Array(Math.min(entry.priority, 5))].map((_, i) => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#D86F32]" />
                            ))}
                            {entry.priority === 0 && <span className="text-xs text-[#4A0F06]/30">Normal</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                            {canManage && entry.status === "PENDING" && (
                              <button
                                onClick={() => handleTriggerNotify(entry.doctor.id, entry.preferredDate)}
                                disabled={isUpdating}
                                className="text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-40"
                              >
                                Notify
                              </button>
                            )}
                            {canManage && entry.status === "NOTIFIED" && (
                              <button
                                onClick={() => handleStatusChange(entry.id, "ACCEPTED")}
                                disabled={isUpdating}
                                className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-40"
                              >
                                Mark Accepted
                              </button>
                            )}
                            {canManage && ["PENDING", "NOTIFIED"].includes(entry.status) && (
                              <button
                                onClick={() => handleCancel(entry.id)}
                                disabled={isUpdating}
                                className="text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-40"
                              >
                                {isUpdating ? <Spinner /> : "Remove"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="sm:hidden divide-y divide-[#4A0F06]/5">
              {entries.map((entry, idx) => {
                const cfg  = STATUS_CFG[entry.status];
                const date = new Date(entry.preferredDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
                return (
                  <div key={entry.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-[#4A0F06]/8 flex items-center justify-center text-[10px] font-black text-[#4A0F06]/60 flex-shrink-0 mt-1">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-[#4A0F06] truncate">{entry.patient.name}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.pill}`}>
                            <span className={`w-1 h-1 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#4A0F06]/50 mt-0.5">Dr. {entry.doctor.name} · {date}</p>
                        {entry.preferredTime && (
                          <p className="text-xs font-mono text-[#4A0F06]/40">{entry.preferredTime}</p>
                        )}
                        {canManage && ["PENDING", "NOTIFIED"].includes(entry.status) && (
                          <div className="flex gap-2 mt-3">
                            {entry.status === "PENDING" && (
                              <button
                                onClick={() => handleTriggerNotify(entry.doctor.id, entry.preferredDate)}
                                className="text-xs font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl"
                              >
                                Notify Next
                              </button>
                            )}
                            {entry.status === "NOTIFIED" && (
                              <button
                                onClick={() => handleStatusChange(entry.id, "ACCEPTED")}
                                className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl"
                              >
                                Mark Accepted
                              </button>
                            )}
                            <button
                              onClick={() => handleCancel(entry.id)}
                              className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {data && data.pageCount > 1 && (
              <div className="px-4 py-3 border-t border-[#4A0F06]/6 flex items-center justify-between">
                <p className="text-xs text-[#4A0F06]/40">{data.total} total entries</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs font-semibold border border-[#4A0F06]/12 rounded-xl disabled:opacity-40 hover:bg-[#4A0F06]/5 transition-colors text-[#4A0F06]">
                    ← Prev
                  </button>
                  <span className="px-3 py-1.5 text-xs font-bold text-[#4A0F06]/60">{page} / {data.pageCount}</span>
                  <button onClick={() => setPage(p => Math.min(data.pageCount, p + 1))} disabled={page === data.pageCount}
                    className="px-3 py-1.5 text-xs font-semibold border border-[#4A0F06]/12 rounded-xl disabled:opacity-40 hover:bg-[#4A0F06]/5 transition-colors text-[#4A0F06]">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── How It Works Info ── */}
      <div className="mt-4 bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/8 p-4 shadow-sm">
        <h3 className="text-xs font-black uppercase tracking-widest text-[#4A0F06]/50 mb-3">How the Waitlist Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {[
            { step: "1", title: "Add Patient",    desc: "Receptionist adds patient with preferred doctor, date, and time." },
            { step: "2", title: "Slot Opens",     desc: "When an appointment is cancelled or rescheduled, slot is freed." },
            { step: "3", title: "Auto-Notify",    desc: "System sends WhatsApp + Email to the next patient in queue." },
            { step: "4", title: "Confirm Slot",   desc: "Patient calls back. Receptionist marks entry Accepted and books." },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-xl bg-[#4A0F06] flex items-center justify-center text-[#F5F2E8] text-xs font-black flex-shrink-0">
                {s.step}
              </div>
              <div>
                <p className="text-xs font-bold text-[#4A0F06]">{s.title}</p>
                <p className="text-xs text-[#4A0F06]/50 mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Add Modal ── */}
      {showModal && (
        <AddWaitlistModal
          doctors={doctors}
          patients={patients}
          onClose={() => setShowModal(false)}
          onAdded={load}
        />
      )}
    </div>
  );
}
