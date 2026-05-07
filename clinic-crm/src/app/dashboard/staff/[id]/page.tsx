// src/app/dashboard/staff/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams }           from "next/navigation";
import { useSession }          from "next-auth/react";
import Link                    from "next/link";
import dynamic                 from "next/dynamic";
import EditProfileModal        from "@/components/EditProfileModal";

// ── Lazy-load heavy components ─────────────────────────────────────────────
const AnalyticsCharts = dynamic(() => import("@/components/staff/Analyticscharts"), {
  ssr:     false,
  loading: () => (
    // ✅ FIXED: grid-cols-1 on mobile, md:grid-cols-2 on larger screens
    // mirrors dashboard's responsive pattern exactly
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
      {[1, 2].map((i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#DDD2C2] p-5 sm:p-6">
          <div className="w-40 h-4 bg-[#E8E1D5] rounded animate-pulse mb-6" />
          <div className="animate-pulse bg-[#F5F1E8] rounded-2xl h-[200px]" />
        </div>
      ))}
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────
type Role = "ADMIN" | "DOCTOR" | "RECEPTIONIST";

type StaffProfile = {
  id:        string;
  name:      string;
  email:     string;
  role:      Role;
  phone:     string | null;
  createdAt: string;
  _count:    { appointments: number };
};

type AppointmentSlim = {
  id:        string;
  startTime: string;
  status:    string;
};

// ── Role config ────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  DOCTOR: {
    label:      "Doctor",
    description:"Patient care & sessions",
    pill:       "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",
    dot:        "bg-[#4F8A5B]",
    barGradient:"linear-gradient(90deg, #2d5c38, #4F8A5B, #6aad7a)",
    bgFrom:     "from-[#4F8A5B]/5",
    responsibilities: [
      "Mark patient attendance",
      "Add session notes",
      "Add new patients if required",
      "Reset own password",
    ],
    permissions: [
      { label:"Patient Management", icon:"👥", active: true  },
      { label:"Session View",        icon:"🩺", active: true  },
      { label:"Reset Password",     icon:"🔑", active: true  },
      { label:"Admin Dashboard",    icon:"📊", active: false },
      { label:"Analytics",          icon:"📈", active: false },
      { label:"Staff Registry",     icon:"🏢", active: false },
    ],
    permBg: "bg-[#4F8A5B]/8 border-[#4F8A5B]/25 text-[#4F8A5B]",
  },
  ADMIN: {
    label:      "Admin",
    description:"Full system access",
    pill:       "bg-[#4B0F05]/10 text-[#4B0F05] border border-[#4B0F05]/25",
    dot:        "bg-[#4B0F05]",
    barGradient:"linear-gradient(90deg, #4B0F05, #5C1408, #D97332)",
    bgFrom:     "from-[#4B0F05]/5",
    responsibilities: [
      "Full system access",
      "Manage all staff accounts",
      "View analytics & reports",
      "Reset any staff password",
    ],
    permissions: [
      { label:"Admin Dashboard",    icon:"📊", active: true },
      { label:"Patient Management", icon:"👥", active: true },
      { label:"Booking Management", icon:"📅", active: true },
      { label:"Session View",        icon:"🩺", active: true },
      { label:"Analytics",          icon:"📈", active: true },
      { label:"Notifications",      icon:"🔔", active: true },
      { label:"Staff Registry",     icon:"🏢", active: true },
      { label:"User Management",    icon:"⚙️", active: true },
      { label:"Reset Passwords",    icon:"🔑", active: true },
    ],
    permBg: "bg-[#4B0F05]/8 border-[#4B0F05]/20 text-[#4B0F05]",
  },
  RECEPTIONIST: {
    label:      "Receptionist",
    description:"Booking & front desk",
    pill:       "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40",
    dot:        "bg-[#D9A441]",
    barGradient:"linear-gradient(90deg, #8B6419, #D9A441, #f0c060)",
    bgFrom:     "from-[#D9A441]/5",
    responsibilities: [
      "Book sessions for patients",
      "Add new patients",
      "Manage appointments",
      "Reset own password",
    ],
    permissions: [
      { label:"Patient Management", icon:"👥", active: true  },
      { label:"Booking Management", icon:"📅", active: true  },
      { label:"Notifications",      icon:"🔔", active: true  },
      { label:"Reset Password",     icon:"🔑", active: true  },
      { label:"Admin Dashboard",    icon:"📊", active: false },
      { label:"Analytics",          icon:"📈", active: false },
    ],
    permBg: "bg-[#D9A441]/10 border-[#D9A441]/30 text-[#8B6419]",
  },
} as const;

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const palettes = [
    "bg-[#4F8A5B]/12 text-[#4F8A5B]",
    "bg-[#4B0F05]/10 text-[#4B0F05]",
    "bg-[#D97332]/12 text-[#D97332]",
    "bg-[#D9A441]/12 text-[#8B6419]",
    "bg-[#5C1408]/10 text-[#5C1408]",
    "bg-[#C94F4F]/10 text-[#C94F4F]",
  ];
  const color = palettes[name.charCodeAt(0) % palettes.length];
  const sz    = size === "lg"
    ? "w-16 h-16 sm:w-20 sm:h-20 text-xl sm:text-2xl"
    : size === "md"
    ? "w-10 h-10 text-sm"
    : "w-7 h-7 text-[10px]";
  return (
    <div className={`${sz} ${color} rounded-2xl flex items-center justify-center font-black flex-shrink-0 border border-[#DDD2C2]/60`}>
      {initials}
    </div>
  );
}

// ── InfoRow ────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 sm:gap-4 py-3 sm:py-4 border-b border-[#F5F1E8] last:border-0">
      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-[#F5F1E8] rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-[#7A685F] uppercase tracking-widest mb-0.5">{label}</p>
        <div className="text-sm font-semibold text-[#2B1A14] break-words">{value}</div>
      </div>
    </div>
  );
}

// ── StatsCard ──────────────────────────────────────────────────────────────
function StatsCard({ label, value, sub, icon, color, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; accent: string;
}) {
  return (
    <div className={`bg-white rounded-2xl border-2 ${accent} shadow-sm p-4 sm:p-5 relative overflow-hidden`}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10" style={{ background: color }} />
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: color + "20" }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <p className="text-[10px] sm:text-[11px] font-bold text-[#7A685F] uppercase tracking-widest mb-1">{label}</p>
      <p className="text-2xl sm:text-3xl font-black text-[#2B1A14] tracking-tight">{value}</p>
      {sub && <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function StaffProfilePage() {
  const { data: session } = useSession();
  const params  = useParams();
  const staffId = params?.id as string;

  const [profile,      setProfile]      = useState<StaffProfile | null>(null);
  const [appointments, setAppointments] = useState<AppointmentSlim[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [chartsReady,  setChartsReady]  = useState(false);
  const [error,        setError]        = useState("");
  const [editOpen,     setEditOpen]     = useState(false);

  const viewerRole   = session?.user?.role as Role | undefined;
  const viewerId     = session?.user?.id   ?? "";
  const isAdmin      = viewerRole === "ADMIN";
  const isOwnProfile = viewerId === staffId;

  useEffect(() => {
    if (!staffId) return;

    Promise.all([
      fetch(`/api/staff/${staffId}`, { credentials: "include" }),
      fetch(`/api/appointments`,     { credentials: "include" }),
    ])
      .then(async ([sr, ar]) => {
        if (!sr.ok) throw new Error(`Staff HTTP ${sr.status}`);
        const staffData = await sr.json();
        setProfile(staffData.user);

        if (ar.ok) {
          const apptData: AppointmentSlim[] = await ar.json();
          const filtered = isAdmin
            ? apptData
            : apptData.filter((a: any) => a.doctor?.id === staffId || a.doctorId === staffId);
          setAppointments(Array.isArray(filtered) ? filtered : []);
        }
        setLoading(false);
        setTimeout(() => setChartsReady(true), 80);
      })
      .catch(() => { setError("Failed to load profile."); setLoading(false); });
  }, [staffId, isAdmin]);

  // Derived stats
  const now          = new Date();
  const totalSess    = appointments.length;
  const missedSess   = appointments.filter((a) => a.status === "MISSED").length;
  const upcomingSess = appointments.filter((a) => new Date(a.startTime) > now).length;
  const attendedSess = appointments.filter((a) => a.status === "ATTENDED").length;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#F5F1E8] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-[#D97332] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#7A685F] font-medium">Loading staff profile…</p>
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────
  if (error || !profile) return (
    <div className="min-h-screen bg-[#F5F1E8] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#C94F4F]/20 shadow-sm p-8 w-full max-w-sm text-center">
        <div className="w-12 h-12 bg-[#C94F4F]/8 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-[#C94F4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-[#2B1A14] mb-2">Could not load profile</p>
        <p className="text-xs text-[#7A685F]">{error || "An unexpected error occurred."}</p>
        <Link href="/dashboard/staff" className="inline-flex items-center gap-2 mt-4 text-xs font-bold text-[#D97332] hover:text-[#4B0F05] bg-[#FDF3EC] border border-[#D97332]/30 px-4 py-2 rounded-xl transition-colors">
          ← Back to Staff Registry
        </Link>
      </div>
    </div>
  );

  const cfg         = ROLE_CONFIG[profile.role];
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-[#F5F1E8]">

      {/* ── Breadcrumb / Top Nav Bar ── */}
      <div className="bg-white border-b border-[#E8E1D5] px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-1.5 sm:gap-2 text-sm min-w-0">
          <Link
            href="/dashboard/staff"
            className="text-[#7A685F] hover:text-[#D97332] transition-colors flex items-center gap-1 sm:gap-1.5 font-medium flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Staff</span>
          </Link>
          <svg className="w-4 h-4 text-[#DDD2C2] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-semibold text-[#2B1A14] truncate max-w-[120px] sm:max-w-none">
            {profile.name}
          </span>
          <span className="text-[#DDD2C2] mx-0.5 hidden sm:inline">·</span>
          <span className="font-mono text-xs text-[#7A685F] bg-[#E8E1D5] px-2 py-0.5 rounded hidden sm:inline">
            {profile.id.slice(0, 8).toUpperCase()}
          </span>
        </div>
        <span className={`text-xs px-2.5 sm:px-3 py-1 rounded-full font-bold border flex-shrink-0 ${cfg.pill}`}>
          {cfg.label}
        </span>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5 sm:space-y-6">

        {/* ── Profile Hero Card ── */}
        <div className={`bg-gradient-to-br ${cfg.bgFrom} to-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden`}>
          <div className="h-1.5 w-full" style={{ background: cfg.barGradient }} />
          <div className="p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <Avatar name={profile.name} size="lg" />

              <div className="flex-1 min-w-0 w-full">
                {/* Name + role badge + action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black text-[#2B1A14] leading-tight truncate">
                      {profile.name}
                    </h2>
                    <p className="text-sm text-[#7A685F] mt-0.5 truncate">{profile.email}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`flex items-center gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl border text-xs sm:text-sm font-bold flex-shrink-0 self-start ${cfg.pill}`}>
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                {/* Info chips */}
                <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-4">
                  {profile.role === "DOCTOR" && (
                    <div className="flex items-center gap-1.5 bg-white border border-[#DDD2C2] text-[#7A685F] px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                      <svg className="w-3.5 h-3.5 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {profile._count.appointments} session{profile._count.appointments !== 1 ? "s" : ""}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 bg-white border border-[#DDD2C2] text-[#7A685F] px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                    <svg className="w-3.5 h-3.5 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Joined {memberSince}
                  </div>
                  {profile.phone && (
                    <div className="flex items-center gap-1.5 bg-white border border-[#DDD2C2] text-[#7A685F] px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                      <svg className="w-3.5 h-3.5 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {profile.phone}
                    </div>
                  )}
                </div>

                {/* ── Action buttons INSIDE profile card ── */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[#E8E1D5]">
                  {/* Edit Profile */}
                  {(isAdmin || (viewerRole === "RECEPTIONIST" && isOwnProfile)) && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="flex items-center gap-1.5 bg-[#4F8A5B] hover:bg-[#3d6e47] text-white rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm transition-all duration-150"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </button>
                  )}

                  {/* Reset Password */}
                  {(isOwnProfile || isAdmin) && (
                    <Link
                      href="/dashboard/reset-password"
                      className="flex items-center gap-1.5 bg-white border border-[#DDD2C2] text-[#5C1408] hover:border-[#D97332] hover:text-[#D97332] hover:bg-[#FDF3EC] rounded-xl px-3 py-1.5 text-xs font-bold shadow-sm transition-all duration-150"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Reset Password
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Responsibilities — NON-admin only */}
            {!isAdmin && (
              <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-[#E8E1D5]">
                <p className="text-[10px] font-bold text-[#7A685F] uppercase tracking-widest mb-3">Responsibilities</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {cfg.responsibilities.map((r) => (
                    <div key={r} className="flex items-center gap-2 text-xs font-semibold text-[#5C1408] bg-white border border-[#E8E1D5] px-3 py-2 rounded-xl">
                      <svg className="w-3.5 h-3.5 text-[#4F8A5B] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Session Analytics ── */}
        <div>
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="w-7 h-7 bg-[#FDF3EC] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-[#2B1A14]">Session Analytics</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatsCard
              label="Total Sessions" value={totalSess} sub={`${attendedSess} attended`}
              color="#4B0F05" accent="border-[#DDD2C2]"
              icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            />
            <StatsCard
              label="Attended" value={attendedSess} sub="sessions completed"
              color="#4F8A5B" accent="border-[#4F8A5B]/20"
              icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Missed" value={missedSess} sub="no-shows"
              color="#C94F4F" accent="border-[#C94F4F]/20"
              icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Upcoming" value={upcomingSess} sub="scheduled ahead"
              color="#D97332" accent="border-[#D97332]/20"
              icon={<svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
          </div>
        </div>

        {/* ── Charts ── */}
        {/*
          ✅ KEY FIX: Wrap AnalyticsCharts in a container that enforces
          single-column stacking on mobile and 2-column side-by-side on md+.
          The AnalyticsCharts component internally likely uses md:grid-cols-2
          but without a min-width constraint this can overflow on narrow screens.
          The wrapper below ensures the charts never exceed the viewport width
          and stack just like the dashboard's middle row does.
        */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <div className="w-7 h-7 bg-[#FDF3EC] rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h2 className="text-base font-bold text-[#2B1A14]">Trends</h2>
          </div>
          {/*
            Pass a className prop so AnalyticsCharts can use it, OR rely on
            the wrapper div below to constrain overflow.
            The grid inside AnalyticsCharts should be:
              grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5
            If you cannot edit that component, the overflow-hidden wrapper
            below prevents horizontal scroll.
          */}
          <div className="overflow-hidden">
            <AnalyticsCharts appointments={appointments} chartsReady={chartsReady} />
          </div>
        </div>

        {/* ── Contact + Account details ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Contact info */}
          <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[#E8E1D5]">
              <div className="w-7 h-7 bg-[#FDF3EC] rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[#D97332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-[#2B1A14]">Contact Information</h2>
            </div>
            <InfoRow
              label="Email Address"
              value={<a href={`mailto:${profile.email}`} className="text-[#D97332] hover:text-[#4B0F05] break-all transition-colors">{profile.email}</a>}
              icon={<svg className="w-4 h-4 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
            />
            <InfoRow
              label="Phone Number"
              value={profile.phone
                ? <a href={`tel:${profile.phone}`} className="text-[#D97332] hover:text-[#4B0F05] transition-colors">{profile.phone}</a>
                : <span className="text-[#7A685F] italic text-xs">Not set — contact admin</span>}
              icon={<svg className="w-4 h-4 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>}
            />
          </div>

          {/* Account info */}
          <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[#E8E1D5]">
              <div className="w-7 h-7 bg-[#4B0F05]/8 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[#4B0F05]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-[#2B1A14]">Account Information</h2>
            </div>
            <InfoRow
              label="System Role"
              value={
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border ${cfg.pill}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label} — {cfg.description}
                </span>
              }
              icon={<svg className="w-4 h-4 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
            />
            <InfoRow
              label="Member Since"
              value={memberSince}
              icon={<svg className="w-4 h-4 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
            />
            <InfoRow
              label="Staff ID"
              value={<code className="text-xs font-mono text-[#7A685F] bg-[#E8E1D5] px-2 py-1 rounded-lg break-all">{profile.id}</code>}
              icon={<svg className="w-4 h-4 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>}
            />
          </div>
        </div>

        {/* ── Permissions — ADMIN only ── */}
        {isAdmin && (
          <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4 sm:mb-5 pb-3 sm:pb-4 border-b border-[#E8E1D5]">
              <div className="w-7 h-7 bg-[#E8E1D5] rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-[#5C1408]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              <h2 className="text-sm font-bold text-[#2B1A14]">Permissions for {cfg.label}</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {cfg.permissions.map((p) => (
                <div
                  key={p.label}
                  className={`flex items-center gap-2 sm:gap-2.5 p-2.5 sm:p-3 rounded-xl border text-xs font-semibold transition-all ${
                    p.active ? cfg.permBg : "bg-[#F5F1E8] border-[#E8E1D5] text-[#7A685F]/40"
                  }`}
                >
                  <span className={`text-sm sm:text-base flex-shrink-0 ${!p.active ? "opacity-30" : ""}`}>{p.icon}</span>
                  <span className="truncate">{p.label}</span>
                  {p.active && (
                    <svg className="w-3 h-3 ml-auto flex-shrink-0 opacity-60" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Edit Profile Modal ── */}
        {editOpen && (
          <EditProfileModal
            type="staff"
            entityId={profile.id}
            initialData={{
              name:  profile.name,
              phone: profile.phone ?? "",
              email: profile.email,
            }}
            userRole={viewerRole ?? ""}
            onClose={() => setEditOpen(false)}
            onSuccess={(data) => {
              const updated = (data as { user?: StaffProfile }).user ?? data as StaffProfile;
              setProfile((prev: StaffProfile | null) => prev ? { ...prev, ...updated } : prev);
              setEditOpen(false);
            }}
          />
        )}

      </div>
    </div>
  );
}