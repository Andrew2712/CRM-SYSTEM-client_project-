// src/components/staff/ProfileCard.tsx
"use client";

import React from "react";
import Link from "next/link";

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

const ROLE_CONFIG: Record<Role, {
  label:       string;
  description: string;
  pill:        string;
  dot:         string;
  accentColor: string;
  bgGradient:  string;
  barGradient: string;
  responsibilities: string[];
}> = {
  DOCTOR: {
    label:       "Doctor",
    description: "Patient care & sessions",
    pill:        "bg-teal-50 text-teal-700 border border-teal-200",
    dot:         "bg-teal-500",
    accentColor: "text-teal-600",
    bgGradient:  "from-teal-50/40 to-white",
    barGradient: "linear-gradient(90deg, #0a5c47, #0f8f6e, #14b8a6)",
    responsibilities: [
      "Mark patient attendance",
      "Add session notes",
      "Add new patients if required",
      "Reset own password",
    ],
  },
  ADMIN: {
    label:       "Admin",
    description: "Full system access",
    pill:        "bg-violet-50 text-violet-700 border border-violet-200",
    dot:         "bg-violet-500",
    accentColor: "text-violet-600",
    bgGradient:  "from-violet-50/30 to-white",
    barGradient: "linear-gradient(90deg, #4c1d95, #7c3aed, #a78bfa)",
    responsibilities: [
      "Full system access",
      "Manage all staff accounts",
      "View analytics & reports",
      "Reset any staff password",
    ],
  },
  RECEPTIONIST: {
    label:       "Receptionist",
    description: "Booking & front desk",
    pill:        "bg-amber-50 text-amber-700 border border-amber-200",
    dot:         "bg-amber-500",
    accentColor: "text-amber-600",
    bgGradient:  "from-amber-50/30 to-white",
    barGradient: "linear-gradient(90deg, #92400e, #d97706, #fbbf24)",
    responsibilities: [
      "Book sessions for patients",
      "Add new patients",
      "Manage appointments",
      "Reset own password",
    ],
  },
};

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    "bg-teal-100 text-teal-700",
    "bg-violet-100 text-violet-700",
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "lg" ? "w-20 h-20 text-2xl" : size === "md" ? "w-10 h-10 text-sm" : "w-7 h-7 text-[10px]";
  return (
    <div className={`${sz} ${color} rounded-2xl flex items-center justify-center font-black flex-shrink-0`}>
      {initials}
    </div>
  );
}

export default function ProfileCard({
  profile,
  currentUserId,
  isAdmin,
}: {
  profile:       StaffProfile;
  currentUserId: string;
  isAdmin:       boolean;
}) {
  const cfg         = ROLE_CONFIG[profile.role];
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
  const isOwnProfile = currentUserId === profile.id;

  return (
    <div className={`bg-gradient-to-br ${cfg.bgGradient} rounded-2xl border border-slate-100 shadow-sm overflow-hidden`}>
      {/* Gradient bar */}
      <div className="h-1.5 w-full" style={{ background: cfg.barGradient }} />

      <div className="p-8">
        <div className="flex items-start gap-6 flex-wrap">
          <Avatar name={profile.name} size="lg" />

          <div className="flex-1 min-w-0">
            {/* Name + role */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">{profile.name}</h2>
                <p className="text-sm text-slate-500 mt-0.5">{profile.email}</p>
              </div>
              <span className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-bold flex-shrink-0 ${cfg.pill}`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>

            {/* Stat chips */}
            <div className="flex items-center flex-wrap gap-2 mt-4">
              {profile.role === "DOCTOR" && (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                  <svg className="w-3.5 h-3.5 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {profile._count.appointments} session{profile._count.appointments !== 1 ? "s" : ""}
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Joined {memberSince}
              </div>
              {profile.phone && (
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm">
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {profile.phone}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Responsibilities (non-admin) */}
        {!isAdmin && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Responsibilities</p>
            <div className="grid grid-cols-2 gap-2">
              {cfg.responsibilities.map((r) => (
                <div key={r} className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white border border-slate-100 px-3 py-2 rounded-xl">
                  <svg className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {r}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap">
          {/* Reset Password — available to everyone for own profile; admin can reset anyone's */}
          {(isOwnProfile || isAdmin) && (
            <Link href="/dashboard/reset-password"
              className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 hover:text-teal-700 px-3.5 py-2 rounded-xl transition-all shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              Reset Password
            </Link>
          )}

          {/* Add Staff — ADMIN only */}
          {isAdmin && (
            <Link href="/dashboard/staff/add"
              className="flex items-center gap-2 text-xs font-bold text-white px-3.5 py-2 rounded-xl transition-all shadow-md hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #0a5c47, #0d7a5f)" }}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Staff
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}