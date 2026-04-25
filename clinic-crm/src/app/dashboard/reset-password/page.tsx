"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";

// ─── Shared style tokens (mirrors auth/login/page.tsx) ────────────────────────

const inputCls =
  "w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 transition-all";
const labelCls =
  "block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5";

// ─── Inline eye icon (no extra dep) ───────────────────────────────────────────

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// ─── Password-strength meter ───────────────────────────────────────────────────

function StrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 6,
    password.length >= 10,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  const label =
    score <= 1 ? "Weak" :
    score <= 2 ? "Fair" :
    score <= 3 ? "Good" :
    score <= 4 ? "Strong" : "Very strong";

  const color =
    score <= 1 ? "bg-red-400" :
    score <= 2 ? "bg-amber-400" :
    score <= 3 ? "bg-blue-400" :
    score <= 4 ? "bg-teal-500" : "bg-emerald-500";

  const textColor =
    score <= 1 ? "text-red-500" :
    score <= 2 ? "text-amber-500" :
    score <= 3 ? "text-blue-500" :
    score <= 4 ? "text-teal-600" : "text-emerald-600";

  if (!password) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? color : "bg-slate-100"
            }`}
          />
        ))}
      </div>
      <p className={`text-[10px] font-bold ${textColor}`}>{label}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardResetPasswordPage() {
  const router = useRouter();

  const [email,       setEmail]       = useState("");
  const [newPwd,      setNewPwd]      = useState("");
  const [confirmPwd,  setConfirmPwd]  = useState("");
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Client-side validation
    if (newPwd.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, newPassword: newPwd }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSuccess("Password updated successfully! Redirecting…");
      setEmail("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(async () => {
  const session = await getSession();

  const role = session?.user?.role;

  if (role === "ADMIN") {
    router.push("/dashboard");
  } else if (role === "DOCTOR") {
    router.push("/dashboard/doctor");
  } else if (role === "RECEPTIONIST") {
    router.push("/dashboard/booking");
  } else {
    router.push("/");
  }
}, 2000);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">
      <div className="max-w-xl mx-auto">

        {/* ── Page header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Reset Password</h1>
          </div>
          <p className="text-sm text-slate-400 ml-[42px]">
            Update your account password securely
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50 overflow-hidden">

          {/* Card top gradient strip */}
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #0a5c47, #0f8f6e, #14b8a6)" }} />

          <div className="p-8">

            {/* Security note */}
            <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200/60 rounded-2xl mb-7">
              <div className="w-6 h-6 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-teal-800">Security reminder</p>
                <p className="text-xs text-teal-700 mt-0.5 leading-relaxed">
                  Enter the email linked to your account. Passwords are hashed and never stored in plain text.
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-6 flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            {/* Success banner */}
            {success && (
              <div className="mb-6 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label className={labelCls}>Registered email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className={`${inputCls} pl-11`}
                  />
                </div>
              </div>

              {/* New password */}
              <div>
                <label className={labelCls}>New password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showNew ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="Min. 6 characters"
                    className={`${inputCls} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <EyeIcon show={showNew} />
                  </button>
                </div>
                <StrengthBar password={newPwd} />
              </div>

              {/* Confirm password */}
              <div>
                <label className={labelCls}>Confirm new password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Repeat new password"
                    className={`${inputCls} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <EyeIcon show={showConfirm} />
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPwd && (
                  <p className={`text-[10px] font-bold mt-1.5 ${
                    newPwd === confirmPwd ? "text-emerald-600" : "text-red-500"
                  }`}>
                    {newPwd === confirmPwd ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: "linear-gradient(135deg, #0a5c47, #0d7a5f)" }}
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating password…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    Update  Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Requirements hint ── */}
        <div className="mt-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Password requirements
          </p>
          <ul className="space-y-1.5">
            {[
              { rule: "At least 6 characters", pass: newPwd.length >= 6 },
              { rule: "At least 10 characters (recommended)", pass: newPwd.length >= 10 },
              { rule: "One uppercase letter", pass: /[A-Z]/.test(newPwd) },
              { rule: "One number", pass: /[0-9]/.test(newPwd) },
              { rule: "One special character", pass: /[^A-Za-z0-9]/.test(newPwd) },
            ].map(({ rule, pass }) => (
              <li key={rule} className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  newPwd ? (pass ? "bg-emerald-500" : "bg-slate-200") : "bg-slate-100"
                }`}>
                  {pass && newPwd && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <span className={`text-xs font-medium transition-colors ${
                  newPwd ? (pass ? "text-emerald-700" : "text-slate-400") : "text-slate-400"
                }`}>
                  {rule}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}