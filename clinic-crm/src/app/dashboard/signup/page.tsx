"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const BRAND = {
  primary: "#5B1A0E",
  accent:  "#D46A2E",
  green:   "#4F8A5B",
  bg:      "#F5F1E8",
  border:  "#E8E1D5",
  card:    "#DDD2C2",
  text:    "#2B1A14",
  muted:   "#7A685F",
};

const inputCls =
  "w-full bg-white border-2 border-[#DDD2C2] rounded-xl px-4 py-3 text-sm font-medium text-[#2B1A14] placeholder:text-[#7A685F] focus:outline-none focus:border-[#D46A2E] transition-all";
const labelCls =
  "block text-[11px] font-bold text-[#7A685F] uppercase tracking-widest mb-1.5";

// ─── Eye icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

// ─── Role cards ───────────────────────────────────────────────────────────────
const ROLES = [
  {
    value: "DOCTOR",
    label: "Doctor",
    description: "Patient care & sessions",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    activeStyle:  { borderColor: BRAND.green,   background: BRAND.green + "12",   color: BRAND.green },
    iconStyle:    { background: BRAND.green + "20", color: BRAND.green },
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full system access",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    activeStyle:  { borderColor: BRAND.primary, background: BRAND.primary + "12", color: BRAND.primary },
    iconStyle:    { background: BRAND.primary + "20", color: BRAND.primary },
  },
  {
    value: "RECEPTIONIST",
    label: "Receptionist",
    description: "Booking & front desk",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    activeStyle:  { borderColor: BRAND.accent,  background: BRAND.accent + "12",  color: BRAND.accent },
    iconStyle:    { background: BRAND.accent + "20",  color: BRAND.accent },
  },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardSignupPage() {
  const router = useRouter();

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<"DOCTOR" | "ADMIN" | "RECEPTIONIST">("DOCTOR");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  function isValidPhone(val: string): boolean {
    return /^\+?[\d\s\-().]{7,20}$/.test(val.trim());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");

    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (!phone.trim())        { setError("Phone number is required."); return; }
    if (!isValidPhone(phone)) { setError("Please enter a valid phone number (7–20 digits, optional + prefix)."); return; }

    setLoading(true);
    try {
      const res  = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      setSuccess(`Account created for ${data.name}. Redirecting to dashboard…`);
      setName(""); setEmail(""); setPassword(""); setPhone("");
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const activeRole = ROLES.find((r) => r.value === role)!;

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: BRAND.bg }}>
      <div className="max-w-xl mx-auto">

        {/* ── Header ── */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
              style={{ background: BRAND.primary }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: BRAND.primary }}>
              Create Account
            </h1>
          </div>
          <p className="text-xs sm:text-sm ml-[42px]" style={{ color: BRAND.muted }}>
            Add a new staff member to the system
          </p>
        </div>

        {/* ── Card ── */}
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: BRAND.card }}>
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${BRAND.primary}, ${BRAND.accent}, #D9A441)` }} />

          <div className="p-5 sm:p-8">

            {/* Admin notice */}
            <div className="flex items-start gap-3 p-3 sm:p-4 rounded-2xl border mb-5 sm:mb-7"
              style={{ background: BRAND.accent + "12", borderColor: BRAND.accent + "40" }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: BRAND.accent }}>
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold" style={{ color: BRAND.primary }}>Admin action</p>
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: BRAND.text }}>
                  This creates a new staff account with immediate access. Only admins should perform this action.
                </p>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-start gap-3 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-2xl">
                <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            {/* Success banner */}
            {success && (
              <div className="mb-5 flex items-start gap-3 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-emerald-700">{success}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">

              {/* Full name */}
              <div>
                <label className={labelCls}>Full name</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: BRAND.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input required value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Dr. John Smith" className={`${inputCls} pl-11`} />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelCls}>Email address</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: BRAND.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com" className={`${inputCls} pl-11`} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}>
                  Phone number <span className="ml-1 text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: BRAND.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210" className={`${inputCls} pl-11`} />
                </div>
                <p className="text-[10px] mt-1.5 ml-0.5" style={{ color: BRAND.muted }}>
                  Include country code for international numbers (e.g. +91 for India)
                </p>
              </div>

              {/* Password */}
              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4" style={{ color: BRAND.muted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input type={showPwd ? "text" : "password"} required minLength={6}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" className={`${inputCls} pl-11 pr-12`} />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: BRAND.muted }}>
                    <EyeIcon show={showPwd} />
                  </button>
                </div>
              </div>

              {/* Role selector */}
              <div>
                <label className={labelCls}>Role</label>
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {ROLES.map((r) => {
                    const isActive = role === r.value;
                    return (
                      <button key={r.value} type="button" onClick={() => setRole(r.value)}
                        className="flex flex-col items-center gap-1.5 sm:gap-2 py-3 sm:py-4 px-2 sm:px-3 rounded-xl border-2 text-xs font-semibold transition-all"
                        style={isActive
                          ? r.activeStyle
                          : { borderColor: BRAND.card, background: BRAND.bg, color: BRAND.muted }}>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all"
                          style={isActive ? r.iconStyle : { background: BRAND.border, color: BRAND.muted }}>
                          {r.icon}
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-[11px] sm:text-xs">{r.label}</p>
                          <p className="text-[9px] sm:text-[10px] font-medium mt-0.5 opacity-70 hidden sm:block">
                            {r.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading || !!success}
                className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-3 sm:py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.accent})` }}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create {activeRole.label} Account
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* ── Role permissions reference ── */}
        <div className="mt-4 sm:mt-5 bg-white rounded-2xl border shadow-sm p-4 sm:p-5" style={{ borderColor: BRAND.card }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.muted }}>
            Role permissions
          </p>
          <div className="space-y-2 sm:space-y-3">
            {[
              { role: "Doctor",       icon: "🩺", color: BRAND.green,   perms: ["View assigned patients", "Manage sessions", "Doctor dashboard"] },
              { role: "Admin",        icon: "⚙️", color: BRAND.primary, perms: ["Full system access", "Analytics & reports", "User management"] },
              { role: "Receptionist", icon: "📋", color: BRAND.accent,  perms: ["Booking management", "Patient check-in", "Notifications"] },
            ].map(({ role: r, icon, color, perms }) => (
              <div key={r} className="flex items-start gap-2 sm:gap-3">
                <span className="text-[10px] font-black px-2 py-1 rounded-lg border flex items-center gap-1 flex-shrink-0"
                  style={{ color, background: color + "12", borderColor: color + "30" }}>
                  <span>{icon}</span><span>{r}</span>
                </span>
                <p className="text-xs font-medium leading-relaxed" style={{ color: BRAND.muted }}>
                  {perms.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}