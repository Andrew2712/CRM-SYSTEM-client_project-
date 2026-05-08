"use client";

/**
 * src/app/dashboard/reassignments/page.tsx
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserCheck, Check, X, RefreshCw } from "lucide-react";

interface ReassignmentRequest {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  notes?: string;
  createdAt: string;
  appointment: {
    id: string;
    startTime: string;
    patient: { name: string };
  };
  fromDoctor: { id: string; name: string };
  toDoctor:   { id: string; name: string };
  requestedBy: { id: string; name: string };
}

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  PENDING:  { pill: "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40",  dot: "bg-[#D9A441]" },
  ACCEPTED: { pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30", dot: "bg-[#4F8A5B]" },
  REJECTED: { pill: "bg-[#C94F4F]/10 text-[#C94F4F] border border-[#C94F4F]/30", dot: "bg-[#C94F4F]" },
};

function DoctorChip({ name, label }: { name: string; label: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const palettes = [
    "bg-[#4F8A5B]/12 text-[#4F8A5B]",
    "bg-[#4B0F05]/10 text-[#4B0F05]",
    "bg-[#D97332]/12 text-[#D97332]",
    "bg-[#D9A441]/12 text-[#8B6419]",
    "bg-[#5C1408]/10 text-[#5C1408]",
  ];
  const color = palettes[name.charCodeAt(0) % palettes.length];
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[9px] flex-shrink-0 border border-[#DDD2C2]/60 ${color}`}>
        {initials}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold text-[#7A685F] uppercase tracking-wider leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-[#2B1A14] truncate">{name}</p>
      </div>
    </div>
  );
}

export default function ReassignmentsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<ReassignmentRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);
  const [filter,   setFilter]   = useState<"ALL" | "PENDING" | "ACCEPTED" | "REJECTED">("ALL");

  const role   = session?.user?.role ?? "";
  const userId = session?.user?.id   ?? "";
  const isDoctor = role === "DOCTOR";

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/doctor-reassignment");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const respond = async (id: string, status: "ACCEPTED" | "REJECTED") => {
    setActing(id);
    try {
      await fetch(`/api/doctor-reassignment/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } finally {
      setActing(null);
    }
  };

  const filtered = filter === "ALL" ? requests : requests.filter(r => r.status === filter);
  const counts = {
    ALL:      requests.length,
    PENDING:  requests.filter(r => r.status === "PENDING").length,
    ACCEPTED: requests.filter(r => r.status === "ACCEPTED").length,
    REJECTED: requests.filter(r => r.status === "REJECTED").length,
  };

  const showActions = isDoctor || role === "ADMIN";

  return (
    <div className="min-h-screen bg-[#F5F1E8] p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-[#4B0F05] rounded-xl flex items-center justify-center shadow-md shadow-[#4B0F05]/20">
                <UserCheck size={15} className="text-[#F5F1E8]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2B1A14] tracking-tight">Reassignment Requests</h1>
            </div>
            <p className="text-xs sm:text-sm text-[#7A685F] ml-[42px]">
              {isDoctor ? "Requests assigned to you" : "All doctor reassignment requests"}
            </p>
          </div>
          <button
            onClick={fetchRequests}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white hover:bg-[#EFE7DA] text-[#5C1408] border border-[#DDD2C2] transition-all duration-150 shadow-sm"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {/* ── Summary chips ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { key: "ALL",      label: "All",      color: "text-[#2B1A14]",  activeBg: "bg-[#4B0F05]",   activeText: "text-[#F5F1E8]", activeBorder: "border-[#4B0F05]" },
            { key: "PENDING",  label: "Pending",  color: "text-[#8B6419]",  activeBg: "bg-[#D9A441]",   activeText: "text-white",     activeBorder: "border-[#D9A441]" },
            { key: "ACCEPTED", label: "Accepted", color: "text-[#4F8A5B]",  activeBg: "bg-[#4F8A5B]",   activeText: "text-white",     activeBorder: "border-[#4F8A5B]" },
            { key: "REJECTED", label: "Rejected", color: "text-[#C94F4F]",  activeBg: "bg-[#C94F4F]",   activeText: "text-white",     activeBorder: "border-[#C94F4F]" },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-2xl border-2 transition-all duration-150 text-left ${
                filter === s.key
                  ? `${s.activeBg} ${s.activeText} ${s.activeBorder} shadow-sm`
                  : "bg-white border-[#DDD2C2] hover:border-[#D97332]/40"
              }`}
            >
              <span className={`text-xs font-semibold ${filter === s.key ? s.activeText : s.color}`}>{s.label}</span>
              <span className={`text-lg font-black ${filter === s.key ? s.activeText : s.color}`}>
                {counts[s.key]}
              </span>
            </button>
          ))}
        </div>

        {/* ── Main card ── */}
        <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">

          {/* Card header */}
          <div className="px-4 sm:px-6 py-4 border-b border-[#E8E1D5] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#2B1A14]">
                {filter === "ALL" ? "All Requests" : `${filter.charAt(0) + filter.slice(1).toLowerCase()} Requests`}
              </h2>
              <p className="text-xs text-[#7A685F] mt-0.5">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</p>
            </div>
            {filter !== "ALL" && (
              <button
                onClick={() => setFilter("ALL")}
                className="text-xs font-semibold text-[#7A685F] hover:text-[#2B1A14] bg-[#E8E1D5] hover:bg-[#DDD2C2] px-3 py-1.5 rounded-lg transition-colors"
              >
                Clear ×
              </button>
            )}
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-[3px] border-[#D97332] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#7A685F] font-medium">Loading requests…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-[#E8E1D5] rounded-2xl flex items-center justify-center">
                <UserCheck size={24} className="text-[#7A685F]/40" />
              </div>
              <p className="text-sm font-semibold text-[#7A685F]">No requests found</p>
              <p className="text-xs text-[#7A685F]/60">
                {filter !== "ALL" ? "Try a different filter" : "No reassignment requests yet"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E1D5] bg-[#F5F1E8]/80">
                      {["Patient", "Appointment", "From → To", "Status", "Notes", ...(showActions ? ["Actions"] : [])].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-[#7A685F] uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F1E8]">
                    {filtered.map((r, idx) => {
                      const st = STATUS_STYLES[r.status];
                      const canAct = r.status === "PENDING" && (isDoctor ? r.toDoctor.id === userId : role === "ADMIN");
                      return (
                        <tr key={r.id} className={`transition-colors duration-150 hover:bg-[#FDF3EC]/50 ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F1E8]/20"}`}>
                          <td className="px-5 py-4">
                            <p className="font-bold text-[#2B1A14] text-sm">{r.appointment.patient.name}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-[#2B1A14]">
                              {new Date(r.appointment.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                            <p className="text-xs text-[#7A685F] mt-0.5">
                              {new Date(r.appointment.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <DoctorChip name={r.fromDoctor.name} label="From" />
                              <svg className="w-4 h-4 text-[#D97332] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <DoctorChip name={r.toDoctor.name} label="To" />
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-xs text-[#7A685F] max-w-[150px] truncate">{r.notes ?? "—"}</p>
                          </td>
                          {showActions && (
                            <td className="px-5 py-4">
                              {canAct ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => respond(r.id, "ACCEPTED")}
                                    disabled={acting === r.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4F8A5B] hover:bg-[#3d6e47] text-white disabled:opacity-50 transition-all duration-150 shadow-sm"
                                  >
                                    <Check size={11} /> Accept
                                  </button>
                                  <button
                                    onClick={() => respond(r.id, "REJECTED")}
                                    disabled={acting === r.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-[#C94F4F] border-2 border-[#C94F4F]/30 hover:bg-[#C94F4F]/8 disabled:opacity-50 transition-all duration-150"
                                  >
                                    <X size={11} /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-[#7A685F]/50 italic">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet cards */}
              <div className="lg:hidden divide-y divide-[#E8E1D5]">
                {filtered.map(r => {
                  const st = STATUS_STYLES[r.status];
                  const canAct = r.status === "PENDING" && (isDoctor ? r.toDoctor.id === userId : role === "ADMIN");
                  return (
                    <div key={r.id} className="p-4 hover:bg-[#FDF3EC]/40 transition-colors duration-150">

                      {/* Top: patient + status */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-black text-[#2B1A14] text-sm">{r.appointment.patient.name}</p>
                          <p className="text-xs text-[#7A685F] mt-0.5">
                            {new Date(r.appointment.startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {" · "}
                            {new Date(r.appointment.startTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                        </span>
                      </div>

                      {/* Doctor flow */}
                      <div className="bg-[#F5F1E8] rounded-xl p-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <DoctorChip name={r.fromDoctor.name} label="From" />
                          <svg className="w-5 h-5 text-[#D97332] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <DoctorChip name={r.toDoctor.name} label="To" />
                        </div>
                      </div>

                      {/* Notes */}
                      {r.notes && (
                        <p className="text-xs text-[#7A685F] bg-[#F5F1E8] rounded-lg px-3 py-2 mb-3 leading-relaxed">
                          <span className="font-bold text-[#7A685F]/70 uppercase tracking-wider text-[10px]">Note: </span>
                          {r.notes}
                        </p>
                      )}

                      {/* Actions */}
                      {showActions && canAct && (
                        <div className="flex gap-2 pt-2 border-t border-[#E8E1D5]">
                          <button
                            onClick={() => respond(r.id, "ACCEPTED")}
                            disabled={acting === r.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-[#4F8A5B] hover:bg-[#3d6e47] text-white disabled:opacity-50 transition-all duration-150"
                          >
                            <Check size={12} /> Accept
                          </button>
                          <button
                            onClick={() => respond(r.id, "REJECTED")}
                            disabled={acting === r.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-white text-[#C94F4F] border-2 border-[#C94F4F]/30 hover:bg-[#C94F4F]/8 disabled:opacity-50 transition-all duration-150"
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}