"use client";

/**
 * src/components/HolidayRequestForm.tsx  (NEW FILE)
 * ─────────────────────────────────────────────────────────────────────────────
 * Used in the Doctor dashboard (doctor/page.tsx) to submit a holiday request.
 * Also used in the Admin view to manage requests.
 */

import { useState } from "react";
import { CalendarOff, Loader2 } from "lucide-react";

interface Props {
  onSuccess?: () => void;
}

export default function HolidayRequestForm({ onSuccess }: Props) {
  const [date,    setDate]    = useState("");
  const [reason,  setReason]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason.trim()) { setError("Date and reason are required"); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/holiday-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to submit");
        return;
      }
      setSuccess(true);
      setDate("");
      setReason("");
      onSuccess?.();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
          <CalendarOff size={18} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">Holiday Request</h3>
          <p className="text-xs text-slate-500">Request a day off — admin will review</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 text-green-700 rounded-xl text-sm">
          ✅ Holiday request submitted successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Brief reason for the leave request…"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarOff size={14} />}
          Submit Request
        </button>
      </form>
    </div>
  );
}
