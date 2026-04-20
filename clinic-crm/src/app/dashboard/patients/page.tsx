"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type Patient = {
  id: string; patientCode: string; name: string;
  phone: string; email: string; status: string;
  createdAt: string;
  appointments: { startTime: string }[];
  _count: { appointments: number };
};

const BLANK_PATIENT = {
  name: "", phone: "", email: "", age: "",
  gender: "", address: "", purposeOfVisit: "", medicalConditions: ""
};

const BLANK_DOCTOR = { name: "", email: "", password: "" };

export default function PatientsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // New patient form
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [patientForm, setPatientForm] = useState(BLANK_PATIENT);
  const [savingPatient, setSavingPatient] = useState(false);
  const [patientSuccess, setPatientSuccess] = useState("");

  // Add doctor form
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [doctorForm, setDoctorForm] = useState(BLANK_DOCTOR);
  const [savingDoctor, setSavingDoctor] = useState(false);
  const [doctorSuccess, setDoctorSuccess] = useState("");
  const [doctorError, setDoctorError] = useState("");

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadPatients() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/patients?${params.toString()}`, { credentials: "include" });
      const text = await res.text();
      if (!text) { setPatients([]); setLoading(false); return; }
      const data = JSON.parse(text);
      setPatients(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load patients", e);
      setPatients([]);
    }
    setLoading(false);
  }

  useEffect(() => { loadPatients(); }, [search, statusFilter]);

  // ── Register new patient ──
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
      const text = await res.text();
      if (!text) { setSavingPatient(false); alert("Server returned empty response"); return; }
      const data = JSON.parse(text);
      if (res.ok) {
        setPatientSuccess(`✅ Patient registered! ID: ${data.patientCode}`);
        setShowPatientForm(false);
        setPatientForm(BLANK_PATIENT);
        loadPatients();
        setTimeout(() => setPatientSuccess(""), 5000);
      } else {
        alert(`Error: ${data.error ?? "Registration failed"}`);
      }
    } catch (err) {
      console.error("Register error:", err);
      alert("Network error — check console");
    }
    setSavingPatient(false);
  }

  // ── Add doctor ──
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
        setDoctorSuccess(`✅ Dr. ${data.name} added successfully.`);
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

  // ── Delete patient ──
  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/patients/${confirmDelete.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setConfirmDelete(null);
        loadPatients();
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.error ?? "Unknown error"}`);
      }
    } catch {
      alert("Network error during delete");
    }
    setDeleting(false);
  }

  return (
    <div className="p-6">
      {/* ── Delete confirmation modal ── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-100 p-6 w-80 shadow-lg">
            <div className="text-sm font-semibold text-gray-900 mb-2">Delete patient?</div>
            <p className="text-xs text-gray-500 mb-4">
              This will permanently remove <span className="font-medium text-gray-800">{confirmDelete.name}</span> and
              all their appointments and visit records from the database. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded-lg disabled:opacity-50 transition-colors">
                {deleting ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-500 text-sm py-2 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Patient registry</h1>
          <p className="text-sm text-gray-400 mt-0.5">Search, register, and manage patients</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => { setShowDoctorForm(!showDoctorForm); setShowPatientForm(false); }}
              className="border border-teal-200 text-teal-700 hover:bg-teal-50 text-sm px-4 py-2 rounded-lg transition-colors">
              + Add doctor
            </button>
          )}
          <button
            onClick={() => { setShowPatientForm(!showPatientForm); setShowDoctorForm(false); }}
            className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
            + New patient
          </button>
        </div>
      </div>

      {/* ── Success banners ── */}
      {patientSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">{patientSuccess}</div>
      )}
      {doctorSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-700">{doctorSuccess}</div>
      )}

      {/* ── Add doctor form ── */}
      {showDoctorForm && (
        <div className="bg-white rounded-xl border border-teal-100 p-5 mb-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Add new doctor</h2>
          {doctorError && <div className="mb-3 p-3 bg-red-50 rounded-lg text-sm text-red-600">{doctorError}</div>}
          <form onSubmit={handleAddDoctor}>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Full name (with Dr.) *</label>
                <input
                  required
                  value={doctorForm.name}
                  onChange={e => setDoctorForm({ ...doctorForm, name: e.target.value })}
                  placeholder="e.g. Dr. Sayalee Pethe"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={doctorForm.email}
                  onChange={e => setDoctorForm({ ...doctorForm, email: e.target.value })}
                  placeholder="doctor@clinic.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Temporary password *</label>
                <input
                  required
                  type="password"
                  value={doctorForm.password}
                  onChange={e => setDoctorForm({ ...doctorForm, password: e.target.value })}
                  placeholder="Min 8 characters"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingDoctor}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                {savingDoctor ? "Adding..." : "Add doctor"}
              </button>
              <button type="button" onClick={() => setShowDoctorForm(false)}
                className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── New patient form ── */}
      {showPatientForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Register new patient</h2>
          <form onSubmit={handleRegisterPatient}>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Full name *</label>
                <input required value={patientForm.name} onChange={e => setPatientForm({ ...patientForm, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Rahul Sharma" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Phone number *</label>
                <input required value={patientForm.phone} onChange={e => setPatientForm({ ...patientForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email</label>
                <input type="email" value={patientForm.email} onChange={e => setPatientForm({ ...patientForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="email@example.com" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Age *</label>
                <input required type="number" value={patientForm.age} onChange={e => setPatientForm({ ...patientForm, age: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. 35" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Gender *</label>
                <select required value={patientForm.gender} onChange={e => setPatientForm({ ...patientForm, gender: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Address</label>
                <input value={patientForm.address} onChange={e => setPatientForm({ ...patientForm, address: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Full address" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Purpose of visit *</label>
                <input required value={patientForm.purposeOfVisit} onChange={e => setPatientForm({ ...patientForm, purposeOfVisit: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Lower back pain, knee injury rehabilitation..." />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Medical conditions / history</label>
                <textarea rows={2} value={patientForm.medicalConditions} onChange={e => setPatientForm({ ...patientForm, medicalConditions: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                  placeholder="Diabetes, hypertension, previous surgeries..." />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={savingPatient}
                className="bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                {savingPatient ? "Registering..." : "Generate ID & register"}
              </button>
              <button type="button" onClick={() => setShowPatientForm(false)}
                className="border border-gray-200 text-gray-500 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Patient list ── */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex gap-3 mb-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            placeholder="Search by name, phone, or patient ID..." />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">All status</option>
            <option value="NEW">New</option>
            <option value="RETURNING">Returning</option>
          </select>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-100">
              <th className="text-left pb-2 font-medium">Patient ID</th>
              <th className="text-left pb-2 font-medium">Name</th>
              <th className="text-left pb-2 font-medium">Phone</th>
              <th className="text-left pb-2 font-medium">Sessions</th>
              <th className="text-left pb-2 font-medium">Last visit</th>
              <th className="text-left pb-2 font-medium">Status</th>
              <th className="text-left pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
            ) : patients.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-gray-400 text-sm">No patients found</td></tr>
            ) : patients.map(p => (
              <tr key={p.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="py-2.5 text-xs text-gray-400 font-mono">{p.patientCode}</td>
                <td className="py-2.5 text-gray-900 font-medium">{p.name}</td>
                <td className="py-2.5 text-gray-500 text-xs">{p.phone}</td>
                <td className="py-2.5 text-gray-500">{p._count.appointments}</td>
                <td className="py-2.5 text-xs text-gray-400">
                  {p.appointments?.[0]
                    ? new Date(p.appointments[0].startTime).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                    : "—"}
                </td>
                <td className="py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${p.status === "NEW" ? "bg-blue-50 text-blue-600" : "bg-teal-50 text-teal-700"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-2 items-center">
                    <Link href={`/dashboard/patients/${p.id}`}
                      className="text-xs text-teal-600 hover:text-teal-800 border border-teal-100 px-2 py-1 rounded-lg">
                      View
                    </Link>
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDelete({ id: p.id, name: p.name })}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-100 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                        Remove
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}