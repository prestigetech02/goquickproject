import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AppNotification } from "../types/notification";

const SWIPE_THRESHOLD = 88;
const MAX_SWIPE = 112;
const REVEAL_OFFSET = 72;

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
  if (type.includes("support_ticket")) return "🎫";
  if (type.includes("offer") || type.includes("errand") || type.includes("proof") || type.includes("dispute")) return "📦";
  if (type.includes("payment") || type.includes("escrow") || type.includes("payout")) return "₦";
  return "🔔";
}

type Props = {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
  onDelete: (id: number) => void;
};

export function NotificationItem({ notification: n, onOpen, onDelete }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const axisLock = useRef<"h" | "v" | null>(null);
  const dragged = useRef(false);
  const active = useRef(false);

  const applyOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const commitDelete = useCallback(() => {
    setExiting(true);
    applyOffset(-MAX_SWIPE);
    window.setTimeout(() => onDelete(n.id), 180);
  }, [applyOffset, n.id, onDelete]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    active.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    startY.current = e.clientY;
    startOffset.current = offsetRef.current;
    axisLock.current = null;
    dragged.current = false;
    setDragging(true);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!active.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!axisLock.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLock.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
      if (axisLock.current === "v") {
        active.current = false;
        setDragging(false);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    if (axisLock.current !== "h") return;

    dragged.current = true;
    applyOffset(Math.min(0, Math.max(-MAX_SWIPE, startOffset.current + dx)));
  }

  function finishPointer(e: ReactPointerEvent<HTMLDivElement>) {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const current = offsetRef.current;

    if (axisLock.current === "h" && dragged.current) {
      if (current <= -SWIPE_THRESHOLD) {
        commitDelete();
      } else if (current < -40) {
        applyOffset(-REVEAL_OFFSET);
      } else {
        applyOffset(0);
      }
      return;
    }

    if (!dragged.current && current === 0) {
      onOpen(n);
    } else if (!dragged.current && current < 0) {
      applyOffset(0);
    }
  }

  return (
    <li className={`notification-swipe${exiting ? " exiting" : ""}`}>
      <div className="notification-swipe-actions" aria-hidden="true">
        <button
          type="button"
          className="notification-swipe-delete"
          tabIndex={-1}
          onClick={() => commitDelete()}
        >
          Delete
        </button>
      </div>

      <div
        className={`notification-row${n.is_read ? "" : " unread"}${dragging ? " dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(n);
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            commitDelete();
          }
        }}
      >
        <span className="notification-type-icon" aria-hidden="true">
          {iconForType(n.type)}
        </span>

        <span className="notification-body">
          <span className="notification-title-row">
            <span className="notification-title">{n.title || "Notification"}</span>
            {!n.is_read ? <span className="notification-dot" aria-label="Unread" /> : null}
          </span>
          <span className="notification-message">{n.message}</span>
        </span>

        <span className="notification-meta">
          <span className="notification-time">{formatWhen(n.created_at)}</span>
          <button
            type="button"
            className="notification-delete"
            aria-label="Delete notification"
            onClick={(e) => {
              e.stopPropagation();
              commitDelete();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            ×
          </button>
        </span>
      </div>
    </li>
  );
}
