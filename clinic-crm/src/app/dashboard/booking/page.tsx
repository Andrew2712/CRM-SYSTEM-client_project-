"use client";
import { useEffect, useState } from "react";

type Doctor = { id: string; name: string; };
type Patient = { id: string; patientCode: string; name: string; };
type Appointment = {
  id: string; startTime: string; sessionType: string; status: string;
  patient: { name: string }; doctor: { name: string };
};

export default function BookingPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [form, setForm] = useState({ patientId:"", doctorId:"", sessionType:"INITIAL_ASSESSMENT", date:"", time:"09:00" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/doctors").then(r=>r.json()).then(setDoctors);
    fetch("/api/patients").then(r=>r.json()).then(setPatients);
    fetch("/api/appointments").then(r=>r.json()).then(setUpcoming);
  }, []);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    const [year, month, day] = form.date.split("-").map(Number);
const [hour, minute] = form.time.split(":").map(Number);
const startTime = new Date(year, month - 1, day, hour, minute, 0);
const endTime = new Date(year, month - 1, day, hour + 1, minute, 0);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, startTime, endTime }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setSuccess("Booking confirmed! Email & WhatsApp notifications sent.");
      setForm({ patientId:"", doctorId:"", sessionType:"INITIAL_ASSESSMENT", date:"", time:"09:00" });
      fetch("/api/appointments").then(r=>r.json()).then(setUpcoming);
      setTimeout(() => setSuccess(""), 5000);
    } else {
      setError(data.error ?? "Booking failed");
    }
  }

  const times = ["09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Booking engine</h1>
        <p className="text-sm text-gray-400 mt-0.5">Schedule and manage appointments</p>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">New appointment</h2>
          {success && <div className="mb-3 p-3 bg-green-50 rounded-lg text-sm text-green-700">{success}</div>}
          {error && <div className="mb-3 p-3 bg-red-50 rounded-lg text-sm text-red-600">{error}</div>}
          <form onSubmit={handleBook} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Patient *</label>
              <select required value={form.patientId} onChange={e=>setForm({...form,patientId:e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select patient</option>
                {patients.map(p=><option key={p.id} value={p.id}>{p.name} — {p.patientCode}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Doctor *</label>
              <select required value={form.doctorId} onChange={e=>setForm({...form,doctorId:e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select doctor</option>
                {doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Session type</label>
              <select value={form.sessionType} onChange={e=>setForm({...form,sessionType:e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="INITIAL_ASSESSMENT">Initial assessment</option>
                <option value="FOLLOW_UP">Follow-up</option>
                <option value="SPECIALIZED">Specialized</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Date *</label>
                <input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Time *</label>
                <select required value={form.time} onChange={e=>setForm({...form,time:e.target.value})}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {times.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" disabled={saving}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-50">
              {saving ? "Booking..." : "Confirm booking"}
            </button>
          </form>
          <div className="mt-4 p-3 bg-amber-50 rounded-lg">
            <p className="text-xs text-amber-700 font-medium">Reschedule rule</p>
            <p className="text-xs text-amber-600 mt-0.5">Only 1 reschedule allowed per booking.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Upcoming appointments</h2>
          <div className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No upcoming appointments</p>
            ) : upcoming.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-50 hover:bg-gray-50">
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">{a.patient.name}</div>
                  <div className="text-xs text-gray-400">{a.doctor.name} · {a.sessionType.replace(/_/g," ")}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    {new Date(a.startTime).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(a.startTime).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${a.status==="CONFIRMED"?"bg-blue-50 text-blue-600":
                    a.status==="ATTENDED"?"bg-green-50 text-green-700":
                    a.status==="MISSED"?"bg-red-50 text-red-600":"bg-gray-100 text-gray-500"}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}