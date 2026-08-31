import { useEffect, useId, useRef } from "react";
import { formatNaira } from "../types/errand";

type Props = {
  errandTitle: string;
  escrowHeld: boolean;
  feePercent?: number | null;
  feeAmount?: number | null;
  refundAmount?: number | null;
  escrowAmount?: number | null;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function CancelErrandModal({
  errandTitle,
  escrowHeld,
  feePercent,
  feeAmount,
  refundAmount,
  escrowAmount,
  busy = false,
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const breakdown =
    escrowHeld &&
    feePercent != null &&
    feeAmount != null &&
    refundAmount != null &&
    escrowAmount != null
      ? { feePercent, feeAmount, refundAmount, escrowAmount }
      : null;

  useEffect(() => {
    cancelRef.current?.focus();
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
        className="modal-panel cancel-errand-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <span className="cancel-errand-icon" aria-hidden>
            !
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
          Cancel errand?
        </h2>
        <p className="notification-modal-body">
          You are about to cancel <strong>{errandTitle || "this errand"}</strong>. This cannot be
          undone from here.
        </p>
        {breakdown ? (
          <div className="cancel-errand-breakdown">
            {breakdown.feePercent > 0 ? (
              <p className="cancel-errand-fee">
                Payment is held in escrow. A {trimPercent(breakdown.feePercent)}% cancellation fee will be
                deducted and the rest refunded to your wallet.
              </p>
            ) : (
              <p className="cancel-errand-fee">
                Payment is held in escrow. The full amount will be refunded to your wallet.
              </p>
            )}
            <dl className="cancel-errand-totals">
              <div>
                <dt>Held in escrow</dt>
                <dd>{formatNaira(breakdown.escrowAmount)}</dd>
              </div>
              {breakdown.feePercent > 0 ? (
                <div>
                  <dt>Cancellation fee ({trimPercent(breakdown.feePercent)}%)</dt>
                  <dd>{formatNaira(breakdown.feeAmount)}</dd>
                </div>
              ) : null}
              <div>
                <dt>Refund to wallet</dt>
                <dd>{formatNaira(breakdown.refundAmount)}</dd>
              </div>
            </dl>
          </div>
        ) : escrowHeld ? (
          <p className="cancel-errand-fee">
            Payment is currently held in escrow. A cancellation fee may apply.
          </p>
        ) : null}

        <div className="notification-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Keep errand
          </button>
          <button
            type="button"
            className="btn-primary cancel-errand-confirm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

function trimPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}
