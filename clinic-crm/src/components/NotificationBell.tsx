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
  APPOINTMENT_CREATED:     "bg-[#E7F3EA] text-[#4F8A5B]",
  APPOINTMENT_CANCELLED:   "bg-[#FDECEC] text-[#C94F4F]",
  APPOINTMENT_RESCHEDULED: "bg-[#FFF4E8] text-[#D9A441]",
  APPOINTMENT_MISSED:      "bg-[#FCEFE6] text-[#D97332]",
  DOCTOR_REASSIGNED:       "bg-[#EFE7DA] text-[#5C1408]",
  HOLIDAY_REQUEST:         "bg-[#F5F1E8] text-[#4B0F05]",
  REASSIGNMENT_REQUEST:    "bg-[#E8E1D5] text-[#5C1408]",
  SESSION_COMPLETED:       "bg-[#E7F3EA] text-[#4F8A5B]",
  SYSTEM:                  "bg-[#EFE7DA] text-[#7A685F]",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);

  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;

  const h = Math.floor(m / 60);

  if (h < 24) return `${h}h ago`;

  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/notifications");
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);

    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
    });

    setNotifications((prev) =>
      prev.map((n) => ({
        ...n,
        read: true,
      }))
    );

    setUnreadCount(0);
  };

  return (
    <div ref={ref} className="relative">

      {/* ── Bell button ── */}
      <button
        onClick={() => {
          setOpen((o) => !o);

          if (!open) fetchNotifications();
        }}
        className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-[#4B0F05] hover:bg-[#5C1408] text-white shadow-[0_8px_24px_rgba(75,15,5,0.15)] hover:shadow-[0_10px_30px_rgba(75,15,5,0.22)] transition-all duration-200 hover:-translate-y-0.5"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={2.2} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D97332] text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-md">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute right-0 top-full mt-3 w-80 sm:w-96 max-w-[calc(100vw-24px)] bg-white rounded-3xl shadow-[0_10px_40px_rgba(75,15,5,0.12)] border border-[#DDD2C2] z-50 overflow-hidden backdrop-blur-sm">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E8E1D5] bg-[#F5F1E8]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#EFE7DA] flex items-center justify-center">
                <Bell size={14} className="text-[#4B0F05]" />
              </div>

              <span className="text-sm font-bold text-[#2B1A14]">
                Notifications
              </span>

              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-[#EFE7DA] text-[#4B0F05] px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#4B0F05] hover:text-[#D97332] font-semibold transition-colors duration-200"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#EFE7DA]">

            {loading ? (
              <div className="flex items-center justify-center py-10 text-[#7A685F] text-sm gap-3">
                <div className="w-4 h-4 border-2 border-[#4B0F05] border-t-transparent rounded-full animate-spin" />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#7A685F]">
                <div className="w-12 h-12 bg-[#F5F1E8] rounded-2xl flex items-center justify-center">
                  <Bell size={22} className="opacity-50 text-[#7A685F]" />
                </div>

                <span className="text-sm font-semibold">
                  No notifications
                </span>

                <span className="text-xs text-[#B7A79B]">
                  You're all caught up!
                </span>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`mx-2 my-1 rounded-2xl px-4 py-3 transition-all duration-200 cursor-pointer hover:bg-[#F5F1E8] ${
                    !n.read
                      ? "bg-[#FFF8F2] border-l-[3px] border-[#D97332]"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">

                    <span
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold shrink-0 leading-none tracking-wide ${
                        TYPE_COLORS[n.type] ??
                        "bg-[#EFE7DA] text-[#7A685F]"
                      }`}
                    >
                      {n.type.replace(/_/g, " ")}
                    </span>

                    {!n.read && (
                      <span className="mt-1 w-2 h-2 rounded-full bg-[#D97332] shrink-0" />
                    )}
                  </div>

                  <p className="text-sm font-bold text-[#2B1A14] leading-snug">
                    {n.title}
                  </p>

                  <p className="text-xs text-[#7A685F] leading-relaxed mt-1">
                    {n.body}
                  </p>

                  <p className="mt-2 text-[10px] text-[#A08F84] font-medium">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-[#E8E1D5] bg-[#F5F1E8] text-center">
              <a
                href="/dashboard/notifications"
                className="text-xs text-[#4B0F05] hover:text-[#D97332] font-bold transition-colors duration-200"
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