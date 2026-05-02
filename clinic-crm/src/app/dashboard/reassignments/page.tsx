"use client";

/**
 * src/app/dashboard/reassignments/page.tsx  (NEW FILE)
 * Doctors see their pending requests to accept/reject.
 * Admin/Receptionist see all requests.
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

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

export default function ReassignmentsPage() {
  const { data: session } = useSession();
  const [requests, setRequests] = useState<ReassignmentRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);

  const role = session?.user?.role ?? "";
  const userId = session?.user?.id ?? "";
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
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Reassignment Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isDoctor ? "Requests assigned to you" : "All doctor reassignment requests"}
          </p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Loading…</div>
        ) : requests.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3 text-slate-400">
            <UserCheck size={32} className="opacity-40" />
            <span className="text-sm">No reassignment requests</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Patient</th>
                <th className="text-left px-5 py-3">Appointment</th>
                <th className="text-left px-5 py-3">From</th>
                <th className="text-left px-5 py-3">To</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Notes</th>
                {(isDoctor || role === "ADMIN") && <th className="text-left px-5 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {requests.map((r) => {
                const canAct =
                  r.status === "PENDING" &&
                  (isDoctor ? r.toDoctor.id === userId : role === "ADMIN");

                return (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-800">
                      {r.appointment.patient.name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 text-xs">
                      {new Date(r.appointment.startTime).toLocaleString("en-IN", {
                        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600"> {r.fromDoctor.name}</td>
                    <td className="px-5 py-3.5 text-slate-600"> {r.toDoctor.name}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-xs max-w-[150px] truncate">
                      {r.notes ?? "—"}
                    </td>
                    {(isDoctor || role === "ADMIN") && (
                      <td className="px-5 py-3.5">
                        {canAct ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => respond(r.id, "ACCEPTED")}
                              disabled={acting === r.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              <Check size={12} /> Accept
                            </button>
                            <button
                              onClick={() => respond(r.id, "REJECTED")}
                              disabled={acting === r.id}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
                            >
                              <X size={12} /> Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
