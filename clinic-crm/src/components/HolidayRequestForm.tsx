"use client";

/**
 * src/components/HolidayRequestForm.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Theme Updated Version
 * Responsive + Theme Color Integrated
 */

import { useState } from "react";
import { CalendarOff, Loader2 } from "lucide-react";

interface Props {
  onSuccess?: () => void;
}

export default function HolidayRequestForm({ onSuccess }: Props) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !reason.trim()) {
      setError("Date and reason are required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/holiday-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
    <div
      className="
        bg-white
        rounded-3xl
        border border-[#EADFD3]
        shadow-[0_10px_40px_rgba(75,15,5,0.08)]
        p-4 sm:p-5 lg:p-6
        transition-all duration-200
      "
    >
      {/* Header */}
      <div className="flex items-start sm:items-center gap-3 mb-5">
        <div
          className="
            w-10 h-10
            rounded-2xl
            bg-[#F4E6DC]
            flex items-center justify-center
            flex-shrink-0
          "
        >
          <CalendarOff size={18} className="text-[#8B3E2F]" />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-[#4B0F05]">
            Holiday Request
          </h3>

          <p className="text-xs sm:text-sm text-[#8A6A63] mt-0.5">
            Request a leave day — admin will review your request
          </p>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div
          className="
            mb-4
            px-4 py-3
            rounded-2xl
            border border-[#D8E8D8]
            bg-[#F2FAF2]
            text-[#2F6B3A]
            text-sm
            font-medium
          "
        >
          ✅ Holiday request submitted successfully!
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          className="
            mb-4
            px-4 py-3
            rounded-2xl
            border border-[#F2D2D2]
            bg-[#FFF5F5]
            text-[#B42318]
            text-sm
            font-medium
          "
        >
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Date */}
        <div>
          <label className="block text-xs font-bold text-[#6B4C45] mb-2">
            Select Date
          </label>

          <input
            type="date"
            value={date}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="
              w-full
              px-4 py-3
              rounded-2xl
              border border-[#E5D6CB]
              bg-white
              text-sm text-[#4B0F05]
              outline-none
              transition-all duration-200
              focus:border-[#8B3E2F]
              focus:ring-4 focus:ring-[#8B3E2F]/10
            "
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-bold text-[#6B4C45] mb-2">
            Reason
          </label>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Brief reason for your leave request..."
            className="
              w-full
              px-4 py-3
              rounded-2xl
              border border-[#E5D6CB]
              bg-white
              text-sm text-[#4B0F05]
              resize-none
              outline-none
              transition-all duration-200
              placeholder:text-[#B89E95]
              focus:border-[#8B3E2F]
              focus:ring-4 focus:ring-[#8B3E2F]/10
            "
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="
            w-full
            flex items-center justify-center gap-2
            px-5 py-3
            rounded-2xl
            bg-[#8B3E2F]
            hover:bg-[#6E2F23]
            text-white
            text-sm font-semibold
            transition-all duration-200
            hover:shadow-[0_8px_24px_rgba(75,15,5,0.18)]
            disabled:opacity-50
            disabled:cursor-not-allowed
          "
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CalendarOff size={16} />
          )}

          {saving ? "Submitting Request..." : "Submit Request"}
        </button>
      </form>
    </div>
  );
}