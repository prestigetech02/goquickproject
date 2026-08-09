import { useEffect, useId, useRef, useState, type FormEvent } from "react";

type Props = {
  busy?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export function RejectProofModal({ busy = false, onClose, onConfirm }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Please explain why you are rejecting this proof.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Reason must be 1000 characters or less.");
      return;
    }
    setError(null);
    onConfirm(trimmed);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Reject proof?
          </h2>
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
        <p className="notification-modal-body">
          The errand will go back to in progress so the runner can fix and resubmit proof.
        </p>
        <form className="stack" onSubmit={handleSubmit}>
          <label>
            <span className="label">Reason</span>
            <textarea
              ref={inputRef}
              rows={3}
              maxLength={1000}
              placeholder="What’s wrong with the delivery proof?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <div className="notification-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Keep reviewing
            </button>
            <button type="submit" className="btn-primary logout-confirm-btn" disabled={busy}>
              {busy ? "Rejecting…" : "Reject proof"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
