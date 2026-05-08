"use client";

/**
 * src/app/dashboard/holiday-requests/page.tsx
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { CalendarOff, Check, X, RefreshCw, Clock } from "lucide-react";

interface HolidayRequest {
  id: string;
  date: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  doctor: { id: string; name: string; email: string };
}

const STATUS_STYLES: Record<string, { pill: string; dot: string }> = {
  PENDING:  { pill: "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40",  dot: "bg-[#D9A441]" },
  APPROVED: { pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30", dot: "bg-[#4F8A5B]" },
  REJECTED: { pill: "bg-[#C94F4F]/10 text-[#C94F4F] border border-[#C94F4F]/30", dot: "bg-[#C94F4F]" },
};

function DoctorAvatar({ name }: { name: string }) {
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
    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 border border-[#DDD2C2]/60 ${color}`}>
      {initials}
    </div>
  );
}

export default function HolidayRequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);
  const [filter,   setFilter]   = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  const role = session?.user?.role ?? "";
  const canManage = ["ADMIN", "RECEPTIONIST"].includes(role);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/holiday-requests");
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const updateStatus = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActing(id);
    try {
      await fetch(`/api/holiday-requests/${id}`, {
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
    APPROVED: requests.filter(r => r.status === "APPROVED").length,
    REJECTED: requests.filter(r => r.status === "REJECTED").length,
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-[#4B0F05] rounded-xl flex items-center justify-center shadow-md shadow-[#4B0F05]/20">
                <CalendarOff size={15} className="text-[#F5F1E8]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2B1A14] tracking-tight">Holiday Requests</h1>
            </div>
            <p className="text-xs sm:text-sm text-[#7A685F] ml-[42px]">Manage doctor leave requests</p>
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
            { key: "ALL",      label: "All",      color: "text-[#2B1A14]",  bg: "bg-[#E8E1D5]",         activeBg: "bg-[#4B0F05]",   activeText: "text-[#F5F1E8]", activeBorder: "border-[#4B0F05]" },
            { key: "PENDING",  label: "Pending",  color: "text-[#8B6419]",  bg: "bg-[#D9A441]/10",      activeBg: "bg-[#D9A441]",   activeText: "text-white",     activeBorder: "border-[#D9A441]" },
            { key: "APPROVED", label: "Approved", color: "text-[#4F8A5B]",  bg: "bg-[#4F8A5B]/10",      activeBg: "bg-[#4F8A5B]",   activeText: "text-white",     activeBorder: "border-[#4F8A5B]" },
            { key: "REJECTED", label: "Rejected", color: "text-[#C94F4F]",  bg: "bg-[#C94F4F]/10",      activeBg: "bg-[#C94F4F]",   activeText: "text-white",     activeBorder: "border-[#C94F4F]" },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`flex items-center justify-between px-3 sm:px-4 py-3 rounded-2xl border-2 transition-all duration-150 text-left ${
                filter === s.key
                  ? `${s.activeBg} ${s.activeText} ${s.activeBorder} shadow-sm`
                  : `bg-white border-[#DDD2C2] hover:border-[#D97332]/40`
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
                <CalendarOff size={24} className="text-[#7A685F]/40" />
              </div>
              <p className="text-sm font-semibold text-[#7A685F]">No requests found</p>
              <p className="text-xs text-[#7A685F]/60">
                {filter !== "ALL" ? "Try a different filter" : "No holiday requests submitted yet"}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E1D5] bg-[#F5F1E8]/80">
                      {["Doctor", "Date", "Reason", "Status", "Submitted", ...(canManage ? ["Actions"] : [])].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-[#7A685F] uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F1E8]">
                    {filtered.map((r, idx) => {
                      const st = STATUS_STYLES[r.status];
                      return (
                        <tr key={r.id} className={`transition-colors duration-150 hover:bg-[#FDF3EC]/50 ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F1E8]/20"}`}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <DoctorAvatar name={r.doctor.name} />
                              <div>
                                <p className="font-bold text-[#2B1A14] text-sm">{r.doctor.name}</p>
                                <p className="text-xs text-[#7A685F] font-mono">{r.doctor.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-[#2B1A14]">
                              {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="text-sm text-[#5C1408] max-w-[200px] truncate">{r.reason}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${st.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                              {r.status === "PENDING" ? "Pending" : r.status === "APPROVED" ? "Approved" : "Rejected"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-xs text-[#7A685F]">
                            {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </td>
                          {canManage && (
                            <td className="px-5 py-4">
                              {r.status === "PENDING" ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateStatus(r.id, "APPROVED")}
                                    disabled={acting === r.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#4F8A5B] hover:bg-[#3d6e47] text-white disabled:opacity-50 transition-all duration-150 shadow-sm"
                                  >
                                    <Check size={11} /> Approve
                                  </button>
                                  <button
                                    onClick={() => updateStatus(r.id, "REJECTED")}
                                    disabled={acting === r.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-[#C94F4F]/8 text-[#C94F4F] border-2 border-[#C94F4F]/30 hover:border-[#C94F4F]/50 disabled:opacity-50 transition-all duration-150"
                                  >
                                    <X size={11} /> Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-[#7A685F]/50 italic">Done</span>
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
              <div className="md:hidden divide-y divide-[#E8E1D5]">
                {filtered.map(r => {
                  const st = STATUS_STYLES[r.status];
                  return (
                    <div key={r.id} className="p-4 hover:bg-[#FDF3EC]/40 transition-colors duration-150">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <DoctorAvatar name={r.doctor.name} />
                          <div className="min-w-0">
                            <p className="font-bold text-[#2B1A14] text-sm truncate">{r.doctor.name}</p>
                            <p className="text-xs text-[#7A685F] font-mono truncate">{r.doctor.email}</p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border flex-shrink-0 ${st.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                          {r.status === "PENDING" ? "Pending" : r.status === "APPROVED" ? "Approved" : "Rejected"}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#7A685F] uppercase tracking-wider w-16 flex-shrink-0">Date</span>
                          <span className="text-xs font-semibold text-[#2B1A14]">
                            {new Date(r.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[10px] font-bold text-[#7A685F] uppercase tracking-wider w-16 flex-shrink-0 mt-0.5">Reason</span>
                          <span className="text-xs text-[#5C1408] leading-relaxed">{r.reason}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-[#7A685F] uppercase tracking-wider w-16 flex-shrink-0">Filed</span>
                          <span className="text-xs text-[#7A685F]">
                            {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {canManage && r.status === "PENDING" && (
                        <div className="flex gap-2 pt-2 border-t border-[#E8E1D5]">
                          <button
                            onClick={() => updateStatus(r.id, "APPROVED")}
                            disabled={acting === r.id}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold bg-[#4F8A5B] hover:bg-[#3d6e47] text-white disabled:opacity-50 transition-all duration-150"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={() => updateStatus(r.id, "REJECTED")}
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