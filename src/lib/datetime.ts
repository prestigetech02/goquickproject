/** Shared date/time formatting — always 12-hour with AM/PM. */

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. 3:45 PM */
export function formatTime(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** e.g. Mar 12, 2026, 3:45 PM */
export function formatDateTime(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** e.g. 12 Mar, 2026 */
export function formatDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** e.g. Mar 12 */
export function formatShortDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Chat/list relative time: Just now / 5 min / 3:45 PM / Wed / Mar 12
 */
export function formatRelativeWhen(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return formatTime(iso);
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return formatShortDate(iso);
}

/** Day separator for chat: Today / Yesterday / Wednesday, March 12 */
export function formatDayLabel(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startMsg = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday.getTime() - startMsg.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
