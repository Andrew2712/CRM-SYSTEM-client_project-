import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { labelForSentinel } from "@/lib/notifications";
import type { Notification, Patient, User, Appointment } from "@prisma/client";

// ─── Type for notification with nested relations ───────────────────────────

type NotificationWithRelations = Notification & {
  appointment: Appointment & {
    patient: Patient;
    doctor: User;
  };
};

// ─── Channel icons ────────────────────────────────────────────────────────────

const CHANNEL_CONFIG = [
  {
    name: "Gmail",
    desc: "Booking confirmations + reminders",
    status: "Active",
    color: "#EA4335",
    bg: "bg-[#EA4335]/5",
    border: "border-[#EA4335]/15",
    badge: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",
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
    bg: "bg-[#25D366]/5",
    border: "border-[#25D366]/15",
    badge: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",
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
    bg: "bg-[#4285F4]/5",
    border: "border-[#4285F4]/15",
    badge: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30",
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
    desc: "Email + WhatsApp sent immediately",
    color: "#4F8A5B",
    bg: "bg-[#4F8A5B]/8",
    border: "border-[#4F8A5B]/25",
    textColor: "text-[#4F8A5B]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  {
    label: "24 hours before",
    desc: "WhatsApp reminder sent to patient",
    color: "#D97332",
    bg: "bg-[#D97332]/8",
    border: "border-[#D97332]/25",
    textColor: "text-[#D97332]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "2 hours before",
    desc: "Final WhatsApp nudge to patient",
    color: "#D9A441",
    bg: "bg-[#D9A441]/8",
    border: "border-[#D9A441]/30",
    textColor: "text-[#8B6419]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    label: "Session missed",
    desc: "Status → MISSED · Doctor notified · Patient alerted",
    color: "#C94F4F",
    bg: "bg-[#C94F4F]/8",
    border: "border-[#C94F4F]/25",
    textColor: "text-[#C94F4F]",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
];

const STATUS_CONFIG: Record<string, { pill: string; dot: string; label: string }> = {
  SENT:    { pill: "bg-[#4F8A5B]/10 text-[#4F8A5B] border border-[#4F8A5B]/30", dot: "bg-[#4F8A5B]",  label: "Sent" },
  FAILED:  { pill: "bg-[#C94F4F]/10 text-[#C94F4F] border border-[#C94F4F]/30", dot: "bg-[#C94F4F]",  label: "Failed" },
  PENDING: { pill: "bg-[#D9A441]/10 text-[#8B6419] border border-[#D9A441]/40", dot: "bg-[#D9A441]",  label: "Pending" },
};

const CHANNEL_PILL: Record<string, string> = {
  EMAIL:    "bg-[#EA4335]/8 text-[#EA4335] border border-[#EA4335]/20",
  WHATSAPP: "bg-[#25D366]/8 text-[#1a9e4c] border border-[#25D366]/20",
  CALENDAR: "bg-[#4285F4]/8 text-[#4285F4] border border-[#4285F4]/20",
};

// ─── Format a real Date for display (IST) ────────────────────────────────────
function formatDisplayDate(date: Date | null): { date: string; time: string } {
  if (!date) return { date: "—", time: "—" };
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date),
  };
}

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({
    orderBy: { sentAt: "desc" },
    take: 12,
    include: {
      appointment: {
        include: { patient: true, doctor: true },
      },
    },
  });

  const sentCount    = notifications.filter((n: Notification) => n.status === "SENT").length;
  const failedCount  = notifications.filter((n: Notification) => n.status === "FAILED").length;
  const pendingCount = notifications.filter((n: Notification) => n.status === "PENDING").length;

  return (
    <div className="min-h-screen bg-[#F5F1E8] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md bg-[#4B0F05]">
                <svg className="w-4 h-4 text-[#F5F1E8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2B1A14] tracking-tight">Notifications & Alerts</h1>
            </div>
            <p className="text-xs sm:text-sm text-[#7A685F] ml-[42px]">Email · WhatsApp · Calendar — automated pipeline</p>
          </div>
          <div className="self-start flex items-center gap-2 bg-[#4F8A5B]/10 border border-[#4F8A5B]/30 text-[#4F8A5B] rounded-xl px-4 py-2 text-xs font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#4F8A5B] animate-pulse" />
            Pipeline active
          </div>
        </div>

        {/* ── KPI chips ── */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white border border-[#DDD2C2] rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#7A685F]" />
            <span className="text-xs font-semibold text-[#7A685F]">Showing</span>
            <span className="text-sm font-black text-[#2B1A14] ml-0.5">{notifications.length}</span>
            <span className="text-xs font-semibold text-[#7A685F]">of last 10</span>
          </div>
          <div className="flex items-center gap-2 bg-[#4F8A5B]/8 border border-[#4F8A5B]/25 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#4F8A5B]" />
            <span className="text-xs font-semibold text-[#4F8A5B]">Sent</span>
            <span className="text-sm font-black text-[#4F8A5B] ml-0.5">{sentCount}</span>
          </div>
          <div className="flex items-center gap-2 bg-[#D9A441]/8 border border-[#D9A441]/30 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#D9A441]" />
            <span className="text-xs font-semibold text-[#8B6419]">Pending</span>
            <span className="text-sm font-black text-[#8B6419] ml-0.5">{pendingCount}</span>
          </div>
          {failedCount > 0 && (
            <div className="flex items-center gap-2 bg-[#C94F4F]/8 border border-[#C94F4F]/25 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#C94F4F]" />
              <span className="text-xs font-semibold text-[#C94F4F]">Failed</span>
              <span className="text-sm font-black text-[#C94F4F] ml-0.5">{failedCount}</span>
            </div>
          )}
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 sm:gap-6 items-start">

          {/* ── Notification log ── */}
          <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] bg-gradient-to-r from-[#F5F1E8] to-white flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-[#2B1A14]">Notification Log</h2>
                <p className="text-xs text-[#7A685F] mt-0.5">Last 10 triggered notifications — times shown in IST</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7A685F] bg-[#E8E1D5] px-3 py-1.5 rounded-xl flex-shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                {notifications.length} entries
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="py-20 sm:py-24 flex flex-col items-center justify-center text-center px-4">
                <div className="w-14 h-14 bg-[#E8E1D5] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-[#7A685F]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <p className="text-sm font-bold text-[#7A685F]">No notifications yet</p>
                <p className="text-xs text-[#7A685F]/60 mt-1 max-w-xs">
                  Notifications appear here once bookings are made
                </p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F5F1E8]/80 border-b border-[#E8E1D5]">
                        {["Patient / Type", "Channel", "Sent At (IST)", "Status"].map(h => (
                          <th key={h} className="text-left px-5 py-3.5 text-[11px] font-bold text-[#7A685F] uppercase tracking-widest">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(notifications as NotificationWithRelations[]).map((n, idx) => {
                        const cfg         = STATUS_CONFIG[n.status] ?? STATUS_CONFIG.PENDING;
                        const chPill      = CHANNEL_PILL[n.channel] ?? "bg-[#E8E1D5] text-[#7A685F] border border-[#DDD2C2]";
                        const initials    = n.appointment.patient.name
                          .split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();
                        const displayTime = formatDisplayDate(n.sentAt ?? null);
                        const notifType   = labelForSentinel(n.scheduledAt);

                        return (
                          <tr key={n.id}
                            className={`border-b border-[#F5F1E8] last:border-0 hover:bg-[#FDF3EC]/50 transition-colors duration-150 ${idx % 2 === 0 ? "bg-white" : "bg-[#F5F1E8]/20"}`}>

                            {/* Patient + notification type */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#FDF3EC] border border-[#DDD2C2]/60 flex items-center justify-center text-[#D97332] text-xs font-black flex-shrink-0">
                                  {initials}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-[#2B1A14]">{n.appointment.patient.name}</p>
                                  <p className="text-[11px] text-[#7A685F] mt-0.5">{notifType}</p>
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
                                {n.channel.charAt(0) + n.channel.slice(1).toLowerCase()}
                              </span>
                            </td>

                            {/* Sent time */}
                            <td className="px-5 py-4">
                              {n.sentAt ? (
                                <>
                                  <p className="text-sm font-semibold text-[#2B1A14]">{displayTime.date}</p>
                                  <p className="text-xs text-[#7A685F] mt-0.5">{displayTime.time}</p>
                                </>
                              ) : (
                                <span className="text-xs text-[#7A685F]/50 italic">Not sent yet</span>
                              )}
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

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-[#E8E1D5]">
                  {(notifications as NotificationWithRelations[]).map((n) => {
                    const cfg         = STATUS_CONFIG[n.status] ?? STATUS_CONFIG.PENDING;
                    const chPill      = CHANNEL_PILL[n.channel] ?? "bg-[#E8E1D5] text-[#7A685F] border border-[#DDD2C2]";
                    const initials    = n.appointment.patient.name
                      .split(" ").map((x: string) => x[0]).join("").slice(0, 2).toUpperCase();
                    const displayTime = formatDisplayDate(n.sentAt ?? null);
                    const notifType   = labelForSentinel(n.scheduledAt);

                    return (
                      <div key={n.id} className="p-4 hover:bg-[#FDF3EC]/40 transition-colors duration-150">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-[#FDF3EC] border border-[#DDD2C2]/60 flex items-center justify-center text-[#D97332] text-xs font-black flex-shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#2B1A14] truncate">{n.appointment.patient.name}</p>
                              <p className="text-[11px] text-[#7A685F]">{notifType}</p>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${cfg.pill}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${n.status === "PENDING" ? "animate-pulse" : ""}`} />
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
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
                            {n.channel.charAt(0) + n.channel.slice(1).toLowerCase()}
                          </span>
                          {n.sentAt ? (
                            <span className="text-xs text-[#7A685F]">
                              {displayTime.date} · {displayTime.time}
                            </span>
                          ) : (
                            <span className="text-xs text-[#7A685F]/50 italic">Not sent yet</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer note */}
                <div className="px-4 sm:px-6 py-3 border-t border-[#E8E1D5] bg-[#F5F1E8]/60 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-[#7A685F] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[11px] text-[#7A685F]">
                    Showing the <span className="font-bold text-[#5C1408]">12 most recent</span> notifications only.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="space-y-4 sm:space-y-5">

            {/* Active Channels */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] bg-gradient-to-r from-[#F5F1E8] to-white">
                <h2 className="text-sm sm:text-base font-bold text-[#2B1A14]">Active Channels</h2>
                <p className="text-xs text-[#7A685F] mt-0.5">All 3 channels operational</p>
              </div>
              <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
                {CHANNEL_CONFIG.map(c => (
                  <div key={c.name}
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border-2 ${c.bg} ${c.border} transition-all duration-150 hover:shadow-sm`}>
                    <div className="flex-shrink-0">{c.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#2B1A14]">{c.name}</p>
                      <p className="text-xs text-[#7A685F] mt-0.5">{c.desc}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 sm:px-2.5 py-1 rounded-full flex-shrink-0 ${c.badge}`}>
                      ● {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trigger Timeline */}
            <div className="bg-white rounded-2xl border border-[#DDD2C2] shadow-sm overflow-hidden">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-[#E8E1D5] bg-gradient-to-r from-[#F5F1E8] to-white">
                <h2 className="text-sm sm:text-base font-bold text-[#2B1A14]">Trigger Timeline</h2>
                <p className="text-xs text-[#7A685F] mt-0.5">Automated sequence per booking</p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="space-y-2.5 sm:space-y-3">
                  {TIMELINE.map((t, i) => (
                    <div key={i} className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border ${t.bg} ${t.border}`}>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                        style={{ background: t.color }}>
                        {t.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${t.textColor}`}>{t.label}</p>
                        <p className="text-xs text-[#7A685F] mt-0.5 leading-relaxed">{t.desc}</p>
                      </div>
                      <span className="text-[9px] font-black text-[#7A685F] bg-white border border-[#DDD2C2] px-2 py-1 rounded-lg flex-shrink-0 self-start">
                        STEP {i + 1}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-start gap-3 p-3 sm:p-3.5 bg-[#F5F1E8] border border-[#E8E1D5] rounded-2xl">
                  <div className="w-5 h-5 bg-[#E8E1D5] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-[#7A685F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-[#7A685F] leading-relaxed">
                    All times shown in IST (Asia/Kolkata). Notifications fire automatically — no manual action needed.
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