"use client";

/**
 * src/components/NotificationBell.tsx
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";

interface InAppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  entityId?: string;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  APPOINTMENT_CREATED:     "bg-green-100 text-green-700",
  APPOINTMENT_CANCELLED:   "bg-red-100 text-red-700",
  APPOINTMENT_RESCHEDULED: "bg-amber-100 text-amber-700",
  APPOINTMENT_MISSED:      "bg-orange-100 text-orange-700",
  DOCTOR_REASSIGNED:       "bg-purple-100 text-purple-700",
  HOLIDAY_REQUEST:         "bg-blue-100 text-blue-700",
  REASSIGNMENT_REQUEST:    "bg-indigo-100 text-indigo-700",
  SESSION_COMPLETED:       "bg-teal-100 text-teal-700",
  SYSTEM:                  "bg-slate-100 text-slate-600",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen]                   = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={ref} className="relative">

      {/* ── Bell button — teal pill so it's always visible on a white header ── */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) fetchNotifications(); }}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
        aria-label="Notifications"
      >
        <Bell size={17} strokeWidth={2} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-teal-600" />
              <span className="text-sm font-bold text-slate-800">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-teal-600 hover:text-teal-800 font-semibold"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400 text-sm gap-2">
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                Loading…
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Bell size={20} className="opacity-40" />
                </div>
                <span className="text-sm font-medium">No notifications</span>
                <span className="text-xs text-slate-300">You're all caught up!</span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 hover:bg-slate-50 transition-colors ${!n.read ? "bg-blue-50/40 border-l-2 border-teal-400" : ""}`}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 leading-4 ${
                        TYPE_COLORS[n.type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {n.type.replace(/_/g, " ")}
                    </span>
                    {!n.read && (
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-800 leading-snug">{n.title}</p>
                  <p className="text-xs text-slate-500 leading-snug mt-0.5">{n.body}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-center">
              <a
                href="/dashboard/notifications"
                className="text-xs text-teal-600 hover:text-teal-800 font-semibold"
              >
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}