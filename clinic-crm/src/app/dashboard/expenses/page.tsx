"use client";

/**
 * src/app/dashboard/expenses/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Role-gated (ADMIN + RECEPTIONIST, DOCTOR redirected)
 * ✅ Month selector — charts + stats update per selected month
 * ✅ Weekly charts update when month changes
 * ✅ Download Report button with CSV + Text Report dropdown
 * ✅ Stats cards scoped to selected month
 * ✅ Monthly trend area chart (12-month)
 * ✅ Category pie chart — Recharts v3 compatible (no activeIndex/activeShape)
 * ✅ Weekly bar chart — weeks of the SELECTED month
 * ✅ Expense table with search, filters, pagination
 * ✅ Add / Edit / View / Delete modals
 * ✅ Fully responsive
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell, Sector,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  PlusCircle, Search, Filter, Pencil, Trash2,
  Eye, X, TrendingUp, DollarSign, Calendar, Tag,
  ChevronLeft, ChevronRight, AlertCircle,
} from "lucide-react";

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const B = {
  primary: "#5B1A0E",
  accent:  "#D46A2E",
  green:   "#16a34a",
  teal:    "#0d9488",
  red:     "#dc2626",
  amber:   "#d97706",
  blue:    "#2563eb",
  violet:  "#7c3aed",
  bg:      "#F5F1E8",
  text:    "#2B1A14",
  muted:   "#7A685F",
};

const CAT_COLORS: Record<string, string> = {
  SALARY: B.primary, RENT: B.accent, ELECTRICITY: B.amber,
  INTERNET: B.blue, EQUIPMENT: B.teal, MEDICINE: B.green,
  MAINTENANCE: "#9333ea", MARKETING: "#db2777", TRANSPORT: "#0891b2", OTHER: B.muted,
};
const CAT_LABELS: Record<string, string> = {
  SALARY: "Salary", RENT: "Rent", ELECTRICITY: "Electricity",
  INTERNET: "Internet", EQUIPMENT: "Equipment", MEDICINE: "Medicine",
  MAINTENANCE: "Maintenance", MARKETING: "Marketing", TRANSPORT: "Transport", OTHER: "Other",
};
const PM_LABELS: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank Transfer",
};
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CATEGORIES = Object.keys(CAT_LABELS);
const PAY_MODES  = Object.keys(PM_LABELS);

// ─── Types ────────────────────────────────────────────────────────────────────
type Expense = {
  id: string; title: string; description: string | null;
  category: string; amount: number; expenseDate: string;
  paymentMode: string; createdAt: string;
  createdBy: { id: string; name: string; role: string };
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Analytics = {
  overview: { totalMonthly: number; totalYearly: number; totalWeekly: number; highestCategory: string };
  monthlyTrend:         { month: string; total: number }[];
  categoryDistribution: { name: string; value: number }[];
  weeklyExpenses:       { week: string; label: string; total: number }[];
};
type FormData = {
  title: string; description: string; category: string;
  amount: string; expenseDate: string; paymentMode: string;
};
const EMPTY_FORM: FormData = {
  title: "", description: "", category: "SALARY",
  amount: "", expenseDate: new Date().toISOString().split("T")[0], paymentMode: "CASH",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function monthLabel(value: string) {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function getMonthOptions() {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value, label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) });
  }
  return opts;
}

// ─── Weekly breakdown ─────────────────────────────────────────────────────────
function getWeeksOfMonth(yearMonth: string): { label: string; start: Date; end: Date }[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0);
  const weeks: { label: string; start: Date; end: Date }[] = [];
  let current = new Date(firstDay);
  let weekNum = 1;
  while (current <= lastDay) {
    const start = new Date(current);
    const end   = new Date(current);
    end.setDate(end.getDate() + 6);
    if (end > lastDay) end.setTime(lastDay.getTime());
    weeks.push({
      label: `W${weekNum} (${start.getDate()} ${MONTH_SHORT[m-1]}–${end.getDate()})`,
      start: new Date(start),
      end:   new Date(end),
    });
    current.setDate(current.getDate() + 7);
    weekNum++;
  }
  return weeks;
}

// ─── Export functions ─────────────────────────────────────────────────────────
function exportCSV(expenses: Expense[], month: string) {
  const label = monthLabel(month);
  const rows: string[][] = [
    [`Expense Report — ${label}`], [],
    ["Title","Description","Category","Amount (₹)","Payment Mode","Expense Date","Created By","Created At"],
  ];
  expenses.forEach(e => rows.push([
    e.title, e.description ?? "",
    CAT_LABELS[e.category] ?? e.category, String(e.amount),
    PM_LABELS[e.paymentMode] ?? e.paymentMode,
    fmtDate(e.expenseDate), e.createdBy?.name ?? "", fmtDate(e.createdAt),
  ]));
  const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `expenses-${month}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportTextReport(expenses: Expense[], analytics: Analytics | null, month: string) {
  const label = monthLabel(month);
  const line  = "─".repeat(60);
  const lines: string[] = [];
  lines.push("CLINIC CRM — EXPENSE REPORT");
  lines.push(`Period : ${label}`);
  lines.push(`Generated : ${new Date().toLocaleString("en-IN")}`);
  lines.push(line);
  lines.push("");
  lines.push("OVERVIEW");
  lines.push(`  Monthly Total   : ${fmt(analytics?.overview.totalMonthly ?? 0)}`);
  lines.push(`  Yearly Total    : ${fmt(analytics?.overview.totalYearly ?? 0)}`);
  lines.push(`  Weekly Total    : ${fmt(analytics?.overview.totalWeekly ?? 0)}`);
  lines.push(`  Top Category    : ${CAT_LABELS[analytics?.overview.highestCategory ?? ""] ?? "—"}`);
  lines.push("");
  lines.push("CATEGORY BREAKDOWN");
  (analytics?.categoryDistribution ?? []).forEach(c => {
    lines.push(`  ${(CAT_LABELS[c.name] ?? c.name).padEnd(16)} ${fmt(c.value)}`);
  });
  lines.push("");
  lines.push("WEEKLY BREAKDOWN");
  (analytics?.weeklyExpenses ?? []).forEach(w => {
    lines.push(`  ${w.label.padEnd(28)} ${fmt(w.total)}`);
  });
  lines.push("");
  lines.push("EXPENSE DETAIL");
  lines.push(`  ${"Title".padEnd(28)} ${"Category".padEnd(16)} ${"Amount".padEnd(12)} ${"Mode".padEnd(14)} Date`);
  lines.push("  " + "─".repeat(84));
  expenses.forEach(e => {
    lines.push(
      `  ${e.title.slice(0,28).padEnd(28)} ${(CAT_LABELS[e.category]??e.category).padEnd(16)} ${fmt(e.amount).padEnd(12)} ${(PM_LABELS[e.paymentMode]??e.paymentMode).padEnd(14)} ${fmtDate(e.expenseDate)}`
    );
  });
  lines.push(""); lines.push(line);
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `expense-report-${month}.txt`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Download Button ───────────────────────────────────────────────────────────
function DownloadButton({ expenses, analytics, month }: {
  expenses: Expense[]; analytics: Analytics | null; month: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        style={{ background: B.primary, color: "#fff" }}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Download Report
        <svg className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Export format</p>
          </div>
          <button
            onClick={() => { exportCSV(expenses, month); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: B.green + "15" }}>
              <svg className="w-4 h-4" style={{ color: B.green }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Download CSV</p>
              <p className="text-[10px] text-gray-400">Excel-compatible spreadsheet</p>
            </div>
          </button>
          <button
            onClick={() => { exportTextReport(expenses, analytics, month); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-50"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: B.blue + "15" }}>
              <svg className="w-4 h-4" style={{ color: B.blue }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Download Text</p>
              <p className="text-[10px] text-gray-400">Formatted plain-text report</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />;
}
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-40 flex items-center justify-center text-center">
      <div>
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2">
          <TrendingUp size={18} className="text-gray-300" />
        </div>
        <p className="text-sm font-semibold text-gray-400">{message}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, icon, loading }: {
  label: string; value: string; sub?: string;
  color: string; icon: React.ReactNode; loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border-2 shadow-sm p-4 relative overflow-hidden" style={{ borderColor: color + "30" }}>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10" style={{ background: color }} />
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="w-9 h-9" /><Skeleton className="w-20 h-3" />
          <Skeleton className="w-24 h-7" /><Skeleton className="w-16 h-3" />
        </div>
      ) : (
        <>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
            style={{ background: color + "15", color }}>{icon}</div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-black tracking-tight" style={{ color: B.text }}>{value}</p>
          {sub && <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>}
        </>
      )}
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }: {
  title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4"
        style={{ background: `linear-gradient(to right, ${B.bg}, white)` }}>
        <div>
          <h2 className="text-sm sm:text-base font-bold text-gray-800">{title}</h2>
          {subtitle && <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

function CategoryBadge({ cat }: { cat: string }) {
  const color = CAT_COLORS[cat] ?? B.muted;
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
      style={{ background: color + "15", color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {CAT_LABELS[cat] ?? cat}
    </span>
  );
}
function PayBadge({ mode }: { mode: string }) {
  const colors: Record<string, string> = { CASH: B.green, UPI: B.blue, CARD: B.violet, BANK_TRANSFER: B.teal };
  const c = colors[mode] ?? B.muted;
  return (
    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border"
      style={{ background: c + "10", color: c, borderColor: c + "30" }}>
      {PM_LABELS[mode] ?? mode}
    </span>
  );
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-3 text-xs min-w-[140px]">
      <p className="font-bold text-gray-800 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className="font-bold text-gray-800">{fmt(Number(p.value ?? 0))}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Pie Chart — Recharts v3 compatible ───────────────────────────────────────
// v3 removed activeIndex/activeShape as <Pie> props.
// We replicate the same UX using: onMouseEnter state + a custom label rendered
// as a <text> overlay inside a wrapping <div style="position:relative">.
// The "active" sector is rendered slightly larger via outerRadius on that Cell
// using a custom shape prop on Cell itself, which v3 still supports.

type PieCatEntry = { name: string; value: number };

type CellShapeProps = {
  cx?: number; cy?: number;
  innerRadius?: number; outerRadius?: number;
  startAngle?: number; endAngle?: number;
  fill?: string;
  isActive?: boolean;
};

function PieCellShape(props: CellShapeProps) {
  const {
    cx = 0, cy = 0,
    innerRadius = 0, outerRadius = 0,
    startAngle = 0, endAngle = 0,
    fill = "",
    isActive = false,
  } = props;
  const expand = isActive ? 8 : 0;
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + expand}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      opacity={isActive ? 1 : 0.85}
    />
  );
}

function CategoryPieChart({ data }: { data: PieCatEntry[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = data[activeIdx] ?? data[0];
  const total  = data.reduce((s, d) => s + d.value, 0);
  const pct    = total > 0 ? ((active?.value ?? 0) / total) * 100 : 0;
  const color  = CAT_COLORS[active?.name ?? ""] ?? B.muted;

  return (
    <div>
      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={50}
              outerRadius={72}
              dataKey="value"
              onMouseEnter={(_, idx) => setActiveIdx(idx)}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={CAT_COLORS[entry.name] ?? B.muted}
                  // @ts-expect-error — Recharts passes extra props to Cell's shape renderer
                  shape={(props: CellShapeProps) => (
                    <PieCellShape {...props} isActive={i === activeIdx} />
                  )}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Centre label overlay — positioned over the donut hole */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ top: 0 }}
        >
          <span className="text-lg font-black leading-tight" style={{ color: B.text }}>
            {fmt(active?.value ?? 0)}
          </span>
          <span className="text-[10px] font-semibold leading-tight" style={{ color: B.muted }}>
            {CAT_LABELS[active?.name ?? ""] ?? active?.name}
          </span>
          <span className="text-[11px] font-bold leading-tight" style={{ color }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-1">
        {data.slice(0, 6).map(cat => (
          <div key={cat.name} className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-600">
            <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLORS[cat.name] ?? B.muted }} />
            {CAT_LABELS[cat.name] ?? cat.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Expense Form Modal ────────────────────────────────────────────────────────
function ExpenseModal({ mode, initial, onClose, onSave }: {
  mode: "add" | "edit" | "view";
  initial: Partial<Expense>;
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
}) {
  const [form, setForm] = useState<FormData>({
    ...EMPTY_FORM,
    ...(initial.title       !== undefined && { title:       initial.title }),
    ...(initial.description !== undefined && { description: initial.description ?? "" }),
    ...(initial.category    !== undefined && { category:    initial.category }),
    ...(initial.amount      !== undefined && { amount:      String(initial.amount) }),
    ...(initial.expenseDate !== undefined && { expenseDate: initial.expenseDate.split("T")[0] }),
    ...(initial.paymentMode !== undefined && { paymentMode: initial.paymentMode }),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");
  const isView = mode === "view";
  const isEdit = mode === "edit";

  async function handleSubmit() {
    setError(""); setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  const inputCls = `w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50
    focus:outline-none focus:ring-2 focus:ring-offset-1 focus:border-transparent transition-all
    ${isView ? "opacity-70 cursor-default pointer-events-none" : "focus:ring-orange-400"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0"
          style={{ background: `linear-gradient(to right, ${B.bg}, white)` }}>
          <div>
            <h3 className="font-bold text-gray-800">
              {mode === "add" ? "Add Expense" : mode === "edit" ? "Edit Expense" : "Expense Details"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === "add" ? "Record a new clinic expense"
                : mode === "edit" ? "Modify expense record" : "Read-only view"}
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={14} className="text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Expense Title <span className="text-red-500">*</span>
            </label>
            <input className={inputCls} placeholder="e.g. Monthly rent payment"
              value={form.title} readOnly={isView}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00"
                value={form.amount} readOnly={isView}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Expense Date <span className="text-red-500">*</span>
              </label>
              <input className={inputCls} type="date" value={form.expenseDate} readOnly={isView}
                onChange={e => setForm(f => ({ ...f, expenseDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select className={inputCls} value={form.category} disabled={isView}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Payment Mode <span className="text-red-500">*</span>
              </label>
              <select className={inputCls} value={form.paymentMode} disabled={isView}
                onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>
                {PAY_MODES.map(p => <option key={p} value={p}>{PM_LABELS[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Description</label>
            <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Optional notes…"
              value={form.description} readOnly={isView}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          {isView && initial.createdBy && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created by</span>
                <span className="font-semibold text-gray-700">{initial.createdBy.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Created at</span>
                <span className="font-semibold text-gray-700">
                  {initial.createdAt ? fmtDate(initial.createdAt) : "—"}
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        {!isView ? (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="px-5 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
              style={{ background: B.primary }}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
            </button>
          </div>
        ) : (
          <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 flex justify-end">
            <button onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ expense, onClose, onConfirm }: {
  expense: Expense; onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  async function go() {
    setLoading(true);
    try { await onConfirm(); onClose(); }
    finally { setLoading(false); }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Trash2 size={20} className="text-red-600" />
        </div>
        <h3 className="text-center font-bold text-gray-800 mb-1">Delete Expense</h3>
        <p className="text-center text-sm text-gray-500 mb-5">
          Delete <span className="font-semibold text-gray-800">"{expense.title}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={go} disabled={loading}
            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors">
            {loading ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ExpensesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role    = session?.user?.role ?? "";
  const isAdmin = role === "ADMIN";

  const monthOptions = useMemo(() => getMonthOptions(), []);
  const defaultMonth = monthOptions[0].value;

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [expenses,      setExpenses]      = useState<Expense[]>([]);
  const [allMonthExp,   setAllMonthExp]   = useState<Expense[]>([]);
  const [pagination,    setPagination]    = useState<Pagination>({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [analytics,     setAnalytics]     = useState<Analytics | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [aLoading,      setALoading]      = useState(true);

  const [search,      setSearch]      = useState("");
  const [category,    setCategory]    = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page,        setPage]        = useState(1);

  const [modal, setModal] = useState<{ type: "add"|"edit"|"view"|"delete"; expense?: Expense } | null>(null);

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Route guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "authenticated" && role === "DOCTOR") router.replace("/dashboard");
  }, [status, role, router]);

  // ── Date range ─────────────────────────────────────────────────────────────
  const { monthStart, monthEnd } = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return {
      monthStart: new Date(y, m - 1, 1).toISOString().split("T")[0],
      monthEnd:   new Date(y, m, 0).toISOString().split("T")[0],
    };
  }, [selectedMonth]);

  // ── Fetch expenses ─────────────────────────────────────────────────────────
  const fetchExpenses = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), limit: "15",
        dateFrom: monthStart, dateTo: monthEnd,
        ...(search      && { search }),
        ...(category    && { category }),
        ...(paymentMode && { paymentMode }),
      });
      const res  = await fetch(`/api/expenses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setExpenses(data.expenses ?? []);
      setPagination(data.pagination);
    } catch { setExpenses([]); }
    finally { setLoading(false); }
  }, [search, category, paymentMode, monthStart, monthEnd]);

  const fetchAllMonthExpenses = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "1000", dateFrom: monthStart, dateTo: monthEnd });
      const res = await fetch(`/api/expenses?${params}`, { credentials: "include" });
      if (res.ok) { const data = await res.json(); setAllMonthExp(data.expenses ?? []); }
    } catch { /* ignore */ }
  }, [monthStart, monthEnd]);

  // ── Fetch analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(async () => {
    if (!isAdmin) return;
    setALoading(true);
    try {
      const [y] = selectedMonth.split("-");
      const res = await fetch(`/api/expenses/analytics?month=${selectedMonth}&year=${y}`, { credentials: "include" });
      if (res.ok) {
        const raw = await res.json();
        const weeks = getWeeksOfMonth(selectedMonth);
        const allRes = await fetch(`/api/expenses?limit=1000&dateFrom=${monthStart}&dateTo=${monthEnd}`, { credentials: "include" });
        const allData = allRes.ok ? await allRes.json() : { expenses: [] };
        const allExp: Expense[] = allData.expenses ?? [];

        const weeklyExpenses = weeks.map(({ label, start, end }) => {
          const total = allExp
            .filter(e => { const d = new Date(e.expenseDate); return d >= start && d <= end; })
            .reduce((s, e) => s + e.amount, 0);
          return { week: label, label, total: Math.round(total * 100) / 100 };
        });

        const totalMonthly = allExp.reduce((s, e) => s + e.amount, 0);
        const catMap: Record<string, number> = {};
        allExp.forEach(e => { catMap[e.category] = (catMap[e.category] ?? 0) + e.amount; });
        const highestCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";
        const categoryDistribution = Object.entries(catMap)
          .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
          .sort((a, b) => b.value - a.value);

        setAnalytics({
          overview: {
            totalMonthly:    Math.round(totalMonthly * 100) / 100,
            totalYearly:     raw.overview?.totalYearly ?? 0,
            totalWeekly:     raw.overview?.totalWeekly ?? 0,
            highestCategory,
          },
          monthlyTrend:        raw.monthlyTrend ?? [],
          categoryDistribution,
          weeklyExpenses,
        });
      }
    } catch { /* ignore */ }
    finally { setALoading(false); }
  }, [isAdmin, selectedMonth, monthStart, monthEnd]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status === "authenticated" && role !== "DOCTOR") {
      fetchExpenses(1); setPage(1); fetchAllMonthExpenses();
    }
  }, [status, role, selectedMonth, fetchExpenses, fetchAllMonthExpenses]);

  useEffect(() => {
    if (status === "authenticated" && isAdmin) fetchAnalytics();
  }, [status, isAdmin, selectedMonth, fetchAnalytics]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => { fetchExpenses(1); setPage(1); }, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search]); // eslint-disable-line

  // ── CRUD ───────────────────────────────────────────────────────────────────
  async function handleAdd(form: FormData) {
    const res = await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
    await fetchExpenses(page); await fetchAnalytics(); await fetchAllMonthExpenses();
  }
  async function handleEdit(id: string, form: FormData) {
    const res = await fetch(`/api/expenses/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error ?? "Failed"); }
    await fetchExpenses(page); await fetchAnalytics(); await fetchAllMonthExpenses();
  }
  async function handleDelete(id: string) {
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    await fetchExpenses(page); await fetchAnalytics(); await fetchAllMonthExpenses();
  }

  const hasActiveFilters = !!(category || paymentMode);
  const axisProps = {
    axisLine: false as const, tickLine: false as const,
    tick: { fontSize: 11, fill: "#9ca3af", fontWeight: 600 as const },
  };

  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: B.bg }}>
      <div className="w-8 h-8 border-2 border-gray-200 border-t-orange-600 rounded-full animate-spin" />
    </div>
  );
  if (role === "DOCTOR") return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 sm:p-6" style={{ background: B.bg }}>
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
                style={{ background: B.primary }}>
                <DollarSign size={16} className="text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: B.primary }}>
                Expenses
              </h1>
            </div>
            <p className="text-xs sm:text-sm ml-[42px] text-gray-500">
              Clinic expense management {isAdmin ? "· Finance analytics enabled" : "· Add & view expenses"}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <select
                value={selectedMonth}
                onChange={e => { setSelectedMonth(e.target.value); setPage(1); }}
                className="text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-orange-400 cursor-pointer"
              >
                {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Live badge */}
            <div className="flex items-center gap-2 border rounded-xl px-3 py-2 text-xs font-bold shadow-sm"
              style={{ background: B.green + "15", borderColor: B.green + "40", color: B.green }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: B.green }} />
              Live
            </div>

            {isAdmin && (
              <DownloadButton expenses={allMonthExp} analytics={analytics} month={selectedMonth} />
            )}

            <button
              onClick={() => setModal({ type: "add" })}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all"
              style={{ background: B.primary }}
            >
              <PlusCircle size={15} />
              Add Expense
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard loading={aLoading && isAdmin}
            label={`${monthLabel(selectedMonth).split(" ")[0]} Total`}
            value={fmt(analytics?.overview.totalMonthly ?? 0)}
            sub="This month" color={B.primary} icon={<Calendar size={16} />} />
          <StatCard loading={aLoading && isAdmin}
            label="Yearly Total"
            value={fmt(analytics?.overview.totalYearly ?? 0)}
            sub={`${selectedMonth.split("-")[0]} cumulative`} color={B.teal} icon={<TrendingUp size={16} />} />
          <StatCard loading={aLoading && isAdmin}
            label="This Week"
            value={fmt(analytics?.overview.totalWeekly ?? 0)}
            sub="7-day spending" color={B.accent} icon={<DollarSign size={16} />} />
          <StatCard loading={aLoading && isAdmin}
            label="Top Category"
            value={CAT_LABELS[analytics?.overview.highestCategory ?? ""] ?? analytics?.overview.highestCategory ?? "—"}
            sub="Highest spend area"
            color={CAT_COLORS[analytics?.overview.highestCategory ?? ""] ?? B.muted}
            icon={<Tag size={16} />} />
        </div>

        {/* Analytics — Admin only */}
        {isAdmin && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Monthly Trend */}
              <div className="lg:col-span-2">
                <SectionCard
                  title="Monthly Expense Trend"
                  subtitle={`12-month overview for ${selectedMonth.split("-")[0]}`}
                >
                  {aLoading ? <Skeleton className="h-52 w-full" /> :
                    analytics?.monthlyTrend?.some(m => m.total > 0) ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={analytics.monthlyTrend} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={B.primary} stopOpacity={0.15} />
                              <stop offset="95%" stopColor={B.primary} stopOpacity={0.01} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="month" {...axisProps} />
                          <YAxis {...axisProps}
                            tickFormatter={v => `₹${v >= 1000 ? Math.round(v / 1000) + "k" : v}`} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="total" name="Total Expenses"
                            stroke={B.primary} fill="url(#gExpense)" strokeWidth={2.5}
                            dot={{ r: 4, fill: B.primary, strokeWidth: 2, stroke: "#fff" }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : <EmptyChart message="No expense data yet" />}
                </SectionCard>
              </div>

              {/* Category Pie — v3-safe component */}
              <SectionCard
                title="By Category"
                subtitle={`Distribution — ${monthLabel(selectedMonth)}`}
              >
                {aLoading ? <Skeleton className="h-52 w-full" /> :
                  (analytics?.categoryDistribution?.length ?? 0) > 0
                    ? <CategoryPieChart data={analytics!.categoryDistribution} />
                    : <EmptyChart message="No data for this month" />}
              </SectionCard>
            </div>

            {/* Weekly Bar */}
            <SectionCard
              title={`Weekly Spending — ${monthLabel(selectedMonth)}`}
              subtitle="Week-by-week breakdown of selected month"
            >
              {aLoading ? <Skeleton className="h-44 w-full" /> :
                analytics?.weeklyExpenses?.some(w => w.total > 0) ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analytics.weeklyExpenses} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="week" {...axisProps}
                        tickFormatter={v => { const m = String(v).match(/^(W\d+)/); return m ? m[1] : String(v); }} />
                      <YAxis {...axisProps}
                        tickFormatter={v => `₹${v >= 1000 ? Math.round(v / 1000) + "k" : v}`} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const entry = payload[0];
                          const row = analytics.weeklyExpenses.find(w => w.total === entry.value);
                          return (
                            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-3 text-xs min-w-[160px]">
                              <p className="font-bold text-gray-800 mb-1">{row?.label ?? entry.name}</p>
                              <p className="font-black" style={{ color: B.accent }}>
                                {fmt(Number(entry.value ?? 0))}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="total" name="Expenses" radius={[6, 6, 0, 0]}>
                        {analytics.weeklyExpenses.map((entry, i) => {
                          const max = Math.max(...analytics.weeklyExpenses.map(w => w.total), 1);
                          const intensity = entry.total / max;
                          const color = entry.total === 0 ? "#e5e7eb"
                            : intensity > 0.7 ? B.primary
                            : intensity > 0.4 ? B.accent : B.teal;
                          return <Cell key={i} fill={color} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyChart message={`No expenses in ${monthLabel(selectedMonth)}`} />}
            </SectionCard>
          </>
        )}

        {/* Expense Table */}
        <SectionCard
          title="Expense Records"
          subtitle={`${pagination.total} records · ${monthLabel(selectedMonth)}`}
          action={
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors
                ${hasActiveFilters
                  ? "bg-orange-50 border-orange-200 text-orange-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"}`}
            >
              <Filter size={12} />
              Filters
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center">!</span>
              )}
            </button>
          }
        >
          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by title or description…"
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all" />
            </div>
          </div>

          {/* Filters */}
          {showFilters && (
            <div className="mb-4 p-4 rounded-2xl border border-gray-200 bg-gray-50 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="">All</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Payment Mode</label>
                <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none">
                  <option value="">All</option>
                  {PAY_MODES.map(p => <option key={p} value={p}>{PM_LABELS[p]}</option>)}
                </select>
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setCategory(""); setPaymentMode(""); setShowFilters(false);
                    setTimeout(() => { fetchExpenses(1); setPage(1); }, 0);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                  Clear
                </button>
                <button onClick={() => { fetchExpenses(1); setPage(1); setShowFilters(false); }}
                  className="px-4 py-1.5 text-xs font-bold text-white rounded-xl hover:opacity-90 transition-all"
                  style={{ background: B.primary }}>
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Table / Cards */}
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <DollarSign size={24} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No expenses found</p>
              <p className="text-xs text-gray-400 mt-1">for {monthLabel(selectedMonth)}</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto -mx-2">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Title","Category","Amount","Payment Mode","Date","Created By","Actions"].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-3 py-3">
                          <p className="font-semibold text-gray-800 truncate max-w-[160px]">{e.title}</p>
                          {e.description && (
                            <p className="text-xs text-gray-400 truncate max-w-[160px]">{e.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-3"><CategoryBadge cat={e.category} /></td>
                        <td className="px-3 py-3"><span className="font-bold text-gray-800">{fmt(e.amount)}</span></td>
                        <td className="px-3 py-3"><PayBadge mode={e.paymentMode} /></td>
                        <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(e.expenseDate)}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-md text-[9px] font-black text-white flex items-center justify-center flex-shrink-0"
                              style={{ background: B.primary }}>
                              {e.createdBy?.name?.split(" ").map(n => n[0]).join("").slice(0,2)}
                            </div>
                            <span className="text-xs text-gray-600 truncate max-w-[80px]">{e.createdBy?.name}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setModal({ type: "view", expense: e })}
                              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-blue-50 flex items-center justify-center transition-colors" title="View">
                              <Eye size={12} className="text-blue-600" />
                            </button>
                            {isAdmin && (
                              <>
                                <button onClick={() => setModal({ type: "edit", expense: e })}
                                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-orange-50 flex items-center justify-center transition-colors" title="Edit">
                                  <Pencil size={12} className="text-orange-600" />
                                </button>
                                <button onClick={() => setModal({ type: "delete", expense: e })}
                                  className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-50 flex items-center justify-center transition-colors" title="Delete">
                                  <Trash2 size={12} className="text-red-600" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {expenses.map(e => (
                  <div key={e.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 truncate">{e.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(e.expenseDate)}</p>
                      </div>
                      <span className="text-base font-black whitespace-nowrap" style={{ color: B.primary }}>
                        {fmt(e.amount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <CategoryBadge cat={e.category} /><PayBadge mode={e.paymentMode} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{e.createdBy?.name}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ type: "view", expense: e })}
                          className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                          <Eye size={12} className="text-blue-600" />
                        </button>
                        {isAdmin && (
                          <>
                            <button onClick={() => setModal({ type: "edit", expense: e })}
                              className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                              <Pencil size={12} className="text-orange-600" />
                            </button>
                            <button onClick={() => setModal({ type: "delete", expense: e })}
                              className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
                              <Trash2 size={12} className="text-red-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                  <p className="text-xs text-gray-500">
                    {(pagination.page - 1) * pagination.limit + 1}–
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setPage(p => p - 1); fetchExpenses(page - 1); }} disabled={page === 1}
                      className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50 transition-colors">
                      <ChevronLeft size={14} />
                    </button>
                    <span className="flex items-center px-3 text-sm font-semibold text-gray-600">
                      {page} / {pagination.totalPages}
                    </span>
                    <button onClick={() => { setPage(p => p + 1); fetchExpenses(page + 1); }} disabled={page === pagination.totalPages}
                      className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center disabled:opacity-40 hover:bg-gray-50 transition-colors">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </SectionCard>

      </div>

      {/* Modals */}
      {modal?.type === "add" && (
        <ExpenseModal mode="add" initial={{}} onClose={() => setModal(null)} onSave={handleAdd} />
      )}
      {modal?.type === "edit" && modal.expense && (
        <ExpenseModal mode="edit" initial={modal.expense} onClose={() => setModal(null)}
          onSave={form => handleEdit(modal.expense!.id, form)} />
      )}
      {modal?.type === "view" && modal.expense && (
        <ExpenseModal mode="view" initial={modal.expense} onClose={() => setModal(null)} onSave={async () => {}} />
      )}
      {modal?.type === "delete" && modal.expense && (
        <DeleteModal expense={modal.expense} onClose={() => setModal(null)}
          onConfirm={() => handleDelete(modal.expense!.id)} />
      )}
    </div>
  );
}