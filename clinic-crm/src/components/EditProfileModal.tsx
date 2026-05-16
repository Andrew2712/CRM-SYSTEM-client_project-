"use client";

/**
 * src/components/EditProfileModal.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable modal for editing Patient OR Staff profiles.
 */

import { useState } from "react";
import { X, Save, Loader2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientFields {
  name?: string;
  phone?: string;
  email?: string;
  age?: number | string;
  gender?: string;
  address?: string;
  purposeOfVisit?: string;
  medicalConditions?: string;
  phase?: string;
  totalSessionsPlanned?: number | string;
}

interface StaffFields {
  name?: string;
  phone?: string;
  email?: string;
}

interface EditProfileModalProps {
  type: "patient" | "staff";
  entityId: string;
  initialData: PatientFields | StaffFields;
  userRole: string;
  onClose: () => void;
  onSuccess: (updated: Record<string, unknown>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EditProfileModal({
  type,
  entityId,
  initialData,
  userRole,
  onClose,
  onSuccess,
}: EditProfileModalProps) {
  const [form, setForm]     = useState({ ...initialData });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // RECEPTIONIST can only edit basic fields; ADMIN/DOCTOR can edit clinical fields too
  const canEditClinical = ["ADMIN", "DOCTOR"].includes(userRole);
  const canEditEmail    = userRole === "ADMIN";

  const apiPath = type === "patient"
    ? `/api/patients/${entityId}`
    : `/api/staff/${entityId}`;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(apiPath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
        return;
      }

      // Patient API returns the patient object directly (not wrapped in { user })
      // Staff API may return { user: ... } — handle both
      const data = await res.json();
      onSuccess(data.user ?? data);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            Edit {type === "patient" ? "Patient" : "Staff"} Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* ── Common fields ── */}
          <Field
            label="Name"
            name="name"
            value={(form as PatientFields).name ?? ""}
            onChange={handleChange}
          />
          <Field
            label="Phone"
            name="phone"
            value={(form as PatientFields).phone ?? ""}
            onChange={handleChange}
            type="tel"
          />

          {/* Email — ADMIN only */}
          {canEditEmail && (
            <Field
              label="Email"
              name="email"
              value={(form as PatientFields).email ?? ""}
              onChange={handleChange}
              type="email"
            />
          )}

          {/* ── Patient-only fields ── */}
          {type === "patient" && (
            <>
              <Field
                label="Age"
                name="age"
                value={String((form as PatientFields).age ?? "")}
                onChange={handleChange}
                type="number"
              />

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
                <select
                  name="gender"
                  value={(form as PatientFields).gender ?? ""}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <Field
                label="Address"
                name="address"
                value={(form as PatientFields).address ?? ""}
                onChange={handleChange}
                multiline
              />

              <Field
                label="Purpose of Visit"
                name="purposeOfVisit"
                value={(form as PatientFields).purposeOfVisit ?? ""}
                onChange={handleChange}
              />

              {/* Clinical fields — ADMIN / DOCTOR only */}
              {canEditClinical && (
                <>
                  <Field
                    label="Medical Conditions"
                    name="medicalConditions"
                    value={(form as PatientFields).medicalConditions ?? ""}
                    onChange={handleChange}
                    multiline
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phase</label>
                    <select
                      name="phase"
                      value={(form as PatientFields).phase ?? ""}
                      onChange={handleChange}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white"
                    >
                      <option value="">Select phase</option>
                      {["PHASE_1", "PHASE_2", "PHASE_3", "PHASE_4", "PHASE_5"].map((p) => (
                        <option key={p} value={p}>{p.replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>

                  <Field
                    label="Total Sessions Planned"
                    name="totalSessionsPlanned"
                    value={String((form as PatientFields).totalSessionsPlanned ?? "")}
                    onChange={handleChange}
                    type="number"
                  />
                </>
              )}
            </>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Field helper ─────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  multiline = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  multiline?: boolean;
}) {
  const sharedCls =
    "w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white";
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          rows={2}
          className={`${sharedCls} resize-none`}
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          className={sharedCls}
        />
      )}
    </div>
  );
}