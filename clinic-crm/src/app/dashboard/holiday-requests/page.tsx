"use client";

/**
 * src/app/dashboard/holiday-requests/page.tsx  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * Visible to ADMIN and RECEPTIONIST — manage all doctor holiday requests.
 * Doctors are redirected to the doctor page where they submit requests.
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

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function HolidayRequestsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<HolidayRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);

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
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Holiday Requests</h1>
          <p className="text-sm text-slate-500 mt-1">Manage doctor leave requests</p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-slate-400">
            <CalendarOff size={32} className="opacity-40" />
            <span className="text-sm">No holiday requests yet</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Doctor</th>
                <th className="text-left px-5 py-3">Date</th>
                <th className="text-left px-5 py-3">Reason</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Submitted</th>
                {canManage && <th className="text-left px-5 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-slate-800">
                     {r.doctor.name}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">
                    {new Date(r.date).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 max-w-[200px] truncate">
                    {r.reason}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[r.status]}`}>
                      {r.status === "PENDING"  && <Clock size={10} />}
                      {r.status === "APPROVED" && <Check size={10} />}
                      {r.status === "REJECTED" && <X size={10} />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  {canManage && (
                    <td className="px-5 py-3.5">
                      {r.status === "PENDING" ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateStatus(r.id, "APPROVED")}
                            disabled={acting === r.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(r.id, "REJECTED")}
                            disabled={acting === r.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Done</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
