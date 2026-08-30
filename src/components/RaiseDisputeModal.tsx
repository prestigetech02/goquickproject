import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  DISPUTE_TYPES,
  type ErrandDisputeType,
} from "../types/errand";

type Props = {
  errandTitle: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: { type: ErrandDisputeType; reason: string }) => void;
};

export function RaiseDisputeModal({
  errandTitle,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [type, setType] = useState<ErrandDisputeType>("service");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reasonRef.current?.focus();
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
      setError("Please describe what went wrong.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Reason must be 1000 characters or less.");
      return;
    }
    setError(null);
    onConfirm({ type, reason: trimmed });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal-panel raise-dispute-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Raise a dispute
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
          This will pause <strong>{errandTitle || "this errand"}</strong> until support reviews it.
          The runner will be notified.
        </p>
        <p className="cancel-errand-fee">
          Use this when something went wrong with payment or delivery — not for cancelling an errand
          you no longer need.
        </p>

        <form className="stack" onSubmit={handleSubmit}>
          <fieldset className="dispute-type-fieldset">
            <legend className="label">What kind of issue?</legend>
            {DISPUTE_TYPES.map((item) => (
              <label
                key={item.value}
                className={`dispute-type-option${type === item.value ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="dispute-type"
                  value={item.value}
                  checked={type === item.value}
                  onChange={() => setType(item.value)}
                  disabled={busy}
                />
                <span>
                  <strong>{item.label}</strong>
                  <span className="muted">{item.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label>
            <span className="label">What happened?</span>
            <textarea
              ref={reasonRef}
              rows={4}
              maxLength={1000}
              placeholder="Give enough detail for support to review this."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}

          <div className="notification-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Keep errand
            </button>
            <button type="submit" className="btn-primary cancel-errand-confirm" disabled={busy}>
              {busy ? "Submitting…" : "Raise dispute"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
