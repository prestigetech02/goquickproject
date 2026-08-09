import { useEffect, useId, useRef } from "react";

type Props = {
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function LogoutConfirmModal({ busy = false, onConfirm, onClose }: Props) {
  const titleId = useId();
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, busy]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal-panel logout-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <span className="logout-confirm-icon" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4M15 16l4-4-4-4M19 12H10"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
          >
            ×
          </button>
        </div>

        <h2 id={titleId} className="notification-modal-title">
          Log out?
        </h2>
        <p className="notification-modal-body">
          You’ll need to sign in again to post errands, chat, and manage your wallet.
        </p>

        <div className="notification-modal-actions">
          <button
            ref={stayRef}
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Stay signed in
          </button>
          <button
            type="button"
            className="btn-primary logout-confirm-btn"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Signing out…" : "Log out"}
          </button>
        </div>
      </div>
    </div>
  );
}
