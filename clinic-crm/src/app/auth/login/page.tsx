"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type View = "login" | "signup" | "forgot";

// Role-based redirect map
const ROLE_REDIRECT: Record<string, string> = {
  ADMIN:        "/dashboard",
  DOCTOR:       "/dashboard/doctor",
  RECEPTIONIST: "/dashboard/booking",
};

const inputCls = "w-full bg-[#F5F0E8] border border-[#D9CFC0] rounded-2xl px-4 py-3.5 text-sm font-medium text-[#3A2010] placeholder:text-[#A8998A] focus:outline-none focus:border-[#8B3A1E] focus:bg-[#FDF8F2] transition-all";
const labelCls = "block text-[11px] font-bold text-[#7A6550] uppercase tracking-widest mb-1.5";

export default function AuthPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");

  const [loginEmail,    setLoginEmail]    = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd,  setShowLoginPwd]  = useState(false);

  const [signupName,     setSignupName]     = useState("");
  const [signupEmail,    setSignupEmail]    = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole,     setSignupRole]     = useState("DOCTOR");
  const [showSignupPwd,  setShowSignupPwd]  = useState(false);

  const [forgotEmail,    setForgotEmail]    = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm,  setForgotConfirm]  = useState("");
  const [showForgotPwd,  setShowForgotPwd]  = useState(false);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  function reset() { setError(""); setSuccess(""); }

  // ── Login with role-based redirect ──────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); reset();

    const res = await signIn("credentials", {
      email: loginEmail,
      password: loginPassword,
      redirect: false,
    });

    if (res?.error) {
      setLoading(false);
      setError("Invalid email or password. Please try again.");
      return;
    }

    // Fetch session to get role for redirect
    try {
      const sessionRes = await fetch("/api/auth/session");
      const session    = await sessionRes.json();
      const role       = session?.user?.role ?? "DOCTOR";
      const dest       = ROLE_REDIRECT[role] ?? "/dashboard";
      router.push(dest);
    } catch {
      router.push("/dashboard");
    }

    setLoading(false);
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); reset();
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signupName, email: signupEmail, password: signupPassword, role: signupRole }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess(`Account created for ${data.name}. Redirecting to sign in…`);
    setSignupName(""); setSignupEmail(""); setSignupPassword("");
    setTimeout(() => { setView("login"); setSuccess(""); }, 2000);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (forgotPassword !== forgotConfirm) { setError("Passwords do not match."); return; }
    if (forgotPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail, newPassword: forgotPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess("Password updated! Redirecting to sign in…");
    setForgotEmail(""); setForgotPassword(""); setForgotConfirm("");
    setTimeout(() => { setView("login"); setSuccess(""); }, 2000);
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
    <div
      className="min-h-screen flex overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #3E1F14 0%, #5A1F14 50%, #7A2E1C 100%)"
      }}
    >

      {/* ── LEFT PANEL — Branding ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-12 relative overflow-hidden">

        {/* Background decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute top-1/3 -right-16 w-56 h-56 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 left-1/4 w-72 h-72 rounded-full bg-black/10" />
        <div className="absolute top-20 right-1/3 w-16 h-16 rounded-full bg-white/10" />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[#5A1F14]/20 shadow-lg bg-white">
            <img
              src="/logo.png"
              alt="Vyayama Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="text-2xl font-black text-[#EAE6DC] leading-tight tracking-tight">
              Vyayama-Physio
            </p>
            <p className="text-sm text-[#EAE6DC]/70 leading-tight mt-1 font-medium">
              Clinic management
            </p>
          </div>
        </div>

        {/* Main hero illustration area */}
        <div className="relative flex-1 flex flex-col items-center justify-center py-12">

          {/* Central body SVG — physiotherapy themed */}
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full bg-white/5 blur-3xl scale-150" />

            {/* Main illustration card */}
            <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-10 shadow-2xl">

              {/* Physio human silhouette SVG */}
              <svg width="200" height="260" viewBox="0 0 200 260" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="100" cy="36" r="22" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.5" strokeWidth="2"/>
                <rect x="92" y="56" width="16" height="14" rx="6" fill="white" fillOpacity="0.12"/>
                <path d="M60 80 Q60 70 100 70 Q140 70 140 80 L145 145 Q145 155 100 158 Q55 155 55 145 Z"
                  fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.3" strokeWidth="1.5"/>
                <path d="M100 72 L100 155" stroke="white" strokeOpacity="0.25" strokeWidth="1.5" strokeDasharray="4 4"/>
                <path d="M62 90 Q40 75 20 55" stroke="white" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="18" cy="53" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.5" strokeWidth="1.5"/>
                <path d="M138 90 Q160 75 180 55" stroke="white" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="182" cy="53" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.5" strokeWidth="1.5"/>
                <path d="M24 53 Q100 20 176 53" stroke="white" strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="6 3"/>
                <path d="M80 155 Q75 195 70 230" stroke="white" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round"/>
                <path d="M66 230 Q70 235 80 232" stroke="white" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round"/>
                <path d="M120 155 Q125 195 130 230" stroke="white" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round"/>
                <path d="M134 230 Q130 235 120 232" stroke="white" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="62" cy="90" r="4" fill="white" fillOpacity="0.4"/>
                <circle cx="138" cy="90" r="4" fill="white" fillOpacity="0.4"/>
                <circle cx="80" cy="155" r="4" fill="white" fillOpacity="0.4"/>
                <circle cx="120" cy="155" r="4" fill="white" fillOpacity="0.4"/>
                <circle cx="73" cy="193" r="5" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
                <circle cx="127" cy="193" r="5" fill="white" fillOpacity="0.2" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
                <circle cx="62" cy="85" r="6" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
                <circle cx="138" cy="85" r="6" fill="white" fillOpacity="0.15" stroke="white" strokeOpacity="0.4" strokeWidth="1.5"/>
                <path d="M72 112 L82 112 L87 100 L93 124 L99 108 L104 115 L110 115 L128 115"
                  stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Floating metric cards */}
            <div className="absolute -top-4 -right-8 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Recovery</p>
              <p className="text-xl font-black text-white">94%</p>
              <div className="mt-1.5 h-1 bg-white/20 rounded-full overflow-hidden w-20">
                <div className="h-full bg-white/70 rounded-full" style={{ width: "94%" }} />
              </div>
            </div>

            <div className="absolute -bottom-4 -left-8 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 shadow-lg">
              <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">Sessions Today</p>
              <p className="text-xl font-black text-white">12</p>
              <div className="flex gap-1 mt-1.5">
                {[8,6,9,7,11,12].map((v, i) => (
                  <div key={i} className="w-2 rounded-sm bg-white/40" style={{ height: `${(v/12)*20}px`, alignSelf: "flex-end" }} />
                ))}
              </div>
            </div>

            <div className="absolute top-1/2 -left-12 -translate-y-1/2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-3 py-2.5 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-400/30 rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-[9px] text-white/50 font-semibold">Attended</p>
                  <p className="text-sm font-black text-white">8/12</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative">
          <h2 className="text-3xl font-black text-[#EAE6DC] leading-tight tracking-tight mb-3">
            Smart Physio<br />
            <span className="text-[#EAE6DC]/70">Management</span>
          </h2>
          <p className="text-[#EAE6DC]/60 text-sm leading-relaxed max-w-xs">
            Track patients, manage sessions, and monitor recovery — all in one place.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {["Patient Tracking", "Phase Management", "Session Analytics", "Smart Booking"].map(f => (
              <span key={f} className="text-[10px] font-semibold text-white/70 bg-white/10 border border-white/15 px-3 py-1.5 rounded-full">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth form ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Vyayama Logo" className="w-full h-full object-cover" />
            </div>
            <p className="text-[#EAE6DC] font-extrabold text-lg">Vyayama Physio</p>
          </div>

          {/* ── BEIGE CARD ── */}
          <div
            className="rounded-3xl shadow-2xl shadow-black/20 overflow-hidden"
            style={{ background: "#FDF8F2" }}
          >

            {/* Card top gradient strip */}
            <div
              className="h-1.5 w-full"
              style={{
                background: "linear-gradient(90deg, #3E1F14 0%, #5A1F14 40%, #C8A882 100%)"
              }}
            />

            <div className="p-8">

              {/* ── LOGIN VIEW ── */}
              {view === "login" && (
                <>
                  <div className="mb-8">
                    <h1 className="text-3xl font-black tracking-tight" style={{ color: "#2A1008" }}>
                      Welcome back
                    </h1>
                    <p className="text-sm mt-1 font-medium" style={{ color: "#8A7060" }}>
                      Sign in to your Vyayama account
                    </p>
                  </div>

                  {/* Error / success banners */}
                  {error && (
                    <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl"
                      style={{ background: "#FEF2F0", border: "1px solid #F5C4B3" }}>
                      <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-red-700">{error}</p>
                    </div>
                  )}
                  {success && (
                    <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl"
                      style={{ background: "#F0FAF5", border: "1px solid #9FE1CB" }}>
                      <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">{success}</p>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-5">
                    {/* Email */}
                    <div>
                      <label className={labelCls}>Email address</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          required
                          value={loginEmail}
                          onChange={e => setLoginEmail(e.target.value)}
                          placeholder="admin@clinic.com"
                          className={`${inputCls} pl-11`}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className={labelCls}>Password</label>
                      <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <input
                          type={showLoginPwd ? "text" : "password"}
                          required
                          value={loginPassword}
                          onChange={e => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          className={`${inputCls} pl-11 pr-12`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPwd(!showLoginPwd)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                          style={{ color: "#A8998A" }}
                        >
                          <EyeIcon show={showLoginPwd} />
                        </button>
                      </div>
                    </div>

                    {/* Sign in button */}
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-50 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 mt-2"
                      style={{ background: "linear-gradient(135deg, #3E1F14, #5A1F14, #8B3A1E)" }}
                    >
                      {loading ? (
                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> logging in…</>
                      ) : (
                        <>
                          login
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M13 5l7 7-7 7" />
                          </svg>
                        </>
                      )}
                    </button>

                    {/* Forgot password link */}
                    <p className="text-center text-sm font-medium pt-1" style={{ color: "#A8998A" }}>
                      Forgot your password? <b style={{ color: "#5A1F14" }}>Contact Admin...</b>
                    </p>
                  </form>
                </>
              )}

              {/* ── SIGNUP & FORGOT views ── */}
              {(view === "signup" || view === "forgot") && (
                <>
                  <div className="mb-7">
                    <h1 className="text-2xl font-black tracking-tight" style={{ color: "#2A1008" }}>
                      {view === "signup" ? "Create account" : "Reset password"}
                    </h1>
                    <p className="text-sm mt-1 font-medium" style={{ color: "#8A7060" }}>
                      {view === "signup" ? "Set up a new staff account" : "Enter your email to reset access"}
                    </p>
                  </div>

                  {/* Tab switcher */}
                  <div className="flex gap-1 mb-7 p-1 rounded-2xl" style={{ background: "#EDE5D8" }}>
                    {(["login", "signup", "forgot"] as View[]).map(v => (
                      <button key={v} type="button"
                        onClick={() => { setView(v); reset(); }}
                        className={`flex-1 text-xs py-2.5 rounded-xl font-bold transition-all ${
                          view === v
                            ? "shadow-sm"
                            : ""
                        }`}
                        style={{
                          background: view === v ? "#FDF8F2" : "transparent",
                          color: view === v ? "#2A1008" : "#8A7060",
                        }}
                      >
                        {v === "forgot" ? "Reset" : v.charAt(0).toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Banners */}
                  {error && (
                    <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl"
                      style={{ background: "#FEF2F0", border: "1px solid #F5C4B3" }}>
                      <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-red-700">{error}</p>
                    </div>
                  )}
                  {success && (
                    <div className="mb-5 flex items-center gap-3 p-4 rounded-2xl"
                      style={{ background: "#F0FAF5", border: "1px solid #9FE1CB" }}>
                      <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">{success}</p>
                    </div>
                  )}

                  {/* ── SIGNUP ── */}
                  {view === "signup" && (
                    <form onSubmit={handleSignup} className="space-y-4">
                      <div>
                        <label className={labelCls}>Full name</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <input required value={signupName} onChange={e => setSignupName(e.target.value)}
                            placeholder="Dr. John Smith" className={`${inputCls} pl-11`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Email address</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <input type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                            placeholder="doctor@clinic.com" className={`${inputCls} pl-11`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Password</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <input type={showSignupPwd ? "text" : "password"} required minLength={6}
                            value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                            placeholder="Min. 6 characters" className={`${inputCls} pl-11 pr-12`} />
                          <button type="button" onClick={() => setShowSignupPwd(!showSignupPwd)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: "#A8998A" }}>
                            <EyeIcon show={showSignupPwd} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Role</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: "DOCTOR",       label: "Doctor",       icon: "🩺" },
                            { value: "ADMIN",        label: "Admin",        icon: "⚙️" },
                            { value: "RECEPTIONIST", label: "Receptionist", icon: "📋" },
                          ].map(r => (
                            <button key={r.value} type="button"
                              onClick={() => setSignupRole(r.value)}
                              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-xs font-semibold transition-all"
                              style={{
                                border: signupRole === r.value ? "2px solid #8B3A1E" : "1px solid #D9CFC0",
                                background: signupRole === r.value ? "#F5EBE0" : "#F0E9DE",
                                color: signupRole === r.value ? "#5A1F14" : "#8A7060",
                              }}>
                              <span className="text-base">{r.icon}</span>
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg hover:-translate-y-0.5"
                        style={{ background: "linear-gradient(135deg, #3E1F14, #5A1F14, #8B3A1E)" }}>
                        {loading ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Creating account…</>
                        ) : "Create Account"}
                      </button>
                    </form>
                  )}

                  {/* ── FORGOT ── */}
                  {view === "forgot" && (
                    <form onSubmit={handleForgot} className="space-y-4">
                      <div>
                        <label className={labelCls}>Registered email</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                            placeholder="your@email.com" className={`${inputCls} pl-11`} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>New password</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          </div>
                          <input type={showForgotPwd ? "text" : "password"} required minLength={6}
                            value={forgotPassword} onChange={e => setForgotPassword(e.target.value)}
                            placeholder="Min. 6 characters" className={`${inputCls} pl-11 pr-12`} />
                          <button type="button" onClick={() => setShowForgotPwd(!showForgotPwd)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: "#A8998A" }}>
                            <EyeIcon show={showForgotPwd} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Confirm new password</label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg className="w-4 h-4" style={{ color: "#A8998A" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <input type="password" required value={forgotConfirm} onChange={e => setForgotConfirm(e.target.value)}
                            placeholder="Repeat new password" className={`${inputCls} pl-11`} />
                        </div>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full flex items-center justify-center gap-2 text-white text-sm font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all shadow-lg hover:-translate-y-0.5"
                        style={{ background: "linear-gradient(135deg, #3E1F14, #5A1F14, #8B3A1E)" }}>
                        {loading ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Updating…</>
                        ) : "Update Password"}
                      </button>
                    </form>
                  )}
                </>
              )}

            </div>
          </div>

          <p className="text-center text-white/30 text-xs mt-6 font-medium">
            © 2026 Vyayama Physio · All rights reserved
          </p>
        </div>
      </div>
    </div>
  );
}