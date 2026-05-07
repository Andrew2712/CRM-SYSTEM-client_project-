"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
const ROLE_CONFIG: Record<string, { label: string; pill: string; icon: React.ReactNode }> = {
  DOCTOR: {
    label: "Doctor",
    pill:  "bg-teal-50 text-teal-700 border border-teal-200",
    icon:  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>,
  },
  ADMIN: {
    label: "Admin",
    pill:  "bg-violet-50 text-violet-700 border border-violet-200",
    icon:  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  },
  RECEPTIONIST: {
    label: "Receptionist",
    pill:  "bg-amber-50 text-amber-700 border border-amber-200",
    icon:  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase();
  const colors = ["bg-amber-100 text-amber-800","bg-orange-100 text-orange-800","bg-teal-100 text-teal-800","bg-violet-100 text-violet-800","bg-blue-100 text-blue-800","bg-rose-100 text-rose-800"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return <div className={`w-9 h-9 sm:w-10 sm:h-10 ${color} rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0`}>{initials}</div>;
}

// ─── Action Icon Button ───────────────────────────────────────────────────────
function ActionIconBtn({ href, onClick, title, disabled, children, variant = "default" }: {
  href?: string; onClick?: () => void; title: string; disabled?: boolean;
  children: React.ReactNode; variant?: "default" | "mail" | "whatsapp" | "danger";
}) {
  const variants: Record<string, string> = {
    default:  "bg-[#FAF8F2] hover:bg-[#D86F32]/10 border-[#4A0F06]/10 hover:border-[#D86F32]/30 text-[#4A0F06]/40 hover:text-[#D86F32]",
    mail:     "bg-[#FAF8F2] hover:bg-blue-50 border-[#4A0F06]/10 hover:border-blue-200 text-[#4A0F06]/40 hover:text-blue-600",
    whatsapp: "bg-[#FAF8F2] hover:bg-emerald-50 border-[#4A0F06]/10 hover:border-emerald-200 text-[#4A0F06]/40 hover:text-emerald-600",
    danger:   "bg-[#FAF8F2] hover:bg-red-50 border-[#4A0F06]/10 hover:border-red-200 text-[#4A0F06]/40 hover:text-red-500",
  };
  const base = `flex items-center justify-center w-8 h-8 border rounded-lg transition-all flex-shrink-0 ${variants[variant]} ${disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ""}`;
  if (href && !disabled) return <a href={href} title={title} target="_blank" rel="noopener noreferrer" className={base}>{children}</a>;
  return <button type="button" onClick={onClick} title={title} disabled={disabled} className={base}>{children}</button>;
}

// ─── Mobile Staff Card ────────────────────────────────────────────────────────
function MobileStaffCard({ member, onDelete }: { member: StaffMember; onDelete: (id: string, name: string) => void }) {
  const router = useRouter();
  const cfg = ROLE_CONFIG[member.role];
  const rawPhone = member.phone?.replace(/\D/g,"") ?? "";
  const waPhone = rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`;
  const waUrl = rawPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${member.name}, this is a message from our clinic.`)}` : "";
  const joinedDate = new Date(member.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});

  return (
    <div onClick={() => router.push(`/dashboard/staff/${member.id}`)}
      className="p-4 border-b border-[#4A0F06]/5 last:border-0 hover:bg-[#D86F32]/5 active:bg-[#D86F32]/10 cursor-pointer transition-colors">
      <div className="flex items-start gap-3">
        <Avatar name={member.name}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-bold text-[#4A0F06] truncate">{member.name}</p>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-xl border flex-shrink-0 ${cfg.pill}`}>
              {cfg.icon}<span>{cfg.label}</span>
            </span>
          </div>
          <p className="text-xs text-[#4A0F06]/50 truncate">{member.email}</p>
          {member.phone && <p className="text-xs text-[#4A0F06]/40 mt-0.5">{member.phone}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[#4A0F06]/30 font-medium">Joined {joinedDate}</span>
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <ActionIconBtn href={`mailto:${member.email}`} title="Email" variant="mail">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </ActionIconBtn>
              {rawPhone && <ActionIconBtn href={waUrl} title="WhatsApp" variant="whatsapp">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.986l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.17-1.399l-.371-.22-3.844 1.008 1.026-3.748-.242-.387A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
              </ActionIconBtn>}
              <ActionIconBtn onClick={() => onDelete(member.id, member.name)} title="Remove" variant="danger">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </ActionIconBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StaffRegistryPage() {
  const router = useRouter();
  const [staff,        setStaff]        = useState<StaffMember[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState<RoleFilter>("ALL");
  const [exporting,    setExporting]    = useState(false);
  const [exportDone,   setExportDone]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting,      setDeleting]      = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState("");

  function exportStaffToCSV(staffList: StaffMember[]) {
    const BOM = "\uFEFF";
    const headers = ["Staff ID","Name","Email","Role","Phone","Joined Date"];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g,'""')}"`;
    const rows = staffList.map(s => [s.id, s.name, s.email, ROLE_CONFIG[s.role]?.label ?? s.role, s.phone ?? "", new Date(s.createdAt).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})]);
    const csv = BOM + [headers,...rows].map(row => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Staff-Registry-${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}).replace(/ /g,"-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function loadStaff() {
    fetch("/api/staff",{credentials:"include"})
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setStaff(Array.isArray(data.staff) ? data.staff : []); setLoading(false); })
      .catch(() => { setError("Failed to load staff registry. You may not have permission to view this page."); setLoading(false); });
  }

  useEffect(() => { loadStaff(); }, []);

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/staff/${confirmDelete.id}`,{method:"DELETE",credentials:"include"});
      if (res.ok) {
        setConfirmDelete(null);
        setDeleteSuccess(`${confirmDelete.name} has been removed.`);
        loadStaff();
        setTimeout(() => setDeleteSuccess(""), 4000);
      } else { const data = await res.json(); alert(`Delete failed: ${data.error ?? "Unknown error"}`); }
    } catch { alert("Network error during delete"); }
    setDeleting(false);
  }

  async function handleExport() {
    setExporting(true);
    try { exportStaffToCSV(staff); setExportDone(true); setTimeout(() => setExportDone(false), 3000); }
    catch { alert("Export failed."); }
    setExporting(false);
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return staff.filter(s => {
      const matchesRole = roleFilter === "ALL" || s.role === roleFilter;
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.phone ?? "").toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [staff, search, roleFilter]);

  const counts = useMemo(() => ({
    ALL: staff.length,
    ADMIN: staff.filter(s => s.role === "ADMIN").length,
    DOCTOR: staff.filter(s => s.role === "DOCTOR").length,
    RECEPTIONIST: staff.filter(s => s.role === "RECEPTIONIST").length,
  }), [staff]);

  if (loading) return (
    <div className="min-h-screen bg-[#F5F2E8] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-[#D86F32] border-t-transparent rounded-full animate-spin"/>
        <p className="text-sm text-[#4A0F06]/40 font-medium">Loading staff registry…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#F5F2E8] flex items-center justify-center p-4">
      <div className="bg-[#FAF8F2] rounded-2xl border border-red-100 shadow-sm p-8 max-w-sm text-center w-full">
        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <p className="text-sm font-bold text-[#4A0F06] mb-2">Access denied</p>
        <p className="text-xs text-[#4A0F06]/50">{error}</p>
        <Link href="/dashboard" className="inline-flex items-center gap-2 mt-4 text-xs font-bold text-[#D86F32] hover:text-[#4A0F06] bg-[#D86F32]/10 border border-[#D86F32]/20 px-4 py-2 rounded-xl transition-all">Back to Dashboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F2E8] p-4 sm:p-6">

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-[#4A0F06]/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/10 p-6 w-full max-w-sm shadow-2xl">
            <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="text-base font-bold text-[#4A0F06] mb-1">Remove staff member?</h3>
            <p className="text-sm text-[#4A0F06]/60 mb-5 leading-relaxed">
              This will permanently remove <span className="font-semibold text-[#4A0F06]">{confirmDelete.name}</span> and revoke their access.
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50 transition-all">
                {deleting ? "Removing…" : "Yes, remove"}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 bg-[#4A0F06]/5 hover:bg-[#4A0F06]/10 border border-[#4A0F06]/10 text-[#4A0F06]/70 text-sm font-semibold py-2.5 rounded-xl transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 bg-[#4A0F06] rounded-xl flex items-center justify-center shadow-md shadow-[#4A0F06]/20">
                <svg className="w-4 h-4 text-[#F5F2E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#4A0F06] tracking-tight">Staff Registry</h1>
            </div>
            <p className="text-sm text-[#4A0F06]/40 ml-[42px]">{staff.length} staff member{staff.length !== 1 ? "s" : ""} registered</p>
          </div>

          {/* Header action buttons — aligned consistently with Patient page */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button onClick={handleExport} disabled={exporting || staff.length === 0}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all shadow-sm disabled:opacity-50 ${exportDone ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-[#FAF8F2] border-[#4A0F06]/15 text-[#4A0F06]/70 hover:border-[#D86F32]/40 hover:text-[#D86F32] hover:bg-[#D86F32]/5"}`}>
              {exportDone ? (
                <><svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>Downloaded!</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>{exporting ? "Exporting…" : "Export CSV"}</>
              )}
            </button>
            <Link href="/dashboard/signup"
              className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl bg-[#4A0F06] hover:bg-[#5C1408] text-[#F5F2E8] transition-all shadow-md shadow-[#4A0F06]/25 hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>
              Add Staff Member
            </Link>
          </div>
        </div>

        {/* Delete success toast */}
        {deleteSuccess && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-semibold text-emerald-700 shadow-sm">
            <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
            </div>
            {deleteSuccess}
          </div>
        )}

        {/* Summary stat chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {([
            { key: "ALL",          label: "All Staff",     color: "bg-[#4A0F06]",  bg: "bg-[#4A0F06]/5",  border: "border-[#4A0F06]/20" },
            { key: "ADMIN",        label: "Admins",        color: "bg-violet-500", bg: "bg-violet-50",    border: "border-violet-200" },
            { key: "DOCTOR",       label: "Doctors",       color: "bg-teal-500",   bg: "bg-teal-50",      border: "border-teal-200" },
            { key: "RECEPTIONIST", label: "Receptionists", color: "bg-amber-500",  bg: "bg-amber-50",     border: "border-amber-200" },
          ] as { key: RoleFilter; label: string; color: string; bg: string; border: string }[]).map(({ key, label, color, bg, border }) => (
            <button key={key} onClick={() => setRoleFilter(key)}
              className={`flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all ${roleFilter === key ? `${bg} ${border} shadow-sm` : "bg-[#FAF8F2] border-[#4A0F06]/8 hover:border-[#4A0F06]/15 shadow-sm"}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <span className="text-xs sm:text-sm font-black text-white">{counts[key]}</span>
              </div>
              <span className={`text-[10px] sm:text-xs font-bold ${roleFilter === key ? "text-[#4A0F06]" : "text-[#4A0F06]/50"}`}>{label}</span>
            </button>
          ))}
        </div>

        {/* Search + Table card */}
        <div className="bg-[#FAF8F2] rounded-2xl border border-[#4A0F06]/8 shadow-sm overflow-hidden">

          {/* Search bar */}
          <div className="px-4 sm:px-6 py-4 border-b border-[#4A0F06]/6 flex items-center gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-[#4A0F06]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or phone…"
                className="w-full bg-[#F5F2E8] border-2 border-[#4A0F06]/10 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-[#4A0F06] placeholder:text-[#4A0F06]/30 focus:outline-none focus:border-[#D86F32]/50 transition-all"/>
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4A0F06]/30 hover:text-[#4A0F06]/60 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <span className="text-xs font-semibold text-[#4A0F06]/40 bg-[#4A0F06]/5 border border-[#4A0F06]/10 px-3 py-1.5 rounded-xl flex-shrink-0 whitespace-nowrap">
              {filtered.length} result{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Content */}
          {filtered.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-14 h-14 bg-[#4A0F06]/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-[#4A0F06]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <p className="text-sm font-semibold text-[#4A0F06]/50">No staff members found</p>
              <p className="text-xs text-[#4A0F06]/30 mt-1">{search ? "Try adjusting your search or filter" : "No staff registered yet"}</p>
              {search && (
                <button onClick={() => { setSearch(""); setRoleFilter("ALL"); }} className="mt-4 text-xs font-semibold text-[#D86F32] hover:text-[#4A0F06] bg-[#D86F32]/10 border border-[#D86F32]/20 px-4 py-2 rounded-xl transition-all">Clear filters</button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block sm:hidden">
                {filtered.map(member => (
                  <MobileStaffCard key={member.id} member={member} onDelete={(id, name) => setConfirmDelete({ id, name })}/>
                ))}
              </div>

              {/* Desktop/Tablet table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#4A0F06]/3 border-b border-[#4A0F06]/6">
                      {["Staff Member","Role","Email","Phone","Joined","Actions"].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[10px] font-bold text-[#4A0F06]/40 uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((member, idx) => {
                      const cfg = ROLE_CONFIG[member.role];
                      const joinedDate = new Date(member.createdAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
                      const rawPhone = member.phone?.replace(/\D/g,"") ?? "";
                      const waPhone = rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`;
                      const waUrl = rawPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(`Hello ${member.name}, this is a message from our clinic.`)}` : "";

                      return (
                        <tr key={member.id}
                          onClick={() => router.push(`/dashboard/staff/${member.id}`)}
                          className={`border-b border-[#4A0F06]/4 last:border-0 cursor-pointer transition-all group ${idx % 2 === 0 ? "bg-[#FAF8F2]" : "bg-[#F5F2E8]/40"} hover:bg-[#D86F32]/6 hover:shadow-sm`}>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={member.name}/>
                              <div>
                                <p className="text-sm font-bold text-[#4A0F06] group-hover:text-[#5C1408]">{member.name}</p>
                                <p className="text-[10px] font-mono text-[#4A0F06]/30 mt-0.5 truncate max-w-[140px]">{member.id}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border ${cfg.pill}`}>
                              <span className="flex-shrink-0">{cfg.icon}</span>{cfg.label}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <a href={`mailto:${member.email}`} onClick={e => e.stopPropagation()}
                              className="text-sm font-medium text-[#4A0F06]/60 hover:text-[#D86F32] transition-colors">{member.email}</a>
                          </td>

                          <td className="px-5 py-4">
                            {member.phone ? (
                              <a href={`tel:${member.phone}`} onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-sm font-medium text-[#4A0F06]/60 hover:text-[#D86F32] transition-colors">
                                <svg className="w-3.5 h-3.5 text-[#4A0F06]/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                {member.phone}
                              </a>
                            ) : <span className="text-xs text-[#4A0F06]/20">—</span>}
                          </td>

                          <td className="px-5 py-4">
                            <span className="text-xs font-medium text-[#4A0F06]/50">{joinedDate}</span>
                          </td>

                          {/* Actions — same alignment/spacing as Patient page */}
                          <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <ActionIconBtn href={`mailto:${member.email}`} title={`Email ${member.name}`} variant="mail">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                              </ActionIconBtn>
                              <ActionIconBtn href={waUrl || undefined} title={rawPhone ? `WhatsApp ${member.name}` : "No phone"} disabled={!rawPhone} variant="whatsapp">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L.057 23.986l6.305-1.654A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.651-.51-5.17-1.399l-.371-.22-3.844 1.008 1.026-3.748-.242-.387A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                              </ActionIconBtn>
                              <ActionIconBtn onClick={() => setConfirmDelete({ id: member.id, name: member.name })} title="Remove staff member" variant="danger">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </ActionIconBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="px-6 py-3.5 border-t border-[#4A0F06]/6 bg-[#4A0F06]/2 flex items-center justify-between">
                  <p className="text-xs text-[#4A0F06]/40 font-medium">
                    Showing <span className="font-bold text-[#4A0F06]/70">{filtered.length}</span> of <span className="font-bold text-[#4A0F06]/70">{staff.length}</span> staff member{staff.length !== 1 ? "s" : ""}
                  </p>
                  <Link href="/dashboard/signup" className="text-xs font-semibold text-[#D86F32] hover:text-[#4A0F06] transition-colors">
                    + Add new member
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}