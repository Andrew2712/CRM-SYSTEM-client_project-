import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// ─── Channel icons as SVG strings (server-safe) ───────────────────────────────

const CHANNEL_CONFIG = [
  {
    name: "Gmail",
    desc: "Booking confirmations + reminders",
    status: "Active",
    color: "#EA4335",
    bg: "bg-red-50",
    border: "border-red-100",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <rect width="24" height="24" rx="4" fill="#EA4335" fillOpacity="0.12"/>
        <path d="M4 8l8 5 8-5" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="3" y="7" width="18" height="12" rx="2" stroke="#EA4335" strokeWidth="1.5"/>
        <path d="M3 7l9 6 9-6" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: "WhatsApp (Twilio)",
    desc: "24h + 2h reminders + missed alerts",
    status: "Active",
    color: "#25D366",
    bg: "bg-green-50",
    border: "border-green-100",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <rect width="24" height="24" rx="4" fill="#25D366" fillOpacity="0.12"/>
        <circle cx="12" cy="12" r="7.5" stroke="#25D366" strokeWidth="1.5"/>
        <path d="M8.5 10.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5-.5 2-1 2.5c-.5.5 1 2 1.5 2.5" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M9 16.5l-1.5.5.5-1.5" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    name: "Google Calendar",
    desc: "Auto events for patient + doctor",
    status: "Active",
    color: "#4285F4",
    bg: "bg-blue-50",
    border: "border-blue-100",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
        <rect width="24" height="24" rx="4" fill="#4285F4" fillOpacity="0.12"/>
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="#4285F4" strokeWidth="1.5"/>
        <path d="M3.5 9.5h17" stroke="#4285F4" strokeWidth="1.5"/>
        <path d="M8 3v3M16 3v3" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="8" y="12" width="3" height="3" rx="0.5" fill="#4285F4"/>
      </svg>
    ),
  },
];

const TIMELINE = [
  {
    label: "Booking confirmed",
    desc: "Email + WhatsApp + Calendar invite sent immediately",
    color: "#10b981",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    textColor: "text-emerald-700",
    dot: "bg-emerald-500",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    label: "24 hours before",
    desc: "Reminder email + WhatsApp message sent to patient",
    color: "#3b82f6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    textColor: "text-blue-700",
    dot: "bg-blue-500",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "2 hours before",
    desc: "Final WhatsApp nudge + Google Calendar popup reminder",
    color: "#f59e0b",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
    dot: "bg-amber-500",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    label: "Session missed",
    desc: "Status → MISSED · Doctor notified · Patient record updated",
    color: "#ef4444",
    bg: "bg-red-50",
    border: "border-red-200",
    textColor: "text-red-600",
    dot: "bg-red-500",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
];

const STATUS_CONFIG: Record<string, { pill: string; dot: string; label: string }> = {
  SENT:    { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Sent" },
  FAILED:  { pill: "bg-red-50 text-red-600 border border-red-200",             dot: "bg-red-500",     label: "Failed" },
  PENDING: { pill: "bg-amber-50 text-amber-700 border border-amber-200",       dot: "bg-amber-500",   label: "Pending" },
};

const CHANNEL_PILL: Record<string, string> = {
  EMAIL:     "bg-red-50 text-red-600 border border-red-100",
  WHATSAPP:  "bg-green-50 text-green-700 border border-green-100",
  CALENDAR:  "bg-blue-50 text-blue-700 border border-blue-100",
};

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 50,
    include: {
      appointment: {
        include: { patient: true, doctor: true },
      },
    },
  });

  const sentCount    = notifications.filter(n => n.status === "SENT").length;
  const failedCount  = notifications.filter(n => n.status === "FAILED").length;
  const pendingCount = notifications.filter(n => n.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md bg-teal-600">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notifications & Alerts</h1>
            </div>
            <p className="text-sm text-slate-400 ml-[42px]">Email · WhatsApp · Calendar — automated pipeline</p>
          </div>
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-700 rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Pipeline active
          </div>
        </div>

        {/* ── KPI chips ── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-xs font-semibold text-slate-500">Total</span>
            <span className="text-sm font-black text-slate-800 ml-1">{notifications.length}</span>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600">Sent</span>
            <span className="text-sm font-black text-emerald-700 ml-1">{sentCount}</span>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-xs font-semibold text-amber-600">Pending</span>
            <span className="text-sm font-black text-amber-700 ml-1">{pendingCount}</span>
          </div>
          {failedCount > 0 && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-600">Failed</span>
              <span className="text-sm font-black text-red-700 ml-1">{failedCount}</span>
            </div>
          )}
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-[1fr_380px] gap-6 items-start">

          {/* ── Notification log ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Notification Log</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last {notifications.length} notifications across all channels</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {notifications.length} entries
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  Notifications will appear here once bookings are made and the pipeline triggers
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      {["Patient", "Channel", "Scheduled", "Status"].map(h => (
                        <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((n, idx) => {
                      const cfg = STATUS_CONFIG[n.status] ?? STATUS_CONFIG.PENDING;
                      const chPill = CHANNEL_PILL[n.channel] ?? "bg-slate-100 text-slate-500 border border-slate-200";
                      const patientInitials = n.appointment.patient.name
                        .split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();

                      return (
                        <tr key={n.id}
                          className={`border-b border-slate-50 last:border-0 hover:bg-teal-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}>

                          {/* Patient */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-black flex-shrink-0">
                                {patientInitials}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">{n.appointment.patient.name}</p>
                                <p className="text-xs text-slate-400">{n.appointment.doctor.name}</p>
                              </div>
                            </div>
                          </td>

                          {/* Channel */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${chPill}`}>
                              {n.channel === "EMAIL" && (
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              )}
                              {n.channel === "WHATSAPP" && (
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                              )}
                              {n.channel === "CALENDAR" && (
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              )}
                              {n.channel.charAt(0) + n.channel.slice(1).toLowerCase()}
                            </span>
                          </td>

                          {/* Scheduled */}
                          <td className="px-5 py-4">
                            <p className="text-sm font-semibold text-slate-700">
                              {new Date(n.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(n.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${n.status === "PENDING" ? "animate-pulse" : ""}`} />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="space-y-5">

            {/* Channels */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-base font-bold text-slate-900">Active Channels</h2>
                <p className="text-xs text-slate-400 mt-0.5">All 3 channels operational</p>
              </div>
              <div className="p-4 space-y-3">
                {CHANNEL_CONFIG.map(c => (
                  <div key={c.name}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${c.bg} ${c.border} transition-all hover:shadow-sm`}>
                    <div className="flex-shrink-0">{c.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${c.badge}`}>
                      ● {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trigger timeline */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <h2 className="text-base font-bold text-slate-900">Trigger Timeline</h2>
                <p className="text-xs text-slate-400 mt-0.5">Automated sequence per booking</p>
              </div>
              <div className="p-5">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-5 bottom-5 w-px bg-slate-100" />

                  <div className="space-y-3">
                    {TIMELINE.map((t, i) => (
                      <div key={i} className={`relative flex items-start gap-4 p-4 rounded-2xl border ${t.bg} ${t.border}`}>
                        {/* Step number */}
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                          style={{ background: t.color }}>
                          {t.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${t.textColor}`}>{t.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t.desc}</p>
                        </div>
                        {/* Step badge */}
                        <span className="text-[9px] font-black text-slate-400 bg-white border border-slate-100 px-2 py-1 rounded-lg flex-shrink-0 self-start">
                          STEP {i + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info note */}
                <div className="mt-4 flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl">
                  <div className="w-5 h-5 bg-slate-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    All notifications are triggered automatically when a booking is confirmed. No manual action required.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}