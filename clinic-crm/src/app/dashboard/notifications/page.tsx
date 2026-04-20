import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({
    orderBy: { scheduledAt: "desc" },
    take: 20,
    include: { appointment: { include: { patient: true, doctor: true } } },
  });

  const channels = [
    { name: "Gmail", desc: "Booking confirmations + reminders", status: "Active" },
    { name: "WhatsApp (Twilio)", desc: "24h + 2h reminders + missed alerts", status: "Active" },
    { name: "Google Calendar", desc: "Auto events for patient + doctor", status: "Active" },
  ];

  const timeline = [
    { label: "Booking confirmed", desc: "Email + WhatsApp + Calendar invite (immediate)", color: "#1D9E75" },
    { label: "24 hours before", desc: "Reminder email + WhatsApp message", color: "#378ADD" },
    { label: "2 hours before", desc: "Final WhatsApp nudge + Calendar popup", color: "#EF9F27" },
    { label: "Session missed", desc: "Status → MISSED · Doctor notified · Record updated", color: "#E24B4A" },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Notifications & alerts</h1>
        <p className="text-sm text-gray-400 mt-0.5">Email · WhatsApp · Calendar — automated pipeline</p>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Notification log</h2>
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No notifications yet</p>
              <p className="text-xs text-gray-300 mt-1">They'll appear here once bookings are made</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map(n => (
                <div key={n.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                    ${n.status==="SENT"?"bg-green-400":n.status==="FAILED"?"bg-red-400":"bg-amber-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {n.appointment.patient.name}
                    </div>
                    <div className="text-xs text-gray-400">
                      {n.channel} · {new Date(n.scheduledAt).toLocaleDateString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
                    ${n.status==="SENT"?"bg-green-50 text-green-700":
                      n.status==="FAILED"?"bg-red-50 text-red-600":
                      "bg-amber-50 text-amber-600"}`}>
                    {n.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Channels</h2>
            <div className="space-y-2">
              {channels.map(c => (
                <div key={c.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.desc}</div>
                  </div>
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-medium text-gray-900 mb-3">Trigger timeline per booking</h2>
            <div className="relative pl-4">
              <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-100" />
              {timeline.map((t, i) => (
                <div key={i} className="relative pb-4 last:pb-0 pl-4">
                  <div className="absolute -left-1 top-1 w-2 h-2 rounded-full border-2 border-white"
                    style={{ background: t.color }} />
                  <div className="text-xs font-medium text-gray-900">{t.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}