"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Patient = {
  id: string;
  patientCode: string;
  name: string;
  phone: string;
  email: string;
  age?: number;
  gender?: string;
  address?: string;
  purposeOfVisit?: string;
  medicalConditions?: string;
  status: string;
  phase?: string;
  totalSessionsPlanned?: number;
  createdAt: string;
  appointments: { startTime: string }[];
  _count: { appointments: number };
};

const BLANK_PATIENT = {
  name: "", phone: "", email: "", age: "",
  gender: "", address: "", purposeOfVisit: "", medicalConditions: "",
};
const BLANK_DOCTOR = { name: "", email: "", password: "" };

const STATUS_CONFIG: Record<string, { pill: string; dot: string; label: string }> = {
  NEW:        { pill: "bg-sky-50 text-sky-700 border border-sky-200",       dot: "bg-sky-400",     label: "New" },
  RETURNING:  { pill: "bg-teal-50 text-teal-700 border border-teal-200",    dot: "bg-teal-500",    label: "Returning" },
  DISCHARGED: { pill: "bg-slate-100 text-slate-500 border border-slate-200",dot: "bg-slate-400",   label: "Discharged" },
  INACTIVE:   { pill: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-400",   label: "Inactive" },
};

const PHASE_CONFIG: Record<string, { short: string; color: string }> = {
  PHASE_1: { short: "P1", color: "bg-violet-100 text-violet-700" },
  PHASE_2: { short: "P2", color: "bg-blue-100 text-blue-700" },
  PHASE_3: { short: "P3", color: "bg-teal-100 text-teal-700" },
  PHASE_4: { short: "P4", color: "bg-emerald-100 text-emerald-700" },
  PHASE_5: { short: "P5", color: "bg-amber-100 text-amber-700" },
};

// ── Google Sheets CSV export ──────────────────────────────────────────────────
function exportToGoogleSheets(patients: Patient[]) {
  const headers = [
    "Patient ID", "Name", "Phone", "Email", "Age", "Gender",
    "Address", "Purpose of Visit", "Medical Conditions",
    "Status", "Phase", "Sessions Planned", "Sessions Attended",
    "Last Visit", "Registered On",
  ];

  const rows = patients.map((p) => [
    p.patientCode,
    p.name,
    p.phone,
    p.email ?? "",
    p.age ?? "",
    p.gender ?? "",
    p.address ?? "",
    p.purposeOfVisit ?? "",
    p.medicalConditions ?? "",
    p.status,
    p.phase ?? "Not assigned",
    p.totalSessionsPlanned ?? 0,
    p._count.appointments,
    p.appointments?.[0]
      ? new Date(p.appointments[0].startTime).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric",
        })
      : "—",
    new Date(p.createdAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    }),
  ]);

  // Build CSV string with BOM for Excel/Sheets compatibility
  const BOM = "\uFEFF";
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv =
    BOM +
    [headers, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const date = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).replace(/ /g, "-");
  link.download = `Patient-Registry-${date}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Field component ───────────────────────────────────────────────────────────
function Field({
  label, required: req, children,
}: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {req && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all";

export default function PatientsPage() {
  const { data: session } = useSession();
const isAdmin = session?.user?.role === "ADMIN";

// ✅ ADD THIS HERE
const role = session?.user?.role ?? "";

function maskPhone(phone: string): string {
  if (role === "ADMIN") return phone;
  if (role === "DOCTOR") return `••••••${phone.slice(-4)}`;
  return phone;
}

  const [patients, setPatients] = useState<Patient[]>([]);
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientForm, setPatientForm] = useState(BLANK_PATIENT);
  const [savingPatient, setSavingPatient] = useState(false);
  const [patientSuccess, setPatientSuccess] = useState("");

  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [doctorForm, setDoctorForm] = useState(BLANK_DOCTOR);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorSuccess, setDoctorSuccess] = useState("");
  const [doctorError, setDoctorError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  // Load filtered patients (for display)
  async function loadPatients() {
  setLoading(true);
  try {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/patients?${params.toString()}`, {
      credentials: "include",
    });

    const text = await res.text();
    if (!text) {
      setPatients([]);
      setLoading(false);
      return;
    }

    const data = JSON.parse(text);

    const sorted = Array.isArray(data)
      ? data.sort(
          (a: Patient, b: Patient) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        )
      : [];

    setPatients(sorted);
  } catch (e) {
    console.error("Failed to load patients", e);
    setPatients([]);
  }
  setLoading(false);
}

  // Load ALL patients (for export — no filters)
  async function loadAllPatients() {
  try {
    const res = await fetch(`/api/patients`, {
      credentials: "include",
    });

    const text = await res.text();
    if (!text) return;

    const data = JSON.parse(text);

    const sorted = Array.isArray(data)
      ? data.sort(
          (a: Patient, b: Patient) =>
            new Date(a.createdAt).getTime() -
            new Date(b.createdAt).getTime()
        )
      : [];

    setAllPatients(sorted);
  } catch (e) {
    console.error("Failed to load all patients", e);
  }
}

  useEffect(() => { loadPatients(); }, [search, statusFilter]);
  useEffect(() => { loadAllPatients(); }, []);

  async function handleExport() {
    setExporting(true);
    // Always re-fetch all patients fresh before export
    try {
      const res = await fetch(`/api/patients`, { credentials: "include" });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setAllPatients(list);
      exportToGoogleSheets(list);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {
      alert("Export failed. Please try again.");
    }
    setExporting(false);
  }

  async function handleRegisterPatient(e: React.FormEvent) {
    e.preventDefault();
    setSavingPatient(true);
    setPatientSuccess("");
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patientForm),
      });
      const data = await res.json();
      if (res.ok) {
        setPatientSuccess(`Patient registered! ID: ${data.patientCode}`);
        setShowPatientForm(false);
        setPatientForm(BLANK_PATIENT);
        loadPatients();
        loadAllPatients();
        setTimeout(() => setPatientSuccess(""), 5000);
      } else {
        alert(`Error: ${data.error ?? "Registration failed"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
    setSavingPatient(false);
  }

  async function handleAddDoctor(e: React.FormEvent) {
    e.preventDefault();
    setSavingDoctor(true);
    setDoctorError("");
    setDoctorSuccess("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...doctorForm, role: "DOCTOR" }),
      });
      const data = await res.json();
      if (res.ok) {
        setDoctorSuccess(`Dr. ${data.name} added successfully.`);
        setDoctorForm(BLANK_DOCTOR);
        setShowDoctorForm(false);
        setTimeout(() => setDoctorSuccess(""), 5000);
      } else {
        setDoctorError(data.error ?? "Failed to add doctor");
      }
    } catch {
      setDoctorError("Network error");
    }
    setSavingDoctor(false);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/patients/${confirmDelete.id}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) {
        setConfirmDelete(null);
        loadPatients();
        loadAllPatients();
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      alert("Network error during delete");
    }
    setDeleting(false);
  }

  const totalNew       = patients.filter(p => p.status === "NEW").length;
  const totalReturning = patients.filter(p => p.status === "RETURNING").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 p-6">

      {/* ── Delete modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 w-full max-w-sm shadow-2xl shadow-slate-200/50">
            <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Remove patient?</h3>
            <p className="text-sm text-slate-500 mb-5 leading-relaxed">
              This will permanently remove{" "}
              <span className="font-semibold text-slate-800">{confirmDelete.name}</span> and all
              their records. This cannot be undone.
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

      {/* ── Page header ── */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-200">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Patient Registry</h1>
          </div>
          <p className="text-sm text-slate-400 ml-[42px]">Search, register, and manage all patients</p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Export to Google Sheets */}
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition-all shadow-sm ${
              exportDone
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:text-teal-700 hover:bg-teal-50 hover:shadow-md"
            }`}
          >
            {exporting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Exporting…
              </>
            ) : exportDone ? (
              <>
                <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Downloaded!
              </>
            ) : (
              <>
                {/* Google Sheets icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="16" height="20" rx="2" fill="#34A853" />
                  <rect x="7" y="8" width="10" height="1.5" rx="0.75" fill="white" />
                  <rect x="7" y="11" width="10" height="1.5" rx="0.75" fill="white" />
                  <rect x="7" y="14" width="7" height="1.5" rx="0.75" fill="white" />
                  <path d="M14 2v5h6" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                Export to Sheets
              </>
            )}
          </button>


          <button
            onClick={() => { setShowPatientForm(!showPatientForm); setShowDoctorForm(false); }}
            className="flex items-center gap-1.5 text-sm font-bold px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-all shadow-md shadow-teal-200 hover:shadow-lg hover:shadow-teal-200 hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Patient
          </button>
        </div>
      </div>

      {/* ── Summary stat chips ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-xs font-semibold text-slate-500">Total</span>
          <span className="text-sm font-black text-slate-800 ml-1">{patients.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-sky-50 border border-sky-100 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-xs font-semibold text-sky-600">New</span>
          <span className="text-sm font-black text-sky-700 ml-1">{totalNew}</span>
        </div>
        <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-4 py-2.5 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-teal-500" />
          <span className="text-xs font-semibold text-teal-600">Returning</span>
          <span className="text-sm font-black text-teal-700 ml-1">{totalReturning}</span>
        </div>
        {allPatients.length > 0 && allPatients.length !== patients.length && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 shadow-sm">
            <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 3a1 1 0 000 2h11a1 1 0 100-2H3zM3 7a1 1 0 000 2h7a1 1 0 100-2H3zM3 11a1 1 0 100 2h4a1 1 0 100-2H3z" />
            </svg>
            <span className="text-xs font-semibold text-amber-600">Filtered — {allPatients.length} total in registry</span>
          </div>
        )}
      </div>

      {/* ── Toast banners ── */}
      {patientSuccess && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-semibold text-emerald-700 shadow-sm">
          <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          {patientSuccess}
        </div>
      )}
      {doctorSuccess && (
        <div className="mb-4 flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-sm font-semibold text-emerald-700 shadow-sm">
          <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          {doctorSuccess}
        </div>
      )}

      {/* ── Add Doctor form ── */}
      {showDoctorForm && (
        <div className="bg-white rounded-2xl border border-teal-100 shadow-sm shadow-teal-50 p-6 mb-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800">Add New Doctor</h2>
          </div>
          {doctorError && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium">{doctorError}</div>
          )}
          <form onSubmit={handleAddDoctor}>
            <div className="grid grid-cols-3 gap-4 mb-5">
              <Field label="Full name (with Dr.)" required>
                <input required value={doctorForm.name}
                  onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  placeholder="e.g. Dr. Sayalee Pethe" className={inputCls} />
              </Field>
              <Field label="Email" required>
                <input required type="email" value={doctorForm.email}
                  onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })}
                  placeholder="doctor@clinic.com" className={inputCls} />
              </Field>
              <Field label="Temporary password" required>
                <input required type="password" value={doctorForm.password}
                  onChange={e => setDoctorForm({ ...doctorForm, password: e.target.value })}
                  placeholder="Min 8 characters" className={inputCls} />
              </Field>
            </div>
            <div className="flex gap-2.5">
              <button type="submit" disabled={savingDoctor}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all shadow-sm">
                {savingDoctor ? "Adding…" : "Add Doctor"}
              </button>
              <button type="button" onClick={() => setShowDoctorForm(false)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── New Patient form ── */}
      {showPatientForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 bg-teal-50 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800">Register New Patient</h2>
          </div>
          <form onSubmit={handleRegisterPatient}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Full name" required>
                <input required value={patientForm.name}
                  onChange={e => setPatientForm({ ...patientForm, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma" className={inputCls} />
              </Field>
              <Field label="Phone number" required>
                <input required value={patientForm.phone}
                  onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                  placeholder="+91 98765 43210" className={inputCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={patientForm.email}
                  onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}
                  placeholder="email@example.com" className={inputCls} />
              </Field>
              <Field label="Age" required>
                <input required type="number" value={patientForm.age}
                  onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                  placeholder="e.g. 35" className={inputCls} />
              </Field>
              <Field label="Gender" required>
                <select required value={patientForm.gender}
                  onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}
                  className={inputCls}>
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Address">
                <input value={patientForm.address}
                  onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
                  placeholder="Full address" className={inputCls} />
              </Field>
              <div className="col-span-2">
                <Field label="Purpose of visit" required>
                  <input required value={patientForm.purposeOfVisit}
                    onChange={e => setPatientForm({ ...patientForm, purposeOfVisit: e.target.value })}
                    placeholder="e.g. Lower back pain, knee injury rehabilitation…" className={inputCls} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Medical conditions / history">
                  <textarea rows={2} value={patientForm.medicalConditions}
                    onChange={e => setPatientForm({ ...patientForm, medicalConditions: e.target.value })}
                    placeholder="Diabetes, hypertension, previous surgeries…"
                    className={`${inputCls} resize-none`} />
                </Field>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button type="submit" disabled={savingPatient}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl disabled:opacity-50 transition-all shadow-sm shadow-teal-100">
                {savingPatient ? "Registering…" : "Generate ID & Register"}
              </button>
              <button type="button" onClick={() => setShowPatientForm(false)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Patient list card ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Search + filter bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, or patient ID…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all min-w-[140px]"
          >
            <option value="">All status</option>
            <option value="NEW">New</option>
            <option value="RETURNING">Returning</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-teal-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-medium">Loading patients…</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-500">No patients found</p>
            <p className="text-xs text-slate-400 mt-1">
              {search || statusFilter ? "Try adjusting your search or filters" : "Register your first patient using the button above"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {["Patient ID", "Name", "Phone", "Sessions", "Last Visit", "Phase", "Status", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((p, idx) => {
                  const statusCfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.NEW;
                  const phaseCfg = p.phase ? PHASE_CONFIG[p.phase] : null;
                  const lastVisit = p.appointments?.[0]
                    ? new Date(p.appointments[0].startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    : null;
                  const initials = p.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

                  return (
                    <tr
                      key={p.id}
                      onMouseEnter={() => setHoveredRow(p.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      className={`border-b border-slate-50 last:border-0 transition-colors ${
                        hoveredRow === p.id ? "bg-teal-50/40" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                      }`}
                    >
                      {/* Patient ID */}
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {p.patientCode}
                        </span>
                      </td>

                      {/* Name with avatar */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-black flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{p.name}</p>
                            {p.email && (
                              <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[160px]">{p.email}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4">
  <span className="text-sm font-medium text-slate-600">
    {maskPhone(p.phone)}
  </span>
</td>

                      {/* Sessions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center">
                            <span className="text-xs font-black text-slate-600">{p._count.appointments}</span>
                          </div>
                        </div>
                      </td>

                      {/* Last visit */}
                      <td className="px-5 py-4">
                        {lastVisit ? (
                          <span className="text-sm font-medium text-slate-600">{lastVisit}</span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>

                      {/* Phase */}
                      <td className="px-5 py-4">
                        {phaseCfg ? (
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${phaseCfg.color}`}>
                            {phaseCfg.short}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300 font-medium">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${statusCfg.pill}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/dashboard/patients/${p.id}`}
                            className="flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-100 px-3 py-1.5 rounded-lg transition-all">
                            View
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                          {isAdmin && (
                            <button
                              onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                              className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 px-3 py-1.5 rounded-lg transition-all"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">
                Showing <span className="font-bold text-slate-600">{patients.length}</span> patient{patients.length !== 1 ? "s" : ""}
                {(search || statusFilter) && allPatients.length > 0 && (
                  <span className="text-slate-400"> · {allPatients.length} total in registry</span>
                )}
              </p>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="16" height="20" rx="2" fill="#34A853" />
                  <rect x="7" y="8" width="10" height="1.5" rx="0.75" fill="white" />
                  <rect x="7" y="11" width="10" height="1.5" rx="0.75" fill="white" />
                  <rect x="7" y="14" width="7" height="1.5" rx="0.75" fill="white" />
                  <path d="M14 2v5h6" fill="none" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                Export all {allPatients.length > 0 ? allPatients.length : ""} patients
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}