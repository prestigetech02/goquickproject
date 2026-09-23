import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime } from "../lib/datetime";
import { getApiErrorMessage } from "../lib/http";
import { useVerifyWalletFundingMutation } from "../lib/queries";
import { formatNaira } from "../types/errand";
import {
  walletTxLabel,
  walletTxSubtitle,
  walletTxTone,
  type WalletTransaction,
} from "../lib/walletApi";

type Props = {
  tx: WalletTransaction;
  onClose: () => void;
  onRefreshed?: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="wallet-tx-detail-row">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function WalletTransactionModal({ tx, onClose, onRefreshed }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const verify = useVerifyWalletFundingMutation();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState(tx);

  useEffect(() => {
    setCurrent(tx);
  }, [tx]);

  const reference = current.reference?.trim() || "";
  const displayReference = reference || `txn-${current.id}`;
  const type = String(current.type).toLowerCase();
  const status = String(current.status).toLowerCase();
  const canRefresh = type === "credit" && status === "pending" && reference.length > 0;
  const tone = walletTxTone(current);
  const credit = type === "credit";
  const amount = Number(current.amount) || 0;

  useEffect(() => {
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !verify.isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, verify.isPending]);

  async function handleRefresh() {
    if (!canRefresh) return;
    setMessage(null);
    setError(null);
    try {
      const data = await verify.mutateAsync(reference);
      setCurrent((prev) => ({ ...prev, ...data.transaction }));
      const next = String(data.transaction.status).toLowerCase();
      if (next === "completed") {
        setMessage("Payment confirmed. Your wallet balance was updated.");
      } else if (next === "pending") {
        setMessage("Payment is still pending. Try again in a moment.");
      } else {
        setMessage(`Status updated: ${next}`);
      }
      onRefreshed?.();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not refresh status."));
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={() => !verify.isPending && onClose()}
    >
      <div
        className="modal-panel wallet-tx-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Transaction details
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={verify.isPending}
          >
            ×
          </button>
        </div>

        <div className="wallet-tx-detail-amount">
          <span className={`wallet-tx-amount ${credit ? "credit" : "debit"}`}>
            {credit ? "+" : "−"}
            {formatNaira(amount)}
          </span>
          <span className={`wallet-tx-status tone-${tone}`}>{status}</span>
        </div>

        <div className="wallet-tx-detail-list">
          <DetailRow label="Description" value={walletTxLabel(current)} />
          {walletTxSubtitle(current) ? (
            <DetailRow label="Details" value={walletTxSubtitle(current)} />
          ) : null}
          <DetailRow label="Type" value={type.toUpperCase()} />
          <DetailRow label="Status" value={status.toUpperCase()} />
          <DetailRow label="Reference" value={displayReference} />
          <DetailRow label="Date" value={formatDateTime(current.created_at)} />
        </div>

        {message ? <p className="info">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div className="notification-modal-actions">
          {canRefresh ? (
            <button
              type="button"
              className="btn-primary"
              disabled={verify.isPending}
              onClick={() => void handleRefresh()}
            >
              {verify.isPending ? "Refreshing…" : "Refresh status"}
            </button>
          ) : null}
          <button
            type="button"
            className={canRefresh ? "btn-secondary" : "btn-primary"}
            onClick={onClose}
            disabled={verify.isPending}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
