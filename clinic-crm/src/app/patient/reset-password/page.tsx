"use client";

/**
 * src/app/patient/reset-password/page.tsx
 * Secure password reset for authenticated patients.
 * Requires current password verification before updating.
 */

import { useState } from "react";
import Link from "next/link";

const inputCls = "w-full bg-[#F5F0E8] border border-[#D9CFC0] rounded-2xl px-4 py-3.5 text-sm font-medium text-[#3A2010] placeholder:text-[#A8998A] focus:outline-none focus:border-[#8B3A1E] focus:bg-[#FDF8F2] transition-all";
const labelCls = "block text-[11px] font-bold text-[#7A6550] uppercase tracking-widest mb-1.5";

type State = "idle" | "loading" | "success" | "error";

export default function PatientResetPassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [state,   setState]   = useState<State>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (newPassword !== confirmPassword) {
      setState("error");
      setMessage("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setState("error");
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setState("loading");

    const res = await fetch("/api/patient/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      setState("error");
      setMessage(data.error ?? "Failed to update password. Please try again.");
      return;
    }

    setState("success");
    setMessage("Password updated successfully! Use your new password next time you log in.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const EyeIcon = ({ show }: { show: boolean }) => show ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <Link href="/patient/dashboard" className="text-[#7A685F] hover:text-[#D97332] transition-colors">
          Dashboard
        </Link>
        <span className="text-[#C8BFB5]">›</span>
        <span className="text-[#2B1A14] font-semibold">Reset Password</span>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E1D5] shadow-sm overflow-hidden">
        {/* Top gradient strip */}
        <div className="h-1.5 w-full"
          style={{ background: "linear-gradient(90deg, #3E1F14 0%, #5A1F14 40%, #C8A882 100%)" }} />

        <div className="p-6 sm:p-8">
          <div className="mb-7">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF3EC] flex items-center justify-center text-2xl mb-4">
              🔑
            </div>
            <h1 className="text-2xl font-black text-[#2B1A14]">Reset Password</h1>
            <p className="text-sm mt-1 text-[#7A685F] font-medium">
              Enter your current password and choose a new one.
            </p>
          </div>

          {/* Default password hint */}
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-800">
              💡 Your default password was set as: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">FirstName_YYYY-MM-DD</code>
            </p>
            <p className="text-xs text-amber-700 mt-1">
              For example: <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono">John_2026-05-08</code>
            </p>
          </div>

          {/* State Messages */}
          {state === "error" && message && (
            <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: "#FEF2F0", border: "1px solid #F5C4B3" }}>
              <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-red-700">{message}</p>
            </div>
          )}
          {state === "success" && message && (
            <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: "#F0FAF5", border: "1px solid #9FE1CB" }}>
              <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-700">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Current Password */}
            <div>
              <label className={labelCls}>Current Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#A8998A]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showCurrent ? "text" : "password"}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Your current password"
                  className={`${inputCls} pl-11 pr-12`}
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A8998A] hover:text-[#7A685F] transition-colors">
                  <EyeIcon show={showCurrent} />
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className={labelCls}>New Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#A8998A]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input
                  type={showNew ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className={`${inputCls} pl-11 pr-12`}
                />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A8998A] hover:text-[#7A685F] transition-colors">
                  <EyeIcon show={showNew} />
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className={labelCls}>Confirm New Password</label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#A8998A]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className={`${inputCls} pl-11 pr-12`}
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A8998A] hover:text-[#7A685F] transition-colors">
                  <EyeIcon show={showConfirm} />
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={state === "loading"}
              className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #3E1F14, #5A1F14, #8B3A1E)" }}
            >
              {state === "loading" ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating…</>
              ) : "Update Password"}
            </button>

            <p className="text-center">
              <Link href="/patient/dashboard"
                className="text-sm font-medium text-[#7A685F] hover:text-[#5A1F14] transition-colors">
                ← Back to Dashboard
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
