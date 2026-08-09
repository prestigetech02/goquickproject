import { useEffect, useId, useRef, useState, type FormEvent } from "react";

type Props = {
  runnerName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: { rating: number; comment?: string | null }) => void;
};

export function ReviewRunnerModal({
  runnerName,
  busy = false,
  onClose,
  onConfirm,
}: Props) {
  const titleId = useId();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
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
    if (rating < 1 || rating > 5) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setError(null);
    onConfirm({
      rating,
      comment: comment.trim() || null,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal-panel review-runner-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Rate your experience
          </h2>
          <button
            ref={closeRef}
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
          How was your errand with <strong>{runnerName || "your runner"}</strong>?
        </p>

        <form className="stack" onSubmit={handleSubmit}>
          <div
            className="review-stars"
            role="radiogroup"
            aria-label="Rating"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => {
              const active = (hover || rating) >= value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  className={`review-star${active ? " active" : ""}`}
                  disabled={busy}
                  onMouseEnter={() => setHover(value)}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              );
            })}
          </div>

          <label>
            <span className="label">Comment (optional)</span>
            <textarea
              rows={3}
              maxLength={1000}
              placeholder="Share a short note about the delivery…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={busy}
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div className="notification-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Submitting…" : "Submit review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
