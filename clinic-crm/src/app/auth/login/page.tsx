"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

type View = "login" | "signup" | "forgot";

export default function AuthPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("login");

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupRole, setSignupRole] = useState("DOCTOR");

  // Forgot state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotConfirm, setForgotConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function reset() { setError(""); setSuccess(""); }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); reset();
    const res = await signIn("credentials", { email: loginEmail, password: loginPassword, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password");
    else router.push("/dashboard");
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
    setSuccess(`Account created for ${data.name} (${data.role}). You can now sign in.`);
    setSignupName(""); setSignupEmail(""); setSignupPassword("");
    setTimeout(() => { setView("login"); setSuccess(""); }, 2000);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (forgotPassword !== forgotConfirm) { setError("Passwords do not match"); return; }
    if (forgotPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail, newPassword: forgotPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error); return; }
    setSuccess("Password updated! You can now sign in.");
    setForgotEmail(""); setForgotPassword(""); setForgotConfirm("");
    setTimeout(() => { setView("login"); setSuccess(""); }, 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">Vyayamaphysio CRM</h1>
          <p className="text-sm text-gray-400 mt-1">
            {view === "login" && "Sign in to your account"}
            {view === "signup" && "Create a new account"}
            {view === "forgot" && "Reset your password"}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-50 p-1 rounded-lg">
          {(["login","signup","forgot"] as View[]).map(v => (
            <button key={v} onClick={() => { setView(v); reset(); }}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors capitalize
                ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
              {v === "forgot" ? "Reset" : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 rounded-lg text-xs text-red-600">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 rounded-lg text-xs text-green-700">{success}</div>}

        {/* Login form */}
        {view === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email</label>
              <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="admin@clinic.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Password</label>
              <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <p className="text-center text-xs text-gray-400">
              Forgot password?{" "}
              <button type="button" onClick={() => { setView("forgot"); reset(); }}
                className="text-teal-600 hover:underline">Reset it</button>
            </p>
          </form>
        )}

        {/* Signup form */}
        {view === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Full name</label>
              <input required value={signupName} onChange={e => setSignupName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Dr. John Smith" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email</label>
              <input type="email" required value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="doctor@clinic.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Password</label>
              <input type="password" required minLength={6} value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Min. 6 characters" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select value={signupRole} onChange={e => setSignupRole(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="DOCTOR">Doctor</option>
                <option value="ADMIN">Admin</option>
                <option value="RECEPTIONIST">Receptionist</option>
              </select>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>
        )}

        {/* Forgot password form */}
        {view === "forgot" && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Registered email</label>
              <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="your@email.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">New password</label>
              <input type="password" required minLength={6} value={forgotPassword} onChange={e => setForgotPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Min. 6 characters" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Confirm new password</label>
              <input type="password" required value={forgotConfirm} onChange={e => setForgotConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Repeat password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50">
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        {/* Demo credentials */}
        {view === "login" && (
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-400 font-medium mb-1">Demo credentials</p>
            <p className="text-xs text-gray-500">Admin: admin@clinic.com / admin123</p>
            <p className="text-xs text-gray-500">Doctor: dr.priya@clinic.com / doctor123</p>
          </div>
        )}
      </div>
    </div>
  );
}