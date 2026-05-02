"use client";

/**
 * src/components/ReassignDoctorModal.tsx  (NEW FILE)
 */

import { useState, useEffect } from "react";
import { X, UserCheck, Loader2 } from "lucide-react";

interface Doctor {
  id: string;
  name: string;
  email: string;
}

interface Props {
  appointmentId: string;
  patientName: string;
  currentDoctorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ReassignDoctorModal({
  appointmentId,
  patientName,
  currentDoctorId,
  onClose,
  onSuccess,
}: Props) {
  const [doctors, setDoctors]     = useState<Doctor[]>([]);
  const [selected, setSelected]   = useState("");
  const [notes, setNotes]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((data) => {
        const list: Doctor[] = Array.isArray(data) ? data : data.doctors ?? [];
        setDoctors(list.filter((d) => d.id !== currentDoctorId));
      })
      .catch(console.error);
  }, [currentDoctorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) { setError("Select a doctor"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/doctor-reassignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, toDoctorId: selected, notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to send request");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Reassign Doctor</h2>
            <p className="text-sm text-slate-500 mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Select New Doctor</label>
            {doctors.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No other doctors available</p>
            ) : (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500"
              >
                <option value="">— choose doctor —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for reassignment…"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 resize-none"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selected}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}
