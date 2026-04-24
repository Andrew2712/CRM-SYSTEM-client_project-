"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import {
  LayoutGrid,
  Users,
  CalendarDays,
  Timer,
  BarChart3,
  Bell,
  KeyRound,
  UserPlus,
  UserCircle,
  UsersRound,
} from "lucide-react";

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV = [
  {
    group: "Profile",
    items: [
      // ── NEW: Staff Registry — Admin only ────────────────────────────────────
      
      // ── NEW: My Profile — all roles ─────────────────────────────────────────
      {
        href:  "/dashboard/staff/${staff.id}",
        label: "My Profile",
        icon:  UserCircle,
        roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"],
      },
    ],
  },
  {
    group: "MAIN",
    items: [
      { href: "/dashboard",               label: "Dashboard",         icon: LayoutGrid,   roles: ["ADMIN"] },
      {
        href:  "/dashboard/staff",
        label: "Staff ",
        icon:  UsersRound,
        roles: ["ADMIN"],
      },
      { href: "/dashboard/patients",      label: "Patients",      icon: Users,        roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"] },
      { href: "/dashboard/booking",       label: "Booking",       icon: CalendarDays, roles: ["ADMIN", "RECEPTIONIST"] },

    ],
  },
  {
    group: "VIEWS",
    items: [
      { href: "/dashboard/doctor",        label: "Session View",  icon: Timer,        roles: ["ADMIN", "DOCTOR"] },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { href: "/dashboard/analytics",     label: "Analytics",     icon: BarChart3,    roles: ["ADMIN"] },
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell,         roles: ["ADMIN", "RECEPTIONIST"] },
    ],
  },

  {
    group: "ACCOUNT",
    items: [
      { href: "/dashboard/signup",          label: "Sign Up",        icon: UserPlus, roles: ["ADMIN"] },
      { href: "/dashboard/reset-password",  label: "Reset Password", icon: KeyRound, roles: ["ADMIN", "DOCTOR", "RECEPTIONIST"] },
    ],
  },
];

const ROLE_CONFIG: Record<string, { label: string; badge: string }> = {
  ADMIN:        { label: "Admin",        badge: "bg-white/20 text-white" },
  DOCTOR:       { label: "Doctor",       badge: "bg-white/20 text-white" },
  RECEPTIONIST: { label: "Receptionist", badge: "bg-white/20 text-white" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const role      = session?.user?.role ?? "";
  const userName  = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";
  const initials  = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
  const roleCfg   = ROLE_CONFIG[role];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* ══════════════════════════════
          SIDEBAR
      ══════════════════════════════ */}
      <aside
        className="w-60 shrink-0 h-screen flex flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0a5c47 0%, #0d7a5f 45%, #0f8f6e 100%)" }}
      >
        {/* Decorative background circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-32 -left-8 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-32 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-black/10 pointer-events-none" />

        {/* ── Logo ── */}
        <div className="relative px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 shadow-md">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
                <circle cx="9" cy="9" r="3.5" fill="white" fillOpacity="0.9" />
                <path d="M9 2v2M9 14v2M2 9h2M14 9h2" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-tight tracking-tight">Vyayama</p>
              <p className="text-[10px] text-white/50 leading-tight mt-0.5">Clinic management</p>
            </div>
          </div>
        </div>

        {/* ── Navigation ── */}
        <nav className="relative flex-1 overflow-y-auto px-3 py-5 space-y-6">
          {NAV.map(({ group, items }) => {
            const visible = items.filter((item) => item.roles.includes(role));
            if (visible.length === 0) return null;

            return (
              <div key={group}>
                <p className="text-[9px] font-black text-white/35 uppercase tracking-[0.15em] px-3 mb-2">
                  {group}
                </p>
                <ul className="space-y-1">
                  {visible.map(({ label, href, icon: Icon }) => {
                    const isActive =
                      href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === href || pathname.startsWith(href + "/");

                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={`
                            group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                            transition-all duration-150 relative
                            ${isActive
                              ? "bg-white/15 text-white shadow-sm"
                              : "text-white/60 hover:bg-white/10 hover:text-white"
                            }
                          `}
                        >
                          {/* Active left indicator */}
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded-r-full" />
                          )}
                          <Icon
                            size={16}
                            strokeWidth={isActive ? 2.5 : 2}
                            className={isActive ? "text-white" : "text-white/50 group-hover:text-white/80"}
                          />
                          {label}
                          {isActive && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ── User footer ── */}
        <div className="relative px-4 py-4 border-t border-white/10">
          {/* User info card */}
          <div className="bg-white/10 rounded-2xl p-3.5 mb-3 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white text-xs font-black shrink-0 border border-white/20">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate leading-tight">
                  {userName || "User"}
                </p>
                <p className="text-[10px] text-white/50 truncate leading-tight mt-0.5">
                  {userEmail || role}
                </p>
              </div>
              {roleCfg && (
                <span className={`text-[9px] font-black px-2 py-1 rounded-lg shrink-0 ${roleCfg.badge} border border-white/20`}>
                  {roleCfg.label}
                </span>
              )}
            </div>
          </div>

          {/* Sign out */}
          <SignOutButton />
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}
