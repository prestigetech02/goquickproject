import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { getApiErrorMessage } from "../lib/http";
import { useFundWalletMutation, useProfileQuery } from "../lib/queries";
import { formatNaira } from "../types/errand";

const PRESETS = [1000, 2000, 5000, 10000, 20000, 50000];

type Props = {
  onClose: () => void;
};

export function FundWalletModal({ onClose }: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: profile } = useProfileQuery();
  const fund = useFundWalletMutation();

  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !fund.isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, fund.isPending]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(String(amount).replace(/,/g, ""));
    if (!Number.isFinite(parsed) || parsed < 1) {
      setError("Enter a valid amount (min ₦1).");
      return;
    }

    const email = profile?.email?.trim();
    if (!email) {
      setError("Add an email to your profile before funding your wallet.");
      return;
    }

    try {
      const data = await fund.mutateAsync({
        amount: parsed,
        email,
        callbackUrl: `${window.location.origin}/wallet`,
      });
      window.location.assign(data.authorization_url!);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not start payment."));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !fund.isPending && onClose()}>
      <div
        className="modal-panel wallet-fund-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="notification-modal-header">
          <h2 id={titleId} className="notification-modal-title" style={{ margin: 0 }}>
            Fund wallet
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close"
            onClick={onClose}
            disabled={fund.isPending}
          >
            ×
          </button>
        </div>

        <p className="muted wallet-fund-copy">Choose an amount or enter your own. You’ll pay securely with Paystack.</p>

        <div className="wallet-presets" role="group" aria-label="Suggested amounts">
          {PRESETS.map((value) => {
            const selected = Number(amount) === value;
            return (
              <button
                key={value}
                type="button"
                className={`wallet-preset${selected ? " selected" : ""}`}
                onClick={() => setAmount(String(value))}
                disabled={fund.isPending}
              >
                {formatNaira(value)}
              </button>
            );
          })}
        </div>

        <form className="stack" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            <span className="label">Amount (₦)</span>
            <input
              ref={inputRef}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="e.g. 5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={fund.isPending}
              required
            />
          </label>

          {error ? <p className="error">{error}</p> : null}

          <div className="notification-modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={fund.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={fund.isPending}>
              {fund.isPending ? "Starting…" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
