/**
 * src/components/ActivityBadge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a patient's computed activity status as a coloured badge.
 *
 * Usage:
 *   <ActivityBadge status={patient.activityStatus} lastAttendedAt={patient.lastAttendedAt} />
 *
 * The parent is responsible for passing the already-computed values from the
 * API response — this component never fetches data itself.
 */

"use client";

import { formatDistanceToNow } from "date-fns";

type ActivityStatus = "ACTIVE" | "INACTIVE";

interface ActivityBadgeProps {
  /** Computed by the API — never stored in DB */
  status: ActivityStatus;
  /** ISO string or Date — the most recent ATTENDED appointment, if any */
  lastAttendedAt?: string | Date | null;
  /** Show tooltip with "last seen X ago" */
  showTooltip?: boolean;
}

const STYLES: Record<ActivityStatus, { badge: string; dot: string; label: string }> = {
  ACTIVE: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    dot:   "bg-emerald-500 animate-pulse",
    label: "Active",
  },
  INACTIVE: {
    badge: "bg-gray-100 text-gray-500 border border-gray-200",
    dot:   "bg-gray-400",
    label: "Inactive",
  },
};

export function ActivityBadge({
  status,
  lastAttendedAt,
  showTooltip = true,
}: ActivityBadgeProps) {
  const style     = STYLES[status];
  const lastSeen  = lastAttendedAt ? new Date(lastAttendedAt) : null;
  const timeAgo   = lastSeen
    ? formatDistanceToNow(lastSeen, { addSuffix: true })
    : "No visits recorded";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
      title={showTooltip ? `Last session: ${timeAgo}` : undefined}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
}

// ─── PatientActivityRow — convenience wrapper for table rows ──────────────────
interface PatientActivityRowProps {
  patient: {
    id:             string;
    name:           string;
    patientCode:    string;
    activityStatus: ActivityStatus;
    lastAttendedAt: string | Date | null;
  };
}

export function PatientActivityRow({ patient }: PatientActivityRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        {patient.name}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {patient.patientCode}
      </td>
      <td className="px-4 py-3">
        <ActivityBadge
          status={patient.activityStatus}
          lastAttendedAt={patient.lastAttendedAt}
        />
      </td>
    </tr>
  );
}

export default ActivityBadge;