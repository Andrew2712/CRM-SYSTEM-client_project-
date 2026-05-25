"use client";

/**
 * src/components/RescheduleModal.tsx
 *
 * ─── WHAT CHANGED ────────────────────────────────────────────────────────────
 *
 * 1. CONFLICT RESPONSE HANDLING
 *    The API now returns HTTP 409 with { error: "..." } when the target slot is
 *    already taken. The modal reads res.status === 409 and shows a clear message
 *    instead of a generic "Failed to reschedule" text.
 *
 * 2. DUPLICATE-SUBMIT PREVENTION
 *    The "Reschedule" button is disabled while `saving` is true AND the form
 *    cannot be re-submitted once a save is in flight — the onClick handler
 *    guards with an early return when saving === true.
 *
 * 3. SLOT LIST REFRESH ON CONFLICT
 *    onConflict() callback (optional) is called when a 409 arrives, so the
 *    parent BookingPage can re-fetch the appointment list and reveal the slot
 *    that was just taken by the other user.
 *
 * 4. PAST-DATE GUARD
 *    Unchanged from original — still validated client-side before sending.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { X, Calendar, Loader2, AlertTriangle } from "lucide-react";

interface Props {
  appointmentId: string;
  patientName:   string;
  onClose:       () => void;
  onSuccess:     () => void;
  /** Called when the API returns 409 — lets the parent refresh the slot list. */
  onConflict?:   () => void;
}

// ── shared style tokens ───────────────────────────────────────────────────────
const inputCls =
  "w-full bg-[#FAF8F2] border-2 border-[#4A0F06]/12 rounded-xl px-4 py-3 text-sm font-medium text-[#4A0F06] placeholder:text-[#4A0F06]/30 focus:outline-none focus:ring-0 focus:border-[#D86F32]/50 transition-all";
const labelCls =
  "block text-[11px] font-bold text-[#4A0F06]/50 uppercase tracking-widest mb-1.5";
const spinnerCls =
  "w-full bg-[#FAF8F2] border-2 border-[#4A0F06]/12 rounded-xl px-3 py-3 text-sm font-mono font-bold text-[#4A0F06] text-center focus:outline-none focus:ring-0 focus:border-[#D86F32]/50 transition-all appearance-none";

const pad = (n: number) => String(n).padStart(2, "0");

const QUICK_SLOTS = [
  "08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00",
  "19:00","20:00","21:00",
];

function buildLocalDate(
  dateStr: string,
  hour12:  number,
  minute:  number,
  ampm:    "AM" | "PM"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  let h24 = hour12 % 12;
  if (ampm === "PM") h24 += 12;
  return new Date(year, month - 1, day, h24, minute, 0, 0);
}

export default function RescheduleModal({
  appointmentId,
  patientName,
  onClose,
  onSuccess,
  onConflict,
}: Props) {
  const [date,   setDate]   = useState("");
  const [hour,   setHour]   = useState(9);
  const [minute, setMinute] = useState(0);
  const [ampm,   setAmpm]   = useState<"AM" | "PM">("AM");

  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const h24Preview     = (hour % 12) + (ampm === "PM" ? 12 : 0);
  const currentTimeStr = `${pad(hour)}:${pad(minute)} ${ampm}`;

  function handleQuickSlot(slot: string) {
    const [h24, m]        = slot.split(":").map(Number);
    const period: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
    const h12             = h24 % 12 === 0 ? 12 : h24 % 12;
    setAmpm(period);
    setHour(h12);
    setMinute(m);
    // Clear any previous conflict error when user picks a new slot
    setError(null);
    setIsConflict(false);
  }

  async function handleSubmit(e?: React.MouseEvent | React.FormEvent) {
    e?.preventDefault?.();

    // Guard: prevent double-submit while save is in flight
    if (saving) return;

    if (!date) { setError("Please select a date"); return; }

    const startDate = buildLocalDate(date, hour, minute, ampm);
    const endDate   = buildLocalDate(date, hour, minute, ampm);
    endDate.setHours(endDate.getHours() + 1);

    if (startDate < new Date()) {
      setError("Cannot reschedule to a past time");
      return;
    }

    setSaving(true);
    setError(null);
    setIsConflict(false);

    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startDate.toISOString(),
          endTime:   endDate.toISOString(),
          status:    "RESCHEDULED",
        }),
      });

      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setIsConflict(true);
        setError(data.error ?? "That slot is already taken. Please choose a different time.");
        // Ask parent to refresh the appointments list so the newly-booked
        // slot becomes visible in the UI immediately.
        onConflict?.();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to reschedule. Please try again.");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-[#FAF8F2] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-[#4A0F06]/8">

        {/* Header */}
        <div
          className="px-6 py-4 border-b border-[#4A0F06]/8 relative overflow-hidden flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #4A0F06, #5C1408)" }}
        >
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-white/8 rounded-full" />
          <div className="absolute right-8 bottom-0 w-10 h-10 bg-white/8 rounded-full" />
          <div className="relative">
            <h2 className="text-base font-bold text-[#F5F2E8]">Reschedule Appointment</h2>
            <p className="text-xs text-[#F5F2E8]/60 mt-0.5">{patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="relative p-2 rounded-xl hover:bg-white/10 text-[#F5F2E8]/70 hover:text-[#F5F2E8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Error / conflict banner */}
          {error && (
            <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
              isConflict
                ? "bg-amber-50 border-amber-200"
                : "bg-red-50 border-red-200"
            }`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isConflict ? "bg-amber-500" : "bg-red-500"
              }`}>
                {isConflict
                  ? <AlertTriangle size={14} className="text-white" />
                  : <X size={14} className="text-white" />
                }
              </div>
              <div>
                <p className={`text-sm font-semibold ${isConflict ? "text-amber-700" : "text-red-600"}`}>
                  {error}
                </p>
                {isConflict && (
                  <p className="text-xs text-amber-600 mt-1">
                    The appointments list has been refreshed. Please select a free slot.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className={labelCls}>
              New Date <span className="text-[#D86F32]">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
              </div>
              <input
                required
                type="date"
                value={date}
                min={todayStr}
                onChange={e => { setDate(e.target.value); setError(null); setIsConflict(false); }}
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>

          {/* Time (IST) */}
          <div>
            <label className={labelCls}>New Time (IST) <span className="text-[#D86F32]">*</span></label>

            {/* Quick-pick chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_SLOTS.map(slot => {
                const [slotH24]  = slot.split(":").map(Number);
                const slotPeriod = slotH24 < 12 ? "AM" : "PM";
                const slotH12    = slotH24 % 12 === 0 ? 12 : slotH24 % 12;
                const active = hour === slotH12 && minute === 0 && ampm === slotPeriod;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleQuickSlot(slot)}
                    className={`text-xs font-mono font-semibold px-2.5 py-1.5 rounded-lg border-2 transition-all ${
                      active
                        ? "bg-[#4A0F06] border-[#4A0F06] text-[#F5F2E8] shadow-sm shadow-[#4A0F06]/20"
                        : "bg-[#FAF8F2] border-[#4A0F06]/12 text-[#4A0F06]/60 hover:border-[#D86F32]/40 hover:text-[#D86F32]"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>

            {/* Spinner */}
            <div className="flex items-center gap-2">
              {/* Hour */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <button type="button"
                  onClick={() => { setHour(h => (h % 12) + 1); setError(null); setIsConflict(false); }}
                  className="w-full flex items-center justify-center py-1 rounded-lg bg-[#4A0F06]/6 hover:bg-[#D86F32]/15 text-[#4A0F06]/60 hover:text-[#D86F32] transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/>
                  </svg>
                </button>
                <input type="number" min={1} max={12} value={hour}
                  onChange={e => { const v = Math.max(1, Math.min(12, Number(e.target.value))); setHour(isNaN(v) ? 1 : v); setError(null); setIsConflict(false); }}
                  className={spinnerCls}
                />
                <button type="button"
                  onClick={() => { setHour(h => h === 1 ? 12 : h - 1); setError(null); setIsConflict(false); }}
                  className="w-full flex items-center justify-center py-1 rounded-lg bg-[#4A0F06]/6 hover:bg-[#D86F32]/15 text-[#4A0F06]/60 hover:text-[#D86F32] transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                <span className="text-[10px] font-bold text-[#4A0F06]/40 uppercase tracking-wider">Hour</span>
              </div>

              <div className="text-2xl font-black text-[#4A0F06]/30 mb-5 select-none">:</div>

              {/* Minute */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <button type="button"
                  onClick={() => { setMinute(m => (m + 5) % 60); setError(null); setIsConflict(false); }}
                  className="w-full flex items-center justify-center py-1 rounded-lg bg-[#4A0F06]/6 hover:bg-[#D86F32]/15 text-[#4A0F06]/60 hover:text-[#D86F32] transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/>
                  </svg>
                </button>
                <input type="number" min={0} max={59} step={5} value={minute}
                  onChange={e => { const v = Math.max(0, Math.min(59, Number(e.target.value))); setMinute(isNaN(v) ? 0 : v); setError(null); setIsConflict(false); }}
                  className={spinnerCls}
                />
                <button type="button"
                  onClick={() => { setMinute(m => (m - 5 + 60) % 60); setError(null); setIsConflict(false); }}
                  className="w-full flex items-center justify-center py-1 rounded-lg bg-[#4A0F06]/6 hover:bg-[#D86F32]/15 text-[#4A0F06]/60 hover:text-[#D86F32] transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                <span className="text-[10px] font-bold text-[#4A0F06]/40 uppercase tracking-wider">Min</span>
              </div>

              {/* AM/PM */}
              <div className="flex flex-col items-center gap-1.5 mb-5">
                {(["AM", "PM"] as const).map(period => (
                  <button key={period} type="button"
                    onClick={() => { setAmpm(period); setError(null); setIsConflict(false); }}
                    className={`w-12 py-2 rounded-xl border-2 text-xs font-black tracking-wider transition-all ${
                      ampm === period
                        ? "bg-[#4A0F06] border-[#4A0F06] text-[#F5F2E8] shadow-sm shadow-[#4A0F06]/20"
                        : "bg-[#FAF8F2] border-[#4A0F06]/12 text-[#4A0F06]/40 hover:border-[#D86F32]/40 hover:text-[#D86F32]"
                    }`}>
                    {period}
                  </button>
                ))}
                <span className="text-[10px] font-bold text-[#4A0F06]/40 uppercase tracking-wider">Period</span>
              </div>

              {/* Preview */}
              <div className="flex flex-col items-center gap-1 mb-5 ml-1">
                <div className="px-3 py-2 bg-[#4A0F06] rounded-xl shadow-md shadow-[#4A0F06]/20">
                  <span className="text-base font-black font-mono text-[#F5F2E8] tracking-tight">{currentTimeStr}</span>
                </div>
                <span className="text-[10px] font-bold text-[#4A0F06]/40 uppercase tracking-wider">
                  {pad(h24Preview)}:{pad(minute)} IST
                </span>
              </div>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-3 p-4 bg-[#D86F32]/8 border border-[#D86F32]/20 rounded-2xl">
            <div className="w-6 h-6 bg-[#D86F32] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-[#4A0F06]">Session duration</p>
              <p className="text-xs text-[#4A0F06]/60 mt-0.5 leading-relaxed">
                End time will be set to 1 hour after start. Times are stored in UTC and displayed in IST.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#4A0F06]/8 bg-[#4A0F06]/2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[#4A0F06]/60 hover:bg-[#4A0F06]/8 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !date}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-[#4A0F06] text-[#F5F2E8] hover:bg-[#5C1408] disabled:opacity-50 transition-colors shadow-sm shadow-[#4A0F06]/25"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" />Saving…</>
              : <><Calendar size={14} />Reschedule</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
