"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffMember = {
  id:        string;
  name:      string;
  email:     string;
  role:      "ADMIN" | "DOCTOR" | "RECEPTIONIST";
  phone:     string | null;
  createdAt: string;
};

type RoleFilter = "ALL" | "ADMIN" | "DOCTOR" | "RECEPTIONIST";

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  { label: string; pill: string; cardBorder: string; icon: React.ReactNode }
> = {
  DOCTOR: {
    label:      "Doctor",
    pill:       "bg-teal-50 text-teal-700 border border-teal-200",
    cardBorder: "hover:border-teal-200",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  ADMIN: {
    label:      "Admin",
    pill:       "bg-violet-50 text-violet-700 border border-violet-200",
    cardBorder: "hover:border-violet-200",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  RECEPTIONIST: {
    label:      "Receptionist",
    pill:       "bg-amber-50 text-amber-700 border border-amber-200",
    cardBorder: "hover:border-amber-200",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
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
  return (
    <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Action icon button ───────────────────────────────────────────────────────

function ActionIconBtn({
  href,
  onClick,
  title,
  disabled,
  children,
  variant = "default",
}: {
  href?:     string;
  onClick?:  () => void;
  title:     string;
  disabled?: boolean;
  children:  React.ReactNode;
  variant?:  "default" | "mail" | "whatsapp" | "view" | "danger";
}) {
  const variants: Record<string, string> = {
    default:  "bg-slate-50 hover:bg-teal-50 border-slate-200 hover:border-teal-200 text-slate-400 hover:text-teal-600",
    mail:     "bg-slate-50 hover:bg-blue-50 border-slate-200 hover:border-blue-200 text-slate-400 hover:text-blue-600",
    whatsapp: "bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-200 text-slate-400 hover:text-emerald-600",
    view:     "bg-teal-50 hover:bg-teal-100 border-teal-100 hover:border-teal-200 text-teal-600 hover:text-teal-700",
    danger:   "bg-slate-50 hover:bg-red-50 border-slate-100 hover:border-red-100 text-slate-400 hover:text-red-500",
  };
  const base = `flex items-center justify-center w-8 h-8 border rounded-lg transition-all flex-shrink-0 ${variants[variant]} ${
    disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
  }`;

  if (href && !disabled) {
    return (
      <a href={href} title={title} target="_blank" rel="noopener noreferrer" className={base}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className={base}>
      {children}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffRegistryPage() {
  const [staff,      setStaff]      = useState<StaffMember[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState("");

  // ── Fetch staff ────────────────────────────────────────────────────────────
  function loadStaff() {
    fetch("/api/staff", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setStaff(Array.isArray(data.staff) ? data.staff : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load staff registry. You may not have permission to view this page.");
        setLoading(false);
      });
  }

  useEffect(() => { loadStaff(); }, []);

  // ── Delete handler ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/staff/${confirmDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setConfirmDelete(null);
        setDeleteSuccess(`${confirmDelete.name} has been removed.`);
        loadStaff();
        setTimeout(() => setDeleteSuccess(""), 4000);
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      alert("Network error during delete");
    }
    setDeleting(false);
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return staff.filter((s) => {
      const matchesRole   = roleFilter === "ALL" || s.role === roleFilter;
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [staff, search, roleFilter]);

  // ── Role counts ────────────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    ALL:          staff.length,
    ADMIN:        staff.filter((s) => s.role === "ADMIN").length,
    DOCTOR:       staff.filter((s) => s.role === "DOCTOR").length,
    RECEPTIONIST: staff.filter((s) => s.role === "RECEPTIONIST").length,
  }), [staff]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Loading staff registry…</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-8 max-w-sm text-center">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-slate-800 mb-2">Access denied or error</p>
          <p className="text-xs text-slate-400">{error}</p>
          <Link href="/dashboard"
            className="inline-flex items-center gap-2 mt-4 text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl transition-all">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">

      {/* ── Delete confirm modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 w-full max-w-sm shadow-2xl shadow-slate-200/50">
            <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Remove staff member?</h3>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              This will permanently remove{" "}
              <span className="font-semibold text-slate-800">{confirmDelete.name}</span> and revoke their access. This cannot be undone.
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all shadow-sm">
                {deleting ? "Removing…" : "Yes, remove"}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Staff Registry</h1>
            </div>
            <p className="text-sm text-slate-400 ml-[42px]">
              {staff.length} staff member{staff.length !== 1 ? "s" : ""} registered
            </p>
          </div>

          <Link
            href="/dashboard/signup"
            className="flex items-center gap-2 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-teal-200/40 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg, #0a5c47, #0d7a5f)" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add Staff Member
          </Link>
        </div>

        {/* ── Delete success toast ── */}
        {deleteSuccess && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-semibold text-emerald-700 shadow-sm">
            <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            {deleteSuccess}
          </div>
        )}

        {/* ── Summary stat chips (clickable filter cards) ── */}
        <div className="grid grid-cols-4 gap-3">
          {(
            [
              { key: "ALL",          label: "All Staff",     color: "bg-slate-600",  bg: "bg-slate-50",  border: "border-slate-200"  },
              { key: "ADMIN",        label: "Admins",        color: "bg-violet-500", bg: "bg-violet-50", border: "border-violet-200" },
              { key: "DOCTOR",       label: "Doctors",       color: "bg-teal-500",   bg: "bg-teal-50",   border: "border-teal-200"   },
              { key: "RECEPTIONIST", label: "Receptionists", color: "bg-amber-500",  bg: "bg-amber-50",  border: "border-amber-200"  },
            ] as { key: RoleFilter; label: string; color: string; bg: string; border: string }[]
          ).map(({ key, label, color, bg, border }) => (
            <button
              key={key}
              onClick={() => setRoleFilter(key)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                roleFilter === key
                  ? `${bg} ${border} shadow-sm`
                  : "bg-white border-slate-100 hover:border-slate-200 shadow-sm"
              }`}
            >
              <div className={`w-8 h-8 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <span className="text-sm font-black text-white">{counts[key]}</span>
              </div>
              <span className={`text-xs font-bold ${roleFilter === key ? "text-slate-800" : "text-slate-500"}`}>
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Search + table card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

          {/* Search bar */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-4">
            <div className="flex-1 relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email or phone…"
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-400 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex-shrink-0 whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-500">No staff members found</p>
              <p className="text-xs text-slate-400 mt-1">
                {search ? "Try adjusting your search or filter" : "No staff registered yet"}
              </p>
              {search && (
                <button
                  onClick={() => { setSearch(""); setRoleFilter("ALL"); }}
                  className="mt-4 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 border border-teal-200 px-4 py-2 rounded-xl transition-all"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {["Staff Member", "Role", "Email", "Phone", "Joined", "Actions"].map((h) => (
                      <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((member, idx) => {
                    const cfg = ROLE_CONFIG[member.role];
                    const joinedDate = new Date(member.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    });

                    const rawPhone = member.phone?.replace(/\D/g, "") ?? "";
                    const waPhone  = rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`;
                    const waUrl    = rawPhone
                      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${member.name}, this is a message from our clinic.`)}`
                      : "";

                    return (
                      <tr
                        key={member.id}
                        className={`border-b border-slate-50 last:border-0 hover:bg-teal-50/30 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                        }`}
                      >
                        {/* Name + avatar */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={member.name} />
                            <div>
                              <p className="text-sm font-bold text-slate-800">{member.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[140px]">
                                {member.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role badge */}
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border ${cfg.pill}`}>
                            <span className="flex-shrink-0">{cfg.icon}</span>
                            {cfg.label}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-5 py-4">
                          <a href={`mailto:${member.email}`}
                            className="text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors">
                            {member.email}
                          </a>
                        </td>

                        {/* Phone */}
                        <td className="px-5 py-4">
                          {member.phone ? (
                            <a href={`tel:${member.phone}`}
                              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-teal-600 transition-colors">
                              <svg className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {member.phone}
                            </a>
                          ) : (
                            <span className="text-xs text-slate-300 italic">—</span>
                          )}
                        </td>

                        {/* Joined */}
                        <td className="px-5 py-4">
                          <span className="text-xs font-medium text-slate-500">{joinedDate}</span>
                        </td>

                        {/* ── Actions ── */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">

                            {/* Profile / View — ✅ fixed: member.id instead of staff.id */}
                            <Link
                              href={`/dashboard/staff/${selectedId ?? member.id}`}
                              title="View profile"
                              className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 hover:border-teal-200 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
                            >
                              Profile
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>

                            {/* Mail */}
                            <ActionIconBtn
                              href={`mailto:${member.email}`}
                              title={`Send email to ${member.name}`}
                              variant="mail"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </ActionIconBtn>

                            {/* WhatsApp */}
                            <ActionIconBtn
                              href={waUrl || undefined}
                              title={rawPhone ? `WhatsApp ${member.name}` : "No phone on file"}
                              disabled={!rawPhone}
                              variant="whatsapp"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.986l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.17-1.399l-.371-.22-3.844 1.008 1.026-3.748-.242-.387A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
                              </svg>
                            </ActionIconBtn>

                            {/* Remove */}
                            <ActionIconBtn
                              onClick={() => setConfirmDelete({ id: member.id, name: member.name })}
                              title="Remove staff member"
                              variant="danger"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </ActionIconBtn>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Showing <span className="font-bold text-slate-600">{filtered.length}</span> of{" "}
                  <span className="font-bold text-slate-600">{staff.length}</span> staff member{staff.length !== 1 ? "s" : ""}
                </p>
                <Link
                  href="/dashboard/signup"
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  + Add new member
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}