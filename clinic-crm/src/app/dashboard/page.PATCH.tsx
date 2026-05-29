// src/app/dashboard/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PATCH INSTRUCTIONS
// ─────────────────────────────────────────────────────────────────────────────
// This file contains ONLY the changed sections. Apply them to the existing
// src/app/dashboard/page.tsx as described in the inline comments.
//
// Three changes total:
//   1. Add `patientsMeta` to the DashboardData type
//   2. Add pagination state + load function in AdminDashboard
//   3. Replace the PatientTable component with the paginated version
//
// Everything else in the file stays the same.
// ─────────────────────────────────────────────────────────────────────────────

// ════════════════════════════════════════════════════════════════════
// CHANGE 1 — Update the DashboardData type
// Replace the existing DashboardData type with this one.
// ════════════════════════════════════════════════════════════════════

/*

type DashboardData = {
  totalPatients: number;
  newPatients: number;
  returningPatients: number;
  todayTotal: number;
  missedWeek: number;
  confirmedUpcoming: number;
  todayAppointments: Appointment[];
  recentAppointments: Appointment[];
  weekCounts: number[];
  allPatients: Patient[];
  // ── NEW ──────────────────────────────────────────────────────────
  patientsMeta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

*/

// ════════════════════════════════════════════════════════════════════
// CHANGE 2 — Replace the AdminDashboard state block + useEffect
//
// Find this block in the file (starts with "export default function AdminDashboard"):
//
//   const [data, setData]   = useState<DashboardData | null>(null);
//   ...
//   useEffect(() => {
//     fetch("/api/admin/dashboard")
//       .then(...)
//   }, []);
//
// Replace it with the block below.
// ════════════════════════════════════════════════════════════════════

/*

  const router = useRouter();
  const [data, setData]                       = useState<DashboardData | null>(null);
  const [activeFilter, setActiveFilter]       = useState<ActiveFilter>(null);
  const [selectedDay, setSelectedDay]         = useState<number | null>(null);
  const [dayAppointments, setDayAppointments] = useState<Appointment[]>([]);
  const [loadingDay, setLoadingDay]           = useState(false);

  // ── Pagination state for the patient table ────────────────────────────────
  const [patientPage,   setPatientPage]   = useState(1);
  const [patientSearch, setPatientSearch] = useState("");
  const [loadingPts,    setLoadingPts]    = useState(false);

  // ── Fetch (or re-fetch) dashboard data, including paginated patient list ──
  async function loadDashboard(page: number, search: string) {
    setLoadingPts(true);
    try {
      const params = new URLSearchParams({
        page:  String(page),
        limit: "50",
        ...(search ? { search } : {}),
      });
      const r = await fetch(`/api/admin/dashboard?${params}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const raw = await r.json();
      setData({
        ...raw,
        todayAppointments:  toAppointmentArray(raw.todayAppointments),
        recentAppointments: toAppointmentArray(raw.recentAppointments),
        allPatients:        toPatientArray(raw.allPatients),
        weekCounts:         Array.isArray(raw.weekCounts) ? raw.weekCounts : [0,0,0,0,0,0,0],
        patientsMeta:       raw.patientsMeta ?? { total: 0, page: 1, limit: 50, totalPages: 1 },
      });
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoadingPts(false);
    }
  }

  // Initial load
  useEffect(() => {
    loadDashboard(1, "");
  }, []);

  // Re-fetch when page or search changes (skip on first render — handled above)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    loadDashboard(patientPage, patientSearch);
  }, [patientPage, patientSearch]);

  // Debounced search — reset to page 1 on new query
  function handlePatientSearch(term: string) {
    setPatientSearch(term);
    setPatientPage(1);
  }

*/

// NOTE: also add `useRef` to the import at the top of the file:
//   import { useEffect, useRef, useState } from "react";


// ════════════════════════════════════════════════════════════════════
// CHANGE 3 — Replace the PatientTable component
//
// Find the existing PatientTable function (starts around line 171):
//   function PatientTable({ patients, filterStatus }: { ... }) { ... }
//
// Replace the entire function with this new version, which accepts
// pagination props and renders prev/next controls.
// ════════════════════════════════════════════════════════════════════

// ── Copy this component into the file, replacing the old PatientTable ─────────

function PatientTablePaginated({
  patients,
  filterStatus,
  meta,
  onPageChange,
  onSearch,
  loading,
}: {
  patients: { id: string; name: string; patientCode: string; status: "NEW" | "RETURNING"; _count?: { appointments: number } }[];
  filterStatus?: "NEW" | "RETURNING";
  meta?: { total: number; page: number; limit: number; totalPages: number };
  onPageChange?: (page: number) => void;
  onSearch?: (term: string) => void;
  loading?: boolean;
}) {
  const BRAND = {
    primary:     "#5B1A0E",
    accent:      "#D46A2E",
    bg:          "#F5F1E8",
    border:      "#E8E0D0",
    surface:     "#FFFFFF",
  };

  const safePatients = Array.isArray(patients) ? patients : [];
  const list = filterStatus
    ? safePatients.filter(p => p.status === filterStatus)
    : safePatients;

  return (
    <div>
      {/* Search bar — only shown when no filterStatus override */}
      {!filterStatus && onSearch && (
        <div style={{ marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="Search by name, phone, or patient ID…"
            onChange={e => onSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: "13px",
              border: `1px solid ${BRAND.border}`,
              borderRadius: "8px",
              outline: "none",
              background: BRAND.surface,
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ padding: "2.5rem", textAlign: "center" }}>
          <div style={{
            width: "28px", height: "28px", margin: "0 auto",
            border: `3px solid ${BRAND.border}`,
            borderTopColor: BRAND.accent,
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : list.length === 0 ? (
        <div style={{ padding: "2.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "14px", color: "#94a3b8", margin: 0 }}>No patients found</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: "480px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: BRAND.bg, borderBottom: `1px solid ${BRAND.border}` }}>
                {["Patient ID", "Name", "Status", "Sessions", ""].map(h => (
                  <th key={h} style={{
                    textAlign: "left", padding: "10px 14px",
                    fontSize: "10px", fontWeight: 700,
                    color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, idx) => (
                <tr key={p.id} style={{
                  borderBottom: `1px solid ${BRAND.border}`,
                  background: idx % 2 === 0 ? BRAND.surface : "transparent",
                }}>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      fontFamily: "monospace", fontSize: "11px", fontWeight: 600,
                      color: "#94a3b8", background: "#f1f5f9",
                      padding: "2px 8px", borderRadius: "6px",
                    }}>{p.patientCode}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>{p.name}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: "5px",
                      fontSize: "11px", fontWeight: 600, padding: "3px 10px",
                      borderRadius: "999px",
                      ...(p.status === "NEW"
                        ? { background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd" }
                        : { background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3" }),
                    }}>
                      <span style={{
                        width: "6px", height: "6px", borderRadius: "50%",
                        background: p.status === "NEW" ? "#0ea5e9" : "#fb7185",
                      }} />
                      {p.status === "NEW" ? "New" : "Returning"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#334155" }}>
                      {p._count?.appointments ?? "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <a href={`/dashboard/patients/${p.id}`} style={{
                      display: "inline-flex", alignItems: "center", gap: "4px",
                      fontSize: "11px", fontWeight: 600, color: "#0f766e",
                      background: "#f0fdfa", border: "1px solid #99f6e4",
                      padding: "5px 12px", borderRadius: "6px",
                      textDecoration: "none",
                    }}>
                      View
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {meta && meta.totalPages > 1 && onPageChange && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 4px 0",
          borderTop: `1px solid ${BRAND.border}`,
          marginTop: "8px",
        }}>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            Showing {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} patients
          </p>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={() => onPageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              style={{
                padding: "5px 12px", fontSize: "12px", fontWeight: 600,
                borderRadius: "7px", cursor: meta.page <= 1 ? "not-allowed" : "pointer",
                background: meta.page <= 1 ? "#f8fafc" : BRAND.surface,
                color: meta.page <= 1 ? "#cbd5e1" : "#334155",
                border: `1px solid ${meta.page <= 1 ? "#e2e8f0" : BRAND.border}`,
              }}
            >
              ← Prev
            </button>
            <span style={{
              padding: "5px 12px", fontSize: "12px", fontWeight: 700,
              background: BRAND.bg, borderRadius: "7px",
              border: `1px solid ${BRAND.border}`, color: "#334155",
            }}>
              {meta.page} / {meta.totalPages}
            </span>
            <button
              onClick={() => onPageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              style={{
                padding: "5px 12px", fontSize: "12px", fontWeight: 600,
                borderRadius: "7px",
                cursor: meta.page >= meta.totalPages ? "not-allowed" : "pointer",
                background: meta.page >= meta.totalPages ? "#f8fafc" : BRAND.surface,
                color: meta.page >= meta.totalPages ? "#cbd5e1" : "#334155",
                border: `1px solid ${meta.page >= meta.totalPages ? "#e2e8f0" : BRAND.border}`,
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CHANGE 4 — Update the call sites for PatientTable inside the JSX
//
// Find every <PatientTable ... /> usage inside AdminDashboard's JSX
// and replace as shown below.
// ════════════════════════════════════════════════════════════════════

// BEFORE (3 occurrences in the file):
//
//   <PatientTable patients={allPatients} />
//   <PatientTable patients={allPatients} filterStatus="NEW" />
//   <PatientTable patients={allPatients} filterStatus="RETURNING" />
//
//
// AFTER:
//
//   {/* All patients panel */}
//   <PatientTablePaginated
//     patients={allPatients}
//     meta={data.patientsMeta}
//     loading={loadingPts}
//     onPageChange={page => setPatientPage(page)}
//     onSearch={handlePatientSearch}
//   />
//
//   {/* New patients panel */}
//   <PatientTablePaginated
//     patients={allPatients}
//     filterStatus="NEW"
//   />
//
//   {/* Returning patients panel */}
//   <PatientTablePaginated
//     patients={allPatients}
//     filterStatus="RETURNING"
//   />
//
// ════════════════════════════════════════════════════════════════════

export {};  // satisfies TypeScript — remove this line when applying the patch