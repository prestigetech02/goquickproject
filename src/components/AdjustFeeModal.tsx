import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { formatNaira } from "../types/errand";

type Props = {
  currentAmount: number | null;
  busy?: boolean;
  onConfirm: (amount: number) => void;
  onClose: () => void;
};

export function AdjustFeeModal({
  currentAmount,
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(
    currentAmount != null && currentAmount > 0 ? String(Math.round(currentAmount)) : "",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
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

  function submit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(String(value).replace(/,/g, "").trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than ₦0");
      return;
    }
    if (
      currentAmount != null &&
      currentAmount > 0 &&
      Math.abs(amount - currentAmount) < 0.005
    ) {
      setError("Enter a different amount to update the fee.");
      return;
    }
    setError(null);
    onConfirm(amount);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="modal-panel cancel-errand-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <span className="cancel-errand-icon" aria-hidden>
            ₦
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
          Adjust fee
        </h2>
        <p className="notification-modal-body">
          Raise or lower your listed errand fee while we search for a runner.
          {currentAmount != null && currentAmount > 0 ? (
            <>
              {" "}
              Current fee: <strong>{formatNaira(currentAmount)}</strong>.
            </>
          ) : null}
        </p>

        <form className="stack" onSubmit={submit}>
          <label>
            <span className="label">New fee (₦)</span>
            <input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min={1}
              step={1}
              placeholder="e.g. 3500"
              value={value}
              disabled={busy}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              required
            />
          </label>
          {error ? <p className="cancel-errand-fee">{error}</p> : null}

          <div className="notification-modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Updating…" : "Update fee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
