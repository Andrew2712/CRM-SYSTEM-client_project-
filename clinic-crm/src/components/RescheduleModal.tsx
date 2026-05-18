"use client";

/**
 * src/components/RescheduleModal.tsx
 *
 * FIX: The original modal used datetime-local inputs which, when passed to
 * new Date() and serialized via toISOString(), apply a UTC offset shift.
 * For IST (UTC+5:30), selecting 12:00 PM produces a string "2026-05-18T12:00"
 * which Date() treats as LOCAL time on the server but toISOString() converts
 * to UTC (06:30Z), and when displayed back in IST it re-adds +5:30 → 12:00 PM
 * appears correct on the first render but the stored value is wrong.
 *
 * The real problem is that the PATCH API receives the ISO string from the client
 * and Prisma stores it as UTC. The CLIENT must send the time the user selected,
 * interpreted as IST, converted to UTC correctly BEFORE sending.
 *
 * CORRECT APPROACH:
 *   1. Accept date + 12h-time components from UI (same spinner as BookingPage)
 *   2. Build a Date using explicit local components: new Date(y, m, d, h, min)
 *      — this always uses the BROWSER's local timezone (IST for clinic users)
 *   3. Call .toISOString() on that Date — now the UTC conversion is correct
 *      because we built the Date in local time first.
 *
 * This mirrors exactly what BookingPage does in handleBook().
 */

import { useState, useEffect } from "react";
import { X, Calendar, Loader2 } from "lucide-react";

interface Props {
  appointmentId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

// ── shared style tokens (mirror BookingPage) ──────────────────────────────────
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

// ── timezone-safe date builder ────────────────────────────────────────────────
// Builds a Date from local components (browser timezone = IST for clinic).
// new Date(y, m, d, h, min) always interprets args as LOCAL, so toISOString()
// then gives the correct UTC representation.
function buildLocalDate(
  dateStr: string,      // "YYYY-MM-DD"
  hour12: number,       // 1–12
  minute: number,       // 0–59
  ampm: "AM" | "PM"
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
}: Props) {
  // ── form state ──────────────────────────────────────────────────────────────
  const [date, setDate]         = useState("");
  const [hour, setHour]         = useState(9);    // 1–12
  const [minute, setMinute]     = useState(0);
  const [ampm, setAmpm]         = useState<"AM" | "PM">("AM");

  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Derived 24h display for preview chip
  const h24Preview = (hour % 12) + (ampm === "PM" ? 12 : 0);
  const currentTimeStr = `${pad(hour)}:${pad(minute)} ${ampm}`;

  // ── quick slot handler ──────────────────────────────────────────────────────
  function handleQuickSlot(slot: string) {
    const [h24, m] = slot.split(":").map(Number);
    const period: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    setAmpm(period);
    setHour(h12);
    setMinute(m);
  }

  // ── submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e?: React.MouseEvent | React.FormEvent) {
    e?.preventDefault?.();

    if (!date) { setError("Please select a date"); return; }

    // Build start in local time → ISO (UTC) for API
    const startDate = buildLocalDate(date, hour, minute, ampm);
    const endDate   = buildLocalDate(date, hour, minute, ampm);
    endDate.setHours(endDate.getHours() + 1); // 1-hour session

    if (startDate < new Date()) {
      setError("Cannot reschedule to a past time"); return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startDate.toISOString(),
          endTime:   endDate.toISOString(),
          status:    "RESCHEDULED",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to reschedule");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ── render ──────────────────────────────────────────────────────────────────
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

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
              <div className="w-7 h-7 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <X size={14} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-red-600">{error}</p>
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
                onChange={e => setDate(e.target.value)}
                className={`${inputCls} pl-10`}
              />
            </div>
          </div>

          {/* Time (IST) — same custom spinner as BookingPage */}
          <div>
            <label className={labelCls}>New Time (IST) <span className="text-[#D86F32]">*</span></label>

            {/* Quick-pick chips */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {QUICK_SLOTS.map(slot => {
                const [slotH24] = slot.split(":").map(Number);
                const slotPeriod = slotH24 < 12 ? "AM" : "PM";
                const slotH12   = slotH24 % 12 === 0 ? 12 : slotH24 % 12;
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

            {/* Custom spinner */}
            <div className="flex items-center gap-2">
              {/* Hour */}
              <div className="flex-1 flex flex-col items-center gap-1">
                <button type="button"
                  onClick={() => setHour(h => (h % 12) + 1)}
                  className="w-full flex items-center justify-center py-1 rounded-lg bg-[#4A0F06]/6 hover:bg-[#D86F32]/15 text-[#4A0F06]/60 hover:text-[#D86F32] transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/>
                  </svg>
                </button>
                <input type="number" min={1} max={12} value={hour}
                  onChange={e => { const v = Math.max(1, Math.min(12, Number(e.target.value))); setHour(isNaN(v) ? 1 : v); }}
                  className={spinnerCls}
                />
                <button type="button"
                  onClick={() => setHour(h => h === 1 ? 12 : h - 1)}
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
                  onClick={() => setMinute(m => (m + 5) % 60)}
                  className="w-full flex items-center justify-center py-1 rounded-lg bg-[#4A0F06]/6 hover:bg-[#D86F32]/15 text-[#4A0F06]/60 hover:text-[#D86F32] transition-all">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7"/>
                  </svg>
                </button>
                <input type="number" min={0} max={59} step={5} value={minute}
                  onChange={e => { const v = Math.max(0, Math.min(59, Number(e.target.value))); setMinute(isNaN(v) ? 0 : v); }}
                  className={spinnerCls}
                />
                <button type="button"
                  onClick={() => setMinute(m => (m - 5 + 60) % 60)}
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
                    onClick={() => setAmpm(period)}
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

              {/* Time preview */}
              <div className="flex flex-col items-center gap-1 mb-5 ml-1">
                <div className="px-3 py-2 bg-[#4A0F06] rounded-xl shadow-md shadow-[#4A0F06]/20">
                  <span className="text-base font-black font-mono text-[#F5F2E8] tracking-tight">{currentTimeStr}</span>
                </div>
                <span className="text-[10px] font-bold text-[#4A0F06]/40 uppercase tracking-wider">IST</span>
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
            className="px-4 py-2 rounded-xl text-sm font-semibold text-[#4A0F06]/60 hover:bg-[#4A0F06]/8 transition-colors"
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