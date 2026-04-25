"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffProfile = {
  id:        string;
  name:      string;
  email:     string;
  role:      "ADMIN" | "DOCTOR" | "RECEPTIONIST";
  phone:     string | null;
  createdAt: string;
  _count: {
    appointments: number;
  };
};

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  {
    label:       string;
    description: string;
    pill:        string;
    icon:        React.ReactNode;
    bgGradient:  string;
    accentColor: string;
  }
> = {
  DOCTOR: {
    label:       "Doctor",
    description: "Patient care & sessions",
    pill:        "bg-teal-50 text-teal-700 border border-teal-200",
    accentColor: "text-teal-600",
    bgGradient:  "from-teal-50 to-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  ADMIN: {
    label:       "Admin",
    description: "Full system access",
    pill:        "bg-violet-50 text-violet-700 border border-violet-200",
    accentColor: "text-violet-600",
    bgGradient:  "from-violet-50 to-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  RECEPTIONIST: {
    label:       "Receptionist",
    description: "Booking & front desk",
    pill:        "bg-amber-50 text-amber-700 border border-amber-200",
    accentColor: "text-amber-600",
    bgGradient:  "from-amber-50 to-white",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
};

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colors = [
    "bg-teal-100 text-teal-700",
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz =
    size === "lg"  ? "w-20 h-20 text-2xl" :
    size === "md"  ? "w-10 h-10 text-sm"  :
                     "w-7  h-7  text-[10px]";

  return (
    <div className={`${sz} ${color} rounded-2xl flex items-center justify-center font-black flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-50 last:border-0">
      <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <div className="text-sm font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffProfilePage() {
  const { data: session } = useSession();

  // ✅ FIX: Read the dynamic [id] segment from the URL
  const params  = useParams();
  const staffId = params?.id as string;

  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!staffId) return;

    // ✅ FIX: Fetch /api/staff/[id] instead of /api/staff/me
    fetch(`/api/staff/${staffId}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setProfile(data.user);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load this staff profile. Please try again.");
        setLoading(false);
      });
  }, [staffId]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day:     "numeric",
    month:   "long",
    year:    "numeric",
  });

  const roleCfg = profile ? ROLE_CONFIG[profile.role] : null;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading staff profile…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 max-w-sm text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-800 mb-2">Could not load profile</p>
          <p className="text-xs text-slate-400">{error || "An unexpected error occurred."}</p>
          <Link
            href="/dashboard/staff"
            className="inline-flex items-center gap-2 mt-4 text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl transition-all"
          >
            ← Back to Staff Registry
          </Link>
        </div>
      </div>
    );
  }

  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff Profile</h1>
            </div>
            <p className="text-sm text-slate-400 ml-[42px]">{today}</p>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard/staff"
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Registry
            </Link>
            {/* Only show Reset Password if viewing own profile */}
            {session?.user?.id === profile.id && (
              <Link
                href="/dashboard/reset-password"
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Reset Password
              </Link>
            )}
          </div>
        </div>

        {/* ── Profile hero card ── */}
        <div className={`bg-gradient-to-br ${roleCfg?.bgGradient ?? "from-slate-50 to-white"} rounded-2xl border border-slate-100 shadow-sm overflow-hidden`}>
          {/* Gradient strip — role-colored */}
          <div
            className="h-1.5 w-full"
            style={{ background: "linear-gradient(90deg, #0a5c47, #0f8f6e, #14b8a6)" }}
          />

          <div className="p-8">
            <div className="flex items-start gap-6">

              {/* Avatar */}
              <Avatar name={profile.name} size="lg" />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 leading-tight">{profile.name}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{profile.email}</p>
                  </div>

                  {/* Role badge */}
                  {roleCfg && (
                    <div className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold flex-shrink-0 ${roleCfg.pill}`}>
                      <div className={roleCfg.accentColor}>{roleCfg.icon}</div>
                      {roleCfg.label}
                    </div>
                  )}
                </div>

                {/* Quick stat chips */}
                <div className="flex items-center flex-wrap gap-2 mt-4">
                  {/* Sessions count — only shown for DOCTOR */}
                  {profile.role === "DOCTOR" && (
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                      <svg className="w-3.5 h-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {profile._count.appointments} session{profile._count.appointments !== 1 ? "s" : ""}
                    </div>
                  )}

                  {/* Member since */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Joined {memberSince}
                  </div>

                  {/* Phone quick-view */}
                  {profile.phone && (
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {profile.phone}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Detail grid ── */}
        <div className="grid grid-cols-2 gap-5">

          {/* Contact information */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-50">
              <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-slate-800">Contact Information</h2>
            </div>

            <InfoRow
              label="Email Address"
              value={
                <a href={`mailto:${profile.email}`} className="text-teal-600 hover:text-teal-700 transition-colors">
                  {profile.email}
                </a>
              }
              icon={
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            />

            <InfoRow
              label="Phone Number"
              value={
                profile.phone ? (
                  <a href={`tel:${profile.phone}`} className="text-teal-600 hover:text-teal-700 transition-colors">
                    {profile.phone}
                  </a>
                ) : (
                  <span className="text-slate-400 italic text-xs">Not set — contact admin</span>
                )
              }
              icon={
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              }
            />
          </div>

          {/* Account information */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-50">
              <div className="w-7 h-7 bg-violet-50 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-slate-800">Account Information</h2>
            </div>

            <InfoRow
              label="System Role"
              value={
                roleCfg ? (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border ${roleCfg.pill}`}>
                    <span className={roleCfg.accentColor}>{roleCfg.icon}</span>
                    {roleCfg.label} — {roleCfg.description}
                  </span>
                ) : (
                  profile.role
                )
              }
              icon={
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
            />

            <InfoRow
              label="Member Since"
              value={memberSince}
              icon={
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />

            <InfoRow
              label="Staff ID"
              value={
                <code className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                  {profile.id}
                </code>
              }
              icon={
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                </svg>
              }
            />
          </div>
        </div>

        {/* ── Role permissions card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-50">
            <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800">Permissions</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(profile.role === "ADMIN" || profile.role === "DOCTOR" || profile.role === "RECEPTIONIST") && (
              <>
                {profile.role === "ADMIN" && [
                  { label: "Admin Dashboard",     icon: "📊", active: true  },
                  { label: "Patient Management",  icon: "👥", active: true  },
                  { label: "Booking Management",  icon: "📅", active: true  },
                  { label: "Session View",         icon: "🩺", active: true  },
                  { label: "Analytics",           icon: "📈", active: true  },
                  { label: "Notifications",       icon: "🔔", active: true  },
                  { label: "Staff Registry",      icon: "🏢", active: true  },
                  { label: "User Management",     icon: "⚙️", active: true  },
                  { label: "Reset Passwords",     icon: "🔑", active: true  },
                ].map((p) => (
                  <div key={p.label} className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold ${
                    p.active
                      ? "bg-violet-50 border-violet-200 text-violet-700"
                      : "bg-slate-50 border-slate-100 text-slate-400"
                  }`}>
                    <span className="text-base">{p.icon}</span>
                    {p.label}
                  </div>
                ))}
                {profile.role === "DOCTOR" && [
                  { label: "Patient Management",  icon: "👥", active: true  },
                  { label: "Session View",         icon: "🩺", active: true  },
                  { label: "Reset Password",      icon: "🔑", active: true  },
                  { label: "Admin Dashboard",     icon: "📊", active: false },
                  { label: "Analytics",           icon: "📈", active: false },
                  { label: "Staff Registry",      icon: "🏢", active: false },
                ].map((p) => (
                  <div key={p.label} className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold ${
                    p.active
                      ? "bg-teal-50 border-teal-200 text-teal-700"
                      : "bg-slate-50 border-slate-100 text-slate-300"
                  }`}>
                    <span className={`text-base ${!p.active ? "opacity-40" : ""}`}>{p.icon}</span>
                    {p.label}
                  </div>
                ))}
                {profile.role === "RECEPTIONIST" && [
                  { label: "Patient Management",  icon: "👥", active: true  },
                  { label: "Booking Management",  icon: "📅", active: true  },
                  { label: "Notifications",       icon: "🔔", active: true  },
                  { label: "Reset Password",      icon: "🔑", active: true  },
                  { label: "Admin Dashboard",     icon: "📊", active: false },
                  { label: "Analytics",           icon: "📈", active: false },
                ].map((p) => (
                  <div key={p.label} className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-semibold ${
                    p.active
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-slate-50 border-slate-100 text-slate-300"
                  }`}>
                    <span className={`text-base ${!p.active ? "opacity-40" : ""}`}>{p.icon}</span>
                    {p.label}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}