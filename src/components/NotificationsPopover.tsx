import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NotificationDetailModal } from "./NotificationDetailModal";
import {
  useNotificationMutations,
  useNotificationsPreviewQuery,
} from "../lib/queries";
import type { AppNotification } from "../types/notification";

function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9a6 6 0 0112 0c0 7 3 7 3 9H3c0-2 3-2 3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function iconForType(type: string): string {
  if (type.includes("chat")) return "💬";
  if (type.includes("offer") || type.includes("errand") || type.includes("proof")) return "📦";
  if (type.includes("payment") || type.includes("escrow") || type.includes("payout")) return "₦";
  return "🔔";
}

function relatedErrandId(n: AppNotification): number | null {
  const raw = n.data?.errand_id ?? n.related_id;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

type Props = {
  unreadCount: number;
};

export function NotificationsPopover({ unreadCount }: Props) {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<AppNotification | null>(null);
  const { data: items = [], isPending, isError, refetch } = useNotificationsPreviewQuery(open);
  const { markRead } = useNotificationMutations();

  const badgeLabel = unreadCount > 99 ? "99+" : String(unreadCount);
  const selectedLive =
    selected == null ? null : (items.find((n) => n.id === selected.id) ?? selected);

  useEffect(() => {
    if (!open) return;
    void refetch();
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refetch]);

  async function handleOpen(n: AppNotification) {
    setOpen(false);
    setSelected(n);
    if (!n.is_read) {
      try {
        await markRead.mutateAsync(n.id);
      } catch {
        // still show the notification
      }
    }
  }

  return (
    <div className="notif-popover" ref={wrapRef}>
      <button
        type="button"
        className={`header-icon-btn${open ? " active" : ""}`}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
        {unreadCount > 0 ? <span className="notification-badge">{badgeLabel}</span> : null}
      </button>

      {open ? (
        <div className="notif-popover-panel" role="dialog" aria-label="Recent notifications">
          <div className="notif-popover-head">
            <strong>Notifications</strong>
            {unreadCount > 0 ? <span className="muted">{unreadCount} unread</span> : null}
          </div>

          {isPending && items.length === 0 ? (
            <p className="muted notif-popover-empty">Loading…</p>
          ) : isError ? (
            <p className="error notif-popover-empty">Couldn’t load notifications.</p>
          ) : items.length === 0 ? (
            <p className="muted notif-popover-empty">No notifications yet.</p>
          ) : (
            <ul className="notif-popover-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif-popover-row${n.is_read ? "" : " unread"}`}
                    onClick={() => void handleOpen(n)}
                  >
                    <span className="notification-type-icon" aria-hidden="true">
                      {iconForType(n.type)}
                    </span>
                    <span className="notification-body">
                      <span className="notification-title-row">
                        <span className="notification-title">{n.title || "Notification"}</span>
                        {!n.is_read ? (
                          <span className="notification-dot" aria-label="Unread" />
                        ) : null}
                      </span>
                      <span className="notification-message">{n.message}</span>
                    </span>
                    <span className="notification-time">{formatWhen(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link to="/notifications" className="notif-popover-all" onClick={() => setOpen(false)}>
            View all
          </Link>
        </div>
      ) : null}

      {selectedLive ? (
        <NotificationDetailModal
          notification={selectedLive}
          onClose={() => setSelected(null)}
          onViewRelated={
            relatedErrandId(selectedLive)
              ? () => {
                  const errandId = relatedErrandId(selectedLive);
                  setSelected(null);
                  if (errandId) navigate(`/errands/${errandId}`);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
