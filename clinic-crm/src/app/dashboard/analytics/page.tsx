import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/login");

  const [total, newP, returning, missed, attended, confirmed] = await Promise.all([
    prisma.appointment.count(),
    prisma.patient.count({ where: { status: "NEW" } }),
    prisma.patient.count({ where: { status: "RETURNING" } }),
    prisma.appointment.count({ where: { status: "MISSED" } }),
    prisma.appointment.count({ where: { status: "ATTENDED" } }),
    prisma.appointment.count({ where: { status: "CONFIRMED" } }),
  ]);

  const sessionTypes = await prisma.appointment.groupBy({
    by: ["sessionType"],
    _count: { sessionType: true },
  });

  const noShowRate = total > 0 ? ((missed / total) * 100).toFixed(1) : "0";
  const attendRate = total > 0 ? ((attended / total) * 100).toFixed(1) : "0";

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-400 mt-0.5">New vs returning · No-shows · Session trends</p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total sessions", value: total },
          { label: "Attendance rate", value: `${attendRate}%` },
          { label: "No-show rate", value: `${noShowRate}%` },
          { label: "Confirmed upcoming", value: confirmed },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className="text-2xl font-semibold text-gray-900">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Patient breakdown</h2>
          <div className="space-y-4">
            {[
              { label: "New patients", value: newP, total: newP + returning, color: "#378ADD" },
              { label: "Returning patients", value: returning, total: newP + returning, color: "#1D9E75" },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className="text-xs font-medium text-gray-900">
                    {item.value} ({item.total > 0 ? Math.round((item.value/item.total)*100) : 0}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: item.total > 0 ? `${(item.value/item.total)*100}%` : "0%",
                    background: item.color
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-medium text-gray-900 mb-4">Session outcomes</h2>
            <div className="space-y-3">
              {[
                { label: "Attended", value: attended, color: "#1D9E75" },
                { label: "Missed", value: missed, color: "#E24B4A" },
                { label: "Confirmed", value: confirmed, color: "#378ADD" },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-medium text-gray-900">
                      {item.value} ({total > 0 ? Math.round((item.value/total)*100) : 0}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: total > 0 ? `${(item.value/total)*100}%` : "0%",
                      background: item.color
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h2 className="text-sm font-medium text-gray-900 mb-4">Session type breakdown</h2>
          <div className="space-y-3">
            {sessionTypes.map(s => (
              <div key={s.sessionType}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-gray-500">{s.sessionType.replace(/_/g," ")}</span>
                  <span className="text-xs font-medium text-gray-900">
                    {s._count.sessionType} ({total > 0 ? Math.round((s._count.sessionType/total)*100) : 0}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-teal-500" style={{
                    width: total > 0 ? `${(s._count.sessionType/total)*100}%` : "0%"
                  }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-xl">
            <h3 className="text-xs font-medium text-gray-500 mb-3">Quick summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total patients</span>
                <span className="font-medium text-gray-900">{newP + returning}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Total sessions</span>
                <span className="font-medium text-gray-900">{total}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Attendance rate</span>
                <span className="font-medium text-green-600">{attendRate}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">No-show rate</span>
                <span className="font-medium text-red-500">{noShowRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}