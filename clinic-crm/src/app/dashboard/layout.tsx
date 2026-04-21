"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";
import {
  LayoutGrid,
  Users,
  CalendarDays,
  Stethoscope,
  UserRound,
  BarChart3,
  Bell,
  LogOut,
} from "lucide-react";

// ─── Nav structure with role guards ──────────────────────────────────────────

const NAV = [
  {
    group: "MAIN",
    items: [
      { href: "/dashboard",              label: "Admin",         icon: LayoutGrid,   roles: ["ADMIN"] },
      { href: "/dashboard/patients",     label: "Patients",      icon: Users,        roles: ["ADMIN", "RECEPTIONIST", "DOCTOR"] },
      { href: "/dashboard/booking",      label: "Booking",       icon: CalendarDays, roles: ["ADMIN", "RECEPTIONIST"] },
    ],
  },
  {
    group: "VIEWS",
    items: [
      { href: "/dashboard/doctor",       label: "Doctor",        icon: Stethoscope,  roles: ["ADMIN", "DOCTOR"] },
    ],
  },
  {
    group: "SYSTEM",
    items: [
      { href: "/dashboard/analytics",    label: "Analytics",     icon: BarChart3,    roles: ["ADMIN"] },
      { href: "/dashboard/notifications",label: "Notifications", icon: Bell,         roles: ["ADMIN", "RECEPTIONIST"] },
    ],
  },
];

// ─── Role badge color ─────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  ADMIN:        "bg-teal-50 text-teal-700",
  DOCTOR:       "bg-sky-50 text-sky-700",
  RECEPTIONIST: "bg-violet-50 text-violet-700",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const role = session?.user?.role ?? "";
  const userName = session?.user?.name ?? "";
  const userEmail = session?.user?.email ?? "";

  // Initial for avatar
  const initial = userName.charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 h-screen flex flex-col bg-white border-r border-gray-100">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="white" strokeOpacity="0.4" strokeWidth="1.2" />
                <path d="M7 4v3.2l2 1.3" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 leading-tight tracking-tight">Vyayama</div>
              <div className="text-[10px] text-gray-400 leading-tight">Clinic management</div>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV.map(({ group, items }) => {
            // Filter by role
            const visible = items.filter((item) => item.roles.includes(role));
            if (visible.length === 0) return null;

            return (
              <div key={group}>
                {/* Group label */}
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1.5">
                  {group}
                </p>

                <ul className="space-y-0.5">
                  {visible.map(({ label, href, icon: Icon }) => {
                    // Active: exact match for /dashboard, startsWith for others
                    const isActive =
                      href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname === href || pathname.startsWith(href + "/");

                    return (
                      <li key={href}>
                        <Link
                          href={href}
                          className={`
                            flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium
                            transition-all duration-150
                            ${isActive
                              ? "bg-teal-50 text-teal-700"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                            }
                          `}
                        >
                          <Icon
                            size={16}
                            strokeWidth={isActive ? 2.2 : 1.8}
                            className={isActive ? "text-teal-600" : "text-gray-400"}
                          />
                          {label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Footer — user info + sign out */}
        <div className="px-4 py-4 border-t border-gray-100 space-y-3">
          {/* User info */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate leading-tight">{userName || "User"}</p>
              <p className="text-[10px] text-gray-400 truncate leading-tight mt-0.5">
                {userEmail || role}
              </p>
            </div>
            {role && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${ROLE_BADGE[role] ?? "bg-gray-100 text-gray-500"}`}>
                {role.charAt(0) + role.slice(1).toLowerCase()}
              </span>
            )}
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