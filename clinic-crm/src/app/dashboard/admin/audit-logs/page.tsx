"use client";
/**
 * /dashboard/admin/audit-logs
 * Full audit trail viewer — ADMIN only
 * ✅ Search · entity · action · date range filters
 * ✅ Paginated table with expandable detail rows
 * ✅ Color-coded action badges
 * ✅ Old/New value JSON diff viewer
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Search, Filter, Shield, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";

const B = { primary: "#5B1A0E", accent: "#D46A2E", bg: "#F5F1E8", text: "#2B1A14", muted: "#7A685F" };

// ── Types ──────────────────────────────────────────────────────────────────
type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

type AuditLog = {
  id: string; userId: string; userName: string; userRole: string;
  action: string; entity: string; entityId: string;
  description: string; oldValue: JsonValue; newValue: JsonValue;
  ipAddress: string | null; userAgent: string | null; createdAt: string;
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };

// ── Action badge config ────────────────────────────────────────────────────
const ACTION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CREATE:         { label: "Create",         color: "#16a34a", bg: "#16a34a15" },
  UPDATE:         { label: "Update",         color: "#2563eb", bg: "#2563eb15" },
  DELETE:         { label: "Delete",         color: "#dc2626", bg: "#dc262615" },
  LOGIN:          { label: "Login",          color: "#7c3aed", bg: "#7c3aed15" },
  LOGOUT:         { label: "Logout",         color: "#7A685F", bg: "#7A685F15" },
  EXPORT:         { label: "Export",         color: "#d97706", bg: "#d9770615" },
  PASSWORD_RESET: { label: "Pwd Reset",      color: "#0891b2", bg: "#0891b215" },
  ROLE_CHANGE:    { label: "Role Change",    color: "#D46A2E", bg: "#D46A2E15" },
};

const ENTITIES  = ["Appointment", "Patient", "Staff", "Expense"];
const ACTIONS   = Object.keys(ACTION_CONFIG);

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />;
}

// ── JSON diff viewer ───────────────────────────────────────────────────────
function JsonViewer({ label, value, color }: { label: string; value: JsonValue; color: string }) {
  if (value === null || value === undefined) return null;
  const display = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color }}>{label}</p>
      <pre className="text-[10px] font-mono rounded-xl p-3 overflow-auto max-h-40 leading-relaxed"
        style={{ background: color + "08", border: `1px solid ${color}20` }}>
        {display}
      </pre>
    </div>
  );
}

// ── Expandable row ─────────────────────────────────────────────────────────
function LogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const ac = ACTION_CONFIG[log.action] ?? { label: log.action, color: B.muted, bg: B.muted + "15" };
  const hasDetail = log.oldValue || log.newValue || log.ipAddress;

  return (
    <>
      <tr className="hover:bg-[#F5F1E8]/60 transition-colors border-b border-gray-100">
        <td className="px-4 py-3 text-xs text-[#7A685F] whitespace-nowrap">{fmtDate(log.createdAt)}</td>
        <td className="px-4 py-3">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={{ background: ac.bg, color: ac.color }}>
            {ac.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-600">{log.entity}</span>
        </td>
        <td className="px-4 py-3 max-w-[260px]">
          <p className="text-sm text-[#2B1A14] truncate">{log.description}</p>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg text-[9px] font-black text-white flex items-center justify-center flex-shrink-0"
              style={{ background: B.primary }}>
              {log.userName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#2B1A14] leading-tight">{log.userName}</p>
              <p className="text-[10px] text-[#7A685F]">{log.userRole}</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          {hasDetail && (
            <button onClick={() => setOpen(o => !o)}
              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <ChevronDown size={12} className={`text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </td>
      </tr>

      {open && hasDetail && (
        <tr className="bg-[#F5F1E8]/40">
          <td colSpan={6} className="px-4 pb-4 pt-0">
            <div className="rounded-2xl border border-[#DDD2C2] bg-white p-4 space-y-3">
              {/* JSON diff */}
              {(log.oldValue || log.newValue) && (
                <div className="flex gap-3 flex-wrap">
                  <JsonViewer label="Before" value={log.oldValue} color="#dc2626" />
                  <JsonViewer label="After"  value={log.newValue} color="#16a34a" />
                </div>
              )}
              {/* Meta */}
              <div className="flex flex-wrap gap-4 text-[10px] text-[#7A685F] border-t border-[#E8E1D5] pt-3">
                <span><span className="font-bold">Entity ID:</span> <code className="font-mono bg-gray-100 px-1 rounded">{log.entityId}</code></span>
                {log.ipAddress && <span><span className="font-bold">IP:</span> {log.ipAddress}</span>}
                {log.userAgent && <span className="truncate max-w-xs"><span className="font-bold">UA:</span> {log.userAgent}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [logs,       setLogs]       = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 });
  const [loading,    setLoading]    = useState(true);

  const [search,     setSearch]     = useState("");
  const [entity,     setEntity]     = useState("");
  const [action,     setAction]     = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [page,       setPage]       = useState(1);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.replace("/dashboard");
  }, [status, session, router]);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: "50",
        ...(search   && { search }),
        ...(entity   && { entity }),
        ...(action   && { action }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo   && { dateTo }),
      });
      const res  = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLogs(data.logs ?? []);
      setPagination(data.pagination);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, [search, entity, action, dateFrom, dateTo]);

  useEffect(() => {
    if (status === "authenticated") { fetchLogs(1); setPage(1); }
  }, [status, entity, action, dateFrom, dateTo, fetchLogs]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { fetchLogs(1); setPage(1); }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [search]); // eslint-disable-line

  const hasFilters = !!(entity || action || dateFrom || dateTo);

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: B.bg }}>
      <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: B.bg }}>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: B.primary }}>
                <Shield size={16} className="text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: B.primary }}>Audit Logs</h1>
            </div>
            <p className="text-xs text-[#7A685F] ml-[42px]">
              Complete trail of all system actions · {pagination.total} total events
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold"
            style={{ background: "#16a34a15", borderColor: "#16a34a40", color: "#16a34a" }}>
            <span className="w-2 h-2 rounded-full animate-pulse bg-[#16a34a]" />
            Live
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3"
            style={{ background: `linear-gradient(to right, ${B.bg}, white)` }}>
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by description, user, or entity ID…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <button onClick={() => setShowFilter(f => !f)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors relative
                ${hasFilters ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}>
              <Filter size={12} />
              Filters
              {hasFilters && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center">!</span>
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilter && (
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Entity</label>
                <select value={entity} onChange={e => setEntity(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="">All</option>
                  {ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Action</label>
                <select value={action} onChange={e => setAction(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="">All</option>
                  {ACTIONS.map(a => <option key={a} value={a}>{ACTION_CONFIG[a].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">From</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">To</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none" />
              </div>
              <div className="col-span-2 sm:col-span-4 flex justify-end gap-2">
                <button onClick={() => { setEntity(""); setAction(""); setDateFrom(""); setDateTo(""); }}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100">
                  <X size={11} /> Clear
                </button>
                <button onClick={() => setShowFilter(false)}
                  className="px-4 py-1.5 text-xs font-bold text-white rounded-xl"
                  style={{ background: B.primary }}>Done</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <Shield size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500">No audit events found</p>
                <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {["Timestamp","Action","Entity","Description","User","Detail"].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => <LogRow key={log.id} log={log} />)}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {!loading && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {(pagination.page-1)*pagination.limit+1}–{Math.min(pagination.page*pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setPage(p => p-1); fetchLogs(page-1); }} disabled={page===1}
                  className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50">
                  <ChevronLeft size={14} />
                </button>
                <span className="flex items-center px-3 text-sm font-semibold text-gray-600">{page} / {pagination.totalPages}</span>
                <button onClick={() => { setPage(p => p+1); fetchLogs(page+1); }} disabled={page===pagination.totalPages}
                  className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}