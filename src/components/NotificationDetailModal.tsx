import { useEffect, useId, useRef } from "react";
import { formatDateTime } from "../lib/datetime";
import type { AppNotification } from "../types/notification";

function iconForType(type: string): string {
  if (type.includes("chat")) return "💬";
  if (type.includes("support_ticket")) return "🎫";
  if (type.includes("offer") || type.includes("errand") || type.includes("proof") || type.includes("dispute")) return "📦";
  if (type.includes("payment") || type.includes("escrow") || type.includes("payout")) return "₦";
  return "🔔";
}

type Props = {
  notification: AppNotification;
  onClose: () => void;
  onViewRelated?: () => void;
  relatedLabel?: string;
};

export function NotificationDetailModal({
  notification: n,
  onClose,
  onViewRelated,
  relatedLabel = "View errand",
}: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-panel notification-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <span className="notification-type-icon" aria-hidden="true">
            {iconForType(n.type)}
          </span>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <h2 id={titleId} className="notification-modal-title">
          {n.title || "Notification"}
        </h2>
        <p className="muted notification-modal-time">{formatDateTime(n.created_at)}</p>
        <p className="notification-modal-body">{n.message}</p>

        <div className="notification-modal-actions">
          {onViewRelated ? (
            <button type="button" className="btn-primary" onClick={onViewRelated}>
              {relatedLabel}
            </button>
          ) : null}
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
